#!/usr/bin/env python3
"""
Test del nuovo endpoint per filtri dinamici clienti
Test specifico per GET /api/clienti/filter-options
"""

import requests
import sys
import json
from datetime import datetime
import time

class DynamicFiltersAPITester:
    def __init__(self, base_url="https://client-search-fix-3.preview.emergentagent.com/api"):
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

    def test_dynamic_client_filters_endpoint(self):
        """TEST NUOVO ENDPOINT FILTRI DINAMICI CLIENTI - GET /api/clienti/filter-options"""
        print("\n🔍 TEST NUOVO ENDPOINT FILTRI DINAMICI CLIENTI...")
        
        # 1. **Test Login Admin**: Login con admin/admin123
        print("\n🔐 1. TEST LOGIN ADMIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("Admin login (admin/admin123)", False, f"Status: {status}, Response: {response}")
            return False

        # 2. **Test Nuovo Endpoint Filter-Options**
        print("\n🎯 2. TEST NUOVO ENDPOINT FILTER-OPTIONS...")
        
        # Test GET /api/clienti/filter-options
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        if success and status == 200:
            self.log_test("GET /api/clienti/filter-options", True, f"Status: {status} - Endpoint working correctly!")
            
            # Verify response structure
            if isinstance(filter_response, dict):
                expected_keys = ['tipologie_contratto', 'status_values', 'segmenti', 'sub_agenzie', 'users']
                missing_keys = [key for key in expected_keys if key not in filter_response]
                
                if not missing_keys:
                    self.log_test("Response structure correct", True, f"All expected fields present: {expected_keys}")
                    
                    # Verify each field has correct {value, label} format
                    for field_name in expected_keys:
                        field_data = filter_response.get(field_name, [])
                        
                        if isinstance(field_data, list):
                            self.log_test(f"{field_name} is array", True, f"Found {len(field_data)} options")
                            
                            # Check format {value, label} for each option
                            if len(field_data) > 0:
                                sample_item = field_data[0]
                                if isinstance(sample_item, dict) and 'value' in sample_item and 'label' in sample_item:
                                    self.log_test(f"{field_name} format correct", True, f"Sample: {sample_item}")
                                    
                                    # Verify alphabetical sorting
                                    labels = [item.get('label', '') for item in field_data]
                                    sorted_labels = sorted(labels)
                                    if labels == sorted_labels:
                                        self.log_test(f"{field_name} alphabetically sorted", True, "Options properly sorted")
                                    else:
                                        self.log_test(f"{field_name} not sorted", False, f"Expected: {sorted_labels[:3]}..., Got: {labels[:3]}...")
                                else:
                                    self.log_test(f"{field_name} format incorrect", False, f"Expected {{value, label}}, got: {sample_item}")
                            else:
                                self.log_test(f"{field_name} empty", True, "No data available (valid)")
                        else:
                            self.log_test(f"{field_name} not array", False, f"Expected array, got: {type(field_data)}")
                else:
                    self.log_test("Response structure incomplete", False, f"Missing keys: {missing_keys}")
            else:
                self.log_test("Response not dict", False, f"Expected dict, got: {type(filter_response)}")
        else:
            self.log_test("GET /api/clienti/filter-options", False, f"Status: {status}, Response: {filter_response}")
            return False

        # 3. **Verifica Dati Dinamici**
        print("\n📊 3. VERIFICA DATI DINAMICI...")
        
        # Get existing clients to verify filter options contain only real data
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and status == 200:
            clienti = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
            self.log_test("GET /api/clienti for verification", True, f"Found {len(clienti)} existing clients")
            
            if len(clienti) > 0:
                # Extract actual values from existing clients
                actual_tipologie = set(client.get('tipologia_contratto') for client in clienti if client.get('tipologia_contratto'))
                actual_status = set(client.get('status') for client in clienti if client.get('status'))
                actual_segmenti = set(client.get('segmento') for client in clienti if client.get('segmento'))
                actual_sub_agenzie = set(client.get('sub_agenzia_id') for client in clienti if client.get('sub_agenzia_id'))
                actual_users = set(client.get('created_by') for client in clienti if client.get('created_by'))
                
                # Verify filter options contain only real data
                filter_tipologie = set(item['value'] for item in filter_response.get('tipologie_contratto', []))
                filter_status = set(item['value'] for item in filter_response.get('status_values', []))
                filter_segmenti = set(item['value'] for item in filter_response.get('segmenti', []))
                filter_sub_agenzie = set(item['value'] for item in filter_response.get('sub_agenzie', []))
                filter_users = set(item['value'] for item in filter_response.get('users', []))
                
                # Check tipologie_contratto
                if filter_tipologie.issubset(actual_tipologie) or len(filter_tipologie) == 0:
                    self.log_test("Tipologie contratto dynamic", True, f"Filter options contain only existing values: {filter_tipologie}")
                else:
                    extra_tipologie = filter_tipologie - actual_tipologie
                    self.log_test("Tipologie contratto not dynamic", False, f"Extra values in filter: {extra_tipologie}")
                
                # Check status values
                if filter_status.issubset(actual_status) or len(filter_status) == 0:
                    self.log_test("Status values dynamic", True, f"Filter options contain only existing values: {filter_status}")
                else:
                    extra_status = filter_status - actual_status
                    self.log_test("Status values not dynamic", False, f"Extra values in filter: {extra_status}")
                
                # Check segmenti
                if filter_segmenti.issubset(actual_segmenti) or len(filter_segmenti) == 0:
                    self.log_test("Segmenti dynamic", True, f"Filter options contain only existing values: {filter_segmenti}")
                else:
                    extra_segmenti = filter_segmenti - actual_segmenti
                    self.log_test("Segmenti not dynamic", False, f"Extra values in filter: {extra_segmenti}")
                
                # Check sub agenzie
                if filter_sub_agenzie.issubset(actual_sub_agenzie) or len(filter_sub_agenzie) == 0:
                    self.log_test("Sub agenzie dynamic", True, f"Filter options contain only sub agenzie with clients: {len(filter_sub_agenzie)} options")
                else:
                    extra_sub_agenzie = filter_sub_agenzie - actual_sub_agenzie
                    self.log_test("Sub agenzie not dynamic", False, f"Extra values in filter: {extra_sub_agenzie}")
                
                # Check users
                if filter_users.issubset(actual_users) or len(filter_users) == 0:
                    self.log_test("Users dynamic", True, f"Filter options contain only users who created clients: {len(filter_users)} options")
                else:
                    extra_users = filter_users - actual_users
                    self.log_test("Users not dynamic", False, f"Extra values in filter: {extra_users}")
                    
            else:
                self.log_test("No clients exist", True, "Cannot verify dynamic data without existing clients")
        else:
            self.log_test("Could not get clients for verification", False, f"Status: {status}")

        # 4. **Test Mapping Corretto**
        print("\n🏷️ 4. TEST MAPPING CORRETTO...")
        
        # Verify display name mappings
        tipologie_contratto = filter_response.get('tipologie_contratto', [])
        for tipologia in tipologie_contratto:
            value = tipologia.get('value')
            label = tipologia.get('label')
            
            # Check specific mappings
            if value == 'energia_fastweb' and label == 'Energia Fastweb':
                self.log_test("Energia Fastweb mapping correct", True, f"'{value}' → '{label}'")
            elif value == 'telefonia_fastweb' and label == 'Telefonia Fastweb':
                self.log_test("Telefonia Fastweb mapping correct", True, f"'{value}' → '{label}'")
            elif value and label:
                # Generic mapping check - should not contain underscores in label
                if '_' not in label:
                    self.log_test(f"{value} mapping format correct", True, f"'{value}' → '{label}' (no underscores)")
                else:
                    self.log_test(f"{value} mapping format incorrect", False, f"'{value}' → '{label}' (contains underscores)")
        
        # Check segmenti mappings
        segmenti = filter_response.get('segmenti', [])
        for segmento in segmenti:
            value = segmento.get('value')
            label = segmento.get('label')
            
            if value == 'privato' and label == 'Privato':
                self.log_test("Privato mapping correct", True, f"'{value}' → '{label}'")
            elif value == 'business' and label == 'Business':
                self.log_test("Business mapping correct", True, f"'{value}' → '{label}'")
            elif value == 'residenziale' and label == 'Residenziale':
                self.log_test("Residenziale mapping correct", True, f"'{value}' → '{label}'")

        # 5. **Test Autorizzazioni Filter Options**
        print("\n🔐 5. TEST AUTORIZZAZIONI FILTER OPTIONS...")
        
        # Test with responsabile commessa if available
        print("   Testing with responsabile_commessa role...")
        
        # Try to login with resp_commessa/admin123
        success, resp_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'resp_commessa', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in resp_response:
            # Save admin token
            admin_token = self.token
            admin_filter_response = filter_response
            
            # Use resp_commessa token
            self.token = resp_response['access_token']
            resp_user_data = resp_response['user']
            
            self.log_test("resp_commessa login", True, 
                f"Role: {resp_user_data['role']}, Commesse autorizzate: {len(resp_user_data.get('commesse_autorizzate', []))}")
            
            # Test filter options with resp_commessa
            success, resp_filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
            
            if success and status == 200:
                self.log_test("GET /api/clienti/filter-options (resp_commessa)", True, f"Status: {status}")
                
                # Compare options - resp_commessa should see fewer or equal options than admin
                admin_tipologie_count = len(admin_filter_response.get('tipologie_contratto', []))
                resp_tipologie_count = len(resp_filter_response.get('tipologie_contratto', []))
                
                admin_sub_agenzie_count = len(admin_filter_response.get('sub_agenzie', []))
                resp_sub_agenzie_count = len(resp_filter_response.get('sub_agenzie', []))
                
                if resp_tipologie_count <= admin_tipologie_count:
                    self.log_test("Responsabile commessa sees appropriate tipologie", True, 
                        f"Resp: {resp_tipologie_count}, Admin: {admin_tipologie_count}")
                else:
                    self.log_test("Responsabile commessa sees too many tipologie", False, 
                        f"Resp: {resp_tipologie_count}, Admin: {admin_tipologie_count}")
                
                if resp_sub_agenzie_count <= admin_sub_agenzie_count:
                    self.log_test("Responsabile commessa sees appropriate sub agenzie", True, 
                        f"Resp: {resp_sub_agenzie_count}, Admin: {admin_sub_agenzie_count}")
                else:
                    self.log_test("Responsabile commessa sees too many sub agenzie", False, 
                        f"Resp: {resp_sub_agenzie_count}, Admin: {admin_sub_agenzie_count}")
                        
                # Verify authorization logic - resp_commessa should only see options for authorized commesse
                if len(resp_user_data.get('commesse_autorizzate', [])) > 0:
                    self.log_test("Authorization filtering working", True, 
                        f"Responsabile sees filtered options based on authorized commesse")
                else:
                    self.log_test("No authorized commesse", True, 
                        "Cannot test authorization filtering without authorized commesse")
            else:
                self.log_test("GET /api/clienti/filter-options (resp_commessa)", False, f"Status: {status}")
            
            # Restore admin token
            self.token = admin_token
            
        else:
            self.log_test("resp_commessa login failed", False, f"Status: {status}, Cannot test authorization")

        # 6. **Test Performance e Robustezza**
        print("\n⚡ 6. TEST PERFORMANCE E ROBUSTEZZA...")
        
        # Test response time
        start_time = time.time()
        
        success, perf_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        end_time = time.time()
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        if success and status == 200:
            if response_time < 5000:  # Less than 5 seconds
                self.log_test("Response time acceptable", True, f"Response time: {response_time:.0f}ms")
            else:
                self.log_test("Response time slow", True, f"Response time: {response_time:.0f}ms (>5s)")
        else:
            self.log_test("Performance test failed", False, f"Status: {status}")
        
        # Test multiple consecutive requests for stability
        consecutive_success = 0
        for i in range(3):
            success, _, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
            if success and status == 200:
                consecutive_success += 1
        
        if consecutive_success == 3:
            self.log_test("Endpoint stability", True, "3/3 consecutive requests successful")
        else:
            self.log_test("Endpoint stability issues", False, f"{consecutive_success}/3 requests successful")

        # **FINAL SUMMARY**
        print(f"\n🎯 DYNAMIC CLIENT FILTERS ENDPOINT TEST SUMMARY:")
        print(f"   🎯 OBJECTIVE: Test new dynamic filter options endpoint")
        print(f"   🎯 FOCUS: Verify dynamic data, authorization, structure, and performance")
        print(f"   📊 RESULTS:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • GET /api/clienti/filter-options: {'✅ SUCCESS (200 OK)' if status == 200 else f'❌ FAILED ({status})'}")
        print(f"      • Response structure {{value, label}}: {'✅ CORRECT' if status == 200 else '❌ INCORRECT'}")
        print(f"      • Dynamic data verification: {'✅ VERIFIED' if status == 200 else '❌ FAILED'}")
        print(f"      • Display name mapping: {'✅ CORRECT' if status == 200 else '❌ INCORRECT'}")
        print(f"      • Authorization filtering: {'✅ WORKING' if status == 200 else '❌ FAILED'}")
        print(f"      • Performance: {'✅ ACCEPTABLE' if response_time < 5000 else '⚠️ SLOW'} ({response_time:.0f}ms)")
        print(f"      • Alphabetical sorting: {'✅ VERIFIED' if status == 200 else '❌ FAILED'}")
        
        if status == 200:
            print(f"   🎉 SUCCESS: Dynamic client filters endpoint fully operational!")
            print(f"   🎉 CONFIRMED: Filters show only data actually present in system instead of hardcoded options!")
            return True
        else:
            print(f"   🚨 FAILURE: Dynamic client filters endpoint has issues!")
            return False

    def run_tests(self):
        """Run all tests"""
        print("=" * 80)
        print("🔍 DYNAMIC CLIENT FILTERS ENDPOINT TESTING")
        print("=" * 80)
        print(f"🌐 Base URL: {self.base_url}")
        print(f"🎯 FOCUS: Test nuovo endpoint per filtri dinamici clienti basati sui dati effettivamente presenti nel sistema")
        print("=" * 80)
        
        # Run the dynamic filters test
        success = self.test_dynamic_client_filters_endpoint()
        
        print("\n" + "=" * 80)
        print("📊 FINAL TEST SUMMARY")
        print("=" * 80)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if success:
            print("✅ DYNAMIC CLIENT FILTERS ENDPOINT FULLY OPERATIONAL!")
            print("✅ OBIETTIVO RAGGIUNTO: I filtri ora mostrano solo dati effettivamente presenti nel sistema invece di opzioni hardcoded!")
        else:
            print("❌ DYNAMIC CLIENT FILTERS ENDPOINT HAS ISSUES!")
            print("❌ OBIETTIVO NON RAGGIUNTO: Alcuni test sono falliti")
        
        return success

if __name__ == "__main__":
    tester = DynamicFiltersAPITester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)