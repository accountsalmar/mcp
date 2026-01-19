#!/usr/bin/env python3
"""
Odoo Query Helper - Direct JSON-RPC API Access

This script provides direct access to Odoo via JSON-RPC for querying data.
It's designed to be called by Claude Code's /odoo-query skill.

IMPORTANT: This is a READ-ONLY tool. It only executes:
- search_read: Search and read records
- read: Read specific records by ID
- search_count: Count matching records
- fields_get: Get model field definitions

Environment Variables Required:
- ODOO_URL: Base URL (e.g., https://duracubeonline.com.au)
- ODOO_DB: Database name (e.g., live)
- ODOO_USERNAME: Login username/email
- ODOO_PASSWORD: API key or password

Usage:
    # Search records
    python odoo-query-helper.py --model res.partner --domain "[('customer_rank', '>', 0)]" --fields "name,email" --limit 50

    # Count records
    python odoo-query-helper.py --model res.partner --domain "[('customer_rank', '>', 0)]" --count

    # Get field definitions
    python odoo-query-helper.py --model res.partner --fields-info

    # List all models
    python odoo-query-helper.py --list-models

    # Read specific IDs
    python odoo-query-helper.py --model res.partner --ids "1,2,3" --fields "name,email"
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error
import ssl


class OdooQueryError(Exception):
    """Custom exception for Odoo query errors with diagnostic info."""
    def __init__(self, message: str, error_type: str, diagnostics: List[str]):
        self.message = message
        self.error_type = error_type
        self.diagnostics = diagnostics
        super().__init__(self.message)


class OdooClient:
    """JSON-RPC client for Odoo - READ ONLY operations."""

    # Whitelist of allowed methods (READ-ONLY)
    ALLOWED_METHODS = {'search_read', 'read', 'search_count', 'fields_get', 'search'}

    def __init__(self, verify_ssl: bool = True):
        self.url = os.environ.get('ODOO_URL', '').rstrip('/')
        self.db = os.environ.get('ODOO_DB', '')
        self.username = os.environ.get('ODOO_USERNAME', '')
        self.password = os.environ.get('ODOO_PASSWORD', '')
        self.uid = None
        self._request_id = 0
        self.verify_ssl = verify_ssl

        # Create SSL context - optionally disable verification for servers with cert issues
        if verify_ssl:
            self.ssl_context = ssl.create_default_context()
        else:
            # Disable SSL verification (some Odoo servers have non-standard certs)
            self.ssl_context = ssl.create_default_context()
            self.ssl_context.check_hostname = False
            self.ssl_context.verify_mode = ssl.CERT_NONE

    def _validate_config(self):
        """Validate that all required environment variables are set."""
        missing = []
        if not self.url:
            missing.append('ODOO_URL')
        if not self.db:
            missing.append('ODOO_DB')
        if not self.username:
            missing.append('ODOO_USERNAME')
        if not self.password:
            missing.append('ODOO_PASSWORD')

        if missing:
            raise OdooQueryError(
                f"Missing environment variables: {', '.join(missing)}",
                "configuration",
                [
                    "Set the required environment variables:",
                    f"  ODOO_URL={self.url or '<your-odoo-url>'}",
                    f"  ODOO_DB={self.db or '<database-name>'}",
                    f"  ODOO_USERNAME={self.username or '<username>'}",
                    "  ODOO_PASSWORD=<api-key-or-password>",
                    "",
                    "You can set these in your shell or .env file."
                ]
            )

    def _json_rpc(self, endpoint: str, method: str, params: Dict[str, Any]) -> Any:
        """Execute a JSON-RPC call to Odoo."""
        self._request_id += 1

        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self._request_id
        }

        url = f"{self.url}{endpoint}"
        data = json.dumps(payload).encode('utf-8')

        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={'Content-Type': 'application/json'}
            )

            with urllib.request.urlopen(req, context=self.ssl_context, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))

            if 'error' in result:
                error_data = result['error']
                error_message = error_data.get('message', 'Unknown error')
                error_detail = error_data.get('data', {}).get('message', '')

                raise OdooQueryError(
                    f"Odoo API Error: {error_message}. {error_detail}",
                    "api_error",
                    [
                        "The Odoo server returned an error.",
                        f"Error: {error_message}",
                        f"Detail: {error_detail}" if error_detail else "",
                        "",
                        "Common causes:",
                        "- Invalid model name",
                        "- Invalid field name in domain or fields list",
                        "- Permission denied for this operation"
                    ]
                )

            return result.get('result')

        except urllib.error.URLError as e:
            raise OdooQueryError(
                f"Connection failed: {str(e)}",
                "connection",
                [
                    f"Could not connect to Odoo at {self.url}",
                    "",
                    "Diagnostic checklist:",
                    "1. Is your VPN connected? (if required)",
                    "2. Can you access the URL in a browser?",
                    "3. Is the Odoo service running?",
                    f"4. Check ODOO_URL is correct: {self.url}",
                    "",
                    f"Technical error: {str(e)}"
                ]
            )
        except json.JSONDecodeError as e:
            raise OdooQueryError(
                f"Invalid response from Odoo: {str(e)}",
                "response",
                [
                    "The server returned an invalid response.",
                    "This usually means:",
                    "- The URL is incorrect (not an Odoo instance)",
                    "- There's a proxy/firewall blocking the request",
                    "- The Odoo service is starting up",
                    "",
                    f"URL attempted: {url}"
                ]
            )

    def authenticate(self) -> int:
        """Authenticate with Odoo and return user ID."""
        self._validate_config()

        try:
            result = self._json_rpc(
                "/jsonrpc",
                "call",
                {
                    "service": "common",
                    "method": "authenticate",
                    "args": [self.db, self.username, self.password, {}]
                }
            )

            if not result:
                raise OdooQueryError(
                    "Authentication failed",
                    "authentication",
                    [
                        "Could not authenticate with Odoo.",
                        "",
                        "Diagnostic checklist:",
                        f"1. Is ODOO_USERNAME correct? (current: {self.username})",
                        "2. Is ODOO_PASSWORD an API key? (Odoo 14+ requires API keys)",
                        "3. Does this user have API access enabled?",
                        f"4. Is database name correct? (current: {self.db})",
                        "",
                        "Tip: In Odoo 14+, create an API key at:",
                        "Settings > Users > [Your User] > API Keys"
                    ]
                )

            self.uid = result
            return result

        except OdooQueryError:
            raise
        except Exception as e:
            raise OdooQueryError(
                f"Authentication error: {str(e)}",
                "authentication",
                [
                    f"Unexpected error during authentication: {str(e)}",
                    "",
                    "Check your credentials and try again."
                ]
            )

    def execute(self, model: str, method: str, *args, **kwargs) -> Any:
        """Execute a method on an Odoo model (READ-ONLY methods only)."""
        # Safety check: only allow read operations
        if method not in self.ALLOWED_METHODS:
            raise OdooQueryError(
                f"Method '{method}' is not allowed",
                "security",
                [
                    f"The method '{method}' is not permitted.",
                    "",
                    "This tool is READ-ONLY for safety.",
                    "Allowed methods: " + ", ".join(sorted(self.ALLOWED_METHODS)),
                    "",
                    "To modify data, use the Odoo web interface."
                ]
            )

        if not self.uid:
            self.authenticate()

        return self._json_rpc(
            "/jsonrpc",
            "call",
            {
                "service": "object",
                "method": "execute_kw",
                "args": [
                    self.db,
                    self.uid,
                    self.password,
                    model,
                    method,
                    list(args),
                    kwargs
                ]
            }
        )

    def search_read(self, model: str, domain: List = None, fields: List[str] = None,
                    limit: int = 100, offset: int = 0, order: str = None) -> List[Dict]:
        """Search and read records from a model."""
        domain = domain or []
        kwargs = {'limit': limit, 'offset': offset}

        if fields:
            kwargs['fields'] = fields
        if order:
            kwargs['order'] = order

        return self.execute(model, 'search_read', domain, **kwargs)

    def search_count(self, model: str, domain: List = None) -> int:
        """Count records matching the domain."""
        domain = domain or []
        return self.execute(model, 'search_count', domain)

    def read(self, model: str, ids: List[int], fields: List[str] = None) -> List[Dict]:
        """Read specific records by ID."""
        kwargs = {}
        if fields:
            kwargs['fields'] = fields
        return self.execute(model, 'read', ids, **kwargs)

    def fields_get(self, model: str, attributes: List[str] = None) -> Dict:
        """Get field definitions for a model."""
        attributes = attributes or ['string', 'type', 'required', 'readonly', 'help', 'selection']
        return self.execute(model, 'fields_get', [], {'attributes': attributes})

    def list_models(self) -> List[Dict]:
        """List all available models."""
        return self.search_read(
            'ir.model',
            [],
            ['model', 'name', 'info'],
            limit=500,
            order='model'
        )


def parse_domain(domain_str: str) -> List:
    """Parse a domain string into a Python list."""
    if not domain_str:
        return []

    try:
        # Handle date placeholders
        today = datetime.now().strftime('%Y-%m-%d')
        domain_str = domain_str.replace("'today'", f"'{today}'")
        domain_str = domain_str.replace('"today"', f'"{today}"')

        # Safely evaluate the domain
        return eval(domain_str, {"__builtins__": {}}, {})
    except Exception as e:
        raise OdooQueryError(
            f"Invalid domain format: {domain_str}",
            "domain",
            [
                "Could not parse the domain filter.",
                "",
                "Domain format: list of tuples, e.g.:",
                "  [('field', 'operator', value)]",
                "",
                "Examples:",
                "  [(\'customer_rank\', \'>\', 0)]",
                "  [(\'name\', \'ilike\', \'%test%\'), (\'active\', \'=\', True)]",
                "",
                f"Your domain: {domain_str}",
                f"Parse error: {str(e)}"
            ]
        )


def parse_fields(fields_str: str) -> List[str]:
    """Parse a comma-separated fields string into a list."""
    if not fields_str:
        return []
    return [f.strip() for f in fields_str.split(',') if f.strip()]


def parse_ids(ids_str: str) -> List[int]:
    """Parse a comma-separated IDs string into a list of integers."""
    if not ids_str:
        return []
    try:
        return [int(i.strip()) for i in ids_str.split(',') if i.strip()]
    except ValueError as e:
        raise OdooQueryError(
            f"Invalid ID format: {ids_str}",
            "ids",
            [
                "IDs must be comma-separated integers.",
                "Example: --ids \"1,2,3,4,5\"",
                f"Your input: {ids_str}",
                f"Error: {str(e)}"
            ]
        )


def format_output(data: Any, output_format: str = 'json') -> str:
    """Format the output data."""
    if output_format == 'json':
        return json.dumps(data, indent=2, default=str)
    return str(data)


def main():
    parser = argparse.ArgumentParser(
        description='Odoo Query Helper - Direct JSON-RPC API Access (READ-ONLY)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Search customers
  python odoo-query-helper.py --model res.partner --domain "[('customer_rank', '>', 0)]" --fields "name,email"

  # Count invoices
  python odoo-query-helper.py --model account.move --domain "[('move_type', '=', 'out_invoice')]" --count

  # Get field info
  python odoo-query-helper.py --model res.partner --fields-info

  # List all models
  python odoo-query-helper.py --list-models
        """
    )

    parser.add_argument('--model', '-m', help='Odoo model name (e.g., res.partner)')
    parser.add_argument('--domain', '-d', default='[]', help='Domain filter as Python list of tuples')
    parser.add_argument('--fields', '-f', help='Comma-separated list of fields to return')
    parser.add_argument('--limit', '-l', type=int, default=100, help='Maximum records to return (default: 100)')
    parser.add_argument('--offset', '-o', type=int, default=0, help='Number of records to skip')
    parser.add_argument('--order', help='Sort order (e.g., "name asc, id desc")')
    parser.add_argument('--ids', help='Comma-separated list of IDs to read')
    parser.add_argument('--count', '-c', action='store_true', help='Return count only')
    parser.add_argument('--fields-info', '-i', action='store_true', help='Get field definitions for model')
    parser.add_argument('--list-models', action='store_true', help='List all available models')
    parser.add_argument('--format', choices=['json', 'raw'], default='json', help='Output format')
    parser.add_argument('--test-connection', action='store_true', help='Test connection and authentication')
    parser.add_argument('--no-ssl-verify', action='store_true', help='Disable SSL certificate verification (use for servers with cert issues)')

    args = parser.parse_args()

    try:
        client = OdooClient(verify_ssl=not args.no_ssl_verify)

        # Test connection
        if args.test_connection:
            client.authenticate()
            result = {
                "status": "success",
                "message": "Successfully connected to Odoo",
                "url": client.url,
                "database": client.db,
                "user": client.username,
                "user_id": client.uid
            }
            print(format_output(result, args.format))
            return

        # List all models
        if args.list_models:
            models = client.list_models()
            result = {
                "operation": "list_models",
                "count": len(models),
                "models": models
            }
            print(format_output(result, args.format))
            return

        # Require model for other operations
        if not args.model:
            parser.error("--model is required for this operation")

        # Get field definitions
        if args.fields_info:
            fields = client.fields_get(args.model)
            result = {
                "operation": "fields_get",
                "model": args.model,
                "field_count": len(fields),
                "fields": fields
            }
            print(format_output(result, args.format))
            return

        # Parse domain
        domain = parse_domain(args.domain)

        # Count operation
        if args.count:
            count = client.search_count(args.model, domain)
            result = {
                "operation": "search_count",
                "model": args.model,
                "domain": domain,
                "count": count
            }
            print(format_output(result, args.format))
            return

        # Read by IDs
        if args.ids:
            ids = parse_ids(args.ids)
            fields = parse_fields(args.fields) if args.fields else None
            records = client.read(args.model, ids, fields)
            result = {
                "operation": "read",
                "model": args.model,
                "ids": ids,
                "record_count": len(records),
                "records": records
            }
            print(format_output(result, args.format))
            return

        # Search and read (default operation)
        fields = parse_fields(args.fields) if args.fields else None
        records = client.search_read(
            args.model,
            domain,
            fields,
            limit=args.limit,
            offset=args.offset,
            order=args.order
        )

        # Get total count for context
        total_count = client.search_count(args.model, domain)

        result = {
            "operation": "search_read",
            "model": args.model,
            "domain": domain,
            "fields_requested": fields,
            "limit": args.limit,
            "offset": args.offset,
            "record_count": len(records),
            "total_matching": total_count,
            "records": records
        }
        print(format_output(result, args.format))

    except OdooQueryError as e:
        error_output = {
            "status": "error",
            "error_type": e.error_type,
            "message": e.message,
            "diagnostics": e.diagnostics
        }
        print(json.dumps(error_output, indent=2), file=sys.stderr)
        sys.exit(1)

    except Exception as e:
        error_output = {
            "status": "error",
            "error_type": "unexpected",
            "message": str(e),
            "diagnostics": [
                "An unexpected error occurred.",
                f"Error type: {type(e).__name__}",
                f"Error message: {str(e)}",
                "",
                "Please report this issue if it persists."
            ]
        }
        print(json.dumps(error_output, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
