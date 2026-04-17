#!/usr/bin/env python3
"""
Simple Document API Test - Focus on the specific issue
"""

import requests
import json

def test_documents_endpoint():
    base_url = "https://referente-hub.preview.emergentagent.com/api"
    
    print("🔐 Authenticating as admin...")
    
    # Login as admin
    login_response = requests.post(
        f"{base_url}/auth/login",
        json={'username': 'admin', 'password': 'admin123'},
        timeout=30
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"Response: {login_response.text}")
        return
    
    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    print("✅ Authentication successful")
    
    # Test basic documents endpoint
    print("\n📋 Testing GET /api/documents...")
    
    response = requests.get(f"{base_url}/documents", headers=headers, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        documents = data.get('documents', [])
        pagination = data.get('pagination', {})
        filters = data.get('filters_applied', {})
        
        print(f"✅ GET /api/documents successful")
        print(f"   📄 Found {len(documents)} documents")
        print(f"   📊 Total in database: {pagination.get('total', 0)}")
        print(f"   🔍 Filters available: {list(filters.keys())}")
        
        if documents:
            print(f"\n📋 First document structure:")
            first_doc = documents[0]
            for key, value in first_doc.items():
                if key == 'lead':
                    print(f"   {key}: {value}")
                else:
                    print(f"   {key}: {str(value)[:50]}...")
        
        # Test filtering by nome
        print(f"\n🔍 Testing nome filter...")
        response = requests.get(f"{base_url}/documents?nome=test", headers=headers, timeout=30)
        if response.status_code == 200:
            filter_data = response.json()
            filtered_docs = filter_data.get('documents', [])
            applied_filters = filter_data.get('filters_applied', {})
            print(f"✅ Nome filter works - found {len(filtered_docs)} documents")
            print(f"   Applied filters: {applied_filters}")
        else:
            print(f"❌ Nome filter failed: {response.status_code}")
        
        # Test filtering by cognome
        print(f"\n🔍 Testing cognome filter...")
        response = requests.get(f"{base_url}/documents?cognome=test", headers=headers, timeout=30)
        if response.status_code == 200:
            filter_data = response.json()
            filtered_docs = filter_data.get('documents', [])
            applied_filters = filter_data.get('filters_applied', {})
            print(f"✅ Cognome filter works - found {len(filtered_docs)} documents")
            print(f"   Applied filters: {applied_filters}")
        else:
            print(f"❌ Cognome filter failed: {response.status_code}")
        
        # Test filtering by lead_id
        print(f"\n🔍 Testing lead_id filter...")
        response = requests.get(f"{base_url}/documents?lead_id=test", headers=headers, timeout=30)
        if response.status_code == 200:
            filter_data = response.json()
            filtered_docs = filter_data.get('documents', [])
            applied_filters = filter_data.get('filters_applied', {})
            print(f"✅ Lead_id filter works - found {len(filtered_docs)} documents")
            print(f"   Applied filters: {applied_filters}")
        else:
            print(f"❌ Lead_id filter failed: {response.status_code}")
        
        # Test filtering by uploaded_by
        print(f"\n🔍 Testing uploaded_by filter...")
        response = requests.get(f"{base_url}/documents?uploaded_by=admin", headers=headers, timeout=30)
        if response.status_code == 200:
            filter_data = response.json()
            filtered_docs = filter_data.get('documents', [])
            applied_filters = filter_data.get('filters_applied', {})
            print(f"✅ Uploaded_by filter works - found {len(filtered_docs)} documents")
            print(f"   Applied filters: {applied_filters}")
        else:
            print(f"❌ Uploaded_by filter failed: {response.status_code}")
            
    else:
        print(f"❌ GET /api/documents failed: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    test_documents_endpoint()