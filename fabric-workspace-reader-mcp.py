"""
fabric-workspace-reader-mcp.py
================================
MCP server for exploring Microsoft Fabric and Power BI workspaces

Example prompts to test this server:
'List all my workspaces'
'Show me what's in workspace X'
'What datasets are in this workspace?'
"""

#region Imports
import subprocess
import json
import os
import requests
import keyring
from fastmcp import FastMCP
from typing import Optional, List, Dict, Any
#endregion


#region Configuration
# Create server
mcp = FastMCP("fabric-workspace-reader")

# API endpoint constants
POWERBI_API = "https://api.powerbi.com/v1.0/myorg"
#endregion


#region Helper Functions
# Authentication function
def get_access_token() -> str:
    """Get access token in 1 of 3 different methods."""
    # 1. First try to get token from environment variable
    token = os.environ.get("POWERBI_TOKEN", "")
    if token:
        return token

    # 2. Try Azure CLI
    try:
        import platform
        
        # Use shell=True on Windows to ensure az.cmd is found
        use_shell = platform.system() == "Windows"
        
        result = subprocess.run(
            ["az", "account", "get-access-token", "--resource", "https://analysis.windows.net/powerbi/api"],
            capture_output=True, 
            text=True, 
            check=True,
            shell=use_shell
        )
        token_data = json.loads(result.stdout)
        return token_data.get("accessToken", "")
    except subprocess.CalledProcessError as e:
        print(f"Azure CLI error: {e.stderr}")
    except Exception as e:
        print(f"Azure CLI auth failed: {str(e)}")

    # 3. Try keyring as fallback
    try:
        return keyring.get_password("powerbi", "token") or ""
    except Exception:
        return ""

# Get token
TOKEN = get_access_token()

if not TOKEN:
    print("WARNING: No authentication token found. Please authenticate using one of these methods:")
    print("1. Set POWERBI_TOKEN environment variable")
    print("2. Run 'az login' (Azure CLI)")
    print("3. Use 'keyring set powerbi token' to store token")

# Create session with default headers
session = requests.Session()
session.headers.update({
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
})


# Function to make API requests with error handling
def make_request(url: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Makes an HTTP request to the specified URL.
    Supports GET and POST methods with JSON data.
    Returns JSON response or error message.
    """
    try:
        response = session.request(method, url, json=data)
        return response.json() if response.ok else {"error": f"HTTP {response.status_code}: {response.text[:200]}"}
    except Exception as e:
        return {"error": str(e)}
#endregion


#region MCP Tools
@mcp.tool()
def list_workspaces() -> str:
    """
    List all accessible Microsoft Fabric workspaces.
    
    Returns a list of workspaces with their IDs and names.
    Examples: 'list all my workspaces', 'show me my workspaces', 'what workspaces do I have access to?'
    """
    url = f"{POWERBI_API}/groups"
    result = make_request(url)
    
    if "error" in result:
        return f"Error: {result['error']}"
    
    workspaces = result.get("value", [])
    
    if not workspaces:
        return "No workspaces found. Please verify your authentication and permissions."
    
    output = [f"Found {len(workspaces)} workspaces:\n\n"]
    
    for ws in workspaces:
        output.append(f"• {ws.get('name', 'Unknown')}\n")
        output.append(f"  ID: {ws.get('id', 'Unknown')}\n")
        output.append(f"  Type: {ws.get('type', 'Unknown')}\n")
        output.append(f"  State: {ws.get('state', 'Unknown')}\n")
        output.append("\n")
    
    return ''.join(output)


@mcp.tool()
def get_workspace_contents(workspace_id: str) -> str:
    """
    Get detailed information about items in a specific workspace.
    
    Args:
        workspace_id: The workspace ID
    
    Returns information about all items (datasets, reports, dashboards, dataflows) in the workspace.
    Examples: 'show me what's in this workspace', 'list all datasets in workspace X', 'what's in this workspace?'
    """
    # Get datasets
    datasets_url = f"{POWERBI_API}/groups/{workspace_id}/datasets"
    datasets_result = make_request(datasets_url)
    
    # Get reports
    reports_url = f"{POWERBI_API}/groups/{workspace_id}/reports"
    reports_result = make_request(reports_url)
    
    # Get dashboards
    dashboards_url = f"{POWERBI_API}/groups/{workspace_id}/dashboards"
    dashboards_result = make_request(dashboards_url)
    
    # Get dataflows
    dataflows_url = f"{POWERBI_API}/groups/{workspace_id}/dataflows"
    dataflows_result = make_request(dataflows_url)
    
    output = [f"Workspace Contents (ID: {workspace_id})\n"]
    output.append(f"{'='*60}\n\n")
    
    # Datasets
    if "error" not in datasets_result:
        datasets = datasets_result.get("value", [])
        output.append(f"DATASETS ({len(datasets)}):\n")
        output.append("-" * 60 + "\n")
        for ds in datasets:
            output.append(f"• {ds.get('name', 'Unknown')}\n")
            output.append(f"  ID: {ds.get('id', 'Unknown')}\n")
            output.append(f"  Configured By: {ds.get('configuredBy', 'Unknown')}\n")
            if ds.get('isRefreshable'):
                output.append(f"  Refreshable: Yes\n")
            output.append("\n")
    else:
        output.append(f"DATASETS: Error - {datasets_result['error']}\n\n")
    
    # Reports
    if "error" not in reports_result:
        reports = reports_result.get("value", [])
        output.append(f"REPORTS ({len(reports)}):\n")
        output.append("-" * 60 + "\n")
        for rpt in reports:
            output.append(f"• {rpt.get('name', 'Unknown')}\n")
            output.append(f"  ID: {rpt.get('id', 'Unknown')}\n")
            if rpt.get('datasetId'):
                output.append(f"  Dataset ID: {rpt.get('datasetId')}\n")
            output.append(f"  Web URL: {rpt.get('webUrl', 'N/A')}\n")
            output.append("\n")
    else:
        output.append(f"REPORTS: Error - {reports_result['error']}\n\n")
    
    # Dashboards
    if "error" not in dashboards_result:
        dashboards = dashboards_result.get("value", [])
        output.append(f"DASHBOARDS ({len(dashboards)}):\n")
        output.append("-" * 60 + "\n")
        for db in dashboards:
            output.append(f"• {db.get('displayName', 'Unknown')}\n")
            output.append(f"  ID: {db.get('id', 'Unknown')}\n")
            output.append(f"  Web URL: {db.get('webUrl', 'N/A')}\n")
            output.append("\n")
    else:
        output.append(f"DASHBOARDS: Error - {dashboards_result['error']}\n\n")
    
    # Dataflows
    if "error" not in dataflows_result:
        dataflows = dataflows_result.get("value", [])
        output.append(f"DATAFLOWS ({len(dataflows)}):\n")
        output.append("-" * 60 + "\n")
        for df in dataflows:
            output.append(f"• {df.get('name', 'Unknown')}\n")
            output.append(f"  ID: {df.get('objectId', 'Unknown')}\n")
            if df.get('description'):
                output.append(f"  Description: {df.get('description')}\n")
            output.append("\n")
    else:
        output.append(f"DATAFLOWS: Error - {dataflows_result['error']}\n\n")
    
    return ''.join(output)
#endregion


#region Main Entry Point
if __name__ == "__main__":
    mcp.run()
#endregion
