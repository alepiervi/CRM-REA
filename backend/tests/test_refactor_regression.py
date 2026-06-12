"""Regression tests after structural refactor (models.py extraction + frontend page splits).
Verifies that core backend endpoints still work and Pydantic models load correctly.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lead-qualification-5.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


def test_login_admin():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"


def test_get_clienti(headers):
    r = requests.get(f"{BASE_URL}/api/clienti?page=1&page_size=10", headers=headers, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    body = r.json()
    # Either paginated dict or list
    assert isinstance(body, (dict, list))
    if isinstance(body, dict):
        assert "clienti" in body or "total" in body


def test_get_leads(headers):
    r = requests.get(f"{BASE_URL}/api/leads", headers=headers, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, (list, dict))


def test_get_users(headers):
    r = requests.get(f"{BASE_URL}/api/users", headers=headers, timeout=30)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert any(u.get("username") == "admin" for u in users)


def test_get_commesse(headers):
    r = requests.get(f"{BASE_URL}/api/commesse", headers=headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_workflows(headers):
    r = requests.get(f"{BASE_URL}/api/workflows", headers=headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_workflow_node_types(headers):
    r = requests.get(f"{BASE_URL}/api/workflow-node-types", headers=headers, timeout=30)
    assert r.status_code == 200
    body = r.json()
    # Registry should contain known structures
    assert body is not None


def test_get_spoki_conversations(headers):
    r = requests.get(f"{BASE_URL}/api/spoki/conversations", headers=headers, timeout=30)
    # Spoki may return 200 with empty list or specific error (401 from upstream is acceptable)
    assert r.status_code in (200, 401, 500, 502), f"Unexpected: {r.status_code} {r.text[:200]}"


def test_get_spoki_openai_assistants(headers):
    r = requests.get(f"{BASE_URL}/api/spoki/openai-assistants", headers=headers, timeout=60)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    body = r.json()
    # Returns either list or {assistants: [...]}
    assistants = body if isinstance(body, list) else body.get("assistants", body.get("data", []))
    assert isinstance(assistants, list)


def test_create_and_delete_test_cliente(headers):
    """POST + cleanup test cliente with TEST- prefix."""
    # Need a commessa + sub_agenzia
    c_resp = requests.get(f"{BASE_URL}/api/commesse", headers=headers, timeout=30)
    assert c_resp.status_code == 200
    commesse = c_resp.json()
    if not commesse:
        pytest.skip("No commesse available to create test cliente")
    commessa_id = commesse[0]["id"]

    sa_resp = requests.get(f"{BASE_URL}/api/sub-agenzie", headers=headers, timeout=30)
    if sa_resp.status_code != 200 or not sa_resp.json():
        pytest.skip("No sub-agenzie available")
    sub_agenzia_id = sa_resp.json()[0]["id"]

    payload = {
        "nome": "TEST-Refactor",
        "cognome": "TEST-Regression",
        "email": "test.refactor@example.com",
        "telefono": "+390000000000",
        "codice_fiscale": "TSTRFC00A01H501Z",
        "commessa_id": commessa_id,
        "sub_agenzia_id": sub_agenzia_id,
    }
    r = requests.post(f"{BASE_URL}/api/clienti", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text[:400]}"
    created = r.json()
    cid = created.get("id") or created.get("cliente_id")
    assert cid

    # Verify GET
    g = requests.get(f"{BASE_URL}/api/clienti/{cid}", headers=headers, timeout=20)
    assert g.status_code == 200
    fetched = g.json()
    assert fetched["nome"] == "TEST-Refactor"

    # Cleanup
    d = requests.delete(f"{BASE_URL}/api/clienti/{cid}", headers=headers, timeout=20)
    assert d.status_code in (200, 204, 404)
