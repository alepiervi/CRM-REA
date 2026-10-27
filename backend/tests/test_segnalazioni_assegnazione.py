# Segnalatori: create without commessa/servizio, BO assegnazione, esito blocked until assigned, docs on unassigned
import os
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
def created(segn):
    r = requests.post(f"{API}/segnalazioni", headers=segn, json={
        "nome": "TEST_Assign", "cognome": "TEST_Uno", "telefono": "3330001111", "note": "pytest assign"})
    assert r.status_code == 200, r.text
    yield r.json()
    try:
        from pymongo import MongoClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        MongoClient(env["MONGO_URL"])[env["DB_NAME"]].segnalazioni.delete_many({"nome": {"$regex": "^TEST_"}})
    except Exception as e:
        print("cleanup failed", e)


class TestCreateUnassigned:
    def test_created_without_commessa(self, created):
        assert created["commessa_id"] is None and created["servizio_id"] is None
        assert created["esito"] is None
        assert created["aruba_commessa_id"] == FASTWEB_ID

    def test_extra_fields_ignored(self, segn):
        r = requests.post(f"{API}/segnalazioni", headers=segn, json={
            "nome": "TEST_Extra", "cognome": "X", "telefono": "3330002222",
            "commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
        assert r.status_code == 200
        assert r.json()["commessa_id"] is None

    def test_bo_sees_unassigned(self, created, bo):
        r = requests.get(f"{API}/segnalazioni", headers=bo)
        assert r.status_code == 200
        assert created["id"] in [s["id"] for s in r.json()]

    def test_filter_none(self, created, bo):
        r = requests.get(f"{API}/segnalazioni", headers=bo, params={"commessa_id": "none"})
        assert r.status_code == 200
        d = r.json()
        assert created["id"] in [s["id"] for s in d]
        assert all(s["commessa_id"] is None for s in d)

    def test_counter_includes_unassigned(self, created, bo):
        r = requests.get(f"{API}/segnalazioni/da-lavorare/count", headers=bo)
        assert r.status_code == 200 and r.json()["count"] >= 1


class TestAssegnazione:
    def test_esito_blocked_unassigned(self, created, bo):
        r = requests.put(f"{API}/segnalazioni/{created['id']}/esito", headers=bo, json={"esito": "KO"})
        assert r.status_code == 400
        assert r.json()["detail"] == "Assegna commessa e servizio prima di dare l'esito"

    def test_segn_403(self, created, segn):
        r = requests.put(f"{API}/segnalazioni/{created['id']}/assegnazione", headers=segn,
                         json={"commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
        assert r.status_code == 403

    def test_wrong_servizio_400(self, created, bo, admin):
        opts = requests.get(f"{API}/segnalazioni/options", headers=admin).json()["commesse"]
        other = next((s["id"] for c in opts if c["id"] != FASTWEB_ID for s in c["servizi"]), None)
        if not other:
            pytest.skip("no other servizio")
        r = requests.put(f"{API}/segnalazioni/{created['id']}/assegnazione", headers=bo,
                         json={"commessa_id": FASTWEB_ID, "servizio_id": other})
        assert r.status_code == 400

    def test_bo_unauthorized_commessa_403(self, created, bo, admin):
        opts = requests.get(f"{API}/segnalazioni/options", headers=admin).json()["commesse"]
        c = next((c for c in opts if c["id"] != FASTWEB_ID), None)
        if not c:
            pytest.skip("no other commessa")
        r = requests.put(f"{API}/segnalazioni/{created['id']}/assegnazione", headers=bo,
                         json={"commessa_id": c["id"], "servizio_id": c["servizi"][0]["id"]})
        assert r.status_code == 403

    def test_assign_then_esito(self, created, bo):
        r = requests.put(f"{API}/segnalazioni/{created['id']}/assegnazione", headers=bo,
                         json={"commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["commessa_nome"] == "Fastweb" and d["servizio_nome"] == "TLS"
        assert d["assegnato_by"] == "bo_segn_test"
        g = requests.get(f"{API}/segnalazioni/{created['id']}", headers=bo).json()
        assert g["commessa_id"] == FASTWEB_ID and g["servizio_id"] == TLS_ID
        e = requests.put(f"{API}/segnalazioni/{created['id']}/esito", headers=bo,
                         json={"esito": "OK", "sotto_esiti": ["OK Fisso"]})
        assert e.status_code == 200 and e.json()["esito"] == "OK"

    def test_filter_none_excludes_assigned(self, created, bo):
        d = requests.get(f"{API}/segnalazioni", headers=bo, params={"commessa_id": "none"}).json()
        assert created["id"] not in [s["id"] for s in d]
        d2 = requests.get(f"{API}/segnalazioni", headers=bo, params={"commessa_id": FASTWEB_ID}).json()
        assert created["id"] in [s["id"] for s in d2]

    def test_unknown_404(self, bo):
        r = requests.put(f"{API}/segnalazioni/nope/assegnazione", headers=bo,
                         json={"commessa_id": FASTWEB_ID, "servizio_id": TLS_ID})
        assert r.status_code == 404


class TestDocsUnassigned:
    def test_upload_download_unassigned(self, segn, bo):
        r = requests.post(f"{API}/segnalazioni", headers=segn, json={
            "nome": "TEST_Doc", "cognome": "Una", "telefono": "3330003333"})
        sid = r.json()["id"]
        u = requests.post(f"{API}/segnalazioni/{sid}/documents", headers=segn,
                          files={"file": ("t.txt", b"tiny-unassigned", "text/plain")}, timeout=90)
        assert u.status_code == 200, u.text
        doc = u.json()
        assert doc["aruba_commessa_id"] == FASTWEB_ID
        dl = requests.get(f"{API}/segnalazioni/{sid}/documents/{doc['id']}/download", headers=bo, timeout=90)
        assert dl.status_code == 200 and dl.content == b"tiny-unassigned"


class TestRegression:
    def test_stats(self, bo):
        r = requests.get(f"{API}/segnalazioni/stats/summary", headers=bo)
        assert r.status_code == 200 and "totale" in r.json()

    def test_export_admin(self, admin, bo):
        r = requests.get(f"{API}/segnalazioni/export/excel", headers=admin)
        assert r.status_code == 200 and r.content[:2] == b"PK"
        assert requests.get(f"{API}/segnalazioni/export/excel", headers=bo).status_code == 403
