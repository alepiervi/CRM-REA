#!/usr/bin/env python3
"""
🔍 ARUBA DRIVE LOGIN TEST - Test specifico per verificare il processo di login
"""

import requests
import sys
import json
from datetime import datetime

class ArubaLoginTester:
    def __init__(self, base_url="https://role-manager-19.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def test_aruba_login_process(self):
        """Test the Aruba Drive login process step by step"""
        print("🔍 TESTING ARUBA DRIVE LOGIN PROCESS...")
        
        # 1. Login as admin
        print("\n🔐 1. ADMIN LOGIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if not success:
            print(f"❌ Admin login failed: {status}")
            return False
            
        self.token = response['access_token']
        self.user_data = response['user']
        print(f"✅ Admin login successful")

        # 2. Get Fastweb configuration
        print("\n⚙️ 2. GET FASTWEB ARUBA CONFIGURATION...")
        fastweb_id = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
        
        success, config_response, status = self.make_request('GET', f'commesse/{fastweb_id}/aruba-config')
        
        if not success:
            print(f"❌ Failed to get configuration: {status}")
            return False
            
        config = config_response.get('config', {})
        print(f"✅ Configuration retrieved:")
        print(f"   URL: {config.get('url')}")
        print(f"   Username: {config.get('username')}")
        print(f"   Enabled: {config.get('enabled')}")

        # 3. Test URL accessibility manually
        print("\n🌐 3. TEST URL ACCESSIBILITY...")
        url = config.get('url')
        
        try:
            response = requests.get(url, timeout=10, allow_redirects=True)
            print(f"✅ URL is accessible: {response.status_code}")
            print(f"   Content-Type: {response.headers.get('content-type', 'Unknown')}")
            print(f"   Response size: {len(response.content)} bytes")
            
            # Check if it's a login page
            if 'login' in response.text.lower() or 'password' in response.text.lower():
                print(f"✅ Appears to be a login page")
            else:
                print(f"⚠️ May not be a login page")
                
        except Exception as e:
            print(f"❌ URL not accessible: {e}")
            return False

        # 4. Test with a simple document upload to trigger the login process
        print("\n📤 4. TEST DOCUMENT UPLOAD TO TRIGGER LOGIN...")
        
        # Find a Fastweb client
        success, clienti_response, status = self.make_request('GET', 'clienti')
        if not success:
            print(f"❌ Failed to get clients: {status}")
            return False
            
        clienti = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
        fastweb_client = None
        
        for client in clienti:
            if client.get('commessa_id') == fastweb_id:
                fastweb_client = client
                break
                
        if not fastweb_client:
            print(f"❌ No Fastweb client found")
            return False
            
        print(f"✅ Found Fastweb client: {fastweb_client.get('nome')} {fastweb_client.get('cognome')}")

        # Create a test document upload
        test_pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'
        
        files = {
            'file': ('aruba_login_test.pdf', test_pdf_content, 'application/pdf')
        }
        
        data = {
            'entity_type': 'clienti',
            'entity_id': fastweb_client.get('id'),
            'uploaded_by': self.user_data['id']
        }
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        print("   🔍 Starting upload to trigger Aruba Drive login process...")
        print("   ⏱️ This may take up to 60 seconds...")
        
        try:
            response = requests.post(
                f"{self.base_url}/documents/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=90  # Increased timeout
            )
            
            print(f"✅ Upload completed with status: {response.status_code}")
            
            if response.status_code == 200:
                upload_response = response.json()
                message = upload_response.get('message', '')
                storage_type = upload_response.get('storage_type', 'unknown')
                
                print(f"   Message: {message}")
                print(f"   Storage type: {storage_type}")
                
                if 'local' in storage_type.lower() or 'fallback' in message.lower():
                    print(f"⚠️ SYSTEM USED LOCAL FALLBACK - Aruba Drive login likely failed")
                    return False
                elif 'aruba' in storage_type.lower():
                    print(f"✅ SYSTEM USED ARUBA DRIVE - Login successful!")
                    return True
                else:
                    print(f"❓ UNCLEAR STORAGE TYPE - Need to check logs")
                    return False
            else:
                print(f"❌ Upload failed: {response.status_code}")
                return False
                
        except requests.exceptions.Timeout:
            print(f"❌ Upload timed out - likely Aruba Drive login is hanging")
            return False
        except Exception as e:
            print(f"❌ Upload failed with exception: {e}")
            return False

    def run_test(self):
        """Run the Aruba login test"""
        print("🔍 ARUBA DRIVE LOGIN PROCESS TEST")
        print("="*50)
        print("🎯 OBIETTIVO: Verificare il processo di login ad Aruba Drive")
        print("🔍 FOCUS: Identificare dove fallisce il login")
        print("="*50)
        
        result = self.test_aruba_login_process()
        
        print(f"\n📊 TEST RESULT:")
        if result:
            print("✅ Aruba Drive login process is working correctly")
        else:
            print("❌ Aruba Drive login process has issues")
            print("\n🔍 POSSIBLE CAUSES:")
            print("   1. Invalid credentials (username/password)")
            print("   2. Aruba Drive login page structure changed")
            print("   3. Network connectivity issues")
            print("   4. Playwright browser automation issues")
            print("   5. Login timeout too aggressive")
        
        return result

if __name__ == "__main__":
    tester = ArubaLoginTester()
    tester.run_test()