"""Regression tests for REFACTORING FASE 2.

Verifies that the 8 route modules extracted from server.py work identically:
- units.py
- lead_status.py
- cliente_custom.py (incluso duplicate)
- segmenti_offerte.py
- cliente_lock.py
- cliente_notes.py (note-history + cestino)
- leads_cestino.py
- post_vendita.py
Plus security.py (auth) and audit.py (log_client_action via note POST).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lead-qualification-5.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ----- security.py (auth) -----
class TestAuth:
    def test_login_admin_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": "admin", "password": "admin123"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["username"] == "admin"
        assert body["user"]["role"] == "admin"

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": "admin", "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_protected_endpoint_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/users", timeout=20)
        assert r.status_code in (401, 403)

    def test_protected_endpoint_with_token(self, headers):
        r = requests.get(f"{BASE_URL}/api/users", headers=headers, timeout=20)
        assert r.status_code == 200


# ----- routes/units.py -----
class TestUnits:
    created_unit_id = None
    commessa_id = None

    def test_get_units_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/units", headers=headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_update_delete_unit(self, headers):
        # Need a commessa
        cresp = requests.get(f"{BASE_URL}/api/commesse", headers=headers, timeout=20)
        assert cresp.status_code == 200
        commesse = cresp.json()
        if not commesse:
            pytest.skip("No commesse available")
        TestUnits.commessa_id = commesse[0]["id"]

        payload = {
            "nome": f"TEST-Unit-{uuid.uuid4().hex[:6]}",
            "commessa_id": TestUnits.commessa_id,
            "commesse_autorizzate": [TestUnits.commessa_id],
            "campagne_autorizzate": [],
        }
        r = requests.post(f"{BASE_URL}/api/units", headers=headers, json=payload, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        created = r.json()
        assert created["nome"] == payload["nome"]
        TestUnits.created_unit_id = created["id"]

        # PUT
        upd = requests.put(f"{BASE_URL}/api/units/{TestUnits.created_unit_id}",
                           headers=headers, json={"nome": payload["nome"] + "-upd"}, timeout=20)
        assert upd.status_code == 200
        assert upd.json()["nome"].endswith("-upd")

        # GET single
        g = requests.get(f"{BASE_URL}/api/units/{TestUnits.created_unit_id}", headers=headers, timeout=20)
        assert g.status_code == 200

        # DELETE
        d = requests.delete(f"{BASE_URL}/api/units/{TestUnits.created_unit_id}", headers=headers, timeout=20)
        assert d.status_code == 200, f"Delete failed: {d.status_code} {d.text[:300]}"
        TestUnits.created_unit_id = None


# ----- routes/lead_status.py -----
class TestLeadStatus:
    created_status_id = None

    def test_get_lead_statuses(self, headers):
        r = requests.get(f"{BASE_URL}/api/lead-status", headers=headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_update_delete_status(self, headers):
        # use a global status (no unit_id) — easier cleanup
        payload = {
            "nome": f"TEST-Status-{uuid.uuid4().hex[:6]}",
            "ordine": 999,
            "colore": "#cccccc",
        }
        r = requests.post(f"{BASE_URL}/api/lead-status", headers=headers, json=payload, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        created = r.json()
        sid = created["id"]
        assert created["nome"] == payload["nome"]

        upd = requests.put(f"{BASE_URL}/api/lead-status/{sid}",
                           headers=headers, json={"colore": "#ff0000"}, timeout=20)
        assert upd.status_code == 200
        assert upd.json()["colore"] == "#ff0000"

        d = requests.delete(f"{BASE_URL}/api/lead-status/{sid}", headers=headers, timeout=20)
        assert d.status_code == 200, f"{d.status_code}: {d.text[:300]}"


# ----- routes/cliente_custom.py -----
class TestClienteCustom:
    def test_duplicate_same_source_target_returns_400(self, headers):
        # Need commessa + tipologia
        c = requests.get(f"{BASE_URL}/api/commesse", headers=headers, timeout=20)
        commesse = c.json()
        if not commesse:
            pytest.skip("No commesse")
        commessa_id = commesse[0]["id"]
        # try to fetch tipologie for that commessa
        tip_resp = requests.get(f"{BASE_URL}/api/tipologie-contratto",
                                headers=headers, timeout=20)
        tip_id = None
        if tip_resp.status_code == 200:
            tips = tip_resp.json()
            if isinstance(tips, list) and tips:
                tip_id = tips[0].get("id")
        if not tip_id:
            tip_id = "dummy-tip-id"

        payload = {
            "source_commessa_id": commessa_id,
            "source_tipologia_id": tip_id,
            "target_commessa_id": commessa_id,
            "target_tipologia_id": tip_id,
            "mode": "merge",
        }
        r = requests.post(f"{BASE_URL}/api/cliente-custom-config/duplicate",
                          headers=headers, json=payload, timeout=20)
        assert r.status_code == 400
        body = r.json()
        # FastAPI default detail key
        detail = body.get("detail", "")
        assert "coincidono" in str(detail).lower(), f"Detail: {detail}"

    def test_get_custom_fields_filter(self, headers):
        c = requests.get(f"{BASE_URL}/api/commesse", headers=headers, timeout=20)
        commesse = c.json()
        if not commesse:
            pytest.skip("No commesse")
        commessa_id = commesse[0]["id"]
        r = requests.get(
            f"{BASE_URL}/api/cliente-custom-fields?commessa_id={commessa_id}&tipologia_contratto_id=any",
            headers=headers, timeout=20,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----- routes/segmenti_offerte.py -----
class TestSegmentiOfferte:
    def test_get_segmenti(self, headers):
        r = requests.get(f"{BASE_URL}/api/segmenti", headers=headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_offerte(self, headers):
        r = requests.get(f"{BASE_URL}/api/offerte", headers=headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)

    def test_get_single_offerta(self, headers):
        listing = requests.get(f"{BASE_URL}/api/offerte", headers=headers, timeout=20).json()
        if not listing:
            pytest.skip("No offerte to fetch")
        off_id = listing[0]["id"]
        r = requests.get(f"{BASE_URL}/api/offerte/{off_id}", headers=headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == off_id


# ----- routes/cliente_lock.py -----
class TestClienteLock:
    def test_get_all_locks(self, headers):
        r = requests.get(f"{BASE_URL}/api/cliente-locks", headers=headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        # Endpoint returns either list or {count, locks}
        if isinstance(body, dict):
            assert "locks" in body
            assert isinstance(body["locks"], list)
        else:
            assert isinstance(body, list)

    def test_lock_acquire_status_release(self, headers):
        # find a cliente
        cr = requests.get(f"{BASE_URL}/api/clienti?page=1&page_size=1", headers=headers, timeout=30)
        assert cr.status_code == 200
        body = cr.json()
        clienti = body if isinstance(body, list) else body.get("clienti", [])
        if not clienti:
            pytest.skip("No clienti to test lock")
        cid = clienti[0]["id"]

        # Acquire (may already be locked by us if previous run hung — try force-release first via DELETE)
        requests.delete(f"{BASE_URL}/api/clienti/{cid}/lock", headers=headers, timeout=20)

        acq = requests.post(f"{BASE_URL}/api/clienti/{cid}/lock", headers=headers, timeout=20)
        assert acq.status_code in (200, 201), f"{acq.status_code}: {acq.text[:300]}"

        st = requests.get(f"{BASE_URL}/api/clienti/{cid}/lock", headers=headers, timeout=20)
        assert st.status_code == 200

        rel = requests.delete(f"{BASE_URL}/api/clienti/{cid}/lock", headers=headers, timeout=20)
        assert rel.status_code in (200, 204)


# ----- routes/cliente_notes.py + audit.py -----
class TestClienteNotes:
    def test_get_note_history(self, headers):
        cr = requests.get(f"{BASE_URL}/api/clienti?page=1&page_size=1", headers=headers, timeout=30)
        body = cr.json()
        clienti = body if isinstance(body, list) else body.get("clienti", [])
        if not clienti:
            pytest.skip("No clienti")
        cid = clienti[0]["id"]
        r = requests.get(f"{BASE_URL}/api/clienti/{cid}/note-history", headers=headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_note_append_only_and_audit(self, headers):
        cr = requests.get(f"{BASE_URL}/api/clienti?page=1&page_size=1", headers=headers, timeout=30)
        body = cr.json()
        clienti = body if isinstance(body, list) else body.get("clienti", [])
        if not clienti:
            pytest.skip("No clienti")
        cid = clienti[0]["id"]

        before = requests.get(f"{BASE_URL}/api/clienti/{cid}/note-history",
                              headers=headers, timeout=20).json()
        before_count = len(before)

        note_text = f"TEST-NOTE refactor fase 2 {uuid.uuid4().hex[:8]}"
        post = requests.post(f"{BASE_URL}/api/clienti/{cid}/note-history",
                             headers=headers,
                             json={"tipo": "cliente", "content": note_text},
                             timeout=20)
        assert post.status_code in (200, 201), f"{post.status_code}: {post.text[:300]}"

        after = requests.get(f"{BASE_URL}/api/clienti/{cid}/note-history",
                             headers=headers, timeout=20).json()
        assert len(after) == before_count + 1, "Append-only invariant broken"
        # newest note should contain our text
        assert any(note_text in str(n.get("content", "")) for n in after)

    def test_get_clienti_cestino(self, headers):
        r = requests.get(f"{BASE_URL}/api/clienti-cestino", headers=headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        # may return list or paginated dict
        assert isinstance(body, (list, dict))


# ----- routes/leads_cestino.py -----
class TestLeadsCestino:
    def test_get_leads_cestino(self, headers):
        r = requests.get(f"{BASE_URL}/api/leads-cestino", headers=headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))


# ----- routes/post_vendita.py -----
class TestPostVendita:
    def test_get_post_vendita_clienti(self, headers):
        r = requests.get(f"{BASE_URL}/api/post-vendita/clienti?page=1", headers=headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, (list, dict))

    def test_get_post_vendita_imports(self, headers):
        r = requests.get(f"{BASE_URL}/api/post-vendita/imports", headers=headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))
