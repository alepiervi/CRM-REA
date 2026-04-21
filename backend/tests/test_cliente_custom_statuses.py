"""
Test suite for Cliente Custom Statuses CRUD API (Fase 3)
Tests:
- POST /api/cliente-custom-statuses (admin only, 403 for non-admin)
- POST respinge valori che conflittano con ClienteStatus enum standard (es. 'inserito')
- GET /api/cliente-custom-statuses filtrato per commessa_id + tipologia_contratto_id
- PUT /api/cliente-custom-statuses/{id} aggiornamento parziale (name/color/icon/stage/order/active). Il 'value' NON è modificabile.
- DELETE /api/cliente-custom-statuses/{id} — ritorna clients_using_status count
- Duplicati (stesso value+commessa+tipologia) respinti con 400
- GET /api/cliente-status-options (senza filtri ritorna solo standard = 14 voci; con filtri include anche custom)
- GET /api/analytics/cliente-statuses-breakdown ritorna {total, by_status[], by_stage{nuovo, in_lavorazione, chiuso_vinto, chiuso_perso}}
- POST/PUT cliente con status valore custom viene accettato e salvato correttamente
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
TEST_SUB_AGENZIA_ID = None


class TestClienteCustomStatusesBackend:
    """Backend API tests for Cliente Custom Statuses (Fase 3)"""
    
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
        """Get test commessa, tipologia, sub_agenzia and cliente IDs"""
        global TEST_COMMESSA_ID, TEST_TIPOLOGIA_ID, TEST_CLIENTE_ID, TEST_SUB_AGENZIA_ID
        
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
        
        # Get first sub_agenzia
        sub_agenzie_res = requests.get(f"{BASE_URL}/api/sub-agenzie", headers=admin_headers)
        assert sub_agenzie_res.status_code == 200
        sub_agenzie = sub_agenzie_res.json()
        if len(sub_agenzie) > 0:
            TEST_SUB_AGENZIA_ID = sub_agenzie[0]["id"]
        
        # Get first cliente for status update tests
        clienti_res = requests.get(f"{BASE_URL}/api/clienti?page=1&page_size=1", headers=admin_headers)
        assert clienti_res.status_code == 200
        clienti = clienti_res.json()
        if clienti.get("clienti") and len(clienti["clienti"]) > 0:
            TEST_CLIENTE_ID = clienti["clienti"][0]["id"]
        
        return {
            "commessa_id": TEST_COMMESSA_ID,
            "tipologia_id": TEST_TIPOLOGIA_ID,
            "cliente_id": TEST_CLIENTE_ID,
            "sub_agenzia_id": TEST_SUB_AGENZIA_ID
        }
    
    @pytest.fixture(scope="class")
    def created_status_ids(self):
        """Track created status IDs for cleanup"""
        return []
    
    # ============================================================
    # TEST: POST /api/cliente-custom-statuses
    # ============================================================
    
    def test_create_custom_status_admin_success(self, admin_headers, test_data, created_status_ids):
        """Admin can create a custom status"""
        unique_name = f"TEST_Status_{uuid.uuid4().hex[:8]}"
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": unique_name,
            "color": "#ff5733",
            "icon": "⏰",
            "stage": "in_lavorazione",
            "order": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["commessa_id"] == test_data["commessa_id"]
        assert data["tipologia_contratto_id"] == test_data["tipologia_id"]
        assert data["name"] == unique_name
        assert data["color"] == "#ff5733"
        assert data["icon"] == "⏰"
        assert data["stage"] == "in_lavorazione"
        assert data["order"] == 1
        assert data["active"] == True
        
        # Verify value is normalized from name
        assert data["value"] is not None
        assert data["value"].islower() or "_" in data["value"]
        
        # Track for cleanup
        created_status_ids.append(data["id"])
        print(f"✓ Created custom status: {data['id']} - {data['name']} (value: {data['value']})")
    
    def test_create_custom_status_non_admin_forbidden(self, test_data):
        """Non-admin users should get 401/403"""
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": "test_forbidden_status",
            "stage": "nuovo"
        }
        
        # Without auth
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=payload
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request rejected")
    
    def test_create_custom_status_standard_value_rejected(self, admin_headers, test_data):
        """Creating status with value conflicting with standard enum should be rejected"""
        # 'inserito' is a standard ClienteStatus enum value
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": "Inserito",  # Will normalize to 'inserito' which conflicts with standard
            "stage": "chiuso_vinto"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for standard value conflict, got {response.status_code}"
        assert "riservato" in response.text.lower() or "standard" in response.text.lower()
        print("✓ Standard value conflict rejected with 400")
    
    def test_create_custom_status_duplicate_rejected(self, admin_headers, test_data, created_status_ids):
        """Duplicate (value+commessa+tipologia) should be rejected with 400"""
        unique_name = f"TEST_Duplicate_{uuid.uuid4().hex[:8]}"
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": unique_name,
            "stage": "nuovo"
        }
        
        # First creation should succeed
        response1 = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=payload,
            headers=admin_headers
        )
        assert response1.status_code == 200
        created_status_ids.append(response1.json()["id"])
        
        # Second creation with same name should fail
        response2 = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=payload,
            headers=admin_headers
        )
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        assert "esiste già" in response2.text.lower() or "already" in response2.text.lower() or "duplicate" in response2.text.lower()
        print("✓ Duplicate status rejected with 400")
    
    def test_create_custom_status_all_stages(self, admin_headers, test_data, created_status_ids):
        """Test all valid stage values"""
        valid_stages = ["nuovo", "in_lavorazione", "chiuso_vinto", "chiuso_perso"]
        
        for stage in valid_stages:
            unique_name = f"TEST_Stage_{stage}_{uuid.uuid4().hex[:6]}"
            payload = {
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"],
                "name": unique_name,
                "stage": stage
            }
            
            response = requests.post(
                f"{BASE_URL}/api/cliente-custom-statuses",
                json=payload,
                headers=admin_headers
            )
            
            assert response.status_code == 200, f"Create with stage '{stage}' failed: {response.text}"
            assert response.json()["stage"] == stage
            created_status_ids.append(response.json()["id"])
        
        print(f"✓ All {len(valid_stages)} valid stages accepted")
    
    def test_create_custom_status_name_normalization(self, admin_headers, test_data, created_status_ids):
        """Name should be normalized to value (lowercase, underscores)"""
        payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": "Richiamo Domani!@#",  # Should become richiamo_domani
            "stage": "in_lavorazione"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify normalization
        assert data["value"].islower()
        assert "!" not in data["value"] and "@" not in data["value"]
        assert "_" in data["value"] or data["value"].isalnum()
        created_status_ids.append(data["id"])
        print(f"✓ Name normalized: '{payload['name']}' -> value: '{data['value']}'")
    
    # ============================================================
    # TEST: GET /api/cliente-custom-statuses
    # ============================================================
    
    def test_get_custom_statuses_no_filter(self, admin_headers):
        """Get all custom statuses without filters"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-custom-statuses",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET all statuses returned {len(data)} statuses")
    
    def test_get_custom_statuses_with_commessa_filter(self, admin_headers, test_data):
        """Get statuses filtered by commessa_id"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-custom-statuses",
            params={"commessa_id": test_data["commessa_id"]},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned statuses should have matching commessa_id
        for status in data:
            assert status["commessa_id"] == test_data["commessa_id"]
        
        print(f"✓ GET with commessa filter returned {len(data)} statuses")
    
    def test_get_custom_statuses_with_both_filters(self, admin_headers, test_data):
        """Get statuses filtered by both commessa_id and tipologia_contratto_id"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-custom-statuses",
            params={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"]
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned statuses should have matching IDs
        for status in data:
            assert status["commessa_id"] == test_data["commessa_id"]
            assert status["tipologia_contratto_id"] == test_data["tipologia_id"]
        
        print(f"✓ GET with both filters returned {len(data)} statuses")
    
    # ============================================================
    # TEST: GET /api/cliente-status-options
    # ============================================================
    
    def test_get_status_options_no_filter_returns_standard_only(self, admin_headers):
        """Without filters, should return only 14 standard statuses"""
        response = requests.get(
            f"{BASE_URL}/api/cliente-status-options",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have exactly 14 standard statuses (ClienteStatus enum has 14 values)
        assert len(data) == 14, f"Expected 14 standard statuses, got {len(data)}"
        
        # All should be marked as standard
        for opt in data:
            assert opt["is_standard"] == True
        
        print(f"✓ GET status options without filters returned {len(data)} standard statuses")
    
    def test_get_status_options_with_filters_includes_custom(self, admin_headers, test_data, created_status_ids):
        """With commessa+tipologia filters, should include custom statuses"""
        # First ensure we have at least one custom status
        if len(created_status_ids) == 0:
            unique_name = f"TEST_ForOptions_{uuid.uuid4().hex[:8]}"
            create_res = requests.post(
                f"{BASE_URL}/api/cliente-custom-statuses",
                json={
                    "commessa_id": test_data["commessa_id"],
                    "tipologia_contratto_id": test_data["tipologia_id"],
                    "name": unique_name,
                    "stage": "in_lavorazione"
                },
                headers=admin_headers
            )
            assert create_res.status_code == 200
            created_status_ids.append(create_res.json()["id"])
        
        response = requests.get(
            f"{BASE_URL}/api/cliente-status-options",
            params={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"]
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have more than 14 (standard + custom)
        assert len(data) > 14, f"Expected more than 14 statuses with custom, got {len(data)}"
        
        # Check we have both standard and custom
        standard_count = sum(1 for opt in data if opt["is_standard"])
        custom_count = sum(1 for opt in data if not opt["is_standard"])
        
        assert standard_count == 14, f"Expected 14 standard, got {standard_count}"
        assert custom_count > 0, f"Expected at least 1 custom, got {custom_count}"
        
        print(f"✓ GET status options with filters returned {standard_count} standard + {custom_count} custom statuses")
    
    # ============================================================
    # TEST: PUT /api/cliente-custom-statuses/{id}
    # ============================================================
    
    def test_update_custom_status_partial(self, admin_headers, test_data, created_status_ids):
        """Partial update of custom status (name/color/icon/stage/order/active)"""
        # First create a status
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "commessa_id": test_data["commessa_id"],
            "tipologia_contratto_id": test_data["tipologia_id"],
            "name": unique_name,
            "color": "#000000",
            "stage": "nuovo",
            "order": 0
        }
        
        create_res = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json=create_payload,
            headers=admin_headers
        )
        assert create_res.status_code == 200
        status_id = create_res.json()["id"]
        original_value = create_res.json()["value"]
        created_status_ids.append(status_id)
        
        # Update name, color, icon, stage, order, active
        update_payload = {
            "name": f"Updated_{unique_name}",
            "color": "#ff0000",
            "icon": "🔥",
            "stage": "chiuso_vinto",
            "order": 10,
            "active": False
        }
        
        update_res = requests.put(
            f"{BASE_URL}/api/cliente-custom-statuses/{status_id}",
            json=update_payload,
            headers=admin_headers
        )
        
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"
        updated = update_res.json()
        
        assert updated["name"] == f"Updated_{unique_name}"
        assert updated["color"] == "#ff0000"
        assert updated["icon"] == "🔥"
        assert updated["stage"] == "chiuso_vinto"
        assert updated["order"] == 10
        assert updated["active"] == False
        
        # CRITICAL: value should NOT change
        assert updated["value"] == original_value, f"Value should not change! Was {original_value}, now {updated['value']}"
        
        print("✓ Partial update successful, value preserved")
    
    def test_update_nonexistent_status(self, admin_headers):
        """Update non-existent status should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/cliente-custom-statuses/{fake_id}",
            json={"name": "Test"},
            headers=admin_headers
        )
        
        assert response.status_code == 404
        print("✓ Update non-existent status returns 404")
    
    # ============================================================
    # TEST: DELETE /api/cliente-custom-statuses/{id}
    # ============================================================
    
    def test_delete_custom_status_returns_client_count(self, admin_headers, test_data):
        """Delete status should return clients_using_status count"""
        # Create a status to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_res = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"],
                "name": unique_name,
                "stage": "in_lavorazione"
            },
            headers=admin_headers
        )
        assert create_res.status_code == 200
        status_id = create_res.json()["id"]
        
        # Delete it
        delete_res = requests.delete(
            f"{BASE_URL}/api/cliente-custom-statuses/{status_id}",
            headers=admin_headers
        )
        
        assert delete_res.status_code == 200
        delete_data = delete_res.json()
        
        # Verify response contains clients_using_status
        assert "clients_using_status" in delete_data
        assert isinstance(delete_data["clients_using_status"], int)
        assert "id" in delete_data
        assert delete_data["id"] == status_id
        
        print(f"✓ Delete successful, clients_using_status: {delete_data['clients_using_status']}")
    
    def test_delete_nonexistent_status(self, admin_headers):
        """Delete non-existent status should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/cliente-custom-statuses/{fake_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 404
        print("✓ Delete non-existent status returns 404")
    
    # ============================================================
    # TEST: GET /api/analytics/cliente-statuses-breakdown
    # ============================================================
    
    def test_analytics_breakdown_structure(self, admin_headers):
        """Analytics breakdown should return correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/cliente-statuses-breakdown",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "by_status" in data
        assert "by_stage" in data
        
        assert isinstance(data["total"], int)
        assert isinstance(data["by_status"], list)
        assert isinstance(data["by_stage"], dict)
        
        # Verify by_stage has all 4 stages
        assert "nuovo" in data["by_stage"]
        assert "in_lavorazione" in data["by_stage"]
        assert "chiuso_vinto" in data["by_stage"]
        assert "chiuso_perso" in data["by_stage"]
        
        print(f"✓ Analytics breakdown: total={data['total']}, by_stage={data['by_stage']}")
    
    def test_analytics_breakdown_with_filters(self, admin_headers, test_data):
        """Analytics breakdown with commessa+tipologia filters"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/cliente-statuses-breakdown",
            params={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"]
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "by_status" in data
        assert "by_stage" in data
        assert "filters" in data
        
        # Verify filters are echoed back
        assert data["filters"]["commessa_id"] == test_data["commessa_id"]
        assert data["filters"]["tipologia_contratto_id"] == test_data["tipologia_id"]
        
        print(f"✓ Analytics breakdown with filters: total={data['total']}")
    
    def test_analytics_breakdown_by_status_structure(self, admin_headers):
        """Each by_status entry should have correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/cliente-statuses-breakdown",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["by_status"]) > 0:
            entry = data["by_status"][0]
            assert "value" in entry
            assert "name" in entry
            assert "stage" in entry
            assert "is_standard" in entry
            assert "count" in entry
            
            print(f"✓ by_status entry structure verified: {entry}")
        else:
            print("✓ No clienti found, by_status is empty (expected if no data)")
    
    # ============================================================
    # TEST: Cliente with custom status value
    # ============================================================
    
    def test_cliente_with_custom_status_value(self, admin_headers, test_data, created_status_ids):
        """Test that cliente can be updated with a custom status value"""
        if not test_data.get("cliente_id"):
            pytest.skip("No cliente available for testing")
        
        # First create a custom status
        unique_name = f"TEST_ClienteStatus_{uuid.uuid4().hex[:8]}"
        create_status_res = requests.post(
            f"{BASE_URL}/api/cliente-custom-statuses",
            json={
                "commessa_id": test_data["commessa_id"],
                "tipologia_contratto_id": test_data["tipologia_id"],
                "name": unique_name,
                "stage": "in_lavorazione"
            },
            headers=admin_headers
        )
        assert create_status_res.status_code == 200
        custom_status_value = create_status_res.json()["value"]
        created_status_ids.append(create_status_res.json()["id"])
        
        # Get current cliente data
        get_res = requests.get(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            headers=admin_headers
        )
        assert get_res.status_code == 200
        cliente = get_res.json()
        original_status = cliente.get("status")
        
        # Update cliente with custom status value
        update_payload = {
            "email": cliente.get("email", "test@example.com"),  # Required field
            "status": custom_status_value
        }
        
        update_res = requests.put(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            json=update_payload,
            headers=admin_headers
        )
        
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"
        updated = update_res.json()
        
        # Verify custom status was saved
        assert updated["status"] == custom_status_value, f"Expected status '{custom_status_value}', got '{updated['status']}'"
        
        # Verify with GET
        verify_res = requests.get(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            headers=admin_headers
        )
        assert verify_res.status_code == 200
        verified = verify_res.json()
        assert verified["status"] == custom_status_value
        
        # Restore original status
        requests.put(
            f"{BASE_URL}/api/clienti/{test_data['cliente_id']}",
            json={
                "email": cliente.get("email", "test@example.com"),
                "status": original_status or "da_inserire"
            },
            headers=admin_headers
        )
        
        print(f"✓ Cliente updated with custom status '{custom_status_value}' successfully")
    
    # ============================================================
    # CLEANUP
    # ============================================================
    
    def test_cleanup_created_statuses(self, admin_headers, created_status_ids):
        """Cleanup all test-created statuses"""
        deleted_count = 0
        for status_id in created_status_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/cliente-custom-statuses/{status_id}",
                    headers=admin_headers
                )
                if response.status_code in [200, 404]:  # 404 if already deleted
                    deleted_count += 1
            except Exception as e:
                print(f"Warning: Failed to delete status {status_id}: {e}")
        
        print(f"✓ Cleanup: deleted {deleted_count}/{len(created_status_ids)} test statuses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
