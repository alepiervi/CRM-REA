"""
Backend tests for Spoki/OpenAI chatbot + Workflow integration.

Covers:
  1) GET /api/spoki/openai-assistants returns ~7 real assistants
  2) POST /api/spoki/webhook -> NO bot reply when chatbot session not activated by workflow (gate)
  3) POST /api/spoki/webhook -> bot replies (outbound 'bot') when session.activated_by_workflow=True and unit has openai_assistant_id
  4) Regression: POST /api/webhook/lead does NOT auto-send welcome template (no template-outbound in spoki_messages on create)
  5) /api/workflow-node-types exposes the new subtype 'activate_chatbot'
"""

import os
import time
import hmac
import json
import hashlib
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lead-qualification-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# DB direct access to seed / verify (Spoki webhook does not have business signature secret in env)
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "crm_database")
SPOKI_API_KEY = os.environ.get("SPOKI_API_KEY", "")  # used as webhook signing key (per spoki_module)

# Assistant of the user known to be valid (from problem statement)
TEST_ASSISTANT_ID = "asst_SUXVhnl5CIDM2teIyeca6aI2"

TEST_PREFIX = "TESTSPOKICHAT"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def some_unit_id(db, admin_headers):
    # Try real commesse list first
    r = requests.get(f"{API}/commesse", headers=admin_headers, timeout=20)
    if r.status_code == 200 and r.json():
        return r.json()[0]["id"]
    # fallback to existing unit_spoki_configs
    cfg = db.unit_spoki_configs.find_one({})
    return (cfg or {}).get("unit_id") or "default-unit"


@pytest.fixture(scope="module")
def cleanup(db):
    yield
    # Clean test data
    leads = list(db.leads.find({"nome": {"$regex": f"^{TEST_PREFIX}"}}, {"id": 1, "telefono": 1}))
    lead_ids = [l["id"] for l in leads]
    phones = [l["telefono"] for l in leads if l.get("telefono")]
    if lead_ids:
        db.leads.delete_many({"id": {"$in": lead_ids}})
        db.spoki_messages.delete_many({"lead_id": {"$in": lead_ids}})
        db.lead_chatbot_sessions.delete_many({"lead_id": {"$in": lead_ids}})
    # also clean by phone in case some msgs not linked
    if phones:
        db.spoki_messages.delete_many({"phone_number": {"$in": phones}})
    # Remove the openai_assistant_id we may have set on units we touched
    db.unit_spoki_configs.update_many(
        {"_test_marker": TEST_PREFIX},
        {"$unset": {"openai_assistant_id": "", "_test_marker": ""}},
    )


