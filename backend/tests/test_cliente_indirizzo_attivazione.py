"""
Test suite per i campi Indirizzo Residenza e Indirizzo Attivazione su Cliente.
Verifica che POST /api/clienti e PUT /api/clienti/{id} accettino
provincia_attivazione e cap_attivazione senza errori 422.
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback for test
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and return token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login",
                         json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def first_commessa_and_subag(admin_headers):
    """Get first commessa and sub_agenzia for creating clients"""
    r = requests.get(f"{BASE_URL}/api/commesse", headers=admin_headers)
    assert r.status_code == 200
    commesse = r.json()
    assert len(commesse) > 0, "No commesse available for testing"
    commessa_id = commesse[0]["id"]

    r2 = requests.get(f"{BASE_URL}/api/sub-agenzie", headers=admin_headers)
    assert r2.status_code == 200
    subs = r2.json()
    assert len(subs) > 0, "No sub-agenzie available for testing"
    sub_agenzia_id = subs[0]["id"]

    return commessa_id, sub_agenzia_id


def _make_payload(commessa_id, sub_agenzia_id, suffix=""):
    """Build minimal cliente payload with both address blocks"""
    uniq = uuid.uuid4().hex[:8]
    return {
        "cognome": f"TEST_Attiv{suffix}",
        "nome": f"Mario_{uniq}",
        "email": f"test_attiv_{uniq}@example.com",
        "telefono": "3331234567",
        "codice_fiscale": f"RSSMRA80A01F205{uniq[:1].upper()}",
        # Indirizzo Residenza
        "indirizzo": "Via Garibaldi 10",
        "comune_residenza": "Torino",
        "provincia": "TO",
        "cap": "10100",
        # Indirizzo Attivazione
        "indirizzo_attivazione": "Via Roma 1",
        "comune_attivazione": "Milano",
        "provincia_attivazione": "MI",
        "cap_attivazione": "20100",
        "commessa_id": commessa_id,
        "sub_agenzia_id": sub_agenzia_id,
    }


class TestClienteIndirizzoAttivazione:

    def test_create_cliente_with_both_addresses(self, admin_headers, first_commessa_and_subag):
        """POST /api/clienti accetta provincia_attivazione e cap_attivazione"""
        commessa_id, sub_agenzia_id = first_commessa_and_subag
        payload = _make_payload(commessa_id, sub_agenzia_id, "_create")

        resp = requests.post(f"{BASE_URL}/api/clienti", headers=admin_headers, json=payload)
        assert resp.status_code in (200, 201), f"Create failed: {resp.status_code} {resp.text}"

        data = resp.json()
        # Verify all activation address fields persisted
        assert data.get("indirizzo_attivazione") == "Via Roma 1"
        assert data.get("comune_attivazione") == "Milano"
        assert data.get("provincia_attivazione") == "MI"
        assert data.get("cap_attivazione") == "20100"
        # Verify residenza fields
        assert data.get("indirizzo") == "Via Garibaldi 10"
        assert data.get("comune_residenza") == "Torino"
        assert data.get("provincia") == "TO"
        assert data.get("cap") == "10100"

        cliente_id = data["id"]

        # GET to verify persistence
        r2 = requests.get(f"{BASE_URL}/api/clienti/{cliente_id}", headers=admin_headers)
        assert r2.status_code == 200
        fetched = r2.json()
        assert fetched["provincia_attivazione"] == "MI"
        assert fetched["cap_attivazione"] == "20100"
        assert fetched["indirizzo_attivazione"] == "Via Roma 1"
        assert fetched["comune_attivazione"] == "Milano"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/clienti/{cliente_id}", headers=admin_headers)

    def test_update_cliente_adds_activation_address(self, admin_headers, first_commessa_and_subag):
        """PUT /api/clienti/{id} accetta provincia_attivazione e cap_attivazione senza 422"""
        commessa_id, sub_agenzia_id = first_commessa_and_subag

        # Create with only residenza
        payload = _make_payload(commessa_id, sub_agenzia_id, "_update")
        payload["indirizzo_attivazione"] = None
        payload["comune_attivazione"] = None
        payload["provincia_attivazione"] = None
        payload["cap_attivazione"] = None

        resp = requests.post(f"{BASE_URL}/api/clienti", headers=admin_headers, json=payload)
        assert resp.status_code in (200, 201), f"Create failed: {resp.status_code} {resp.text}"
        cliente_id = resp.json()["id"]

        # Update to add activation fields
        update_payload = {
            "email": payload["email"],  # required in ClienteUpdate
            "indirizzo_attivazione": "Corso Duomo 5",
            "comune_attivazione": "Napoli",
            "provincia_attivazione": "NA",
            "cap_attivazione": "80100",
        }
        r_upd = requests.put(f"{BASE_URL}/api/clienti/{cliente_id}",
                             headers=admin_headers, json=update_payload)
        assert r_upd.status_code == 200, f"Update failed: {r_upd.status_code} {r_upd.text}"

        # Verify persistence via GET
        r_get = requests.get(f"{BASE_URL}/api/clienti/{cliente_id}", headers=admin_headers)
        assert r_get.status_code == 200
        fetched = r_get.json()
        assert fetched["provincia_attivazione"] == "NA"
        assert fetched["cap_attivazione"] == "80100"
        assert fetched["indirizzo_attivazione"] == "Corso Duomo 5"
        assert fetched["comune_attivazione"] == "Napoli"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/clienti/{cliente_id}", headers=admin_headers)

    def test_create_without_activation_ok(self, admin_headers, first_commessa_and_subag):
        """Activation fields are optional - create without them must succeed"""
        commessa_id, sub_agenzia_id = first_commessa_and_subag
        payload = _make_payload(commessa_id, sub_agenzia_id, "_noact")
        del payload["indirizzo_attivazione"]
        del payload["comune_attivazione"]
        del payload["provincia_attivazione"]
        del payload["cap_attivazione"]

        resp = requests.post(f"{BASE_URL}/api/clienti", headers=admin_headers, json=payload)
        assert resp.status_code in (200, 201), f"Create failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert data.get("provincia_attivazione") in (None, "")
        assert data.get("cap_attivazione") in (None, "")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/clienti/{data['id']}", headers=admin_headers)
