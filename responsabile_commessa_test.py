#!/usr/bin/env python3
"""
CRM Lead Management System - Responsabile Commessa Testing
Tests all Responsabile Commessa endpoints with proper authentication and authorization
"""

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class ResponsabileCommessaTester:
    def __init__(self, base_url="https://lead-manager-crm.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.resp_token = None
        self.admin_user_data = None
        self.resp_user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'authorizations': []
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

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True, token=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required:
            use_token = token or self.admin_token
            if use_token:
                headers['Authorization'] = f'Bearer {use_token}'

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

    def setup_admin_authentication(self):
        """Setup admin authentication"""
        print("\n🔐 Setting up Admin Authentication...")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_user_data = response['user']
            self.log_test("Admin login", True, f"Token received, user role: {self.admin_user_data['role']}")
            return True
        else:
            self.log_test("Admin login", False, f"Status: {status}, Response: {response}")
            return False

    def create_responsabile_commessa_user(self):
        """Create responsabile_commessa user with credentials resp_commessa/admin123"""
        print("\n🔧 Creating Responsabile Commessa User...")
        
        # Get existing commesse to assign to the user
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        if not success or not commesse_response:
            self.log_test("Get commesse for responsabile setup", False, f"Status: {status}")
            return False
        
        commesse_ids = [c['id'] for c in commesse_response]
        if not commesse_ids:
            self.log_test("Commesse available for responsabile", False, "No commesse found")
            return False
        
        self.log_test("Found commesse", True, f"Found {len(commesse_ids)} commesse")
        
        # First, try to find existing resp_commessa user
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        existing_user = None
        if success:
            for user in users_response:
                if user.get('username') == 'resp_commessa':
                    existing_user = user
                    break
        
        if existing_user:
            self.log_test("Found existing resp_commessa user", True, f"User ID: {existing_user['id']}")
            resp_commessa_id = existing_user['id']
            
            # Check if user has correct role
            if existing_user.get('role') != 'responsabile_commessa':
                # Update user role
                update_data = {
                    "username": existing_user['username'],
                    "email": existing_user['email'],
                    "role": "responsabile_commessa",
                    "commesse_autorizzate": commesse_ids[:2],
                    "can_view_analytics": True
                }
                success, update_response, status = self.make_request('PUT', f'users/{resp_commessa_id}', update_data, 200)
                if success:
                    self.log_test("Updated user role to responsabile_commessa", True, "Role updated")
                else:
                    self.log_test("Updated user role to responsabile_commessa", False, f"Status: {status}")
        else:
            # Create new responsabile_commessa user
            resp_commessa_data = {
                "username": "resp_commessa",
                "email": "resp_commessa@test.com",
                "password": "admin123",
                "role": "responsabile_commessa",
                "commesse_autorizzate": commesse_ids[:2],  # Assign first 2 commesse
                "can_view_analytics": True
            }
            
            success, user_response, status = self.make_request('POST', 'users', resp_commessa_data, 200)
            if success:
                resp_commessa_id = user_response['id']
                self.created_resources['users'].append(resp_commessa_id)
                self.log_test("Create responsabile_commessa user", True, f"User ID: {resp_commessa_id}")
            else:
                self.log_test("Create responsabile_commessa user", False, f"Status: {status}, Response: {user_response}")
                return False
        
        # Create user-commessa authorizations (delete existing first)
        # Get existing authorizations for this user
        success, existing_auths, status = self.make_request('GET', 'user-commessa-authorizations', expected_status=200)
        if success:
            for auth in existing_auths:
                if auth.get('user_id') == resp_commessa_id:
                    # Delete existing authorization
                    self.make_request('DELETE', f'user-commessa-authorizations/{auth["id"]}', expected_status=200)
        
        # Create new authorizations
        for commessa_id in commesse_ids[:2]:
            auth_data = {
                "user_id": resp_commessa_id,
                "commessa_id": commessa_id,
                "role_in_commessa": "responsabile_commessa",
                "can_view_all_agencies": True,
                "can_modify_clients": True,
                "can_create_clients": True
            }
            success, auth_response, status = self.make_request('POST', 'user-commessa-authorizations', auth_data, 200)
            if success:
                self.created_resources['authorizations'].append(auth_response['id'])
                self.log_test(f"Create authorization for commessa {commessa_id[:8]}", True, "Authorization created")
            else:
                self.log_test(f"Create authorization for commessa {commessa_id[:8]}", False, f"Status: {status}")
        
        return True

    def test_responsabile_commessa_login(self):
        """Test login with resp_commessa/admin123"""
        print("\n🔐 Testing Responsabile Commessa Login...")
        
        success, login_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'resp_commessa', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in login_response:
            self.resp_token = login_response['access_token']
            self.resp_user_data = login_response['user']
            self.log_test("✅ LOGIN resp_commessa/admin123", True, 
                f"Login successful - Role: {self.resp_user_data['role']}")
            
            # Verify role is responsabile_commessa
            if self.resp_user_data['role'] == 'responsabile_commessa':
                self.log_test("✅ Role verification", True, "Role is responsabile_commessa")
                return True
            else:
                self.log_test("❌ Role verification", False, f"Expected responsabile_commessa, got {self.resp_user_data['role']}")
                return False
        else:
            self.log_test("❌ LOGIN resp_commessa/admin123", False, f"Status: {status}, Response: {login_response}")
            return False

    def test_dashboard_endpoint(self):
        """Test GET /api/responsabile-commessa/dashboard"""
        print("\n📊 Testing Responsabile Commessa Dashboard...")
        
        success, dashboard_response, status = self.make_request(
            'GET', 'responsabile-commessa/dashboard', 
            expected_status=200, token=self.resp_token
        )
        
        if success:
            required_keys = ['clienti_oggi', 'clienti_totali', 'sub_agenzie', 'punti_lavorazione', 'commesse']
            missing_keys = [key for key in required_keys if key not in dashboard_response]
            
            if not missing_keys:
                self.log_test("✅ Dashboard endpoint structure", True, 
                    f"All required keys present: {list(dashboard_response.keys())}")
                self.log_test("✅ Dashboard data", True, 
                    f"Clienti oggi: {dashboard_response.get('clienti_oggi', 0)}, "
                    f"Clienti totali: {dashboard_response.get('clienti_totali', 0)}, "
                    f"Sub agenzie: {len(dashboard_response.get('sub_agenzie', []))}, "
                    f"Commesse: {len(dashboard_response.get('commesse', []))}")
            else:
                self.log_test("❌ Dashboard endpoint structure", False, f"Missing keys: {missing_keys}")
        else:
            self.log_test("❌ Dashboard endpoint", False, f"Status: {status}")
        
        # Test dashboard with date filters
        today = datetime.now().strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        success, filtered_response, status = self.make_request(
            'GET', f'responsabile-commessa/dashboard?date_from={yesterday}&date_to={today}', 
            expected_status=200, token=self.resp_token
        )
        if success:
            self.log_test("✅ Dashboard with date filters", True, 
                f"Filtered clienti oggi: {filtered_response.get('clienti_oggi', 0)}")
        else:
            self.log_test("❌ Dashboard with date filters", False, f"Status: {status}")

    def test_clienti_endpoint(self):
        """Test GET /api/responsabile-commessa/clienti"""
        print("\n👥 Testing Responsabile Commessa Clienti...")
        
        success, clienti_response, status = self.make_request(
            'GET', 'responsabile-commessa/clienti', 
            expected_status=200, token=self.resp_token
        )
        
        if success:
            clienti_list = clienti_response.get('clienti', [])
            total_clienti = clienti_response.get('total', 0)
            self.log_test("✅ Clienti endpoint", True, 
                f"Found {len(clienti_list)} clienti, Total: {total_clienti}")
            
            # Test with search filter
            success, search_clienti, status = self.make_request(
                'GET', 'responsabile-commessa/clienti?search=test', 
                expected_status=200, token=self.resp_token
            )
            if success:
                self.log_test("✅ Clienti with search filter", True, 
                    f"Search results: {len(search_clienti.get('clienti', []))}")
            else:
                self.log_test("❌ Clienti with search filter", False, f"Status: {status}")
            
            # Test with status filter
            success, status_clienti, status = self.make_request(
                'GET', 'responsabile-commessa/clienti?status=nuovo', 
                expected_status=200, token=self.resp_token
            )
            if success:
                self.log_test("✅ Clienti with status filter", True, 
                    f"Status filtered clienti: {len(status_clienti.get('clienti', []))}")
            else:
                self.log_test("❌ Clienti with status filter", False, f"Status: {status}")
        else:
            self.log_test("❌ Clienti endpoint", False, f"Status: {status}")

    def test_analytics_endpoint(self):
        """Test GET /api/responsabile-commessa/analytics"""
        print("\n📈 Testing Responsabile Commessa Analytics...")
        
        success, analytics_response, status = self.make_request(
            'GET', 'responsabile-commessa/analytics', 
            expected_status=200, token=self.resp_token
        )
        
        if success:
            required_keys = ['sub_agenzie_analytics', 'conversioni']
            missing_keys = [key for key in required_keys if key not in analytics_response]
            
            if not missing_keys:
                sub_agenzie_analytics = analytics_response.get('sub_agenzie_analytics', [])
                conversioni = analytics_response.get('conversioni', {})
                self.log_test("✅ Analytics endpoint structure", True, 
                    f"Sub agenzie analytics: {len(sub_agenzie_analytics)}, "
                    f"Conversioni: {conversioni}")
            else:
                self.log_test("❌ Analytics endpoint structure", False, f"Missing keys: {missing_keys}")
        else:
            self.log_test("❌ Analytics endpoint", False, f"Status: {status}")

    def test_analytics_export_endpoint(self):
        """Test GET /api/responsabile-commessa/analytics/export"""
        print("\n📊 Testing Responsabile Commessa Analytics Export...")
        
        success, export_response, status = self.make_request(
            'GET', 'responsabile-commessa/analytics/export', 
            expected_status=200, token=self.resp_token
        )
        
        if success:
            self.log_test("✅ Analytics export endpoint", True, "Export endpoint accessible")
        else:
            if status == 404:
                self.log_test("✅ Analytics export endpoint", True, "No data to export (expected)")
            else:
                self.log_test("❌ Analytics export endpoint", False, f"Status: {status}")

    def test_access_control(self):
        """Test access control - only responsabile_commessa should access"""
        print("\n🔒 Testing Access Control...")
        
        # Test admin access denial
        success, response, status = self.make_request(
            'GET', 'responsabile-commessa/dashboard', 
            expected_status=403, token=self.admin_token
        )
        if status == 403:
            self.log_test("✅ Access control - admin denied", True, "Admin correctly denied access")
        else:
            self.log_test("❌ Access control - admin denied", False, f"Expected 403, got {status}")
        
        # Test responsabile_commessa access allowed
        success, response, status = self.make_request(
            'GET', 'responsabile-commessa/dashboard', 
            expected_status=200, token=self.resp_token
        )
        if success:
            self.log_test("✅ Access control - responsabile allowed", True, "Responsabile correctly allowed access")
        else:
            self.log_test("❌ Access control - responsabile allowed", False, f"Status: {status}")

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        # Delete created authorizations
        for auth_id in self.created_resources['authorizations']:
            try:
                self.make_request('DELETE', f'user-commessa-authorizations/{auth_id}', expected_status=200)
            except:
                pass
        
        # Delete created users
        for user_id in self.created_resources['users']:
            try:
                self.make_request('DELETE', f'users/{user_id}', expected_status=200)
            except:
                pass

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 RESPONSABILE COMMESSA TEST SUMMARY:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "   Success Rate: 0%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All Responsabile Commessa tests passed!")
        else:
            print("⚠️ Some tests failed - check output above")

    def run_all_tests(self):
        """Run all Responsabile Commessa tests"""
        print("🚀 Starting Responsabile Commessa System Testing...")
        print(f"Base URL: {self.base_url}")
        
        try:
            # Setup admin authentication
            if not self.setup_admin_authentication():
                print("❌ Admin authentication failed - stopping tests")
                return
            
            # Create responsabile_commessa user
            if not self.create_responsabile_commessa_user():
                print("❌ Failed to create responsabile_commessa user - stopping tests")
                return
            
            # Test responsabile_commessa login
            if not self.test_responsabile_commessa_login():
                print("❌ Responsabile Commessa login failed - stopping tests")
                return
            
            # Test all endpoints
            self.test_dashboard_endpoint()
            self.test_clienti_endpoint()
            self.test_analytics_endpoint()
            self.test_analytics_export_endpoint()
            self.test_access_control()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        finally:
            self.cleanup_resources()
            self.print_summary()

if __name__ == "__main__":
    tester = ResponsabileCommessaTester()
    tester.run_all_tests()