#!/usr/bin/env python3
"""
Test immediato fix filtro Sub Agenzia per Responsabile Commessa
"""

import requests
import sys
import json

class SubAgenziaFilterTester:
    def __init__(self, base_url="https://agentify-6.preview.emergentagent.com/api"):
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

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def test_sub_agenzia_filter_fix(self):
        """🚨 TEST IMMEDIATO FIX FILTRO SUB AGENZIA - Responsabile Commessa"""
        print("\n🚨 TEST IMMEDIATO FIX FILTRO SUB AGENZIA - RESPONSABILE COMMESSA...")
        print("🎯 OBIETTIVO: Verificare che filtro Sub Agenzia ora si popola correttamente per Responsabile Commessa")
        print("🎯 FOCUS CRITICO: Campo query corretto da 'commessa_id' a 'commesse_autorizzate' alla riga 8956")
        print("🎯 SUCCESS CRITERIA:")
        print("   • GET /api/clienti/filter-options con ale ritorna sub_agenzie NON vuoto ✅")
        print("   • Array sub_agenzie contiene F2F con ID '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee' ✅")
        print("   • Altri filtri continuano a funzionare (tipologie, status, users) ✅")
        
        # **STEP 1: LOGIN RESPONSABILE COMMESSA (ale/admin123)**
        print("\n🔐 STEP 1: LOGIN RESPONSABILE COMMESSA (ale/admin123)...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'ale', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            user_role = self.user_data.get('role')
            commesse_autorizzate = self.user_data.get('commesse_autorizzate', [])
            
            self.log_test("✅ RESPONSABILE COMMESSA LOGIN (ale/admin123)", True, 
                f"Role: {user_role}, Commesse autorizzate: {len(commesse_autorizzate)}")
            
            # Verify user has Fastweb commessa
            fastweb_commessa_id = '4cb70f28-6278-4d0f-b2b7-65f2b783f3f1'
            if fastweb_commessa_id in commesse_autorizzate:
                self.log_test("✅ USER HAS FASTWEB COMMESSA", True, f"Fastweb commessa ID found in user's authorized commesse")
            else:
                self.log_test("❌ USER MISSING FASTWEB COMMESSA", False, f"Fastweb commessa ID not found. User commesse: {commesse_autorizzate}")
                
        else:
            self.log_test("❌ RESPONSABILE COMMESSA LOGIN FAILED", False, f"Status: {status}, Response: {response}")
            return False

        # **STEP 2: TEST ENDPOINT FILTER-OPTIONS**
        print("\n🔍 STEP 2: TEST ENDPOINT FILTER-OPTIONS...")
        print("   🎯 CRITICO: GET /api/clienti/filter-options deve ritornare Sub Agenzie nel campo sub_agenzie")
        
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        if success and status == 200:
            self.log_test("✅ GET /api/clienti/filter-options", True, f"Status: {status} - Endpoint accessible")
            
            # Verify response structure
            if isinstance(filter_response, dict):
                # Check for expected filter fields
                expected_fields = ['tipologie_contratto', 'status_values', 'segmenti', 'sub_agenzie', 'users']
                missing_fields = [field for field in expected_fields if field not in filter_response]
                
                if not missing_fields:
                    self.log_test("✅ FILTER RESPONSE STRUCTURE", True, f"All expected fields present: {expected_fields}")
                else:
                    self.log_test("❌ FILTER RESPONSE STRUCTURE", False, f"Missing fields: {missing_fields}")
                
                # **CRITICAL TEST: SUB AGENZIE FIELD**
                sub_agenzie = filter_response.get('sub_agenzie', [])
                
                print(f"\n   📊 SUB AGENZIE FILTER ANALYSIS:")
                print(f"      • Sub Agenzie count: {len(sub_agenzie)}")
                print(f"      • Sub Agenzie data: {sub_agenzie}")
                
                if len(sub_agenzie) > 0:
                    self.log_test("✅ SUB AGENZIE FILTER NOT EMPTY", True, f"Found {len(sub_agenzie)} sub agenzie options")
                    
                    # **CRITICAL VERIFICATION: F2F SUB AGENZIA**
                    f2f_found = False
                    f2f_expected_id = '7c70d4b5-4be0-4707-8bca-dfe84a0b9dee'
                    
                    for sub_agenzia in sub_agenzie:
                        if isinstance(sub_agenzia, dict):
                            sub_id = sub_agenzia.get('value', '')
                            sub_label = sub_agenzia.get('label', '')
                            
                            print(f"         - ID: {sub_id}, Label: {sub_label}")
                            
                            # Check for F2F by ID or name
                            if sub_id == f2f_expected_id or 'f2f' in sub_label.lower():
                                f2f_found = True
                                self.log_test("✅ F2F SUB AGENZIA FOUND", True, f"F2F found - ID: {sub_id}, Label: {sub_label}")
                                break
                    
                    if not f2f_found:
                        self.log_test("❌ F2F SUB AGENZIA NOT FOUND", False, f"F2F sub agenzia not found in filter options")
                        
                        # Additional diagnostic: check if any sub agenzia has the expected commessa
                        print(f"   🔍 DIAGNOSTIC: Checking sub agenzie for Fastweb commessa...")
                        for sub_agenzia in sub_agenzie:
                            if isinstance(sub_agenzia, dict):
                                print(f"      Sub Agenzia: {sub_agenzia.get('label', 'Unknown')} (ID: {sub_agenzia.get('value', 'Unknown')})")
                else:
                    self.log_test("❌ SUB AGENZIE FILTER EMPTY", False, "Sub Agenzie filter returned empty array - BUG NOT FIXED!")
                    f2f_found = False
                    
                    # **ROOT CAUSE ANALYSIS**
                    print(f"\n   🚨 ROOT CAUSE ANALYSIS:")
                    print(f"      • Expected: Sub Agenzie filter populated with F2F")
                    print(f"      • Actual: Empty array []")
                    print(f"      • Probable cause: Backend still using wrong field name 'commessa_id' instead of 'commesse_autorizzate'")
                    print(f"      • Fix location: server.py line ~8956")
                
                # **TEST OTHER FILTERS STILL WORKING**
                print(f"\n   🔍 VERIFYING OTHER FILTERS STILL WORK...")
                
                # Test tipologie_contratto
                tipologie = filter_response.get('tipologie_contratto', [])
                if len(tipologie) > 0:
                    self.log_test("✅ TIPOLOGIE CONTRATTO FILTER", True, f"Found {len(tipologie)} tipologie options")
                else:
                    self.log_test("❌ TIPOLOGIE CONTRATTO FILTER", False, "Tipologie contratto filter empty")
                
                # Test status_values
                status_values = filter_response.get('status_values', [])
                if len(status_values) > 0:
                    self.log_test("✅ STATUS FILTER", True, f"Found {len(status_values)} status options")
                else:
                    self.log_test("❌ STATUS FILTER", False, "Status filter empty")
                
                # Test users
                users = filter_response.get('users', [])
                if len(users) > 0:
                    self.log_test("✅ USERS FILTER", True, f"Found {len(users)} user options")
                else:
                    self.log_test("❌ USERS FILTER", False, "Users filter empty")
                
            else:
                self.log_test("❌ FILTER RESPONSE NOT DICT", False, f"Response type: {type(filter_response)}")
                return False
                
        else:
            self.log_test("❌ GET /api/clienti/filter-options", False, f"Status: {status}, Response: {filter_response}")
            return False

        # **STEP 3: VERIFY DATA CONSISTENCY**
        print("\n🔍 STEP 3: VERIFY DATA CONSISTENCY...")
        print("   🎯 Verificare che Sub Agenzia F2F ha commesse_autorizzate che include Fastweb")
        
        # Get sub agenzie data to verify the fix
        success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
        
        if success and status == 200:
            self.log_test("✅ GET /api/sub-agenzie", True, f"Status: {status}")
            
            sub_agenzie_list = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
            
            # Find F2F sub agenzia
            f2f_sub_agenzia = None
            for sub_agenzia in sub_agenzie_list:
                if isinstance(sub_agenzia, dict):
                    nome = sub_agenzia.get('nome', '').lower()
                    if 'f2f' in nome:
                        f2f_sub_agenzia = sub_agenzia
                        break
            
            if f2f_sub_agenzia:
                commesse_autorizzate_f2f = f2f_sub_agenzia.get('commesse_autorizzate', [])
                fastweb_commessa_id = '4cb70f28-6278-4d0f-b2b7-65f2b783f3f1'
                
                self.log_test("✅ F2F SUB AGENZIA FOUND IN DATABASE", True, 
                    f"Nome: {f2f_sub_agenzia.get('nome')}, ID: {f2f_sub_agenzia.get('id')}")
                
                print(f"      • F2F commesse_autorizzate: {commesse_autorizzate_f2f}")
                print(f"      • Expected Fastweb ID: {fastweb_commessa_id}")
                
                if fastweb_commessa_id in commesse_autorizzate_f2f:
                    self.log_test("✅ F2F HAS FASTWEB COMMESSA", True, "F2F sub agenzia has Fastweb in commesse_autorizzate")
                    
                    # This confirms the data is correct, so if filter is empty, it's definitely the backend bug
                    if len(sub_agenzie) == 0:
                        self.log_test("🚨 BACKEND BUG CONFIRMED", False, 
                            "Data is correct but filter empty - backend using wrong field name!")
                else:
                    self.log_test("❌ F2F MISSING FASTWEB COMMESSA", False, 
                        f"F2F does not have Fastweb in commesse_autorizzate: {commesse_autorizzate_f2f}")
            else:
                self.log_test("❌ F2F SUB AGENZIA NOT FOUND IN DATABASE", False, "F2F sub agenzia not found in database")
        else:
            self.log_test("❌ GET /api/sub-agenzie", False, f"Status: {status}")

        # **FINAL SUMMARY**
        print(f"\n🎯 SUB AGENZIA FILTER FIX TEST SUMMARY:")
        print(f"   🎯 OBIETTIVO: Confermare che filtro Sub Agenzia ora si popola correttamente per Responsabile Commessa")
        print(f"   🎯 BUG FIX: Corretto campo query da 'commessa_id' a 'commesse_autorizzate' alla riga 8956")
        print(f"   📊 RISULTATI:")
        print(f"      • Responsabile Commessa login (ale/admin123): ✅ SUCCESS")
        print(f"      • User has Fastweb commessa: {'✅ VERIFIED' if fastweb_commessa_id in commesse_autorizzate else '❌ MISSING'}")
        print(f"      • GET /api/clienti/filter-options: {'✅ SUCCESS' if status == 200 else '❌ FAILED'}")
        print(f"      • Sub Agenzie filter populated: {'✅ SUCCESS' if len(sub_agenzie) > 0 else '❌ STILL EMPTY'}")
        print(f"      • F2F sub agenzia in filter: {'✅ FOUND' if f2f_found else '❌ NOT FOUND'}")
        print(f"      • Other filters working: {'✅ VERIFIED' if len(tipologie) > 0 and len(status_values) > 0 else '❌ ISSUES'}")
        print(f"      • Data consistency: {'✅ VERIFIED' if f2f_sub_agenzia else '❌ DATA ISSUES'}")
        
        # Determine overall success
        fix_successful = (
            status == 200 and 
            len(sub_agenzie) > 0 and 
            f2f_found and
            len(tipologie) > 0 and 
            len(status_values) > 0
        )
        
        if fix_successful:
            print(f"   🎉 SUCCESS: Filtro Sub Agenzia fix COMPLETAMENTE VERIFICATO!")
            print(f"   🎉 CONFERMATO: Responsabile Commessa può ora vedere Sub Agenzie autorizzate nei filtri!")
            print(f"   🎉 OBIETTIVO RAGGIUNTO: 'Utente Responsabile Commessa non funzionano i filtri Avanzati' RISOLTO!")
            return True
        else:
            print(f"   🚨 FAILURE: Filtro Sub Agenzia fix NON FUNZIONA!")
            print(f"   🚨 PROBLEMA PERSISTE: Sub Agenzia filter ancora vuoto per Responsabile Commessa")
            print(f"   🔧 AZIONE RICHIESTA: Verificare implementazione fix alla riga 8956 in server.py")
            return False

if __name__ == "__main__":
    print("🚀 Starting Sub Agenzia Filter Fix Testing...")
    print(f"🌐 Base URL: https://agentify-6.preview.emergentagent.com/api")
    print("=" * 80)
    
    tester = SubAgenziaFilterTester()
    success = tester.test_sub_agenzia_filter_fix()
    
    print("\n" + "=" * 80)
    if success:
        print("🎉 SUB AGENZIA FILTER FIX TEST PASSED!")
    else:
        print("🚨 SUB AGENZIA FILTER FIX TEST FAILED!")
    print("=" * 80)