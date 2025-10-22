#!/usr/bin/env python3
import asyncio
import aiohttp
from aiohttp import BasicAuth

async def test():
    username = "crm"
    password = "Casilina25"
    
    # Prova URL semplificati
    test_urls = [
        "https://vkbu5u.arubadrive.com/remote.php/dav",
        "https://vkbu5u.arubadrive.com/dav",
        "https://vkbu5u.arubadrive.com/webdav",
        "https://vkbu5u.arubadrive.com",
    ]
    
    auth = BasicAuth(username, password)
    
    async with aiohttp.ClientSession(auth=auth) as session:
        for url in test_urls:
            print(f"\n🧪 Testing: {url}")
            try:
                async with session.request("PROPFIND", url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    print(f"   Status: {response.status}")
                    if response.status in [200, 207, 301, 302]:
                        print(f"   ✅ Got response!")
                        body = await response.text()
                        print(f"   Response: {body[:500]}")
            except Exception as e:
                print(f"   ❌ Error: {e}")

asyncio.run(test())
