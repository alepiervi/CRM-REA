"""E2E test for Sub Agenzia privileges (feb 2026).

Full end-to-end scenario:
  1. Admin creates a sub agenzia with `can_change_status=True` and
     `hidden_tipologie_for_bo_commessa=['Energia']` linked to an existing commessa.
  2. Admin creates 2 test users: a BACKOFFICE_COMMESSA authorised for the commessa,
     and a BACKOFFICE_SUB_AGENZIA assigned to the sub agenzia.
  3. Admin creates 2 clienti in the sub agenzia: one with tipologia_contratto='Energia',
     one with tipologia_contratto='Telefonia'.
  4. As BO Commessa:
        - GET /api/clienti must NOT contain the 'Energia' cliente
          but MUST contain the 'Telefonia' cliente.
        - GET /api/clienti/{id} on the 'Energia' cliente returns 403.
        - GET /api/clienti/{id} on the 'Telefonia' cliente returns 200.
  5. As BO Sub Agenzia (privilege ON):
        - /api/auth/me returns bo_sub_agenzia_can_change_status=True
        - PUT /api/clienti/{id} with status='inserito' persists.
  6. Admin disables can_change_status:
        - /api/auth/me of BO Sub Agenzia → flag=False
        - PUT status as BO Sub Agenzia → status is restored (not updated).
  7. Cleanup all test data.
"""
import os
import uuid
import requests
import pytest

BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL_TESTS") or os.environ.get(
    "REACT_APP_BACKEND_URL"
) or "http://localhost:8001"
if not BACKEND_URL.endswith("/api"):
    BACKEND_URL = BACKEND_URL.rstrip("/") + "/api"

TIMEOUT = 30


def _login(username: str, password: str) -> str:
    r = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={"username": username, "password": password},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin", "admin123")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return _h(admin_token)


@pytest.fixture(scope="module")
def commessa_id(admin_headers):
    r = requests.get(f"{BACKEND_URL}/commesse", headers=admin_headers, timeout=TIMEOUT)
    r.raise_for_status()
    commesse = r.json()
    assert commesse, "No commesse found in environment - cannot run E2E"
    return commesse[0]["id"]


