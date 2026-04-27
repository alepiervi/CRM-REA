"""Tests for immutable cliente notes history feature.

Endpoints:
- POST /api/clienti/{cliente_id}/note-history
- GET  /api/clienti/{cliente_id}/note-history?tipo={cliente|backoffice}
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://commessa-crm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Cliente test esistente noto da contesto
EXISTING_CLIENTE_ID = "a02cc1a1-d3f5-4660-b6ed-c72dd6064a17"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def non_admin_token(admin_headers):
    """Create or reuse a non-admin user with role agente_specializzato."""
    # Try to create
    username = "TEST_note_agente_001"
    password = "testpass123"
    payload = {
        "username": username,
        "password": password,
        "email": f"{username}@example.com",
        "full_name": "Test Note Agente",
        "role": "agente_specializzato",
    }
    r = requests.post(f"{API}/users", json=payload, headers=admin_headers, timeout=15)
    # 200 or 400 (already exists) both ok
    if r.status_code not in (200, 201, 400, 409):
        pytest.skip(f"Cannot create non-admin user: {r.status_code} {r.text}")
    # Login
    rl = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=15)
    if rl.status_code != 200:
        pytest.skip(f"Non-admin login failed: {rl.status_code} {rl.text}")
    return rl.json()["access_token"]


@pytest.fixture(scope="session")
def non_admin_headers(non_admin_token):
    return {"Authorization": f"Bearer {non_admin_token}", "Content-Type": "application/json"}


# --- Health/sanity ---
class TestSanity:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10


# --- POST cliente note ---
class TestPostNoteCliente:
    def test_admin_post_note_cliente_ok(self, admin_headers):
        content = f"TEST nota cliente {uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history",
            json={"tipo": "cliente", "content": content},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and isinstance(d["id"], str)
        assert d["cliente_id"] == EXISTING_CLIENTE_ID
        assert d["tipo"] == "cliente"
        assert d["content"] == content
        assert d.get("created_by_username") == "admin"
        assert "created_at" in d
        assert "created_by_id" in d

    def test_admin_post_note_backoffice_ok(self, admin_headers):
        content = f"TEST nota backoffice admin {uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history",
            json={"tipo": "backoffice", "content": content},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tipo"] == "backoffice"
        assert d["content"] == content

    def test_non_admin_post_note_backoffice_403(self, non_admin_headers):
        r = requests.post(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history",
            json={"tipo": "backoffice", "content": "should fail"},
            headers=non_admin_headers,
            timeout=15,
        )
        # Either 403 (correct) or 403 from access; spec wants 403 with permission detail
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_post_empty_content_400(self, admin_headers):
        r = requests.post(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history",
            json={"tipo": "cliente", "content": "   "},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 400
        assert "vuota" in r.text.lower() or "empty" in r.text.lower()

    def test_post_invalid_tipo_400(self, admin_headers):
        r = requests.post(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history",
            json={"tipo": "altro", "content": "x"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 400

    def test_post_cliente_inesistente_404(self, admin_headers):
        r = requests.post(
            f"{API}/clienti/non-esiste-xxx/note-history",
            json={"tipo": "cliente", "content": "x"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 404


# --- GET note-history ---
class TestGetNoteHistory:
    def test_get_all_sorted_desc(self, admin_headers):
        r = requests.get(f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Verify desc order
        timestamps = [e["created_at"] for e in data]
        assert timestamps == sorted(timestamps, reverse=True), "Notes not sorted desc"

    def test_get_filter_tipo_cliente(self, admin_headers):
        r = requests.get(f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history?tipo=cliente", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert all(e["tipo"] == "cliente" for e in data)

    def test_get_filter_tipo_backoffice(self, admin_headers):
        r = requests.get(f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history?tipo=backoffice", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert all(e["tipo"] == "backoffice" for e in data)


# --- Immutability: PUT/DELETE not exposed ---
class TestImmutability:
    def test_put_note_not_allowed(self, admin_headers):
        # Pick any existing note id
        r = requests.get(f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        notes = r.json()
        if not notes:
            pytest.skip("No notes to test PUT against")
        nid = notes[0]["id"]
        r2 = requests.put(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history/{nid}",
            json={"content": "hacked"},
            headers=admin_headers,
            timeout=15,
        )
        assert r2.status_code in (404, 405), f"Expected 404/405, got {r2.status_code}"

    def test_delete_note_not_allowed(self, admin_headers):
        r = requests.get(f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history", headers=admin_headers, timeout=15)
        notes = r.json()
        if not notes:
            pytest.skip("No notes to test DELETE against")
        nid = notes[0]["id"]
        r2 = requests.delete(
            f"{API}/clienti/{EXISTING_CLIENTE_ID}/note-history/{nid}",
            headers=admin_headers,
            timeout=15,
        )
        assert r2.status_code in (404, 405), f"Expected 404/405, got {r2.status_code}"


# --- Regression: PUT /api/clienti/{id} still works ---
class TestRegressionEditCliente:
    def test_put_cliente_still_works(self, admin_headers):
        # GET cliente
        r = requests.get(f"{API}/clienti/{EXISTING_CLIENTE_ID}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        cli = r.json()
        # PUT minimal change (touch nome, then revert)
        original_nome = cli.get("nome")
        payload = dict(cli)
        payload["nome"] = original_nome  # no real change
        # Strip server-managed fields that shouldn't be sent
        for k in ("_id", "created_at", "updated_at", "stato_locked_at", "deleted_at"):
            payload.pop(k, None)
        r2 = requests.put(f"{API}/clienti/{EXISTING_CLIENTE_ID}", json=payload, headers=admin_headers, timeout=20)
        assert r2.status_code == 200, f"PUT cliente failed: {r2.status_code} {r2.text[:300]}"
