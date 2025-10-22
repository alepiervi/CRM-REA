#!/usr/bin/env python3
"""
Test diretto WebDAV con credenziali Aruba Drive
"""
import asyncio
import aiohttp
from aiohttp import BasicAuth
import logging

logging.basicConfig(level=logging.INFO)

async def test_aruba_webdav():
    """Test connessione e operazioni WebDAV"""
    
    # Credenziali
    username = "crm"
    password = "Casilina25"
    base_url = "https://vkbu5u.arubadrive.com/remote.php/dav/files"
    
    print(f"🔐 Testing WebDAV with user: {username}")
    print(f"🌐 Base URL: {base_url}")
    print()
    
    auth = BasicAuth(username, password)
    timeout = aiohttp.ClientTimeout(total=30)
    
    async with aiohttp.ClientSession(auth=auth, timeout=timeout) as session:
        
        # Test 1: Verifica connessione base
        print("=" * 60)
        print("TEST 1: Verifica connessione root")
        print("=" * 60)
        
        root_url = f"{base_url}/{username}"
        
        try:
            async with session.request("PROPFIND", root_url) as response:
                print(f"Status: {response.status}")
                if response.status == 207:
                    print("✅ Connessione WebDAV OK!")
                    body = await response.text()
                    print(f"Response (first 500 chars):\n{body[:500]}")
                else:
                    print(f"❌ Unexpected status: {response.status}")
                    print(await response.text())
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return
        
        print()
        
        # Test 2: Crea cartella semplice
        print("=" * 60)
        print("TEST 2: Crea cartella 'TestFolder'")
        print("=" * 60)
        
        test_folder_url = f"{base_url}/{username}/TestFolder"
        
        try:
            async with session.request("MKCOL", test_folder_url) as response:
                print(f"Status: {response.status}")
                if response.status in [201, 405]:  # 201=created, 405=exists
                    print("✅ Cartella creata o già esistente")
                else:
                    print(f"❌ Failed: {response.status}")
                    print(await response.text())
        except Exception as e:
            print(f"❌ Failed: {e}")
        
        print()
        
        # Test 3: Crea cartella con spazi
        print("=" * 60)
        print("TEST 3: Crea cartella 'Test Folder With Spaces'")
        print("=" * 60)
        
        import urllib.parse
        folder_name = "Test Folder With Spaces"
        encoded_name = urllib.parse.quote(folder_name, safe='')
        test_folder_url = f"{base_url}/{username}/{encoded_name}"
        
        print(f"Original: {folder_name}")
        print(f"Encoded: {encoded_name}")
        print(f"URL: {test_folder_url}")
        
        try:
            async with session.request("MKCOL", test_folder_url) as response:
                print(f"Status: {response.status}")
                if response.status in [201, 405]:
                    print("✅ Cartella con spazi creata!")
                else:
                    print(f"❌ Failed: {response.status}")
                    print(await response.text())
        except Exception as e:
            print(f"❌ Failed: {e}")
        
        print()
        
        # Test 4: Crea gerarchia
        print("=" * 60)
        print("TEST 4: Crea gerarchia 'Fastweb/TLS'")
        print("=" * 60)
        
        folders = ["Fastweb", "Fastweb/TLS"]
        
        for folder in folders:
            encoded_folder = urllib.parse.quote(folder, safe='')
            folder_url = f"{base_url}/{username}/{encoded_folder}"
            print(f"\nCreating: {folder} → {encoded_folder}")
            
            try:
                async with session.request("MKCOL", folder_url) as response:
                    print(f"  Status: {response.status}", end="")
                    if response.status in [201, 405]:
                        print(" ✅")
                    else:
                        print(f" ❌")
                        body = await response.text()
                        print(f"  Error: {body[:200]}")
            except Exception as e:
                print(f"  ❌ Exception: {e}")
        
        print()
        
        # Test 5: Upload file di test
        print("=" * 60)
        print("TEST 5: Upload file 'test.txt' in Fastweb/TLS")
        print("=" * 60)
        
        file_path = "Fastweb/TLS/test.txt"
        encoded_path = urllib.parse.quote(file_path, safe='')
        file_url = f"{base_url}/{username}/{encoded_path}"
        file_content = b"Test file content from WebDAV test"
        
        print(f"Path: {file_path}")
        print(f"Encoded: {encoded_path}")
        
        try:
            async with session.request("PUT", file_url, data=file_content) as response:
                print(f"Status: {response.status}")
                if response.status in [201, 204]:
                    print("✅ File uploaded successfully!")
                else:
                    print(f"❌ Failed: {response.status}")
                    print(await response.text())
        except Exception as e:
            print(f"❌ Failed: {e}")
        
        print()
        print("=" * 60)
        print("TESTS COMPLETED")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_aruba_webdav())
