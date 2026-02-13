#!/usr/bin/env python3
"""
🚨 DIAGNOSI URGENTE ARUBA DRIVE - Verifica configurazione commessa Fastweb
Identifica perché il sistema non sta caricando su Aruba Drive reale
"""

import requests
import sys
import json
from datetime import datetime

class ArubaDriveDiagnosisTester:
    def __init__(self, base_url="https://referente-oversight.preview.emergentagent.com/api"):
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

    def test_aruba_drive_configuration_diagnosis_urgent(self):
        """🚨 DIAGNOSI URGENTE ARUBA DRIVE - Verifica configurazione commessa Fastweb e identifica perché non carica su Aruba Drive reale"""
        print("\n🚨 DIAGNOSI URGENTE ARUBA DRIVE - CONFIGURAZIONE COMMESSA FASTWEB...")
        
        # 1. **Test Login Admin**
        print("\n🔐 1. TEST LOGIN ADMIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("✅ Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("❌ Admin login (admin/admin123)", False, f"Status: {status}, Response: {response}")
            return False

        # 2. **VERIFICA CONFIGURAZIONE COMMESSA FASTWEB**
        print("\n⚙️ 2. VERIFICA CONFIGURAZIONE COMMESSA FASTWEB...")
        
        fastweb_id = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
        
        # GET /api/commesse/{fastweb_id}/aruba-config
        success, config_response, status = self.make_request('GET', f'commesse/{fastweb_id}/aruba-config', expected_status=200)
        
        if success and status == 200:
            self.log_test("✅ GET /api/commesse/{fastweb_id}/aruba-config", True, f"Status: {status}")
            
            # Analyze configuration
            config = config_response.get('config', {}) if isinstance(config_response, dict) else {}
            
            if config:
                url = config.get('url', 'NOT_SET')
                username = config.get('username', 'NOT_SET')
                password_masked = '***' if config.get('password') else 'NOT_SET'
                enabled = config.get('enabled', False)
                
                self.log_test("✅ Aruba Drive configuration found", True, 
                    f"URL: {url}, Username: {username}, Password: {password_masked}, Enabled: {enabled}")
                
                # Check if URL is test URL or real Aruba Drive URL
                is_test_url = any(pattern in url.lower() for pattern in ['test', 'localhost', '.test.', 'simulation', 'mock', 'demo'])
                
                if is_test_url:
                    self.log_test("⚠️ TEST URL DETECTED", True, 
                        f"URL '{url}' appears to be a test URL - this will trigger simulation mode")
                else:
                    self.log_test("✅ REAL ARUBA DRIVE URL", True, 
                        f"URL '{url}' appears to be a real Aruba Drive URL")
                
                # Store configuration for later tests
                aruba_config = config
                
            else:
                self.log_test("❌ No Aruba Drive configuration found", False, "Configuration is empty or missing")
                aruba_config = None
        else:
            self.log_test("❌ GET /api/commesse/{fastweb_id}/aruba-config", False, f"Status: {status}, Response: {config_response}")
            aruba_config = None

        # 3. **TEST CONNESSIONE ARUBA DRIVE REALE**
        print("\n🌐 3. TEST CONNESSIONE ARUBA DRIVE REALE...")
        
        url_reachable = False
        simulation_expected = True
        
        if aruba_config and aruba_config.get('enabled'):
            url = aruba_config.get('url')
            
            # Test URL reachability
            print(f"   Testing URL reachability: {url}")
            
            try:
                # Test basic connectivity (without authentication)
                response = requests.get(url, timeout=10, allow_redirects=True)
                
                if response.status_code in [200, 401, 403]:  # 401/403 means server is reachable but needs auth
                    self.log_test("✅ Aruba Drive URL reachable", True, 
                        f"URL {url} is reachable (Status: {response.status_code})")
                    url_reachable = True
                else:
                    self.log_test("⚠️ Aruba Drive URL response", True, 
                        f"URL {url} returned status {response.status_code}")
                    url_reachable = True  # Still consider reachable
                    
            except requests.exceptions.ConnectTimeout:
                self.log_test("❌ Aruba Drive URL timeout", False, 
                    f"URL {url} is not reachable (Connection timeout)")
                url_reachable = False
            except requests.exceptions.ConnectionError:
                self.log_test("❌ Aruba Drive URL unreachable", False, 
                    f"URL {url} is not reachable (Connection error)")
                url_reachable = False
            except Exception as e:
                self.log_test("❌ Aruba Drive URL test failed", False, 
                    f"URL {url} test failed: {str(e)}")
                url_reachable = False
            
            # Check if system would activate simulation mode
            is_test_url = any(pattern in url.lower() for pattern in ['test', 'localhost', '.test.', 'simulation', 'mock', 'demo'])
            
            if is_test_url:
                self.log_test("⚠️ SIMULATION MODE WOULD ACTIVATE", True, 
                    f"URL pattern indicates system will activate simulation mode")
                simulation_expected = True
            elif not url_reachable:
                self.log_test("⚠️ SIMULATION MODE WOULD ACTIVATE", True, 
                    f"URL unreachable - system will activate simulation mode")
                simulation_expected = True
            else:
                self.log_test("✅ REAL ARUBA DRIVE MODE EXPECTED", True, 
                    f"URL is reachable and not test pattern - real Aruba Drive should be used")
                simulation_expected = False
                
        else:
            self.log_test("❌ Cannot test connection", False, "No valid Aruba Drive configuration")

        # 4. **TEST UPLOAD DOCUMENTO PER VERIFICARE COMPORTAMENTO**
        print("\n📤 4. TEST UPLOAD DOCUMENTO PER VERIFICARE COMPORTAMENTO...")
        
        used_aruba_drive = False
        uploaded_document_id = None
        
        # Find or create a test client for Fastweb
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and status == 200:
            clienti = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
            
            # Find client with Fastweb commessa
            fastweb_client = None
            for client in clienti:
                if client.get('commessa_id') == fastweb_id:
                    fastweb_client = client
                    break
            
            if fastweb_client:
                self.log_test("✅ Fastweb client found", True, 
                    f"Client: {fastweb_client.get('nome')} {fastweb_client.get('cognome')} (ID: {fastweb_client.get('id')})")
                
                # Test document upload
                test_pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'
                
                files = {
                    'file': ('test_aruba_diagnosis.pdf', test_pdf_content, 'application/pdf')
                }
                
                data = {
                    'entity_type': 'clienti',
                    'entity_id': fastweb_client.get('id'),
                    'uploaded_by': self.user_data['id']
                }
                
                headers = {'Authorization': f'Bearer {self.token}'}
                
                try:
                    print("   🔍 Monitoring upload behavior for Aruba Drive vs Local fallback...")
                    
                    response = requests.post(
                        f"{self.base_url}/documents/upload",
                        files=files,
                        data=data,
                        headers=headers,
                        timeout=60
                    )
                    
                    upload_success = response.status_code == 200
                    upload_response = response.json() if response.content else {}
                    
                    if upload_success:
                        self.log_test("✅ POST /api/documents/upload", True, 
                            f"Status: {response.status_code}, Upload completed")
                        
                        # Analyze upload response for Aruba Drive vs Local storage
                        aruba_drive_path = upload_response.get('aruba_drive_path', '')
                        storage_type = upload_response.get('storage_type', 'unknown')
                        message = upload_response.get('message', '')
                        
                        if 'local' in storage_type.lower() or 'fallback' in message.lower():
                            self.log_test("⚠️ LOCAL STORAGE FALLBACK USED", True, 
                                f"System used local storage instead of Aruba Drive - Message: {message}")
                            used_aruba_drive = False
                        elif 'aruba' in storage_type.lower() or 'aruba' in message.lower():
                            self.log_test("✅ ARUBA DRIVE USED", True, 
                                f"System successfully used Aruba Drive - Message: {message}")
                            used_aruba_drive = True
                        else:
                            self.log_test("❓ STORAGE TYPE UNCLEAR", True, 
                                f"Storage type unclear - Message: {message}, Storage: {storage_type}")
                            used_aruba_drive = False
                        
                        # Store document ID for cleanup
                        uploaded_document_id = upload_response.get('document_id')
                        
                    else:
                        self.log_test("❌ POST /api/documents/upload", False, 
                            f"Status: {response.status_code}, Response: {upload_response}")
                        
                except Exception as e:
                    self.log_test("❌ Upload test failed", False, f"Exception: {str(e)}")
                    
            else:
                self.log_test("❌ No Fastweb client found", False, "Cannot test upload without Fastweb client")
        else:
            self.log_test("❌ Cannot get clients", False, f"Status: {status}")

        # 5. **BACKEND LOGS ANALYSIS**
        print("\n📋 5. BACKEND LOGS ANALYSIS...")
        
        # Since we can't directly access logs, we analyze the behavior
        print("   🔍 Analyzing system behavior for log patterns...")
        
        if aruba_config:
            url = aruba_config.get('url', '')
            
            # Check for aggressive test URL detection
            test_patterns = ['test', 'localhost', '.test.', 'simulation', 'mock', 'demo']
            detected_patterns = [pattern for pattern in test_patterns if pattern in url.lower()]
            
            if detected_patterns:
                self.log_test("⚠️ TEST URL PATTERNS DETECTED", True, 
                    f"URL '{url}' contains test patterns: {detected_patterns}")
                self.log_test("⚠️ EXPECTED LOG: 'Test URL detected'", True, 
                    f"Backend logs should show 'Test URL detected' for URL: {url}")
            else:
                self.log_test("✅ NO TEST URL PATTERNS", True, 
                    f"URL '{url}' does not contain obvious test patterns")
                
                if not used_aruba_drive:
                    self.log_test("🚨 POTENTIAL ISSUE", False, 
                        f"Real URL but system used fallback - check for other detection logic")

        # 6. **CREDENZIALI ARUBA DRIVE**
        print("\n🔑 6. CREDENZIALI ARUBA DRIVE...")
        
        if aruba_config:
            # Show configuration without password
            config_summary = {
                'enabled': aruba_config.get('enabled', False),
                'url': aruba_config.get('url', 'NOT_SET'),
                'username': aruba_config.get('username', 'NOT_SET'),
                'password': '***' if aruba_config.get('password') else 'NOT_SET',
                'root_folder_path': aruba_config.get('root_folder_path', 'NOT_SET'),
                'auto_create_structure': aruba_config.get('auto_create_structure', False)
            }
            
            self.log_test("✅ Aruba Drive configuration summary", True, 
                f"Config: {config_summary}")
            
            # Verify URL format for real Aruba Drive
            url = aruba_config.get('url', '')
            if 'arubacloud.com' in url.lower() or 'aruba' in url.lower():
                self.log_test("✅ URL format appears correct for Aruba Drive", True, 
                    f"URL contains Aruba-related domain")
            else:
                self.log_test("⚠️ URL format may not be Aruba Drive", True, 
                    f"URL '{url}' does not contain obvious Aruba patterns")
        else:
            self.log_test("❌ No configuration to analyze", False, "Cannot show credentials without configuration")

        # 7. **CLEANUP**
        print("\n🧹 7. CLEANUP...")
        
        if uploaded_document_id:
            success, delete_response, status = self.make_request('DELETE', f'documents/{uploaded_document_id}', expected_status=200)
            if success:
                self.log_test("✅ Test document cleanup", True, f"Document {uploaded_document_id} deleted")

        # **DIAGNOSI FINALE**
        print(f"\n🎯 DIAGNOSI FINALE ARUBA DRIVE:")
        print(f"   🎯 OBIETTIVO: Identificare perché sistema va in fallback locale invece di Aruba Drive")
        print(f"   📊 RISULTATI DIAGNOSI:")
        
        if aruba_config:
            url = aruba_config.get('url', 'NOT_SET')
            enabled = aruba_config.get('enabled', False)
            
            print(f"      • Configurazione Fastweb: ✅ TROVATA")
            print(f"      • URL configurato: {url}")
            print(f"      • Configurazione abilitata: {enabled}")
            print(f"      • URL raggiungibile: {'✅ SÌ' if url_reachable else '❌ NO'}")
            print(f"      • Simulation mode atteso: {'⚠️ SÌ' if simulation_expected else '✅ NO'}")
            print(f"      • Sistema ha usato Aruba Drive: {'✅ SÌ' if used_aruba_drive else '❌ NO - FALLBACK LOCALE'}")
            
            # Root cause analysis
            if not used_aruba_drive:
                print(f"\n   🚨 ROOT CAUSE ANALYSIS:")
                if simulation_expected:
                    if any(pattern in url.lower() for pattern in ['test', 'localhost', '.test.', 'simulation', 'mock', 'demo']):
                        print(f"      🔍 CAUSA: URL contiene pattern di test - sistema attiva simulation mode")
                        print(f"      🔧 SOLUZIONE: Usare URL Aruba Drive reale senza pattern di test")
                    elif not url_reachable:
                        print(f"      🔍 CAUSA: URL non raggiungibile - sistema attiva fallback")
                        print(f"      🔧 SOLUZIONE: Verificare connettività e credenziali Aruba Drive")
                else:
                    print(f"      🔍 CAUSA: URL sembra valido ma sistema usa fallback - possibile problema credenziali o logica interna")
                    print(f"      🔧 SOLUZIONE: Verificare credenziali Aruba Drive e logica di rilevamento test URL")
            else:
                print(f"   ✅ SISTEMA FUNZIONA CORRETTAMENTE - Aruba Drive utilizzato")
                
        else:
            print(f"      • Configurazione Fastweb: ❌ NON TROVATA O VUOTA")
            print(f"   🚨 ROOT CAUSE: Nessuna configurazione Aruba Drive per commessa Fastweb")
            print(f"   🔧 SOLUZIONE: Configurare Aruba Drive per commessa Fastweb con URL e credenziali reali")
        
        return aruba_config is not None and aruba_config.get('enabled', False)

    def run_diagnosis(self):
        """Run urgent Aruba Drive diagnosis"""
        print("🚨 URGENT: ARUBA DRIVE CONFIGURATION DIAGNOSIS")
        print("="*80)
        print("🎯 OBIETTIVO: Identificare perché il sistema non carica su Aruba Drive reale")
        print("🔍 FOCUS: Configurazione commessa Fastweb e rilevamento test URL")
        print("="*80)
        
        # Run the diagnosis
        result = self.test_aruba_drive_configuration_diagnosis_urgent()
        
        # Print final summary
        print(f"\n📊 DIAGNOSIS RESULTS:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if result:
            print("✅ Aruba Drive configuration found and enabled")
        else:
            print("❌ Aruba Drive configuration issues detected")
        
        return result

if __name__ == "__main__":
    tester = ArubaDriveDiagnosisTester()
    tester.run_diagnosis()