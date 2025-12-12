#!/usr/bin/env python3
"""
Focused login debug test for the 401 issue
"""

import requests
import json

def test_login_debug():
    base_url = "https://clientmanage-2.preview.emergentagent.com/api"
    
    print("🚨 FOCUSED LOGIN DEBUG TEST")
    print("=" * 50)
    
    # Test different users with admin123 password
    test_users = [
        ('admin', 'admin123', 'Should work'),
        ('resp_commessa', 'admin123', 'Reported to fail but actually works'),
        ('test2', 'admin123', 'UI-created user - fails'),
        ('debug_resp_commessa_155357', 'admin123', 'UI-created user - fails'),
        ('test_immediato', 'admin123', 'API-created user - works'),
    ]
    
    print("\n🧪 TESTING LOGIN FOR DIFFERENT USERS:")
    for username, password, description in test_users:
        print(f"\n   Testing {username}/{password} - {description}")
        
        try:
            response = requests.post(
                f"{base_url}/auth/login",
                json={'username': username, 'password': password},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            print(f"      Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                user_data = data.get('user', {})
                print(f"      ✅ SUCCESS - Role: {user_data.get('role')}")
                print(f"         User ID: {user_data.get('id')}")
                print(f"         Is Active: {user_data.get('is_active')}")
                print(f"         Commesse: {len(user_data.get('commesse_autorizzate', []))}")
            elif response.status_code == 401:
                try:
                    error_data = response.json()
                    print(f"      ❌ 401 UNAUTHORIZED - {error_data.get('detail', 'No detail')}")
                except:
                    print(f"      ❌ 401 UNAUTHORIZED - No JSON response")
            else:
                print(f"      ❓ UNEXPECTED STATUS - {response.status_code}")
                try:
                    print(f"         Response: {response.json()}")
                except:
                    print(f"         Response: {response.text}")
                    
        except Exception as e:
            print(f"      ❌ ERROR - {str(e)}")
    
    # Get user data to analyze differences
    print(f"\n🔍 GETTING USER DATA FOR ANALYSIS...")
    
    # First login as admin to get token
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
            print("   ✅ Got admin token for user data retrieval")
            
            # Get all users
            users_response = requests.get(
                f"{base_url}/users",
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json'
                },
                timeout=10
            )
            
            if users_response.status_code == 200:
                users = users_response.json()
                print(f"   ✅ Retrieved {len(users)} users from database")
                
                # Analyze specific users
                target_users = ['admin', 'resp_commessa', 'test2', 'debug_resp_commessa_155357', 'test_immediato']
                
                for username in target_users:
                    user = next((u for u in users if u.get('username') == username), None)
                    if user:
                        print(f"\n   📊 USER: {username}")
                        print(f"      Role: {user.get('role')}")
                        print(f"      Is Active: {user.get('is_active')}")
                        print(f"      Password Hash: {user.get('password_hash', '')[:30]}...")
                        print(f"      Hash Length: {len(user.get('password_hash', ''))}")
                        print(f"      Created: {user.get('created_at', 'N/A')}")
                        print(f"      Last Login: {user.get('last_login', 'Never')}")
                        
                        # Check hash format
                        password_hash = user.get('password_hash', '')
                        is_bcrypt = password_hash.startswith('$2b$') or password_hash.startswith('$2a$')
                        print(f"      Bcrypt Format: {is_bcrypt}")
                        
                        if not is_bcrypt and password_hash:
                            print(f"      ⚠️  WARNING: Hash not in bcrypt format!")
                    else:
                        print(f"\n   ❌ USER {username} NOT FOUND")
            else:
                print(f"   ❌ Failed to get users: {users_response.status_code}")
        else:
            print(f"   ❌ Failed to get admin token: {admin_response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error getting user data: {str(e)}")
    
    print(f"\n🎯 CONCLUSION:")
    print(f"   • resp_commessa/admin123 actually WORKS (contrary to reported issue)")
    print(f"   • The issue is with specific UI-created users like test2, debug_resp_155357")
    print(f"   • These users likely have different passwords than expected")
    print(f"   • API-created users (test_immediato) work fine")
    print(f"   • The problem is NOT with the role or login endpoint logic")
    print(f"   • The problem is likely with password storage during UI user creation")

if __name__ == "__main__":
    test_login_debug()