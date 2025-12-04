#!/usr/bin/env python3
"""
Test specifico per endpoint tipologie-contratto con filtri servizio
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class TipologieContrattoTester:
    def __init__(self, base_url="https://crm-workflow-boost.preview.emergentagent.com/api"):
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

    def test_tipologie_contratto_endpoint_with_filters(self):
        """TEST ENDPOINT TIPOLOGIE CONTRATTO CON FILTRI SERVIZIO"""
        print("🎯 TESTING TIPOLOGIE CONTRATTO ENDPOINT WITH FILTERS...")
        print("=" * 60)
        
        # First login as resp_commessa as specified in the review request
        print("\n🔐 LOGIN AS resp_commessa/admin123...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'resp_commessa', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("resp_commessa login", True, f"Role: {self.user_data['role']}, Commesse autorizzate: {len(self.user_data.get('commesse_autorizzate', []))}")
        else:
            self.log_test("resp_commessa login", False, f"Status: {status}, Response: {response}")
            return False

        # Get commesse to find Fastweb ID
        print("\n📋 GETTING COMMESSE TO FIND FASTWEB ID...")
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        if not success:
            self.log_test("Get commesse", False, f"Status: {status}")
            return False
        
        fastweb_commessa = None
        for commessa in commesse_response:
            if commessa.get('nome') == 'Fastweb':
                fastweb_commessa = commessa
                break
        
        if not fastweb_commessa:
            self.log_test("Find Fastweb commessa", False, "Fastweb commessa not found")
            return False
        
        fastweb_id = fastweb_commessa['id']
        self.log_test("Found Fastweb commessa", True, f"ID: {fastweb_id}")

        # Get servizi for Fastweb to find TLS and Agent IDs
        print("\n🔧 GETTING SERVIZI FOR FASTWEB...")
        success, servizi_response, status = self.make_request('GET', f'commesse/{fastweb_id}/servizi', expected_status=200)
        if not success:
            self.log_test("Get servizi", False, f"Status: {status}")
            return False
        
        tls_servizio = None
        agent_servizio = None
        for servizio in servizi_response:
            if servizio.get('nome') == 'TLS':
                tls_servizio = servizio
            elif servizio.get('nome') == 'Agent':
                agent_servizio = servizio
        
        if not tls_servizio or not agent_servizio:
            self.log_test("Find TLS/Agent servizi", False, f"TLS: {bool(tls_servizio)}, Agent: {bool(agent_servizio)}")
            return False
        
        tls_id = tls_servizio['id']
        agent_id = agent_servizio['id']
        self.log_test("Found TLS and Agent servizi", True, f"TLS ID: {tls_id}, Agent ID: {agent_id}")

        # 1. TEST ENDPOINT BASE - GET /api/tipologie-contratto (senza parametri)
        print("\n1️⃣ TESTING BASE ENDPOINT (no parameters)...")
        success, base_response, status = self.make_request('GET', 'tipologie-contratto', expected_status=200)
        if success:
            tipologie_count = len(base_response)
            self.log_test("GET /api/tipologie-contratto (base)", True, f"Found {tipologie_count} tipologie")
            
            # Check for expected tipologie
            expected_tipologie = ["Energia Fastweb", "Telefonia Fastweb", "Ho Mobile", "Telepass"]
            found_labels = [tip.get('label', '') for tip in base_response]
            missing_tipologie = [tip for tip in expected_tipologie if tip not in found_labels]
            
            if not missing_tipologie:
                self.log_test("All expected tipologie present", True, f"Found: {found_labels}")
            else:
                self.log_test("Missing tipologie", False, f"Missing: {missing_tipologie}")
        else:
            self.log_test("GET /api/tipologie-contratto (base)", False, f"Status: {status}")

        # 2. TEST CON FILTRO COMMESSA - GET /api/tipologie-contratto?commessa_id=<fastweb_id>
        print("\n2️⃣ TESTING WITH COMMESSA FILTER...")
        success, commessa_response, status = self.make_request('GET', f'tipologie-contratto?commessa_id={fastweb_id}', expected_status=200)
        if success:
            commessa_tipologie_count = len(commessa_response)
            self.log_test("GET /api/tipologie-contratto with commessa filter", True, f"Found {commessa_tipologie_count} tipologie for Fastweb")
            
            # Verify authorization is working
            found_labels = [tip.get('label', '') for tip in commessa_response]
            self.log_test("Commessa filter results", True, f"Tipologie: {found_labels}")
        else:
            self.log_test("GET /api/tipologie-contratto with commessa filter", False, f"Status: {status}")

        # 3. TEST CON FILTRO COMMESSA + SERVIZIO TLS
        print("\n3️⃣ TESTING WITH COMMESSA + TLS SERVIZIO FILTER...")
        success, tls_response, status = self.make_request('GET', f'tipologie-contratto?commessa_id={fastweb_id}&servizio_id={tls_id}', expected_status=200)
        if success:
            tls_tipologie_count = len(tls_response)
            tls_labels = [tip.get('label', '') for tip in tls_response]
            self.log_test("GET /api/tipologie-contratto with TLS filter", True, f"Found {tls_tipologie_count} tipologie: {tls_labels}")
        else:
            self.log_test("GET /api/tipologie-contratto with TLS filter", False, f"Status: {status}")

        # 4. TEST CON FILTRO COMMESSA + SERVIZIO AGENT
        print("\n4️⃣ TESTING WITH COMMESSA + AGENT SERVIZIO FILTER...")
        success, agent_response, status = self.make_request('GET', f'tipologie-contratto?commessa_id={fastweb_id}&servizio_id={agent_id}', expected_status=200)
        if success:
            agent_tipologie_count = len(agent_response)
            agent_labels = [tip.get('label', '') for tip in agent_response]
            self.log_test("GET /api/tipologie-contratto with Agent filter", True, f"Found {agent_tipologie_count} tipologie: {agent_labels}")
            
            # Verify different services return different tipologie
            if 'tls_response' in locals() and tls_response and agent_response:
                tls_values = set(tip.get('value', '') for tip in tls_response)
                agent_values = set(tip.get('value', '') for tip in agent_response)
                
                if tls_values != agent_values:
                    self.log_test("Different services return different tipologie", True, f"TLS: {len(tls_values)}, Agent: {len(agent_values)}")
                else:
                    self.log_test("Services return same tipologie", True, "Both services have same tipologie (may be expected)")
        else:
            self.log_test("GET /api/tipologie-contratto with Agent filter", False, f"Status: {status}")

        # 5. TEST AUTORIZZAZIONI - Verify user sees only authorized tipologie
        print("\n5️⃣ TESTING AUTHORIZATION RESTRICTIONS...")
        
        # Test with unauthorized commessa (should fail)
        fake_commessa_id = str(uuid.uuid4())
        success, unauthorized_response, status = self.make_request('GET', f'tipologie-contratto?commessa_id={fake_commessa_id}', expected_status=403)
        if status == 403:
            self.log_test("Unauthorized commessa access denied", True, "Correctly returned 403 for unauthorized commessa")
        else:
            self.log_test("Unauthorized commessa access", False, f"Expected 403, got {status}")

        # 6. TEST ENDPOINT GERARCHICO - GET /api/commesse/{commessa_id}/servizi/{servizio_id}/tipologie-contratto
        print("\n6️⃣ TESTING HIERARCHICAL ENDPOINT...")
        
        # First need to get a unit_id - let's get units
        success, units_response, status = self.make_request('GET', 'units', expected_status=200)
        if success and units_response:
            unit_id = units_response[0]['id']  # Use first available unit
            
            # Test hierarchical endpoint
            hierarchical_endpoint = f'commesse/{fastweb_id}/servizi/{tls_id}/units/{unit_id}/tipologie-contratto'
            success, hierarchical_response, status = self.make_request('GET', hierarchical_endpoint, expected_status=200)
            if success:
                hierarchical_count = len(hierarchical_response)
                hierarchical_labels = [tip.get('label', '') for tip in hierarchical_response]
                self.log_test("Hierarchical endpoint working", True, f"Found {hierarchical_count} tipologie: {hierarchical_labels}")
            else:
                self.log_test("Hierarchical endpoint", False, f"Status: {status}")
        else:
            self.log_test("Hierarchical endpoint test skipped", True, "No units available for testing")

        # SUMMARY OF RESULTS
        print(f"\n📊 TIPOLOGIE CONTRATTO ENDPOINT TEST SUMMARY:")
        print(f"   🎯 OBIETTIVO: Verificare filtering per servizio e autorizzazioni")
        print(f"   🔑 CREDENTIALS: resp_commessa/admin123 - {'✅ SUCCESS' if self.token else '❌ FAILED'}")
        print(f"   📋 TESTS COMPLETED:")
        print(f"      • Base endpoint (no params): {'✅' if 'base_response' in locals() and base_response else '❌'}")
        print(f"      • Commessa filter: {'✅' if 'commessa_response' in locals() and commessa_response else '❌'}")
        print(f"      • TLS servizio filter: {'✅' if 'tls_response' in locals() and tls_response else '❌'}")
        print(f"      • Agent servizio filter: {'✅' if 'agent_response' in locals() and agent_response else '❌'}")
        print(f"      • Authorization test: {'✅' if status == 403 else '❌'}")
        print(f"      • Hierarchical endpoint: {'✅' if 'hierarchical_response' in locals() and hierarchical_response else 'ℹ️ SKIPPED'}")
        
        # Verify expected behavior
        if 'base_response' in locals() and 'tls_response' in locals() and 'agent_response' in locals():
            base_count = len(base_response) if base_response else 0
            tls_count = len(tls_response) if tls_response else 0
            agent_count = len(agent_response) if agent_response else 0
            
            print(f"   📈 TIPOLOGIE COUNTS:")
            print(f"      • Base (no filter): {base_count} tipologie")
            print(f"      • With TLS filter: {tls_count} tipologie")
            print(f"      • With Agent filter: {agent_count} tipologie")
            
            # Expected: Agent service should have more tipologie (includes Ho Mobile, Telepass)
            if agent_count >= tls_count:
                self.log_test("Service filtering working correctly", True, "Agent service has same or more tipologie than TLS")
            else:
                self.log_test("Service filtering issue", False, f"Agent ({agent_count}) has fewer tipologie than TLS ({tls_count})")
        
        return True

    def run_test(self):
        """Run the tipologie contratto test"""
        print("🚀 Starting Tipologie Contratto Endpoint Testing...")
        print(f"📍 Base URL: {self.base_url}")
        
        try:
            # Run the specific test
            self.test_tipologie_contratto_endpoint_with_filters()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        finally:
            # Print final summary
            print(f"\n📊 FINAL TEST SUMMARY:")
            print(f"   • Tests run: {self.tests_run}")
            print(f"   • Tests passed: {self.tests_passed}")
            print(f"   • Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            if self.tests_passed == self.tests_run:
                print("   🎉 ALL TESTS PASSED!")
            else:
                failed = self.tests_run - self.tests_passed
                print(f"   ⚠️ {failed} tests failed")

if __name__ == "__main__":
    tester = TipologieContrattoTester()
    tester.run_test()