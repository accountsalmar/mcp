# 🚀 Simple Installation Guide for Claude Desktop

## What You're Installing

This is an MCP (Model Context Protocol) server that lets Claude Desktop interact with Microsoft Fabric and Power BI. Think of it as giving Claude the ability to manage your data workspaces!

---

## 📍 Step 1: Find Your Claude Desktop Config File

Claude Desktop stores its settings in a JSON file. You need to find and edit this file.

### **Where to find it:**

**🪟 Windows:**
```
C:\Users\YOUR_USERNAME\AppData\Roaming\Claude\claude_desktop_config.json
```
Quick way to open it:
1. Press `Windows + R`
2. Type: `%APPDATA%\Claude\claude_desktop_config.json`
3. Press Enter

**🍎 macOS:**
```
/Users/YOUR_USERNAME/Library/Application Support/Claude/claude_desktop_config.json
```
Quick way to open it:
1. Press `Command + Shift + G` in Finder
2. Paste: `~/Library/Application Support/Claude/`
3. Open `claude_desktop_config.json`

**🐧 Linux:**
```
/home/YOUR_USERNAME/.config/Claude/claude_desktop_config.json
```
Quick way to open it:
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

---

## 📝 Step 2: Edit the Config File

### **If the file is EMPTY or has `{}`:**

Replace everything with this:

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

### **If the file already has OTHER MCP servers:**

Your file might look like this:
```json
{
  "mcpServers": {
    "some-other-server": {
      "command": "...",
      "args": [...]
    }
  }
}
```

In this case, ADD the fabric-analytics section like this:

```json
{
  "mcpServers": {
    "some-other-server": {
      "command": "...",
      "args": [...]
    },
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

**⚠️ IMPORTANT:**
- Notice the **comma** `,` after the first server's closing `}`
- Keep the JSON formatting exact (all the brackets and quotes matter!)

---

## 🔐 Step 3: Set Up Authentication

The MCP server needs permission to access your Microsoft Fabric/Power BI account. You have **3 options** (choose ONE):

### **Option A: Azure CLI (Easiest for Beginners)** ⭐ RECOMMENDED

**What you need:**
1. Install Azure CLI: https://aka.ms/installazurecliwindows
2. Login to Azure in your terminal/command prompt:
   ```bash
   az login
   ```
   (This opens a browser - login with your Microsoft account)

3. Set your subscription:
   ```bash
   az account set --subscription "your-subscription-name"
   ```

**Your config stays as shown above** (already uses `azure_cli`)

✅ **Benefits:**
- No tokens to manage
- Uses your existing Azure login
- Most secure for local use

---

### **Option B: Bearer Token (Quick but Temporary)**

**What you need:**
1. Go to: https://app.powerbi.com/embedsetup
2. Login with your Microsoft account
3. Click to generate a token
4. Copy the token (it's a long string)

**Update your config to:**
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/home/user/Power-bi-map-server/build/index.js"],
      "cwd": "/home/user/Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "bearer_token",
        "FABRIC_TOKEN": "PASTE_YOUR_TOKEN_HERE",
        "FABRIC_WORKSPACE_ID": "your-workspace-id-here",
        "NODE_ENV": "production"
      }
    }
  }
}
```

⚠️ **Note:** Token expires in about 1 hour - you'll need to get a new one regularly

---

### **Option C: Service Principal (Advanced - for Production)**

This requires creating an Azure App Registration. Skip this unless you need long-term automated access.

**Steps:**
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Create new app
3. Create client secret
4. Grant Fabric permissions

**Update your config to:**
```json
{
  "mcpServers": {
    "fabric-analytics": {
      "command": "node",
      "args": ["/home/user/Power-bi-map-server/build/index.js"],
      "cwd": "/home/user/Power-bi-map-server",
      "env": {
        "FABRIC_AUTH_METHOD": "service_principal",
        "FABRIC_CLIENT_ID": "your-app-client-id",
        "FABRIC_CLIENT_SECRET": "your-app-secret",
        "FABRIC_TENANT_ID": "your-tenant-id",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## 🎯 Step 4: Restart Claude Desktop

1. **Close Claude Desktop completely** (not just minimize - actually quit)
2. **Open Claude Desktop again**
3. Wait a few seconds for it to load

---

## ✅ Step 5: Test It!

Open a new chat in Claude Desktop and try these questions:

**Simple test:**
```
Can you list the MCP tools available?
```
You should see "fabric-analytics" tools listed!

**Test Fabric access:**
```
List all my Microsoft Fabric workspaces
```

**Other things to try:**
```
Show me all items in my Fabric workspace
```
```
What Fabric capacities do I have access to?
```
```
Create a new lakehouse called "Test Lakehouse"
```

---

## 🐛 Troubleshooting

### **Problem: Claude doesn't show any fabric tools**

**Solution:**
1. Check the config file path is correct
2. Make sure the JSON is valid (no missing commas or brackets)
3. Try restarting Claude Desktop again
4. Check Claude Desktop logs (if available)

### **Problem: "Authentication failed" errors**

**Solution:**
- **If using Azure CLI:** Run `az login` again
- **If using Bearer Token:** Get a fresh token from https://app.powerbi.com/embedsetup
- **If using Service Principal:** Verify your client ID, secret, and tenant ID are correct

### **Problem: "Cannot find module" error**

**Solution:**
1. Verify the path in your config file points to the correct location
2. On Windows, the path might need to be:
   ```json
   "args": ["C:\\Users\\YourName\\Power-bi-map-server\\build\\index.js"]
   ```
3. Make sure the build folder exists in your installation directory

### **Problem: JSON syntax errors**

**Solution:**
Use a JSON validator like https://jsonlint.com/ to check your config file

---

## 📚 What Can You Do Now?

Once installed, you can ask Claude to:

### **Workspace Management:**
- "List all my Fabric workspaces"
- "Create a new workspace called 'Analytics'"
- "Show workspace details"

### **Data Items:**
- "List all lakehouses in workspace [id]"
- "Create a new notebook called 'Sales Analysis'"
- "Show me all datasets"

### **Spark & Analytics:**
- "Create a Spark session"
- "Execute SQL query: SELECT * FROM my_table"
- "Show running Spark jobs"
- "Generate a monitoring dashboard"

### **Capacity:**
- "List available capacities"
- "Assign my workspace to a capacity"

---

## 🎓 Quick Reference

**Config file locations:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Authentication methods:**
1. **Azure CLI** - Run `az login` first (easiest)
2. **Bearer Token** - Get from https://app.powerbi.com/embedsetup (quick)
3. **Service Principal** - Azure app registration (advanced)

**Test commands:**
- `az login` - Login to Azure
- `npm start` - Test the server locally
- `node build/index.js` - Run the server directly

---

## ❓ Need More Help?

- **Full documentation:** See `README.md` in the installation folder
- **Authentication details:** See `AUTHENTICATION_SETUP.md`
- **GitHub issues:** https://github.com/santhoshravindran7/Fabric-Analytics-MCP/issues

---

## 🎉 You're All Set!

Once you complete these steps:
1. ✅ Config file edited
2. ✅ Authentication set up
3. ✅ Claude Desktop restarted
4. ✅ Test commands working

You can now use Claude to manage your Microsoft Fabric and Power BI resources directly through conversation! 🚀
