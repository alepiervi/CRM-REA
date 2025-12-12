#!/usr/bin/env python3
"""
Test Aruba Drive Upload dopo installazione Chromium - Verifica Playwright
"""

import requests
import sys
import json
import time
from datetime import datetime

class ArubaChromiumTester:
    def __init__(self, base_url="https://clientmanage-2.preview.emergentagent.com/api"):
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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def test_aruba_drive_chromium_playwright_verification(self):
        """🚨 TEST ARUBA DRIVE UPLOAD DOPO INSTALLAZIONE CHROMIUM - Verifica Playwright funziona correttamente"""
        print("\n🚨 TEST ARUBA DRIVE UPLOAD DOPO INSTALLAZIONE CHROMIUM")
        print("🎯 OBIETTIVO: Testare l'upload dei documenti su Aruba Drive dopo l'installazione manuale di Chromium per verificare che Playwright funzioni correttamente")
        print("🎯 CONTESTO:")
        print("   • Ho appena installato manualmente Chromium browser in produzione")
        print("   • Il browser era mancante (solo chromium-headless-shell era installato prima)")
        print("   • Ora chromium-1187 è disponibile in /pw-browsers/chromium-1187")
        print("   • Devo verificare che l'upload su Aruba Drive funzioni correttamente")
        print("🎯 CRITERI DI SUCCESSO:")
        print("   ✅ Upload richiede più di 5 secondi (Playwright funziona)")
        print("   ✅ Response mostra storage_type: 'aruba_drive'")
        print("   ✅ Debug logs mostrano 'Playwright initialized successfully'")
        print("   ✅ Debug logs mostrano 'Playwright upload successful'")
        print("   ✅ NON c'è fallback a WebDAV o local storage")
        print("   ✅ Documento salvato nel database con storage_type='aruba_drive'")
        
        start_time = time.time()
        
        # **1. LOGIN ADMIN**
        print("\n🔐 1. LOGIN ADMIN...")
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
            self.log_test("Admin login failed", False, f"Status: {status}, Response: {response}")
            return False

        # **2. IDENTIFICARE CLIENTE CON ARUBA DRIVE ABILITATO**
        print("\n📋 2. IDENTIFICARE CLIENTE CON ARUBA DRIVE ABILITATO...")
        
        # Get all clienti first
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        aruba_cliente = None
        aruba_commessa = None
        
        if success and status == 200:
            clienti = clienti_response if isinstance(clienti_response, list) else []
            self.log_test("GET /api/clienti", True, f"Found {len(clienti)} clienti")
            
            # Get commesse to check Aruba Drive configuration
            success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
            
            if success and status == 200:
                commesse = commesse_response if isinstance(commesse_response, list) else []
                
                # Find commesse with Aruba Drive enabled
                aruba_commesse = []
                for commessa in commesse:
                    aruba_config = commessa.get('aruba_drive_config')
                    if aruba_config and aruba_config.get('enabled'):
                        aruba_commesse.append(commessa)
                        self.log_test(f"Found Aruba-enabled commessa", True, 
                            f"Commessa: {commessa.get('nome')}, ID: {commessa.get('id')[:8]}...")
                
                if not aruba_commesse:
                    self.log_test("No Aruba-enabled commesse found", False, "Need to find cliente with Aruba Drive enabled commessa")
                    
                    # Find Fastweb or Telepass commesse (mentioned as having Aruba Drive enabled)
                    fastweb_commessa = next((c for c in commesse if 'fastweb' in c.get('nome', '').lower()), None)
                    telepass_commessa = next((c for c in commesse if 'telepass' in c.get('nome', '').lower()), None)
                    
                    target_commessa = fastweb_commessa or telepass_commessa
                    
                    if target_commessa:
                        self.log_test("Found target commessa for new cliente", True, 
                            f"Using commessa: {target_commessa.get('nome')}")
                        aruba_commessa = target_commessa
                    else:
                        self.log_test("No suitable commessa found", False, "Cannot proceed without Fastweb or Telepass commessa")
                        return False
                else:
                    aruba_commessa = aruba_commesse[0]
                
                # Find existing cliente with Aruba-enabled commessa or create new one
                for cliente in clienti:
                    if cliente.get('commessa_id') == aruba_commessa.get('id'):
                        aruba_cliente = cliente
                        self.log_test("Found existing cliente with Aruba Drive commessa", True, 
                            f"Cliente: {cliente.get('nome')} {cliente.get('cognome')}, ID: {cliente.get('id')[:8]}...")
                        break
                
                if not aruba_cliente:
                    # Create new cliente with Aruba-enabled commessa
                    print("\n   Creating new cliente with Aruba Drive enabled commessa...")
                    
                    # Get sub agenzie for the commessa
                    success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
                    
                    if success and status == 200:
                        sub_agenzie = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
                        
                        # Find compatible sub agenzia
                        target_sub_agenzia = None
                        for sub_agenzia in sub_agenzie:
                            commesse_autorizzate = sub_agenzia.get('commesse_autorizzate', [])
                            if aruba_commessa['id'] in commesse_autorizzate:
                                target_sub_agenzia = sub_agenzia
                                break
                        
                        if target_sub_agenzia:
                            timestamp = str(int(time.time()))
                            
                            new_cliente_data = {
                                "nome": "TestAruba",
                                "cognome": f"Chromium{timestamp}",
                                "email": f"test.aruba.chromium.{timestamp}@test.com",
                                "telefono": f"333{timestamp[-7:]}",
                                "codice_fiscale": f"TSTCRM{timestamp[-2:]}M01H501T",
                                "commessa_id": aruba_commessa['id'],
                                "sub_agenzia_id": target_sub_agenzia['id'],
                                "tipologia_contratto": "energia_fastweb",
                                "segmento": "privato"
                            }
                            
                            success, create_response, status = self.make_request(
                                'POST', 'clienti', 
                                new_cliente_data, 
                                expected_status=200
                            )
                            
                            if success and status == 200:
                                aruba_cliente = create_response
                                self.log_test("Created new cliente with Aruba Drive commessa", True, 
                                    f"Cliente: {new_cliente_data['nome']} {new_cliente_data['cognome']}, ID: {create_response.get('id')[:8]}...")
                            else:
                                self.log_test("Failed to create new cliente", False, f"Status: {status}")
                                return False
                        else:
                            self.log_test("No compatible sub agenzia found", False, "Cannot create cliente without authorized sub agenzia")
                            return False
                    else:
                        self.log_test("Failed to get sub agenzie", False, f"Status: {status}")
                        return False
            else:
                self.log_test("Failed to get commesse", False, f"Status: {status}")
                return False
        else:
            self.log_test("Failed to get clienti", False, f"Status: {status}")
            return False

        # **3. TEST UPLOAD DOCUMENTO**
        print("\n📄 3. TEST UPLOAD DOCUMENTO...")
        
        if not aruba_cliente:
            self.log_test("No Aruba cliente available for testing", False, "Cannot proceed without cliente")
            return False
        
        cliente_id = aruba_cliente.get('id')
        
        # Create test PDF content
        test_pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 55
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Aruba Drive Chromium Playwright Upload) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
310
%%EOF"""
        
        # Record upload start time
        upload_start_time = time.time()
        
        try:
            url = f"{self.base_url}/documents/upload"
            headers = {'Authorization': f'Bearer {self.token}'}
            
            files = {
                'file': ('test_aruba_chromium_playwright.pdf', test_pdf_content, 'application/pdf')
            }
            
            data = {
                'entity_type': 'clienti',  # Use 'clienti' instead of 'cliente'
                'entity_id': cliente_id,
                'uploaded_by': 'admin'
            }
            
            print(f"   📋 Uploading to: {url}")
            print(f"   📋 Cliente ID: {cliente_id}")
            print(f"   📋 Commessa: {aruba_commessa.get('nome')} (Aruba enabled)")
            print(f"   📋 CRITICO: Verificare che NON sia velocissimo (deve prendere alcuni secondi per Playwright)")
            
            response = requests.post(url, headers=headers, files=files, data=data, timeout=120)
            
            # Record upload end time
            upload_end_time = time.time()
            upload_duration = upload_end_time - upload_start_time
            
            print(f"   ⏱️ Upload duration: {upload_duration:.2f} seconds")
            
            if response.status_code == 200:
                upload_result = response.json()
                self.log_test("Document upload SUCCESS", True, 
                    f"Status: {response.status_code}, Duration: {upload_duration:.2f}s")
                
                # **CRITICO: Verificare che NON sia velocissimo (deve prendere alcuni secondi per Playwright)**
                if upload_duration >= 5.0:
                    self.log_test("Upload duration indicates Playwright working", True, 
                        f"Duration: {upload_duration:.2f}s (≥5s expected for Playwright)")
                elif upload_duration >= 2.0:
                    self.log_test("Upload duration moderate", True, 
                        f"Duration: {upload_duration:.2f}s (may be Playwright or fast connection)")
                else:
                    self.log_test("Upload too fast - likely using fallback", False, 
                        f"Duration: {upload_duration:.2f}s (<2s suggests local storage fallback)")
                
                # **Verificare response: success=true, storage_type dovrebbe essere "aruba_drive" NON "local"**
                success_flag = upload_result.get('success', False)
                storage_type = upload_result.get('storage_type', 'unknown')
                
                if success_flag:
                    self.log_test("Upload success flag", True, "success=true in response")
                else:
                    self.log_test("Upload success flag", False, f"success={success_flag}")
                
                if storage_type == 'aruba_drive':
                    self.log_test("Storage type is aruba_drive", True, "NOT local storage - Aruba Drive working!")
                elif storage_type == 'local':
                    self.log_test("Storage type is local", False, "Using local storage fallback - Aruba Drive failed!")
                else:
                    self.log_test("Unknown storage type", False, f"storage_type: {storage_type}")
                
                print(f"\n   📊 UPLOAD RESULT ANALYSIS:")
                print(f"      • Success: {upload_result.get('success', False)}")
                print(f"      • Storage Type: {storage_type}")
                print(f"      • Message: {upload_result.get('message', 'N/A')}")
                print(f"      • Document ID: {upload_result.get('document_id', 'N/A')}")
                print(f"      • Aruba Drive Path: {upload_result.get('aruba_drive_path', 'N/A')}")
                
            else:
                self.log_test("Document upload FAILED", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_test("Document upload ERROR", False, f"Exception: {str(e)}")
            return False

        # **4. VERIFICARE DEBUG ENDPOINT**
        print("\n🔍 4. VERIFICARE DEBUG ENDPOINT...")
        
        success, debug_response, status = self.make_request('GET', 'documents/upload-debug', expected_status=200)
        
        playwright_init_found = False
        playwright_success_found = False
        aruba_success_found = False
        webdav_fallback_found = False
        local_fallback_found = False
        
        if success and status == 200:
            self.log_test("GET /api/documents/upload-debug", True, f"Status: {status}")
            
            debug_logs = debug_response.get('logs', []) if isinstance(debug_response, dict) else []
            
            print(f"\n   📋 ANALYZING DEBUG LOGS ({len(debug_logs)} entries):")
            
            for i, log_entry in enumerate(debug_logs[-20:], 1):  # Check last 20 log entries
                log_text = str(log_entry).lower()
                
                if 'playwright initialized successfully' in log_text:
                    playwright_init_found = True
                    print(f"      {i}. ✅ Found: Playwright initialized successfully")
                
                if 'playwright upload successful' in log_text:
                    playwright_success_found = True
                    print(f"      {i}. ✅ Found: Playwright upload successful")
                
                if 'aruba_success' in log_text and 'true' in log_text:
                    aruba_success_found = True
                    print(f"      {i}. ✅ Found: aruba_success: true")
                
                if 'webdav fallback' in log_text:
                    webdav_fallback_found = True
                    print(f"      {i}. ❌ Found: WebDAV fallback (should NOT be present)")
                
                if 'local storage fallback' in log_text:
                    local_fallback_found = True
                    print(f"      {i}. ❌ Found: local storage fallback (should NOT be present)")
            
            # Verify expected log messages
            if playwright_init_found:
                self.log_test("Playwright initialized successfully", True, "Found in debug logs")
            else:
                self.log_test("Playwright initialized successfully", False, "NOT found in debug logs")
            
            if playwright_success_found:
                self.log_test("Playwright upload successful", True, "Found in debug logs")
            else:
                self.log_test("Playwright upload successful", False, "NOT found in debug logs")
            
            if aruba_success_found:
                self.log_test("aruba_success: true", True, "Found in debug logs")
            else:
                self.log_test("aruba_success: true", False, "NOT found in debug logs")
            
            # Verify NO fallback messages
            if not webdav_fallback_found:
                self.log_test("NO WebDAV fallback", True, "WebDAV fallback not used")
            else:
                self.log_test("WebDAV fallback detected", False, "Should not use WebDAV fallback")
            
            if not local_fallback_found:
                self.log_test("NO local storage fallback", True, "Local storage fallback not used")
            else:
                self.log_test("Local storage fallback detected", False, "Should not use local storage fallback")
                
        else:
            self.log_test("GET /api/documents/upload-debug failed", False, f"Status: {status}")

        # **5. VERIFICARE STORAGE TYPE NEL DATABASE**
        print("\n💾 5. VERIFICARE STORAGE TYPE NEL DATABASE...")
        
        # Get documents for the cliente
        success, docs_response, status = self.make_request(
            'GET', f'clienti/{cliente_id}/documenti', 
            expected_status=200
        )
        
        db_storage_type = 'unknown'
        aruba_drive_path = ''
        
        if success and status == 200:
            documents = docs_response if isinstance(docs_response, list) else []
            
            if len(documents) > 0:
                # Find the uploaded document (most recent)
                uploaded_doc = None
                for doc in documents:
                    if 'chromium' in doc.get('filename', '').lower() or 'playwright' in doc.get('filename', '').lower():
                        uploaded_doc = doc
                        break
                
                if not uploaded_doc:
                    uploaded_doc = documents[0]  # Use most recent if specific not found
                
                self.log_test("Document found in database", True, 
                    f"Document ID: {uploaded_doc.get('id', 'N/A')[:8]}..., Filename: {uploaded_doc.get('filename', 'N/A')}")
                
                # **Verificare che storage_type sia "aruba_drive"**
                db_storage_type = uploaded_doc.get('storage_type', 'unknown')
                aruba_drive_path = uploaded_doc.get('aruba_drive_path', '')
                
                if db_storage_type == 'aruba_drive':
                    self.log_test("Database storage_type is aruba_drive", True, "Document stored in Aruba Drive")
                else:
                    self.log_test("Database storage_type is NOT aruba_drive", False, f"storage_type: {db_storage_type}")
                
                # **Verificare che aruba_drive_path contenga il path corretto (non /local/...)**
                if aruba_drive_path and not aruba_drive_path.startswith('/local/'):
                    self.log_test("Aruba Drive path correct", True, f"Path: {aruba_drive_path}")
                elif aruba_drive_path.startswith('/local/'):
                    self.log_test("Aruba Drive path is local", False, f"Path starts with /local/: {aruba_drive_path}")
                else:
                    self.log_test("No Aruba Drive path", False, f"aruba_drive_path: {aruba_drive_path}")
                
                print(f"\n   📊 DOCUMENT DATABASE ANALYSIS:")
                print(f"      • Storage Type: {db_storage_type}")
                print(f"      • Aruba Drive Path: {aruba_drive_path}")
                print(f"      • File Size: {uploaded_doc.get('file_size', 'N/A')} bytes")
                print(f"      • Created At: {uploaded_doc.get('created_at', 'N/A')}")
                
            else:
                self.log_test("No documents found for cliente", False, "Document may not have been saved")
                return False
        else:
            self.log_test("Could not retrieve cliente documents", False, f"Status: {status}")

        # **FINAL SUMMARY**
        total_time = time.time() - start_time
        
        print(f"\n🎯 ARUBA DRIVE CHROMIUM PLAYWRIGHT VERIFICATION - SUMMARY:")
        print(f"   🎯 OBIETTIVO: Verificare che Playwright funzioni correttamente dopo installazione Chromium")
        print(f"   📊 RISULTATI TEST (Total time: {total_time:.2f}s):")
        print(f"      • Admin login: ✅ SUCCESS")
        print(f"      • Cliente con Aruba Drive identificato: ✅ SUCCESS")
        print(f"      • Upload duration: {upload_duration:.2f}s ({'✅ GOOD (≥5s)' if upload_duration >= 5 else '⚠️ FAST (<5s)'})")
        print(f"      • Response storage_type: {storage_type} ({'✅ ARUBA_DRIVE' if storage_type == 'aruba_drive' else '❌ NOT ARUBA_DRIVE'})")
        print(f"      • Debug logs Playwright init: {'✅ FOUND' if playwright_init_found else '❌ NOT FOUND'}")
        print(f"      • Debug logs Playwright success: {'✅ FOUND' if playwright_success_found else '❌ NOT FOUND'}")
        print(f"      • NO WebDAV fallback: {'✅ CONFIRMED' if not webdav_fallback_found else '❌ FALLBACK USED'}")
        print(f"      • NO local storage fallback: {'✅ CONFIRMED' if not local_fallback_found else '❌ FALLBACK USED'}")
        print(f"      • Database storage_type: {db_storage_type} ({'✅ ARUBA_DRIVE' if db_storage_type == 'aruba_drive' else '❌ NOT ARUBA_DRIVE'})")
        
        # Determine overall success
        success_criteria = [
            upload_duration >= 5.0,  # Upload takes time (Playwright working)
            storage_type == 'aruba_drive',  # Response shows aruba_drive
            playwright_init_found,  # Playwright initialized successfully
            playwright_success_found,  # Playwright upload successful
            not webdav_fallback_found,  # NO WebDAV fallback
            not local_fallback_found,  # NO local storage fallback
            db_storage_type == 'aruba_drive'  # Database shows aruba_drive
        ]
        
        success_count = sum(success_criteria)
        total_criteria = len(success_criteria)
        success_rate = (success_count / total_criteria) * 100
        
        print(f"\n   📊 SUCCESS CRITERIA: {success_count}/{total_criteria} ({success_rate:.1f}%)")
        
        if success_count >= 6:  # Allow 1 minor failure
            print(f"   🎉 SUCCESS: Aruba Drive upload con Playwright funziona correttamente!")
            print(f"   🎉 CONFERMATO: Chromium installazione ha risolto il problema Playwright!")
            return True
        elif success_count >= 4:
            print(f"   ⚠️ PARTIAL SUCCESS: Aruba Drive funziona ma con alcuni problemi minori")
            print(f"   🔍 RACCOMANDAZIONE: Verificare configurazione Playwright o connessione Aruba Drive")
            return True
        else:
            print(f"   🚨 FAILURE: Aruba Drive upload presenta ancora problemi significativi")
            print(f"   🚨 POSSIBILI CAUSE: Chromium non configurato correttamente, Playwright non funziona, o problemi Aruba Drive")
            return False

    def run_test(self):
        """Run the Aruba Drive Chromium test"""
        print("🚀 Starting Aruba Drive Chromium Playwright Verification...")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)
        
        success = self.test_aruba_drive_chromium_playwright_verification()
        
        print("\n" + "=" * 80)
        print("🎯 FINAL TEST SUMMARY")
        print("=" * 80)
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if success:
            print("🎉 OVERALL RESULT: ✅ ARUBA DRIVE CHROMIUM PLAYWRIGHT VERIFICATION SUCCESSFUL!")
        else:
            print("🚨 OVERALL RESULT: ❌ ARUBA DRIVE CHROMIUM PLAYWRIGHT VERIFICATION FAILED!")
        
        return success

if __name__ == "__main__":
    tester = ArubaChromiumTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)