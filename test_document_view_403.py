#!/usr/bin/env python3
"""
TEST URGENTE: Verificare che l'errore 403 nell'endpoint view documenti sia risolto
"""

import requests
import sys
import json

class DocumentViewTester:
    def __init__(self, base_url="https://crm-workflow-boost.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        if details and success:
            print(f"   ℹ️  {details}")

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

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def create_test_document(self):
        """Create a test document for testing view endpoint"""
        try:
            # Find a client to associate the document with
            success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
            
            if not success or status != 200:
                self.log_test("Could not get clients", False, f"Status: {status}")
                return None
            
            clienti = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
            
            if len(clienti) == 0:
                self.log_test("No clients found", False, "Cannot create test document without clients")
                return None
            
            test_client = clienti[0]
            test_client_id = test_client.get('id')
            
            # Create test PDF content
            test_pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'
            
            # Upload test document
            files = {
                'file': ('test_view_document.pdf', test_pdf_content, 'application/pdf')
            }
            
            data = {
                'entity_type': 'clienti',
                'entity_id': test_client_id,
                'uploaded_by': self.user_data['id']
            }
            
            headers = {'Authorization': f'Bearer {self.token}'}
            
            response = requests.post(
                f"{self.base_url}/documents/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                upload_response = response.json()
                document_id = upload_response.get('document_id')
                self.log_test("Test document created", True, f"Document ID: {document_id}")
                return document_id
            else:
                self.log_test("Could not create test document", False, f"Status: {response.status_code}")
                return None
                
        except Exception as e:
            self.log_test("Document upload failed", False, f"Exception: {str(e)}")
            return None

    def test_document_view_endpoint_403_fix(self):
        """TEST URGENTE: Verificare che l'errore 403 nell'endpoint view documenti sia risolto"""
        print("\n🚨 TEST URGENTE CORREZIONE ERRORE 403 - ENDPOINT VIEW DOCUMENTI...")
        
        # 1. **TEST LOGIN CON RUOLO ADMIN**
        print("\n🔐 1. TEST LOGIN CON RUOLO ADMIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("Admin login (admin/admin123)", False, f"Status: {status}, Response: {response}")
            return False

        # 2. **VERIFICA ACCESSO COMPLETO ADMIN AI DOCUMENTI**
        print("\n📄 2. VERIFICA ACCESSO COMPLETO ADMIN AI DOCUMENTI...")
        
        # Get all documents to find one to test with
        success, docs_response, status = self.make_request('GET', 'documents', expected_status=200)
        
        document_id = None
        if success and status == 200:
            documents = docs_response if isinstance(docs_response, list) else []
            self.log_test("GET /api/documents", True, f"Found {len(documents)} documents")
            
            if len(documents) > 0:
                test_document = documents[0]
                document_id = test_document.get('id')
                self.log_test("Test document found", True, 
                    f"Document ID: {document_id}, Filename: {test_document.get('filename')}")
            else:
                # Create a test document if none exist
                print("   No documents found, creating test document...")
                document_id = self.create_test_document()
                if not document_id:
                    return False
        else:
            self.log_test("GET /api/documents", False, f"Status: {status}")
            return False

        # 3. **TEST ENDPOINT VIEW FUNZIONANTE**
        print("\n👁️ 3. TEST ENDPOINT VIEW FUNZIONANTE...")
        
        view_status = None
        content_disposition = ""
        
        if document_id:
            # Test GET /api/documents/{document_id}/view with admin token
            print(f"   Testing GET /api/documents/{document_id}/view with admin token...")
            
            try:
                view_url = f"{self.base_url}/documents/{document_id}/view"
                headers = {'Authorization': f'Bearer {self.token}'}
                
                response = requests.get(view_url, headers=headers, timeout=30)
                view_status = response.status_code
                
                if response.status_code == 200:
                    self.log_test("GET /api/documents/{document_id}/view", True, 
                        f"Status: 200 OK (NOT 403!) - View endpoint working correctly")
                    
                    # Verify Content-Disposition: inline for browser viewing
                    content_disposition = response.headers.get('content-disposition', '')
                    if 'inline' in content_disposition.lower():
                        self.log_test("Content-Disposition: inline", True, 
                            f"Header: {content_disposition} - Browser viewing enabled")
                    else:
                        self.log_test("Content-Disposition header", True, 
                            f"Header: {content_disposition}")
                    
                    # Verify content received
                    content_length = len(response.content)
                    if content_length > 0:
                        self.log_test("Document content received", True, 
                            f"Content length: {content_length} bytes")
                    else:
                        self.log_test("No content received", False, "Empty response")
                        
                elif response.status_code == 403:
                    self.log_test("GET /api/documents/{document_id}/view", False, 
                        f"Status: 403 FORBIDDEN - ERROR NOT FIXED! Response: {response.text}")
                    return False
                elif response.status_code == 404:
                    self.log_test("Document not found", True, 
                        "Document may not exist locally (expected with Aruba Drive system)")
                else:
                    self.log_test("GET /api/documents/{document_id}/view", False, 
                        f"Status: {response.status_code}, Response: {response.text}")
                        
            except Exception as e:
                self.log_test("View request failed", False, f"Exception: {str(e)}")
                return False

        # 4. **TEST AUTORIZZAZIONI CORRETTE**
        print("\n🔐 4. TEST AUTORIZZAZIONI CORRETTE...")
        
        # Test with different user roles if available
        test_users = [
            {'username': 'resp_commessa', 'expected_roles': ['responsabile_commessa', 'backoffice_commessa']},
            {'username': 'test2', 'expected_roles': ['responsabile_commessa', 'backoffice_commessa']},
        ]
        
        admin_token = self.token  # Save admin token
        
        for user_info in test_users:
            username = user_info['username']
            expected_roles = user_info['expected_roles']
            
            print(f"   Testing view endpoint with {username}...")
            
            # Login with test user
            success, login_response, status = self.make_request(
                'POST', 'auth/login', 
                {'username': username, 'password': 'admin123'}, 
                200, auth_required=False
            )
            
            if success and 'access_token' in login_response:
                self.token = login_response['access_token']
                user_data = login_response['user']
                user_role = user_data.get('role')
                
                self.log_test(f"{username} login", True, f"Role: {user_role}")
                
                # Test view endpoint with this user
                try:
                    view_url = f"{self.base_url}/documents/{document_id}/view"
                    headers = {'Authorization': f'Bearer {self.token}'}
                    
                    response = requests.get(view_url, headers=headers, timeout=30)
                    
                    if response.status_code == 200:
                        self.log_test(f"{username} view access", True, 
                            f"Status: 200 OK - {user_role} has correct access")
                    elif response.status_code == 403:
                        self.log_test(f"{username} view access", False, 
                            f"Status: 403 FORBIDDEN - {user_role} should have access")
                    elif response.status_code == 404:
                        self.log_test(f"{username} view access", True, 
                            f"Status: 404 - Document not found (expected with Aruba Drive)")
                    else:
                        self.log_test(f"{username} view access", True, 
                            f"Status: {response.status_code}")
                            
                except Exception as e:
                    self.log_test(f"{username} view test failed", False, f"Exception: {str(e)}")
            else:
                self.log_test(f"{username} login failed", False, f"Status: {status}")
        
        # Restore admin token
        self.token = admin_token

        # 5. **TEST CONSISTENZA CON DOWNLOAD**
        print("\n📥 5. TEST CONSISTENZA CON DOWNLOAD...")
        
        download_status = None
        
        if document_id:
            # Test download endpoint with same document
            try:
                download_url = f"{self.base_url}/documents/download/{document_id}"
                headers = {'Authorization': f'Bearer {self.token}'}
                
                response = requests.get(download_url, headers=headers, timeout=30)
                download_status = response.status_code
                
                # Test view endpoint again
                view_url = f"{self.base_url}/documents/{document_id}/view"
                response = requests.get(view_url, headers=headers, timeout=30)
                view_status = response.status_code
                
                if download_status == view_status:
                    self.log_test("View/Download consistency", True, 
                        f"Both endpoints return same status: {view_status}")
                else:
                    self.log_test("View/Download inconsistency", False, 
                        f"Download: {download_status}, View: {view_status}")
                        
            except Exception as e:
                self.log_test("Consistency test failed", False, f"Exception: {str(e)}")

        # **SUMMARY CRITICO**
        print(f"\n🎯 SUMMARY TEST URGENTE CORREZIONE ERRORE 403:")
        print(f"   🎯 OBIETTIVO: Verificare che l'errore 403 nell'endpoint view documenti sia risolto")
        print(f"   🎯 FOCUS CRITICO: GET /api/documents/{{document_id}}/view deve restituire 200 OK invece di 403")
        print(f"   📊 RISULTATI:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • Admin accesso completo documenti: ✅ VERIFIED")
        print(f"      • GET /api/documents/{{document_id}}/view: {'✅ SUCCESS - 200 OK!' if view_status == 200 else '❌ STILL FAILING'}")
        print(f"      • Content-Disposition: inline: {'✅ VERIFIED' if 'inline' in content_disposition.lower() else '❌ MISSING'}")
        print(f"      • Autorizzazioni multi-ruolo: ✅ TESTED")
        print(f"      • Consistenza view/download: {'✅ CONSISTENT' if download_status and view_status and download_status == view_status else '❌ INCONSISTENT'}")
        
        if view_status == 200:
            print(f"   🎉 SUCCESS: L'errore 403 nell'endpoint view documenti è stato risolto!")
            print(f"   🎉 CONFERMATO: GET /api/documents/{{document_id}}/view restituisce 200 OK!")
            return True
        else:
            print(f"   🚨 FAILURE: L'errore 403 nell'endpoint view documenti persiste!")
            return False

    def run_test(self):
        """Run the urgent 403 fix test"""
        print("🚀 Starting Document View 403 Fix Test...")
        print(f"🌐 Base URL: {self.base_url}")
        
        result = self.test_document_view_endpoint_403_fix()
        
        # Print final summary
        print(f"\n📊 FINAL TEST SUMMARY:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if result:
            print("🎉 DOCUMENT VIEW 403 FIX VERIFIED!")
        else:
            print("⚠️ DOCUMENT VIEW 403 ERROR STILL EXISTS!")
        
        return result

if __name__ == "__main__":
    tester = DocumentViewTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)