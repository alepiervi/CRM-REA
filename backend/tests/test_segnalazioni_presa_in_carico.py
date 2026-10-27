# Segnalatori: Presa in Carico lock (BO take, other BO 409, admin takeover, release on esito)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
FASTWEB_ID = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
TLS_ID = "cc0648c1-0df1-4530-8281-f4c940934916"
ASSIGN = {"commessa_id": FASTWEB_ID, "servizio_id": TLS_ID}


def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p})
    if r.status_code != 200:
        pytest.skip(f"login failed {u}: {r.status_code}")
    j = r.json()
    return {"Authorization": f"Bearer {j['access_token']}"}, j.get("user", {}).get("id")


@pytest.fixture(scope="module")
def admin():
    return _login("admin", "admin123")


@pytest.fixture(scope="module")
def segn():
    return _login("segnalatore_test", "test12345")[0]


@pytest.fixture(scope="module")
def bo1():
    return _login("bo_segn_test", "test12345")


@pytest.fixture(scope="module")
def bo2():
    return _login("bo_segn_test2", "test12345")


def _new(segn, name):
    r = requests.post(f"{API}/segnalazioni", headers=segn, json={
        "nome": f"TEST_{name}", "cognome": "TEST_PIC", "telefono": "3331112222"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    from pymongo import MongoClient
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    MongoClient(env["MONGO_URL"])[env["DB_NAME"]].segnalazioni.delete_many({"cognome": "TEST_PIC"})


class TestPresaInCarico:
    def test_new_is_free(self, segn, bo1):
        sid = _new(segn, "Free")
        d = requests.get(f"{API}/segnalazioni/{sid}", headers=bo1[0]).json()
        assert d["in_carico_id"] is None and d["in_carico_username"] is None

    def test_bo_must_take_before_assign_and_esito(self, segn, bo1):
        sid = _new(segn, "MustTake")
        r = requests.put(f"{API}/segnalazioni/{sid}/assegnazione", headers=bo1[0], json=ASSIGN)
        assert r.status_code == 409 and "Prendi in carico" in r.json()["detail"]
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=bo1[0], json={"esito": "KO"})
        assert r.status_code == 409

    def test_full_flow_lock_and_release(self, segn, bo1, bo2):
        sid = _new(segn, "Flow")
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=bo1[0])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["in_carico_username"] == "bo_segn_test" and d["in_carico_at"]
        if bo1[1]:
            assert d["in_carico_id"] == bo1[1]
        # idempotent for holder
        assert requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=bo1[0]).status_code == 200
        # BO2 blocked
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=bo2[0])
        assert r.status_code == 409 and "bo_segn_test" in r.json()["detail"]
        r = requests.put(f"{API}/segnalazioni/{sid}/assegnazione", headers=bo2[0], json=ASSIGN)
        assert r.status_code == 409 and "bo_segn_test" in r.json()["detail"]
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=bo2[0], json={"esito": "KO"})
        assert r.status_code == 409
        # BO2 sees holder in list
        items = requests.get(f"{API}/segnalazioni", headers=bo2[0]).json()
        row = next(i for i in items if i["id"] == sid)
        assert row["in_carico_username"] == "bo_segn_test"
        # BO1 works it
        r = requests.put(f"{API}/segnalazioni/{sid}/assegnazione", headers=bo1[0], json=ASSIGN)
        assert r.status_code == 200 and r.json()["servizio_id"] == TLS_ID
        assert r.json()["in_carico_username"] == "bo_segn_test"  # still locked after assign
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=bo1[0], json={"esito": "OK", "sotto_esiti": ["OK Fisso"]})
        assert r.status_code == 200
        d = requests.get(f"{API}/segnalazioni/{sid}", headers=bo2[0]).json()
        assert d["esito"] == "OK" and d["in_carico_id"] is None and d["in_carico_username"] is None
        # Now BO2 can take it
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=bo2[0])
        assert r.status_code == 200 and r.json()["in_carico_username"] == "bo_segn_test2"

    def test_admin_bypass_and_takeover(self, segn, bo1, admin):
        sid = _new(segn, "Admin")
        assert requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=bo1[0]).status_code == 200
        # admin can assign without taking
        r = requests.put(f"{API}/segnalazioni/{sid}/assegnazione", headers=admin[0], json=ASSIGN)
        assert r.status_code == 200
        # admin takeover
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=admin[0])
        assert r.status_code == 200 and r.json()["in_carico_username"] == "admin"
        # BO1 lost it
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=bo1[0], json={"esito": "KO"})
        assert r.status_code == 409 and "admin" in r.json()["detail"]
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=bo1[0])
        assert r.status_code == 409
        # admin esito releases
        r = requests.put(f"{API}/segnalazioni/{sid}/esito", headers=admin[0], json={"esito": "NR"})
        assert r.status_code == 200 and r.json()["in_carico_id"] is None

    def test_segnalatore_cannot_take(self, segn):
        sid = _new(segn, "Segn")
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico", headers=segn)
        assert r.status_code == 403

    def test_take_unknown_404(self, bo1):
        r = requests.post(f"{API}/segnalazioni/nonexistent-id/presa-in-carico", headers=bo1[0])
        assert r.status_code == 404

    def test_unauth(self, segn):
        sid = _new(segn, "Unauth")
        r = requests.post(f"{API}/segnalazioni/{sid}/presa-in-carico")
        assert r.status_code in (401, 403)

    def test_count_da_lavorare(self, bo1):
        r = requests.get(f"{API}/segnalazioni/da-lavorare/count", headers=bo1[0])
        assert r.status_code == 200 and isinstance(r.json()["count"], int)
