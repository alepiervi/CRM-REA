#!/usr/bin/env python3
import asyncio
import aiohttp
from aiohttp import BasicAuth
import urllib.parse

async def test():
    username = "crm"
    password = "oPEB4-Z5HSb-7SnPc-5SnMw-JgKqA"
    
    # Nextcloud WebDAV endpoint
    base_url = f"https://vkbu5u.arubadrive.com/remote.php/dav/files/{username}"
    
    print(f"🔐 Testing with App Password")
    print(f"🌐 URL: {base_url}")
    print()
    
    auth = BasicAuth(username, password)
    timeout = aiohttp.ClientTimeout(total=30)
    
    async with aiohttp.ClientSession(auth=auth, timeout=timeout) as session:
        
        # Test 1: Root access
        print("=" * 60)
        print("TEST 1: Root folder access")
        print("=" * 60)
        
        try:
            async with session.request("PROPFIND", base_url) as response:
                print(f"Status: {response.status}")
                if response.status == 207:
                    print("✅✅✅ APP PASSWORD WORKS!")
                    body = await response.text()
                    print(f"Response preview: {body[:300]}")
                else:
                    print(f"❌ Status: {response.status}")
                    print(await response.text())
                    return False
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
        
        print()
        
        # Test 2: Create test folder
        print("=" * 60)
        print("TEST 2: Create folder 'FASTWEB'")
        print("=" * 60)
        
        folder_url = f"{base_url}/FASTWEB"
        
        try:
            async with session.request("MKCOL", folder_url) as response:
                print(f"Status: {response.status}")
                if response.status in [201, 405]:
                    print("✅ Folder created or exists!")
                else:
                    print(f"❌ Failed: {response.status}")
                    print(await response.text())
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print()
        
        # Test 3: Create nested folders
        print("=" * 60)
        print("TEST 3: Create 'FASTWEB/Fastweb/TLS'")
        print("=" * 60)
        
        folders = ["FASTWEB", "FASTWEB/Fastweb", "FASTWEB/Fastweb/TLS"]
        
        for folder in folders:
            folder_url = f"{base_url}/{folder}"
            print(f"\nCreating: {folder}")
            
            try:
                async with session.request("MKCOL", folder_url) as response:
                    if response.status in [201, 405]:
                        print(f"  ✅ Status: {response.status}")
                    else:
                        print(f"  ❌ Status: {response.status}")
            except Exception as e:
                print(f"  ❌ Error: {e}")
        
        print()
        
        # Test 4: Upload test file
        print("=" * 60)
        print("TEST 4: Upload test file")
        print("=" * 60)
        
        file_path = "FASTWEB/Fastweb/TLS/test_upload.txt"
        file_url = f"{base_url}/{file_path}"
        file_content = b"Test upload with App Password - SUCCESS!"
        
        try:
            async with session.request("PUT", file_url, data=file_content) as response:
                print(f"Status: {response.status}")
                if response.status in [201, 204]:
                    print("✅✅✅ FILE UPLOAD WORKS!")
                else:
                    print(f"❌ Failed: {response.status}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        return True

result = asyncio.run(test())
print()
print("=" * 60)
if result:
    print("🎉🎉🎉 SUCCESS! APP PASSWORD WORKS WITH NEXTCLOUD!")
else:
    print("❌ App Password didn't work")
print("=" * 60)
