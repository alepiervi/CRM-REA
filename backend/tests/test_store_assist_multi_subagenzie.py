"""Backend tests for Store Assistant multi sub-agenzia feature.

Scenarios:
1. Admin creates store_assist user with multiple sub_agenzie_autorizzate; verify via GET /api/users.
2. Admin updates existing store_assist user to add/remove sub_agenzie_autorizzate; verify persistence.
3. The created store_assist can login and GET /api/cascade/sub-agenzie returns ALL authorized sub agenzie.
4. Legacy fallback: store_assist with only sub_agenzia_id (no sub_agenzie_autorizzate) still sees its sub agenzia in cascade.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"
TEST_PWD = "test12345"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def existing_sub_agenzie(admin_headers):
    r = requests.get(f"{BASE_URL}/api/sub-agenzie", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    active = [s for s in data if s.get("is_active", True)]
    assert len(active) >= 2, f"Need at least 2 active sub agenzie, got {len(active)}"
    return active


@pytest.fixture(scope="module")
def existing_commesse(admin_headers):
    r = requests.get(f"{BASE_URL}/api/commesse", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def existing_servizi(admin_headers):
    r = requests.get(f"{BASE_URL}/api/servizi", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    return r.json()


# Track created test user ids for cleanup
_created_ids = []


@pytest.fixture(scope="module", autouse=True)
def cleanup_users(admin_headers):
    yield
    for uid in _created_ids:
        try:
            requests.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_headers, timeout=15)
        except Exception:
            pass


def _unique(prefix):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


def test_1_create_store_assist_with_multiple_sub_agenzie(admin_headers, existing_sub_agenzie,
                                                         existing_commesse, existing_servizi):
    sa1, sa2 = existing_sub_agenzie[0], existing_sub_agenzie[1]
    sub_ag_ids = [sa1["id"], sa2["id"]]

    # Pick commesse that intersect sub agenzie commesse_autorizzate
    commesse_from_sa = set((sa1.get("commesse_autorizzate") or []) + (sa2.get("commesse_autorizzate") or []))
    commesse_ids = list(commesse_from_sa)[:2] if commesse_from_sa else [c["id"] for c in existing_commesse[:1]]
    servizi_ids = [s["id"] for s in existing_servizi[:2]]

    username = _unique("sa")
    payload = {
        "username": username,
        "email": f"{username}@example.com",
        "password": TEST_PWD,
        "nome": "Test",
        "cognome": "StoreAssist",
        "role": "store_assist",
        "sub_agenzie_autorizzate": sub_ag_ids,
        "commesse_autorizzate": commesse_ids,
        "servizi_autorizzati": servizi_ids,
        "is_active": True,
    }
    r = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"Create user failed: {r.status_code} {r.text}"
    body = r.json()
    user_id = body.get("id") or body.get("user", {}).get("id")
    assert user_id
    _created_ids.append(user_id)

    # GET /api/users and verify persistence
    r2 = requests.get(f"{BASE_URL}/api/users", headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    users = r2.json()
    created = next((u for u in users if u.get("id") == user_id), None)
    assert created is not None, "Created user not found in GET /api/users"
    assert created.get("role") == "store_assist"
    saved = created.get("sub_agenzie_autorizzate") or []
    assert set(saved) == set(sub_ag_ids), f"sub_agenzie_autorizzate mismatch: {saved} vs {sub_ag_ids}"

    # Save data for later tests
    pytest.store_assist_user_id = user_id
    pytest.store_assist_username = username
    pytest.store_assist_sub_ags = sub_ag_ids
    pytest.store_assist_commesse = commesse_ids
    pytest.store_assist_servizi = servizi_ids


def test_2_update_store_assist_add_remove_sub_agenzie(admin_headers, existing_sub_agenzie):
    user_id = getattr(pytest, "store_assist_user_id", None)
    if not user_id:
        pytest.skip("prev test did not create user")

    # New set: remove sa1, add sa3 (if present) else just keep sa2
    if len(existing_sub_agenzie) >= 3:
        new_set = [existing_sub_agenzie[1]["id"], existing_sub_agenzie[2]["id"]]
    else:
        new_set = [existing_sub_agenzie[1]["id"]]

    r = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers,
                     json={"sub_agenzie_autorizzate": new_set}, timeout=30)
    assert r.status_code in (200, 204), f"Update failed: {r.status_code} {r.text}"

    r2 = requests.get(f"{BASE_URL}/api/users", headers=admin_headers, timeout=30)
    users = r2.json()
    u = next((x for x in users if x.get("id") == user_id), None)
    assert u is not None
    assert set(u.get("sub_agenzie_autorizzate") or []) == set(new_set), \
        f"After update: {u.get('sub_agenzie_autorizzate')} vs {new_set}"

    pytest.store_assist_sub_ags = new_set


def test_3_store_assist_cascade_sub_agenzie_returns_all_authorized(admin_headers):
    username = getattr(pytest, "store_assist_username", None)
    expected = getattr(pytest, "store_assist_sub_ags", None)
    if not username or not expected:
        pytest.skip("no store assist user")

    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": username, "password": TEST_PWD}, timeout=30)
    assert r.status_code == 200, f"Login as store_assist failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r2 = requests.get(f"{BASE_URL}/api/cascade/sub-agenzie", headers=headers, timeout=30)
    assert r2.status_code == 200, r2.text
    returned = r2.json()
    returned_ids = {s["id"] for s in returned}
    assert set(expected).issubset(returned_ids), \
        f"Cascade did not return all authorized sub ags. Expected subset {expected}, got {returned_ids}"
    # Also verify no extras beyond authorized
    assert returned_ids == set(expected), f"Unexpected extras: {returned_ids - set(expected)}"


def test_4_legacy_fallback_sub_agenzia_id_only(admin_headers, existing_sub_agenzie):
    """Store assist with ONLY sub_agenzia_id (no sub_agenzie_autorizzate) must still see it in cascade."""
    sa = existing_sub_agenzie[0]
    username = _unique("legacy")
    payload = {
        "username": username,
        "email": f"{username}@example.com",
        "password": TEST_PWD,
        "nome": "Legacy",
        "cognome": "StoreAssist",
        "role": "store_assist",
        "sub_agenzia_id": sa["id"],
        "sub_agenzie_autorizzate": [],   # explicitly empty
        "commesse_autorizzate": [],
        "servizi_autorizzati": [],
        "is_active": True,
    }
    r = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"Create legacy user failed: {r.status_code} {r.text}"
    body = r.json()
    uid = body.get("id") or body.get("user", {}).get("id")
    _created_ids.append(uid)

    # Verify stored
    r2 = requests.get(f"{BASE_URL}/api/users", headers=admin_headers, timeout=30)
    u = next((x for x in r2.json() if x.get("id") == uid), None)
    assert u and u.get("sub_agenzia_id") == sa["id"]
    assert not (u.get("sub_agenzie_autorizzate") or []), \
        f"Legacy user should have empty sub_agenzie_autorizzate, got {u.get('sub_agenzie_autorizzate')}"

    # Login + cascade
    rl = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"username": username, "password": TEST_PWD}, timeout=30)
    assert rl.status_code == 200, rl.text
    token = rl.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    rc = requests.get(f"{BASE_URL}/api/cascade/sub-agenzie", headers=headers, timeout=30)
    assert rc.status_code == 200, rc.text
    returned_ids = {s["id"] for s in rc.json()}
    assert sa["id"] in returned_ids, \
        f"Legacy fallback FAILED: sub_agenzia_id {sa['id']} not in cascade response {returned_ids}"
