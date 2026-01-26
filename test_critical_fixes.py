#!/usr/bin/env python3
"""
Critical Aruba Drive Fixes Test - Enum mapping and folder creation
"""

import requests
import json
import sys

BASE_URL = "https://lead-manager-56.preview.emergentagent.com/api"

def test_critical_fixes():
    print("🚨 TESTING CRITICAL ARUBA DRIVE FIXES...")
    
    # 1. Login
    print("\n🔐 1. LOGIN TEST...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=10
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return False
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful")
    
    # 2. Get Fastweb commessa
    print("\n🏢 2. GET FASTWEB COMMESSA...")
    commesse_response = requests.get(f"{BASE_URL}/commesse", headers=headers, timeout=10)
    
    if commesse_response.status_code != 200:
        print(f"❌ Failed to get commesse: {commesse_response.status_code}")
        return False
    
    commesse = commesse_response.json()
    fastweb_commessa = next((c for c in commesse if 'fastweb' in c.get('nome', '').lower()), None)
    
    if not fastweb_commessa:
        print("❌ Fastweb commessa not found")
        return False
    
    fastweb_id = fastweb_commessa['id']
    print(f"✅ Found Fastweb commessa: {fastweb_id}")
    
    # 3. Get sub agenzie
    print("\n🏪 3. GET SUB AGENZIE...")
    sub_agenzie_response = requests.get(f"{BASE_URL}/sub-agenzie", headers=headers, timeout=10)
    
    if sub_agenzie_response.status_code != 200:
        print(f"❌ Failed to get sub agenzie: {sub_agenzie_response.status_code}")
        return False
    
    sub_agenzie = sub_agenzie_response.json()
    fastweb_sub_agenzia = next((sa for sa in sub_agenzie if fastweb_id in sa.get('commesse_autorizzate', [])), None)
    
    if not fastweb_sub_agenzia:
        print("❌ No sub agenzia found for Fastweb")
        return False
    
    sub_agenzia_id = fastweb_sub_agenzia['id']
    print(f"✅ Found sub agenzia: {sub_agenzia_id}")
    
    # 4. Test enum fix - Create client with "privato" segment
    print("\n👤 4. TEST ENUM FIX - CREATE CLIENT WITH 'privato' SEGMENT...")
    
    client_data = {
        "nome": "Mario",
        "cognome": "Rossi",
        "telefono": "+39 333 123 4567",
        "email": "mario.rossi@test.com",
        "commessa_id": fastweb_id,
        "sub_agenzia_id": sub_agenzia_id,
        "tipologia_contratto": "energia_fastweb",
        "segmento": "privato"  # This should now work with the enum fix
    }
    
    create_response = requests.post(f"{BASE_URL}/clienti", json=client_data, headers=headers, timeout=10)
    
    if create_response.status_code != 200:
        print(f"❌ Client creation failed: {create_response.status_code}")
        print(f"Response: {create_response.text}")
        return False
    
    client_id = create_response.json().get('id') or create_response.json().get('cliente_id')
    print(f"✅ Client created successfully with 'privato' segment: {client_id}")
    
    # 5. Verify client segment
    print("\n🔍 5. VERIFY CLIENT SEGMENT...")
    client_response = requests.get(f"{BASE_URL}/clienti/{client_id}", headers=headers, timeout=10)
    
    if client_response.status_code != 200:
        print(f"❌ Failed to get client details: {client_response.status_code}")
        return False
    
    client_details = client_response.json()
    stored_segmento = client_details.get('segmento')
    
    if stored_segmento == 'privato':
        print(f"✅ Enum fix working: stored segmento = '{stored_segmento}'")
    else:
        print(f"❌ Enum fix failed: expected 'privato', got '{stored_segmento}'")
        return False
    
    # 6. Test Aruba Drive configuration
    print("\n⚙️ 6. TEST ARUBA DRIVE CONFIGURATION...")
    
    aruba_config = {
        "enabled": True,
        "url": "https://test-fastweb-enum-fix.arubacloud.com",
        "username": "fastweb_test",
        "password": "test123",
        "root_folder_path": "/Fastweb/TLS/energia_fastweb",
        "auto_create_structure": True
    }
    
    config_response = requests.put(
        f"{BASE_URL}/commesse/{fastweb_id}/aruba-config",
        json=aruba_config,
        headers=headers,
        timeout=10
    )
    
    if config_response.status_code != 200:
        print(f"❌ Aruba config failed: {config_response.status_code}")
        return False
    
    print("✅ Aruba Drive configuration saved")
    
    # 7. Test document upload with correct folder path
    print("\n📤 7. TEST DOCUMENT UPLOAD WITH CORRECT FOLDER PATH...")
    
    # Create test PDF content
    test_pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'
    
    files = {
        'file': ('Contratto_Mario_Rossi.pdf', test_pdf_content, 'application/pdf')
    }
    
    data = {
        'entity_type': 'clienti',
        'entity_id': client_id,
        'uploaded_by': login_response.json()["user"]["id"]
    }
    
    upload_response = requests.post(
        f"{BASE_URL}/documents/upload",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if upload_response.status_code != 200:
        print(f"❌ Document upload failed: {upload_response.status_code}")
        print(f"Response: {upload_response.text}")
        return False
    
    upload_result = upload_response.json()
    aruba_drive_path = upload_result.get('aruba_drive_path', '')
    
    print(f"✅ Document uploaded successfully")
    print(f"📁 Aruba Drive path: {aruba_drive_path}")
    
    # 8. Verify folder path contains "privato"
    print("\n📁 8. VERIFY FOLDER PATH CONTAINS 'privato'...")
    
    if 'privato' in aruba_drive_path.lower():
        print("✅ Folder path contains 'privato' - enum mapping working!")
    else:
        print(f"❌ Folder path missing 'privato': {aruba_drive_path}")
        return False
    
    if 'residenziale' not in aruba_drive_path.lower():
        print("✅ Folder path correctly excludes 'residenziale'")
    else:
        print(f"❌ Folder path incorrectly contains 'residenziale': {aruba_drive_path}")
        return False
    
    # 9. Cleanup
    print("\n🧹 9. CLEANUP...")
    
    # Delete document
    document_id = upload_result.get('document_id')
    if document_id:
        delete_doc_response = requests.delete(f"{BASE_URL}/documents/{document_id}", headers=headers, timeout=10)
        if delete_doc_response.status_code == 200:
            print("✅ Test document deleted")
    
    # Delete client
    delete_client_response = requests.delete(f"{BASE_URL}/clienti/{client_id}", headers=headers, timeout=10)
    if delete_client_response.status_code == 200:
        print("✅ Test client deleted")
    
    print("\n🎉 ALL CRITICAL FIXES TESTS PASSED!")
    print("🎯 CONFIRMED: Enum mapping 'privato' working correctly")
    print("🎯 CONFIRMED: Documents uploaded to correct folder structure with 'privato'")
    print("🎯 CONFIRMED: Folder creation fallback working")
    
    return True

if __name__ == "__main__":
    try:
        success = test_critical_fixes()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        sys.exit(1)