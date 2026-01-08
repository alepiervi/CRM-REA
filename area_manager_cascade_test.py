#!/usr/bin/env python3
"""
🚨 TEST URGENTE: Area Manager CASCADE Sub Agenzie - Debug dropdown vuoto
Tests the specific issue where Area Manager cannot see Sub Agenzie dropdown
"""

import requests
import json
import time

class AreaManagerCascadeTest:
    def __init__(self, base_url="https://client-search-fix-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
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

            success = response.status_code == expected_status
            
            try:
                return success, response.json() if response.content else {}, response.status_code
            except json.JSONDecodeError:
                return success, {"error": "Non-JSON response", "content": response.text[:200]}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_area_manager_cascade_sub_agenzie_urgent(self):
        """🚨 TEST URGENTE: Area Manager CASCADE Sub Agenzie - Debug dropdown vuoto"""
        print("\n🚨 TEST URGENTE: Area Manager CASCADE Sub Agenzie")
        print("🎯 CONTESTO:")
        print("   L'utente segnala che Area Manager non vede il dropdown Sub Agenzie,")
        print("   quindi non può procedere con la creazione del cliente.")
        print("   Devo verificare perché GET /api/cascade/sub-agenzie non ritorna risultati.")
        print("")
        print("🎯 OBIETTIVO:")
        print("   Identificare perché Area Manager non vede sub agenzie nel cascade.")
        
        start_time = time.time()
        
        # **FASE 1: Identifica Area Manager**
        print("\n📋 FASE 1: IDENTIFICA AREA MANAGER...")
        
        # 1. Login Admin (admin/admin123)
        print("\n🔐 1. Login Admin (admin/admin123)...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            user_data = response['user']
            self.log_test("✅ Admin login (admin/admin123)", True, f"Token received, Role: {user_data['role']}")
        else:
            self.log_test("❌ Admin login failed", False, f"Status: {status}, Response: {response}")
            return False

        # 2. GET /api/users - trova utente con role = "area_manager"
        print("\n👥 2. GET /api/users - trova utente con role = 'area_manager'...")
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        
        area_manager_user = None
        if success and status == 200:
            users = users_response if isinstance(users_response, list) else []
            self.log_test("✅ GET /api/users SUCCESS", True, f"Found {len(users)} total users")
            
            # Find Area Manager user
            for user in users:
                if user.get('role') == 'area_manager':
                    area_manager_user = user
                    break
            
            if area_manager_user:
                am_username = area_manager_user.get('username')
                am_id = area_manager_user.get('id')
                am_sub_agenzie = area_manager_user.get('sub_agenzie_autorizzate', [])
                am_servizi = area_manager_user.get('servizi_autorizzati', [])
                
                self.log_test("✅ Area Manager user found", True, f"Username: {am_username}, ID: {am_id[:8]}...")
                
                # 3. Verificare: Ha sub_agenzie_autorizzate popolate? Quante?
                print(f"\n   📊 AREA MANAGER DATA ANALYSIS:")
                print(f"      • Username: {am_username}")
                print(f"      • Role: {area_manager_user.get('role')}")
                print(f"      • ID: {am_id}")
                print(f"      • sub_agenzie_autorizzate: {len(am_sub_agenzie)} items")
                print(f"      • servizi_autorizzati: {len(am_servizi)} items")
                
                if len(am_sub_agenzie) > 0:
                    self.log_test("✅ Area Manager has sub_agenzie_autorizzate", True, 
                        f"Found {len(am_sub_agenzie)} authorized sub agenzie")
                    print(f"         Sub agenzie IDs: {am_sub_agenzie[:3]}{'...' if len(am_sub_agenzie) > 3 else ''}")
                else:
                    self.log_test("❌ Area Manager has NO sub_agenzie_autorizzate", False, 
                        "sub_agenzie_autorizzate is empty - this explains empty dropdown!")
                    print(f"   🚨 ROOT CAUSE IDENTIFIED: Area Manager has no authorized sub agenzie")
                    return False
                
                if len(am_servizi) > 0:
                    self.log_test("✅ Area Manager has servizi_autorizzati", True, 
                        f"Found {len(am_servizi)} authorized servizi")
                    print(f"         Servizi IDs: {am_servizi[:3]}{'...' if len(am_servizi) > 3 else ''}")
                else:
                    self.log_test("⚠️ Area Manager has NO servizi_autorizzati", True, 
                        "servizi_autorizzati is empty - may affect filtering")
                
            else:
                self.log_test("❌ No Area Manager user found", False, 
                    "Cannot find user with role 'area_manager' in system")
                return False
        else:
            self.log_test("❌ GET /api/users failed", False, f"Status: {status}")
            return False

        # **FASE 2: Test Cascade Sub Agenzie**
        print("\n📋 FASE 2: TEST CASCADE SUB AGENZIE...")
        
        # 4. Login come Area Manager
        print(f"\n🔐 4. Login come Area Manager ({am_username})...")
        success, am_login_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': am_username, 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in am_login_response:
            self.token = am_login_response['access_token']
            am_user_data = am_login_response['user']
            self.log_test(f"✅ Area Manager login ({am_username}/admin123)", True, 
                f"Token received, Role: {am_user_data['role']}")
        else:
            self.log_test(f"❌ Area Manager login failed ({am_username})", False, 
                f"Status: {status}, Response: {am_login_response}")
            return False

        # 5. GET /api/cascade/sub-agenzie
        print("\n🔗 5. GET /api/cascade/sub-agenzie...")
        success, cascade_response, cascade_status = self.make_request('GET', 'cascade/sub-agenzie', expected_status=200)
        
        cascade_sub_agenzie_count = 0
        if success and cascade_status == 200:
            cascade_sub_agenzie = cascade_response if isinstance(cascade_response, list) else []
            cascade_sub_agenzie_count = len(cascade_sub_agenzie)
            
            self.log_test("✅ GET /api/cascade/sub-agenzie SUCCESS", True, 
                f"Status: 200 OK, Found {cascade_sub_agenzie_count} sub agenzie")
            
            # 6. VERIFICARE: Quante sub agenzie ritorna?
            print(f"\n   📊 CASCADE SUB AGENZIE ANALYSIS:")
            print(f"      • Status code: {cascade_status}")
            print(f"      • Sub agenzie returned: {cascade_sub_agenzie_count}")
            print(f"      • Expected: > 0 (based on user's {len(am_sub_agenzie)} authorized sub agenzie)")
            
            if cascade_sub_agenzie_count > 0:
                self.log_test("✅ Cascade returns sub agenzie", True, 
                    f"Found {cascade_sub_agenzie_count} sub agenzie in cascade")
                
                # Show first few sub agenzie
                print(f"      • Sub agenzie in cascade:")
                for i, sub_agenzia in enumerate(cascade_sub_agenzie[:3], 1):
                    nome = sub_agenzia.get('nome', 'Unknown')
                    sa_id = sub_agenzia.get('id', 'No ID')
                    is_active = sub_agenzia.get('is_active', False)
                    print(f"         {i}. {nome} (ID: {sa_id[:8]}..., Active: {is_active})")
                
                if len(cascade_sub_agenzie) > 3:
                    print(f"         ... and {len(cascade_sub_agenzie) - 3} more")
                    
            else:
                self.log_test("❌ Cascade returns NO sub agenzie", False, 
                    "Empty cascade explains why Area Manager can't see dropdown!")
                print(f"   🚨 CRITICAL ISSUE: GET /api/cascade/sub-agenzie returns 0 results")
                
        elif cascade_status == 403:
            self.log_test("❌ GET /api/cascade/sub-agenzie FORBIDDEN", False, 
                f"Status: 403 - Area Manager not authorized for cascade endpoint")
            print(f"   🚨 AUTHORIZATION ISSUE: Area Manager role not allowed to access cascade")
            
        elif cascade_status == 500:
            self.log_test("❌ GET /api/cascade/sub-agenzie SERVER ERROR", False, 
                f"Status: 500 - Internal server error in cascade endpoint")
            print(f"   🚨 SERVER ERROR: Backend error in cascade logic")
            
        else:
            self.log_test("❌ GET /api/cascade/sub-agenzie FAILED", False, 
                f"Status: {cascade_status}, Response: {cascade_response}")

        # **FASE 3: Verifica Sub Agenzie nel Database**
        print("\n📋 FASE 3: VERIFICA SUB AGENZIE NEL DATABASE...")
        
        # 7. Con Admin, GET /api/sub-agenzie
        print("\n🔐 7. Login Admin per verificare sub agenzie nel database...")
        admin_success, admin_response, admin_status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        matching_sub_agenzie = []
        active_matching = []
        
        if admin_success and 'access_token' in admin_response:
            self.token = admin_response['access_token']
            
            print("\n📊 GET /api/sub-agenzie (as Admin)...")
            success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
            
            if success and status == 200:
                all_sub_agenzie = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
                self.log_test("✅ GET /api/sub-agenzie SUCCESS", True, 
                    f"Found {len(all_sub_agenzie)} total sub agenzie in database")
                
                # 8. Confrontare con le sub_agenzie_autorizzate dell'Area Manager
                print(f"\n   📊 SUB AGENZIE DATABASE ANALYSIS:")
                print(f"      • Total sub agenzie in database: {len(all_sub_agenzie)}")
                print(f"      • Area Manager authorized sub agenzie: {len(am_sub_agenzie)}")
                
                # Find matching sub agenzie
                for sub_agenzia in all_sub_agenzie:
                    sa_id = sub_agenzia.get('id')
                    if sa_id in am_sub_agenzie:
                        matching_sub_agenzie.append(sub_agenzia)
                        if sub_agenzia.get('is_active', False):
                            active_matching.append(sub_agenzia)
                
                print(f"      • Matching sub agenzie found: {len(matching_sub_agenzie)}")
                print(f"      • Active matching sub agenzie: {len(active_matching)}")
                
                if len(matching_sub_agenzie) > 0:
                    self.log_test("✅ Area Manager's authorized sub agenzie exist in database", True, 
                        f"Found {len(matching_sub_agenzie)} matching sub agenzie")
                    
                    # 9. Verificare se quelle sub agenzie hanno is_active = true
                    print(f"\n      • DETAILED ANALYSIS OF MATCHING SUB AGENZIE:")
                    for i, sub_agenzia in enumerate(matching_sub_agenzie, 1):
                        nome = sub_agenzia.get('nome', 'Unknown')
                        sa_id = sub_agenzia.get('id', 'No ID')
                        is_active = sub_agenzia.get('is_active', False)
                        servizi_autorizzati = sub_agenzia.get('servizi_autorizzati', [])
                        
                        print(f"         {i}. {nome}")
                        print(f"            • ID: {sa_id}")
                        print(f"            • is_active: {is_active}")
                        print(f"            • servizi_autorizzati: {len(servizi_autorizzati)} items")
                        
                        if len(servizi_autorizzati) > 0:
                            print(f"               Servizi: {servizi_autorizzati[:2]}{'...' if len(servizi_autorizzati) > 2 else ''}")
                        
                        # Check if servizi match with Area Manager's servizi_autorizzati
                        if len(am_servizi) > 0 and len(servizi_autorizzati) > 0:
                            matching_servizi = set(am_servizi) & set(servizi_autorizzati)
                            if len(matching_servizi) > 0:
                                print(f"            • ✅ Servizi match with Area Manager: {len(matching_servizi)} common")
                            else:
                                print(f"            • ❌ NO servizi match with Area Manager")
                        
                    if len(active_matching) == len(matching_sub_agenzie):
                        self.log_test("✅ All matching sub agenzie are active", True, 
                            f"All {len(matching_sub_agenzie)} sub agenzie have is_active=true")
                    else:
                        inactive_count = len(matching_sub_agenzie) - len(active_matching)
                        self.log_test("⚠️ Some matching sub agenzie are inactive", True, 
                            f"{inactive_count} out of {len(matching_sub_agenzie)} are inactive")
                        
                else:
                    self.log_test("❌ Area Manager's authorized sub agenzie NOT found in database", False, 
                        "None of the authorized sub agenzie IDs exist in database")
                    print(f"   🚨 DATA INTEGRITY ISSUE: Authorized sub agenzie IDs don't match database")
                    
            else:
                self.log_test("❌ GET /api/sub-agenzie failed", False, f"Status: {status}")
        else:
            self.log_test("❌ Admin login for database check failed", False, f"Status: {admin_status}")

        # **FINAL DIAGNOSIS**
        total_time = time.time() - start_time
        
        print(f"\n🎯 AREA MANAGER CASCADE SUB AGENZIE - DIAGNOSIS:")
        print(f"   🎯 OBIETTIVO: Identificare perché Area Manager non vede sub agenzie nel dropdown cascading")
        print(f"   📊 RISULTATI TEST (Total time: {total_time:.2f}s):")
        print(f"      • Admin login: ✅ SUCCESS")
        print(f"      • Area Manager user found: {'✅ SUCCESS' if area_manager_user else '❌ FAILED'}")
        print(f"      • Area Manager has sub_agenzie_autorizzate: {'✅ YES' if len(am_sub_agenzie) > 0 else '❌ NO'} ({len(am_sub_agenzie)} items)")
        print(f"      • Area Manager has servizi_autorizzati: {'✅ YES' if len(am_servizi) > 0 else '⚠️ NO'} ({len(am_servizi)} items)")
        print(f"      • Area Manager login: ✅ SUCCESS")
        print(f"      • GET /api/cascade/sub-agenzie: {'✅ SUCCESS' if cascade_status == 200 else f'❌ FAILED ({cascade_status})'}")
        print(f"      • Cascade returns sub agenzie: {'✅ YES' if cascade_sub_agenzie_count > 0 else '❌ NO'} ({cascade_sub_agenzie_count} items)")
        print(f"      • Database contains matching sub agenzie: {'✅ YES' if len(matching_sub_agenzie) > 0 else '❌ NO'}")
        print(f"      • Active matching sub agenzie: {'✅ YES' if len(active_matching) > 0 else '❌ NO'} ({len(active_matching)} items)")
        
        # Determine root cause
        if len(am_sub_agenzie) == 0:
            root_cause = "Area Manager has no sub_agenzie_autorizzate"
            severity = "CRITICAL"
            solution = "Populate sub_agenzie_autorizzate field for Area Manager user"
        elif cascade_status != 200:
            root_cause = f"Cascade endpoint returns {cascade_status} instead of 200"
            severity = "CRITICAL"
            solution = "Fix cascade endpoint authorization or implementation"
        elif cascade_sub_agenzie_count == 0:
            root_cause = "Cascade endpoint returns empty list despite authorized sub agenzie"
            severity = "HIGH"
            solution = "Debug cascade filtering logic - check servizi_autorizzati matching"
        elif len(matching_sub_agenzie) == 0:
            root_cause = "Authorized sub agenzie IDs don't exist in database"
            severity = "HIGH"
            solution = "Fix data integrity - ensure authorized sub agenzie exist in database"
        elif len(active_matching) == 0:
            root_cause = "All matching sub agenzie are inactive (is_active=false)"
            severity = "MEDIUM"
            solution = "Activate the sub agenzie or update Area Manager's authorized list"
        else:
            root_cause = "Configuration appears correct - possible servizi_autorizzati mismatch"
            severity = "MEDIUM"
            solution = "Check servizi_autorizzati matching between user and sub agenzie"
        
        print(f"\n   🎯 ROOT CAUSE ANALYSIS:")
        print(f"      • Severity: {severity}")
        print(f"      • Root Cause: {root_cause}")
        print(f"      • Recommended Solution: {solution}")
        
        # Success criteria
        success_criteria_met = (
            area_manager_user is not None and
            len(am_sub_agenzie) > 0 and
            cascade_status == 200 and
            cascade_sub_agenzie_count > 0
        )
        
        if success_criteria_met:
            print(f"\n   ✅ SUCCESS: Area Manager riceve lista sub agenzie non vuota")
            print(f"   🎉 CONCLUSIONE: Il sistema funziona correttamente!")
            print(f"   📋 Area Manager può procedere con la creazione del cliente")
        else:
            print(f"\n   ❌ FAILURE: Area Manager non riceve sub agenzie → identificato root cause esatto")
            print(f"   🚨 IMPACT: Area Manager non può creare clienti (dropdown vuoto)")
            print(f"   🔧 NEXT STEPS: {solution}")
        
        return success_criteria_met

def main():
    """Main function to run the Area Manager CASCADE Sub Agenzie test"""
    print("🚀 Starting Area Manager CASCADE Sub Agenzie Test...")
    print("🎯 As requested in the review: TEST URGENTE Area Manager CASCADE Sub Agenzie")
    
    try:
        tester = AreaManagerCascadeTest()
        result = tester.test_area_manager_cascade_sub_agenzie_urgent()
        
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 AREA MANAGER CASCADE SUB AGENZIE TEST SUCCESSFUL!")
            print("✅ Area Manager riceve lista sub agenzie non vuota")
        else:
            print("❌ AREA MANAGER CASCADE SUB AGENZIE TEST FAILED!")
            print("🚨 Area Manager non riceve sub agenzie → identificato root cause esatto")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    exit(0 if result else 1)

if __name__ == "__main__":
    main()