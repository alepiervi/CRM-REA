#!/usr/bin/env python3
"""
Test script for Responsabile Store debug issue
"""

import sys
import os
sys.path.append('/app')

from backend_test import CRMAPITester

def main():
    """Run the Responsabile Store debug test"""
    print("🎯 RUNNING SPECIFIC TEST: Responsabile Store Clienti Debug")
    print("🌐 Base URL: https://lead-manager-56.preview.emergentagent.com/api")
    print("=" * 80)
    
    tester = CRMAPITester()
    
    try:
        # Add the test method to the tester instance
        def test_responsabile_store_clienti_debug(self):
            """🚨 DEBUG RESPONSABILE STORE - CLIENTI NON VISIBILI"""
            print("\n🚨 DEBUG RESPONSABILE STORE - CLIENTI NON VISIBILI")
            print("🎯 OBIETTIVO: Identificare perché Responsabile Store ha tipologie nel filtro ma nessun cliente nella lista")
            
            # **FASE 1: Identifica Responsabile Store**
            print("\n📋 FASE 1: IDENTIFICA RESPONSABILE STORE")
            
            # 1. Login Admin
            print("\n🔐 1. Login Admin (admin/admin123)...")
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
                self.log_test("❌ Admin login failed", False, f"Status: {status}, Response: {response}")
                return False

            # 2. GET /api/users - trova utente con role = "responsabile_store"
            print("\n👥 2. GET /api/users - trova utente con role = 'responsabile_store'...")
            success, users_response, status = self.make_request('GET', 'users', expected_status=200)
            
            responsabile_store_user = None
            if success and status == 200:
                users = users_response if isinstance(users_response, list) else []
                self.log_test("✅ GET /api/users SUCCESS", True, f"Found {len(users)} total users")
                
                # Find responsabile_store users
                responsabile_store_users = [user for user in users if user.get('role') == 'responsabile_store']
                
                if responsabile_store_users:
                    responsabile_store_user = responsabile_store_users[0]  # Use first one
                    username = responsabile_store_user.get('username')
                    user_id = responsabile_store_user.get('id')
                    sub_agenzia_id = responsabile_store_user.get('sub_agenzia_id')
                    commesse_autorizzate = responsabile_store_user.get('commesse_autorizzate', [])
                    
                    self.log_test("✅ Found Responsabile Store user", True, 
                        f"Username: {username}, ID: {user_id[:8]}..., Sub Agenzia: {sub_agenzia_id[:8] if sub_agenzia_id else 'None'}...")
                    
                    print(f"   📊 RESPONSABILE STORE USER DETAILS:")
                    print(f"      • Username: {username}")
                    print(f"      • ID: {user_id}")
                    print(f"      • Sub Agenzia ID: {sub_agenzia_id}")
                    print(f"      • Commesse Autorizzate: {len(commesse_autorizzate)} items")
                    
                    if commesse_autorizzate:
                        print(f"      • Commesse IDs: {[c[:8] + '...' for c in commesse_autorizzate[:3]]}")
                    
                else:
                    self.log_test("❌ No Responsabile Store user found", False, "Cannot test without responsabile_store user")
                    print(f"   📊 AVAILABLE USER ROLES:")
                    role_counts = {}
                    for user in users:
                        role = user.get('role', 'unknown')
                        role_counts[role] = role_counts.get(role, 0) + 1
                    
                    for role, count in role_counts.items():
                        print(f"      • {role}: {count} users")
                    
                    return False
            else:
                self.log_test("❌ GET /api/users failed", False, f"Status: {status}")
                return False

            # **FASE 2: Test Responsabile Store - Clienti**
            print("\n📋 FASE 2: TEST RESPONSABILE STORE - CLIENTI")
            
            # 4. Login come Responsabile Store
            print(f"\n🔐 4. Login come Responsabile Store ({username}/admin123)...")
            success, resp_store_response, status = self.make_request(
                'POST', 'auth/login', 
                {'username': username, 'password': 'admin123'}, 
                200, auth_required=False
            )
            
            if success and 'access_token' in resp_store_response:
                # Switch to responsabile_store token
                admin_token = self.token  # Save admin token
                self.token = resp_store_response['access_token']
                resp_store_user_data = resp_store_response['user']
                
                self.log_test(f"✅ Responsabile Store login ({username}/admin123)", True, 
                    f"Token received, Role: {resp_store_user_data['role']}")
            else:
                self.log_test(f"❌ Responsabile Store login failed", False, f"Status: {status}, Response: {resp_store_response}")
                return False

            # 5. GET /api/clienti
            print(f"\n👥 5. GET /api/clienti (as Responsabile Store)...")
            success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
            
            clienti_count = 0
            if success and status == 200:
                clienti = clienti_response if isinstance(clienti_response, list) else []
                clienti_count = len(clienti)
                
                self.log_test("✅ GET /api/clienti SUCCESS", True, f"Status: 200, Found {clienti_count} clienti")
                
                if clienti_count > 0:
                    print(f"   📊 CLIENTI FOUND BY RESPONSABILE STORE:")
                    for i, cliente in enumerate(clienti[:5], 1):  # Show first 5
                        nome = cliente.get('nome', 'Unknown')
                        cognome = cliente.get('cognome', 'Unknown')
                        tipologia = cliente.get('tipologia_contratto', 'Unknown')
                        created_by = cliente.get('created_by', 'Unknown')
                        print(f"      {i}. {nome} {cognome} - Tipologia: {tipologia} - Created by: {created_by[:8]}...")
                        
                    # Extract unique tipologie from clienti
                    tipologie_from_clienti = list(set([c.get('tipologia_contratto') for c in clienti if c.get('tipologia_contratto')]))
                    print(f"   📊 TIPOLOGIE FROM CLIENTI: {len(tipologie_from_clienti)} unique")
                    for tip in tipologie_from_clienti:
                        print(f"      • {tip}")
                        
                else:
                    self.log_test("🚨 CRITICAL ISSUE", False, "Responsabile Store sees 0 clienti but should see some if has tipologie")
                    print(f"   🚨 BUG CONFIRMED: Lista clienti è VUOTA per Responsabile Store")
                    
            else:
                self.log_test("❌ GET /api/clienti FAILED", False, f"Status: {status}, Response: {clienti_response}")
                return False

            # **FASE 3: Test Responsabile Store - Filter Options**
            print("\n📋 FASE 3: TEST RESPONSABILE STORE - FILTER OPTIONS")
            
            # 8. GET /api/clienti/filter-options con token Responsabile Store
            print(f"\n🔍 8. GET /api/clienti/filter-options (as Responsabile Store)...")
            success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
            
            tipologie_count = 0
            if success and status == 200:
                tipologie_contratto = filter_response.get('tipologie_contratto', [])
                tipologie_count = len(tipologie_contratto)
                
                self.log_test("✅ GET /api/clienti/filter-options SUCCESS", True, f"Status: 200, Found {tipologie_count} tipologie")
                
                if tipologie_count > 0:
                    print(f"   📊 TIPOLOGIE FROM FILTER:")
                    for i, tip in enumerate(tipologie_contratto, 1):
                        if isinstance(tip, dict):
                            value = tip.get('value', 'Unknown')
                            label = tip.get('label', 'Unknown')
                            print(f"      {i}. {value} (label: {label})")
                        else:
                            # If it's just a string/UUID, show it directly
                            print(f"      {i}. {tip}")
                        
                    self.log_test("✅ Filter options populated", True, f"Responsabile Store sees {tipologie_count} tipologie in filter")
                    
                    # Check if we're seeing UUIDs instead of readable values
                    if tipologie_count > 0:
                        first_tip = tipologie_contratto[0]
                        if isinstance(first_tip, str) and len(first_tip) == 36 and '-' in first_tip:
                            self.log_test("🚨 CRITICAL ISSUE - UUID VALUES", False, 
                                f"Filter shows {tipologie_count} UUID values instead of readable tipologie names!")
                            print(f"   🚨 BUG IDENTIFIED: Filter returns UUID values instead of human-readable tipologie")
                            print(f"   🚨 EXPECTED: Values like 'energia_fastweb', 'mobile_fastweb', etc.")
                            print(f"   🚨 ACTUAL: UUID values like '{first_tip}'")
                            
                else:
                    self.log_test("ℹ️ No tipologie in filter", True, "Filter options empty - consistent with empty clienti list")
                    
            else:
                self.log_test("❌ GET /api/clienti/filter-options FAILED", False, f"Status: {status}, Response: {filter_response}")
                return False

            # **FINAL DIAGNOSIS**
            print(f"\n🎯 DIAGNOSI FINALE - RESPONSABILE STORE CLIENTI DEBUG:")
            print(f"   🎯 OBIETTIVO: Identificare perché Responsabile Store ha tipologie nel filtro ma nessun cliente nella lista")
            print(f"   📊 RISULTATI DIAGNOSI:")
            print(f"      • Admin login: ✅ SUCCESS")
            print(f"      • Responsabile Store user found: ✅ SUCCESS ({username})")
            print(f"      • Responsabile Store login: ✅ SUCCESS")
            print(f"      • GET /api/clienti (Responsabile Store): {'✅ SUCCESS' if clienti_count >= 0 else '❌ FAILED'} ({clienti_count} clienti)")
            print(f"      • GET /api/clienti/filter-options: {'✅ SUCCESS' if tipologie_count >= 0 else '❌ FAILED'} ({tipologie_count} tipologie)")
            
            # Check for UUID issue
            uuid_issue = False
            if tipologie_count > 0:
                first_tip = tipologie_contratto[0]
                if isinstance(first_tip, str) and len(first_tip) == 36 and '-' in first_tip:
                    uuid_issue = True
            
            bug_confirmed = (tipologie_count > 0 and clienti_count == 0)
            
            if bug_confirmed or uuid_issue:
                print(f"   🚨 BUG CONFERMATO:")
                if uuid_issue:
                    print(f"      • ROOT CAUSE: Filter returns {tipologie_count} UUID values instead of readable tipologie names")
                    print(f"      • IMPACT: Frontend shows UUID values instead of human-readable options")
                    print(f"      • ADDITIONAL ISSUE: Responsabile Store vede tipologie UUID nel filtro ma lista clienti vuota")
                else:
                    print(f"      • ROOT CAUSE: Discrepanza tra query GET /api/clienti e GET /api/clienti/filter-options")
                    print(f"      • IMPACT: Responsabile Store vede tipologie nel filtro ma lista clienti vuota")
                print(f"      • SOLUTION REQUIRED: Fix filter-options to return proper tipologie format AND align queries")
                print(f"      • PRIORITY: HIGH - Funzionalità core non utilizzabile")
                
                # Specific recommendations
                print(f"   🔧 RACCOMANDAZIONI SPECIFICHE:")
                print(f"      1. Fix GET /api/clienti/filter-options to return {{value, label}} format instead of UUIDs")
                print(f"      2. Verificare query MongoDB in GET /api/clienti per role responsabile_store")
                print(f"      3. Verificare query MongoDB in GET /api/clienti/filter-options per role responsabile_store")
                print(f"      4. Assicurarsi che entrambe usino stessa logica $or per created_by/assigned_to")
                print(f"      5. Controllare se responsabile_store ha sub_agenzia_id popolato correttamente")
                
                diagnosis_success = False
            else:
                print(f"   ✅ COMPORTAMENTO COERENTE:")
                print(f"      • Nessuna discrepanza rilevata tra clienti e filter-options")
                print(f"      • Responsabile Store ha accesso coerente ai dati")
                print(f"      • Sistema funziona come previsto per questo ruolo")
                diagnosis_success = True
            
            # Restore admin token
            self.token = admin_token
            
            return diagnosis_success
        
        # Bind the method to the tester instance
        import types
        tester.test_responsabile_store_clienti_debug = types.MethodType(test_responsabile_store_clienti_debug, tester)
        
        # Run the test
        result = tester.test_responsabile_store_clienti_debug()
        
        # Print summary
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 RESPONSABILE STORE DEBUG SUCCESSFUL!")
        else:
            print("❌ RESPONSABILE STORE DEBUG FAILED!")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    return result

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)