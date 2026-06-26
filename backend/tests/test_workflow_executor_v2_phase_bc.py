"""
Validation tests for Workflow Builder FASE B/C:
- workflow_executor V2 subtypes: add_tag, remove_tag, go_to, if_else, match_value
- POST /api/workflows/{id}/test-run
- GET/POST /api/lead-tags
- GET /api/workflow-node-types includes the new subtypes
"""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spoki-workflow-hub.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "crm_database")

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

TEST_PREFIX = "TEST_WF_PHBC_"

# ---------------- Fixtures ----------------

@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME, "password": ADMIN_PASSWORD,
    })
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def api(token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="session")
def mongo():
    cli = MongoClient(MONGO_URL)
    db = cli[DB_NAME]
    yield db
    # Cleanup test data after the whole session
    db.workflows.delete_many({"name": {"$regex": f"^{TEST_PREFIX}"}})
    db.leads.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    db.lead_tags.delete_many({"name": {"$regex": f"^{TEST_PREFIX.lower()}"}})
    db.workflow_executions_v2.delete_many({"workflow_id": {"$regex": f"^{TEST_PREFIX}"}})


def _create_workflow_doc(mongo, name, nodes, edges, unit_id=None):
    if unit_id is None:
        u = mongo.units.find_one({}) or {}
        unit_id = u.get("id") or "test-unit"
    wid = f"{TEST_PREFIX}{uuid.uuid4().hex[:8]}"
    doc = {
        "id": wid,
        "name": name,
        "description": "phase B/C validation",
        "unit_id": unit_id,
        "created_by": "test",
        "is_active": True,
        "is_published": True,
        "trigger_type": "lead_created",
        "nodes": nodes,
        "edges": edges,
    }
    mongo.workflows.insert_one(doc)
    return wid


def _trigger(node_id="trig"):
    return {"id": node_id, "data": {"nodeType": "triggers", "nodeSubtype": "lead_created", "config": {}}}


def _action(node_id, subtype, config):
    return {"id": node_id, "data": {"nodeType": "actions", "nodeSubtype": subtype, "config": config}}


def _condition(node_id, subtype, config):
    return {"id": node_id, "data": {"nodeType": "conditions", "nodeSubtype": subtype, "config": config}}


def _edge(src, tgt, branch=None):
    e = {"id": f"{src}->{tgt}", "source": src, "target": tgt}
    if branch:
        e["sourceHandle"] = branch
    return e


# ---------------- Node Types endpoint ----------------

class TestNodeTypes:
    def test_node_types_includes_new_subtypes(self, api):
        r = api.get(f"{BASE_URL}/api/workflow-node-types")
        assert r.status_code == 200, r.text
        data = r.json()
        action_subs = list(data.get("action", {}).get("subtypes", {}).keys())
        cond_subs = list(data.get("condition", {}).get("subtypes", {}).keys())
        assert "add_tag" in action_subs
        assert "remove_tag" in action_subs
        assert "go_to" in action_subs
        assert "if_else" in cond_subs
        assert "match_value" in cond_subs


# ---------------- Lead Tags CRUD ----------------

class TestLeadTags:
    def test_list_tags_empty_or_existing(self, api):
        r = api.get(f"{BASE_URL}/api/lead-tags")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_tag_and_listed(self, api, mongo):
        # cleanup any leftover
        mongo.lead_tags.delete_many({"name": f"{TEST_PREFIX.lower()}vip"})
        payload = {"name": f"{TEST_PREFIX}VIP", "label": "VIP", "color": "#ff0000"}
        r = api.post(f"{BASE_URL}/api/lead-tags", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        # name is lowercased & spaces -> _
        assert body["name"] == f"{TEST_PREFIX.lower()}vip"
        assert body["label"] == "VIP"
        assert body["color"] == "#ff0000"
        assert "id" in body

        # verify list contains it
        r2 = api.get(f"{BASE_URL}/api/lead-tags")
        assert r2.status_code == 200
        names = [t["name"] for t in r2.json()]
        assert f"{TEST_PREFIX.lower()}vip" in names

    def test_create_duplicate_tag_returns_409(self, api):
        payload = {"name": f"{TEST_PREFIX}VIP"}
        r = api.post(f"{BASE_URL}/api/lead-tags", json=payload)
        # second time it should already exist
        assert r.status_code == 409


# ---------------- Test-Run endpoint ----------------

class TestTestRunEndpoint:
    def test_test_run_with_add_tag_returns_200_and_history(self, api, mongo):
        nodes = [
            _trigger("trig"),
            _action("a1", "add_tag", {"tag": "lead_test_run"}),
        ]
        edges = [_edge("trig", "a1")]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}test_run_basic", nodes, edges)

        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": "ghost-lead-id", "nome": "Mario", "cognome": "Rossi", "telefono": "+393331234567"},
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        # the executor should be done (no waiting)
        assert body.get("status") in ("done", "running")
        exec_id = body.get("execution_id")
        assert exec_id, body
        # check history written
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        assert exec_doc is not None
        node_ids = [h["node_id"] for h in exec_doc.get("history", [])]
        assert "trig" in node_ids
        assert "a1" in node_ids

    def test_test_run_does_not_create_lead(self, api, mongo):
        """test-run with a ghost lead id must NOT side-effect a real lead doc."""
        ghost_id = f"{TEST_PREFIX}ghost-{uuid.uuid4().hex[:6]}"
        nodes = [
            _trigger("trig"),
            _action("a1", "add_tag", {"tag": "ghost_tag"}),
        ]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}ghost_run", nodes, [_edge("trig", "a1")])
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": ghost_id, "nome": "Ghost"},
        })
        assert r.status_code == 200
        # No lead with that id should be persisted (add_tag uses update_one which only updates existing)
        assert mongo.leads.find_one({"id": ghost_id}) is None


