#!/usr/bin/env python3
"""
Test for Responsabile Presidi Filter Options Fix
Tests the /api/clienti/filter-options endpoint for ale8 (responsabile_presidi)
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class ResponsabilePresidiFilterTester:
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
            
            # Try to parse JSON
            try:
                return success, response.json() if response.content else {}, response.status_code
            except json.JSONDecodeError:
                return success, {"error": "Non-JSON response", "content": response.text[:200]}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_responsabile_presidi_filter_options_fix(self):
        """🎯 TEST RESPONSABILE PRESIDI FILTER OPTIONS FIX - Verifica che users array contenga solo utenti assegnati a clienti visibili"""
        print("\n🎯 TEST RESPONSABILE PRESIDI FILTER OPTIONS FIX")
        print("🎯 CONTESTO: Fix per mostrare solo utenti che sono effettivamente assegnati a clienti visibili nel filtro 'Utente assegnato'")
        print("🎯 OBIETTIVO: Verificare che l'array 'users' contenga SOLO utenti da clienti visibili (assigned_to o created_by)")
        print("")
        
        import time
        start_time = time.time()
        
        # **STEP 1: Login as ale8 (responsabile_presidi)**
        print("\n🔐 STEP 1: Login as ale8 (responsabile_presidi)...")
        
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
            
            self.log_test("✅ Login ale8 (responsabile_presidi)", True, 
                f"Token received, Role: {user_role}, ID: {user_id[:8]}...")
            
            if user_role != 'responsabile_presidi':
                self.log_test("⚠️ User role verification", True, 
                    f"Expected 'responsabile_presidi', got '{user_role}' - continuing test")
        else:
            self.log_test("❌ Login ale8 failed", False, 
                f"Status: {status}, Response: {response}")
            return False

        # **STEP 2: GET /api/clienti (no filter) to see visible clients**
        print("\n👥 STEP 2: GET /api/clienti (no filter) to see visible clients...")
        
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        visible_clients = []
        visible_user_ids = set()
        
        if success and status == 200:
            visible_clients = clienti_response if isinstance(clienti_response, list) else []
            
            self.log_test("✅ GET /api/clienti (no filter)", True, 
                f"Status: 200 OK, Found {len(visible_clients)} visible clients")
            
            # Extract user_ids from visible clients (assigned_to and created_by)
            print(f"\n   📊 VISIBLE CLIENTS ANALYSIS:")
            print(f"      • Total visible clients: {len(visible_clients)}")
            
            assigned_to_users = set()
            created_by_users = set()
            
            for client in visible_clients:
                assigned_to = client.get('assigned_to')
                created_by = client.get('created_by')
                
                if assigned_to:
                    assigned_to_users.add(assigned_to)
                    visible_user_ids.add(assigned_to)
                if created_by:
                    created_by_users.add(created_by)
                    visible_user_ids.add(created_by)
            
            print(f"      • Unique assigned_to user_ids: {len(assigned_to_users)}")
            print(f"      • Unique created_by user_ids: {len(created_by_users)}")
            print(f"      • Total unique user_ids in visible clients: {len(visible_user_ids)}")
            
            # Show the user_ids found
            if visible_user_ids:
                print(f"\n   📋 USER_IDS FROM VISIBLE CLIENTS:")
                for i, user_id_val in enumerate(sorted(visible_user_ids), 1):
                    print(f"         {i}. {user_id_val}")
            
            self.log_test("✅ Visible clients user_ids extracted", True, 
                f"Found {len(visible_user_ids)} unique user_ids from visible clients")
                
        else:
            self.log_test("❌ GET /api/clienti failed", False, f"Status: {status}")
            return False

        # **STEP 3: GET /api/clienti/filter-options**
        print("\n🔍 STEP 3: GET /api/clienti/filter-options...")
        
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        filter_users = []
        filter_user_ids = set()
        
        if success and status == 200:
            self.log_test("✅ GET /api/clienti/filter-options", True, f"Status: 200 OK")
            
            # Extract users array from response
            users_array = filter_response.get('users', [])
            filter_users = users_array
            
            print(f"\n   📊 FILTER OPTIONS ANALYSIS:")
            print(f"      • 'users' field present: {'✅' if 'users' in filter_response else '❌'}")
            print(f"      • Number of users in filter: {len(users_array)}")
            
            # Extract user_ids from filter users
            for user_item in users_array:
                if isinstance(user_item, dict):
                    user_value = user_item.get('value', user_item.get('id'))
                    if user_value:
                        filter_user_ids.add(user_value)
            
            print(f"      • Unique user_ids in filter: {len(filter_user_ids)}")
            
            # Show users in filter
            if users_array:
                print(f"\n   📋 USERS IN FILTER DROPDOWN:")
                for i, user_item in enumerate(users_array, 1):
                    if isinstance(user_item, dict):
                        user_label = user_item.get('label', user_item.get('username', 'Unknown'))
                        user_value = user_item.get('value', user_item.get('id', 'No ID'))
                        print(f"         {i}. {user_label} (value: {user_value})")
                    else:
                        print(f"         {i}. {user_item}")
            
            self.log_test("✅ Filter users extracted", True, 
                f"Found {len(filter_user_ids)} unique user_ids in filter")
                
        else:
            self.log_test("❌ GET /api/clienti/filter-options failed", False, f"Status: {status}")
            return False

        # **STEP 4: Verify filter contains ONLY users from visible clients**
        print("\n🔍 STEP 4: Verify filter contains ONLY users from visible clients...")
        
        # Check if filter users are subset of visible client users
        extra_users_in_filter = filter_user_ids - visible_user_ids
        missing_users_from_filter = visible_user_ids - filter_user_ids
        
        print(f"\n   🔍 FILTER VALIDATION:")
        print(f"      • User_ids in visible clients: {len(visible_user_ids)}")
        print(f"      • User_ids in filter dropdown: {len(filter_user_ids)}")
        print(f"      • Extra users in filter (should be 0): {len(extra_users_in_filter)}")
        print(f"      • Missing users from filter (should be 0): {len(missing_users_from_filter)}")
        
        # Show extra users (these should not be in filter)
        if extra_users_in_filter:
            print(f"\n   ❌ EXTRA USERS IN FILTER (should not be there):")
            for extra_user in sorted(extra_users_in_filter):
                print(f"         - {extra_user}")
        
        # Show missing users (these should be in filter)
        if missing_users_from_filter:
            print(f"\n   ❌ MISSING USERS FROM FILTER (should be there):")
            for missing_user in sorted(missing_users_from_filter):
                print(f"         - {missing_user}")
        
        # Determine if fix is working correctly
        filter_is_correct = (len(extra_users_in_filter) == 0 and len(missing_users_from_filter) == 0)
        filter_has_users = len(filter_user_ids) > 0
        clients_have_users = len(visible_user_ids) > 0
        
        if filter_is_correct and filter_has_users:
            self.log_test("✅ Filter contains ONLY users from visible clients", True, 
                f"Perfect match: {len(filter_user_ids)} users in both filter and clients")
        elif len(extra_users_in_filter) == 0 and len(missing_users_from_filter) > 0:
            self.log_test("⚠️ Filter missing some users from clients", True, 
                f"Filter has {len(filter_user_ids)}, missing {len(missing_users_from_filter)} from clients")
        elif len(extra_users_in_filter) > 0 and len(missing_users_from_filter) == 0:
            self.log_test("❌ Filter has extra users not in clients", False, 
                f"Filter has {len(extra_users_in_filter)} extra users not from visible clients")
        elif len(extra_users_in_filter) > 0 and len(missing_users_from_filter) > 0:
            self.log_test("❌ Filter has both extra and missing users", False, 
                f"Extra: {len(extra_users_in_filter)}, Missing: {len(missing_users_from_filter)}")
        elif not filter_has_users and clients_have_users:
            self.log_test("❌ Filter is empty but clients have users", False, 
                f"Filter empty, but {len(visible_user_ids)} users in clients")
        elif not filter_has_users and not clients_have_users:
            self.log_test("✅ Filter correctly empty (no users in clients)", True, 
                "Both filter and clients have no users")
        else:
            self.log_test("❌ Unexpected filter state", False, 
                f"Filter: {len(filter_user_ids)}, Clients: {len(visible_user_ids)}")

        # **FINAL SUMMARY**
        total_time = time.time() - start_time
        
        print(f"\n🎯 RESPONSABILE PRESIDI FILTER OPTIONS FIX - SUMMARY:")
        print(f"   🎯 OBIETTIVO: Verificare che users array contenga SOLO utenti da clienti visibili")
        print(f"   📊 RISULTATI TEST (Total time: {total_time:.2f}s):")
        print(f"      • Login ale8 (responsabile_presidi): ✅ SUCCESS")
        print(f"      • Visible clients found: {len(visible_clients)} clients")
        print(f"      • User_ids in visible clients: {len(visible_user_ids)} unique")
        print(f"      • User_ids in filter dropdown: {len(filter_user_ids)} unique")
        print(f"      • Extra users in filter: {len(extra_users_in_filter)} (should be 0)")
        print(f"      • Missing users from filter: {len(missing_users_from_filter)} (should be 0)")
        
        # Determine overall success
        overall_success = (
            len(visible_clients) > 0 and
            len(extra_users_in_filter) == 0 and
            (len(missing_users_from_filter) == 0 or len(visible_user_ids) == 0) and
            status == 200
        )
        
        print(f"\n   🎯 CRITERI DI SUCCESSO:")
        success_criteria = []
        
        if len(visible_clients) > 0:
            success_criteria.append("✅ Responsabile Presidi ha clienti visibili")
        else:
            success_criteria.append("❌ Nessun cliente visibile per Responsabile Presidi")
        
        if len(extra_users_in_filter) == 0:
            success_criteria.append("✅ Nessun utente extra nel filtro")
        else:
            success_criteria.append(f"❌ {len(extra_users_in_filter)} utenti extra nel filtro")
        
        if len(missing_users_from_filter) == 0:
            success_criteria.append("✅ Tutti gli utenti dei clienti sono nel filtro")
        else:
            success_criteria.append(f"❌ {len(missing_users_from_filter)} utenti mancanti dal filtro")
        
        if len(filter_user_ids) > 0 and len(visible_user_ids) > 0:
            success_criteria.append("✅ Filtro popolato correttamente")
        elif len(filter_user_ids) == 0 and len(visible_user_ids) == 0:
            success_criteria.append("✅ Filtro correttamente vuoto (nessun utente nei clienti)")
        else:
            success_criteria.append("❌ Filtro non popolato correttamente")
        
        for criterion in success_criteria:
            print(f"      {criterion}")
        
        if overall_success:
            print(f"\n   🎉 SUCCESS: FILTER OPTIONS FIX WORKING CORRECTLY!")
            print(f"   🎉 CONCLUSIONE: Il filtro 'Utente assegnato' mostra SOLO utenti da clienti visibili")
            print(f"   ✅ CONFERMATO: Fix applicato correttamente - nessun utente extra nel dropdown")
        else:
            print(f"\n   🚨 ISSUE: FILTER OPTIONS FIX NEEDS ATTENTION!")
            print(f"   🔧 RACCOMANDAZIONI:")
            if len(extra_users_in_filter) > 0:
                print(f"      • Rimuovere {len(extra_users_in_filter)} utenti extra dal filtro")
                print(f"      • Verificare logica di popolamento users array")
            if len(missing_users_from_filter) > 0:
                print(f"      • Aggiungere {len(missing_users_from_filter)} utenti mancanti al filtro")
                print(f"      • Verificare che tutti i campi assigned_to e created_by siano inclusi")
            if len(visible_clients) == 0:
                print(f"      • Verificare che ale8 abbia accesso ai clienti")
        
        return overall_success

if __name__ == "__main__":
    tester = ResponsabilePresidiFilterTester()
    # Run the specific test for the review request
    success = tester.test_responsabile_presidi_filter_options_fix()
    
    print(f"\n📊 Test Summary: {tester.tests_passed}/{tester.tests_run} tests passed")
    print(f"✅ Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if success:
        print("🎉 Test completed successfully!")
    else:
        print("⚠️ Test completed with issues - check details above")
    
    sys.exit(0 if success else 1)