"""
Backend tests for "Tag Lead" management enhancements (Feb 2026).

Coverage:
- GET    /api/lead-tags/usage             (admin) → list with usage counts + orphans
- GET    /api/lead-tags/usage             (non-admin) → 403
- PATCH  /api/lead-tags/{tag_id}          rename + propagate to leads/clienti
- PATCH  /api/lead-tags/{tag_id}          name duplicato → 400
- PATCH  /api/lead-tags/{tag_id}          aggiorna label/color/description
- POST   /api/lead-tags/merge             unisce source → target (lead + clienti)
- POST   /api/lead-tags/merge             source == target → 400
- POST   /api/lead-tags/merge             source/target inesistente → 404
- POST   /api/lead-tags/cleanup-orphans   (admin) adopta i tag-orfani
- DELETE /api/lead-tags/{tag_id}          rimuove tag da leads.tags E clienti.tags
- Route collisions: /usage, /merge, /cleanup-orphans NOT interpreted as {tag_id}
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

PREFIX = f"test_tagmgmt_{uuid.uuid4().hex[:6]}"
TAG_SRC = f"{PREFIX}_src"
TAG_DST = f"{PREFIX}_dst"
TAG_OTHER = f"{PREFIX}_other"
TAG_ORPHAN = f"{PREFIX}_orphan"
TAG_PATCH = f"{PREFIX}_patch"
TAG_RENAMED = f"{PREFIX}_renamed"
TAG_DELME = f"{PREFIX}_delme"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    # Cleanup at module end
    db.lead_tags.delete_many({"name": {"$regex": f"^{PREFIX}"}})
    db.leads.delete_many({"id": {"$regex": f"^{PREFIX}"}})
    db.clienti.delete_many({"id": {"$regex": f"^{PREFIX}"}})
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def non_admin_token(admin_headers, mongo_db):
    """Create a non-admin user (AGENTE) via API, then login as that user."""
    uname = f"{PREFIX}_user"
    payload = {
        "username": uname,
        "email": f"{uname}@example.com",
        "password": "testpass123",
        "role": "agente",
    }
    r = requests.post(f"{BASE_URL}/api/users", json=payload, headers=admin_headers, timeout=20)
    if r.status_code not in (200, 201):
        pytest.skip(f"Cannot create non-admin user: {r.status_code} {r.text[:200]}")
    # If password_change_required is set, clear it via Mongo to allow direct login
    mongo_db.users.update_one(
        {"username": uname},
        {"$set": {"password_change_required": False}}
    )
    r2 = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"username": uname, "password": "testpass123"}, timeout=20)
    if r2.status_code != 200:
        pytest.skip(f"Non-admin login failed: {r2.status_code} {r2.text[:200]}")
    token = r2.json()["access_token"]
    yield token
    # Cleanup user
    mongo_db.users.delete_many({"username": uname})


@pytest.fixture(scope="module")
def seeded(mongo_db, admin_headers):
    """Create formal tags + lead + cliente with tags to exercise propagation."""
    # Create 3 formal tags
    tags = {}
    for name in (TAG_SRC, TAG_DST, TAG_OTHER, TAG_PATCH, TAG_DELME):
        r = requests.post(f"{BASE_URL}/api/lead-tags",
                          json={"name": name, "label": name, "color": "#abcdef"},
                          headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), f"create tag {name}: {r.status_code} {r.text[:200]}"
        tags[name] = r.json()["id"]

    # Insert a lead directly via Mongo with tags=[TAG_SRC, TAG_OTHER, TAG_PATCH, TAG_DELME, TAG_ORPHAN]
    lead_id = f"{PREFIX}_lead_1"
    mongo_db.leads.insert_one({
        "id": lead_id,
        "nome": "TestTagMgmt",
        "cognome": "Lead",
        "telefono": "+391112223333",
        "tags": [TAG_SRC, TAG_OTHER, TAG_PATCH, TAG_DELME, TAG_ORPHAN],
        "status": "nuovo",
    })
    # Insert a cliente with same tags
    cli_id = f"{PREFIX}_cli_1"
    mongo_db.clienti.insert_one({
        "id": cli_id,
        "nome": "TestTagMgmt",
        "cognome": "Cli",
        "telefono": "+391114445555",
        "tags": [TAG_SRC, TAG_OTHER, TAG_PATCH, TAG_DELME, TAG_ORPHAN],
    })
    return {"tags": tags, "lead_id": lead_id, "cli_id": cli_id}


# ---------------- Tests ----------------
class TestUsageEndpoint:
    """GET /api/lead-tags/usage"""

    def test_usage_admin_returns_list_with_counts_and_orphans(self, admin_headers, seeded, mongo_db):
        r = requests.get(f"{BASE_URL}/api/lead-tags/usage", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert isinstance(data, list)
        by_name = {t["name"]: t for t in data}

        # Formal tag TAG_SRC: 1 lead + 1 cliente
        assert TAG_SRC in by_name, "TAG_SRC missing from usage"
        t_src = by_name[TAG_SRC]
        assert t_src["lead_count"] == 1
        assert t_src["cliente_count"] == 1
        assert t_src["total_count"] == 2
        assert t_src["is_orphan"] is False
        assert t_src["id"] == seeded["tags"][TAG_SRC]

        # Orphan tag: present in lead.tags + cliente.tags but NOT in lead_tags
        assert TAG_ORPHAN in by_name, "Orphan tag not detected"
        t_orph = by_name[TAG_ORPHAN]
        assert t_orph["is_orphan"] is True
        assert t_orph["id"] is None
        assert t_orph["lead_count"] == 1
        assert t_orph["cliente_count"] == 1
        assert t_orph["total_count"] == 2

    def test_usage_non_admin_forbidden(self, non_admin_token):
        headers = {"Authorization": f"Bearer {non_admin_token}"}
        r = requests.get(f"{BASE_URL}/api/lead-tags/usage", headers=headers, timeout=15)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:200]}"

    def test_usage_path_not_interpreted_as_tag_id(self, admin_headers):
        """Critical: GET /lead-tags/usage must NOT be matched by /lead-tags/{tag_id}.
        Since no GET /lead-tags/{tag_id} exists, calling /usage should return a list,
        not a 404 or a single tag object."""
        r = requests.get(f"{BASE_URL}/api/lead-tags/usage", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestPatchEndpoint:
    """PATCH /api/lead-tags/{tag_id}"""

    def test_patch_label_color_description_no_rename(self, admin_headers, seeded):
        tag_id = seeded["tags"][TAG_PATCH]
        payload = {"label": "Etichetta Patched", "color": "#112233", "description": "desc updated"}
        r = requests.patch(f"{BASE_URL}/api/lead-tags/{tag_id}", json=payload,
                           headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body["label"] == "Etichetta Patched"
        assert body["color"] == "#112233"
        assert body["description"] == "desc updated"
        assert body["name"] == TAG_PATCH  # unchanged

    def test_patch_rename_propagates_to_leads_and_clienti(self, admin_headers, seeded, mongo_db):
        tag_id = seeded["tags"][TAG_PATCH]
        new_name = TAG_RENAMED
        r = requests.patch(f"{BASE_URL}/api/lead-tags/{tag_id}", json={"name": new_name},
                           headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert r.json()["name"] == new_name

        # Propagation check via Mongo
        lead = mongo_db.leads.find_one({"id": seeded["lead_id"]})
        cli = mongo_db.clienti.find_one({"id": seeded["cli_id"]})
        assert new_name in lead["tags"], f"Lead tags after rename: {lead['tags']}"
        assert TAG_PATCH not in lead["tags"], f"Old name still present in lead: {lead['tags']}"
        assert new_name in cli["tags"], f"Cliente tags after rename: {cli['tags']}"
        assert TAG_PATCH not in cli["tags"]

    def test_patch_rename_to_existing_name_returns_400(self, admin_headers, seeded):
        # Rename TAG_OTHER → TAG_SRC (already exists) → 400
        tag_id = seeded["tags"][TAG_OTHER]
        r = requests.patch(f"{BASE_URL}/api/lead-tags/{tag_id}", json={"name": TAG_SRC},
                           headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"Expected 400 dup, got {r.status_code}: {r.text[:200]}"


class TestMergeEndpoint:
    """POST /api/lead-tags/merge"""

    def test_merge_path_not_interpreted_as_tag_id(self, admin_headers):
        """Critical: POST /lead-tags/merge must NOT be matched by any /lead-tags/{tag_id}."""
        # send empty body — must hit merge handler, not /{tag_id}
        r = requests.post(f"{BASE_URL}/api/lead-tags/merge", json={}, headers=admin_headers, timeout=15)
        # Empty body → 400 (validation in merge), NOT 405/404
        assert r.status_code == 400, f"Expected 400 from merge validation, got {r.status_code}: {r.text[:200]}"

    def test_merge_source_equals_target_400(self, admin_headers, seeded):
        sid = seeded["tags"][TAG_SRC]
        r = requests.post(f"{BASE_URL}/api/lead-tags/merge",
                          json={"source_id": sid, "target_id": sid},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400, r.text[:200]

    def test_merge_invalid_ids_404(self, admin_headers, seeded):
        r = requests.post(f"{BASE_URL}/api/lead-tags/merge",
                          json={"source_id": "nope-src", "target_id": seeded["tags"][TAG_DST]},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 404, r.text[:200]
        r2 = requests.post(f"{BASE_URL}/api/lead-tags/merge",
                           json={"source_id": seeded["tags"][TAG_DST], "target_id": "nope-tgt"},
                           headers=admin_headers, timeout=15)
        assert r2.status_code == 404, r2.text[:200]

    def test_merge_ok_propagates_and_deletes_source(self, admin_headers, seeded, mongo_db):
        sid = seeded["tags"][TAG_SRC]
        tid = seeded["tags"][TAG_DST]
        r = requests.post(f"{BASE_URL}/api/lead-tags/merge",
                          json={"source_id": sid, "target_id": tid},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("success") is True
        assert body.get("merged_from") == TAG_SRC
        assert body.get("merged_into") == TAG_DST

        # Source tag deleted
        assert mongo_db.lead_tags.find_one({"id": sid}) is None

        # Lead: source removed, target present
        lead = mongo_db.leads.find_one({"id": seeded["lead_id"]})
        assert TAG_SRC not in lead["tags"], f"src still in lead.tags: {lead['tags']}"
        assert TAG_DST in lead["tags"], f"dst missing in lead.tags: {lead['tags']}"

        # Cliente: same
        cli = mongo_db.clienti.find_one({"id": seeded["cli_id"]})
        assert TAG_SRC not in cli["tags"], f"src still in cliente.tags: {cli['tags']}"
        assert TAG_DST in cli["tags"], f"dst missing in cliente.tags: {cli['tags']}"


class TestCleanupOrphans:
    """POST /api/lead-tags/cleanup-orphans"""

    def test_cleanup_orphans_creates_missing_tags(self, admin_headers, seeded, mongo_db):
        # Precondition: TAG_ORPHAN is in lead/cliente.tags but NOT in lead_tags
        assert mongo_db.lead_tags.find_one({"name": TAG_ORPHAN}) is None
        r = requests.post(f"{BASE_URL}/api/lead-tags/cleanup-orphans",
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert "created_count" in body
        assert "created_tags" in body
        assert TAG_ORPHAN in body["created_tags"], f"Orphan tag not created: {body}"
        # Verify it now exists in lead_tags
        created = mongo_db.lead_tags.find_one({"name": TAG_ORPHAN})
        assert created is not None
        assert created.get("description") == "Auto-creato da cleanup orfani"


class TestDeleteTag:
    """DELETE /api/lead-tags/{tag_id} must remove from BOTH leads.tags AND clienti.tags."""

    def test_delete_propagates_to_leads_and_clienti(self, admin_headers, seeded, mongo_db):
        # Pre: TAG_DELME is in both lead and cliente
        lead = mongo_db.leads.find_one({"id": seeded["lead_id"]})
        cli = mongo_db.clienti.find_one({"id": seeded["cli_id"]})
        assert TAG_DELME in lead["tags"]
        assert TAG_DELME in cli["tags"]

        tag_id = seeded["tags"][TAG_DELME]
        r = requests.delete(f"{BASE_URL}/api/lead-tags/{tag_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]

        # Tag deleted
        assert mongo_db.lead_tags.find_one({"id": tag_id}) is None
        # Removed from lead AND cliente
        lead2 = mongo_db.leads.find_one({"id": seeded["lead_id"]})
        cli2 = mongo_db.clienti.find_one({"id": seeded["cli_id"]})
        assert TAG_DELME not in lead2["tags"], f"DELME still in lead.tags: {lead2['tags']}"
        assert TAG_DELME not in cli2["tags"], f"DELME still in cliente.tags: {cli2['tags']}"