# ---------------- add_tag / remove_tag with REAL lead ----------------

@pytest.fixture(scope="class")
def real_lead(mongo):
    lid = f"{TEST_PREFIX}lead_{uuid.uuid4().hex[:8]}"
    mongo.leads.insert_one({
        "id": lid,
        "nome": "Mario",
        "cognome": "Rossi",
        "telefono": "+393331234567",
        "tags": ["pre_existing"],
    })
    yield lid
    mongo.leads.delete_one({"id": lid})


class TestAddRemoveTagOnRealLead:
    def test_add_tag_addsToSet(self, api, mongo, real_lead):
        nodes = [
            _trigger("trig"),
            _action("a1", "add_tag", {"tag": "lead_caldo"}),
        ]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}addtag_real", nodes, [_edge("trig", "a1")])
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": real_lead, "nome": "Mario"},
        })
        assert r.status_code == 200, r.text
        lead = mongo.leads.find_one({"id": real_lead})
        assert lead is not None
        assert "lead_caldo" in lead.get("tags", [])
        # pre-existing must not have been removed (addToSet behaviour)
        assert "pre_existing" in lead.get("tags", [])

    def test_add_tag_is_idempotent(self, api, mongo, real_lead):
        # run again with the same tag — addToSet should not duplicate
        nodes = [
            _trigger("trig"),
            _action("a1", "add_tag", {"tag": "lead_caldo"}),
        ]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}addtag_real2", nodes, [_edge("trig", "a1")])
        api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={"fake_lead": {"id": real_lead}})
        lead = mongo.leads.find_one({"id": real_lead})
        assert lead["tags"].count("lead_caldo") == 1

    def test_remove_tag_pulls(self, api, mongo, real_lead):
        nodes = [
            _trigger("trig"),
            _action("a1", "remove_tag", {"tag": "lead_caldo"}),
        ]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}removetag_real", nodes, [_edge("trig", "a1")])
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={"fake_lead": {"id": real_lead}})
        assert r.status_code == 200, r.text
        lead = mongo.leads.find_one({"id": real_lead})
        assert "lead_caldo" not in lead.get("tags", [])
        # other tags untouched
        assert "pre_existing" in lead.get("tags", [])


# ---------------- go_to ----------------

class TestGoTo:
    def test_go_to_jumps_to_target_node(self, api, mongo):
        """trig -> a1(go_to target=a3) -> a2 (should be skipped); a3 reached via goto."""
        nodes = [
            _trigger("trig"),
            _action("a1", "go_to", {"target_node_id": "a3"}),
            _action("a2", "add_tag", {"tag": "should_not_run"}),
            _action("a3", "add_tag", {"tag": "reached_via_goto"}),
        ]
        edges = [
            _edge("trig", "a1"),
            _edge("a1", "a2"),  # this edge must be ignored due to goto
            _edge("a2", "a3"),
        ]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}goto_basic", nodes, edges)
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={"fake_lead": {"id": f"{TEST_PREFIX}gt"}})
        assert r.status_code == 200, r.text
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        node_ids = [h["node_id"] for h in exec_doc.get("history", [])]
        assert "a1" in node_ids
        assert "a3" in node_ids, f"goto did not jump to a3. history={node_ids}"
        assert "a2" not in node_ids, f"goto did not skip a2. history={node_ids}"
        # a1's result should contain goto_node_id
        a1_hist = next(h for h in exec_doc["history"] if h["node_id"] == "a1")
        assert a1_hist["result"].get("goto_node_id") == "a3"


# ---------------- if_else ----------------