@pytest.fixture(scope="module")
def e2e_resources(admin_headers, commessa_id):
    """Create sub agenzia + 2 users + 2 clienti. Cleanup after tests."""
    suffix = uuid.uuid4().hex[:6]
    created = {
        "sub_id": None,
        "bo_commessa_user_id": None,
        "bo_sub_user_id": None,
        "cliente_energia_id": None,
        "cliente_telefonia_id": None,
        "bo_commessa_username": f"TEST_bo_com_{suffix}",
        "bo_sub_username": f"TEST_bo_sub_{suffix}",
        "bo_commessa_password": "Test123!Pwd",
        "bo_sub_password": "Test123!Pwd",
    }

    # 1. Create sub agenzia with privileges
    sub_payload = {
        "nome": f"TEST_sa_priv_{suffix}",
        "descrizione": "E2E test sub agenzia",
        "responsabile_id": "stub-resp-id",
        "commesse_autorizzate": [commessa_id],
        "servizi_autorizzati": [],
        "can_change_status": True,
        "hidden_tipologie_for_bo_commessa": ["Energia"],
    }
    r = requests.post(
        f"{BACKEND_URL}/sub-agenzie", headers=admin_headers, json=sub_payload, timeout=TIMEOUT
    )
    assert r.status_code == 200, f"sub-agenzie create failed: {r.text}"
    sub = r.json()
    created["sub_id"] = sub["id"]
    assert sub["can_change_status"] is True
    assert sub["hidden_tipologie_for_bo_commessa"] == ["Energia"]

    # 2. Create BACKOFFICE_COMMESSA user
    bo_com_payload = {
        "username": created["bo_commessa_username"],
        "email": f"{created['bo_commessa_username']}@nureal.it",
        "password": created["bo_commessa_password"],
        "role": "backoffice_commessa",
        "commesse_autorizzate": [commessa_id],
        "servizi_autorizzati": [],
    }
    r = requests.post(
        f"{BACKEND_URL}/users", headers=admin_headers, json=bo_com_payload, timeout=TIMEOUT
    )
    assert r.status_code == 200, f"create BO commessa failed: {r.text}"
    created["bo_commessa_user_id"] = r.json()["id"]

    # 3. Create BACKOFFICE_SUB_AGENZIA user (assigned to sub agenzia)
    bo_sub_payload = {
        "username": created["bo_sub_username"],
        "email": f"{created['bo_sub_username']}@nureal.it",
        "password": created["bo_sub_password"],
        "role": "backoffice_sub_agenzia",
        "sub_agenzia_id": created["sub_id"],
        "commesse_autorizzate": [commessa_id],
        "sub_agenzie_autorizzate": [created["sub_id"]],
    }
    r = requests.post(
        f"{BACKEND_URL}/users", headers=admin_headers, json=bo_sub_payload, timeout=TIMEOUT
    )
    assert r.status_code == 200, f"create BO sub-agenzia failed: {r.text}"
    created["bo_sub_user_id"] = r.json()["id"]

    # 3b. Create UserCommessaAuthorization records so the BO Sub Agenzia & BO Commessa users
    #     pass the can_user_modify_cliente() / can_create_clients checks in security.py.
    auth_bo_sub = {
        "user_id": created["bo_sub_user_id"],
        "commessa_id": commessa_id,
        "sub_agenzia_id": created["sub_id"],
        "role_in_commessa": "backoffice_sub_agenzia",
        "can_view_all_agencies": False,
        "can_modify_clients": True,
        "can_create_clients": True,
    }
    r = requests.post(
        f"{BACKEND_URL}/user-commessa-authorizations",
        headers=admin_headers,
        json=auth_bo_sub,
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"create user-commessa-auth (BO Sub) failed: {r.text}"
    created["auth_bo_sub_id"] = r.json()["id"]

    # 4. Create 2 clienti via admin
    def _cliente(tipologia_label: str, suffix2: str):
        return {
            "cognome": f"TESTCog{suffix2}",
            "nome": f"TESTNom{suffix2}",
            "email": f"TEST_{suffix2}_{suffix}@nureal.it",
            "telefono": "3331234567",
            "codice_fiscale": f"TST{suffix2}{suffix}AB12C34D".upper()[:16],
            "commessa_id": commessa_id,
            "sub_agenzia_id": created["sub_id"],
            "tipologia_contratto": tipologia_label,
        }

    r = requests.post(
        f"{BACKEND_URL}/clienti",
        headers=admin_headers,
        json=_cliente("Energia", "E"),
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"create cliente Energia failed: {r.text}"
    created["cliente_energia_id"] = r.json()["id"]

    r = requests.post(
        f"{BACKEND_URL}/clienti",
        headers=admin_headers,
        json=_cliente("Telefonia", "T"),
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"create cliente Telefonia failed: {r.text}"
    created["cliente_telefonia_id"] = r.json()["id"]

    yield created

    # ---- cleanup ----
    if created["cliente_energia_id"]:
        requests.delete(
            f"{BACKEND_URL}/clienti/{created['cliente_energia_id']}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
    if created["cliente_telefonia_id"]:
        requests.delete(
            f"{BACKEND_URL}/clienti/{created['cliente_telefonia_id']}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
    if created["bo_commessa_user_id"]:
        requests.delete(
            f"{BACKEND_URL}/users/{created['bo_commessa_user_id']}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
    if created["bo_sub_user_id"]:
        requests.delete(
            f"{BACKEND_URL}/users/{created['bo_sub_user_id']}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
    if created["sub_id"]:
        requests.delete(
            f"{BACKEND_URL}/sub-agenzie/{created['sub_id']}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_bo_commessa_does_not_see_hidden_tipologia_in_list(e2e_resources):
    """BO Commessa must NOT see the 'Energia' cliente from a sub agenzia with hidden_tipologie=['Energia']
    but must still see other clienti from the same sub agenzia."""
    bo_token = _login(
        e2e_resources["bo_commessa_username"], e2e_resources["bo_commessa_password"]
    )
    r = requests.get(
        f"{BACKEND_URL}/clienti?page_size=1000",
        headers=_h(bo_token),
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("clienti") or body.get("items") or body.get("data") or []
    # Some endpoints return list-of-dicts directly; tolerate that
    if isinstance(body, list):
        items = body
    ids = {c["id"] for c in items}
    assert e2e_resources["cliente_energia_id"] not in ids, (
        "BO Commessa MUST NOT see Energia cliente from sub agenzia with hidden_tipologie=['Energia']"
    )
    assert e2e_resources["cliente_telefonia_id"] in ids, (
        "BO Commessa MUST still see Telefonia cliente from same sub agenzia"
    )


def test_bo_commessa_get_single_hidden_cliente_returns_403(e2e_resources):
    bo_token = _login(
        e2e_resources["bo_commessa_username"], e2e_resources["bo_commessa_password"]
    )
    r = requests.get(
        f"{BACKEND_URL}/clienti/{e2e_resources['cliente_energia_id']}",
        headers=_h(bo_token),
        timeout=TIMEOUT,
    )
    assert r.status_code == 403, f"Expected 403 for hidden cliente, got {r.status_code}: {r.text}"


def test_bo_commessa_get_single_visible_cliente_returns_200(e2e_resources):
    bo_token = _login(
        e2e_resources["bo_commessa_username"], e2e_resources["bo_commessa_password"]
    )
    r = requests.get(
        f"{BACKEND_URL}/clienti/{e2e_resources['cliente_telefonia_id']}",
        headers=_h(bo_token),
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text


def test_bo_sub_agenzia_auth_me_has_can_change_status_true(e2e_resources):
    bo_sub_token = _login(
        e2e_resources["bo_sub_username"], e2e_resources["bo_sub_password"]
    )
    r = requests.get(
        f"{BACKEND_URL}/auth/me", headers=_h(bo_sub_token), timeout=TIMEOUT
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("bo_sub_agenzia_can_change_status") is True


def test_bo_sub_agenzia_can_modify_status_when_privilege_on(e2e_resources, admin_headers):
    """With can_change_status=True, BO Sub Agenzia can change cliente status."""
    bo_sub_token = _login(
        e2e_resources["bo_sub_username"], e2e_resources["bo_sub_password"]
    )
    cliente_id = e2e_resources["cliente_telefonia_id"]

    # capture original
    r = requests.get(
        f"{BACKEND_URL}/clienti/{cliente_id}", headers=admin_headers, timeout=TIMEOUT
    )
    assert r.status_code == 200
    original_status = r.json().get("status")
    new_status = "inserito" if original_status != "inserito" else "ko"

    r = requests.put(
        f"{BACKEND_URL}/clienti/{cliente_id}",
        headers=_h(bo_sub_token),
        json={"status": new_status, "email": f"TEST_upd_{uuid.uuid4().hex[:6]}@nureal.it"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == new_status

    # verify persistence via admin
    r2 = requests.get(
        f"{BACKEND_URL}/clienti/{cliente_id}", headers=admin_headers, timeout=TIMEOUT
    )
    assert r2.json()["status"] == new_status


def test_bo_sub_agenzia_cannot_modify_status_when_privilege_off(
    e2e_resources, admin_headers
):
    """After admin disables can_change_status, BO Sub Agenzia status update is silently ignored."""
    # Disable privilege
    r = requests.put(
        f"{BACKEND_URL}/sub-agenzie/{e2e_resources['sub_id']}",
        headers=admin_headers,
        json={"can_change_status": False},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    assert r.json()["can_change_status"] is False

    bo_sub_token = _login(
        e2e_resources["bo_sub_username"], e2e_resources["bo_sub_password"]
    )

    # /auth/me must reflect the change
    me = requests.get(
        f"{BACKEND_URL}/auth/me", headers=_h(bo_sub_token), timeout=TIMEOUT
    )
    assert me.status_code == 200
    assert me.json().get("bo_sub_agenzia_can_change_status") is False

    cliente_id = e2e_resources["cliente_telefonia_id"]
    r = requests.get(
        f"{BACKEND_URL}/clienti/{cliente_id}", headers=admin_headers, timeout=TIMEOUT
    )
    original_status = r.json().get("status")
    forbidden_new = "ko" if original_status != "ko" else "inserito"

    # Attempt to update status
    r = requests.put(
        f"{BACKEND_URL}/clienti/{cliente_id}",
        headers=_h(bo_sub_token),
        json={"status": forbidden_new, "email": f"TEST_upd2_{uuid.uuid4().hex[:6]}@nureal.it"},
        timeout=TIMEOUT,
    )
    # Backend silently restores status -> request succeeds but status unchanged
    if r.status_code == 200:
        assert r.json()["status"] == original_status, (
            "Status must NOT change when privilege is OFF"
        )
    else:
        # acceptable alt: 403
        assert r.status_code == 403, f"unexpected status: {r.status_code} {r.text}"

    # re-enable for downstream cleanup safety
    requests.put(
        f"{BACKEND_URL}/sub-agenzie/{e2e_resources['sub_id']}",
        headers=admin_headers,
        json={"can_change_status": True},
        timeout=TIMEOUT,
    )
