#!/usr/bin/env python3
"""
Store Assistant Tipologie Filter Fix Test
Tests the fix for Store Assistant seeing only their own client tipologies
"""

import requests
import sys
import json
from datetime import datetime
import uuid
import time

class StoreAssistantTester:
    def __init__(self, base_url="https://commessa-crm-hub.preview.emergentagent.com/api"):
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

    def test_store_assistant_tipologie_filter_fix(self):
        """🎯 VERIFICA FIX STORE ASSISTANT - TIPOLOGIE CONTRATTO"""
        print("\n🎯 VERIFICA FIX STORE ASSISTANT - TIPOLOGIE CONTRATTO")
        print("🎯 CONTESTO:")
        print("   Ho appena applicato un fix critico alla logica del filtro tipologie.")
        print("   Il problema era che Store Assistant vedeva 38 tipologie UUID perché il sistema")
        print("   aggiungeva tipologie_autorizzate anche per ruoli che dovrebbero vedere solo i propri clienti.")
        print("")
        print("🎯 FIX APPLICATO:")
        print("   - Store Assistant, Agente, Operatore → vedono SOLO tipologie dei propri clienti (NO tipologie_autorizzate)")
        print("   - Responsabile Commessa, Backoffice, Area Manager → vedono tipologie clienti + tipologie_autorizzate")
        print("")
        print("🎯 OBIETTIVO:")
        print("   Verificare che Store Assistant ora veda SOLO le tipologie dei propri clienti, non più le 38 UUID.")
        
        start_time = time.time()
        
        # **1. LOGIN ADMIN FIRST**
        print("\n🔐 1. LOGIN ADMIN (admin/admin123)...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            admin_token = response['access_token']
            self.token = admin_token
            self.user_data = response['user']
            self.log_test("✅ Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("❌ Admin login failed", False, f"Status: {status}, Response: {response}")
            return False

        # **2. TEST REGRESSIONE ADMIN - Verificare che Admin ancora veda 6 tipologie**
        print("\n👑 2. TEST REGRESSIONE ADMIN - Verificare che Admin ancora veda 6 tipologie...")
        success, admin_filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        admin_tipologie_count = 0
        admin_tipologie = []
        
        if success and status == 200:
            tipologie_contratto = admin_filter_response.get('tipologie_contratto', [])
            admin_tipologie_count = len(tipologie_contratto)
            admin_tipologie = [t.get('value', t.get('label', str(t))) for t in tipologie_contratto if isinstance(t, dict)]
            
            self.log_test("✅ Admin GET /api/clienti/filter-options", True, f"Status: 200 OK")
            self.log_test("✅ Admin tipologie count", True, f"Found {admin_tipologie_count} tipologie")
            
            print(f"   📊 ADMIN TIPOLOGIE FOUND:")
            for i, tipologia in enumerate(admin_tipologie[:10], 1):  # Show first 10
                print(f"      {i}. {tipologia}")
            if len(admin_tipologie) > 10:
                print(f"      ... and {len(admin_tipologie) - 10} more")
                
        else:
            self.log_test("❌ Admin GET /api/clienti/filter-options failed", False, f"Status: {status}")
            return False

        # **3. FIND STORE ASSISTANT USER**
        print("\n🔍 3. FIND STORE ASSISTANT USER...")
        
        # Try to find Store Assistant user 'ale10' or any store_assist user
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        
        store_assistant_user = None
        store_assistant_username = None
        
        if success and status == 200:
            users = users_response if isinstance(users_response, list) else []
            
            # First try to find 'ale10'
            for user in users:
                if user.get('username') == 'ale10' and user.get('role') == 'store_assist':
                    store_assistant_user = user
                    store_assistant_username = 'ale10'
                    break
            
            # If not found, find any store_assist user
            if not store_assistant_user:
                for user in users:
                    if user.get('role') == 'store_assist':
                        store_assistant_user = user
                        store_assistant_username = user.get('username')
                        break
            
            if store_assistant_user:
                self.log_test("✅ Found Store Assistant user", True, 
                    f"Username: {store_assistant_username}, Role: {store_assistant_user.get('role')}")
                    
                # Show user details
                user_id = store_assistant_user.get('id', 'No ID')
                is_active = store_assistant_user.get('is_active', False)
                print(f"   📊 STORE ASSISTANT USER DETAILS:")
                print(f"      • Username: {store_assistant_username}")
                print(f"      • Role: {store_assistant_user.get('role')}")
                print(f"      • ID: {user_id[:8]}...")
                print(f"      • Active: {is_active}")
                
            else:
                self.log_test("❌ No Store Assistant user found", False, "Cannot test without store_assist user")
                print("   ℹ️ Available user roles:")
                roles = {}
                for user in users[:10]:  # Show first 10 users
                    role = user.get('role', 'unknown')
                    roles[role] = roles.get(role, 0) + 1
                for role, count in roles.items():
                    print(f"      • {role}: {count} users")
                return False
                
        else:
            self.log_test("❌ GET /api/users failed", False, f"Status: {status}")
            return False

        # **4. LOGIN STORE ASSISTANT**
        print(f"\n🔑 4. LOGIN STORE ASSISTANT ({store_assistant_username})...")
        
        # Try common passwords
        passwords_to_try = ['admin123', 'password', store_assistant_username]
        store_assistant_token = None
        
        for password in passwords_to_try:
            print(f"   Trying {store_assistant_username}/{password}...")
            
            success, login_response, status = self.make_request(
                'POST', 'auth/login', 
                {'username': store_assistant_username, 'password': password}, 
                expected_status=200, auth_required=False
            )
            
            if success and status == 200 and 'access_token' in login_response:
                store_assistant_token = login_response['access_token']
                store_assistant_user_data = login_response['user']
                
                self.log_test(f"✅ Store Assistant login ({store_assistant_username}/{password})", True, 
                    f"Token received, Role: {store_assistant_user_data['role']}")
                break
            else:
                print(f"      ❌ Failed with {password}: Status {status}")
        
        if not store_assistant_token:
            self.log_test("❌ Store Assistant login failed", False, "Tried multiple passwords")
            print("   ℹ️ Cannot test Store Assistant filter without valid login")
            return False

        # **5. TEST STORE ASSISTANT CLIENTI**
        print(f"\n👥 5. TEST STORE ASSISTANT CLIENTI...")
        
        # Switch to Store Assistant token
        self.token = store_assistant_token
        
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        store_assistant_clienti = []
        store_assistant_tipologie_in_clienti = set()
        
        if success and status == 200:
            clienti = clienti_response if isinstance(clienti_response, list) else []
            store_assistant_clienti = clienti
            
            self.log_test("✅ Store Assistant GET /api/clienti", True, f"Status: 200, Found {len(clienti)} clienti")
            
            # Analyze tipologie in Store Assistant's clienti
            for cliente in clienti:
                tipologia = cliente.get('tipologia_contratto')
                if tipologia:
                    store_assistant_tipologie_in_clienti.add(tipologia)
            
            print(f"   📊 STORE ASSISTANT CLIENTI ANALYSIS:")
            print(f"      • Total clienti: {len(clienti)}")
            print(f"      • Unique tipologie in clienti: {len(store_assistant_tipologie_in_clienti)}")
            
            if store_assistant_tipologie_in_clienti:
                print(f"      • Tipologie found in clienti:")
                for i, tipologia in enumerate(sorted(store_assistant_tipologie_in_clienti), 1):
                    print(f"         {i}. {tipologia}")
            else:
                print(f"      • No tipologie found in clienti")
                
        else:
            self.log_test("❌ Store Assistant GET /api/clienti failed", False, f"Status: {status}")
            return False

        # **6. CRITICAL TEST: Store Assistant Filter Options**
        print(f"\n🎯 6. CRITICAL TEST: Store Assistant Filter Options...")
        
        success, sa_filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        if success and status == 200:
            tipologie_contratto = sa_filter_response.get('tipologie_contratto', [])
            sa_tipologie_count = len(tipologie_contratto)
            sa_tipologie = [t.get('value', t.get('label', str(t))) for t in tipologie_contratto if isinstance(t, dict)]
            
            self.log_test("✅ Store Assistant GET /api/clienti/filter-options", True, f"Status: 200 OK")
            
            print(f"   📊 STORE ASSISTANT FILTER RESULTS:")
            print(f"      • Total tipologie in filter: {sa_tipologie_count}")
            print(f"      • Expected tipologie (from clienti): {len(store_assistant_tipologie_in_clienti)}")
            
            # **CRITICAL VERIFICATION: Should see ONLY tipologie from own clienti**
            if sa_tipologie_count == len(store_assistant_tipologie_in_clienti):
                self.log_test("✅ CRITICAL SUCCESS: Store Assistant sees ONLY own tipologie", True, 
                    f"Filter shows {sa_tipologie_count} tipologie = {len(store_assistant_tipologie_in_clienti)} from clienti")
            elif sa_tipologie_count == 1 and len(store_assistant_tipologie_in_clienti) == 1:
                self.log_test("✅ CRITICAL SUCCESS: Store Assistant sees exactly 1 tipologia", True, 
                    f"Filter shows 1 tipologia as expected")
            elif sa_tipologie_count < 10:
                self.log_test("✅ SUCCESS: Store Assistant sees limited tipologie", True, 
                    f"Filter shows {sa_tipologie_count} tipologie (not 38 UUID!)")
            else:
                self.log_test("❌ CRITICAL FAILURE: Store Assistant still sees too many tipologie", False, 
                    f"Filter shows {sa_tipologie_count} tipologie (expected {len(store_assistant_tipologie_in_clienti)})")
            
            # Show tipologie in filter
            print(f"   📋 TIPOLOGIE IN STORE ASSISTANT FILTER:")
            for i, tipologia in enumerate(sa_tipologie, 1):
                print(f"      {i}. {tipologia}")
            
            # **COMPARISON: Pre-Fix vs Post-Fix**
            print(f"\n   🔍 COMPARISON Pre-Fix vs Post-Fix:")
            print(f"      • PRE-FIX: Store Assistant vedeva 38 tipologie UUID")
            print(f"      • POST-FIX: Store Assistant vede {sa_tipologie_count} tipologie")
            
            if sa_tipologie_count == 1:
                print(f"      • ✅ PERFECT: Riduzione da 38 a 1 tipologia!")
                print(f"      • ✅ EXPECTED: La tipologia è '{sa_tipologie[0] if sa_tipologie else 'None'}'")
                
                # Verify it's energia_fastweb as expected
                if sa_tipologie and sa_tipologie[0] == 'energia_fastweb':
                    self.log_test("✅ PERFECT MATCH: Tipologia is 'energia_fastweb'", True, 
                        "Exactly as expected from review request")
                else:
                    self.log_test("ℹ️ Different tipologia than expected", True, 
                        f"Got '{sa_tipologie[0] if sa_tipologie else 'None'}', expected 'energia_fastweb'")
                        
            elif sa_tipologie_count <= 5:
                print(f"      • ✅ GOOD: Significativa riduzione da 38 a {sa_tipologie_count} tipologie")
            elif sa_tipologie_count <= 10:
                print(f"      • ⚠️ PARTIAL: Riduzione da 38 a {sa_tipologie_count} tipologie (miglioramento)")
            else:
                print(f"      • ❌ INSUFFICIENT: Ancora troppe tipologie ({sa_tipologie_count})")
            
            # **VERIFY NO UUID TIPOLOGIE**
            uuid_tipologie = [t for t in sa_tipologie if len(t) > 30 and '-' in t]
            if not uuid_tipologie:
                self.log_test("✅ No UUID tipologie in filter", True, "All tipologie are human-readable strings")
            else:
                self.log_test("❌ UUID tipologie still present", False, f"Found {len(uuid_tipologie)} UUID tipologie")
                
        else:
            self.log_test("❌ Store Assistant GET /api/clienti/filter-options failed", False, f"Status: {status}")
            return False

        # **7. COMPARISON WITH ADMIN**
        print(f"\n📊 7. COMPARISON WITH ADMIN...")
        
        print(f"   📊 FILTER COMPARISON:")
        print(f"      • Admin tipologie count: {admin_tipologie_count}")
        print(f"      • Store Assistant tipologie count: {sa_tipologie_count}")
        if admin_tipologie_count > 0:
            print(f"      • Reduction ratio: {sa_tipologie_count}/{admin_tipologie_count} = {(sa_tipologie_count/admin_tipologie_count)*100:.1f}%")
        
        if sa_tipologie_count < admin_tipologie_count:
            self.log_test("✅ Store Assistant sees fewer tipologie than Admin", True, 
                f"SA: {sa_tipologie_count}, Admin: {admin_tipologie_count}")
        else:
            self.log_test("❌ Store Assistant sees same or more tipologie than Admin", False, 
                f"SA: {sa_tipologie_count}, Admin: {admin_tipologie_count}")

        # **FINAL SUMMARY**
        total_time = time.time() - start_time
        
        print(f"\n🎯 VERIFICA FIX STORE ASSISTANT - TIPOLOGIE CONTRATTO - SUMMARY:")
        print(f"   🎯 OBIETTIVO: Verificare che Store Assistant ora veda SOLO le tipologie dei propri clienti")
        print(f"   📊 RISULTATI TEST (Total time: {total_time:.2f}s):")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • Admin filter options: ✅ SUCCESS ({admin_tipologie_count} tipologie)")
        print(f"      • Store Assistant user found: ✅ SUCCESS ({store_assistant_username})")
        print(f"      • Store Assistant login: ✅ SUCCESS")
        print(f"      • Store Assistant clienti: ✅ SUCCESS ({len(store_assistant_clienti)} clienti)")
        print(f"      • Store Assistant filter options: ✅ SUCCESS ({sa_tipologie_count} tipologie)")
        
        # **CRITERI DI SUCCESSO**
        print(f"\n   🎯 CRITERI DI SUCCESSO:")
        success_criteria = {
            "Store Assistant vede ESATTAMENTE 1 tipologia (non 38)": sa_tipologie_count == 1,
            "La tipologia è 'energia_fastweb' (quella del suo cliente)": sa_tipologie and sa_tipologie[0] == 'energia_fastweb',
            "Admin ancora funziona correttamente (6 tipologie)": admin_tipologie_count >= 6,
            "Nessun errore 500 nel backend": True  # We got here without 500 errors
        }
        
        for criterion, met in success_criteria.items():
            status_icon = "✅" if met else "❌"
            print(f"      {status_icon} {criterion}")
        
        all_criteria_met = all(success_criteria.values())
        
        if all_criteria_met:
            print(f"\n   🎉 SUCCESS: Il fix DEVE ridurre le tipologie di Store Assistant da 38 a 1. ✅ ACHIEVED!")
            print(f"   🎉 CONCLUSIONE: Store Assistant ora vede SOLO le tipologie dei propri clienti!")
            print(f"   🔧 FIX CONFERMATO: La logica del filtro tipologie funziona correttamente")
        else:
            print(f"\n   ⚠️ PARTIAL SUCCESS: Alcuni criteri non completamente soddisfatti")
            print(f"   🔧 ANALYSIS: Il fix ha migliorato la situazione ma potrebbe necessitare ulteriori aggiustamenti")
        
        # Restore admin token
        self.token = admin_token
        
        return all_criteria_met

def main():
    """Main function"""
    print("🚀 Starting Store Assistant Tipologie Filter Fix Test...")
    print(f"🌐 Base URL: https://commessa-crm-hub.preview.emergentagent.com/api")
    print("=" * 80)
    
    tester = StoreAssistantTester()
    
    try:
        result = tester.test_store_assistant_tipologie_filter_fix()
        
        # Print summary
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 STORE ASSISTANT TIPOLOGIE FILTER FIX SUCCESSFUL!")
        else:
            print("❌ STORE ASSISTANT TIPOLOGIE FILTER FIX NEEDS MORE WORK!")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    return result

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)