class TestIfElse:
    def _build_ifelse_wf(self, mongo, op, value, suffix):
        nodes = [
            _trigger("trig"),
            _condition("c1", "if_else", {"field": "trigger.lead.nome", "op": op, "value": value}),
            _action("yes_node", "add_tag", {"tag": "branch_yes"}),
            _action("no_node", "add_tag", {"tag": "branch_no"}),
        ]
        edges = [
            _edge("trig", "c1"),
            _edge("c1", "yes_node", branch="yes"),
            _edge("c1", "no_node", branch="no"),
        ]
        return _create_workflow_doc(mongo, f"{TEST_PREFIX}ifelse_{suffix}", nodes, edges)

    def test_if_else_yes_branch(self, api, mongo):
        wid = self._build_ifelse_wf(mongo, "equals", "Mario", "yes")
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}ifelseY", "nome": "Mario"},
        })
        assert r.status_code == 200, r.text
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        node_ids = [h["node_id"] for h in exec_doc["history"]]
        c1 = next(h for h in exec_doc["history"] if h["node_id"] == "c1")
        assert c1["result"].get("branch") == "yes"
        assert "yes_node" in node_ids
        assert "no_node" not in node_ids

    def test_if_else_no_branch(self, api, mongo):
        wid = self._build_ifelse_wf(mongo, "equals", "Mario", "no")
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}ifelseN", "nome": "Luigi"},
        })
        assert r.status_code == 200, r.text
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        c1 = next(h for h in exec_doc["history"] if h["node_id"] == "c1")
        assert c1["result"].get("branch") == "no"
        node_ids = [h["node_id"] for h in exec_doc["history"]]
        assert "no_node" in node_ids
        assert "yes_node" not in node_ids

    def test_if_else_contains_op(self, api, mongo):
        wid = self._build_ifelse_wf(mongo, "contains", "ari", "contains")
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}ifelseC", "nome": "Mario"},
        })
        assert r.status_code == 200
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        c1 = next(h for h in exec_doc["history"] if h["node_id"] == "c1")
        assert c1["result"].get("branch") == "yes"


# ---------------- match_value ----------------

class TestMatchValue:
    def _build_match_wf(self, mongo, cases, default_label, suffix, branch_nodes):
        nodes = [
            _trigger("trig"),
            _condition("m1", "match_value", {
                "field": "trigger.lead.provincia",
                "cases": cases,
                "default_label": default_label,
            }),
        ]
        # branch nodes
        for label in branch_nodes:
            nodes.append(_action(f"bn_{label}", "add_tag", {"tag": f"branch_{label}"}))
        edges = [_edge("trig", "m1")]
        for label in branch_nodes:
            edges.append(_edge("m1", f"bn_{label}", branch=label))
        return _create_workflow_doc(mongo, f"{TEST_PREFIX}match_{suffix}", nodes, edges)

    def test_match_value_matches_case_label(self, api, mongo):
        cases = [
            {"value": "MI", "label": "milano"},
            {"value": "RM", "label": "roma"},
            {"value": "NA", "label": "napoli"},
        ]
        wid = self._build_match_wf(mongo, cases, "altro", "rm", ["milano", "roma", "napoli", "altro"])
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}mvRM", "provincia": "RM"},
        })
        assert r.status_code == 200, r.text
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        m1 = next(h for h in exec_doc["history"] if h["node_id"] == "m1")
        assert m1["result"].get("branch") == "roma"
        node_ids = [h["node_id"] for h in exec_doc["history"]]
        assert "bn_roma" in node_ids
        assert "bn_milano" not in node_ids

    def test_match_value_case_insensitive(self, api, mongo):
        cases = [{"value": "MI", "label": "milano"}]
        wid = self._build_match_wf(mongo, cases, "altro", "ci", ["milano", "altro"])
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}mvCI", "provincia": "mi"},
        })
        assert r.status_code == 200
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        m1 = next(h for h in exec_doc["history"] if h["node_id"] == "m1")
        assert m1["result"].get("branch") == "milano"

    def test_match_value_default_branch(self, api, mongo):
        cases = [{"value": "MI", "label": "milano"}, {"value": "RM", "label": "roma"}]
        wid = self._build_match_wf(mongo, cases, "altro", "def", ["milano", "roma", "altro"])
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}mvDEF", "provincia": "TO"},
        })
        assert r.status_code == 200
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        m1 = next(h for h in exec_doc["history"] if h["node_id"] == "m1")
        assert m1["result"].get("branch") == "altro"
        node_ids = [h["node_id"] for h in exec_doc["history"]]
        assert "bn_altro" in node_ids

    def test_match_value_cases_as_json_string(self, api, mongo):
        """The executor accepts cfg.cases as a JSON string too."""
        import json as _json
        cases_str = _json.dumps([{"value": "MI", "label": "milano"}])
        nodes = [
            _trigger("trig"),
            _condition("m1", "match_value", {
                "field": "trigger.lead.provincia",
                "cases": cases_str,
                "default_label": "altro",
            }),
            _action("bn_milano", "add_tag", {"tag": "x"}),
        ]
        edges = [_edge("trig", "m1"), _edge("m1", "bn_milano", branch="milano")]
        wid = _create_workflow_doc(mongo, f"{TEST_PREFIX}match_jsonstr", nodes, edges)
        r = api.post(f"{BASE_URL}/api/workflows/{wid}/test-run", json={
            "fake_lead": {"id": f"{TEST_PREFIX}mvJSON", "provincia": "MI"},
        })
        assert r.status_code == 200, r.text
        exec_id = r.json()["execution_id"]
        exec_doc = mongo.workflow_executions_v2.find_one({"id": exec_id})
        m1 = next(h for h in exec_doc["history"] if h["node_id"] == "m1")
        assert m1["result"].get("branch") == "milano"
