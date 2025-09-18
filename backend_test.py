#!/usr/bin/env python3
"""
CRM Lead Management System - Backend API Testing
Tests all endpoints with proper authentication and role-based access
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class CRMAPITester:
    def __init__(self, base_url="https://clientflow-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'units': [],
            'containers': [],
            'leads': []
        }

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

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test login with correct credentials
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin login", True, f"Token received, user role: {self.user_data['role']}")
        else:
            self.log_test("Admin login", False, f"Status: {status}, Response: {response}")
            return False

        # Test /auth/me endpoint
        success, response, status = self.make_request('GET', 'auth/me', expected_status=200)
        if success and response.get('username') == 'admin':
            self.log_test("Get current user", True, f"Username: {response['username']}")
        else:
            self.log_test("Get current user", False, f"Status: {status}")

        # Test login with wrong credentials
        success, response, status = self.make_request(
            'POST', 'auth/login',
            {'username': 'admin', 'password': 'wrongpassword'},
            401, auth_required=False
        )
        self.log_test("Login with wrong password", success, "Correctly rejected")

        return True

    def test_provinces_endpoint(self):
        """Test provinces endpoint"""
        print("\n🗺️  Testing Provinces...")
        
        success, response, status = self.make_request('GET', 'provinces', expected_status=200, auth_required=False)
        if success and 'provinces' in response:
            provinces = response['provinces']
            self.log_test("Get provinces", True, f"Found {len(provinces)} provinces")
            
            # Check if we have the expected 110 Italian provinces
            if len(provinces) == 110:
                self.log_test("Province count validation", True, "All 110 Italian provinces present")
            else:
                self.log_test("Province count validation", False, f"Expected 110, got {len(provinces)}")
                
            # Check for some key Italian provinces
            key_provinces = ["Roma", "Milano", "Napoli", "Torino", "Palermo"]
            missing = [p for p in key_provinces if p not in provinces]
            if not missing:
                self.log_test("Key provinces check", True, "All major provinces found")
            else:
                self.log_test("Key provinces check", False, f"Missing: {missing}")
        else:
            self.log_test("Get provinces", False, f"Status: {status}")

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n📊 Testing Dashboard Stats...")
        
        success, response, status = self.make_request('GET', 'dashboard/stats', expected_status=200)
        if success:
            expected_keys = ['total_leads', 'total_users', 'total_units', 'leads_today']
            missing_keys = [key for key in expected_keys if key not in response]
            
            if not missing_keys:
                self.log_test("Dashboard stats structure", True, f"All keys present: {list(response.keys())}")
                self.log_test("Dashboard stats values", True, 
                    f"Users: {response.get('total_users', 0)}, "
                    f"Units: {response.get('total_units', 0)}, "
                    f"Leads: {response.get('total_leads', 0)}")
            else:
                self.log_test("Dashboard stats", False, f"Missing keys: {missing_keys}")
        else:
            self.log_test("Dashboard stats", False, f"Status: {status}")

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n👥 Testing User Management...")
        
        # Get existing users
        success, response, status = self.make_request('GET', 'users', expected_status=200)
        if success:
            users = response
            self.log_test("Get users", True, f"Found {len(users)} users")
            
            # Check if admin user exists
            admin_user = next((u for u in users if u['username'] == 'admin'), None)
            if admin_user:
                self.log_test("Admin user exists", True, f"Role: {admin_user['role']}")
            else:
                self.log_test("Admin user exists", False, "Admin user not found")
        else:
            self.log_test("Get users", False, f"Status: {status}")

        # Create a test unit first (needed for user creation)
        unit_data = {
            "name": f"Test Unit {datetime.now().strftime('%H%M%S')}",
            "description": "Unit for testing user creation"
        }
        success, unit_response, status = self.make_request('POST', 'units', unit_data, 200)
        if success:
            unit_id = unit_response['id']
            self.created_resources['units'].append(unit_id)
            self.log_test("Create test unit for user", True, f"Unit ID: {unit_id}")
        else:
            self.log_test("Create test unit for user", False, f"Status: {status}")
            unit_id = None

        # Create a test user (referente)
        test_user_data = {
            "username": f"test_referente_{datetime.now().strftime('%H%M%S')}",
            "email": f"test_referente_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "testpass123",
            "role": "referente",
            "unit_id": unit_id,
            "provinces": []
        }
        
        success, user_response, status = self.make_request('POST', 'users', test_user_data, 200)
        if success:
            user_id = user_response['id']
            self.created_resources['users'].append(user_id)
            self.log_test("Create referente user", True, f"User ID: {user_id}")
        else:
            self.log_test("Create referente user", False, f"Status: {status}, Response: {user_response}")

        # Create a test agent with provinces
        test_agent_data = {
            "username": f"test_agente_{datetime.now().strftime('%H%M%S')}",
            "email": f"test_agente_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "testpass123",
            "role": "agente",
            "unit_id": unit_id,
            "provinces": ["Roma", "Milano", "Napoli"]
        }
        
        success, agent_response, status = self.make_request('POST', 'users', test_agent_data, 200)
        if success:
            agent_id = agent_response['id']
            self.created_resources['users'].append(agent_id)
            self.log_test("Create agent with provinces", True, f"Agent ID: {agent_id}, Provinces: {test_agent_data['provinces']}")
        else:
            self.log_test("Create agent with provinces", False, f"Status: {status}, Response: {agent_response}")

        # Test duplicate username
        success, response, status = self.make_request('POST', 'users', test_user_data, 400)
        self.log_test("Duplicate username rejection", success, "Correctly rejected duplicate")

        # Test invalid province for agent
        invalid_agent_data = {
            "username": f"invalid_agent_{datetime.now().strftime('%H%M%S')}",
            "email": f"invalid_agent_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "testpass123",
            "role": "agente",
            "provinces": ["InvalidProvince", "AnotherInvalid"]
        }
        
        success, response, status = self.make_request('POST', 'users', invalid_agent_data, 400)
        self.log_test("Invalid province rejection", success, "Correctly rejected invalid provinces")

    def test_units_management(self):
        """Test units management"""
        print("\n🏢 Testing Units Management...")
        
        # Get existing units
        success, response, status = self.make_request('GET', 'units', expected_status=200)
        if success:
            units = response
            self.log_test("Get units", True, f"Found {len(units)} units")
        else:
            self.log_test("Get units", False, f"Status: {status}")

        # Create a new unit
        unit_data = {
            "name": f"Test Unit API {datetime.now().strftime('%H%M%S')}",
            "description": "Unit created via API test"
        }
        
        success, unit_response, status = self.make_request('POST', 'units', unit_data, 200)
        if success:
            unit_id = unit_response['id']
            webhook_url = unit_response.get('webhook_url', '')
            self.created_resources['units'].append(unit_id)
            self.log_test("Create unit", True, f"Unit ID: {unit_id}")
            
            if webhook_url.startswith('/api/webhook/'):
                self.log_test("Webhook URL generation", True, f"URL: {webhook_url}")
            else:
                self.log_test("Webhook URL generation", False, f"Invalid URL format: {webhook_url}")
        else:
            self.log_test("Create unit", False, f"Status: {status}, Response: {unit_response}")

    def test_containers_management(self):
        """Test containers management"""
        print("\n📦 Testing Containers Management...")
        
        # Get existing containers
        success, response, status = self.make_request('GET', 'containers', expected_status=200)
        if success:
            containers = response
            self.log_test("Get containers", True, f"Found {len(containers)} containers")
        else:
            self.log_test("Get containers", False, f"Status: {status}")

        # Create container (need a unit first)
        if self.created_resources['units']:
            unit_id = self.created_resources['units'][0]
            container_data = {
                "name": f"Test Container {datetime.now().strftime('%H%M%S')}",
                "unit_id": unit_id
            }
            
            success, container_response, status = self.make_request('POST', 'containers', container_data, 200)
            if success:
                container_id = container_response['id']
                self.created_resources['containers'].append(container_id)
                self.log_test("Create container", True, f"Container ID: {container_id}")
            else:
                self.log_test("Create container", False, f"Status: {status}")
        else:
            self.log_test("Create container", False, "No units available for container creation")

    def test_leads_management(self):
        """Test leads management"""
        print("\n📞 Testing Leads Management...")
        
        # Get existing leads
        success, response, status = self.make_request('GET', 'leads', expected_status=200)
        if success:
            leads = response
            self.log_test("Get leads", True, f"Found {len(leads)} leads")
        else:
            self.log_test("Get leads", False, f"Status: {status}")

        # Create a test lead
        if self.created_resources['units']:
            unit_id = self.created_resources['units'][0]
            lead_data = {
                "nome": "Mario",
                "cognome": "Rossi",
                "telefono": "+39 123 456 7890",
                "email": "mario.rossi@test.com",
                "provincia": "Roma",
                "tipologia_abitazione": "appartamento",
                "campagna": "Test Campaign",
                "gruppo": unit_id,
                "contenitore": "Test Container",
                "privacy_consent": True,
                "marketing_consent": True
            }
            
            success, lead_response, status = self.make_request('POST', 'leads', lead_data, 201, auth_required=False)
            if success:
                lead_id = lead_response['id']
                self.created_resources['leads'].append(lead_id)
                self.log_test("Create lead", True, f"Lead ID: {lead_id}")
                
                # Test lead update
                update_data = {
                    "esito": "FISSATO APPUNTAMENTO",
                    "note": "Cliente interessato, appuntamento fissato per domani"
                }
                
                success, update_response, status = self.make_request('PUT', f'leads/{lead_id}', update_data, 200)
                if success:
                    self.log_test("Update lead", True, f"Esito: {update_response.get('esito')}")
                else:
                    self.log_test("Update lead", False, f"Status: {status}")
            else:
                self.log_test("Create lead", False, f"Status: {status}, Response: {lead_response}")

        # Test lead filtering
        success, response, status = self.make_request('GET', 'leads?campagna=Test Campaign', expected_status=200)
        if success:
            filtered_leads = response
            self.log_test("Filter leads by campaign", True, f"Found {len(filtered_leads)} leads")
        else:
            self.log_test("Filter leads by campaign", False, f"Status: {status}")

        # Test invalid province lead creation
        invalid_lead_data = {
            "nome": "Test",
            "cognome": "Invalid",
            "telefono": "+39 123 456 7890",
            "provincia": "InvalidProvince",
            "tipologia_abitazione": "appartamento",
            "campagna": "Test",
            "gruppo": "test",
            "contenitore": "test"
        }
        
        success, response, status = self.make_request('POST', 'leads', invalid_lead_data, 400, auth_required=False)
        self.log_test("Invalid province lead rejection", success, "Correctly rejected invalid province")

    def test_webhook_endpoint(self):
        """Test webhook endpoint"""
        print("\n🔗 Testing Webhook Endpoint...")
        
        webhook_lead_data = {
            "nome": "Webhook",
            "cognome": "Test",
            "telefono": "+39 987 654 3210",
            "email": "webhook.test@test.com",
            "provincia": "Milano",
            "tipologia_abitazione": "villa",
            "campagna": "Webhook Campaign",
            "contenitore": "Webhook Container",
            "privacy_consent": True
        }
        
        if self.created_resources['units']:
            unit_id = self.created_resources['units'][0]
            
            success, response, status = self.make_request(
                'POST', f'webhook/{unit_id}', webhook_lead_data, 201, auth_required=False
            )
            if success:
                lead_id = response['id']
                self.created_resources['leads'].append(lead_id)
                self.log_test("Webhook lead creation", True, f"Lead ID: {lead_id}")
                
                # Verify the lead was assigned to the correct unit
                if response.get('gruppo') == unit_id:
                    self.log_test("Webhook unit assignment", True, f"Correctly assigned to unit: {unit_id}")
                else:
                    self.log_test("Webhook unit assignment", False, f"Expected {unit_id}, got {response.get('gruppo')}")
            else:
                self.log_test("Webhook lead creation", False, f"Status: {status}")

        # Test webhook with invalid unit
        success, response, status = self.make_request(
            'POST', 'webhook/invalid-unit-id', webhook_lead_data, 404, auth_required=False
        )
        self.log_test("Webhook invalid unit rejection", success, "Correctly rejected invalid unit")

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        print("\n🚫 Testing Unauthorized Access...")
        
        # Save current token
        original_token = self.token
        self.token = None
        
        # Test protected endpoints without token
        protected_endpoints = [
            ('GET', 'users', 401),
            ('POST', 'users', 401),
            ('GET', 'units', 401),
            ('POST', 'units', 401),
            ('GET', 'containers', 401),
            ('POST', 'containers', 401),
            ('GET', 'dashboard/stats', 401),
            ('GET', 'auth/me', 401)
        ]
        
        for method, endpoint, expected_status in protected_endpoints:
            success, response, status = self.make_request(method, endpoint, {}, expected_status)
            self.log_test(f"Unauthorized {method} {endpoint}", success, "Correctly rejected")
        
        # Test with invalid token
        self.token = "invalid-token"
        success, response, status = self.make_request('GET', 'auth/me', expected_status=401)
        self.log_test("Invalid token rejection", success, "Correctly rejected invalid token")
        
        # Restore original token
        self.token = original_token

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting CRM API Testing...")
        print(f"📡 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication is required for most tests
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Run all test suites
        self.test_provinces_endpoint()
        self.test_dashboard_stats()
        self.test_user_management()
        self.test_units_management()
        self.test_containers_management()
        self.test_leads_management()
        self.test_webhook_endpoint()
        self.test_unauthorized_access()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed = self.tests_run - self.tests_passed
            print(f"⚠️  {failed} tests failed")
            return False

def main():
    """Main test execution"""
    tester = CRMAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())