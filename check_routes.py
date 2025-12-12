#!/usr/bin/env python3
"""
Check available routes in the FastAPI app
"""

import requests
import json

def check_routes():
    base_url = "https://clientmanage-2.preview.emergentagent.com"
    
    # Try to get OpenAPI schema to see available routes
    try:
        response = requests.get(f"{base_url}/openapi.json", timeout=10)
        if response.status_code == 200:
            openapi_data = response.json()
            paths = openapi_data.get('paths', {})
            
            print("Available API endpoints:")
            for path in sorted(paths.keys()):
                methods = list(paths[path].keys())
                print(f"  {path} - {methods}")
                
            # Check specifically for responsabile-commessa endpoints
            responsabile_endpoints = [path for path in paths.keys() if 'responsabile-commessa' in path]
            print(f"\nResponsabile Commessa endpoints found: {len(responsabile_endpoints)}")
            for endpoint in responsabile_endpoints:
                print(f"  {endpoint}")
        else:
            print(f"Failed to get OpenAPI schema: {response.status_code}")
    except Exception as e:
        print(f"Error checking routes: {e}")

if __name__ == "__main__":
    check_routes()