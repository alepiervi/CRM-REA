"""Backend tests for Cliente Lock system (lucchetto anagrafica)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://commessa-crm-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"username": "admin", "password": "admin123"}
OTHER = {"username": "lock_tester", "password": "test12345"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login fallito per {creds['username']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def other_token():
    return _login(OTHER)


@pytest.fixture(scope="module")
def cliente_id(admin_token):
    """Pick an existing cliente id."""
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{API}/clienti", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # Response may be dict { clienti: [...] } or list
    clienti = data.get("clienti", data) if isinstance(data, dict) else data
    assert len(clienti) > 0, "Nessun cliente presente nel DB per test"
    return clienti[0]["id"]


@pytest.fixture(autouse=True)
def _cleanup_locks_before(admin_token, cliente_id):
    """Force-release any lock before each test to ensure clean state."""
    h = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock/force-release", headers=h, timeout=30)
    yield
    requests.post(f"{API}/clienti/{cliente_id}/lock/force-release", headers=h, timeout=30)


# ========== Acquire ==========
def test_acquire_lock_success(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["locked"] is True
    assert data["owned_by_me"] is True
    assert data["username"] == "admin"
    assert "expires_at" in data
    assert "locked_at" in data


def test_acquire_lock_conflict_other_user(admin_token, other_token, cliente_id):
    h_a = {"Authorization": f"Bearer {admin_token}"}
    h_b = {"Authorization": f"Bearer {other_token}"}
    # admin acquires
    r1 = requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h_a, timeout=30)
    assert r1.status_code == 200
    # other user tries
    r2 = requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h_b, timeout=30)
    assert r2.status_code == 409, r2.text
    body = r2.json()
    assert body["locked"] is True
    assert "locked_by" in body
    assert body["locked_by"]["username"] == "admin"
    assert "locked_at" in body and "expires_at" in body
    assert "admin" in body["message"]


def test_acquire_lock_idempotent_for_owner(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    r1 = requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert r1.status_code == 200
    exp1 = r1.json()["expires_at"]
    locked_at1 = r1.json()["locked_at"]
    time.sleep(1.1)
    r2 = requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["owned_by_me"] is True
    # locked_at preserved (within ms precision, Mongo may drop tz/microseconds), expires_at refreshed
    from datetime import datetime
    def _parse(s):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    assert abs((_parse(r2.json()["locked_at"]) - _parse(locked_at1)).total_seconds()) < 1.0
    assert r2.json()["expires_at"] >= exp1


# ========== Heartbeat ==========
def test_heartbeat_owner(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    r = requests.post(f"{API}/clienti/{cliente_id}/lock/heartbeat", headers=h, timeout=30)
    assert r.status_code == 200
    assert r.json()["refreshed"] is True
    assert "expires_at" in r.json()


def test_heartbeat_non_owner_conflict(admin_token, other_token, cliente_id):
    h_a = {"Authorization": f"Bearer {admin_token}"}
    h_b = {"Authorization": f"Bearer {other_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h_a, timeout=30)
    r = requests.post(f"{API}/clienti/{cliente_id}/lock/heartbeat", headers=h_b, timeout=30)
    assert r.status_code == 409
    body = r.json()
    assert body["owned_by_me"] is False
    assert body["locked_by"]["username"] == "admin"


# ========== Release ==========
def test_release_owner(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    r = requests.delete(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert r.status_code == 200
    assert r.json()["released"] is True
    # verify no lock remains
    st = requests.get(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert st.json()["locked"] is False


def test_release_by_non_owner_admin_allowed(admin_token, other_token, cliente_id):
    """lock_tester is admin role, so non-owner admin CAN release per backend logic."""
    h_a = {"Authorization": f"Bearer {admin_token}"}
    h_b = {"Authorization": f"Bearer {other_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h_a, timeout=30)
    r = requests.delete(f"{API}/clienti/{cliente_id}/lock", headers=h_b, timeout=30)
    # lock_tester has admin role → allowed
    assert r.status_code == 200, r.text


# ========== Force-release ==========
def test_force_release_admin(admin_token, other_token, cliente_id):
    h_a = {"Authorization": f"Bearer {admin_token}"}
    h_b = {"Authorization": f"Bearer {other_token}"}
    # admin acquires, lock_tester (admin) force-releases
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h_a, timeout=30)
    r = requests.post(f"{API}/clienti/{cliente_id}/lock/force-release", headers=h_b, timeout=30)
    assert r.status_code == 200
    assert r.json()["force_released"] is True
    assert r.json()["deleted"] == 1


# ========== Status ==========
def test_get_status_unlocked(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert r.status_code == 200
    assert r.json() == {"locked": False}


def test_get_status_locked_by_me(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    r = requests.get(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["owned_by_me"] is True
    assert body["username"] == "admin"


def test_get_status_locked_by_other(admin_token, other_token, cliente_id):
    h_a = {"Authorization": f"Bearer {admin_token}"}
    h_b = {"Authorization": f"Bearer {other_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h_a, timeout=30)
    r = requests.get(f"{API}/clienti/{cliente_id}/lock", headers=h_b, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["owned_by_me"] is False
    assert body["username"] == "admin"


# ========== List locks ==========
def test_list_locks(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    r = requests.get(f"{API}/cliente-locks", headers=h, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "locks" in body and "count" in body
    assert body["count"] >= 1
    ids = [l["cliente_id"] for l in body["locks"]]
    assert cliente_id in ids


# ========== 404 ==========
def test_acquire_lock_404_non_existing(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.post(f"{API}/clienti/nonexistent-xyz-99999/lock", headers=h, timeout=30)
    assert r.status_code == 404


# ========== Regression: CRUD cliente still works for owner ==========
def test_regression_get_cliente_while_owner_has_lock(admin_token, cliente_id):
    h = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{API}/clienti/{cliente_id}/lock", headers=h, timeout=30)
    r = requests.get(f"{API}/clienti/{cliente_id}", headers=h, timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == cliente_id
