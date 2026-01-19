# Claude Code MCP Server Setup Instructions

## Current Status
✅ MCP Server is built and ready
✅ Azure CLI authentication is working
✅ Fix applied (bearerToken is now optional)

## Setup Methods

### Method 1: Via VS Code UI (Easiest)

1. **Open VS Code**
2. **Open Command Palette**: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. **Search for**: "Preferences: Open User Settings (JSON)"
4. **Add this configuration** to your settings.json:

```json
{
  "cline.mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\Users\\KasunJ\\MCP\\Power-bi-map-server\\build\\index.js"],
      "cwd": "C:\\Users\\KasunJ\\MCP\\Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "azure_cli",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Note**: If you already have other settings, just add the `"cline.mcpServers"` section to your existing JSON.

### Method 2: Via MCP Settings File

The Claude Code extension (Cline) stores MCP settings in:

**Windows:**
```
%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

**To create/edit this file:**

1. Press `Win+R` and paste:
   ```
   %APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings
   ```

2. If the folder doesn't exist, create it

3. Create a file named `cline_mcp_settings.json` with this content:
   ```json
   {
     "mcpServers": {
       "fabric-analytics": {
         "command": "node",
         "args": ["C:\\Users\\KasunJ\\MCP\\Power-bi-map-server\\build\\index.js"],
         "cwd": "C:\\Users\\KasunJ\\MCP\\Power-bi-map-server",
         "env": {
           "FABRIC_AUTH_METHOD": "azure_cli",
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

### Method 3: Via Cline Extension Settings

1. **Open VS Code**
2. Click the **Cline icon** in the sidebar (or the Claude Code icon)
3. Look for **MCP Settings** or **Configure MCP Servers**
4. Add the server configuration:
   - **Name**: `fabric-analytics`
   - **Command**: `node`
   - **Args**: `C:\Users\KasunJ\MCP\Power-bi-map-server\build\index.js`
   - **Working Directory**: `C:\Users\KasunJ\MCP\Power-bi-map-server`
   - **Environment Variables**:
     - `FABRIC_AUTH_METHOD`: `azure_cli`
     - `NODE_ENV`: `production`

## After Configuration

1. **Reload VS Code Window**:
   - Press `Ctrl+Shift+P`
   - Type: "Developer: Reload Window"
   - Press Enter

2. **Verify the MCP Server is Loaded**:
   - Open the Cline/Claude Code chat
   - Type: "What MCP servers are available?"
   - You should see `fabric-analytics` listed

3. **Test the Connection**:
   Try these commands in Claude Code:
   ```
   List my Microsoft Fabric workspaces
   ```
   
   ```
   Show items in workspace cd923ddd-cc3f-4403-b59d-e403753e23e2
   ```

## Troubleshooting

### Issue: VS Code doesn't have a Code directory in AppData

**Solution**: The directory is created when you install the Cline extension. Make sure:
1. You have VS Code installed
2. You have installed the "Cline" or "Claude Code" extension from the marketplace
3. You've opened VS Code at least once after installing the extension

### Issue: Cannot find the Cline extension

**Solution**: Install it from the VS Code Marketplace:
1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for "Cline" or "Claude Code"
4. Click Install

### Issue: MCP server not showing up

**Solution**:
1. Check the VS Code Developer Console:
   - Press `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac)
   - Look for errors in the Console tab
2. Verify the path in your configuration is correct
3. Make sure Node.js is installed and in your PATH:
   ```bash
   node --version
   ```

### Issue: Authentication errors

**Solution**:
1. Verify Azure CLI is authenticated:
   ```bash
   az login
   az account get-access-token --resource "https://api.fabric.microsoft.com"
   ```
2. If the token doesn't work, you can use bearer token instead:
   - Change `FABRIC_AUTH_METHOD` to `bearer_token`
   - Add `FABRIC_TOKEN` environment variable with your token

## Alternative: Use Bearer Token Authentication

If Azure CLI doesn't work in VS Code, use bearer token:

```json
{
  "cline.mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["C:\\Users\\KasunJ\\MCP\\Power-bi-map-server\\build\\index.js"],
      "cwd": "C:\\Users\\KasunJ\\MCP\\Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "bearer_token",
        "FABRIC_TOKEN": "YOUR_TOKEN_HERE",
        "NODE_ENV": "production"
      }
    }
  }
}
```

Get your token from: https://app.powerbi.com/embedsetup

## What You Can Do Now

Once configured, you can ask Claude Code to:

### Workspace Operations:
- "List all my Fabric workspaces"
- "Create a new workspace"
- "Show workspace details for [workspace-id]"

### Item Management:
- "List all items in workspace [workspace-id]"
- "Create a new lakehouse called 'MyLakehouse'"
- "Show all notebooks in my workspace"

### Spark Operations:
- "Create a Spark session"
- "Execute this SQL query: SELECT * FROM table"
- "Show running Spark applications"

### Monitoring:
- "Generate a Spark monitoring dashboard"
- "Show me Spark application details"

## Support

- Full documentation: `README.md`
- Authentication guide: `AUTHENTICATION_SETUP.md`
- GitHub Issues: https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues

---

**You're all set!** 🎉
