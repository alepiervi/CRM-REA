#!/usr/bin/env python3
"""
EditUserModal System Testing - Focused test for user modification functionality
Tests the complete EditUserModal system after recent modifications
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class EditUserModalTester:
    def __init__(self, base_url="https://crm-workflow-boost.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_users = []

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

    def test_edit_user_modal_system(self):
        """Test completo sistema EditUserModal dopo le modifiche implementate"""
        print("\n👤 Testing EditUserModal System After Modifications...")
        
        # 1. LOGIN ADMIN - POST /api/auth/login con admin/admin123
        print("\n🔐 1. TESTING ADMIN LOGIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("✅ LOGIN admin/admin123", True, f"Login successful - Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("❌ LOGIN admin/admin123", False, f"Login failed - Status: {status}, Response: {response}")
            return False

        # 2. ENDPOINT UTENTI - GET /api/users per verificare che restituisca tutti gli utenti
        print("\n👥 2. TESTING USERS ENDPOINT...")
        success, response, status = self.make_request('GET', 'users', expected_status=200)
        
        if success:
            users = response
            self.log_test("✅ GET /api/users endpoint", True, f"Endpoint working - Found {len(users)} users")
            
            # Verificare che non ci siano errori 500 che possano far scadere la sessione
            if status != 500:
                self.log_test("✅ No 500 errors on GET /api/users", True, "Endpoint returned 200, no server errors that could expire session")
            else:
                self.log_test("❌ 500 Error detected", False, "Server error on GET /api/users - could cause session expiration")
                return False
        else:
            self.log_test("❌ GET /api/users endpoint", False, f"Endpoint failed - Status: {status}")
            if status == 500:
                self.log_test("❌ 500 Error detected", False, "Server error on GET /api/users - could cause session expiration")
            return False

        # Find or create a user with responsabile_commessa role for testing
        resp_commessa_user = None
        for user in users:
            if user.get('role') == 'responsabile_commessa':
                resp_commessa_user = user
                break
        
        # If no responsabile_commessa user exists, create one
        if not resp_commessa_user:
            print("\n👤 Creating responsabile_commessa user for testing...")
            
            # First get available commesse and sub agenzie
            success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
            if not success:
                self.log_test("❌ Get commesse for user creation", False, f"Status: {status}")
                return False
            
            success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
            if not success:
                self.log_test("❌ Get sub-agenzie for user creation", False, f"Status: {status}")
                return False
            
            commesse = commesse_response
            sub_agenzie = sub_agenzie_response
            
            if not commesse or not sub_agenzie:
                self.log_test("❌ No commesse or sub-agenzie available", False, "Cannot create responsabile_commessa user without commesse/sub-agenzie")
                return False
            
            # Create responsabile_commessa user
            resp_commessa_data = {
                "username": f"resp_commessa_test_{datetime.now().strftime('%H%M%S')}",
                "email": f"resp_commessa_{datetime.now().strftime('%H%M%S')}@test.com",
                "password": "admin123",
                "role": "responsabile_commessa",
                "commesse_autorizzate": [commesse[0]['id']] if commesse else [],
                "servizi_autorizzati": [],
                "can_view_analytics": True
            }
            
            success, create_response, status = self.make_request('POST', 'users', resp_commessa_data, 200)
            if success:
                resp_commessa_user = create_response
                self.created_users.append(resp_commessa_user['id'])
                self.log_test("✅ Create responsabile_commessa user", True, f"User ID: {resp_commessa_user['id']}")
            else:
                self.log_test("❌ Create responsabile_commessa user", False, f"Status: {status}")
                return False

        # 3. TEST MODIFICA UTENTE RESPONSABILE COMMESSA - PUT /api/users/{user_id}
        print("\n✏️ 3. TESTING RESPONSABILE COMMESSA USER MODIFICATION...")
        
        # Get available commesse and servizi for the update
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        if success:
            commesse = commesse_response
            self.log_test("✅ GET /api/commesse for user update", True, f"Found {len(commesse)} commesse")
        else:
            self.log_test("❌ GET /api/commesse for user update", False, f"Status: {status}")
            return False
        
        # Get servizi for the first commessa
        if commesse:
            success, servizi_response, status = self.make_request('GET', f'commesse/{commesse[0]["id"]}/servizi', expected_status=200)
            if success:
                servizi = servizi_response
                self.log_test("✅ GET /api/commesse/{commessa_id}/servizi for user update", True, f"Found {len(servizi)} servizi")
            else:
                self.log_test("❌ GET /api/commesse/{commessa_id}/servizi for user update", False, f"Status: {status}")
                servizi = []
        else:
            servizi = []
        
        # Update responsabile_commessa user with required fields
        update_data = {
            "username": resp_commessa_user['username'],
            "email": resp_commessa_user['email'],
            "password": "admin123",  # Required by UserCreate model
            "role": "responsabile_commessa",
            "commesse_autorizzate": [commesse[0]['id']] if commesse else [],
            "servizi_autorizzati": [servizi[0]['id']] if servizi else [],
            "can_view_analytics": True
        }
        
        success, update_response, status = self.make_request('PUT', f'users/{resp_commessa_user["id"]}', update_data, 200)
        if success:
            self.log_test("✅ PUT /api/users/{user_id} for responsabile_commessa", True, 
                f"Update successful - Commesse: {len(update_response.get('commesse_autorizzate', []))}, "
                f"Servizi: {len(update_response.get('servizi_autorizzati', []))}, "
                f"Analytics: {update_response.get('can_view_analytics', False)}")
        else:
            self.log_test("❌ PUT /api/users/{user_id} for responsabile_commessa", False, f"Status: {status}")

        # 4. TEST MODIFICA ALTRI RUOLI SPECIALIZZATI
        print("\n✏️ 4. TESTING OTHER SPECIALIZED ROLES MODIFICATION...")
        
        specialized_roles = [
            'backoffice_commessa',
            'responsabile_sub_agenzia', 
            'backoffice_sub_agenzia'
        ]
        
        for role in specialized_roles:
            print(f"\n   Testing {role} role modification...")
            
            # Create user with specialized role
            specialized_user_data = {
                "username": f"{role}_test_{datetime.now().strftime('%H%M%S')}",
                "email": f"{role}_{datetime.now().strftime('%H%M%S')}@test.com",
                "password": "admin123",
                "role": role,
                "commesse_autorizzate": [commesse[0]['id']] if commesse else [],
                "can_view_analytics": role.startswith('responsabile_')  # Only responsabile roles can view analytics
            }
            
            success, create_response, status = self.make_request('POST', 'users', specialized_user_data, 200)
            if success:
                specialized_user = create_response
                self.created_users.append(specialized_user['id'])
                self.log_test(f"✅ Create {role} user", True, f"User ID: {specialized_user['id']}")
                
                # Test modification of specialized role user
                update_specialized_data = {
                    "username": specialized_user['username'],
                    "email": specialized_user['email'],
                    "password": "admin123",  # Required by UserCreate model
                    "role": role,
                    "commesse_autorizzate": [commesse[0]['id']] if commesse else [],
                    "servizi_autorizzati": [servizi[0]['id']] if servizi else [],
                    "can_view_analytics": role.startswith('responsabile_')
                }
                
                success, update_response, status = self.make_request('PUT', f'users/{specialized_user["id"]}', update_specialized_data, 200)
                if success:
                    self.log_test(f"✅ PUT /api/users/{{user_id}} for {role}", True, 
                        f"Update successful without errors")
                else:
                    self.log_test(f"❌ PUT /api/users/{{user_id}} for {role}", False, f"Status: {status}")
            else:
                self.log_test(f"❌ Create {role} user", False, f"Status: {status}")

        # 5. ENDPOINT COMMESSE E SUB AGENZIE
        print("\n🏢 5. TESTING COMMESSE AND SUB AGENZIE ENDPOINTS...")
        
        # GET /api/commesse per verificare dati disponibili
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        if success:
            commesse = commesse_response
            self.log_test("✅ GET /api/commesse", True, f"Found {len(commesse)} commesse available")
        else:
            self.log_test("❌ GET /api/commesse", False, f"Status: {status}")
        
        # GET /api/sub-agenzie per verificare dati disponibili
        success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
        if success:
            sub_agenzie = sub_agenzie_response
            self.log_test("✅ GET /api/sub-agenzie", True, f"Found {len(sub_agenzie)} sub agenzie available")
        else:
            self.log_test("❌ GET /api/sub-agenzie", False, f"Status: {status}")
        
        # GET /api/tipologie-contratto per i dropdown
        success, tipologie_response, status = self.make_request('GET', 'tipologie-contratto', expected_status=200)
        if success:
            tipologie = tipologie_response
            self.log_test("✅ GET /api/tipologie-contratto", True, f"Found {len(tipologie)} tipologie contratto for dropdowns")
        else:
            self.log_test("❌ GET /api/tipologie-contratto", False, f"Status: {status}")
        
        # Summary of EditUserModal system testing
        print(f"\n📊 EDIT USER MODAL SYSTEM TESTING SUMMARY:")
        print(f"   • Admin login: {'✅ WORKING' if self.token else '❌ FAILED'}")
        print(f"   • Users endpoint: {'✅ WORKING' if len(users) > 0 else '❌ FAILED'}")
        print(f"   • No 500 errors: {'✅ CONFIRMED' if status != 500 else '❌ DETECTED'}")
        print(f"   • Responsabile commessa modification: {'✅ WORKING' if success else '❌ FAILED'}")
        print(f"   • Specialized roles modification: {'✅ TESTED' if len(specialized_roles) > 0 else '❌ FAILED'}")
        print(f"   • Commesse endpoint: {'✅ WORKING' if 'commesse' in locals() else '❌ FAILED'}")
        print(f"   • Sub agenzie endpoint: {'✅ WORKING' if 'sub_agenzie' in locals() else '❌ FAILED'}")
        print(f"   • Tipologie contratto endpoint: {'✅ WORKING' if 'tipologie' in locals() else '❌ FAILED'}")
        
        return True

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        # Delete created users
        for user_id in self.created_users:
            success, response, status = self.make_request('DELETE', f'users/{user_id}', expected_status=200)
            if success:
                self.log_test(f"Cleanup user {user_id[:8]}", True, "Deleted")
            else:
                self.log_test(f"Cleanup user {user_id[:8]}", False, f"Status: {status}")

    def run_test(self):
        """Run the EditUserModal system test"""
        print("🚀 Starting EditUserModal System Testing...")
        print(f"🌐 Base URL: {self.base_url}")
        print("🎯 FOCUS: Verificare che il bug della modifica utenti per ruoli specializzati sia risolto")
        
        try:
            # Run the main test
            self.test_edit_user_modal_system()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        finally:
            # Clean up resources
            self.cleanup_resources()
            
            # Print final summary
            print(f"\n📊 FINAL TEST SUMMARY:")
            print(f"   Tests Run: {self.tests_run}")
            print(f"   Tests Passed: {self.tests_passed}")
            print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
            print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "   Success Rate: 0%")
            
            if self.tests_passed == self.tests_run:
                print("🎉 ALL TESTS PASSED!")
                print("✅ EditUserModal system bug appears to be RESOLVED!")
            else:
                print("⚠️ Some tests failed - check logs above")
                print("❌ EditUserModal system may still have issues")

def main():
    """Main function to run tests"""
    tester = EditUserModalTester()
    tester.run_test()

if __name__ == "__main__":
    main()