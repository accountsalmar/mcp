"""
fabric-model-reader.py
================================
Minimal Power BI MCP Server for querying and discovery (FastMCP)

Example prompts to test this server:
'How many measures are in the semantic model Y?'
'What is the DAX for measure Z?'
'What is the total sales by product category?'
"""


#region Imports
import subprocess
import json
import os
import time
import base64
import requests
import keyring
from fastmcp import FastMCP
from typing import Optional, List, Dict, Any, Union
#endregion


#region Configuration
# Create server
mcp = FastMCP("powerbi-server")

# API endpoint constants
POWERBI_API = "https://api.powerbi.com/v1.0/myorg"
FABRIC_API = "https://api.fabric.microsoft.com/v1"
#endregion


#region Helper Functions
# Authentication function
def get_access_token() -> str:
    """Get access token in 1 of 3 different methods."""
    # 1. First try to get token from environment variable
    #    Store token in mcp.json securely as a password
    #    or set it in your environment: export POWERBI_TOKEN
    token = os.environ.get("POWERBI_TOKEN", "")
    if token:
        return token

    # 2. Try Azure CLI
    #    Run `az login` to authenticate first
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
    #    Run `keyring set powerbi token` to store your token securely
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


# Function for LRO (Long Running Operation) handling
def wait_for_operation(location_url: str, retry_seconds: int = 30) -> Dict[str, Any]:
    """
    Waits for a long-running operation to complete.
    Polls the provided location URL until the operation is done.
    Returns the final result or an error message.
    """
    while True:
        time.sleep(retry_seconds)
        response = session.get(location_url)
        
        if not response.ok:
            return {"error": f"Failed to check status: {response.status_code}"}
        
        data = response.json()
        status = data.get('status', '')
        
        if status == 'Succeeded':
            result_response = session.get(f"{location_url}/result")
            return result_response.json() if result_response.ok else {"error": "Failed to get result"}
        elif status == 'Failed':
            return {"error": data.get('error', 'Operation failed')}
#endregion


