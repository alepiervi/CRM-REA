#!/usr/bin/env python3
"""
Final verification of ChatBot fix as requested in the review
Specifically tests:
1. Verify endpoint /api/chat/session - try to create session with admin user
2. Test /api/chat/sessions - verify that admin can see sessions  
3. Test send message - try /api/chat/message for a created session
4. Verify no more 400 errors for admin
"""

import requests
import json

def test_chatbot_fix():
    base_url = "https://agentflow-crm.preview.emergentagent.com/api"
    
    print("🔍 FINAL CHATBOT VERIFICATION")
    print("=" * 50)
    
    # Step 1: Authenticate as admin
    print("1. Authenticating as admin user...")
    login_response = requests.post(f"{base_url}/auth/login", 
                                 json={'username': 'admin', 'password': 'admin123'})
    
    if login_response.status_code != 200:
        print(f"❌ Authentication failed: {login_response.status_code}")
        return False
    
    token = login_response.json()['access_token']
    user_data = login_response.json()['user']
    headers = {'Authorization': f'Bearer {token}'}
    
    print(f"✅ Admin authenticated successfully")
    print(f"   - Role: {user_data['role']}")
    print(f"   - Unit ID: {user_data.get('unit_id', 'None')}")
    
    # Step 2: Test /api/chat/session endpoint
    print("\n2. Testing /api/chat/session endpoint...")
    session_data = {'session_type': 'unit'}
    session_headers = {**headers, 'Content-Type': 'application/x-www-form-urlencoded'}
    
    session_response = requests.post(f"{base_url}/chat/session", 
                                   data=session_data, headers=session_headers)
    
    if session_response.status_code == 400:
        error_detail = session_response.json().get('detail', '')
        if error_detail == "User must belong to a unit":
            print(f"❌ CRITICAL: Still getting 400 error - {error_detail}")
            print("   The fix has NOT resolved the issue!")
            return False
        else:
            print(f"❌ Different 400 error: {error_detail}")
            return False
    elif session_response.status_code == 200:
        result = session_response.json()
        if result.get('success'):
            session_id = result['session']['session_id']
            print(f"✅ Session created successfully: {session_id}")
        else:
            print(f"❌ Session creation failed: {result}")
            return False
    else:
        print(f"❌ Unexpected status code: {session_response.status_code}")
        return False
    
    # Step 3: Test /api/chat/sessions endpoint
    print("\n3. Testing /api/chat/sessions endpoint...")
    sessions_response = requests.get(f"{base_url}/chat/sessions", headers=headers)
    
    if sessions_response.status_code == 400:
        error_detail = sessions_response.json().get('detail', '')
        if error_detail == "User must belong to a unit":
            print(f"❌ CRITICAL: Still getting 400 error - {error_detail}")
            return False
        else:
            print(f"❌ Different 400 error: {error_detail}")
            return False
    elif sessions_response.status_code == 200:
        sessions = sessions_response.json().get('sessions', [])
        print(f"✅ Admin can access sessions: Found {len(sessions)} sessions")
    else:
        print(f"❌ Unexpected status code: {sessions_response.status_code}")
        return False
    
    # Step 4: Test /api/chat/message endpoint
    print("\n4. Testing /api/chat/message endpoint...")
    message_data = {
        'session_id': session_id,
        'message': 'Test message to verify ChatBot functionality for admin user'
    }
    
    message_response = requests.post(f"{base_url}/chat/message", 
                                   data=message_data, headers=session_headers)
    
    if message_response.status_code == 400:
        error_detail = message_response.json().get('detail', '')
        print(f"❌ Message sending failed with 400: {error_detail}")
        return False
    elif message_response.status_code == 200:
        result = message_response.json()
        if result.get('success'):
            bot_response = result.get('response', '')
            print(f"✅ Message sent successfully")
            print(f"   Bot response: {bot_response[:100]}...")
        else:
            print(f"❌ Message sending failed: {result}")
            return False
    else:
        print(f"❌ Unexpected status code: {message_response.status_code}")
        return False
    
    # Final verification
    print("\n" + "=" * 50)
    print("🎉 VERIFICATION COMPLETE - ALL TESTS PASSED!")
    print("✅ /api/chat/session - Admin can create sessions")
    print("✅ /api/chat/sessions - Admin can view sessions")  
    print("✅ /api/chat/message - Admin can send messages")
    print("✅ No more 400 'User must belong to a unit' errors for admin")
    print("\n🔧 THE CHATBOT ERROR HAS BEEN SUCCESSFULLY RESOLVED!")
    
    return True

if __name__ == "__main__":
    test_chatbot_fix()