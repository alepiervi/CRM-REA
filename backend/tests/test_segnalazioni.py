# Segnalatori feature: segnalazioni CRUD, RBAC scope, esito/sotto esiti validation, Aruba Drive docs
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
FASTWEB_ID = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
TLS_ID = "cc0648c1-0df1-4530-8281-f4c940934916"


def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p})
    if r.status_code != 200:
        pytest.skip(f"login failed {u}: {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def admin():
    return _login("admin", "admin123")


@pytest.fixture(scope="module")
def segn():
    return _login("segnalatore_test", "test12345")


@pytest.fixture(scope="module")
def bo():
    return _login("bo_segn_test", "test12345")


@pytest.fixture(scope="module")
def created(segn, admin):
    r = requests.post(f"{API}/segnalazioni", headers=segn, json={
        "nome": "TEST_Mario", "cognome": "TEST_Rossi", "telefono": "3331234567",
        "note": "pytest note", "commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
    assert r.status_code == 200, r.text
    d = r.json()
    yield d
    # cleanup via mongo (no delete endpoint)
    try:
        from pymongo import MongoClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        MongoClient(env["MONGO_URL"])[env["DB_NAME"]].segnalazioni.delete_many({"nome": {"$regex": "^TEST_"}})
    except Exception as e:
        print("cleanup failed", e)


class TestOptions:
    def test_segn_options(self, segn):
        r = requests.get(f"{API}/segnalazioni/options", headers=segn)
        assert r.status_code == 200
        d = r.json()
        assert len(d["commesse"]) == 1 and d["commesse"][0]["id"] == FASTWEB_ID
        assert [s["id"] for s in d["commesse"][0]["servizi"]] == [TLS_ID]
        assert d["esiti"] == ["OK", "KO", "NR"]
        assert len(d["sotto_esiti_ok"]) == 6

    def test_admin_options_all(self, admin):
        r = requests.get(f"{API}/segnalazioni/options", headers=admin)
        assert r.status_code == 200 and len(r.json()["commesse"]) >= 1


class TestCreate:
    def test_create_and_get(self, created, segn):
        assert created["esito"] is None and created["commessa_nome"]
        r = requests.get(f"{API}/segnalazioni/{created['id']}", headers=segn)
        assert r.status_code == 200 and r.json()["nome"] == "TEST_Mario"

    def test_create_validation(self, segn):
        r = requests.post(f"{API}/segnalazioni", headers=segn, json={
            "nome": "", "cognome": "x", "telefono": "12", "commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
        assert r.status_code == 422

    def test_create_invalid_servizio(self, segn):
        r = requests.post(f"{API}/segnalazioni", headers=segn, json={
            "nome": "TEST_a", "cognome": "b", "telefono": "33312345", "commessa_id": FASTWEB_ID, "servizio_id": "nope"})
        assert r.status_code == 400

    def test_bo_cannot_create(self, bo):
        r = requests.post(f"{API}/segnalazioni", headers=bo, json={
            "nome": "TEST_a", "cognome": "b", "telefono": "33312345", "commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
        assert r.status_code == 403


class TestScope:
    def test_segn_sees_own(self, created, segn):
        r = requests.get(f"{API}/segnalazioni", headers=segn)
        assert r.status_code == 200
        items = r.json()
        assert any(i["id"] == created["id"] for i in items)
        assert all(i["created_by_username"] == "segnalatore_test" for i in items)

    def test_bo_sees_fastweb(self, created, bo):
        items = requests.get(f"{API}/segnalazioni", headers=bo).json()
        assert any(i["id"] == created["id"] for i in items)
        assert all(i["commessa_id"] == FASTWEB_ID for i in items)

    def test_admin_sees_all(self, created, admin):
        items = requests.get(f"{API}/segnalazioni", headers=admin).json()
        assert any(i["id"] == created["id"] for i in items)

    def test_bo_other_commessa_filter_empty(self, bo):
        r = requests.get(f"{API}/segnalazioni", headers=bo, params={"commessa_id": "other"})
        assert r.status_code == 200 and r.json() == []

    def test_filters(self, created, admin):
        r = requests.get(f"{API}/segnalazioni", headers=admin, params={"search": "TEST_Rossi"})
        assert any(i["id"] == created["id"] for i in r.json())
        r = requests.get(f"{API}/segnalazioni", headers=admin, params={"search": "3331234567", "esito": "da_lavorare"})
        assert any(i["id"] == created["id"] for i in r.json())


class TestEsito:
    def test_segn_cannot_esito(self, created, segn):
        r = requests.put(f"{API}/segnalazioni/{created['id']}/esito", headers=segn, json={"esito": "KO"})
        assert r.status_code == 403

    def test_ok_without_sotto_400(self, created, bo):
        r = requests.put(f"{API}/segnalazioni/{created['id']}/esito", headers=bo, json={"esito": "OK", "sotto_esiti": []})
        assert r.status_code == 400
        r = requests.put(f"{API}/segnalazioni/{created['id']}/esito", headers=bo, json={"esito": "OK", "sotto_esiti": ["bogus"]})
        assert r.status_code == 400

    def test_invalid_esito(self, created, bo):
        r = requests.put(f"{API}/segnalazioni/{created['id']}/esito", headers=bo, json={"esito": "XX"})
        assert r.status_code == 400

    def test_ok_then_ko_clears(self, created, bo, segn):
        sid = created["id"]
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=bo,
                         json={"esito": "OK", "sotto_esiti": ["OK Gas", "OK Energy"], "nota_esito": "n1"})
        assert r.status_code == 200
        assert r.json()["sotto_esiti"] == ["OK Energy", "OK Gas"]
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=bo, json={"esito": "KO", "sotto_esiti": ["OK Gas"]})
        assert r.status_code == 200 and r.json()["sotto_esiti"] == []
        d = requests.get(f"{API}/segnalazioni/{sid}", headers=segn).json()
        assert d["esito"] == "KO" and len(d["esito_history"]) == 2
        r = requests.get(f"{API}/segnalazioni", headers=bo, params={"esito": "KO"})
        assert any(i["id"] == sid for i in r.json())


class TestDocuments:
    def test_upload_download(self, created, segn, bo):
        sid = created["id"]
        r = requests.post(f"{API}/segnalazioni/{sid}/documents", headers=segn,
                          files={"file": ("test_pytest.txt", b"hello aruba", "text/plain")}, timeout=90)
        assert r.status_code == 200, r.text
        doc = r.json()
        r = requests.get(f"{API}/segnalazioni/{sid}/documents/{doc['id']}/download", headers=bo, timeout=90)
        assert r.status_code == 200 and r.content == b"hello aruba"

    def test_empty_file(self, created, segn):
        r = requests.post(f"{API}/segnalazioni/{created['id']}/documents", headers=segn,
                          files={"file": ("e.txt", b"", "text/plain")})
        assert r.status_code == 400

    def test_unknown_404(self, segn):
        assert requests.get(f"{API}/segnalazioni/{uuid.uuid4()}", headers=segn).status_code == 404


class TestUserCreation:
    def test_admin_create_segnalatore(self, admin):
        uname = f"test_segn_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", headers=admin, json={
            "username": uname, "email": f"{uname}@example.com", "password": "test12345", "role": "segnalatore",
            "commesse_autorizzate": [FASTWEB_ID], "servizi_autorizzati": [TLS_ID]})
        assert r.status_code == 200, r.text
        u = r.json()
        try:
            assert u["role"] == "segnalatore" and u["commesse_autorizzate"] == [FASTWEB_ID]
            assert u["servizi_autorizzati"] == [TLS_ID]
        finally:
            requests.delete(f"{API}/users/{u['id']}", headers=admin)
