#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getDuracubePrinciples,
  getLearnedCorrections,
  getOutputFormat,
  toolDefinitions,
} from './tools/knowledge-tools.js';
import {
  GetPrinciplesSchema,
  GetLearnedCorrectionsSchema,
} from './schemas/tool-schemas.js';
import { startHttpServer } from './server.js';

// Determine transport mode from environment or command line
const transportMode = process.env.TRANSPORT_MODE || process.argv[2] || 'stdio';
const port = parseInt(process.env.PORT || '3000', 10);

// Create the MCP server for stdio mode
function createStdioServer(): Server {
  const server = new Server(
    {
      name: 'duracube-contract-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        toolDefinitions.get_duracube_principles,
        toolDefinitions.get_learned_corrections,
        toolDefinitions.get_output_format,
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_duracube_principles': {
          const validatedArgs = GetPrinciplesSchema.parse(args || {});
          const result = getDuracubePrinciples(validatedArgs);
          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        }

        case 'get_learned_corrections': {
          const validatedArgs = GetLearnedCorrectionsSchema.parse(args || {});
          const result = getLearnedCorrections(validatedArgs);
          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        }

        case 'get_output_format': {
          const result = getOutputFormat();
          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Start the server based on transport mode
async function main() {
  if (transportMode === 'http') {
    // HTTP mode for Railway deployment
    startHttpServer(port);
  } else {
    // Stdio mode for Claude Code local testing
    const server = createStdioServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('DuraCube Contract MCP Server started (stdio mode)');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
