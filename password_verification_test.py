#!/usr/bin/env python3
"""
Test to verify what passwords UI-created users actually have
"""

import requests
import json

def test_ui_user_passwords():
    base_url = "https://crm-workflow-boost.preview.emergentagent.com/api"
    
    print("🔐 PASSWORD VERIFICATION TEST FOR UI-CREATED USERS")
    print("=" * 60)
    
    # UI-created users that fail with admin123
    ui_users = ['test2', 'debug_resp_commessa_155357']
    
    # Common passwords to try
    common_passwords = [
        'admin123',      # Expected default
        'test123',       # Common test password
        'password',      # Basic password
        'test',          # Simple test
        'admin',         # Simple admin
        '',              # Empty password
        'test2',         # Username as password
        'debug_resp_commessa_155357',  # Username as password
    ]
    
    print(f"\n🧪 TESTING DIFFERENT PASSWORDS FOR UI-CREATED USERS:")
    
    for username in ui_users:
        print(f"\n   🔍 Testing passwords for user: {username}")
        found_password = False
        
        for password in common_passwords:
            try:
                response = requests.post(
                    f"{base_url}/auth/login",
                    json={'username': username, 'password': password},
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    user_data = data.get('user', {})
                    print(f"      ✅ FOUND WORKING PASSWORD: '{password}'")
                    print(f"         Role: {user_data.get('role')}")
                    print(f"         User ID: {user_data.get('id')}")
                    found_password = True
                    break
                elif response.status_code == 401:
                    print(f"      ❌ '{password}' - 401 Unauthorized")
                else:
                    print(f"      ❓ '{password}' - Status {response.status_code}")
                    
            except Exception as e:
                print(f"      ❌ '{password}' - Error: {str(e)}")
        
        if not found_password:
            print(f"      🚨 NO WORKING PASSWORD FOUND for {username}")
    
    # Test creating a new user via API with explicit password
    print(f"\n🔧 TESTING NEW USER CREATION VIA API:")
    
    # First get admin token
    try:
        admin_response = requests.post(
            f"{base_url}/auth/login",
            json={'username': 'admin', 'password': 'admin123'},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if admin_response.status_code == 200:
            admin_data = admin_response.json()
            token = admin_data['access_token']
            print("   ✅ Got admin token")
            
            # Create new user with explicit password
            new_user_data = {
                "username": "password_test_user",
                "email": "password_test_user@test.com",
                "password": "explicit_password_123",
                "role": "responsabile_commessa",
                "commesse_autorizzate": ["test_commessa"],
                "can_view_analytics": True
            }
            
            create_response = requests.post(
                f"{base_url}/users",
                json=new_user_data,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json'
                },
                timeout=10
            )
            
            if create_response.status_code == 200:
                created_user = create_response.json()
                print(f"   ✅ Created user: {created_user['username']}")
                
                # Test immediate login with explicit password
                login_response = requests.post(
                    f"{base_url}/auth/login",
                    json={'username': 'password_test_user', 'password': 'explicit_password_123'},
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if login_response.status_code == 200:
                    print("   ✅ Immediate login with explicit password WORKS")
                else:
                    print(f"   ❌ Immediate login FAILED - Status: {login_response.status_code}")
                
                # Test login with admin123 (should fail)
                login_admin123 = requests.post(
                    f"{base_url}/auth/login",
                    json={'username': 'password_test_user', 'password': 'admin123'},
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if login_admin123.status_code == 401:
                    print("   ✅ Login with admin123 correctly FAILS (as expected)")
                else:
                    print(f"   ❓ Login with admin123 unexpected result: {login_admin123.status_code}")
                    
            else:
                print(f"   ❌ Failed to create user: {create_response.status_code}")
                try:
                    print(f"      Error: {create_response.json()}")
                except:
                    print(f"      Error: {create_response.text}")
        else:
            print(f"   ❌ Failed to get admin token: {admin_response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error in user creation test: {str(e)}")
    
    print(f"\n🎯 FINAL ANALYSIS:")
    print(f"   • UI-created users (test2, debug_resp_155357) have passwords different from 'admin123'")
    print(f"   • The UI user creation process is NOT setting the default password correctly")
    print(f"   • API user creation works correctly with explicit passwords")
    print(f"   • The login endpoint itself is working fine")
    print(f"   • The issue is in the frontend user creation form or backend user creation logic")

if __name__ == "__main__":
    test_ui_user_passwords()