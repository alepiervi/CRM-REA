#!/usr/bin/env python3
import asyncio
import aiohttp
from aiohttp import BasicAuth

async def test():
    username = "crm"
    password = "Casilina25"
    
    # Prova diversi base path
    test_urls = [
        "https://vkbu5u.arubadrive.com/remote.php/dav/files/crm",
        "https://vkbu5u.arubadrive.com/remote.php/dav/files/crm/FASTWEB",
        "https://vkbu5u.arubadrive.com/remote.php/webdav",
        "https://vkbu5u.arubadrive.com/remote.php/webdav/FASTWEB",
    ]
    
    auth = BasicAuth(username, password)
    
    async with aiohttp.ClientSession(auth=auth) as session:
        for url in test_urls:
            print(f"\n🧪 Testing: {url}")
            try:
                async with session.request("PROPFIND", url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    print(f"   Status: {response.status}")
                    if response.status in [200, 207]:
                        print(f"   ✅ SUCCESS! This is the correct URL!")
                        body = await response.text()
                        print(f"   Response preview: {body[:300]}")
                        return url
                    elif response.status == 401:
                        print(f"   ❌ 401 Unauthorized - wrong credentials")
                    elif response.status == 403:
                        print(f"   ❌ 403 Forbidden - wrong path")
                    elif response.status == 404:
                        print(f"   ❌ 404 Not Found - wrong path")
            except Exception as e:
                print(f"   ❌ Error: {e}")
    
    return None

asyncio.run(test())
