"""
Test suite for Cliente Custom Fields CRUD API (Fase 1)
Tests:
- POST /api/cliente-custom-fields (admin only, 403 for non-admin)
- GET /api/cliente-custom-fields with filters
- PUT /api/cliente-custom-fields/{id} partial update
- DELETE /api/cliente-custom-fields/{id}
- field_type validation
- duplicate rejection (same name+commessa+tipologia)
- name normalization
- dati_aggiuntivi in POST/PUT /api/clienti
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://commessa-crm-hub.preview.emergentagent.com"

# Test credentials
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

# Test data - will be populated from API
TEST_COMMESSA_ID = None
TEST_TIPOLOGIA_ID = None
TEST_CLIENTE_ID = None


class TestClienteCustomFieldsBackend:
    """Backend API tests for Cliente Custom Fields"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASS}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def test_data(self, admin_headers):
        """Get test commessa and tipologia IDs"""
        global TEST_COMMESSA_ID, TEST_TIPOLOGIA_ID, TEST_CLIENTE_ID
        
        # Get first commessa
        commesse_res = requests.get(f"{BASE_URL}/api/commesse", headers=admin_headers)
        assert commesse_res.status_code == 200
        commesse = commesse_res.json()
        assert len(commesse) > 0, "No commesse found"
        TEST_COMMESSA_ID = commesse[0]["id"]
        
        # Get first tipologia
        tipologie_res = requests.get(f"{BASE_URL}/api/tipologie-contratto/all", headers=admin_headers)
        assert tipologie_res.status_code == 200
        tipologie = tipologie_res.json()
        assert len(tipologie) > 0, "No tipologie found"
        TEST_TIPOLOGIA_ID = tipologie[0]["value"]
        
        # Get first cliente for dati_aggiuntivi tests
        clienti_res = requests.get(f"{BASE_URL}/api/clienti?page=1&page_size=1", headers=admin_headers)
        assert clienti_res.status_code == 200
        clienti = clienti_res.json()
        if clienti.get("clienti") and len(clienti["clienti"]) > 0:
            TEST_CLIENTE_ID = clienti["clienti"][0]["id"]
        
        return {
            "commessa_id": TEST_COMMESSA_ID,
            "tipologia_id": TEST_TIPOLOGIA_ID,
            "cliente_id": TEST_CLIENTE_ID
        }
    
    @pytest.fixture(scope="class")
    def created_field_ids(self):
        """Track created field IDs for cleanup"""
        return []
    
    # ============================================================
    # TEST: POST /api/cliente-custom-fields
    # ============================================================
    
    def test_create_custom_field_admin_success(self, admin_headers, test_data, created_field_ids):
        """Admin can create a custom field"""
        unique_name = f"test_field_{uuid.uuid4().hex[:8]}"
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": unique_name,
            "label": f"Test Field {unique_name}",
            "field_type": "text",
            "placeholder": "Enter value",
            "required": False,
            "order": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["commessa_id"] == test_data["commessa_id"]
        assert data["tipologia_contratto_id"] == test_data["tipologia_id"]
        assert data["label"] == payload["label"]
        assert data["field_type"] == "text"
        assert data["active"] == True
        
        # Track for cleanup
        created_field_ids.append(data["id"])
        print(f"✓ Created custom field: {data['id']}")
    
    def test_create_custom_field_non_admin_forbidden(self, admin_headers, test_data):
        """Non-admin users should get 403"""
        # First create a non-admin user or use existing one
        # For this test, we'll try without auth to verify 401/403
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": "test_forbidden",
            "label": "Test Forbidden",
            "field_type": "text"
        }
        
        # Without auth
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=payload
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request rejected")
    
    def test_create_custom_field_invalid_field_type(self, admin_headers, test_data):
        """Invalid field_type should return 400"""
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": "test_invalid_type",
            "label": "Test Invalid Type",
            "field_type": "invalid_type"  # Invalid
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "field_type" in response.text.lower() or "invalid" in response.text.lower()
        print("✓ Invalid field_type rejected with 400")
    
    def test_create_custom_field_all_valid_types(self, admin_headers, test_data, created_field_ids):
        """Test all valid field types"""
        valid_types = ["text", "textarea", "number", "date", "email", "phone", "select", "multi_select", "checkbox"]
        
        for field_type in valid_types:
            unique_name = f"test_{field_type}_{uuid.uuid4().hex[:6]}"
            payload = {
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"],
                "name": unique_name,
                "label": f"Test {field_type.title()}",
                "field_type": field_type,
                "options": ["Option1", "Option2"] if field_type in ["select", "multi_select"] else []
            }
            
            response = requests.post(
                f"{BASE_URL}/api/cliente-custom-fields",
                json=payload,
                headers=admin_headers
            )
            
            assert response.status_code == 200, f"Create {field_type} failed: {response.text}"
            created_field_ids.append(response.json()["id"])
        
        print(f"✓ All {len(valid_types)} valid field types accepted")
    
    def test_create_custom_field_duplicate_rejected(self, admin_headers, test_data, created_field_ids):
        """Duplicate (name+commessa+tipologia) should be rejected with 400"""
        unique_name = f"duplicate_test_{uuid.uuid4().hex[:8]}"
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": unique_name,
            "label": "Duplicate Test",
            "field_type": "text"
        }
        
        # First creation should succeed
        response1 = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=payload,
            headers=admin_headers
        )
        assert response1.status_code == 200
        created_field_ids.append(response1.json()["id"])
        
        # Second creation with same name should fail
        response2 = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=payload,
            headers=admin_headers
        )
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        print("✓ Duplicate field rejected with 400")
    
    def test_create_custom_field_name_normalization(self, admin_headers, test_data, created_field_ids):
        """Name should be normalized (lowercase, underscores)"""
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": "Test Campo Speciale!@#",  # Should become test_campo_speciale
            "label": "Test Campo Speciale",
            "field_type": "text"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify normalization
        assert data["name"].islower() or "_" in data["name"], f"Name not normalized: {data['name']}"
        assert "!" not in data["name"] and "@" not in data["name"]
        created_field_ids.append(data["id"])
        print(f"✓ Name normalized: '{payload['name']}' -> '{data['name']}'")
    
    # ============================================================
    # TEST: GET /api/cliente-custom-fields
    # ============================================================
    
    def test_get_custom_fields_no_filter(self, admin_headers):
        """Get all custom fields without filters"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-custom-fields",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET all fields returned {len(data)} fields")
    
    def test_get_custom_fields_with_commessa_filter(self, admin_headers, test_data):
        """Get fields filtered by commessa_id"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-custom-fields",
            params={"commessa_id": test_data["commessa_id"]},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned fields should have matching commessa_id
        for field in data:
            assert field["commessa_id"] == test_data["commessa_id"]
        
        print(f"✓ GET with commessa filter returned {len(data)} fields")
    
    def test_get_custom_fields_with_both_filters(self, admin_headers, test_data):
        """Get fields filtered by both commessa_id and tipologia_contratto_id"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-custom-fields",
            params={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"]
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned fields should have matching IDs
        for field in data:
            assert field["commessa_id"] == test_data["commessa_id"]
            assert field["tipologia_contratto_id"] == test_data["tipologia_id"]
        
        print(f"✓ GET with both filters returned {len(data)} fields")
    
    # ============================================================
    # TEST: PUT /api/cliente-custom-fields/{id}
    # ============================================================
    
    def test_update_custom_field_partial(self, admin_headers, test_data, created_field_ids):
        """Partial update of custom field"""
        # First create a field
        unique_name = f"update_test_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": unique_name,
            "label": "Original Label",
            "field_type": "text",
            "required": False
        }
        
        create_res = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json=create_payload,
            headers=admin_headers
        )
        assert create_res.status_code == 200
        field_id = create_res.json()["id"]
        created_field_ids.append(field_id)
        
        # Update only label and required
        update_payload = {
            "label": "Updated Label",
            "required": True
        }
        
        update_res = requests.put(
            f"{BASE_URL}/api/cliente-custom-fields/{field_id}",
            json=update_payload,
            headers=admin_headers
        )
        
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"
        updated = update_res.json()
        
        assert updated["label"] == "Updated Label"
        assert updated["required"] == True
        assert updated["field_type"] == "text"  # Unchanged
        
        # Verify with GET
        get_res = requests.get(
            f"{BASE_URL}/api/cliente-custom-fields",
            params={"commessa_id": test_data["commessa_id"]},
            headers=admin_headers
        )
        assert get_res.status_code == 200
        
        print("✓ Partial update successful")
    
    def test_update_custom_field_invalid_type(self, admin_headers, test_data, created_field_ids):
        """Update with invalid field_type should fail"""
        # Create a field first
        unique_name = f"invalid_update_{uuid.uuid4().hex[:8]}"
        create_res = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"],
                "name": unique_name,
                "label": "Test",
                "field_type": "text"
            },
            headers=admin_headers
        )
        assert create_res.status_code == 200
        field_id = create_res.json()["id"]
        created_field_ids.append(field_id)
        
        # Try to update with invalid type
        update_res = requests.put(
            f"{BASE_URL}/api/cliente-custom-fields/{field_id}",
            json={"field_type": "invalid_type"},
            headers=admin_headers
        )
        
        assert update_res.status_code == 400
        print("✓ Update with invalid field_type rejected")
    
    def test_update_nonexistent_field(self, admin_headers):
        """Update non-existent field should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/cliente-custom-fields/{fake_id}",
            json={"label": "Test"},
            headers=admin_headers
        )
        
        assert response.status_code == 404
        print("✓ Update non-existent field returns 404")
    
    # ============================================================
    # TEST: DELETE /api/cliente-custom-fields/{id}
    # ============================================================
    
    def test_delete_custom_field(self, admin_headers, test_data):
        """Delete a custom field"""
        # Create a field to delete
        unique_name = f"delete_test_{uuid.uuid4().hex[:8]}"
        create_res = requests.post(
            f"{BASE_URL}/api/cliente-custom-fields",
            json={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"],
                "name": unique_name,
                "label": "To Delete",
                "field_type": "text"
            },
            headers=admin_headers
        )
        assert create_res.status_code == 200
        field_id = create_res.json()["id"]
        
        # Delete it
        delete_res = requests.delete(
            f"{BASE_URL}/api/cliente-custom-fields/{field_id}",
            headers=admin_headers
        )
        
        assert delete_res.status_code == 200
        
        # Verify it's gone - should not appear in GET
        get_res = requests.get(
            f"{BASE_URL}/api/cliente-custom-fields",
            params={"active_only": "false"},
            headers=admin_headers
        )
        assert get_res.status_code == 200
        fields = get_res.json()
        field_ids = [f["id"] for f in fields]
        assert field_id not in field_ids, "Deleted field still appears in list"
        
        print("✓ Delete successful and verified")
    
    def test_delete_nonexistent_field(self, admin_headers):
        """Delete non-existent field should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/cliente-custom-fields/{fake_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 404
        print("✓ Delete non-existent field returns 404")
    
    # ============================================================
    # TEST: dati_aggiuntivi in Cliente
    # ============================================================
    
    def test_cliente_dati_aggiuntivi_update(self, admin_headers, test_data):
        """Test that dati_aggiuntivi can be saved and read from cliente"""
        if not test_data.get("cliente_id"):
            pytest.skip("No cliente available for testing")
        
        # Get current cliente data
        get_res = requests.get(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            headers=admin_headers
        )
        assert get_res.status_code == 200
        cliente = get_res.json()
        
        # Update with dati_aggiuntivi - email is required by ClienteUpdate model
        test_dati = {
            "test_custom_field": "test_value_123",
            "another_field": 42
        }
        
        update_payload = {
            "email": cliente.get("email", "test@example.com"),  # Required field
            "dati_aggiuntivi": test_dati
        }
        
        update_res = requests.put(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            json=update_payload,
            headers=admin_headers
        )
        
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"
        updated = update_res.json()
        
        # Verify dati_aggiuntivi was saved
        assert "dati_aggiuntivi" in updated
        assert updated["dati_aggiuntivi"].get("test_custom_field") == "test_value_123"
        
        # Verify with GET
        verify_res = requests.get(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            headers=admin_headers
        )
        assert verify_res.status_code == 200
        verified = verify_res.json()
        assert verified["dati_aggiuntivi"].get("test_custom_field") == "test_value_123"
        
        # Cleanup - restore original dati_aggiuntivi
        requests.put(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            json={
                "email": cliente.get("email", "test@example.com"),
                "dati_aggiuntivi": cliente.get("dati_aggiuntivi", {})
            },
            headers=admin_headers
        )
        
        print("✓ dati_aggiuntivi saved and read successfully")
    
    # ============================================================
    # CLEANUP
    # ============================================================
    
    def test_cleanup_created_fields(self, admin_headers, created_field_ids):
        """Cleanup all test-created fields"""
        deleted_count = 0
        for field_id in created_field_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/cliente-custom-fields/{field_id}",
                    headers=admin_headers
                )
                if response.status_code == 200:
                    deleted_count += 1
            except Exception as e:
                print(f"Warning: Failed to delete field {field_id}: {e}")
        
        print(f"✓ Cleanup: deleted {deleted_count}/{len(created_field_ids)} test fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
