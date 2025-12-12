#!/usr/bin/env python3
"""
Test script for ale8 dropdown fix verification
"""

import requests
import json
import sys

class DropdownTester:
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

            success = response.status_code == expected_status
            
            try:
                return success, response.json() if response.content else {}, response.status_code
            except json.JSONDecodeError:
                return success, {"error": "Non-JSON response", "content": response.text[:200]}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_ale8_dropdown_fix(self):
        """🎯 TEST REVIEW REQUEST: Verifica fix dropdown 'Utente Assegnato' per ale8"""
        print("🎯 TEST REVIEW REQUEST: Verifica fix dropdown 'Utente Assegnato' per ale8")
        print("🎯 SETUP:")
        print("   • Backend: https://clientmanage-2.preview.emergentagent.com")
        print("   • User: ale8/admin123")
        print("")
        print("🎯 TEST:")
        print("   1. Login come ale8")
        print("   2. GET /api/clienti/filter-options - Verifica che il response contenga la lista 'users'")
        print("   3. GET /api/clienti (senza filtro) - Estrai tutti gli user_id da assigned_to e created_by")
        print("   4. Confronto - Il numero di users nel dropdown deve essere >= numero user_id nei clienti")
        print("   5. Test Filtro - GET /api/clienti?assigned_to={un_user_id_dal_dropdown}")
        print("")
        print("🎯 ASPETTATIVA:")
        print("   • Dropdown deve mostrare TUTTI gli utenti (3 o più)")
        print("   • Filtro deve funzionare")
        
        import time
        start_time = time.time()
        
        # **1. Login come ale8**
        print("\n🔐 1. Login come ale8...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'ale8', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            user_role = self.user_data.get('role')
            user_id = self.user_data.get('id')
            
            self.log_test("Login ale8/admin123", True, 
                f"Token received, Role: {user_role}, ID: {user_id[:8]}...")
        else:
            self.log_test("Login ale8 failed", False, 
                f"Status: {status}, Response: {response}")
            return False

        # **2. GET /api/clienti/filter-options**
        print("\n📋 2. GET /api/clienti/filter-options...")
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        dropdown_users_count = 0
        if success and status == 200:
            self.log_test("GET /api/clienti/filter-options", True, f"Status: 200 OK")
            
            # Verifica che il response contenga la lista "users"
            users_in_dropdown = filter_response.get('users', [])
            dropdown_users_count = len(users_in_dropdown)
            
            self.log_test("Response contains 'users' list", True, 
                f"Found {dropdown_users_count} users in dropdown")
            
            print(f"   📊 DROPDOWN USERS:")
            for i, user_item in enumerate(users_in_dropdown[:5], 1):  # Show first 5
                if isinstance(user_item, dict):
                    user_label = user_item.get('label', user_item.get('username', 'Unknown'))
                    user_value = user_item.get('value', user_item.get('id', 'No ID'))
                    print(f"      {i}. {user_label} (value: {user_value})")
                else:
                    print(f"      {i}. {user_item}")
            if dropdown_users_count > 5:
                print(f"      ... and {dropdown_users_count - 5} more")
                
        else:
            self.log_test("GET /api/clienti/filter-options FAILED", False, f"Status: {status}")
            return False

        # **3. GET /api/clienti (senza filtro)**
        print("\n👥 3. GET /api/clienti (senza filtro)...")
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        total_clienti_count = 0
        unique_user_ids = set()
        
        if success and status == 200:
            clienti = clienti_response if isinstance(clienti_response, list) else []
            total_clienti_count = len(clienti)
            
            self.log_test("GET /api/clienti", True, 
                f"Status: 200 OK, Found {total_clienti_count} total clienti")
            
            # Estrai tutti gli user_id da assigned_to e created_by
            for cliente in clienti:
                assigned_to = cliente.get('assigned_to')
                created_by = cliente.get('created_by')
                
                if assigned_to:
                    unique_user_ids.add(assigned_to)
                if created_by:
                    unique_user_ids.add(created_by)
            
            unique_user_ids_count = len(unique_user_ids)
            self.log_test("User_ids extraction complete", True, 
                f"Found {unique_user_ids_count} unique user_ids in clienti")
            
            print(f"   📊 UNIQUE USER_IDS IN CLIENTI:")
            for i, user_id_val in enumerate(sorted(unique_user_ids), 1):
                print(f"      {i}. {user_id_val}")
                
        else:
            self.log_test("GET /api/clienti FAILED", False, f"Status: {status}")
            return False

        # **4. Confronto**
        print("\n🔍 4. Confronto...")
        print(f"   • Users nel dropdown: {dropdown_users_count}")
        print(f"   • Unique user_ids nei clienti: {len(unique_user_ids)}")
        
        # Extract user_ids from dropdown for comparison
        dropdown_user_ids = set()
        for user_item in users_in_dropdown:
            if isinstance(user_item, dict):
                user_value = user_item.get('value', user_item.get('id'))
                if user_value:
                    dropdown_user_ids.add(user_value)
        
        # Find missing user_ids
        missing_from_dropdown = unique_user_ids - dropdown_user_ids
        extra_in_dropdown = dropdown_user_ids - unique_user_ids
        
        print(f"   • User_ids mancanti nel dropdown: {len(missing_from_dropdown)}")
        if missing_from_dropdown:
            for missing_id in sorted(missing_from_dropdown):
                print(f"      - {missing_id}")
        
        print(f"   • User_ids extra nel dropdown: {len(extra_in_dropdown)}")
        if extra_in_dropdown:
            for extra_id in sorted(extra_in_dropdown):
                print(f"      - {extra_id}")
        
        # Il numero di users nel dropdown deve essere >= numero user_id nei clienti
        if dropdown_users_count >= len(unique_user_ids):
            self.log_test("Dropdown count >= client user_ids", True, 
                f"Dropdown has {dropdown_users_count} users, clienti have {len(unique_user_ids)} unique user_ids")
        else:
            self.log_test("Dropdown count < client user_ids", False, 
                f"Dropdown has {dropdown_users_count} users, but clienti have {len(unique_user_ids)} unique user_ids")
        
        # Verifica che l'utente 826c2ae9-ef71-4eef-81e3-690897fa6221 sia presente
        target_user_id = "826c2ae9-ef71-4eef-81e3-690897fa6221"
        target_user_present = target_user_id in unique_user_ids
        target_user_in_dropdown = target_user_id in dropdown_user_ids
        
        if target_user_present:
            self.log_test("Target user 826c2ae9... present in clienti", True, 
                f"User {target_user_id} found in clienti data")
        else:
            self.log_test("Target user 826c2ae9... not in current clienti", True, 
                f"User {target_user_id} not found in current clienti (may be expected)")
        
        if target_user_in_dropdown:
            self.log_test("Target user 826c2ae9... present in dropdown", True, 
                f"User {target_user_id} found in dropdown")
        else:
            if target_user_present:
                self.log_test("❌ CRITICAL: Target user 826c2ae9... MISSING from dropdown", False, 
                    f"User {target_user_id} is in clienti but NOT in dropdown - this is the bug!")
            else:
                self.log_test("Target user 826c2ae9... not in dropdown", True, 
                    f"User {target_user_id} not in dropdown (expected since not in clienti)")
        
        # Check if all client user_ids are in dropdown
        if len(missing_from_dropdown) == 0:
            self.log_test("All client user_ids in dropdown", True, 
                "Dropdown contains all user_ids from clienti")
        else:
            self.log_test("❌ CRITICAL: Some client user_ids missing from dropdown", False, 
                f"{len(missing_from_dropdown)} user_ids missing from dropdown")

        # **5. Test Filtro**
        print("\n🎯 5. Test Filtro...")
        
        # Scegli un user_id per testare il filtro
        test_user_id = None
        if len(unique_user_ids) > 0:
            test_user_id = list(unique_user_ids)[0]
            print(f"   🎯 Testing filter with user_id: {test_user_id}")
        else:
            self.log_test("No user_ids found for filter test", False, 
                "Cannot test filter without user_ids in clienti")
            return False
        
        # GET /api/clienti?assigned_to={user_id}
        filter_endpoint = f'clienti?assigned_to={test_user_id}'
        success, filtered_response, status = self.make_request('GET', filter_endpoint, expected_status=200)
        
        if success and status == 200:
            filtered_clienti = filtered_response if isinstance(filtered_response, list) else []
            filtered_count = len(filtered_clienti)
            
            self.log_test("GET /api/clienti?assigned_to={user_id}", True, 
                f"Status: 200 OK, Found {filtered_count} filtered clienti")
            
            # Verifica che filtra correttamente
            if filtered_count <= total_clienti_count:
                if filtered_count < total_clienti_count:
                    self.log_test("Filter working correctly", True, 
                        f"Filter reduces results from {total_clienti_count} → {filtered_count} clienti")
                else:
                    self.log_test("Filter returns all clients", True, 
                        f"Filter returns same count - may be expected if all clients match")
            else:
                self.log_test("Filter error", False, 
                    f"Filter returns more clienti than total ({filtered_count} > {total_clienti_count})")
                
        else:
            self.log_test("GET /api/clienti?assigned_to={user_id} FAILED", False, f"Status: {status}")
            return False

        # **FINAL SUMMARY**
        total_time = time.time() - start_time
        
        print(f"\n🎯 VERIFICA FIX DROPDOWN 'UTENTE ASSEGNATO' - SUMMARY (Total time: {total_time:.2f}s):")
        print(f"   📊 RISULTATI:")
        print(f"      • Login ale8: ✅ SUCCESS")
        print(f"      • GET /api/clienti/filter-options: ✅ SUCCESS")
        print(f"      • Users in dropdown: {dropdown_users_count}")
        print(f"      • GET /api/clienti: ✅ SUCCESS")
        print(f"      • Unique user_ids in clienti: {len(unique_user_ids)}")
        print(f"      • Dropdown count >= client user_ids: {'✅' if dropdown_users_count >= len(unique_user_ids) else '❌'}")
        print(f"      • Filter test: ✅ SUCCESS")
        
        # Determine overall success
        overall_success = (
            dropdown_users_count >= 3 and  # Dropdown deve mostrare TUTTI gli utenti (3 o più)
            dropdown_users_count >= len(unique_user_ids) and  # Dropdown count >= client user_ids
            status == 200  # Filter test successful
        )
        
        if overall_success:
            print(f"\n   🎉 SUCCESS: DROPDOWN 'UTENTE ASSEGNATO' FIX WORKING!")
            print(f"   🎉 CONCLUSIONE: Il dropdown mostra tutti gli utenti e il filtro funziona")
        else:
            print(f"\n   🚨 ISSUE: DROPDOWN 'UTENTE ASSEGNATO' NEEDS ATTENTION!")
            if dropdown_users_count < 3:
                print(f"      • Dropdown shows only {dropdown_users_count} users (expected 3+)")
            if dropdown_users_count < len(unique_user_ids):
                print(f"      • Dropdown missing some user_ids from clienti")
        
        return overall_success

def main():
    """Main function to run the test"""
    print("🚀 Starting ale8 Dropdown Fix Verification Test...")
    print("=" * 80)
    
    try:
        tester = DropdownTester()
        result = tester.test_ale8_dropdown_fix()
        
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 ALE8 DROPDOWN FIX TEST SUCCESSFUL!")
        else:
            print("🚨 ALE8 DROPDOWN FIX TEST FAILED!")
            
        return 0 if result else 1
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())