# --- 1) OpenAI Assistants endpoint ---
class TestOpenAIAssistants:
    def test_list_assistants(self, admin_headers):
        r = requests.get(f"{API}/spoki/openai-assistants", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("configured") is True
        assert isinstance(data.get("assistants"), list)
        assert len(data["assistants"]) >= 3, f"expected >=3 assistants, got {len(data['assistants'])}"
        # Verify shape
        for a in data["assistants"]:
            assert a.get("id", "").startswith("asst_")
            assert "name" in a
        # The known test assistant should be in the list (problem statement)
        ids = {a["id"] for a in data["assistants"]}
        assert TEST_ASSISTANT_ID in ids, f"{TEST_ASSISTANT_ID} not in assistants: {ids}"


# --- 5) Workflow node registry exposes activate_chatbot ---
class TestWorkflowNodeRegistry:
    def test_activate_chatbot_subtype_present(self, admin_headers):
        r = requests.get(f"{API}/workflow-node-types", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        # Search anywhere in the response for the subtype key
        flat = json.dumps(data)
        assert "activate_chatbot" in flat, "activate_chatbot subtype missing from /api/workflow-node-types"


def _sign(body: bytes) -> str:
    if not SPOKI_API_KEY:
        return ""
    return "sha256=" + hmac.new(SPOKI_API_KEY.encode(), body, hashlib.sha256).hexdigest()


def _post_webhook(payload: dict) -> requests.Response:
    raw = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    sig = _sign(raw)
    if sig:
        headers["X-Spoki-Signature"] = sig
    return requests.post(f"{API}/spoki/webhook", data=raw, headers=headers, timeout=30)


# --- 4) Regression: lead creation does NOT auto-send welcome ---
class TestLeadCreationNoAutoWelcome:
    def test_create_lead_no_welcome_template(self, db, admin_headers, cleanup):
        phone = f"+393999{int(time.time()) % 1000000:06d}"
        payload = {
            "nome": f"{TEST_PREFIX}_NoWelcome",
            "cognome": "Test",
            "telefono": phone,
            "fonte": "test_spoki",
        }
        r = requests.post(f"{API}/webhook/lead", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text[:300]
        lead_id = r.json().get("id") or r.json().get("lead_id") or (r.json().get("lead") or {}).get("id")
        # find lead in DB if endpoint did not echo id
        if not lead_id:
            lead = db.leads.find_one({"telefono": phone})
            assert lead, "lead not created"
            lead_id = lead["id"]
        # Allow workflows to potentially fire (background)
        time.sleep(2)
        # Verify no outbound template message was created from welcome flow
        msgs = list(db.spoki_messages.find({"$or": [{"lead_id": lead_id}, {"phone_number": phone}]}))
        template_welcome = [
            m for m in msgs
            if m.get("direction") == "outbound" and m.get("template_name") and m.get("sender") == "system"
        ]
        assert template_welcome == [], (
            f"Expected NO auto welcome template on lead creation, found: {template_welcome}"
        )


# --- 2 & 3) Webhook gate + activation ---
class TestSpokiWebhookGate:
    @pytest.fixture(scope="class")
    def test_lead(self, db):
        phone = f"+393888{int(time.time()) % 1000000:06d}"
        lead_id = str(uuid.uuid4())
        # Pick or create unit
        unit = db.commesse.find_one({}) or {}
        unit_id = unit.get("id") or "unit-default"
        lead_doc = {
            "id": lead_id,
            "nome": f"{TEST_PREFIX}_Gate",
            "cognome": "Bot",
            "telefono": phone,
            "commessa_id": unit_id,
            "stato": "nuovo",
            "fonte": "test",
        }
        db.leads.insert_one(lead_doc)
        yield {"id": lead_id, "phone": phone, "unit_id": unit_id}
        # cleanup handled by module-scoped fixture, but do quick local clean too
        db.leads.delete_one({"id": lead_id})
        db.spoki_messages.delete_many({"lead_id": lead_id})
        db.lead_chatbot_sessions.delete_many({"lead_id": lead_id})

    def _build_payload(self, phone: str, text: str) -> dict:
        return {
            "version": 1,
            "event": "message.inbound",
            "data": {
                "uuid": str(uuid.uuid4()),
                "direction": "Inbound",
                "content_type": "Text",
                "from_phone": phone,
                "text": text,
            },
        }

    def test_webhook_no_session_no_bot_reply(self, db, test_lead):
        """Without an activated session, the bot must NOT reply."""
        # ensure no session
        db.lead_chatbot_sessions.delete_many({"lead_id": test_lead["id"]})
        before = db.spoki_messages.count_documents({"lead_id": test_lead["id"]})
        r = _post_webhook(self._build_payload(test_lead["phone"], "ciao, info"))
        assert r.status_code == 200, r.text[:300]
        time.sleep(1.5)
        msgs = list(db.spoki_messages.find({"lead_id": test_lead["id"]}))
        # inbound should be logged
        inbound = [m for m in msgs if m.get("direction") == "inbound"]
        assert len(inbound) >= 1, "inbound message should be logged"
        # NO outbound from bot
        bot_out = [m for m in msgs if m.get("direction") == "outbound" and m.get("sender") == "bot"]
        assert bot_out == [], f"bot must NOT respond without activation, found: {len(bot_out)} outbound bot msgs"
        # session must NOT be created automatically
        sess = db.lead_chatbot_sessions.find_one({"lead_id": test_lead["id"]})
        assert sess is None, "no session should be created when bot is not activated"

    def test_webhook_with_activated_session_triggers_bot(self, db, test_lead):
        """With session.activated_by_workflow=True and unit has openai_assistant_id, bot must reply."""
        # Configure unit with the real assistant
        unit_id = test_lead["unit_id"]
        db.unit_spoki_configs.update_one(
            {"unit_id": unit_id},
            {"$set": {
                "unit_id": unit_id,
                "openai_assistant_id": TEST_ASSISTANT_ID,
                "chatbot_enabled": True,
                "_test_marker": TEST_PREFIX,
            }},
            upsert=True,
        )
        # Activate chatbot session
        db.lead_chatbot_sessions.update_one(
            {"lead_id": test_lead["id"]},
            {"$set": {
                "lead_id": test_lead["id"],
                "unit_id": unit_id,
                "activated_by_workflow": True,
                "status": "active",
                "messages": [],
            }},
            upsert=True,
        )
        # Send webhook (single call to limit OpenAI usage)
        r = _post_webhook(self._build_payload(test_lead["phone"], "Ciao, vorrei un appuntamento"))
        assert r.status_code == 200, r.text[:300]
        # wait for OpenAI Assistant run (threads/runs are slow ~5-15s)
        deadline = time.time() + 45
        bot_out = []
        while time.time() < deadline:
            bot_out = list(db.spoki_messages.find({
                "lead_id": test_lead["id"], "direction": "outbound", "sender": "bot",
            }))
            if bot_out:
                break
            time.sleep(2)
        assert bot_out, "bot did not produce an outbound message within 45s"
        # status will be 'failed' because Spoki API key is invalid (401) - that's EXPECTED
        # We only check that the bot message exists.
        # Session must contain openai_thread_id
        sess = db.lead_chatbot_sessions.find_one({"lead_id": test_lead["id"]})
        assert sess, "session must exist"
        thread_id = sess.get("openai_thread_id")
        assert thread_id and thread_id.startswith("thread_"), f"openai_thread_id missing/invalid: {thread_id}"
