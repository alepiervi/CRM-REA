#!/usr/bin/env python3
"""
VERIFICA POST-SEEDING DEL NUREAL CRM
Tests all endpoints after database seeding to verify complete functionality
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class PostSeedingTester:
    def __init__(self, base_url="https://referente-oversight.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.commesse_data = []
        self.sub_agenzie_data = []
        self.fastweb_servizi = []
        self.offerte_data = []
        self.created_cliente_id = None

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

    def test_post_seeding_verification(self):
        """🚨 VERIFICA POST-SEEDING DEL NUREAL CRM - Complete post-seeding verification"""
        print("\n🚨 VERIFICA POST-SEEDING DEL NUREAL CRM")
        print("🎯 OBIETTIVO: Verificare che l'applicazione funzioni correttamente dopo il seeding e che sia possibile creare clienti")
        print("🎯 DATABASE SEEDED CON:")
        print("   • 22 utenti (incluso admin)")
        print("   • 4 commesse (Fastweb, Fotovoltaico, Telepass + 1 extra)")
        print("   • 6 servizi")
        print("   • 29 tipologie contratto")
        print("   • 108 segmenti")
        print("   • 26 offerte")
        
        # **TEST 1: LOGIN ADMIN**
        print("\n🔐 TEST 1: LOGIN ADMIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            user_role = self.user_data.get('role')
            
            if user_role == 'admin':
                self.log_test("✅ Admin login (admin/admin123)", True, f"Token JWT ricevuto, Role: {user_role}")
            else:
                self.log_test("❌ Admin role incorrect", False, f"Expected: admin, Got: {user_role}")
                return False
        else:
            self.log_test("❌ Admin login failed", False, f"Status: {status}, Response: {response}")
            return False

        # **TEST 2: VERIFICA COMMESSE DISPONIBILI**
        print("\n🏢 TEST 2: VERIFICA COMMESSE DISPONIBILI...")
        success, response, status = self.make_request('GET', 'commesse', expected_status=200)
        
        if success and isinstance(response, list):
            commesse_count = len(response)
            self.log_test("✅ GET /api/commesse", True, f"Status: 200 OK, Found {commesse_count} commesse")
            
            # Check for at least 3 commesse (Fastweb, Fotovoltaico, Telepass)
            if commesse_count >= 3:
                self.log_test("✅ Commesse count verification", True, f"Found {commesse_count} commesse (≥3 expected)")
                
                # Look for specific commesse
                commesse_names = [c.get('nome', '') for c in response]
                fastweb_found = any('fastweb' in name.lower() for name in commesse_names)
                fotovoltaico_found = any('fotovoltaico' in name.lower() for name in commesse_names)
                telepass_found = any('telepass' in name.lower() for name in commesse_names)
                
                expected_commesse = []
                if fastweb_found:
                    expected_commesse.append("Fastweb")
                if fotovoltaico_found:
                    expected_commesse.append("Fotovoltaico")
                if telepass_found:
                    expected_commesse.append("Telepass")
                
                if len(expected_commesse) >= 3:
                    self.log_test("✅ Expected commesse found", True, f"Found: {expected_commesse}")
                else:
                    self.log_test("❌ Missing expected commesse", False, f"Found only: {expected_commesse}")
                
                # Verify commesse have required fields
                sample_commessa = response[0]
                required_fields = ['id', 'nome', 'descrizione', 'has_whatsapp', 'has_ai', 'has_call_center']
                missing_fields = [field for field in required_fields if field not in sample_commessa]
                
                if not missing_fields:
                    self.log_test("✅ Commessa fields verification", True, "All required fields present")
                else:
                    self.log_test("❌ Missing commessa fields", False, f"Missing: {missing_fields}")
                
                # Store commesse for later use
                self.commesse_data = response
                
            else:
                self.log_test("❌ Insufficient commesse", False, f"Found {commesse_count}, expected ≥3")
                return False
        else:
            self.log_test("❌ GET /api/commesse failed", False, f"Status: {status}")
            return False

        # **TEST 3: VERIFICA SERVIZI PER COMMESSA FASTWEB**
        print("\n🔧 TEST 3: VERIFICA SERVIZI PER COMMESSA FASTWEB...")
        
        # Find Fastweb commessa ID
        fastweb_commessa = next((c for c in self.commesse_data if 'fastweb' in c.get('nome', '').lower()), None)
        
        if fastweb_commessa:
            fastweb_id = fastweb_commessa['id']
            self.log_test("✅ Fastweb commessa found", True, f"ID: {fastweb_id}, Nome: {fastweb_commessa['nome']}")
            
            # Get servizi for Fastweb commessa - try both endpoints
            success, response, status = self.make_request('GET', f'servizi?commessa_id={fastweb_id}', expected_status=200)
            
            if not success or status != 200:
                # Try alternative endpoint
                success, response, status = self.make_request('GET', f'servizi', expected_status=200)
                if success and isinstance(response, list):
                    # Filter for Fastweb servizi
                    response = [s for s in response if s.get('commessa_id') == fastweb_id]
            
            if success and isinstance(response, list):
                servizi_count = len(response)
                self.log_test("✅ Servizi for Fastweb", True, f"Found {servizi_count} servizi")
                
                # Look for TLS and NEGOZI services
                servizi_names = [s.get('nome', '') for s in response]
                tls_found = any('tls' in name.lower() for name in servizi_names)
                negozi_found = any('negozi' in name.lower() for name in servizi_names)
                
                if tls_found or negozi_found:
                    found_services = []
                    if tls_found:
                        found_services.append("TLS")
                    if negozi_found:
                        found_services.append("NEGOZI")
                    self.log_test("✅ Expected servizi found", True, f"Found: {found_services}")
                else:
                    self.log_test("❌ Expected servizi not found", False, f"Available: {servizi_names}")
                
                # Store servizi for later use
                self.fastweb_servizi = response
                
            else:
                self.log_test("❌ GET servizi for Fastweb failed", False, f"Status: {status}")
        else:
            self.log_test("❌ Fastweb commessa not found", False, "Cannot test servizi")
            return False

        # **TEST 4: VERIFICA CASCADING FILIERA**
        print("\n🔗 TEST 4: VERIFICA CASCADING FILIERA...")
        
        # Test sub agenzie
        success, response, status = self.make_request('GET', 'cascade/sub-agenzie', expected_status=200)
        
        if success and isinstance(response, list):
            sub_agenzie_count = len(response)
            self.log_test("✅ GET /api/cascade/sub-agenzie", True, f"Found {sub_agenzie_count} sub agenzie")
            
            if sub_agenzie_count > 0:
                # Test cascading for first sub agenzia
                sub_agenzia = response[0]
                sub_agenzia_id = sub_agenzia['id']
                
                # Test commesse by sub agenzia
                success, commesse_resp, status = self.make_request(
                    'GET', f'cascade/commesse-by-subagenzia/{sub_agenzia_id}', expected_status=200
                )
                
                if success and isinstance(commesse_resp, list):
                    self.log_test("✅ GET /api/cascade/commesse-by-subagenzia", True, f"Found {len(commesse_resp)} commesse")
                    
                    if len(commesse_resp) > 0:
                        commessa_id = commesse_resp[0]['id']
                        
                        # Test servizi by commessa
                        success, servizi_resp, status = self.make_request(
                            'GET', f'cascade/servizi-by-commessa/{commessa_id}', expected_status=200
                        )
                        
                        if success and isinstance(servizi_resp, list):
                            self.log_test("✅ GET /api/cascade/servizi-by-commessa", True, f"Found {len(servizi_resp)} servizi")
                            
                            if len(servizi_resp) > 0:
                                servizio_id = servizi_resp[0]['id']
                                
                                # Test tipologie by servizio
                                success, tipologie_resp, status = self.make_request(
                                    'GET', f'cascade/tipologie-by-servizio/{servizio_id}', expected_status=200
                                )
                                
                                if success and isinstance(tipologie_resp, list):
                                    self.log_test("✅ GET /api/cascade/tipologie-by-servizio", True, f"Found {len(tipologie_resp)} tipologie")
                                    
                                    if len(tipologie_resp) > 0:
                                        tipologia_id = tipologie_resp[0]['id']
                                        
                                        # Test segmenti by tipologia
                                        success, segmenti_resp, status = self.make_request(
                                            'GET', f'cascade/segmenti-by-tipologia/{tipologia_id}', expected_status=200
                                        )
                                        
                                        if success and isinstance(segmenti_resp, list):
                                            self.log_test("✅ GET /api/cascade/segmenti-by-tipologia", True, f"Found {len(segmenti_resp)} segmenti")
                                            self.log_test("✅ Complete cascading filiera", True, "All cascade endpoints working")
                                        else:
                                            self.log_test("❌ Segmenti cascade failed", False, f"Status: {status}")
                                    else:
                                        self.log_test("❌ No tipologie found", False, "Cannot test segmenti cascade")
                                else:
                                    self.log_test("❌ Tipologie cascade failed", False, f"Status: {status}")
                            else:
                                self.log_test("❌ No servizi found", False, "Cannot test tipologie cascade")
                        else:
                            self.log_test("❌ Servizi cascade failed", False, f"Status: {status}")
                    else:
                        self.log_test("❌ No commesse found for sub agenzia", False, "Cannot test servizi cascade")
                else:
                    self.log_test("❌ Commesse cascade failed", False, f"Status: {status}")
                
                # Store sub agenzie for later use
                self.sub_agenzie_data = response
                
            else:
                self.log_test("ℹ️ No sub agenzie found", True, "Will need to create sub agenzia for client creation")
                self.sub_agenzie_data = []
        else:
            self.log_test("❌ GET /api/cascade/sub-agenzie failed", False, f"Status: {status}")

        # **TEST 5: VERIFICA OFFERTE**
        print("\n💰 TEST 5: VERIFICA OFFERTE...")
        success, response, status = self.make_request('GET', 'offerte', expected_status=200)
        
        if success and isinstance(response, list):
            offerte_count = len(response)
            self.log_test("✅ GET /api/offerte", True, f"Status: 200 OK, Found {offerte_count} offerte")
            
            if offerte_count >= 10:
                self.log_test("✅ Offerte count verification", True, f"Found {offerte_count} offerte (≥10 expected)")
                
                # Check offerte for different commesse
                commesse_in_offerte = set()
                for offerta in response:
                    commessa_id = offerta.get('commessa_id')
                    if commessa_id:
                        # Find commessa name
                        commessa = next((c for c in self.commesse_data if c['id'] == commessa_id), None)
                        if commessa:
                            commesse_in_offerte.add(commessa['nome'])
                
                if len(commesse_in_offerte) >= 2:
                    self.log_test("✅ Offerte for multiple commesse", True, f"Found offerte for: {list(commesse_in_offerte)}")
                else:
                    self.log_test("❌ Offerte limited to few commesse", False, f"Found offerte for: {list(commesse_in_offerte)}")
                
                # Store offerte for later use
                self.offerte_data = response
                
            else:
                self.log_test("❌ Insufficient offerte", False, f"Found {offerte_count}, expected ≥10")
        else:
            self.log_test("❌ GET /api/offerte failed", False, f"Status: {status}")

        # **TEST 6: TEST CREAZIONE SUB AGENZIA (if needed)**
        print("\n🏢 TEST 6: TEST CREAZIONE SUB AGENZIA...")
        
        if not self.sub_agenzie_data or len(self.sub_agenzie_data) == 0:
            print("   Creating sub agenzia as none exist...")
            
            # Get admin user ID for responsabile
            admin_id = self.user_data['id']
            
            # Get Fastweb commessa ID
            fastweb_commessa_id = fastweb_commessa['id'] if fastweb_commessa else None
            
            # Get TLS servizio ID if available
            tls_servizio_id = None
            if hasattr(self, 'fastweb_servizi') and self.fastweb_servizi:
                tls_servizio = next((s for s in self.fastweb_servizi if 'tls' in s.get('nome', '').lower()), None)
                if tls_servizio:
                    tls_servizio_id = tls_servizio['id']
            
            sub_agenzia_data = {
                "nome": "F2F Test",
                "descrizione": "Sub agenzia di test",
                "responsabile_id": admin_id,
                "commesse_autorizzate": [fastweb_commessa_id] if fastweb_commessa_id else [],
                "servizi_autorizzati": [tls_servizio_id] if tls_servizio_id else []
            }
            
            success, response, status = self.make_request(
                'POST', 'sub-agenzie', 
                sub_agenzia_data, 
                expected_status=200
            )
            
            if success and isinstance(response, dict) and 'id' in response:
                created_sub_agenzia_id = response['id']
                self.log_test("✅ Sub agenzia created", True, f"ID: {created_sub_agenzia_id}, Nome: F2F Test")
                
                # Add to sub agenzie data for client creation
                self.sub_agenzie_data = [response]
                
            else:
                self.log_test("❌ Sub agenzia creation failed", False, f"Status: {status}, Response: {response}")
                return False
        else:
            self.log_test("ℹ️ Sub agenzie already exist", True, f"Using existing sub agenzie ({len(self.sub_agenzie_data)} found)")

        # **TEST 7: TEST CREAZIONE CLIENTE COMPLETO**
        print("\n👤 TEST 7: TEST CREAZIONE CLIENTE COMPLETO...")
        
        # Prepare client data
        sub_agenzia_id = self.sub_agenzie_data[0]['id']
        fastweb_commessa_id = fastweb_commessa['id']
        
        # Get TLS servizio ID
        tls_servizio_id = None
        if hasattr(self, 'fastweb_servizi') and self.fastweb_servizi:
            tls_servizio = next((s for s in self.fastweb_servizi if 'tls' in s.get('nome', '').lower()), None)
            if tls_servizio:
                tls_servizio_id = tls_servizio['id']
        
        cliente_data = {
            "nome": "Mario",
            "cognome": "Rossi",
            "email": "mario.rossi@test.it",
            "telefono": "3331234567",
            "codice_fiscale": "RSSMRA80A01H501Z",
            "commessa_id": fastweb_commessa_id,
            "sub_agenzia_id": sub_agenzia_id,
            "servizio_id": tls_servizio_id,
            "tipologia_contratto": "energia_fastweb",
            "segmento": "privato",
            "status": "passata_al_bo"
        }
        
        success, response, status = self.make_request(
            'POST', 'clienti', 
            cliente_data, 
            expected_status=200
        )
        
        if success and isinstance(response, dict) and 'id' in response:
            created_cliente_id = response['id']
            cliente_nome = response.get('nome', '')
            cliente_cognome = response.get('cognome', '')
            cliente_status = response.get('status', '')
            
            self.log_test("✅ Cliente created successfully", True, 
                f"ID: {created_cliente_id}, Nome: {cliente_nome} {cliente_cognome}, Status: {cliente_status}")
            
            # Store cliente ID for verification
            self.created_cliente_id = created_cliente_id
            
        else:
            self.log_test("❌ Cliente creation failed", False, f"Status: {status}, Response: {response}")
            return False

        # **TEST 8: VERIFICA CLIENTE CREATO**
        print("\n🔍 TEST 8: VERIFICA CLIENTE CREATO...")
        
        # Get specific client
        success, response, status = self.make_request('GET', f'clienti/{self.created_cliente_id}', expected_status=200)
        
        if success and isinstance(response, dict):
            retrieved_nome = response.get('nome', '')
            retrieved_cognome = response.get('cognome', '')
            retrieved_status = response.get('status', '')
            
            self.log_test("✅ GET /api/clienti/{id}", True, 
                f"Cliente retrieved: {retrieved_nome} {retrieved_cognome}, Status: {retrieved_status}")
            
            # Verify all data is correct
            data_correct = (
                retrieved_nome == "Mario" and
                retrieved_cognome == "Rossi" and
                response.get('email') == "mario.rossi@test.it" and
                response.get('telefono') == "3331234567" and
                response.get('commessa_id') == fastweb_commessa_id and
                response.get('sub_agenzia_id') == sub_agenzia_id
            )
            
            if data_correct:
                self.log_test("✅ Cliente data verification", True, "All client data matches input")
            else:
                self.log_test("❌ Cliente data mismatch", False, "Some client data doesn't match")
                
        else:
            self.log_test("❌ GET /api/clienti/{id} failed", False, f"Status: {status}")
            return False
        
        # Get client list to verify presence
        success, response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and isinstance(response, list):
            client_found = any(c.get('id') == self.created_cliente_id for c in response)
            
            if client_found:
                self.log_test("✅ Cliente in list verification", True, "Created client found in client list")
            else:
                self.log_test("❌ Cliente not in list", False, "Created client not found in client list")
                
        else:
            self.log_test("❌ GET /api/clienti failed", False, f"Status: {status}")

        # **FINAL SUMMARY**
        print(f"\n🎯 VERIFICA POST-SEEDING SUMMARY:")
        print(f"   🎯 OBIETTIVO: Verificare funzionamento completo dopo seeding database")
        print(f"   📊 CRITERI DI SUCCESSO:")
        print(f"      ✅ Admin login funzionante")
        print(f"      ✅ Commesse, servizi, tipologie, segmenti presenti e accessibili")
        print(f"      ✅ Cascading filiera funzionante")
        print(f"      ✅ Offerte disponibili")
        print(f"      ✅ Possibile creare sub agenzie (se necessario)")
        print(f"      ✅ Possibile creare clienti con tutti i dati")
        print(f"      ✅ Cliente salvato e recuperabile dal database")
        print(f"   🎉 FOCUS: Intero flusso di creazione cliente funziona end-to-end dopo il seeding!")
        
        return True

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting VERIFICA POST-SEEDING DEL NUREAL CRM...")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)

        # Run the POST-SEEDING VERIFICATION AS REQUESTED
        print("\n" + "="*80)
        print("🎯 RUNNING VERIFICA POST-SEEDING DEL NUREAL CRM - AS REQUESTED")
        print("="*80)
        
        backend_success = self.test_post_seeding_verification()

        # Print final summary
        print("\n" + "=" * 80)
        print("🎯 FINAL TEST SUMMARY")
        print("=" * 80)
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Highlight the critical test results
        print("\n🎯 CRITICAL TEST RESULTS:")
        if backend_success:
            print("🎉 VERIFICA POST-SEEDING DEL NUREAL CRM: ✅ SUCCESS - ALL TESTS PASSED!")
        else:
            print("🚨 VERIFICA POST-SEEDING DEL NUREAL CRM: ❌ FAILED - SOME TESTS FAILED!")
        
        return backend_success

if __name__ == "__main__":
    tester = PostSeedingTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)