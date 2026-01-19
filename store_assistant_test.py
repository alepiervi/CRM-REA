#!/usr/bin/env python3
"""
Store Assistant Tipologia Contratto Bug Test
Urgent test to identify why Store Assistant cannot see tipologie contratto in filter
"""

import requests
import sys
import json
from datetime import datetime
import time

class StoreAssistantTester:
    def __init__(self, base_url="https://agentify-6.preview.emergentagent.com/api"):
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

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True, timeout=30):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            
            try:
                return success, response.json() if response.content else {}, response.status_code
            except json.JSONDecodeError:
                return success, {"error": "Non-JSON response", "content": response.text[:200]}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_store_assistant_tipologia_contratto_bug_urgent(self):
        """🚨 TESTING URGENTE: STORE ASSISTANT TIPOLOGIA CONTRATTO BUG"""
        print("\n🚨 TESTING URGENTE: STORE ASSISTANT TIPOLOGIA CONTRATTO BUG")
        print("🎯 CONTESTO:")
        print("   L'utente ha confermato che il filtro Tipologia Contratto NON funziona ancora per Store Assistant,")
        print("   anche dopo i fix applicati. Admin funziona, ma Store Assistant ha ancora problemi.")
        print("")
        print("🎯 OBIETTIVO:")
        print("   Identificare esattamente perché Store Assistant non vede le tipologie contratto nel filtro.")
        
        start_time = time.time()
        
        # **FASE 1: Identifica Utente Store Assistant**
        print("\n📋 FASE 1: IDENTIFICA UTENTE STORE ASSISTANT...")
        
        # First login as admin to search for Store Assistant users
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            admin_token = response['access_token']
            self.token = admin_token
            self.log_test("✅ Admin login (admin/admin123)", True, f"Token received for user search")
        else:
            self.log_test("❌ Admin login failed", False, f"Status: {status}, Response: {response}")
            return False

        # Get all users to find Store Assistant
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        
        store_assistant_user = None
        store_assistant_username = None
        
        if success and status == 200:
            users = users_response if isinstance(users_response, list) else []
            self.log_test("✅ GET /api/users", True, f"Found {len(users)} total users")
            
            # Look for Store Assistant users
            store_assistants = []
            for user in users:
                role = user.get('role', '').lower()
                if 'store_assist' in role or role == 'store_assist':
                    store_assistants.append(user)
            
            if store_assistants:
                store_assistant_user = store_assistants[0]
                store_assistant_username = store_assistant_user.get('username')
                store_assistant_id = store_assistant_user.get('id')
                
                self.log_test("✅ Store Assistant user found", True, 
                    f"Username: {store_assistant_username}, Role: {store_assistant_user.get('role')}, ID: {store_assistant_id[:8]}...")
                    
                print(f"   📊 STORE ASSISTANT USER DETAILS:")
                print(f"      • Username: {store_assistant_username}")
                print(f"      • Role: {store_assistant_user.get('role')}")
                print(f"      • ID: {store_assistant_id}")
                print(f"      • Is Active: {store_assistant_user.get('is_active')}")
                print(f"      • Sub Agenzia ID: {store_assistant_user.get('sub_agenzia_id', 'Not set')}")
                print(f"      • Commesse Autorizzate: {store_assistant_user.get('commesse_autorizzate', [])}")
                
            else:
                # Create a Store Assistant user for testing
                print(f"   ⚠️ No Store Assistant user found, creating one for testing...")
                
                # Get first sub agenzia for assignment
                success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
                
                if success and status == 200:
                    sub_agenzie = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
                    
                    if sub_agenzie:
                        first_sub_agenzia = sub_agenzie[0]
                        sub_agenzia_id = first_sub_agenzia.get('id')
                        
                        # Create Store Assistant user
                        store_assistant_payload = {
                            "username": "test_store_assistant",
                            "email": "test.store.assistant@test.com",
                            "password": "admin123",
                            "role": "store_assist",
                            "sub_agenzia_id": sub_agenzia_id,
                            "commesse_autorizzate": first_sub_agenzia.get('commesse_autorizzate', [])
                        }
                        
                        success, create_response, status = self.make_request(
                            'POST', 'users', 
                            store_assistant_payload, 
                            expected_status=200
                        )
                        
                        if success and status == 200:
                            store_assistant_user = create_response
                            store_assistant_username = "test_store_assistant"
                            store_assistant_id = store_assistant_user.get('id')
                            
                            self.log_test("✅ Store Assistant user created", True, 
                                f"Username: {store_assistant_username}, ID: {store_assistant_id[:8]}...")
                        else:
                            self.log_test("❌ Failed to create Store Assistant user", False, f"Status: {status}")
                            return False
                    else:
                        self.log_test("❌ No sub agenzie found for Store Assistant creation", False, "Cannot create Store Assistant without sub agenzia")
                        return False
                else:
                    self.log_test("❌ Failed to get sub agenzie", False, f"Status: {status}")
                    return False
        else:
            self.log_test("❌ GET /api/users failed", False, f"Status: {status}")
            return False

        # **FASE 2: Test Login Store Assistant**
        print("\n🔐 FASE 2: TEST LOGIN STORE ASSISTANT...")
        
        success, login_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': store_assistant_username, 'password': 'admin123'}, 
            expected_status=200, auth_required=False
        )
        
        store_assistant_token = None
        
        if success and status == 200 and 'access_token' in login_response:
            store_assistant_token = login_response['access_token']
            store_assistant_user_data = login_response['user']
            
            self.log_test("✅ Store Assistant login SUCCESS", True, 
                f"Username: {store_assistant_username}, Token received")
                
            # Verify JWT token
            token_parts = store_assistant_token.split('.')
            if len(token_parts) == 3:
                self.log_test("✅ Store Assistant JWT token valid", True, f"Token has 3 parts (header.payload.signature)")
            else:
                self.log_test("❌ Store Assistant JWT token invalid", False, f"Token parts: {len(token_parts)}")
                
            print(f"   📊 STORE ASSISTANT LOGIN DATA:")
            print(f"      • Username: {store_assistant_user_data.get('username')}")
            print(f"      • Role: {store_assistant_user_data.get('role')}")
            print(f"      • Sub Agenzia ID: {store_assistant_user_data.get('sub_agenzia_id', 'Not set')}")
            print(f"      • Commesse Autorizzate: {len(store_assistant_user_data.get('commesse_autorizzate', []))} items")
            
        else:
            self.log_test("❌ Store Assistant login FAILED", False, f"Status: {status}, Response: {login_response}")
            return False

        # **FASE 3: Test Endpoint Filter Options come Store Assistant**
        print("\n🔍 FASE 3: TEST ENDPOINT FILTER OPTIONS COME STORE ASSISTANT...")
        
        # Switch to Store Assistant token
        self.token = store_assistant_token
        
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        print(f"   📋 TESTING GET /api/clienti/filter-options with Store Assistant token...")
        print(f"   🎯 VERIFICA STATUS CODE:")
        
        if status == 401:
            self.log_test("❌ GET /api/clienti/filter-options UNAUTHORIZED (401)", False, 
                "Store Assistant token rejected - problema permessi endpoint")
            print(f"   🚨 ROOT CAUSE: Store Assistant non ha permessi per accedere all'endpoint filter-options")
            return False
            
        elif status == 403:
            self.log_test("❌ GET /api/clienti/filter-options FORBIDDEN (403)", False, 
                "Store Assistant access denied - problema permessi endpoint")
            print(f"   🚨 ROOT CAUSE: Store Assistant ha token valido ma non autorizzato per filter-options")
            return False
            
        elif status == 500:
            self.log_test("❌ GET /api/clienti/filter-options SERVER ERROR (500)", False, 
                "Errore backend durante filter-options")
            print(f"   🚨 ROOT CAUSE: Errore interno del server durante elaborazione filter-options")
            print(f"   📋 Response: {filter_response}")
            return False
            
        elif status == 200:
            self.log_test("✅ GET /api/clienti/filter-options SUCCESS (200)", True, 
                "Store Assistant può accedere all'endpoint")
                
            # Verify response structure
            if isinstance(filter_response, dict):
                tipologie_contratto = filter_response.get('tipologie_contratto', [])
                sub_agenzie = filter_response.get('sub_agenzie', [])
                users = filter_response.get('users', [])
                
                print(f"   📊 FILTER OPTIONS RESPONSE STRUCTURE:")
                print(f"      • tipologie_contratto: {len(tipologie_contratto)} items")
                print(f"      • sub_agenzie: {len(sub_agenzie)} items")
                print(f"      • users: {len(users)} items")
                
                # CRITICAL CHECK: Tipologie contratto field
                if 'tipologie_contratto' in filter_response:
                    self.log_test("✅ Campo 'tipologie_contratto' presente nella risposta", True, 
                        f"Found {len(tipologie_contratto)} tipologie")
                        
                    if len(tipologie_contratto) > 0:
                        self.log_test("✅ Tipologie contratto NON vuote", True, 
                            f"Store Assistant vede {len(tipologie_contratto)} tipologie")
                            
                        # Show first few tipologie
                        print(f"   📋 TIPOLOGIE CONTRATTO VISIBILI A STORE ASSISTANT:")
                        for i, tipologia in enumerate(tipologie_contratto[:5], 1):
                            if isinstance(tipologia, dict):
                                value = tipologia.get('value', 'No value')
                                label = tipologia.get('label', 'No label')
                                print(f"      {i}. {label} (value: {value})")
                            else:
                                print(f"      {i}. {tipologia}")
                                
                    else:
                        self.log_test("❌ Tipologie contratto VUOTE", False, 
                            "Store Assistant non vede nessuna tipologia - QUESTO È IL PROBLEMA!")
                        print(f"   🚨 CRITICAL ISSUE: Store Assistant riceve array vuoto per tipologie_contratto")
                        
                else:
                    self.log_test("❌ Campo 'tipologie_contratto' ASSENTE", False, 
                        "Campo tipologie_contratto mancante nella risposta")
                    print(f"   🚨 CRITICAL ISSUE: Campo tipologie_contratto non presente nella risposta")
                    
            else:
                self.log_test("❌ Filter options response non è dict", False, 
                    f"Response type: {type(filter_response)}")
                    
        else:
            self.log_test("❌ GET /api/clienti/filter-options UNEXPECTED ERROR", False, 
                f"Status: {status}, Response: {filter_response}")
            return False

        # **FASE 4: Verifica Clienti Store Assistant**
        print("\n👥 FASE 4: VERIFICA CLIENTI STORE ASSISTANT...")
        
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and status == 200:
            clienti = clienti_response if isinstance(clienti_response, list) else []
            clienti_count = len(clienti)
            
            self.log_test("✅ GET /api/clienti SUCCESS", True, 
                f"Store Assistant vede {clienti_count} clienti")
                
            if clienti_count > 0:
                # Extract tipologie_contratto from clienti
                clienti_tipologie = set()
                for cliente in clienti:
                    tipologia = cliente.get('tipologia_contratto')
                    if tipologia:
                        clienti_tipologie.add(tipologia)
                
                clienti_tipologie_list = list(clienti_tipologie)
                
                print(f"   📊 ANALISI CLIENTI STORE ASSISTANT:")
                print(f"      • Total clienti: {clienti_count}")
                print(f"      • Unique tipologie_contratto nei clienti: {len(clienti_tipologie_list)}")
                
                if clienti_tipologie_list:
                    print(f"   📋 TIPOLOGIE NEI CLIENTI STORE ASSISTANT:")
                    for i, tipologia in enumerate(clienti_tipologie_list, 1):
                        print(f"      {i}. {tipologia}")
                        
                    self.log_test("✅ Clienti Store Assistant hanno tipologie", True, 
                        f"Found {len(clienti_tipologie_list)} unique tipologie in clienti")
                        
                    # CRITICAL COMPARISON: Filter vs Clienti tipologie
                    if 'tipologie_contratto' in locals() and len(tipologie_contratto) > 0:
                        filter_tipologie_values = []
                        for tip in tipologie_contratto:
                            if isinstance(tip, dict):
                                filter_tipologie_values.append(tip.get('value', ''))
                            else:
                                filter_tipologie_values.append(str(tip))
                        
                        # Compare filter tipologie with clienti tipologie
                        matching_tipologie = set(filter_tipologie_values) & clienti_tipologie
                        missing_in_filter = clienti_tipologie - set(filter_tipologie_values)
                        extra_in_filter = set(filter_tipologie_values) - clienti_tipologie
                        
                        print(f"   🔍 CONFRONTO FILTER vs CLIENTI TIPOLOGIE:")
                        print(f"      • Tipologie in filter: {len(filter_tipologie_values)}")
                        print(f"      • Tipologie in clienti: {len(clienti_tipologie_list)}")
                        print(f"      • Matching tipologie: {len(matching_tipologie)}")
                        print(f"      • Missing in filter: {len(missing_in_filter)}")
                        print(f"      • Extra in filter: {len(extra_in_filter)}")
                        
                        if len(matching_tipologie) == len(clienti_tipologie_list):
                            self.log_test("✅ Filter tipologie match clienti tipologie", True, 
                                "Perfect correspondence between filter and clienti")
                        else:
                            self.log_test("❌ Filter tipologie DON'T match clienti tipologie", False, 
                                f"Missing: {missing_in_filter}, Extra: {extra_in_filter}")
                            print(f"   🚨 MISMATCH DETAILS:")
                            if missing_in_filter:
                                print(f"      • Tipologie nei clienti ma NON nel filter: {list(missing_in_filter)}")
                            if extra_in_filter:
                                print(f"      • Tipologie nel filter ma NON nei clienti: {list(extra_in_filter)}")
                    else:
                        self.log_test("❌ Cannot compare - filter tipologie empty", False, 
                            "Filter returned empty tipologie but clienti have tipologie")
                        
                else:
                    self.log_test("⚠️ Clienti Store Assistant senza tipologie", True, 
                        "Clienti esistono ma nessuno ha tipologia_contratto impostata")
                    
            else:
                self.log_test("⚠️ Store Assistant non vede clienti", True, 
                    "Store Assistant ha 0 clienti - potrebbe spiegare perché filter è vuoto")
                print(f"   🤔 ANALYSIS: Se Store Assistant non ha clienti, il filter potrebbe essere vuoto per design")
                
        else:
            self.log_test("❌ GET /api/clienti FAILED", False, f"Status: {status}")
            return False

        # **FASE 5: Debug Logica Backend**
        print("\n🔍 FASE 5: DEBUG LOGICA BACKEND...")
        print("   📋 Controllare nei log backend durante GET /api/clienti/filter-options:")
        print("      • '🔄 Loading tipologie for filter-options' con user Store Assistant")
        print("      • 'Tipologie from user's clients: X'")
        print("      • 'Showing X tipologie from user's accessible clients'")
        
        # Make another filter-options request to generate fresh logs
        print(f"   🔄 Making additional filter-options request to generate logs...")
        success, debug_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        if success:
            self.log_test("✅ Additional filter-options request for logging", True, 
                f"Status: {status} - Check backend logs for debug messages")
        else:
            self.log_test("❌ Additional filter-options request failed", False, f"Status: {status}")

        # **FASE 6: Confronto Admin vs Store Assistant**
        print("\n⚖️ FASE 6: CONFRONTO ADMIN VS STORE ASSISTANT...")
        
        # Switch back to admin token
        self.token = admin_token
        
        success, admin_filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        if success and status == 200:
            admin_tipologie = admin_filter_response.get('tipologie_contratto', [])
            
            self.log_test("✅ Admin filter-options SUCCESS", True, 
                f"Admin vede {len(admin_tipologie)} tipologie")
                
            # Get admin clienti for comparison
            success, admin_clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
            
            if success:
                admin_clienti = admin_clienti_response if isinstance(admin_clienti_response, list) else []
                
                print(f"   📊 CONFRONTO ADMIN vs STORE ASSISTANT:")
                print(f"      • Admin clienti: {len(admin_clienti)}")
                print(f"      • Store Assistant clienti: {clienti_count if 'clienti_count' in locals() else 0}")
                print(f"      • Admin filter tipologie: {len(admin_tipologie)}")
                print(f"      • Store Assistant filter tipologie: {len(tipologie_contratto) if 'tipologie_contratto' in locals() else 0}")
                
                # Identify differences
                admin_tipologie_values = []
                for tip in admin_tipologie:
                    if isinstance(tip, dict):
                        admin_tipologie_values.append(tip.get('value', ''))
                    else:
                        admin_tipologie_values.append(str(tip))
                
                store_tipologie_values = []
                if 'tipologie_contratto' in locals():
                    for tip in tipologie_contratto:
                        if isinstance(tip, dict):
                            store_tipologie_values.append(tip.get('value', ''))
                        else:
                            store_tipologie_values.append(str(tip))
                
                admin_only = set(admin_tipologie_values) - set(store_tipologie_values)
                store_only = set(store_tipologie_values) - set(admin_tipologie_values)
                common = set(admin_tipologie_values) & set(store_tipologie_values)
                
                print(f"   🔍 DIFFERENZE SPECIFICHE:")
                print(f"      • Tipologie solo Admin: {len(admin_only)} - {list(admin_only)[:3]}{'...' if len(admin_only) > 3 else ''}")
                print(f"      • Tipologie solo Store Assistant: {len(store_only)} - {list(store_only)[:3]}{'...' if len(store_only) > 3 else ''}")
                print(f"      • Tipologie comuni: {len(common)} - {list(common)[:3]}{'...' if len(common) > 3 else ''}")
                
                if len(admin_tipologie) > 0 and len(store_tipologie_values) == 0:
                    self.log_test("🚨 CRITICAL FINDING", False, 
                        "Admin vede tipologie ma Store Assistant NO - Problema di autorizzazioni!")
                elif len(admin_tipologie) == len(store_tipologie_values):
                    self.log_test("✅ Same tipologie count", True, 
                        "Admin e Store Assistant vedono stesso numero di tipologie")
                else:
                    self.log_test("⚠️ Different tipologie count", True, 
                        f"Admin: {len(admin_tipologie)}, Store Assistant: {len(store_tipologie_values)}")
                        
        else:
            self.log_test("❌ Admin filter-options failed", False, f"Status: {status}")

        # **FINAL DIAGNOSIS**
        total_time = time.time() - start_time
        
        print(f"\n🎯 DIAGNOSI FINALE STORE ASSISTANT TIPOLOGIA CONTRATTO BUG:")
        print(f"   🎯 OBIETTIVO: Identificare esattamente perché Store Assistant non vede le tipologie contratto nel filtro")
        print(f"   📊 RISULTATI DIAGNOSI (Total time: {total_time:.2f}s):")
        
        # Determine the root cause based on findings
        if store_assistant_token is None:
            root_cause = "Store Assistant login failed - credenziali o utente non esistente"
            severity = "CRITICAL"
        elif status != 200:
            root_cause = f"Store Assistant non può accedere a filter-options endpoint (Status: {status})"
            severity = "CRITICAL"
        elif 'tipologie_contratto' not in locals() or len(tipologie_contratto) == 0:
            if 'clienti_count' in locals() and clienti_count == 0:
                root_cause = "Store Assistant non ha clienti accessibili - filter vuoto per design"
                severity = "MEDIUM"
            else:
                root_cause = "Store Assistant ha clienti ma filter-options non restituisce tipologie"
                severity = "HIGH"
        else:
            root_cause = "Store Assistant vede tipologie ma potrebbero non essere corrette"
            severity = "LOW"
        
        print(f"      • Store Assistant user: {'✅ FOUND/CREATED' if store_assistant_user else '❌ NOT FOUND'}")
        print(f"      • Store Assistant login: {'✅ SUCCESS' if store_assistant_token else '❌ FAILED'}")
        print(f"      • Filter-options access: {'✅ SUCCESS (200)' if status == 200 else f'❌ FAILED ({status})'}")
        print(f"      • Tipologie in response: {'✅ PRESENT' if 'tipologie_contratto' in locals() and len(tipologie_contratto) > 0 else '❌ EMPTY/MISSING'}")
        print(f"      • Store Assistant clienti: {clienti_count if 'clienti_count' in locals() else 0}")
        print(f"      • Admin comparison: {'✅ COMPLETED' if 'admin_tipologie' in locals() else '❌ FAILED'}")
        
        print(f"\n   🚨 ROOT CAUSE ANALYSIS:")
        print(f"      • Severity: {severity}")
        print(f"      • Root Cause: {root_cause}")
        
        # Provide specific recommendations
        print(f"\n   🔧 RACCOMANDAZIONI SPECIFICHE:")
        
        if severity == "CRITICAL":
            print(f"      1. 🚨 PRIORITY HIGH: Fix Store Assistant access to filter-options endpoint")
            print(f"      2. Verify Store Assistant role permissions in backend authorization logic")
            print(f"      3. Check if Store Assistant is included in allowed roles for filter-options")
            
        elif severity == "HIGH":
            print(f"      1. 🔍 Debug backend filter logic for Store Assistant role")
            print(f"      2. Check if Store Assistant clienti are being filtered correctly")
            print(f"      3. Verify tipologie extraction from Store Assistant's accessible clienti")
            print(f"      4. Compare backend logs between Admin and Store Assistant requests")
            
        elif severity == "MEDIUM":
            print(f"      1. ℹ️ Verify if Store Assistant should have access to clienti")
            print(f"      2. Check Store Assistant sub_agenzia_id and commesse_autorizzate assignment")
            print(f"      3. Ensure Store Assistant has proper authorization to view clienti")
            
        else:
            print(f"      1. ✅ Store Assistant filter appears to be working")
            print(f"      2. Verify with user if the tipologie shown are correct")
            print(f"      3. Check if there are specific tipologie missing")
        
        # CRITICAL QUESTIONS ANSWERED
        print(f"\n   ❓ DOMANDE CRITICHE RISPOSTE:")
        print(f"      ❓ Store Assistant ha accesso all'endpoint /api/clienti/filter-options? {'✅ SÌ' if status == 200 else '❌ NO'}")
        print(f"      ❓ Store Assistant riceve risposta 200 o errore? {'✅ 200 OK' if status == 200 else f'❌ {status}'}")
        print(f"      ❓ Store Assistant ha clienti nel sistema? {'✅ SÌ' if 'clienti_count' in locals() and clienti_count > 0 else '❌ NO'} ({clienti_count if 'clienti_count' in locals() else 0} clienti)")
        print(f"      ❓ Le tipologie dei clienti Store Assistant vengono estratte correttamente? {'✅ SÌ' if 'tipologie_contratto' in locals() and len(tipologie_contratto) > 0 else '❌ NO'}")
        print(f"      ❓ C'è un problema di permessi specifico per questo ruolo? {'❌ SÌ' if status != 200 else '✅ NO'}")
        
        # Success determination
        if status == 200 and 'tipologie_contratto' in locals() and len(tipologie_contratto) > 0:
            print(f"\n   🎉 FINDING: Store Assistant filter-options FUNZIONA!")
            print(f"   🤔 ANALYSIS: Se l'endpoint funziona, il problema potrebbe essere nel frontend")
            success_result = True
        else:
            print(f"\n   🚨 FINDING: Store Assistant filter-options NON FUNZIONA!")
            print(f"   🔧 ACTION REQUIRED: Fix backend authorization or logic for Store Assistant")
            success_result = False
        
        return success_result

if __name__ == "__main__":
    tester = StoreAssistantTester()
    
    print("🎯 RUNNING STORE ASSISTANT TIPOLOGIA CONTRATTO BUG TEST")
    print(f"🌐 Base URL: {tester.base_url}")
    print("=" * 80)
    
    try:
        result = tester.test_store_assistant_tipologia_contratto_bug_urgent()
        
        # Print summary
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 STORE ASSISTANT TIPOLOGIA CONTRATTO BUG TEST SUCCESSFUL!")
        else:
            print("❌ STORE ASSISTANT TIPOLOGIA CONTRATTO BUG TEST FAILED!")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    exit(0 if result else 1)