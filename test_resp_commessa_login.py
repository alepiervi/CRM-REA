#!/usr/bin/env python3
"""
Quick test to check resp_commessa login and documents access
"""

import requests
import json

def test_login(username, password):
    url = "https://client-search-fix-3.preview.emergentagent.com/api/auth/login"
    data = {'username': username, 'password': password}
    
    try:
        response = requests.post(url, json=data, timeout=30)
        print(f"Testing {username}/{password}: Status {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            user_data = result.get('user', {})
            print(f"  ✅ SUCCESS - Role: {user_data.get('role')}, Commesse: {len(user_data.get('commesse_autorizzate', []))}")
            return result.get('access_token')
        else:
            print(f"  ❌ FAILED - {response.json()}")
            return None
    except Exception as e:
        print(f"  ❌ ERROR - {e}")
        return None

def test_documents(token):
    url = "https://client-search-fix-3.preview.emergentagent.com/api/documents"
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Documents endpoint: Status {response.status_code}")
        
        if response.status_code == 200:
            docs = response.json()
            print(f"  ✅ SUCCESS - Found {len(docs)} documents")
            return True
        else:
            print(f"  ❌ FAILED - {response.json()}")
            return False
    except Exception as e:
        print(f"  ❌ ERROR - {e}")
        return False

if __name__ == "__main__":
    print("🔐 Testing resp_commessa login and documents access...")
    
    # Test different users
    test_users = [
        ('admin', 'admin123'),
        ('resp_commessa', 'admin123'),
        ('test2', 'admin123'),
        ('test_immediato', 'admin123')
    ]
    
    for username, password in test_users:
        token = test_login(username, password)
        if token:
            print(f"  Testing documents access for {username}...")
            test_documents(token)
        print()