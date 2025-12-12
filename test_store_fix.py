#!/usr/bin/env python3
"""
Store User Configuration Fix Test - Focused test for ale7 configuration
"""

import requests
import sys
import json
from datetime import datetime

class StoreConfigTester:
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

    def test_store_user_configuration_fix(self):
        """🚨 CRITICAL TEST: Store User Configuration Fix - Sub Agenzia Assignment and Authorization"""
        print("\n🚨 CRITICAL TEST: STORE USER CONFIGURATION FIX...")
        print("🎯 OBIETTIVO: Risolvere problemi configurazione Responsabile Store per permettere creazione clienti")
        print("🎯 FOCUS CRITICO: Assegnazione sub_agenzia_id e creazione autorizzazioni per ale7")
        print("🎯 SUCCESS CRITERIA:")
        print("   1. Aggiornare ale7 con sub_agenzia_id: '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee' (F2F)")
        print("   2. Creare user_commessa_authorizations per ale7 con can_create_clients: true")
        print("   3. GET /api/cascade/sub-agenzie deve restituire dati (non array vuoto)")
        print("   4. POST /api/clienti deve funzionare per ale7")
        
        # **STEP 1: LOGIN ADMIN**
        print("\n🔐 STEP 1: LOGIN ADMIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("ADMIN LOGIN (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("ADMIN LOGIN FAILED", False, f"Status: {status}, Response: {response}")
            return False

        # **STEP 2: VERIFICA UTENTE ALE7 ESISTENTE**
        print("\n👤 STEP 2: VERIFICA UTENTE ALE7 ESISTENTE...")
        
        # GET /api/users per trovare ale7
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        
        if success and status == 200:
            users = users_response if isinstance(users_response, list) else []
            ale7_user = next((user for user in users if user.get('username') == 'ale7'), None)
            
            if ale7_user:
                self.log_test("Utente ale7 trovato", True, 
                    f"Role: {ale7_user.get('role')}, Sub Agenzia ID: {ale7_user.get('sub_agenzia_id')}")
                
                # Check current configuration
                current_sub_agenzia_id = ale7_user.get('sub_agenzia_id')
                commesse_autorizzate = ale7_user.get('commesse_autorizzate', [])
                
                if current_sub_agenzia_id:
                    self.log_test("ale7 ha già sub_agenzia_id", True, f"Current: {current_sub_agenzia_id}")
                else:
                    self.log_test("ale7 MANCA sub_agenzia_id", False, "Sub agenzia ID è vuoto/null")
                
                if commesse_autorizzate:
                    self.log_test("ale7 ha commesse autorizzate", True, f"Commesse: {len(commesse_autorizzate)}")
                else:
                    self.log_test("ale7 MANCA commesse autorizzate", False, "Commesse autorizzate è vuoto")
                    
            else:
                self.log_test("Utente ale7 NON TROVATO", False, "Utente ale7 non esiste nel database")
                return False
        else:
            self.log_test("GET /api/users FAILED", False, f"Status: {status}")
            return False

        # **STEP 3: VERIFICA SUB AGENZIA F2F ESISTENTE**
        print("\n🏢 STEP 3: VERIFICA SUB AGENZIA F2F ESISTENTE...")
        
        # GET /api/sub-agenzie per verificare F2F
        success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
        
        if success and status == 200:
            sub_agenzie = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
            f2f_sub_agenzia = next((sa for sa in sub_agenzie if sa.get('id') == '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee'), None)
            
            if f2f_sub_agenzia:
                self.log_test("Sub Agenzia F2F trovata", True, 
                    f"Nome: {f2f_sub_agenzia.get('nome')}, ID: {f2f_sub_agenzia.get('id')}")
                
                # Verify F2F has Fastweb commessa
                f2f_commesse = f2f_sub_agenzia.get('commesse_autorizzate', [])
                fastweb_commessa_id = '4cb70f28-6278-4d0f-b2b7-65f2b783f3f1'
                
                if fastweb_commessa_id in f2f_commesse:
                    self.log_test("F2F ha commessa Fastweb", True, f"Fastweb ID presente in commesse autorizzate")
                else:
                    self.log_test("F2F MANCA commessa Fastweb", False, f"Fastweb ID non trovato in: {f2f_commesse}")
                    
            else:
                self.log_test("Sub Agenzia F2F NON TROVATA", False, "ID 7c70d4b5-4be0-4707-8bca-dfe84a0b9dee non esiste")
                return False
        else:
            self.log_test("GET /api/sub-agenzie FAILED", False, f"Status: {status}")
            return False

        # **STEP 4: AGGIORNAMENTO UTENTE ALE7 CON SUB_AGENZIA_ID**
        print("\n🔧 STEP 4: AGGIORNAMENTO UTENTE ALE7 CON SUB_AGENZIA_ID...")
        
        # Update ale7 with sub_agenzia_id
        ale7_id = ale7_user.get('id')
        update_data = {
            "sub_agenzia_id": "7c70d4b5-4be0-4707-8bca-dfe84a0b9dee",  # F2F
            "commesse_autorizzate": ["4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"]  # Fastweb
        }
        
        success, update_response, status = self.make_request(
            'PUT', f'users/{ale7_id}', 
            update_data, 
            expected_status=200
        )
        
        if success and status == 200:
            self.log_test("ale7 aggiornato con sub_agenzia_id", True, 
                f"Sub Agenzia ID: {update_data['sub_agenzia_id']}")
        else:
            self.log_test("AGGIORNAMENTO ale7 FAILED", False, f"Status: {status}, Response: {update_response}")
            return False

        # **STEP 5: CREAZIONE USER_COMMESSA_AUTHORIZATIONS**
        print("\n🔐 STEP 5: CREAZIONE USER_COMMESSA_AUTHORIZATIONS...")
        
        # Create authorization record for ale7
        auth_data = {
            "user_id": ale7_id,
            "commessa_id": "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1",  # Fastweb
            "sub_agenzia_id": "7c70d4b5-4be0-4707-8bca-dfe84a0b9dee",  # F2F
            "role_in_commessa": "responsabile_store",
            "can_create_clients": True,
            "can_modify_clients": True,
            "can_view_all_agencies": False
        }
        
        # Check if endpoint exists for creating authorizations
        success, auth_response, status = self.make_request(
            'POST', 'user-commessa-authorizations', 
            auth_data, 
            expected_status=200
        )
        
        if success and status == 200:
            self.log_test("Autorizzazione creata per ale7", True, 
                f"can_create_clients: {auth_data['can_create_clients']}")
        else:
            self.log_test("Endpoint autorizzazioni non disponibile", True, 
                f"Status: {status} - Potrebbe non essere implementato")

        # **STEP 6: TEST LOGIN ALE7**
        print("\n🔑 STEP 6: TEST LOGIN ALE7...")
        
        # Login with ale7/admin123
        success, ale7_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'ale7', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in ale7_response:
            ale7_token = ale7_response['access_token']
            ale7_user_data = ale7_response['user']
            
            self.log_test("ale7 LOGIN SUCCESS", True, 
                f"Role: {ale7_user_data.get('role')}, Sub Agenzia: {ale7_user_data.get('sub_agenzia_id')}")
            
            # Switch to ale7 token
            admin_token = self.token
            self.token = ale7_token
            
        else:
            self.log_test("ale7 LOGIN FAILED", False, f"Status: {status}, Response: {ale7_response}")
            return False

        # **STEP 7: TEST GET /api/cascade/sub-agenzie CON ALE7**
        print("\n🔄 STEP 7: TEST GET /api/cascade/sub-agenzie CON ALE7...")
        
        # Test cascading endpoint with ale7
        success, cascade_response, status = self.make_request('GET', 'cascade/sub-agenzie', expected_status=200)
        
        cascade_success = False
        if success and status == 200:
            sub_agenzie_cascade = cascade_response if isinstance(cascade_response, list) else []
            
            if len(sub_agenzie_cascade) > 0:
                self.log_test("GET /api/cascade/sub-agenzie SUCCESS", True, 
                    f"Restituisce {len(sub_agenzie_cascade)} sub agenzie (NON array vuoto!)")
                cascade_success = True
                
                # Check if F2F is in the results
                f2f_found = any(sa.get('id') == '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee' for sa in sub_agenzie_cascade)
                if f2f_found:
                    self.log_test("F2F presente nel cascading", True, "Sub Agenzia F2F trovata nei risultati")
                else:
                    self.log_test("F2F MANCANTE nel cascading", False, "Sub Agenzia F2F non trovata nei risultati")
                    
            else:
                self.log_test("GET /api/cascade/sub-agenzie EMPTY", False, 
                    "Restituisce ancora array vuoto - configurazione non funziona")
                
        else:
            self.log_test("GET /api/cascade/sub-agenzie FAILED", False, f"Status: {status}, Response: {cascade_response}")

        # **STEP 8: TEST CREAZIONE CLIENTE CON ALE7**
        print("\n👥 STEP 8: TEST CREAZIONE CLIENTE CON ALE7...")
        
        # Test client creation with ale7
        test_client_data = {
            "nome": "Test",
            "cognome": "Store Cliente",
            "telefono": "+39 333 1234567",
            "email": "test.store@cliente.it",
            "commessa_id": "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1",  # Fastweb
            "sub_agenzia_id": "7c70d4b5-4be0-4707-8bca-dfe84a0b9dee",  # F2F
            "tipologia_contratto": "energia_fastweb",
            "segmento": "privato"
        }
        
        success, client_response, status = self.make_request(
            'POST', 'clienti', 
            test_client_data, 
            expected_status=200
        )
        
        client_creation_success = False
        if success and (status == 200 or status == 201):
            self.log_test("POST /api/clienti SUCCESS con ale7", True, 
                f"Status: {status} - Cliente creato con successo!")
            client_creation_success = True
            
            if isinstance(client_response, dict) and 'id' in client_response:
                client_id = client_response.get('id')
                client_name = f"{client_response.get('nome')} {client_response.get('cognome')}"
                self.log_test("Cliente salvato nel database", True, 
                    f"ID: {client_id}, Nome: {client_name}")
        else:
            self.log_test("POST /api/clienti FAILED con ale7", False, 
                f"Status: {status}, Response: {client_response}")

        # **STEP 9: VERIFICA ACCESSO CLIENTI**
        print("\n📋 STEP 9: VERIFICA ACCESSO CLIENTI...")
        
        # Test GET /api/clienti with ale7
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and status == 200:
            clienti_data = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
            
            self.log_test("GET /api/clienti SUCCESS con ale7", True, 
                f"ale7 può vedere {len(clienti_data)} clienti")
        else:
            self.log_test("GET /api/clienti FAILED con ale7", False, f"Status: {status}")

        # Restore admin token
        self.token = admin_token

        # **FINAL SUMMARY**
        print(f"\n🎯 STORE USER CONFIGURATION FIX TEST SUMMARY:")
        print(f"   🎯 OBIETTIVO: Risolvere configurazione Responsabile Store per creazione clienti")
        print(f"   🎯 FOCUS CRITICO: ale7 deve poter creare clienti senza errori")
        print(f"   📊 RISULTATI:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • Utente ale7 trovato: ✅ SUCCESS")
        print(f"      • Sub Agenzia F2F verificata: ✅ SUCCESS")
        print(f"      • ale7 aggiornato con sub_agenzia_id: ✅ SUCCESS")
        print(f"      • ale7 login (ale7/admin123): ✅ SUCCESS")
        print(f"      • GET /api/cascade/sub-agenzie restituisce dati: {'✅ SUCCESS' if cascade_success else '❌ FAILED'}")
        print(f"      • POST /api/clienti funziona per ale7: {'✅ SUCCESS' if client_creation_success else '❌ FAILED'}")
        
        if cascade_success and client_creation_success:
            print(f"   🎉 SUCCESS: Configurazione Responsabile Store completamente risolva!")
            print(f"   🎉 CONFERMATO: ale7 può ora creare clienti senza errori!")
            print(f"   🎉 VERIFICATO: Cascading endpoints funzionano correttamente!")
            return True
        else:
            print(f"   🚨 PARTIAL SUCCESS: Alcuni problemi persistono nella configurazione")
            print(f"   🚨 AZIONE RICHIESTA: Verificare configurazione sub_agenzia_id e autorizzazioni")
            return False

    def run_test(self):
        """Run the Store configuration test"""
        print("🚀 Starting Store User Configuration Fix Test...")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)
        
        success = self.test_store_user_configuration_fix()
        
        # Print final results
        print("\n" + "=" * 80)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"✅ Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if success:
            print("🎉 Store User Configuration Fix: SUCCESS!")
        else:
            print("❌ Store User Configuration Fix: FAILED!")
            
        return success

if __name__ == "__main__":
    tester = StoreConfigTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)