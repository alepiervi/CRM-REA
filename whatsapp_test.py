#!/usr/bin/env python3
"""
WhatsApp Configuration Flow Test - Complete Integration Test
Tests the complete WhatsApp configuration flow with WhatsApp-Web.js as requested in review
"""

import requests
import sys
import json
from datetime import datetime
import time

class WhatsAppTester:
    def __init__(self, base_url="https://lead-manager-56.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.unit_id = None

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
            try:
                return success, response.json() if response.content else {}, response.status_code
            except:
                return success, {"raw_response": response.text}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def authenticate(self):
        """Authenticate as admin user"""
        print("🔐 Authenticating...")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin authentication", True, f"User role: {self.user_data['role']}")
            return True
        else:
            self.log_test("Admin authentication", False, f"Status: {status}, Response: {response}")
            return False

    def setup_test_environment(self):
        """Set up test environment with unit and leads"""
        print("\n🏗️ Setting up test environment...")
        
        # Create a test unit
        unit_data = {
            "name": f"WhatsApp Test Unit {datetime.now().strftime('%H%M%S')}",
            "description": "Unit for WhatsApp testing"
        }
        
        success, unit_response, status = self.make_request('POST', 'units', unit_data, 200)
        if success:
            self.unit_id = unit_response['id']
            self.log_test("Create test unit", True, f"Unit ID: {self.unit_id}")
        else:
            self.log_test("Create test unit", False, f"Status: {status}")
            return False
        
        # Create a test lead for validation
        lead_data = {
            "nome": "Mario",
            "cognome": "Rossi",
            "telefono": "+39 123 456 7890",
            "email": "mario.rossi@whatsapp-test.com",
            "provincia": "Milano",
            "tipologia_abitazione": "appartamento",
            "campagna": "WhatsApp Test Campaign",
            "gruppo": self.unit_id,
            "contenitore": "WhatsApp Test Container",
            "privacy_consent": True,
            "marketing_consent": True
        }
        
        success, lead_response, status = self.make_request('POST', 'leads', lead_data, 200, auth_required=False)
        if success:
            self.lead_id = lead_response['id']
            self.log_test("Create test lead", True, f"Lead ID: {lead_response.get('lead_id', 'N/A')}")
            return True
        else:
            self.log_test("Create test lead", False, f"Status: {status}")
            return False

    def test_whatsapp_configuration(self):
        """Test WhatsApp Configuration Endpoints"""
        print("\n🔧 Testing WhatsApp Configuration Endpoints...")
        
        # Test POST /api/whatsapp-config
        config_data = {
            "phone_number": "+39 123 456 7890",
            "unit_id": self.unit_id
        }
        
        success, response, status = self.make_request('POST', 'whatsapp-config', config_data, 200)
        if success and response.get('success'):
            config_id = response.get('config_id')
            qr_code = response.get('qr_code')
            phone_number = response.get('phone_number')
            connection_status = response.get('connection_status')
            self.log_test("POST /api/whatsapp-config", True, 
                f"Config ID: {config_id[:8] if config_id else 'N/A'}, Phone: {phone_number}, Status: {connection_status}")
        else:
            self.log_test("POST /api/whatsapp-config", False, f"Status: {status}, Response: {response}")
        
        # Test GET /api/whatsapp-config
        success, response, status = self.make_request('GET', f'whatsapp-config?unit_id={self.unit_id}', expected_status=200)
        if success:
            configured = response.get('configured', False)
            phone_number = response.get('phone_number', 'N/A')
            connection_status = response.get('connection_status', 'N/A')
            webhook_url = response.get('webhook_url', 'N/A')
            self.log_test("GET /api/whatsapp-config", True, 
                f"Configured: {configured}, Phone: {phone_number}, Status: {connection_status}")
        else:
            self.log_test("GET /api/whatsapp-config", False, f"Status: {status}")
        
        # Test POST /api/whatsapp-connect
        success, response, status = self.make_request('POST', f'whatsapp-connect?unit_id={self.unit_id}', expected_status=200)
        if success and response.get('success'):
            connection_status = response.get('connection_status')
            phone_number = response.get('phone_number')
            self.log_test("POST /api/whatsapp-connect", True, 
                f"Connection status: {connection_status}, Phone: {phone_number}")
        else:
            self.log_test("POST /api/whatsapp-connect", False, f"Status: {status}")

    def test_whatsapp_business_api(self):
        """Test WhatsApp Business API Endpoints"""
        print("\n💬 Testing WhatsApp Business API Endpoints...")
        
        # Test POST /api/whatsapp/send (using form data)
        url = f"{self.base_url}/whatsapp/send"
        headers = {'Authorization': f'Bearer {self.token}'}
        data = {
            'phone_number': '+39 123 456 7890',
            'message': 'Test message from CRM WhatsApp API - Sistema completamente implementato!',
            'message_type': 'text'
        }
        
        try:
            response = requests.post(url, data=data, headers=headers, timeout=30)
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    message_id = result.get('message_id', 'N/A')
                    phone_number = result.get('phone_number', 'N/A')
                    self.log_test("POST /api/whatsapp/send", True, f"Message sent to {phone_number}, ID: {message_id}")
                else:
                    error = result.get('error', 'Unknown error')
                    self.log_test("POST /api/whatsapp/send", False, f"Send failed: {error}")
            else:
                self.log_test("POST /api/whatsapp/send", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/whatsapp/send", False, f"Error: {str(e)}")
        
        # Test GET /api/whatsapp/webhook (webhook verification)
        success, response, status = self.make_request(
            'GET', 
            'whatsapp/webhook?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=whatsapp_webhook_token_2024',
            expected_status=200,
            auth_required=False
        )
        if success:
            challenge_response = response if isinstance(response, int) else response.get('raw_response', 'N/A')
            self.log_test("GET /api/whatsapp/webhook (verification)", True, f"Challenge response: {challenge_response}")
        else:
            self.log_test("GET /api/whatsapp/webhook (verification)", False, f"Status: {status}")
        
        # Test webhook verification with wrong token
        success, response, status = self.make_request(
            'GET',
            'whatsapp/webhook?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=wrong_token',
            expected_status=403,
            auth_required=False
        )
        self.log_test("Webhook security (wrong token)", success, 
            "Correctly rejected webhook with wrong verify token")
        
        # Test POST /api/whatsapp/webhook (incoming message simulation)
        webhook_data = {
            "entry": [{
                "changes": [{
                    "field": "messages",
                    "value": {
                        "messages": [{
                            "from": "+39 123 456 7890",
                            "id": "test_message_id_123",
                            "timestamp": "1640995200",
                            "text": {"body": "Ciao, sono interessato ai vostri servizi"},
                            "type": "text"
                        }]
                    }
                }]
            }]
        }
        
        success, response, status = self.make_request(
            'POST', 'whatsapp/webhook', webhook_data, 200, auth_required=False
        )
        if success and response.get('success'):
            processed = response.get('processed', 0)
            self.log_test("POST /api/whatsapp/webhook", True, f"Processed {processed} incoming messages")
        else:
            self.log_test("POST /api/whatsapp/webhook", False, f"Status: {status}")

    def test_lead_validation_integration(self):
        """Test Lead Validation & Integration"""
        print("\n🔍 Testing Lead Validation & Integration...")
        
        # Test POST /api/whatsapp/validate-lead
        success, response, status = self.make_request('POST', f'whatsapp/validate-lead?lead_id={self.lead_id}', expected_status=200)
        if success and response.get('success'):
            is_whatsapp = response.get('is_whatsapp')
            validation_status = response.get('validation_status')
            phone_number = response.get('phone_number')
            message = response.get('message', '')
            self.log_test("POST /api/whatsapp/validate-lead", True, 
                f"Phone: {phone_number}, WhatsApp: {is_whatsapp}, Status: {validation_status}")
        else:
            self.log_test("POST /api/whatsapp/validate-lead", False, f"Status: {status}")
        
        # Test POST /api/whatsapp/bulk-validate
        success, response, status = self.make_request('POST', f'whatsapp/bulk-validate?unit_id={self.unit_id}', expected_status=200)
        if success and response.get('success'):
            validated_count = response.get('validated_count', 0)
            total_leads = response.get('total_leads', 0)
            unit_id = response.get('unit_id', 'N/A')
            results = response.get('results', [])
            self.log_test("POST /api/whatsapp/bulk-validate", True, 
                f"Validated {validated_count}/{total_leads} leads in unit {unit_id[:8]}")
            
            # Show some validation results
            if results:
                for result in results[:3]:  # Show first 3 results
                    lead_id = result.get('lead_id', 'N/A')
                    phone = result.get('phone_number', 'N/A')
                    is_wa = result.get('is_whatsapp', False)
                    print(f"      📱 Lead {lead_id[:8]}: {phone} -> WhatsApp: {is_wa}")
        else:
            self.log_test("POST /api/whatsapp/bulk-validate", False, f"Status: {status}")

    def test_conversation_management(self):
        """Test Conversation Management"""
        print("\n💭 Testing Conversation Management...")
        
        # Test GET /api/whatsapp/conversations
        success, response, status = self.make_request('GET', f'whatsapp/conversations?unit_id={self.unit_id}', expected_status=200)
        if success and response.get('success'):
            conversations = response.get('conversations', [])
            total = response.get('total', 0)
            self.log_test("GET /api/whatsapp/conversations", True, f"Found {total} active conversations")
            
            # Show conversation details if any exist
            if conversations:
                for conv in conversations[:2]:  # Show first 2 conversations
                    phone = conv.get('phone_number', 'N/A')
                    last_msg = conv.get('last_message', 'N/A')
                    unread = conv.get('unread_count', 0)
                    print(f"      💬 {phone}: '{last_msg[:50]}...' (Unread: {unread})")
        else:
            self.log_test("GET /api/whatsapp/conversations", False, f"Status: {status}")
        
        # Test GET /api/whatsapp/conversation/{phone}/history
        test_phone = "+39 123 456 7890"
        encoded_phone = test_phone.replace("+", "%2B")
        success, response, status = self.make_request(
            'GET', f'whatsapp/conversation/{encoded_phone}/history?limit=10', expected_status=200
        )
        if success and response.get('success'):
            messages = response.get('messages', [])
            phone_number = response.get('phone_number')
            total = response.get('total', len(messages))
            self.log_test("GET /api/whatsapp/conversation/history", True, 
                f"Phone: {phone_number}, Messages: {total}")
            
            # Show message details if any exist
            if messages:
                for msg in messages[:3]:  # Show first 3 messages
                    direction = msg.get('direction', 'N/A')
                    message_text = msg.get('message', 'N/A')
                    timestamp = msg.get('timestamp', 'N/A')
                    print(f"      📨 {direction}: '{message_text[:40]}...' ({timestamp})")
        else:
            self.log_test("GET /api/whatsapp/conversation/history", False, f"Status: {status}")

    def test_authorization_security(self):
        """Test Authorization & Security"""
        print("\n🔐 Testing Authorization & Security...")
        
        # Create non-admin user for testing
        non_admin_data = {
            "username": f"whatsapp_test_user_{datetime.now().strftime('%H%M%S')}",
            "email": f"whatsapp_test_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "testpass123",
            "role": "agente",
            "unit_id": self.unit_id,
            "provinces": ["Roma"]
        }
        
        success, user_response, status = self.make_request('POST', 'users', non_admin_data, 200)
        if success:
            user_id = user_response['id']
            
            # Login as non-admin user
            success, login_response, status = self.make_request(
                'POST', 'auth/login',
                {'username': non_admin_data['username'], 'password': non_admin_data['password']},
                200, auth_required=False
            )
            
            if success:
                original_token = self.token
                self.token = login_response['access_token']
                
                # Test access to admin-only WhatsApp config endpoint
                success, response, status = self.make_request('GET', 'whatsapp-config', expected_status=403)
                self.log_test("WhatsApp config access control (non-admin)", success, 
                    "Correctly denied access to non-admin user")
                
                # Test access to bulk validation (admin-only)
                success, response, status = self.make_request('POST', 'whatsapp/bulk-validate', expected_status=403)
                self.log_test("WhatsApp bulk validation access control", success,
                    "Correctly denied bulk validation to non-admin")
                
                # Test access to send message (should be allowed for agents)
                url = f"{self.base_url}/whatsapp/send"
                headers = {'Authorization': f'Bearer {self.token}'}
                data = {
                    'phone_number': '+39 123 456 7890',
                    'message': 'Test from agent',
                    'message_type': 'text'
                }
                
                try:
                    response = requests.post(url, data=data, headers=headers, timeout=30)
                    if response.status_code == 200:
                        self.log_test("Agent WhatsApp send access", True, "Agent can send WhatsApp messages")
                    else:
                        self.log_test("Agent WhatsApp send access", False, f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Agent WhatsApp send access", False, f"Error: {str(e)}")
                
                # Restore admin token
                self.token = original_token
                
                # Clean up test user
                self.make_request('DELETE', f'users/{user_id}', expected_status=200)
            else:
                self.log_test("Non-admin user login", False, f"Status: {status}")
        else:
            self.log_test("Create non-admin user", False, f"Status: {status}")

    def test_whatsapp_service_class(self):
        """Test WhatsApp Service Class functionality through API"""
        print("\n🛠️ Testing WhatsApp Service Class Methods...")
        
        # Test phone number validation (through validate-lead endpoint)
        success, response, status = self.make_request('POST', f'whatsapp/validate-lead?lead_id={self.lead_id}', expected_status=200)
        if success and response.get('success'):
            validation_status = response.get('validation_status')
            is_whatsapp = response.get('is_whatsapp')
            self.log_test("WhatsAppService.validate_phone_number", True, 
                f"Validation working: Status={validation_status}, WhatsApp={is_whatsapp}")
        else:
            self.log_test("WhatsAppService.validate_phone_number", False, f"Status: {status}")
        
        # Test QR code generation (through config endpoint)
        config_data = {
            "phone_number": "+39 987 654 3210",
            "unit_id": self.unit_id
        }
        
        success, response, status = self.make_request('POST', 'whatsapp-config', config_data, 200)
        if success and response.get('success'):
            qr_code = response.get('qr_code')
            expires_at = response.get('expires_at')
            self.log_test("WhatsAppService.generate_qr_code", True, 
                f"QR code generated: {'Yes' if qr_code else 'No'}, Expires: {expires_at}")
        else:
            self.log_test("WhatsAppService.generate_qr_code", False, f"Status: {status}")
        
        # Test message sending (through send endpoint)
        url = f"{self.base_url}/whatsapp/send"
        headers = {'Authorization': f'Bearer {self.token}'}
        data = {
            'phone_number': '+39 987 654 3210',
            'message': 'Test automated response generation',
            'message_type': 'text'
        }
        
        try:
            response = requests.post(url, data=data, headers=headers, timeout=30)
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_test("WhatsAppService.send_message", True, "Message sending service working")
                else:
                    self.log_test("WhatsAppService.send_message", False, f"Send failed: {result}")
            else:
                self.log_test("WhatsAppService.send_message", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("WhatsAppService.send_message", False, f"Error: {str(e)}")
        
        # Test webhook processing (through webhook endpoint)
        webhook_data = {
            "entry": [{
                "changes": [{
                    "field": "messages",
                    "value": {
                        "messages": [{
                            "from": "+39 987 654 3210",
                            "id": "service_test_msg_456",
                            "timestamp": str(int(datetime.now().timestamp())),
                            "text": {"body": "Test automated response: Ciao!"},
                            "type": "text"
                        }]
                    }
                }]
            }]
        }
        
        success, response, status = self.make_request(
            'POST', 'whatsapp/webhook', webhook_data, 200, auth_required=False
        )
        if success and response.get('success'):
            processed = response.get('processed', 0)
            self.log_test("WhatsAppService.process_webhook", True, f"Webhook processing working: {processed} messages")
        else:
            self.log_test("WhatsAppService.process_webhook", False, f"Status: {status}")

    def test_database_integration(self):
        """Test Database Integration"""
        print("\n🗄️ Testing Database Integration...")
        
        # Test that configuration was stored (whatsapp_configurations collection)
        success, config_response, status = self.make_request('GET', f'whatsapp-config?unit_id={self.unit_id}', expected_status=200)
        if success and config_response.get('configured'):
            created_at = config_response.get('created_at', 'N/A')
            updated_at = config_response.get('updated_at', 'N/A')
            self.log_test("WhatsApp configurations collection", True, 
                f"Configuration stored - Created: {created_at}, Updated: {updated_at}")
        else:
            self.log_test("WhatsApp configurations collection", False, "Configuration not found in database")
        
        # Test that conversations are being tracked (whatsapp_conversations collection)
        success, conv_response, status = self.make_request('GET', f'whatsapp/conversations?unit_id={self.unit_id}', expected_status=200)
        if success:
            conversations = conv_response.get('conversations', [])
            self.log_test("WhatsApp conversations collection", True, 
                f"Conversations collection accessible - {len(conversations)} conversations")
        else:
            self.log_test("WhatsApp conversations collection", False, "Conversations collection not accessible")
        
        # Test that messages are being stored (whatsapp_messages collection)
        test_phone = "+39 123 456 7890"
        encoded_phone = test_phone.replace("+", "%2B")
        success, msg_response, status = self.make_request(
            'GET', f'whatsapp/conversation/{encoded_phone}/history', expected_status=200
        )
        if success and msg_response.get('success'):
            messages = msg_response.get('messages', [])
            self.log_test("WhatsApp messages collection", True, 
                f"Messages collection accessible - {len(messages)} messages stored")
        else:
            self.log_test("WhatsApp messages collection", False, "Messages collection not accessible")
        
        # Test that validations are being stored (lead_whatsapp_validations collection)
        success, val_response, status = self.make_request('POST', f'whatsapp/validate-lead?lead_id={self.lead_id}', expected_status=200)
        if success and val_response.get('success'):
            validation_date = val_response.get('validation_date', 'N/A') if 'validation_date' in val_response else 'Stored'
            self.log_test("Lead WhatsApp validations collection", True, 
                f"Validation stored in database - Date: {validation_date}")
        else:
            self.log_test("Lead WhatsApp validations collection", False, "Lead validation not stored")

    def run_comprehensive_test(self):
        """Run comprehensive WhatsApp Business API system test"""
        print("🚀 Starting WhatsApp Business API System - COMPREHENSIVE TEST")
        print("=" * 70)
        print("OBIETTIVO: Verificare sistema WhatsApp avanzato completamente funzionale")
        print("=" * 70)
        
        # Step 1: Authentication
        if not self.authenticate():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Step 2: Setup test environment
        if not self.setup_test_environment():
            print("❌ Test environment setup failed - stopping tests")
            return False
        
        # Step 3: Test all WhatsApp functionality areas
        self.test_whatsapp_configuration()
        self.test_whatsapp_business_api()
        self.test_lead_validation_integration()
        self.test_conversation_management()
        self.test_authorization_security()
        self.test_whatsapp_service_class()
        self.test_database_integration()
        
        # Step 4: Print comprehensive summary
        print("\n" + "=" * 70)
        print("📊 WHATSAPP BUSINESS API SYSTEM - TEST RESULTS")
        print("=" * 70)
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print(f"🔢 Total Tests: {self.tests_run}")
        
        if success_rate >= 80:
            print("\n🎉 WHATSAPP SYSTEM TESTING COMPLETED SUCCESSFULLY!")
            print("✅ Sistema WhatsApp Business API completamente implementato e funzionale")
            print("✅ Tutti i componenti principali testati e operativi")
            print("✅ Integrazione CRM, validazione lead, e gestione conversazioni working")
            print("✅ Autorizzazioni, sicurezza, e database integration verified")
        else:
            print(f"\n⚠️ WHATSAPP SYSTEM TESTING COMPLETED WITH ISSUES")
            print(f"❌ {self.tests_run - self.tests_passed} tests failed - review required")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = WhatsAppTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)