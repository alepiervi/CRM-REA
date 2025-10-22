#!/usr/bin/env python3
import asyncio
import aiohttp
from aiohttp import BasicAuth

async def test():
    username = "crm"
    password = "Casilina25"
    
    # Nextcloud WebDAV endpoints
    test_urls = [
        f"https://vkbu5u.arubadrive.com/remote.php/dav/files/{username}/",
        f"https://vkbu5u.arubadrive.com/remote.php/webdav/",
        f"https://vkbu5u.arubadrive.com/remote.php/dav/files/{username}",
    ]
    
    auth = BasicAuth(username, password)
    
    async with aiohttp.ClientSession(auth=auth) as session:
        for url in test_urls:
            print(f"\n🧪 Testing Nextcloud: {url}")
            try:
                async with session.request("PROPFIND", url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    print(f"   Status: {response.status}")
                    if response.status in [200, 207]:
                        print(f"   ✅✅✅ SUCCESS! Nextcloud WebDAV works!")
                        body = await response.text()
                        print(f"   Response: {body[:500]}")
                        
                        # Test creazione cartella
                        print(f"\n   🧪 Testing folder creation...")
                        test_folder_url = f"{url}TestFolder"
                        async with session.request("MKCOL", test_folder_url) as resp2:
                            print(f"   Folder creation status: {resp2.status}")
                            if resp2.status in [201, 405]:
                                print(f"   ✅ Folder creation works!")
                        
                        return url
                    else:
                        text = await response.text()
                        print(f"   Response: {text[:200]}")
            except Exception as e:
                print(f"   ❌ Error: {e}")
    
    return None

result = asyncio.run(test())
if result:
    print(f"\n🎉 CORRECT NEXTCLOUD WEBDAV URL: {result}")
else:
    print(f"\n❌ No working URL found")
