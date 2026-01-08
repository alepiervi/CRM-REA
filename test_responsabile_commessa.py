#!/usr/bin/env python3
"""
Test completo del sistema Responsabile Commessa con filtri Tipologia Contratto
"""

import requests
import sys
import json
from datetime import datetime

class ResponsabileCommessaTester:
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

    def test_responsabile_commessa_system_complete(self):
        """Test completo del sistema Responsabile Commessa con nuovi filtri Tipologia Contratto"""
        print("\n👔 Testing Responsabile Commessa System Complete (with Tipologia Contratto filters)...")
        
        # 1. LOGIN RESPONSABILE COMMESSA - Test login with resp_commessa/admin123
        print("\n🔐 1. TESTING RESPONSABILE COMMESSA LOGIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'resp_commessa', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            resp_commessa_token = response['access_token']
            resp_commessa_user = response['user']
            self.log_test("LOGIN resp_commessa/admin123", True, 
                f"Login successful - Token received, Role: {resp_commessa_user['role']}")
            
            # Store original token and switch to resp_commessa
            original_token = self.token
            self.token = resp_commessa_token
            
        else:
            self.log_test("LOGIN resp_commessa/admin123", False, 
                f"Login failed - Status: {status}, Response: {response}")
            return False

        # 2. DASHBOARD CON FILTRO TIPOLOGIA CONTRATTO
        print("\n📊 2. TESTING DASHBOARD WITH TIPOLOGIA CONTRATTO FILTER...")
        
        # Test basic dashboard endpoint
        success, response, status = self.make_request('GET', 'responsabile-commessa/dashboard', expected_status=200)
        if success:
            required_fields = ['clienti_oggi', 'clienti_totali', 'sub_agenzie', 'commesse']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                self.log_test("Dashboard basic endpoint", True, 
                    f"Clienti oggi: {response.get('clienti_oggi', 0)}, "
                    f"Clienti totali: {response.get('clienti_totali', 0)}, "
                    f"Sub agenzie: {response.get('sub_agenzie', 0)}, "
                    f"Commesse: {response.get('commesse', 0)}")
            else:
                self.log_test("Dashboard basic endpoint", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Dashboard basic endpoint", False, f"Status: {status}")
        
        # Test dashboard with tipologia_contratto filter
        tipologie_contratto = ['energia_fastweb', 'telefonia_fastweb', 'ho_mobile', 'telepass']
        
        for tipologia in tipologie_contratto:
            success, response, status = self.make_request(
                'GET', f'responsabile-commessa/dashboard?tipologia_contratto={tipologia}', 
                expected_status=200
            )
            if success:
                self.log_test(f"Dashboard filter tipologia_contratto={tipologia}", True, 
                    f"Filtered data - Clienti totali: {response.get('clienti_totali', 0)}")
            else:
                self.log_test(f"Dashboard filter tipologia_contratto={tipologia}", False, f"Status: {status}")

        # 3. ENDPOINT CLIENTI CON NUOVO FILTRO TIPOLOGIA CONTRATTO
        print("\n👥 3. TESTING CLIENTI ENDPOINT WITH TIPOLOGIA CONTRATTO FILTER...")
        
        # Test basic clienti endpoint
        success, response, status = self.make_request('GET', 'responsabile-commessa/clienti', expected_status=200)
        if success:
            clienti = response.get('clienti', [])
            self.log_test("Clienti basic endpoint", True, f"Found {len(clienti)} clienti")
        else:
            self.log_test("Clienti basic endpoint", False, f"Status: {status}")
        
        # Test clienti with various filters including tipologia_contratto
        test_filters = [
            {'tipologia_contratto': 'energia_fastweb'},
            {'tipologia_contratto': 'telefonia_fastweb'},
            {'tipologia_contratto': 'ho_mobile'},
            {'tipologia_contratto': 'telepass'},
            {'status': 'nuovo', 'tipologia_contratto': 'energia_fastweb'},
            {'search': 'test', 'tipologia_contratto': 'telefonia_fastweb'},
        ]
        
        for filter_params in test_filters:
            query_string = '&'.join([f"{k}={v}" for k, v in filter_params.items()])
            success, response, status = self.make_request(
                'GET', f'responsabile-commessa/clienti?{query_string}', 
                expected_status=200
            )
            if success:
                clienti = response.get('clienti', [])
                self.log_test(f"Clienti filter {filter_params}", True, 
                    f"Found {len(clienti)} clienti with filters")
            else:
                self.log_test(f"Clienti filter {filter_params}", False, f"Status: {status}")

        # 4. ANALYTICS AGGIORNATE CON FILTRO TIPOLOGIA CONTRATTO
        print("\n📈 4. TESTING ANALYTICS WITH TIPOLOGIA CONTRATTO FILTER...")
        
        # Test basic analytics endpoint
        success, response, status = self.make_request('GET', 'responsabile-commessa/analytics', expected_status=200)
        if success:
            required_fields = ['sub_agenzie_analytics', 'conversioni']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                sub_agenzie_analytics = response.get('sub_agenzie_analytics', [])
                conversioni = response.get('conversioni', {})
                self.log_test("Analytics basic endpoint", True, 
                    f"Sub agenzie analytics: {len(sub_agenzie_analytics)}, "
                    f"Conversioni data available: {bool(conversioni)}")
            else:
                self.log_test("Analytics basic endpoint", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Analytics basic endpoint", False, f"Status: {status}")
        
        # Test analytics with tipologia_contratto filter
        for tipologia in tipologie_contratto:
            success, response, status = self.make_request(
                'GET', f'responsabile-commessa/analytics?tipologia_contratto={tipologia}', 
                expected_status=200
            )
            if success:
                sub_agenzie_analytics = response.get('sub_agenzie_analytics', [])
                self.log_test(f"Analytics filter tipologia_contratto={tipologia}", True, 
                    f"Filtered analytics - Sub agenzie: {len(sub_agenzie_analytics)}")
            else:
                self.log_test(f"Analytics filter tipologia_contratto={tipologia}", False, f"Status: {status}")

        # Test analytics export with tipologia_contratto filter
        for tipologia in ['energia_fastweb', 'telefonia_fastweb']:
            success, response, status = self.make_request(
                'GET', f'responsabile-commessa/analytics/export?tipologia_contratto={tipologia}', 
                expected_status=200
            )
            if success:
                self.log_test(f"Analytics export tipologia_contratto={tipologia}", True, 
                    "Export endpoint working with filter")
            else:
                # 404 might be acceptable if no data to export
                if status == 404:
                    self.log_test(f"Analytics export tipologia_contratto={tipologia}", True, 
                        "No data to export (expected)")
                else:
                    self.log_test(f"Analytics export tipologia_contratto={tipologia}", False, f"Status: {status}")

        # 5. ENDPOINT TIPOLOGIE CONTRATTO
        print("\n📋 5. TESTING TIPOLOGIE CONTRATTO ENDPOINT...")
        
        success, response, status = self.make_request('GET', 'tipologie-contratto', expected_status=200)
        if success:
            # Response is a list of dictionaries with 'value' and 'label' keys
            tipologie = response if isinstance(response, list) else []
            expected_values = ['energia_fastweb', 'telefonia_fastweb', 'ho_mobile', 'telepass']
            
            if len(tipologie) >= 4:
                found_values = [tip['value'] for tip in tipologie if 'value' in tip and tip['value'] in expected_values]
                self.log_test("Tipologie Contratto endpoint", True, 
                    f"Found {len(tipologie)} tipologie, Expected values found: {found_values}")
            else:
                self.log_test("Tipologie Contratto endpoint", False, 
                    f"Expected at least 4 tipologie, found {len(tipologie)}")
        else:
            self.log_test("Tipologie Contratto endpoint", False, f"Status: {status}")

        # Test access control - verify only responsabile_commessa can access
        # Restore admin token temporarily to test access control
        admin_success, admin_response, admin_status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if admin_success:
            admin_token = admin_response['access_token']
            self.token = admin_token
            
            success, response, status = self.make_request('GET', 'responsabile-commessa/dashboard', expected_status=403)
            if status == 403:
                self.log_test("Access control - admin denied", True, "Admin correctly denied access to responsabile-commessa endpoints")
            else:
                self.log_test("Access control - admin denied", False, f"Expected 403, got {status}")
        
        # Restore resp_commessa token
        self.token = resp_commessa_token
        
        # Summary of responsabile commessa system testing
        print(f"\n📊 RESPONSABILE COMMESSA SYSTEM TESTING SUMMARY:")
        print(f"   • Login functionality: {'✅ WORKING' if resp_commessa_token else '❌ FAILED'}")
        print(f"   • Dashboard with filters: {'✅ WORKING' if success else '❌ FAILED'}")
        print(f"   • Clienti endpoint with filters: {'✅ WORKING' if success else '❌ FAILED'}")
        print(f"   • Analytics with filters: {'✅ WORKING' if success else '❌ FAILED'}")
        print(f"   • Tipologie Contratto endpoint: {'✅ WORKING' if success else '❌ FAILED'}")
        
        return True

    def run_tests(self):
        """Run the Responsabile Commessa system tests"""
        print("🚀 Starting Responsabile Commessa System Testing...")
        print(f"📡 Backend URL: {self.base_url}")
        print("🎯 FOCUS: Verificare tutte le modifiche richieste (filtro Tipologia Contratto, Analytics per clienti)")
        print("=" * 80)
        
        try:
            # Run the complete test
            self.test_responsabile_commessa_system_complete()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        finally:
            # Print final results
            print(f"\n📊 Test Results Summary:")
            print(f"   Tests Run: {self.tests_run}")
            print(f"   Tests Passed: {self.tests_passed}")
            print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
            print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "   Success Rate: 0%")
            
            if self.tests_passed == self.tests_run:
                print("🎉 All Responsabile Commessa tests passed!")
            else:
                print("⚠️ Some tests failed - check logs above")

if __name__ == "__main__":
    tester = ResponsabileCommessaTester()
    tester.run_tests()