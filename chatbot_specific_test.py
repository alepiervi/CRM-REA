#!/usr/bin/env python3
"""
Specific ChatBot API Testing for Admin User
Tests the exact endpoints mentioned in the review request
"""

import requests
import json
from datetime import datetime

class ChatBotSpecificTester:
    def __init__(self, base_url="https://agentflow-crm.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.session_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        if success:
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        if details and success:
            print(f"   ℹ️  {details}")

    def authenticate_admin(self):
        """Authenticate as admin user"""
        print("🔐 Authenticating as admin...")
        
        url = f"{self.base_url}/auth/login"
        data = {'username': 'admin', 'password': 'admin123'}
        
        try:
            response = requests.post(url, json=data, timeout=30)
            if response.status_code == 200:
                result = response.json()
                self.token = result['access_token']
                self.user_data = result['user']
                self.log_test("Admin authentication", True, 
                    f"Role: {self.user_data['role']}, Unit ID: {self.user_data.get('unit_id', 'None')}")
                return True
            else:
                self.log_test("Admin authentication", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin authentication", False, f"Error: {str(e)}")
            return False

    def test_chat_session_creation(self):
        """Test /api/chat/session endpoint with admin user"""
        print("\n🤖 Testing /api/chat/session endpoint...")
        
        url = f"{self.base_url}/chat/session"
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {
            'session_type': 'unit'
        }
        
        try:
            response = requests.post(url, data=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.session_id = result['session']['session_id']
                    self.log_test("POST /api/chat/session", True, 
                        f"Session created: {self.session_id}")
                    return True
                else:
                    self.log_test("POST /api/chat/session", False, "Success=False in response")
                    return False
            elif response.status_code == 400:
                error_detail = response.json().get('detail', 'Unknown error')
                if error_detail == "User must belong to a unit":
                    self.log_test("POST /api/chat/session", False, 
                        f"CRITICAL: Still getting 400 error - {error_detail}")
                else:
                    self.log_test("POST /api/chat/session", False, 
                        f"400 error with different message: {error_detail}")
                return False
            else:
                self.log_test("POST /api/chat/session", False, 
                    f"Unexpected status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/chat/session", False, f"Request error: {str(e)}")
            return False

    def test_chat_sessions_list(self):
        """Test /api/chat/sessions endpoint"""
        print("\n📋 Testing /api/chat/sessions endpoint...")
        
        url = f"{self.base_url}/chat/sessions"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                sessions = result.get('sessions', [])
                self.log_test("GET /api/chat/sessions", True, 
                    f"Found {len(sessions)} sessions")
                return True
            elif response.status_code == 400:
                error_detail = response.json().get('detail', 'Unknown error')
                if error_detail == "User must belong to a unit":
                    self.log_test("GET /api/chat/sessions", False, 
                        f"CRITICAL: Still getting 400 error - {error_detail}")
                else:
                    self.log_test("GET /api/chat/sessions", False, 
                        f"400 error with different message: {error_detail}")
                return False
            else:
                self.log_test("GET /api/chat/sessions", False, 
                    f"Unexpected status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/chat/sessions", False, f"Request error: {str(e)}")
            return False

    def test_send_message(self):
        """Test /api/chat/message endpoint"""
        print("\n💬 Testing /api/chat/message endpoint...")
        
        if not self.session_id:
            self.log_test("POST /api/chat/message", False, "No session_id available")
            return False
        
        url = f"{self.base_url}/chat/message"
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {
            'session_id': self.session_id,
            'message': 'Ciao, questo è un test per verificare che il ChatBot funzioni correttamente per l\'utente admin.'
        }
        
        try:
            response = requests.post(url, data=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    bot_response = result.get('response', '')
                    self.log_test("POST /api/chat/message", True, 
                        f"Bot responded: {bot_response[:100]}...")
                    return True
                else:
                    self.log_test("POST /api/chat/message", False, "Success=False in response")
                    return False
            elif response.status_code == 400:
                error_detail = response.json().get('detail', 'Unknown error')
                self.log_test("POST /api/chat/message", False, 
                    f"400 error: {error_detail}")
                return False
            else:
                self.log_test("POST /api/chat/message", False, 
                    f"Unexpected status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/chat/message", False, f"Request error: {str(e)}")
            return False

    def test_admin_unit_status(self):
        """Check admin user unit assignment status"""
        print("\n👤 Checking admin user unit assignment...")
        
        url = f"{self.base_url}/auth/me"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                user_info = response.json()
                unit_id = user_info.get('unit_id')
                
                if unit_id:
                    self.log_test("Admin unit assignment", True, f"Admin has unit_id: {unit_id}")
                else:
                    self.log_test("Admin unit assignment", False, "Admin has no unit_id (unit_id: null)")
                
                # Also check available units
                units_url = f"{self.base_url}/units"
                units_response = requests.get(units_url, headers=headers, timeout=30)
                if units_response.status_code == 200:
                    units = units_response.json()
                    self.log_test("Available units check", True, f"Found {len(units)} units in database")
                    if units:
                        print(f"   ℹ️  First few units: {[u['name'] for u in units[:3]]}")
                else:
                    self.log_test("Available units check", False, f"Status: {units_response.status_code}")
                
                return unit_id is not None
            else:
                self.log_test("Get admin user info", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Get admin user info", False, f"Request error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all ChatBot specific tests"""
        print("=" * 60)
        print("CHATBOT SPECIFIC TESTING FOR ADMIN USER")
        print("=" * 60)
        
        if not self.authenticate_admin():
            print("❌ Cannot proceed without authentication")
            return
        
        # Check admin unit status first
        admin_has_unit = self.test_admin_unit_status()
        
        # Test session creation
        session_created = self.test_chat_session_creation()
        
        # Test sessions list
        sessions_accessible = self.test_chat_sessions_list()
        
        # Test message sending (only if session was created)
        message_sent = False
        if session_created:
            message_sent = self.test_send_message()
        
        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY OF CHATBOT TESTS")
        print("=" * 60)
        
        print(f"✅ Admin Authentication: SUCCESS")
        print(f"{'✅' if admin_has_unit else '❌'} Admin Unit Assignment: {'SUCCESS' if admin_has_unit else 'FAILED - No unit_id'}")
        print(f"{'✅' if session_created else '❌'} Session Creation (/api/chat/session): {'SUCCESS' if session_created else 'FAILED'}")
        print(f"{'✅' if sessions_accessible else '❌'} Sessions List (/api/chat/sessions): {'SUCCESS' if sessions_accessible else 'FAILED'}")
        print(f"{'✅' if message_sent else '❌'} Message Sending (/api/chat/message): {'SUCCESS' if message_sent else 'FAILED'}")
        
        if session_created and sessions_accessible and message_sent:
            print("\n🎉 ALL CHATBOT FUNCTIONALITY IS WORKING FOR ADMIN USER!")
            print("✅ The 'User must belong to a unit' error has been RESOLVED!")
        else:
            print("\n⚠️  Some ChatBot functionality is still not working properly.")
            if not admin_has_unit:
                print("   - Admin user still has no unit_id assigned")
            if not session_created:
                print("   - Session creation is failing")
            if not sessions_accessible:
                print("   - Sessions list is not accessible")
            if not message_sent:
                print("   - Message sending is failing")

if __name__ == "__main__":
    tester = ChatBotSpecificTester()
    tester.run_all_tests()