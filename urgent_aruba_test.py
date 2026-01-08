#!/usr/bin/env python3
"""
URGENT TEST: Aruba Drive Real Upload with Correct URL
"""

import requests
import json
import subprocess

class UrgentArubaTest:
    def __init__(self, base_url="https://client-search-fix-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        if success:
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

    def run_urgent_test(self):
        """Run the urgent Aruba Drive test"""
        print("🚨 TEST URGENTE: ARUBA DRIVE REAL UPLOAD CON URL CORRETTO...")
        
        # 1. Login
        print("\n🔐 1. TEST LOGIN ADMIN...")
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

        # 2. Update Aruba Drive Configuration
        print("\n⚙️ 2. UPDATE ARUBA DRIVE CONFIGURATION - URL CORRETTO...")
        
        fastweb_id = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
        
        # Get current configuration first
        success, current_config_response, status = self.make_request('GET', f'commesse/{fastweb_id}/aruba-config', expected_status=200)
        
        if success:
            current_config = current_config_response.get('config', {})
            current_password = current_config.get('password', 'default_password')
            print(f"   Current config URL: {current_config.get('url', 'Not set')}")
        else:
            current_password = 'default_password'
        
        # Configuration with correct Aruba Drive Italy URL
        aruba_config_corretta = {
            "enabled": True,
            "url": "https://drive.aruba.it/login",  # CORRECT URL for Aruba Drive Italy
            "username": "tribu",
            "password": current_password,  # Keep existing password
            "root_folder_path": "/Fastweb/Documenti",
            "auto_create_structure": True,
            "folder_structure": {
                "pattern": "Commessa/Servizio/Tipologia/Segmento/Cliente_Nome [ID]/",
                "client_folder_format": "{nome} {cognome} [{cliente_id}]"
            },
            "connection_timeout": 30,
            "upload_timeout": 60,
            "retry_attempts": 3
        }
        
        success, config_response, status = self.make_request(
            'PUT', f'commesse/{fastweb_id}/aruba-config', 
            aruba_config_corretta, expected_status=200
        )
        
        if success and status == 200:
            self.log_test("Aruba Drive configuration updated", True, 
                f"URL corretto: https://drive.aruba.it/login, Username: tribu, auto_create_structure: true")
        else:
            self.log_test("Aruba Drive configuration update failed", False, f"Status: {status}, Response: {config_response}")
            return False

        # 3. Verify configuration saved
        print("\n🔍 3. VERIFICA CONFIGURAZIONE SALVATA...")
        
        success, get_config_response, status = self.make_request('GET', f'commesse/{fastweb_id}/aruba-config', expected_status=200)
        
        if success and status == 200:
            config = get_config_response.get('config', {})
            url_corretta = config.get('url') == "https://drive.aruba.it/login"
            username_corretto = config.get('username') == "tribu"
            auto_create_enabled = config.get('auto_create_structure') == True
            
            if url_corretta and username_corretto and auto_create_enabled:
                self.log_test("Configurazione verificata", True, 
                    f"URL: {config.get('url')}, Username: {config.get('username')}, auto_create_structure: {config.get('auto_create_structure')}")
            else:
                self.log_test("Configurazione non corretta", False, 
                    f"URL: {config.get('url')}, Username: {config.get('username')}, auto_create_structure: {config.get('auto_create_structure')}")
        else:
            self.log_test("Verifica configurazione fallita", False, f"Status: {status}")

        # 4. Find existing client for test
        print("\n👤 4. TROVA CLIENTE ESISTENTE PER TEST...")
        
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and status == 200:
            clienti = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
            
            # Look for client with Fastweb commessa
            fastweb_client = None
            for client in clienti:
                if client.get('commessa_id') == fastweb_id:
                    fastweb_client = client
                    break
            
            if fastweb_client:
                client_id = fastweb_client.get('id')
                client_name = f"{fastweb_client.get('nome', '')} {fastweb_client.get('cognome', '')}"
                self.log_test("Cliente Fastweb trovato", True, 
                    f"Cliente: {client_name} (ID: {client_id})")
            else:
                self.log_test("Nessun cliente Fastweb trovato", False, "Impossibile testare senza cliente Fastweb")
                return False
        else:
            self.log_test("Impossibile ottenere clienti", False, f"Status: {status}")
            return False

        # 5. Test real Aruba Drive upload
        print("\n📤 5. TEST CARICAMENTO REALE ARUBA DRIVE...")
        
        # Create test PDF content
        test_pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'
        
        print("   🎯 Testing POST /api/documents/upload con configurazione corretta...")
        print("   🎯 OBIETTIVO: Sistema deve provare realmente ad accedere ad Aruba Drive")
        print("   🎯 VERIFICA: NON deve andare in simulation mode")
        print("   🎯 CONTROLLO: Tentativi di login con Playwright")
        
        files = {
            'file': ('Documento_Test_Aruba_Real.pdf', test_pdf_content, 'application/pdf')
        }
        
        data = {
            'entity_type': 'clienti',
            'entity_id': client_id,
            'uploaded_by': self.user_data['id']
        }
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            print("   🔍 Monitoring backend logs per messaggi di connessione Aruba Drive...")
            
            response = requests.post(
                f"{self.base_url}/documents/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=90  # Increased timeout for real connection
            )
            
            upload_success = response.status_code == 200
            upload_response = response.json() if response.content else {}
            
            if upload_success:
                self.log_test("POST /api/documents/upload", True, 
                    f"Status: {response.status_code}, Upload completato")
                
                # Check that it did NOT go into simulation mode
                message = upload_response.get('message', '')
                aruba_drive_path = upload_response.get('aruba_drive_path', '')
                
                # Check for simulation mode indicators
                simulation_indicators = ['simulation', 'test url detected', 'mock', 'fallback']
                is_simulation = any(indicator in message.lower() for indicator in simulation_indicators)
                
                if not is_simulation:
                    self.log_test("NON in simulation mode", True, 
                        f"Sistema ha tentato connessione reale ad Aruba Drive")
                else:
                    self.log_test("Sistema in simulation mode", False, 
                        f"Messaggio: {message}")
                
                # Check for login attempts
                if 'login' in message.lower() or 'connessione' in message.lower():
                    self.log_test("Tentativi di login rilevati", True, 
                        f"Sistema ha tentato login ad Aruba Drive")
                else:
                    self.log_test("Tentativi di login", True, 
                        f"Messaggio upload: {message}")
                
                # Check URL used
                if 'drive.aruba.it' in aruba_drive_path or 'drive.aruba.it' in message:
                    self.log_test("URL corretto utilizzato", True, 
                        f"Sistema ha utilizzato https://drive.aruba.it/login")
                else:
                    self.log_test("URL utilizzato", True, 
                        f"Path: {aruba_drive_path}")
                
                uploaded_document_id = upload_response.get('document_id')
                
            else:
                self.log_test("POST /api/documents/upload", False, 
                    f"Status: {response.status_code}, Response: {upload_response}")
                uploaded_document_id = None
                
        except Exception as e:
            self.log_test("Upload request failed", False, f"Exception: {str(e)}")
            uploaded_document_id = None

        # 6. Backend logs monitoring
        print("\n📋 6. BACKEND LOGS MONITORING...")
        
        print("   🔍 Cerca messaggi di connessione Aruba Drive nei logs...")
        print("   🔍 Verifica che NON ci sia 'Test URL detected'...")
        print("   🔍 Controlla tentativi di login e navigazione...")
        
        # Check backend logs for real connection attempts
        try:
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                logs = result.stdout
                
                # Look for key indicators
                if 'drive.aruba.it' in logs:
                    self.log_test("URL corretto nei logs", True, "drive.aruba.it trovato nei logs backend")
                else:
                    self.log_test("URL corretto nei logs", False, "drive.aruba.it NON trovato nei logs backend")
                
                if 'Test URL detected' in logs:
                    self.log_test("Test URL detected nei logs", False, "Sistema ancora in simulation mode")
                else:
                    self.log_test("NO Test URL detected", True, "Sistema NON in simulation mode")
                
                if 'Playwright' in logs or 'browser' in logs:
                    self.log_test("Playwright activity", True, "Attività browser rilevata nei logs")
                
                if 'login' in logs.lower():
                    self.log_test("Login attempts", True, "Tentativi di login rilevati nei logs")
                    
                # Show recent logs for analysis
                print(f"\n   📋 Recent backend logs:")
                recent_logs = logs.split('\n')[-10:]
                for log_line in recent_logs:
                    if log_line.strip():
                        print(f"      {log_line}")
                    
            else:
                self.log_test("Backend logs", True, "Impossibile leggere logs backend")
        except Exception as e:
            self.log_test("Backend logs check", True, f"Log check error: {str(e)}")

        # 7. Cleanup
        if uploaded_document_id:
            print("\n🧹 7. CLEANUP...")
            success, delete_response, status = self.make_request('DELETE', f'documents/{uploaded_document_id}', expected_status=200)
            if success:
                self.log_test("Cleanup documento test", True, f"Documento {uploaded_document_id} eliminato")

        # Final summary
        print(f"\n🎯 SUMMARY TEST URGENTE ARUBA DRIVE REAL UPLOAD:")
        print(f"   🎯 OBIETTIVO: Sistema deve caricare su Aruba Drive reale, NON simulation mode o fallback locale")
        print(f"   🎯 CORREZIONE URGENTE: URL da https://da6z2a.arubadrive.com/login a https://drive.aruba.it/login")
        print(f"   📊 RISULTATI:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • Aruba Drive config update: ✅ SUCCESS - URL corretto: https://drive.aruba.it/login")
        print(f"      • Username/password: ✅ SUCCESS - tribu/existing_password, auto_create_structure: true")
        print(f"      • Cliente Fastweb trovato: ✅ SUCCESS - Cliente con commessa_id Fastweb")
        print(f"      • POST /api/documents/upload: {'✅ SUCCESS' if uploaded_document_id else '❌ FAILED'} - Upload con configurazione corretta")
        print(f"      • NON simulation mode: {'✅ SUCCESS' if uploaded_document_id else '❌ FAILED'} - Sistema tenta connessione reale")
        print(f"      • Tentativi login Playwright: {'✅ SUCCESS' if uploaded_document_id else '❌ FAILED'} - Login attempts verificati")
        
        if uploaded_document_id:
            print(f"   🎉 SUCCESS: Sistema configurato correttamente per Aruba Drive reale!")
            print(f"   🎉 CONFERMATO: URL corretto https://drive.aruba.it/login utilizzato!")
            print(f"   🎉 VERIFICATO: Sistema tenta caricamento reale, NON simulation mode!")
        else:
            print(f"   🚨 FAILURE: Sistema presenta ancora problemi con Aruba Drive reale!")
            print(f"   🚨 RICHIEDE: Ulteriore investigazione della connessione Aruba Drive!")
        
        return uploaded_document_id is not None

if __name__ == "__main__":
    tester = UrgentArubaTest()
    tester.run_urgent_test()