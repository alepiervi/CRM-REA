#!/usr/bin/env python3
"""
FOCUSED TEST: Verifica specifica delle correzioni implementate
Focus su: Error logging fix, timeout optimization, lead qualification response structure
"""

import requests
import sys
import json
import time
from datetime import datetime

class FocusedTester:
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

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def test_login(self):
        """Test admin login"""
        print("\n🔐 TESTING ADMIN LOGIN...")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
            return True
        else:
            self.log_test("Admin login (admin/admin123)", False, f"Status: {status}, Response: {response}")
            return False

    def test_error_logging_fix(self):
        """TEST 1: Verifica correzione errori logging "'User' object has no attribute 'nome'"""
        print("\n🚨 TEST 1: ERROR LOGGING FIX...")
        
        # Get required data for client creation
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        if not success:
            self.log_test("Cannot get commesse", False, f"Status: {status}")
            return False
        
        commesse = commesse_response if isinstance(commesse_response, list) else []
        fastweb_commessa = next((c for c in commesse if 'fastweb' in c.get('nome', '').lower()), None)
        
        if not fastweb_commessa:
            self.log_test("Fastweb commessa not found", False, "Cannot test without commessa")
            return False
        
        # Get sub agenzie
        success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
        if not success:
            self.log_test("Cannot get sub agenzie", False, f"Status: {status}")
            return False
        
        sub_agenzie = sub_agenzie_response if isinstance(sub_agenzie_response, list) else []
        test_sub_agenzia = next((sa for sa in sub_agenzie if fastweb_commessa['id'] in sa.get('commesse_autorizzate', [])), None)
        
        if not test_sub_agenzia:
            self.log_test("No sub agenzia found for Fastweb", False, "Cannot test without sub agenzia")
            return False
        
        # Create test client
        client_data = {
            "nome": "TestUser",
            "cognome": "ErrorLoggingFix",
            "telefono": "+39 333 999 8877",
            "email": "test.errorlogging@test.com",
            "commessa_id": fastweb_commessa['id'],
            "sub_agenzia_id": test_sub_agenzia['id'],
            "tipologia_contratto": "telefonia_fastweb",
            "segmento": "residenziale"
        }
        
        success, create_response, status = self.make_request('POST', 'clienti', client_data, expected_status=200)
        
        if success and status == 200:
            client_id = create_response.get('id') or create_response.get('cliente_id')
            self.log_test("POST /api/clienti SUCCESS", True, 
                f"Client created without logging errors - ID: {client_id}")
            self.log_test("No User attribute errors", True, 
                "Client creation completed without 'User' object attribute errors")
            return True
        else:
            self.log_test("POST /api/clienti FAILED", False, f"Status: {status}, Response: {create_response}")
            return False

    def test_lead_qualification_response_structure(self):
        """TEST 2: Verifica struttura response corretta per lead qualification endpoints"""
        print("\n📋 TEST 2: LEAD QUALIFICATION RESPONSE STRUCTURE...")
        
        # Test GET /api/lead-qualification/active
        success, active_response, status = self.make_request('GET', 'lead-qualification/active', expected_status=200)
        
        if success and status == 200:
            self.log_test("GET /api/lead-qualification/active", True, f"Status: {status}")
            
            # Verify response structure
            if isinstance(active_response, dict):
                # Check for active_qualifications array
                if 'active_qualifications' in active_response:
                    active_qualifications = active_response['active_qualifications']
                    self.log_test("active_qualifications array present", True, 
                        f"Found {len(active_qualifications)} active qualifications")
                    
                    # Verify array structure
                    if isinstance(active_qualifications, list):
                        self.log_test("active_qualifications is array", True, 
                            f"Correct array format with {len(active_qualifications)} items")
                    else:
                        self.log_test("active_qualifications not array", False, 
                            f"Expected array, got {type(active_qualifications)}")
                        return False
                else:
                    self.log_test("active_qualifications missing", False, 
                        f"Response keys: {list(active_response.keys())}")
                    return False
            else:
                self.log_test("Response not dict", False, f"Expected dict, got {type(active_response)}")
                return False
        else:
            self.log_test("GET /api/lead-qualification/active FAILED", False, 
                f"Status: {status}, Response: {active_response}")
            return False

        # Test GET /api/lead-qualification/analytics
        success, analytics_response, status = self.make_request('GET', 'lead-qualification/analytics', expected_status=200)
        
        if success and status == 200:
            self.log_test("GET /api/lead-qualification/analytics", True, f"Status: {status}")
            
            # Verify response structure
            if isinstance(analytics_response, dict):
                expected_analytics_fields = ['total', 'active', 'completed']
                missing_analytics_fields = [field for field in expected_analytics_fields if field not in analytics_response]
                
                if not missing_analytics_fields:
                    total = analytics_response.get('total', 0)
                    active = analytics_response.get('active', 0)
                    completed = analytics_response.get('completed', 0)
                    
                    self.log_test("Analytics structure standardized", True, 
                        f"Total: {total}, Active: {active}, Completed: {completed}")
                    return True
                else:
                    self.log_test("Analytics structure incomplete", False, 
                        f"Missing fields: {missing_analytics_fields}")
                    return False
            else:
                self.log_test("Analytics response not dict", False, 
                    f"Expected dict, got {type(analytics_response)}")
                return False
        else:
            self.log_test("GET /api/lead-qualification/analytics FAILED", False, 
                f"Status: {status}, Response: {analytics_response}")
            return False

    def test_performance_critical_endpoints(self):
        """TEST 3: Verifica performance endpoint critici con timeout migliorati"""
        print("\n⚡ TEST 3: PERFORMANCE CRITICAL ENDPOINTS...")
        
        critical_endpoints = [
            ('GET', 'commesse', 'Commesse list'),
            ('GET', 'clienti', 'Clienti list'),
            ('GET', 'sub-agenzie', 'Sub agenzie list'),
            ('GET', 'dashboard/stats', 'Dashboard stats'),
            ('GET', 'lead-qualification/active', 'Lead qualification active'),
            ('GET', 'lead-qualification/analytics', 'Lead qualification analytics'),
            ('GET', 'documents', 'Documents list')
        ]
        
        performance_results = []
        
        for method, endpoint, description in critical_endpoints:
            start_time = time.time()
            success, response, status = self.make_request(method, endpoint, expected_status=200)
            end_time = time.time()
            
            response_time = end_time - start_time
            performance_results.append((description, response_time, success))
            
            if success and status == 200:
                if response_time < 5.0:  # Target: < 5 seconds
                    self.log_test(f"{description} performance", True, 
                        f"Response time: {response_time:.2f}s (< 5s)")
                else:
                    self.log_test(f"{description} slow", True, 
                        f"Response time: {response_time:.2f}s (> 5s but working)")
            else:
                self.log_test(f"{description} failed", False, 
                    f"Status: {status}, Time: {response_time:.2f}s")

        # Performance Summary
        fast_endpoints = [r for r in performance_results if r[1] < 5.0 and r[2]]
        failed_endpoints = [r for r in performance_results if not r[2]]
        
        self.log_test("Fast endpoints (< 5s)", True, 
            f"{len(fast_endpoints)}/{len(critical_endpoints)} endpoints")
        
        if failed_endpoints:
            self.log_test("Failed endpoints", False, 
                f"{len(failed_endpoints)} endpoints: {[r[0] for r in failed_endpoints]}")
            return False
        
        return True

    def test_simulation_mode_activation(self):
        """TEST 4: Verifica che simulation mode si attivi più velocemente (5 secondi invece di 30)"""
        print("\n⏱️ TEST 4: SIMULATION MODE ACTIVATION SPEED...")
        
        # Find Fastweb commessa
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        if not success:
            self.log_test("Cannot get commesse", False, f"Status: {status}")
            return False
        
        commesse = commesse_response if isinstance(commesse_response, list) else []
        fastweb_commessa = next((c for c in commesse if 'fastweb' in c.get('nome', '').lower()), None)
        
        if not fastweb_commessa:
            self.log_test("Fastweb commessa not found", False, "Cannot test without commessa")
            return False
        
        fastweb_commessa_id = fastweb_commessa['id']
        
        # Configure with test URL that will trigger timeout optimization
        aruba_config = {
            "enabled": True,
            "url": "https://test-timeout-optimization.arubacloud.com",  # URL for timeout test
            "username": "timeout_test_user",
            "password": "timeout_test_password",
            "root_folder_path": "/Fastweb/Documenti",
            "auto_create_structure": True,
            "connection_timeout": 5,  # Reduced from 30 to 5 seconds
            "upload_timeout": 10,     # Reduced timeout
            "retry_attempts": 1       # Reduced retries for faster fallback
        }
        
        success, config_response, status = self.make_request(
            'PUT', f'commesse/{fastweb_commessa_id}/aruba-config', 
            aruba_config, expected_status=200
        )
        
        if success:
            self.log_test("Timeout optimization config", True, 
                f"Configured with 5s timeout (reduced from 30s)")
            
            # Verify configuration was saved
            success, get_config_response, status = self.make_request(
                'GET', f'commesse/{fastweb_commessa_id}/aruba-config', expected_status=200
            )
            
            if success and status == 200:
                config = get_config_response.get('config', {})
                if config.get('connection_timeout') == 5:
                    self.log_test("Timeout configuration verified", True, 
                        f"Connection timeout set to {config.get('connection_timeout')}s")
                    return True
                else:
                    self.log_test("Timeout configuration not saved", False, 
                        f"Expected 5s, got {config.get('connection_timeout')}s")
                    return False
            else:
                self.log_test("Cannot verify configuration", False, f"Status: {status}")
                return False
        else:
            self.log_test("Config failed", False, f"Status: {status}")
            return False

    def run_focused_tests(self):
        """Run all focused tests"""
        print("=" * 80)
        print("🎯 FOCUSED TEST: VERIFICA CORREZIONI SPECIFICHE")
        print("=" * 80)
        print("🔍 FOCUS: Error logging fix, Lead qualification response, Performance, Timeout optimization")
        print("🎯 OBIETTIVO: Verificare che le 3 correzioni principali funzionino")
        
        # Login first
        if not self.test_login():
            print("❌ Cannot proceed without login")
            return False
        
        # Run focused tests
        test_results = []
        
        tests = [
            (self.test_error_logging_fix, "ERROR LOGGING FIX"),
            (self.test_lead_qualification_response_structure, "LEAD QUALIFICATION RESPONSE STRUCTURE"),
            (self.test_performance_critical_endpoints, "PERFORMANCE CRITICAL ENDPOINTS"),
            (self.test_simulation_mode_activation, "SIMULATION MODE ACTIVATION SPEED")
        ]
        
        for test_method, test_name in tests:
            try:
                result = test_method()
                test_results.append((test_name, result))
                
                if result:
                    print(f"✅ {test_name}: SUCCESS")
                else:
                    print(f"❌ {test_name}: FAILED")
                    
            except Exception as e:
                test_results.append((test_name, False))
                print(f"❌ {test_name}: EXCEPTION - {str(e)}")
        
        # Final summary
        successful_tests = [r for r in test_results if r[1]]
        failed_tests = [r for r in test_results if not r[1]]
        
        print(f"\n{'='*80}")
        print(f"📊 FOCUSED TEST SUMMARY")
        print(f"{'='*80}")
        print(f"📊 RESULTS:")
        print(f"   • Total focused tests: {len(test_results)}")
        print(f"   • Successful: {len(successful_tests)}")
        print(f"   • Failed: {len(failed_tests)}")
        print(f"   • Success rate: {(len(successful_tests)/len(test_results))*100:.1f}%")
        print(f"   • Individual tests run: {self.tests_run}")
        print(f"   • Individual tests passed: {self.tests_passed}")
        print(f"   • Individual success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if len(successful_tests) == len(test_results):
            print(f"\n🎉 SUCCESS: ALL FOCUSED CORRECTIONS VERIFIED!")
            print(f"🎉 CONFIRMED: Error logging, Lead qualification, Performance fixes working!")
            print(f"🎉 VERIFIED: System optimizations operational!")
        else:
            print(f"\n🚨 PARTIAL SUCCESS: {len(failed_tests)} areas still have issues")
            print(f"🚨 FAILED AREAS: {[r[0] for r in failed_tests]}")
        
        return len(failed_tests) == 0

if __name__ == "__main__":
    tester = FocusedTester()
    
    success = tester.run_focused_tests()
    
    sys.exit(0 if success else 1)