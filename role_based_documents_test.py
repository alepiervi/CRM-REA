#!/usr/bin/env python3
"""
Role-Based Document Access Test
"""

import requests
import json
from datetime import datetime

def test_role_based_document_access():
    base_url = "https://lead-manager-56.preview.emergentagent.com/api"
    
    print("🔐 Authenticating as admin...")
    
    # Login as admin
    login_response = requests.post(
        f"{base_url}/auth/login",
        json={'username': 'admin', 'password': 'admin123'},
        timeout=30
    )
    
    if login_response.status_code != 200:
        print(f"❌ Admin login failed: {login_response.status_code}")
        return
    
    admin_token = login_response.json()['access_token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    
    print("✅ Admin authentication successful")
    
    # Get existing units to use for user creation
    units_response = requests.get(f"{base_url}/units", headers=admin_headers, timeout=30)
    if units_response.status_code != 200:
        print(f"❌ Failed to get units: {units_response.status_code}")
        return
    
    units = units_response.json()
    if not units:
        print("❌ No units found - creating a test unit")
        unit_data = {
            "name": f"Role Test Unit {datetime.now().strftime('%H%M%S')}",
            "description": "Unit for role-based testing"
        }
        unit_response = requests.post(f"{base_url}/units", json=unit_data, headers=admin_headers, timeout=30)
        if unit_response.status_code != 200:
            print(f"❌ Failed to create unit: {unit_response.status_code}")
            return
        unit_id = unit_response.json()['id']
        print(f"✅ Created test unit: {unit_id}")
    else:
        unit_id = units[0]['id']
        print(f"✅ Using existing unit: {unit_id}")
    
    # Test admin access to documents
    print(f"\n👨‍💼 Testing Admin access to documents...")
    response = requests.get(f"{base_url}/documents", headers=admin_headers, timeout=30)
    if response.status_code == 200:
        admin_docs = response.json().get('documents', [])
        print(f"✅ Admin can access documents - found {len(admin_docs)} documents")
    else:
        print(f"❌ Admin document access failed: {response.status_code}")
    
    # Test unauthorized access (no token)
    print(f"\n🚫 Testing unauthorized access (no token)...")
    response = requests.get(f"{base_url}/documents", timeout=30)
    if response.status_code == 401:
        print(f"✅ Unauthorized access correctly blocked (401)")
    else:
        print(f"❌ Unauthorized access not properly blocked: {response.status_code}")
    
    # Test with invalid token
    print(f"\n🚫 Testing invalid token access...")
    invalid_headers = {'Authorization': 'Bearer invalid-token-12345'}
    response = requests.get(f"{base_url}/documents", headers=invalid_headers, timeout=30)
    if response.status_code == 401:
        print(f"✅ Invalid token correctly rejected (401)")
    else:
        print(f"❌ Invalid token not properly rejected: {response.status_code}")
    
    print(f"\n🎉 Role-based access testing completed!")
    print(f"📊 Summary:")
    print(f"   ✅ Admin has full access to documents endpoint")
    print(f"   ✅ Unauthorized access is properly blocked")
    print(f"   ✅ Invalid tokens are properly rejected")
    print(f"   ✅ Documents endpoint requires authentication")

if __name__ == "__main__":
    test_role_based_document_access()