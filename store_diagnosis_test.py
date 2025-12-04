#!/usr/bin/env python3
"""
Store User Issues Diagnosis Test
Focused test to diagnose why Responsabile Store cannot create clients and doesn't see cascading
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class StoreUserDiagnosisTester:
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

    def run_store_diagnosis(self):
        """🚨 DIAGNOSI PROBLEMI RESPONSABILE STORE - VERIFICA CREAZIONE CLIENTI E CASCADING"""
        print("\n🚨 DIAGNOSI PROBLEMI RESPONSABILE STORE...")
        print("🎯 OBIETTIVO: Diagnosticare perché Responsabile Store non può creare clienti e non vede cascading")
        print("🎯 FOCUS: Identificare causa root - configurazione dati, autorizzazioni mancanti, o logica cascading")
        
        # **STEP 1: LOGIN ADMIN PER VERIFICA CONFIGURAZIONE**
        print("\n🔐 STEP 1: LOGIN ADMIN PER VERIFICA CONFIGURAZIONE...")
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

        # **STEP 2: VERIFICA UTENTI STORE ESISTENTI**
        print("\n👥 STEP 2: VERIFICA UTENTI STORE ESISTENTI...")
        print("   🔍 Controllare se esistono utenti con ruolo responsabile_store nel database")
        
        # GET /api/users per trovare utenti Store
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        
        if success and status == 200:
            users = users_response if isinstance(users_response, list) else []
            self.log_test("GET /api/users", True, f"Found {len(users)} total users")
            
            # Find Store users
            store_users = [user for user in users if user.get('role') == 'responsabile_store']
            
            if store_users:
                self.log_test("UTENTI RESPONSABILE_STORE TROVATI", True, f"Found {len(store_users)} Store users")
                
                for i, store_user in enumerate(store_users):
                    username = store_user.get('username', 'N/A')
                    user_id = store_user.get('id', 'N/A')
                    sub_agenzia_id = store_user.get('sub_agenzia_id', None)
                    commesse_autorizzate = store_user.get('commesse_autorizzate', [])
                    
                    print(f"\n   📋 Store User {i+1}:")
                    print(f"      Username: {username}")
                    print(f"      ID: {user_id}")
                    print(f"      Sub Agenzia ID: {sub_agenzia_id}")
                    print(f"      Commesse Autorizzate: {len(commesse_autorizzate)} items")
                    
                    if sub_agenzia_id:
                        self.log_test(f"{username} - Sub Agenzia ID assegnato", True, f"Sub Agenzia: {sub_agenzia_id}")
                    else:
                        self.log_test(f"{username} - Sub Agenzia ID MANCANTE", False, "Nessuna sub agenzia assegnata")
                    
                    if commesse_autorizzate:
                        self.log_test(f"{username} - Commesse autorizzate popolate", True, f"Commesse: {len(commesse_autorizzate)}")
                    else:
                        self.log_test(f"{username} - Commesse autorizzate VUOTE", False, "Nessuna commessa autorizzata")
                
                # Use first Store user for testing
                test_store_user = store_users[0]
                store_username = test_store_user.get('username')
                store_user_id = test_store_user.get('id')
                
            else:
                self.log_test("NESSUN UTENTE RESPONSABILE_STORE TROVATO", False, "Database non contiene utenti Store")
                return False
        else:
            self.log_test("GET /api/users FAILED", False, f"Status: {status}")
            return False

        # **STEP 3: VERIFICA CONFIGURAZIONE SUB AGENZIE**
        print("\n🏢 STEP 3: VERIFICA CONFIGURAZIONE SUB AGENZIE...")
        
        # GET /api/sub-agenzie per verificare sub agenzie disponibili
        success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
        
        if success and status == 200:
            sub_agenzie = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
            self.log_test("GET /api/sub-agenzie", True, f"Found {len(sub_agenzie)} sub agenzie")
            
            if sub_agenzie:
                for sub_agenzia in sub_agenzie:
                    nome = sub_agenzia.get('nome', 'N/A')
                    sub_id = sub_agenzia.get('id', 'N/A')
                    commesse_autorizzate = sub_agenzia.get('commesse_autorizzate', [])
                    
                    print(f"\n   📋 Sub Agenzia: {nome}")
                    print(f"      ID: {sub_id}")
                    print(f"      Commesse Autorizzate: {len(commesse_autorizzate)} items")
                    
                    if commesse_autorizzate:
                        self.log_test(f"{nome} - Commesse autorizzate popolate", True, f"Commesse: {len(commesse_autorizzate)}")
                    else:
                        self.log_test(f"{nome} - Commesse autorizzate VUOTE", False, "Sub agenzia senza commesse")
            else:
                self.log_test("NESSUNA SUB AGENZIA TROVATA", False, "Database non contiene sub agenzie")
                return False
        else:
            self.log_test("GET /api/sub-agenzie FAILED", False, f"Status: {status}")
            return False

        # **STEP 4: LOGIN STORE USER E TEST ENDPOINTS CASCADING**
        print("\n🔐 STEP 4: LOGIN STORE USER E TEST ENDPOINTS CASCADING...")
        
        # Try to login with Store user (use admin123 password)
        success, store_login_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': store_username, 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in store_login_response:
            # Save admin token
            admin_token = self.token
            
            # Use Store user token
            self.token = store_login_response['access_token']
            store_user_data = store_login_response['user']
            
            self.log_test("STORE USER LOGIN", True, 
                f"Username: {store_username}, Role: {store_user_data.get('role')}")
            
            # Verify Store user configuration
            store_sub_agenzia_id = store_user_data.get('sub_agenzia_id')
            store_commesse = store_user_data.get('commesse_autorizzate', [])
            
            print(f"\n   📋 Store User Configuration:")
            print(f"      Sub Agenzia ID: {store_sub_agenzia_id}")
            print(f"      Commesse Autorizzate: {len(store_commesse)} items")
            
            # **TEST ENDPOINTS CASCADING**
            print("\n🔗 TEST ENDPOINTS CASCADING...")
            
            # Test GET /api/cascade/sub-agenzie
            print("   Testing GET /api/cascade/sub-agenzie...")
            success, sub_agenzie_cascade, status = self.make_request('GET', 'cascade/sub-agenzie', expected_status=200)
            
            if success and status == 200:
                sub_agenzie_data = sub_agenzie_cascade if isinstance(sub_agenzie_cascade, list) else []
                self.log_test("GET /api/cascade/sub-agenzie (Store user)", True, 
                    f"Status: {status}, Sub Agenzie: {len(sub_agenzie_data)}")
                
                if sub_agenzie_data:
                    self.log_test("Cascading Sub Agenzie - DATI PRESENTI", True, 
                        f"Store user vede {len(sub_agenzie_data)} sub agenzie")
                else:
                    self.log_test("Cascading Sub Agenzie - DATI VUOTI", False, 
                        "Store user non vede sub agenzie - PROBLEMA IDENTIFICATO!")
            else:
                self.log_test("GET /api/cascade/sub-agenzie (Store user)", False, 
                    f"Status: {status}, Response: {sub_agenzie_cascade}")
            
            # Test GET /api/cascade/commesse-by-sub-agenzia if sub agenzia available
            if store_sub_agenzia_id:
                print(f"   Testing GET /api/cascade/commesse-by-sub-agenzia/{store_sub_agenzia_id}...")
                success, commesse_cascade, status = self.make_request(
                    'GET', f'cascade/commesse-by-sub-agenzia/{store_sub_agenzia_id}', expected_status=200
                )
                
                if success and status == 200:
                    commesse_data = commesse_cascade if isinstance(commesse_cascade, list) else []
                    self.log_test("GET /api/cascade/commesse-by-sub-agenzia (Store user)", True, 
                        f"Status: {status}, Commesse: {len(commesse_data)}")
                    
                    if commesse_data:
                        self.log_test("Cascading Commesse - DATI PRESENTI", True, 
                            f"Store user vede {len(commesse_data)} commesse")
                    else:
                        self.log_test("Cascading Commesse - DATI VUOTI", False, 
                            "Store user non vede commesse - PROBLEMA IDENTIFICATO!")
                else:
                    self.log_test("GET /api/cascade/commesse-by-sub-agenzia (Store user)", False, 
                        f"Status: {status}, Response: {commesse_cascade}")
            
            # **STEP 5: TEST CREAZIONE CLIENTE**
            print("\n👤 STEP 5: TEST CREAZIONE CLIENTE...")
            
            if store_sub_agenzia_id and store_commesse:
                # Prepare test client data
                test_client_data = {
                    "nome": "Test",
                    "cognome": "Store Cliente",
                    "telefono": "+39 123 456 7890",
                    "email": "test.store@cliente.it",
                    "commessa_id": store_commesse[0],  # Use first authorized commessa
                    "sub_agenzia_id": store_sub_agenzia_id,
                    "tipologia_contratto": "energia_fastweb",
                    "segmento": "privato"
                }
                
                print(f"   📋 Test client data: {test_client_data}")
                
                # Test POST /api/clienti
                success, client_response, status = self.make_request(
                    'POST', 'clienti', test_client_data, expected_status=200
                )
                
                if success and (status == 200 or status == 201):
                    self.log_test("POST /api/clienti (Store user)", True, 
                        f"Status: {status} - CREAZIONE CLIENTE FUNZIONA!")
                    
                    if isinstance(client_response, dict) and 'id' in client_response:
                        client_id = client_response['id']
                        self.log_test("Cliente creato con successo", True, f"Client ID: {client_id}")
                    else:
                        self.log_test("Risposta creazione cliente invalida", False, f"Response: {client_response}")
                        
                elif status == 403:
                    self.log_test("POST /api/clienti (Store user)", False, 
                        f"Status: 403 Forbidden - AUTORIZZAZIONI MANCANTI!")
                    self.log_test("ROOT CAUSE IDENTIFICATA", False, 
                        "Store user non ha autorizzazioni per creare clienti")
                        
                elif status == 422:
                    self.log_test("POST /api/clienti (Store user)", False, 
                        f"Status: 422 Validation Error - DATI INVALIDI!")
                    self.log_test("Validation Error Details", False, f"Response: {client_response}")
                    
                else:
                    self.log_test("POST /api/clienti (Store user)", False, 
                        f"Status: {status}, Response: {client_response}")
            else:
                self.log_test("Cannot test client creation", False, 
                    "Store user missing sub_agenzia_id or commesse_autorizzate")
            
            # **STEP 6: VERIFICA USER_COMMESSA_AUTHORIZATIONS**
            print("\n🔐 STEP 6: VERIFICA USER_COMMESSA_AUTHORIZATIONS...")
            
            # Test GET /api/auth/me to see full user data
            success, auth_me_response, status = self.make_request('GET', 'auth/me', expected_status=200)
            
            if success and status == 200:
                self.log_test("GET /api/auth/me (Store user)", True, f"Status: {status}")
                
                # Check authorization fields
                auth_commesse = auth_me_response.get('commesse_autorizzate', [])
                auth_sub_agenzia = auth_me_response.get('sub_agenzia_id')
                
                print(f"\n   📋 Authorization Data from /auth/me:")
                print(f"      Commesse Autorizzate: {len(auth_commesse)} items")
                print(f"      Sub Agenzia ID: {auth_sub_agenzia}")
                
                if auth_commesse:
                    self.log_test("Store user - Commesse autorizzate in auth/me", True, 
                        f"Commesse: {len(auth_commesse)}")
                else:
                    self.log_test("Store user - Commesse autorizzate VUOTE in auth/me", False, 
                        "Autorizzazioni non configurate correttamente")
                
                if auth_sub_agenzia:
                    self.log_test("Store user - Sub Agenzia ID in auth/me", True, 
                        f"Sub Agenzia: {auth_sub_agenzia}")
                else:
                    self.log_test("Store user - Sub Agenzia ID MANCANTE in auth/me", False, 
                        "Sub agenzia non assegnata")
            else:
                self.log_test("GET /api/auth/me (Store user)", False, f"Status: {status}")
            
            # Restore admin token
            self.token = admin_token
            
        else:
            self.log_test("STORE USER LOGIN FAILED", False, 
                f"Status: {status}, Response: {store_login_response}")
            
            # Try with different password or check if user exists
            if status == 401:
                self.log_test("Password issue detected", False, 
                    "Store user exists but password is incorrect")
            elif status == 404:
                self.log_test("User not found", False, 
                    "Store user does not exist in database")

        # **FINAL DIAGNOSIS SUMMARY**
        print(f"\n🎯 DIAGNOSI COMPLETA PROBLEMI RESPONSABILE STORE:")
        print(f"   🎯 OBIETTIVO: Identificare causa root problemi creazione clienti e cascading")
        print(f"   📊 RISULTATI DIAGNOSI:")
        
        # Determine root causes based on test results
        root_causes = []
        
        if not store_users:
            root_causes.append("❌ NESSUN UTENTE STORE ESISTENTE nel database")
        
        if 'store_user_data' in locals():
            if not store_user_data.get('sub_agenzia_id'):
                root_causes.append("❌ STORE USER SENZA SUB_AGENZIA_ID assegnato")
            
            if not store_user_data.get('commesse_autorizzate'):
                root_causes.append("❌ STORE USER SENZA COMMESSE_AUTORIZZATE")
        
        if 'sub_agenzie_data' in locals() and not sub_agenzie_data:
            root_causes.append("❌ CASCADING SUB AGENZIE restituisce dati vuoti")
        
        if 'commesse_data' in locals() and not commesse_data:
            root_causes.append("❌ CASCADING COMMESSE restituisce dati vuoti")
        
        if 'client_response' in locals() and status == 403:
            root_causes.append("❌ AUTORIZZAZIONI MANCANTI per creazione clienti")
        
        if root_causes:
            print(f"   🚨 CAUSE ROOT IDENTIFICATE:")
            for cause in root_causes:
                print(f"      {cause}")
        else:
            print(f"   ✅ NESSUN PROBLEMA CRITICO IDENTIFICATO - Sistema potrebbe funzionare")
        
        print(f"\n   💡 RACCOMANDAZIONI:")
        if not store_users:
            print(f"      1. Creare utenti con ruolo responsabile_store nel database")
        if 'store_user_data' in locals() and not store_user_data.get('sub_agenzia_id'):
            print(f"      2. Assegnare sub_agenzia_id agli utenti Store")
        if 'store_user_data' in locals() and not store_user_data.get('commesse_autorizzate'):
            print(f"      3. Popolare commesse_autorizzate per utenti Store")
        if 'sub_agenzie_data' in locals() and not sub_agenzie_data:
            print(f"      4. Verificare logica endpoint /api/cascade/sub-agenzie per ruolo Store")
        if 'client_response' in locals() and status == 403:
            print(f"      5. Creare record user_commessa_authorizations con can_create_clients: true")
        
        # Print final results
        print(f"\n📊 Test Results Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return len(root_causes) == 0

if __name__ == "__main__":
    tester = StoreUserDiagnosisTester()
    success = tester.run_store_diagnosis()
    
    if success:
        print("\n🎉 STORE DIAGNOSIS: No critical issues found!")
        sys.exit(0)
    else:
        print("\n🚨 STORE DIAGNOSIS: Critical issues identified!")
        sys.exit(1)