#region MCP Tools
@mcp.tool()
def get_model_definition(workspace_id: str, dataset_id: str, file_filter: Optional[str] = None, 
                        page: Optional[int] = None, page_size: int = 10, metadata_only: bool = False,
                        file_range: Optional[str] = None) -> str:
    """
    Get the TMDL definition of a semantic model with pagination and filtering support.
    
    Args:
        workspace_id: The workspace ID
        dataset_id: The dataset/semantic model ID
        file_filter: Optional filter for specific files (e.g., 'measures', 'tables/', 'relationships.tmdl')
        page: Page number (default: None). Use either page or file_range, not both.
        page_size: Number of files per page (default: 10)
        metadata_only: If True, return only file paths without content (default: False)
        file_range: File range to retrieve (e.g., '1-10', '11-20'). Use either page or file_range, not both.
    
    Returns full model structure in TMDL format which is necessary to do before evaluating DAX queries.
    Examples: 'show me the data model', 'what tables are in this dataset?', 'get all measures and their DAX'
    """
    url = f"{FABRIC_API}/workspaces/{workspace_id}/semanticModels/{dataset_id}/getDefinition"
    response = session.post(url)
    
    if response.status_code == 202:
        location_header = response.headers.get('Location')
        if location_header:
            result = wait_for_operation(location_header, 
                                      int(response.headers.get('Retry-After', 30)))
        else:
            return "Error: No Location header in 202 response"
    elif response.ok:
        result = response.json()
    else:
        return f"Error: HTTP {response.status_code}"
    
    if "error" in result:
        return f"Error: {result['error']}"
    
    # Extract and decode TMDL parts
    all_parts = result.get("definition", {}).get("parts", [])
    if not all_parts:
        return "No model definition found"
    
    # Filter to only TMDL files
    tmdl_parts = [p for p in all_parts if p.get("path", "").endswith('.tmdl')]
    
    # Apply file filter if specified
    if file_filter:
        tmdl_parts = [p for p in tmdl_parts if file_filter.lower() in p.get("path", "").lower()]
    
    total_parts = len(tmdl_parts)
    
    # Initialize pagination variables
    start_idx = 0
    end_idx = total_parts
    total_pages = 1
    
    # Handle file_range or page parameter
    if file_range and page:
        return "Error: Please use either 'page' or 'file_range', not both"
    
    if file_range:
        # Parse file range (e.g., "1-10", "11-20")
        try:
            start_file, end_file = map(int, file_range.split('-'))
            # Convert to 0-based indexing
            start_idx = start_file - 1
            end_idx = min(end_file, total_parts)
        except ValueError:
            return "Error: Invalid file_range format. Use format like '1-10' or '11-20'"
    else:
        # Use page-based pagination (default to page 1 if not specified)
        if page is None:
            page = 1
        total_pages = ((total_parts + page_size - 1) // page_size) if page_size > 0 else 1
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_parts)
    
    # Get parts for current range
    page_parts = tmdl_parts[start_idx:end_idx]
    
    output = [
        f"Dataset Model Definition (TMDL Format)\n",
        f"{'='*40}\n",
    ]
    
    if file_range:
        output.append(f"File range: {file_range} | Total files: {total_parts}\n")
    else:
        # page is guaranteed to be int here (set to 1 if was None)
        current_page = page if page is not None else 1
        output.append(f"Page {current_page} of {total_pages} | Total files: {total_parts}\n")
        output.append(f"Page size: {page_size}\n")
    
    output.append(f"Filter: {file_filter or 'None'}\n")
    output.append(f"{'='*40}\n")
    
    if metadata_only:
        output.append("\nAvailable files:\n")
        for i, part in enumerate(tmdl_parts):
            marker = "→" if start_idx <= i < end_idx else " "
            output.append(f"{marker} {i+1}. {part['path']}\n")
    else:
        for part in page_parts:
            try:
                content = base64.b64decode(part.get("payload", "")).decode('utf-8')
                output.extend([
                    f"\n{'─'*40}\n",
                    f"File: {part['path']}\n",
                    f"{'─'*40}\n",
                    content,
                    "\n"
                ])
            except Exception as e:
                output.append(f"\nError decoding {part.get('path', 'unknown')}: {str(e)}\n")
    
    # Add navigation hints
    output.append(f"\n{'─'*40}\n")
    output.append("Navigation:\n")
    
    if file_range:
        # For file range navigation
        current_end = end_idx
        if current_end < total_parts:
            next_start = current_end + 1
            next_end = min(current_end + (end_idx - start_idx), total_parts)
            output.append(f"→ Next range: Use file_range='{next_start}-{next_end}'\n")
        
        if start_idx > 0:
            prev_size = end_idx - start_idx
            prev_start = max(1, start_idx - prev_size + 1)
            prev_end = start_idx
            output.append(f"← Previous range: Use file_range='{prev_start}-{prev_end}'\n")
        
        output.append(f"\nSuggested ranges for complete retrieval:\n")
        range_size = 10
        for i in range(0, total_parts, range_size):
            range_start = i + 1
            range_end = min(i + range_size, total_parts)
            output.append(f"  file_range='{range_start}-{range_end}'\n")
    else:
        # For page-based navigation
        # At this point, page is guaranteed to be an int (set to 1 if it was None)
        if total_pages > 1 and page is not None:
            if page > 1:
                output.append(f"← Previous page: Use page={page-1}\n")
            if page < total_pages:
                output.append(f"→ Next page: Use page={page+1}\n")
            output.append(f"\nTo jump to a specific page, use page=N (1 to {total_pages})\n")
    
    output.append("\nTo see only file list, use metadata_only=True\n")
    output.append("To filter files, use file_filter='search_term'\n")
    
    return ''.join(output)


@mcp.tool()
def execute_dax_query(workspace_id: str, dataset_id: str, query: str) -> str:
    """
    Execute a DAX query against a Power BI dataset.
    Returns query results as JSON data.
    Examples:
        'tell me the total sales by product category',
        'what is the revenue and profit by year and month?',
        'how many customers are there by country?'
    Example DAX queries:
        "EVALUATE SUMMARIZECOLUMNS('Product'[Category], "@TotalSales", SUM('Sales'[Amount]))", 
        "EVALUATE SUMMARIZECOLUMNS('Date'[Year], 'Date'[Month], "@Revenue", SUM('Sales'[Revenue]), "@Profit", SUM('Sales'[Profit]))", 
        "EVALUATE SUMMARIZECOLUMNS('Customer'[Country], "@CustomerCount", COUNTROWS('Customer'))"
    """
    url = f"{POWERBI_API}/groups/{workspace_id}/datasets/{dataset_id}/executeQueries"
    result = make_request(url, method="POST", data={"queries": [{"query": query}]})
    
    if "error" in result:
        return f"Error: {result['error']}"
    
    # Return the actual data
    results = result.get("results", [])
    return json.dumps(results[0]["tables"], indent=2) if results and "tables" in results[0] else "No data returned"
#endregion


#region Main Entry Point
if __name__ == "__main__":
    mcp.run()
#endregion
