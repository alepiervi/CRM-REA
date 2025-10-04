#!/usr/bin/env python3
"""
Check what the Aruba Drive URL actually returns
"""

import requests

def check_aruba_url():
    url = "https://da6z2a.arubadrive.com/login"
    
    print(f"🔍 Checking URL: {url}")
    
    try:
        response = requests.get(url, timeout=10, allow_redirects=True)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'Unknown')}")
        print(f"Content-Length: {len(response.content)} bytes")
        print(f"Final URL: {response.url}")
        
        print(f"\nResponse Headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        
        print(f"\nResponse Content:")
        print("="*50)
        print(response.text)
        print("="*50)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_aruba_url()