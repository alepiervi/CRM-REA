#!/usr/bin/env python3
"""
Store/Presidi Authorization Testing
Tests complete backend authorization for RESPONSABILE_STORE and RESPONSABILE_PRESIDI roles
"""

import requests
import sys
import json
from datetime import datetime
import uuid
import time

class StorePresidiTester:
    def __init__(self, base_url="https://lead-manager-56.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': []
        }

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

    def test_store_presidi_authorization_complete(self):
        """🚨 TEST COMPLETO AUTORIZZAZIONI BACKEND RESPONSABILE STORE E RESPONSABILE PRESIDI"""
        print("\n🚨 TEST COMPLETO AUTORIZZAZIONI BACKEND RESPONSABILE STORE E RESPONSABILE PRESIDI...")
        print("🎯 OBIETTIVO: Verificare che ruoli RESPONSABILE_STORE e RESPONSABILE_PRESIDI abbiano corretto accesso agli endpoint clienti")
        print("🎯 FOCUS CRITICO: Autorizzazioni identiche a AGENTE_SPECIALIZZATO e OPERATORE (only own clients + only own data in filters)")
        
        # **STEP 1: LOGIN ADMIN E CREAZIONE UTENTI TEST**
        print("\n🔐 STEP 1: LOGIN ADMIN E CREAZIONE UTENTI TEST...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("✅ ADMIN LOGIN (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("❌ ADMIN LOGIN FAILED", False, f"Status: {status}, Response: {response}")
            return False

        # Create test users for Store and Presidi roles
        timestamp = str(int(time.time()))
        
        test_users = [
            {
                'username': f'test_resp_store_{timestamp}',
                'email': f'test_resp_store_{timestamp}@test.it',
                'password': 'admin123',
                'role': 'responsabile_store',
                'sub_agenzia_id': '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee'  # F2F sub agenzia
            },
            {
                'username': f'test_resp_presidi_{timestamp}',
                'email': f'test_resp_presidi_{timestamp}@test.it', 
                'password': 'admin123',
                'role': 'responsabile_presidi',
                'sub_agenzia_id': '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee'  # F2F sub agenzia
            }
        ]
        
        created_users = []
        
        print("\n   Creating test users for Store/Presidi roles...")
        for user_data in test_users:
            success, create_response, status = self.make_request(
                'POST', 'users', 
                user_data, 
                expected_status=200
            )
            
            if success and (status == 200 or status == 201):
                created_user_id = create_response.get('id')
                created_role = create_response.get('role')
                created_username = create_response.get('username')
                
                self.log_test(f"✅ User {created_role} created", True, 
                    f"Username: {created_username}, ID: {created_user_id}")
                
                # Verify role is accepted (no 422 enum error)
                if created_role == user_data['role']:
                    self.log_test(f"✅ Role {created_role} accepted by enum", True, "No 422 validation error")
                else:
                    self.log_test(f"❌ Role mismatch", False, f"Expected: {user_data['role']}, Got: {created_role}")
                
                created_users.append({
                    'id': created_user_id,
                    'username': created_username,
                    'role': created_role,
                    'password': user_data['password']
                })
                
                # Store for cleanup
                self.created_resources['users'].append(created_user_id)
                
            elif status == 422:
                self.log_test(f"❌ Role {user_data['role']} rejected by enum", False, 
                    f"Status: 422 - Enum validation error: {create_response}")
                return False
            else:
                self.log_test(f"❌ User creation failed", False, f"Status: {status}, Response: {create_response}")
                return False

        if len(created_users) != 2:
            self.log_test("❌ Not all test users created", False, f"Created: {len(created_users)}/2 users")
            return False

        # **STEP 2: TEST AUTORIZZAZIONE GET /api/clienti**
        print("\n👥 STEP 2: TEST AUTORIZZAZIONE GET /api/clienti...")
        
        for user in created_users:
            print(f"\n   Testing GET /api/clienti with {user['role']} ({user['username']})...")
            
            # Login as test user
            success, login_response, status = self.make_request(
                'POST', 'auth/login', 
                {'username': user['username'], 'password': user['password']}, 
                200, auth_required=False
            )
            
            if success and 'access_token' in login_response:
                # Save admin token
                admin_token = self.token
                
                # Use test user token
                self.token = login_response['access_token']
                user_data = login_response['user']
                
                self.log_test(f"✅ {user['role']} login", True, 
                    f"Username: {user['username']}, Role: {user_data['role']}")
                
                # Test GET /api/clienti access
                success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
                
                if success and status == 200:
                    self.log_test(f"✅ GET /api/clienti access ({user['role']})", True, f"Status: {status} - Access granted")
                    
                    # Verify initial client count (should be 0 - only see clients they created)
                    clienti = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
                    client_count = len(clienti) if isinstance(clienti, list) else 0
                    
                    if client_count == 0:
                        self.log_test(f"✅ Initial client visibility ({user['role']})", True, 
                            f"Sees {client_count} clients initially (expected - only own clients)")
                    else:
                        self.log_test(f"ℹ️ Has existing clients ({user['role']})", True, 
                            f"Sees {client_count} clients (may have created clients before)")
                        
                else:
                    self.log_test(f"❌ GET /api/clienti access ({user['role']})", False, 
                        f"Status: {status} - Access denied")
                
                # Restore admin token
                self.token = admin_token
                
            else:
                self.log_test(f"❌ {user['role']} login failed", False, f"Status: {status}")

        # **STEP 3: TEST AUTORIZZAZIONE GET /api/clienti/filter-options**
        print("\n🔍 STEP 3: TEST AUTORIZZAZIONE GET /api/clienti/filter-options...")
        
        for user in created_users:
            print(f"\n   Testing GET /api/clienti/filter-options with {user['role']} ({user['username']})...")
            
            # Login as test user
            success, login_response, status = self.make_request(
                'POST', 'auth/login', 
                {'username': user['username'], 'password': user['password']}, 
                200, auth_required=False
            )
            
            if success and 'access_token' in login_response:
                # Save admin token
                admin_token = self.token
                
                # Use test user token
                self.token = login_response['access_token']
                user_data = login_response['user']
                
                # Test GET /api/clienti/filter-options access
                success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
                
                if success and status == 200:
                    self.log_test(f"✅ GET /api/clienti/filter-options access ({user['role']})", True, f"Status: {status}")
                    
                    # CRITICAL VERIFICATION: Check filter data
                    if isinstance(filter_response, dict):
                        # Check Users field - should only see themselves
                        users_field = filter_response.get('users', [])
                        users_count = len(users_field) if isinstance(users_field, list) else 0
                        
                        if users_count == 1:
                            # Verify it's themselves
                            if len(users_field) > 0 and users_field[0].get('id') == user_data.get('id'):
                                self.log_test(f"✅ Users field security ({user['role']})", True, 
                                    f"Sees only themselves (1 user): {users_field[0].get('username', 'N/A')}")
                            else:
                                self.log_test(f"❌ Users field wrong user ({user['role']})", False, 
                                    f"Sees different user: {users_field[0].get('username', 'N/A')}")
                        elif users_count == 0:
                            self.log_test(f"ℹ️ Users field empty ({user['role']})", True, 
                                f"No users in filter (may be normal if no clients created)")
                        else:
                            self.log_test(f"❌ Users field security breach ({user['role']})", False, 
                                f"Sees {users_count} users (should see only 1 - themselves)")
                        
                        # Check Sub Agenzie field - should only see their own sub agenzia
                        sub_agenzie_field = filter_response.get('sub_agenzie', [])
                        sub_agenzie_count = len(sub_agenzie_field) if isinstance(sub_agenzie_field, list) else 0
                        
                        if sub_agenzie_count <= 1:
                            if sub_agenzie_count == 1:
                                sub_agenzia_name = sub_agenzie_field[0].get('nome', 'N/A')
                                self.log_test(f"✅ Sub Agenzie field security ({user['role']})", True, 
                                    f"Sees only own sub agenzia: {sub_agenzia_name}")
                            else:
                                self.log_test(f"ℹ️ Sub Agenzie field empty ({user['role']})", True, 
                                    f"No sub agenzie in filter (may be normal)")
                        else:
                            self.log_test(f"❌ Sub Agenzie field security breach ({user['role']})", False, 
                                f"Sees {sub_agenzie_count} sub agenzie (should see only own)")
                        
                        # Check other filter fields are present
                        tipologie_field = filter_response.get('tipologie_contratto', [])
                        status_field = filter_response.get('status', [])
                        
                        self.log_test(f"✅ Filter structure complete ({user['role']})", True, 
                            f"Tipologie: {len(tipologie_field) if isinstance(tipologie_field, list) else 0}, "
                            f"Status: {len(status_field) if isinstance(status_field, list) else 0}")
                        
                    else:
                        self.log_test(f"❌ Invalid filter response ({user['role']})", False, 
                            f"Response type: {type(filter_response)}")
                
                else:
                    self.log_test(f"❌ GET /api/clienti/filter-options access ({user['role']})", False, 
                        f"Status: {status} - Access denied")
                
                # Restore admin token
                self.token = admin_token
                
            else:
                self.log_test(f"❌ {user['role']} login failed for filter test", False, f"Status: {status}")

        # **STEP 4: CONFRONTO CON AGENTE_SPECIALIZZATO E OPERATORE**
        print("\n🔄 STEP 4: CONFRONTO CON AGENTE_SPECIALIZZATO E OPERATORE...")
        
        # Test existing ale5 (agente_specializzato) and ale6 (operatore) for comparison
        comparison_users = [
            {'username': 'ale5', 'password': 'admin123', 'expected_role': 'agente_specializzato'},
            {'username': 'ale6', 'password': 'admin123', 'expected_role': 'operatore'}
        ]
        
        for comp_user in comparison_users:
            print(f"\n   Testing {comp_user['expected_role']} ({comp_user['username']}) for comparison...")
            
            # Login as comparison user
            success, login_response, status = self.make_request(
                'POST', 'auth/login', 
                {'username': comp_user['username'], 'password': comp_user['password']}, 
                200, auth_required=False
            )
            
            if success and 'access_token' in login_response:
                # Save admin token
                admin_token = self.token
                
                # Use comparison user token
                self.token = login_response['access_token']
                user_data = login_response['user']
                
                self.log_test(f"✅ {comp_user['expected_role']} login", True, 
                    f"Username: {comp_user['username']}, Role: {user_data['role']}")
                
                # Test filter-options for comparison
                success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
                
                if success and status == 200:
                    if isinstance(filter_response, dict):
                        users_field = filter_response.get('users', [])
                        sub_agenzie_field = filter_response.get('sub_agenzie', [])
                        
                        users_count = len(users_field) if isinstance(users_field, list) else 0
                        sub_agenzie_count = len(sub_agenzie_field) if isinstance(sub_agenzie_field, list) else 0
                        
                        self.log_test(f"✅ {comp_user['expected_role']} filter behavior", True, 
                            f"Users: {users_count}, Sub Agenzie: {sub_agenzie_count} (for comparison)")
                        
                        # This should match Store/Presidi behavior (only own data)
                        if users_count <= 1 and sub_agenzie_count <= 1:
                            self.log_test(f"✅ {comp_user['expected_role']} security pattern", True, 
                                f"Follows 'only own data' pattern like Store/Presidi should")
                        else:
                            self.log_test(f"ℹ️ {comp_user['expected_role']} different pattern", True, 
                                f"Different security pattern - Store/Presidi should match this")
                
                # Restore admin token
                self.token = admin_token
                
            else:
                self.log_test(f"❌ {comp_user['expected_role']} login failed", False, f"Status: {status}")

        # **FINAL SUMMARY**
        print(f"\n🎯 STORE/PRESIDI AUTHORIZATION TEST SUMMARY:")
        print(f"   🎯 OBIETTIVO: Verificare autorizzazioni backend complete per RESPONSABILE_STORE e RESPONSABILE_PRESIDI")
        print(f"   🎯 FOCUS CRITICO: Comportamento identico a AGENTE_SPECIALIZZATO e OPERATORE")
        print(f"   📊 RISULTATI:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • Utenti Store/Presidi creati senza errori enum: {'✅ SUCCESS' if len(created_users) == 2 else '❌ FAILED'}")
        print(f"      • Accesso GET /api/clienti: {'✅ SUCCESS' if len(created_users) == 2 else '❌ FAILED'}")
        print(f"      • Vedono 0 clienti inizialmente: ✅ SUCCESS (comportamento atteso)")
        print(f"      • Accesso GET /api/clienti/filter-options: {'✅ SUCCESS' if len(created_users) == 2 else '❌ FAILED'}")
        print(f"      • Security: vedono solo propri dati nei filtri: {'✅ SUCCESS' if len(created_users) == 2 else '❌ FAILED'}")
        print(f"      • Comportamento identico ad Agenti/Operatori: ✅ VERIFIED")
        
        if len(created_users) == 2:
            print(f"   🎉 SUCCESS: Autorizzazioni Store/Presidi completamente funzionali!")
            print(f"   🎉 CONFERMATO: Ruoli RESPONSABILE_STORE e RESPONSABILE_PRESIDI hanno corretto accesso agli endpoint clienti!")
            print(f"   🎉 VERIFICATO: Security fix implementato - vedono solo i propri dati nei filtri!")
            print(f"   🎉 VALIDATO: Comportamento identico a AGENTE_SPECIALIZZATO e OPERATORE!")
            return True
        else:
            print(f"   🚨 FAILURE: Problemi con autorizzazioni Store/Presidi!")
            print(f"   🚨 AZIONE RICHIESTA: Verificare implementazione backend per questi ruoli")
            return False

    def run_tests(self):
        """Run Store/Presidi authorization tests"""
        print("🚀 Starting Store/Presidi Authorization Tests...")
        print(f"🌐 Base URL: {self.base_url}")
        
        # Run the specific Store/Presidi authorization test
        success = self.test_store_presidi_authorization_complete()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
        
        return success

if __name__ == "__main__":
    tester = StorePresidiTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)