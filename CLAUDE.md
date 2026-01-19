# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains MCP (Model Context Protocol) servers for Microsoft Fabric and Power BI integration. The codebase includes both Python and TypeScript implementations for different use cases.

## Project Structure

### Python MCP Servers (Root Directory)
- **fabric-model-reader-mcp.py** - FastMCP server for querying Power BI semantic models and executing DAX queries
- **fabric-workspace-reader-mcp.py** - FastMCP server for exploring Microsoft Fabric workspaces and listing items

### TypeScript MCP Server (Power-bi-map-server/)
- **src/index.ts** - Main MCP server with comprehensive Fabric analytics capabilities (52 tools)
- **src/fabric-client.ts** - Microsoft Fabric REST API client
- **src/auth-client.ts** - MSAL-based authentication supporting multiple auth methods
- **src/azure-openai-analyzer.ts** - Azure OpenAI integration for analytics
- **src/migration/** - Synapse to Fabric migration tools

## Architecture

### Python Servers (FastMCP)
- Built using FastMCP framework for simplified MCP server creation
- Use `@mcp.tool()` decorator to define MCP tools
- Organized with region markers (`#region`, `#endregion`) for code organization
- Support 3 authentication methods (priority order):
  1. Environment variable `POWERBI_TOKEN`
  2. Azure CLI (`az account get-access-token`)
  3. Keyring (`keyring get powerbi token`)

### TypeScript Server (Full-Featured)
- Built on `@modelcontextprotocol/sdk`
- Supports multiple authentication methods via MSAL:
  - Bearer token (recommended for Claude Desktop)
  - Service Principal (recommended for production)
  - Device Code Flow
  - Interactive Browser
  - Azure CLI
- Uses Zod for schema validation
- Implements Long Running Operation (LRO) polling for async Fabric API operations
- Includes simulation mode for testing without valid credentials

### Key Architecture Patterns

**Authentication Flow (TypeScript)**:
```
Client Request → Auth Check → Token Validation → API Call → LRO Polling (if needed) → Response
```

**Python Server Pattern**:
- Uses `requests.Session()` for connection pooling and header management
- Implements `wait_for_operation()` for handling Fabric's async operations (202 Accepted responses)
- Base64 decoding for TMDL (Tabular Model Definition Language) payloads

**TypeScript Server Pattern**:
- STDOUT protection to prevent JSON-RPC protocol contamination
- Centralizes all logging to STDERR using console.error
- Uses `McpServer` with `StdioServerTransport` for stdio-based communication

## Common Development Tasks

### Python Servers

**Run a Python MCP server directly**:
```bash
python fabric-model-reader-mcp.py
# or
python fabric-workspace-reader-mcp.py
```

**Test authentication**:
```bash
# Using Azure CLI (most common for local dev)
az login
az account get-access-token --resource https://analysis.windows.net/powerbi/api

# Using environment variable
export POWERBI_TOKEN="your-token-here"

# Using keyring
keyring set powerbi token
```

### TypeScript Server

**Build and run**:
```bash
cd Power-bi-map-server
npm install
npm run build     # Compiles TypeScript to build/
npm start         # Runs the compiled server
npm run dev       # Development mode with watch
```

**Testing**:
```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage
npm run test:e2e           # End-to-end tests (requires Azure CLI login)
npm run test:azure-cli     # Test Azure CLI authentication
```

**Authentication setup**:
```bash
# Azure CLI (recommended for local development)
az login
export FABRIC_AUTH_METHOD=azure_cli

# Service Principal (recommended for production)
export FABRIC_AUTH_METHOD=service_principal
export FABRIC_CLIENT_ID=your-client-id
export FABRIC_CLIENT_SECRET=your-secret
export FABRIC_TENANT_ID=your-tenant-id

# Bearer Token (recommended for Claude Desktop)
export FABRIC_AUTH_METHOD=bearer_token
export FABRIC_TOKEN=your-token-here
```

## Critical Implementation Details

### Python Servers

**TMDL Definition Retrieval** (fabric-model-reader-mcp.py):
- Uses Fabric API `/semanticModels/{id}/getDefinition` endpoint
- Returns 202 Accepted with Location header for async operation
- Polls Location URL until status="Succeeded"
- TMDL content is base64-encoded in response
- Supports pagination via `page`, `page_size`, `file_range` parameters
- Filtering via `file_filter` and `metadata_only` for efficient queries

**DAX Query Execution** (fabric-model-reader-mcp.py):
- Uses Power BI REST API `/datasets/{id}/executeQueries` endpoint
- Requires proper authentication scope for Power BI API
- Query format: `{"queries": [{"query": "EVALUATE ..."}]}`

**Workspace Discovery** (fabric-workspace-reader-mcp.py):
- Lists workspaces via `/groups` endpoint
- Retrieves workspace contents across datasets, reports, dashboards, dataflows
- Makes parallel API calls for better performance

### TypeScript Server

**Stdout Protection**:
- Never use `console.log()` in MCP server code - it breaks JSON-RPC protocol
- Use `console.error()` for all debugging output
- Set `ALLOW_UNSAFE_STDOUT=true` only for controlled debugging

**Long Running Operations**:
- Fabric API returns 202 Accepted with Location header
- Must poll Location URL with Retry-After header guidance
- Status progression: NotStarted → Running → Succeeded/Failed

**Migration Tools** (src/migration/):
- Transforms Synapse notebooks to Fabric format
- Converts `mssparkutils` → `notebookutils`
- Handles ABFSS path rewriting to OneLake format
- Creates Fabric workspace and lakehouse for migrated assets

**Notebook Management**:
- Notebook definitions are base64-encoded payloads
- Supports 5 predefined templates: blank, sales_analysis, nyc_taxi_analysis, data_exploration, machine_learning
- Execute via Fabric's job run API with parameter support

## Authentication Requirements

### For Python Servers
- **Scope needed**: `https://analysis.windows.net/powerbi/api/.default`
- Power BI REST API access
- User must have workspace access permissions

### For TypeScript Server
- **Scopes needed**:
  - `https://api.fabric.microsoft.com/.default` (Fabric API)
  - `https://analysis.windows.net/powerbi/api/.default` (Power BI API)
- Requires appropriate Fabric workspace permissions
- Service Principal needs API permissions granted in Azure AD

### Common Auth Issues
- **Azure CLI tokens expire after 1 hour** - users must re-run `az login` or `az account get-access-token`
- **Bearer tokens from Power BI Embed Setup expire quickly** - best for testing only
- **Service Principal requires admin consent** for API permissions in Azure AD

## Configuration Files

### TypeScript Server
- **tsconfig.json** - Targets ES2020, uses Node16 module resolution
- **package.json** - Entry point is `build/index.js`, supports both npm and bin execution
- **jest.config.json** - Jest testing configuration with TypeScript support
- **eslint.config.js** - Code quality and linting rules

### Docker & Kubernetes
- **Dockerfile** - Multi-stage build for production deployment
- **docker-compose.yml** - Local development with health checks
- **k8s/** - Full Kubernetes manifests with HPA, ingress, secrets

## Testing Considerations

### Python Servers
- Test with `az login` authentication first (fastest setup)
- Use `metadata_only=True` when exploring large semantic models
- Test pagination: `page=1, page_size=10` or `file_range='1-10'`

### TypeScript Server
- End-to-end tests create real workspaces in your Fabric tenant
- E2E tests automatically clean up resources after completion
- Set `FABRIC_CAPACITY_ID` in `.env.e2e` to test capacity assignment
- Simulation mode allows testing without valid credentials (uses mock data)

## Dependencies

### Python
- **requests** - HTTP client
- **keyring** - Secure token storage
- **fastmcp** - FastMCP framework for MCP server creation

### TypeScript
- **@modelcontextprotocol/sdk** - Official MCP SDK
- **@azure/msal-node** - Microsoft Authentication Library
- **zod** - Schema validation
- **node-fetch** - HTTP client

## Special Notes

### STDOUT/STDERR Handling
The TypeScript server implements automatic stdout protection because MCP clients expect ONLY JSON-RPC messages on stdout. Any stray `console.log()` will cause "Unexpected token" errors. This is critical for Claude Desktop integration.

### Simulation Mode
The TypeScript server includes comprehensive simulation responses when authentication fails or when `bearerToken: "simulation"` is passed. This allows development and testing without requiring actual Fabric access.

### Migration from Synapse
The migration tools in `src/migration/` provide a complete workflow for moving Spark notebooks from Azure Synapse Analytics to Microsoft Fabric, including code transformation and workspace provisioning.

### Capacity Management
The TypeScript server includes 4 capacity management tools that require higher-level Fabric admin permissions:
- List capacities
- Assign workspace to capacity
- Unassign workspace from capacity
- List workspaces in capacity
