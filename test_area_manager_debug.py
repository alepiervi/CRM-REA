#!/usr/bin/env python3
"""
Area Manager Dropdown Debug Test - Urgent debugging for real user issue
"""

import requests
import sys
import json
from datetime import datetime

class AreaManagerDebugTester:
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

    def test_area_manager_dropdown_debug_urgent(self):
        """🚨 AREA MANAGER DROPDOWN VUOTO - Debug urgente utente reale"""
        print("\n🚨 AREA MANAGER DROPDOWN VUOTO - Debug urgente utente reale")
        print("🎯 OBIETTIVO: Identificare perché l'utente reale Area Manager vede dropdown commesse vuoto nonostante i test mostrino funzionante")
        print("🎯 URGENT DEBUGGING:")
        print("   1. VERIFICA AREA MANAGER SPECIFICO: Login test_area_manager_clienti/admin123")
        print("   2. GET /api/auth/me - verificare commesse_autorizzate e sub_agenzie_autorizzate")
        print("   3. TEST ENDPOINT CASCADING REAL USER: GET /api/cascade/sub-agenzie con token Area Manager")
        print("   4. GET /api/cascade/commesse-by-subagenzia per ogni sub agenzia")
        print("   5. VERIFICA CONFIGURAZIONE SUB AGENZIE: Verificare che le sub agenzie assegnate abbiano commesse_autorizzate non vuote")
        print("   6. COMPARISON TEST: Testare stesso flusso con admin per confermare che funziona")
        
        # **STEP 1: VERIFICA AREA MANAGER SPECIFICO**
        print("\n🔐 STEP 1: VERIFICA AREA MANAGER SPECIFICO...")
        print("   🎯 CRITICO: Login test_area_manager_clienti/admin123")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'test_area_manager_clienti', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            user_role = self.user_data.get('role')
            user_id = self.user_data.get('id')
            username = self.user_data.get('username')
            
            self.log_test("✅ AREA MANAGER LOGIN (test_area_manager_clienti/admin123)", True, 
                f"Role: {user_role}, Username: {username}")
            
            if user_role != 'area_manager':
                self.log_test("❌ ROLE VERIFICATION FAILED", False, f"Expected: area_manager, Got: {user_role}")
                return False
                
        else:
            self.log_test("❌ AREA MANAGER LOGIN FAILED", False, f"Status: {status}, Response: {response}")
            return False

        # **STEP 2: GET /api/auth/me - VERIFICA CRITICA**
        print("\n🔍 STEP 2: GET /api/auth/me - VERIFICA CRITICA...")
        print("   🎯 CRITICO: Verificare commesse_autorizzate e sub_agenzie_autorizzate")
        
        success, auth_me_response, status = self.make_request('GET', 'auth/me', expected_status=200)
        
        if success and status == 200:
            self.log_test("✅ GET /api/auth/me SUCCESS", True, f"Status: {status}")
            
            # Extract critical data
            commesse_autorizzate = auth_me_response.get('commesse_autorizzate', [])
            sub_agenzie_autorizzate = auth_me_response.get('sub_agenzie_autorizzate', [])
            
            print(f"\n   📋 CRITICAL VERIFICATION - GET /api/auth/me:")
            print(f"      • Username: {auth_me_response.get('username')}")
            print(f"      • Role: {auth_me_response.get('role')}")
            print(f"      • Sub Agenzie Autorizzate: {len(sub_agenzie_autorizzate)} items")
            print(f"      • Commesse Autorizzate: {len(commesse_autorizzate)} items")
            print(f"      • Sub Agenzie IDs: {sub_agenzie_autorizzate}")
            print(f"      • Commesse IDs: {commesse_autorizzate}")
            
            # CRITICAL QUESTIONS ANSWERED
            if len(sub_agenzie_autorizzate) > 0:
                self.log_test("✅ CRITICAL: Area Manager ha sub_agenzie_autorizzate popolate", True, 
                    f"Sub agenzie: {len(sub_agenzie_autorizzate)} items")
            else:
                self.log_test("❌ CRITICAL: Area Manager ha sub_agenzie_autorizzate VUOTE", False, 
                    "Questo spiega perché dropdown è vuoto!")
                
            if len(commesse_autorizzate) > 0:
                self.log_test("✅ CRITICAL: Area Manager ha commesse_autorizzate popolate", True, 
                    f"Commesse: {len(commesse_autorizzate)} items")
            else:
                self.log_test("❌ CRITICAL: Area Manager ha commesse_autorizzate VUOTE", False, 
                    "Questo potrebbe spiegare perché dropdown è vuoto!")
                
        else:
            self.log_test("❌ GET /api/auth/me FAILED", False, f"Status: {status}, Response: {auth_me_response}")
            return False

        # **STEP 3: TEST ENDPOINT CASCADING REAL USER**
        print("\n🔗 STEP 3: TEST ENDPOINT CASCADING REAL USER...")
        print("   🎯 CRITICO: GET /api/cascade/sub-agenzie con token Area Manager")
        
        success, cascade_response, status = self.make_request('GET', 'cascade/sub-agenzie', expected_status=200)
        
        if success and status == 200:
            self.log_test("✅ GET /api/cascade/sub-agenzie SUCCESS", True, f"Status: {status}")
            
            if isinstance(cascade_response, list):
                sub_agenzie_count = len(cascade_response)
                self.log_test("✅ CASCADE SUB AGENZIE RESPONSE", True, f"Found {sub_agenzie_count} sub agenzie")
                
                print(f"\n   📋 CASCADE SUB AGENZIE DETAILS:")
                for i, sub_agenzia in enumerate(cascade_response):
                    sub_agenzia_id = sub_agenzia.get('id')
                    sub_agenzia_nome = sub_agenzia.get('nome')
                    print(f"      {i+1}. {sub_agenzia_nome} (ID: {sub_agenzia_id})")
                
                if sub_agenzie_count == 0:
                    self.log_test("❌ CRITICAL: CASCADE SUB AGENZIE VUOTO", False, 
                        "Area Manager non vede sub agenzie nel cascading - ROOT CAUSE!")
                    
            else:
                self.log_test("❌ CASCADE SUB AGENZIE INVALID RESPONSE", False, f"Response type: {type(cascade_response)}")
                
        else:
            self.log_test("❌ GET /api/cascade/sub-agenzie FAILED", False, f"Status: {status}, Response: {cascade_response}")

        # **STEP 4: GET /api/cascade/commesse-by-subagenzia per ogni sub agenzia**
        print("\n🔗 STEP 4: TEST COMMESSE BY SUB AGENZIA...")
        print("   🎯 CRITICO: GET /api/cascade/commesse-by-subagenzia per ogni sub agenzia")
        
        if success and isinstance(cascade_response, list) and len(cascade_response) > 0:
            for sub_agenzia in cascade_response:
                sub_agenzia_id = sub_agenzia.get('id')
                sub_agenzia_nome = sub_agenzia.get('nome')
                
                print(f"\n   Testing commesse for {sub_agenzia_nome}...")
                
                success_commesse, commesse_response, status = self.make_request(
                    'GET', f'cascade/commesse-by-subagenzia/{sub_agenzia_id}', expected_status=200)
                
                if success_commesse and status == 200:
                    if isinstance(commesse_response, list):
                        commesse_count = len(commesse_response)
                        self.log_test(f"✅ COMMESSE for {sub_agenzia_nome}", True, f"Found {commesse_count} commesse")
                        
                        if commesse_count == 0:
                            self.log_test(f"❌ CRITICAL: {sub_agenzia_nome} ha 0 commesse", False, 
                                "Sub agenzia senza commesse - spiega dropdown vuoto!")
                        else:
                            print(f"      📋 Commesse for {sub_agenzia_nome}:")
                            for commessa in commesse_response:
                                commessa_nome = commessa.get('nome')
                                commessa_id = commessa.get('id')
                                print(f"         • {commessa_nome} (ID: {commessa_id})")
                    else:
                        self.log_test(f"❌ COMMESSE RESPONSE INVALID for {sub_agenzia_nome}", False, 
                            f"Response type: {type(commesse_response)}")
                else:
                    self.log_test(f"❌ COMMESSE REQUEST FAILED for {sub_agenzia_nome}", False, 
                        f"Status: {status}")
        else:
            print("   ⚠️ No sub agenzie to test commesse for")

        # **STEP 5: VERIFICA CONFIGURAZIONE SUB AGENZIE**
        print("\n🔍 STEP 5: VERIFICA CONFIGURAZIONE SUB AGENZIE...")
        print("   🎯 CRITICO: Verificare che le sub agenzie assegnate abbiano commesse_autorizzate non vuote")
        
        # Get all sub agenzie to check their configuration
        admin_token = self.token
        
        # Login as admin to check sub agenzie configuration
        success, admin_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in admin_response:
            self.token = admin_response['access_token']
            
            # Get sub agenzie list as admin
            success, sub_agenzie_list, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
            
            if success and isinstance(sub_agenzie_list, list):
                print(f"\n   📋 SUB AGENZIE CONFIGURATION CHECK:")
                
                # Check each sub agenzia assigned to Area Manager
                for sub_agenzia_id in sub_agenzie_autorizzate:
                    sub_agenzia = next((sa for sa in sub_agenzie_list if sa.get('id') == sub_agenzia_id), None)
                    
                    if sub_agenzia:
                        nome = sub_agenzia.get('nome')
                        commesse_autorizzate_sa = sub_agenzia.get('commesse_autorizzate', [])
                        
                        print(f"      • {nome}: {len(commesse_autorizzate_sa)} commesse autorizzate")
                        print(f"        Commesse IDs: {commesse_autorizzate_sa}")
                        
                        if len(commesse_autorizzate_sa) == 0:
                            self.log_test(f"❌ CRITICAL: {nome} ha commesse_autorizzate VUOTE", False, 
                                "Sub agenzia senza commesse autorizzate - ROOT CAUSE!")
                        else:
                            self.log_test(f"✅ {nome} ha commesse autorizzate", True, 
                                f"{len(commesse_autorizzate_sa)} commesse")
                    else:
                        self.log_test(f"❌ Sub agenzia {sub_agenzia_id} non trovata", False, 
                            "Sub agenzia assegnata ma non esistente!")
            
            # Restore Area Manager token
            self.token = admin_token
        else:
            print("   ⚠️ Could not login as admin to check sub agenzie configuration")

        # **STEP 6: COMPARISON TEST**
        print("\n🔄 STEP 6: COMPARISON TEST...")
        print("   🎯 CRITICO: Testare stesso flusso con admin per confermare che funziona")
        
        # Login as admin
        success, admin_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in admin_response:
            self.token = admin_response['access_token']
            
            # Test admin cascade endpoints
            success, admin_cascade, status = self.make_request('GET', 'cascade/sub-agenzie', expected_status=200)
            
            if success and isinstance(admin_cascade, list):
                admin_sub_agenzie_count = len(admin_cascade)
                self.log_test("✅ ADMIN CASCADE SUB AGENZIE", True, f"Admin sees {admin_sub_agenzie_count} sub agenzie")
                
                # Compare with Area Manager
                area_manager_count = len(cascade_response) if isinstance(cascade_response, list) else 0
                
                print(f"\n   📊 COMPARISON ADMIN vs AREA MANAGER:")
                print(f"      • Admin sub agenzie: {admin_sub_agenzie_count}")
                print(f"      • Area Manager sub agenzie: {area_manager_count}")
                
                if admin_sub_agenzie_count > area_manager_count:
                    self.log_test("✅ AUTHORIZATION FILTERING WORKING", True, 
                        "Area Manager sees subset of admin sub agenzie (correct)")
                elif admin_sub_agenzie_count == area_manager_count and area_manager_count > 0:
                    self.log_test("ℹ️ SAME COUNT", True, 
                        "Area Manager and Admin see same count (may be correct)")
                elif area_manager_count == 0:
                    self.log_test("❌ CRITICAL: Area Manager sees 0, Admin sees some", False, 
                        "Authorization issue - Area Manager should see at least some sub agenzie")
            
            # Restore Area Manager token for final tests
            self.token = admin_token

        # **CRITICAL QUESTIONS SUMMARY**
        print(f"\n🎯 CRITICAL QUESTIONS ANSWERED:")
        print(f"   1. L'Area Manager ha realmente commesse_autorizzate popolate? {'✅ YES' if len(commesse_autorizzate) > 0 else '❌ NO'} ({len(commesse_autorizzate)} commesse)")
        print(f"   2. Gli endpoint cascade ritornano dati o array vuoti? {'✅ DATA' if isinstance(cascade_response, list) and len(cascade_response) > 0 else '❌ EMPTY'}")
        print(f"   3. C'è un problema di autorizzazioni che impedisce l'accesso? {'❌ YES' if not success else '✅ NO'}")
        print(f"   4. Le sub agenzie hanno commesse_autorizzate configurate? {'⚠️ MIXED' if len(sub_agenzie_autorizzate) > 0 else '❌ NO SUB AGENZIE'}")
        
        # **ROOT CAUSE ANALYSIS**
        print(f"\n🔍 ROOT CAUSE ANALYSIS:")
        
        if len(sub_agenzie_autorizzate) == 0:
            print(f"   🚨 ROOT CAUSE: Area Manager ha sub_agenzie_autorizzate VUOTE")
            print(f"   🔧 FIX REQUIRED: Assegnare sub agenzie all'Area Manager")
            root_cause_identified = True
        elif len(commesse_autorizzate) == 0:
            print(f"   🚨 ROOT CAUSE: Area Manager ha commesse_autorizzate VUOTE")
            print(f"   🔧 FIX REQUIRED: Auto-popolare commesse dalle sub agenzie assegnate")
            root_cause_identified = True
        elif not isinstance(cascade_response, list) or len(cascade_response) == 0:
            print(f"   🚨 ROOT CAUSE: Endpoint cascade/sub-agenzie ritorna vuoto per Area Manager")
            print(f"   🔧 FIX REQUIRED: Verificare logica autorizzazioni in endpoint cascade")
            root_cause_identified = True
        else:
            print(f"   🤔 NO OBVIOUS BACKEND ISSUES: Tutti i dati sembrano popolati correttamente")
            print(f"   🔍 INVESTIGATE: Possibile problema nel frontend o nella logica di stato")
            root_cause_identified = False
        
        # **EXPECTED RESULT**
        print(f"\n🎯 EXPECTED RESULT: Identificare la causa esatta per cui dropdown è vuoto per utente reale Area Manager")
        
        if root_cause_identified:
            print(f"   ✅ SUCCESS: ROOT CAUSE IDENTIFICATA!")
            print(f"   🎯 NEXT STEPS: Implementare fix per risolvere il problema identificato")
            return True
        else:
            print(f"   ⚠️ PARTIAL SUCCESS: Dati backend sembrano corretti, investigare frontend")
            print(f"   🎯 NEXT STEPS: Verificare logica frontend e state management")
            return False

    def run_test(self):
        """Run the Area Manager dropdown debug test"""
        print("🚀 Starting Area Manager Dropdown Debug Test...")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)
        
        success = self.test_area_manager_dropdown_debug_urgent()
        
        # Print final results
        print("\n" + "=" * 80)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return success

if __name__ == "__main__":
    tester = AreaManagerDebugTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)