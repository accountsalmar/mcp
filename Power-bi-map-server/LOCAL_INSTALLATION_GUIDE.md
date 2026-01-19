# Local Installation Guide - Microsoft Fabric Analytics MCP Server

## ✅ Installation Complete!

Your MCP server has been successfully built and is ready to use.

**Installation Location:** `/home/user/Power-bi-map-server`

---

## 🔐 Authentication Setup

This MCP server supports multiple authentication methods. Choose the one that works best for you:

### **Option 1: Azure CLI Authentication (Easiest for Local Development)**

This is the **recommended method** for local testing as it uses your existing Azure login.

**Prerequisites:**
1. Install Azure CLI if not already installed
2. Login to Azure:
   ```bash
   az login
   az account set --subscription "your-subscription-name"
   ```

**Configuration:**
- No additional setup needed!
- The server will automatically use your Azure CLI credentials

### **Option 2: Bearer Token Authentication (Recommended for Claude Desktop)**

**Steps:**
1. Visit: https://app.powerbi.com/embedsetup
2. Generate a bearer token for your workspace
3. Copy the token (it expires after ~1 hour)

**Note:** You'll need to refresh the token periodically.

### **Option 3: Service Principal (Production/Long-term)**

**Prerequisites:**
1. Create an Azure AD App Registration
2. Grant permissions to Microsoft Fabric/Power BI
3. Create a client secret

**You'll need:**
- Client ID (Application ID)
- Client Secret
- Tenant ID
- Workspace ID

---

## 🚀 Claude Desktop Configuration

To use this MCP server with Claude Desktop, add this configuration to your Claude Desktop config file:

### **Configuration File Locations:**
- **Linux:** `~/.config/Claude/claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

### **Example Configuration (Azure CLI Auth):**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/home/user/Power-bi-map-server/build/index.js"],
      "cwd": "/home/user/Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "azure_cli",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### **Example Configuration (Bearer Token):**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/home/user/Power-bi-map-server/build/index.js"],
      "cwd": "/home/user/Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "bearer_token",
        "FABRIC_TOKEN": "your-bearer-token-here",
        "FABRIC_WORKSPACE_ID": "your-workspace-id",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### **Example Configuration (Service Principal):**

```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/home/user/Power-bi-map-server/build/index.js"],
      "cwd": "/home/user/Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "your-client-id",
        "FABRIC_CLIENT_SECRET": "your-client-secret",
        "FABRIC_TENANT_ID": "your-tenant-id",
        "FABRIC_WORKSPACE_ID": "your-workspace-id",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## 🧪 Testing Your Installation

### **Test 1: Run the Server Locally**

```bash
cd /home/user/Power-bi-map-server
npm start
```

This will start the MCP server. You should see it initialize without errors.

### **Test 2: Verify Build**

```bash
node build/index.js
```

The server should start and wait for MCP protocol messages.

### **Test 3: Check Authentication (Azure CLI)**

If using Azure CLI authentication:

```bash
# Verify you're logged in
az account show

# Test Fabric access
az rest --method GET --url "https://api.fabric.microsoft.com/v1/workspaces"
```

---

## 📝 What You Can Do with This MCP Server

Once connected to Claude Desktop, you can ask questions like:

### **Workspace Management:**
- "List all workspaces I have access to"
- "Create a new workspace called 'Analytics Hub'"
- "Show me all items in workspace [workspace-id]"

### **Data Operations:**
- "List all lakehouses in my workspace"
- "Create a new notebook called 'Sales Analysis'"
- "Execute a SQL query on my dataset"

### **Spark & Analytics:**
- "Create a Livy session for Spark analysis"
- "Show me all running Spark applications"
- "Generate a monitoring dashboard for my workspace"

### **Capacity Management:**
- "List all Fabric capacities I can use"
- "Assign my workspace to a capacity"

---

## 🔧 Troubleshooting

### **Issue: "Unexpected token 'P'" or JSON parse errors**
- This means something is writing to STDOUT
- Make sure you're using the latest build: `npm run build`
- Check that no debug console.log statements were added

### **Issue: Authentication failures**
- For Azure CLI: Run `az login` again
- For Bearer Token: Generate a new token (they expire after ~1 hour)
- For Service Principal: Verify client ID, secret, and tenant ID

### **Issue: MCP server not appearing in Claude Desktop**
- Verify the path in claude_desktop_config.json is correct
- Restart Claude Desktop completely
- Check Claude Desktop logs for errors

### **Issue: Permission errors**
- Ensure your Azure account has access to Microsoft Fabric
- Check that workspaces are shared with your account
- Verify capacity assignments if using dedicated capacity

---

## 📚 Additional Resources

- **Full README:** See `README.md` for complete documentation
- **Authentication Guide:** See `AUTHENTICATION_SETUP.md` for detailed auth setup
- **Testing Guide:** See `TESTING_GUIDE.md` for testing information
- **Examples:** See `EXAMPLES.md` for usage examples

---

## ✅ Next Steps

1. Choose your authentication method
2. Set up your Claude Desktop configuration
3. Restart Claude Desktop
4. Try asking Claude to list your Fabric workspaces!

---

**Need Help?**
- Check the GitHub issues: https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues
- Review the documentation files in this repository
