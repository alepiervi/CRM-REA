"""
Regression test for Segmento filter bug fix.

Bug: Il filtro segmento='privato'/'business' nell'endpoint GET /api/clienti
(e negli endpoint export/pivot) faceva match esatto sul campo `segmento`
in MongoDB, ma il campo era salvato in modi misti:
  - String tipo 'privato' / 'business' (dal flusso legacy)
  - UUID del segmento (dai flussi più recenti)

Risultato: filtrando per "privato" venivano esclusi tutti i clienti con
segmento salvato come UUID, anche se il tipo sottostante era "privato".

Fix: il backend ora chiama `_expand_segmento_filter_values()` che espande
la lista dei filtri includendo anche tutti gli UUID dei segmenti con quel tipo.
"""
import os
import asyncio
import pytest
import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
# When running in preview, read from frontend .env
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BACKEND_URL = line.split("=", 1)[1].strip()
                break
except Exception:
    pass

API = f"{BACKEND_URL}/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    with httpx.Client(timeout=30.0) as c:
        r = c.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        r.raise_for_status()
        return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_filter_segmento_privato_includes_uuid_entries(headers):
    """Verify that filtering by segmento=privato returns clienti stored as
    both literal 'privato' string AND as UUID of privato segmenti."""
    with httpx.Client(timeout=30.0, headers=headers) as c:
        # All clienti (no filter)
        r_all = c.get(f"{API}/clienti?page=1&page_size=500")
        r_all.raise_for_status()
        all_clienti = r_all.json().get("clienti", [])
        literal_privato = [cl for cl in all_clienti if cl.get("segmento") == "privato"]
        # Any cliente with a segmento that is not one of the known tipos/None/empty → candidate UUID
        uuid_entries = [
            cl for cl in all_clienti
            if cl.get("segmento")
            and cl["segmento"] not in ("privato", "business")
        ]

        # Filter privato
        r_p = c.get(f"{API}/clienti?page=1&page_size=500&segmento=privato")
        r_p.raise_for_status()
        privato = r_p.json().get("clienti", [])

        # Must return at least all the literal 'privato' entries
        assert len(privato) >= len(literal_privato), (
            f"Expected filter to include all literal privato ({len(literal_privato)}), "
            f"got {len(privato)}"
        )

        # If there are UUID-segmented clienti whose segmenti map to tipo=privato,
        # the filter must include them too (the bug was excluding them).
        # At least 1 UUID cliente must be included if any UUID entries exist in the DB.
        if uuid_entries:
            returned_uuids = [cl for cl in privato if cl.get("segmento") not in ("privato", "business")]
            assert len(returned_uuids) > 0, (
                f"Bug regression: filter segmento=privato returned 0 UUID-based clienti, "
                f"but {len(uuid_entries)} exist in DB"
            )


def test_filter_segmento_all_returns_all(headers):
    """segmento=all must behave like no filter."""
    with httpx.Client(timeout=30.0, headers=headers) as c:
        r1 = c.get(f"{API}/clienti?page=1&page_size=500")
        r2 = c.get(f"{API}/clienti?page=1&page_size=500&segmento=all")
        r1.raise_for_status()
        r2.raise_for_status()
        assert r1.json().get("total") == r2.json().get("total")


def test_filter_segmento_business_no_crash(headers):
    """segmento=business filter must not crash and return only business-related clienti."""
    with httpx.Client(timeout=30.0, headers=headers) as c:
        r = c.get(f"{API}/clienti?page=1&page_size=500&segmento=business")
        r.raise_for_status()
        clienti = r.json().get("clienti", [])
        # Ensure none have segmento == 'privato' (literal)
        for cl in clienti:
            assert cl.get("segmento") != "privato", (
                f"Cliente {cl.get('id')} with segmento='privato' leaked into business filter"
            )
