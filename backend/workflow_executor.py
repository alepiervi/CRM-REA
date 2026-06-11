"""
Workflow Executor - Executes workflow nodes for lead qualification
"""
import asyncio
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
import openai

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """Executes workflows for lead processing"""
    
    def __init__(self, db: AsyncIOMotorDatabase, openai_api_key: Optional[str] = None):
        self.db = db
        self.openai_api_key = openai_api_key
        if openai_api_key:
            openai.api_key = openai_api_key
    
    async def execute_workflow(self, workflow_id: str, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a workflow with the given trigger data
        
        Args:
            workflow_id: ID of the workflow to execute
            trigger_data: Data that triggered the workflow (e.g., lead data)
            
        Returns:
            Execution result with status and logs
        """
        try:
            # Get workflow configuration
            workflow = await self.db.workflows.find_one({"id": workflow_id})
            if not workflow:
                return {"success": False, "error": "Workflow not found"}
            
            # Parse workflow nodes and edges
            nodes = workflow.get("nodes", [])
            edges = workflow.get("edges", [])
            
            # Build execution graph
            execution_order = self._build_execution_order(nodes, edges)
            
            # Execute nodes in order
            context = {"trigger": trigger_data, "results": {}}
            
            for node_id in execution_order:
                node = next((n for n in nodes if n["id"] == node_id), None)
                if not node:
                    continue
                
                result = await self._execute_node(node, context)
                context["results"][node_id] = result
                
                # Check if execution should stop
                if not result.get("continue", True):
                    break
            
            return {
                "success": True,
                "workflow_id": workflow_id,
                "context": context,
                "executed_nodes": len(context["results"])
            }
            
        except Exception as e:
            logger.error(f"Workflow execution error: {e}")
            return {"success": False, "error": str(e)}
    
    def _build_execution_order(self, nodes: List[Dict], edges: List[Dict]) -> List[str]:
        """Build execution order from nodes and edges (topological sort)"""
        # Simple implementation: start from trigger nodes
        trigger_nodes = [n["id"] for n in nodes if n.get("data", {}).get("nodeType") == "triggers"]
        
        if not trigger_nodes:
            # Return all nodes if no trigger found
            return [n["id"] for n in nodes]
        
        # Build adjacency list
        graph = {n["id"]: [] for n in nodes}
        for edge in edges:
            graph[edge["source"]].append(edge["target"])
        
        # BFS from trigger nodes
        visited = set()
        order = []
        queue = trigger_nodes.copy()
        
        while queue:
            node_id = queue.pop(0)
            if node_id in visited:
                continue
            
            visited.add(node_id)
            order.append(node_id)
            
            # Add connected nodes
            for next_node in graph.get(node_id, []):
                if next_node not in visited:
                    queue.append(next_node)
        
        return order
    
    async def _execute_node(self, node: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single workflow node"""
        node_type = node.get("data", {}).get("nodeType")
        node_subtype = node.get("data", {}).get("nodeSubtype")
        config = node.get("data", {}).get("config", {})
        
        logger.info(f"Executing node: {node_type}/{node_subtype}")
        
        try:
            if node_type == "triggers":
                return await self._execute_trigger(node_subtype, config, context)
            elif node_type == "actions":
                return await self._execute_action(node_subtype, config, context)
            elif node_type == "conditions":
                return await self._execute_condition(node_subtype, config, context)
            else:
                return {"success": False, "error": f"Unknown node type: {node_type}"}
        except Exception as e:
            logger.error(f"Node execution error: {e}")
            return {"success": False, "error": str(e), "continue": True}
    
    async def _execute_trigger(self, subtype: str, config: Dict, context: Dict) -> Dict[str, Any]:
        """Execute trigger node"""
        # Triggers are passive - they just validate the trigger data
        return {"success": True, "triggered": True, "continue": True}
    
    async def _execute_action(self, subtype: str, config: Dict, context: Dict) -> Dict[str, Any]:
        """Execute action node"""
        
        if subtype == "assign_to_unit":
            return await self._action_assign_unit(config, context)
        elif subtype == "send_whatsapp":
            return await self._action_send_whatsapp(config, context)
        elif subtype == "start_ai_conversation":
            return await self._action_start_ai_conversation(config, context)
        elif subtype == "update_lead_field":
            return await self._action_update_lead(config, context)
        else:
            logger.warning(f"Unknown action subtype: {subtype}")
            return {"success": True, "skipped": True, "continue": True}
    
    async def _execute_condition(self, subtype: str, config: Dict, context: Dict) -> Dict[str, Any]:
        """Execute condition node"""
        
        if subtype == "check_positive_response":
            return await self._condition_positive_response(config, context)
        else:
            logger.warning(f"Unknown condition subtype: {subtype}")
            return {"success": True, "result": True, "continue": True}
    
    # Action Implementations
    
    async def _action_assign_unit(self, config: Dict, context: Dict) -> Dict[str, Any]:
        """Verify or update lead unit assignment"""
        lead_id = context.get("trigger", {}).get("lead_id")
        
        if not lead_id:
            return {"success": False, "error": "Missing lead_id"}
        
        # Get lead
        lead = await self.db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            return {"success": False, "error": "Lead not found"}
        
        # Lead già ha unit_id dal webhook - verifichiamo solo
        unit_id = lead.get("unit_id")
        if not unit_id:
            return {"success": False, "error": "Lead not assigned to unit"}
        
        unit = await self.db.units.find_one({"id": unit_id}, {"_id": 0})
        if not unit:
            return {"success": False, "error": "Unit not found"}
        
        return {
            "success": True,
            "unit_id": unit["id"],
            "unit_name": unit["nome"],
            "agent_id": lead.get("assigned_agent_id"),
            "continue": True
        }
    
    async def _action_send_whatsapp(self, config: Dict, context: Dict) -> Dict[str, Any]:
        """Send WhatsApp welcome message"""
        lead_id = context.get("trigger", {}).get("lead_id")
        
        # Get lead
        lead = await self.db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            return {"success": False, "error": "Lead not found"}
        
        # Get unit
        unit_id = lead.get("unit_id")
        if not unit_id:
            return {"success": False, "error": "Lead not assigned to unit"}
        
        unit = await self.db.units.find_one({"id": unit_id}, {"_id": 0})
        if not unit:
            return {"success": False, "error": "Unit not found"}
        
        # Get WhatsApp config for unit
        whatsapp_config = await self.db.whatsapp_configurations.find_one(
            {"unit_id": unit_id, "is_connected": True},
            {"_id": 0}
        )
        
        if not whatsapp_config:
            return {"success": False, "error": "WhatsApp not configured for unit"}
        
        # Get welcome message template
        welcome_message = unit.get("welcome_message") or config.get("message") or "Benvenuto! Sei pronto per iniziare?"
        
        # Replace placeholders
        message = welcome_message.format(
            nome=lead.get("nome", ""),
            cognome=lead.get("cognome", ""),
            unit_name=unit.get("nome", "")
        )
        
        # Create message record
        whatsapp_message = {
            "id": f"msg_{lead_id}_{datetime.now().timestamp()}",
            "lead_id": lead_id,
            "phone_number": lead.get("telefono", ""),
            "message": message,
            "direction": "outgoing",
            "sender": "bot",
            "status": "sent",
            "timestamp": datetime.now(timezone.utc)
        }
        
        await self.db.whatsapp_messages.insert_one(whatsapp_message)
        
        return {
            "success": True,
            "message_sent": True,
            "message": message,
            "continue": True
        }
    
    async def _action_start_ai_conversation(self, config: Dict, context: Dict) -> Dict[str, Any]:
        """Start AI Assistant conversation"""
        lead_id = context.get("trigger", {}).get("lead_id")
        
        # Get lead and unit
        lead = await self.db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            return {"success": False, "error": "Lead not found"}
        
        unit_id = lead.get("unit_id")
        unit = await self.db.units.find_one({"id": unit_id}, {"_id": 0})
        if not unit or not unit.get("assistant_id"):
            return {"success": False, "error": "Unit AI Assistant not configured"}
        
        # Create AI conversation thread
        assistant_id = unit["assistant_id"]
        
        # Store conversation state
        conversation = {
            "id": f"conv_{lead_id}_{datetime.now().timestamp()}",
            "lead_id": lead_id,
            "unit_id": unit_id,
            "assistant_id": assistant_id,
            "status": "active",
            "started_at": datetime.now(timezone.utc)
        }
        
        await self.db.ai_conversations.insert_one(conversation)
        
        return {
            "success": True,
            "conversation_started": True,
            "assistant_id": assistant_id,
            "continue": True
        }
    
    async def _action_update_lead(self, config: Dict, context: Dict) -> Dict[str, Any]:
        """Update lead fields from AI conversation"""
        lead_id = context.get("trigger", {}).get("lead_id")
        updates = config.get("updates", {})
        
        if not updates:
            return {"success": True, "no_updates": True, "continue": True}
        
        await self.db.leads.update_one(
            {"id": lead_id},
            {"$set": updates}
        )
        
        return {
            "success": True,
            "fields_updated": list(updates.keys()),
            "continue": True
        }
    
    # Condition Implementations
    
    async def _condition_positive_response(self, config: Dict, context: Dict) -> Dict[str, Any]:
        """Check if lead response is positive"""
        lead_id = context.get("trigger", {}).get("lead_id")
        
        # Get last message from lead
        last_message = await self.db.whatsapp_messages.find_one(
            {
                "lead_id": lead_id,
                "direction": "incoming"
            },
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        
        if not last_message:
            return {"success": True, "result": False, "continue": False}
        
        # Check for positive keywords
        message_text = last_message.get("message", "").lower()
        positive_keywords = ["si", "sì", "ok", "certo", "va bene", "yes", "perfetto", "dai"]
        
        is_positive = any(keyword in message_text for keyword in positive_keywords)
        
        return {
            "success": True,
            "result": is_positive,
            "message": message_text,
            "continue": is_positive
        }


class AIResponseParser:
    """Parses AI Assistant responses to extract lead field updates"""
    
    FIELD_PATTERNS = {
        "nome": r"(?:mi chiamo|sono|nome[:\s]+)([A-Za-zÀ-ÿ\s]+)",
        "cognome": r"(?:cognome[:\s]+)([A-Za-zÀ-ÿ\s]+)",
        "email": r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
        "telefono": r"(\+?\d{9,15})",
        "citta": r"(?:di|a|da|città[:\s]+)([A-Za-zÀ-ÿ\s]+)",
        "eta": r"(\d{1,3})\s*(?:anni|years old)",
    }
    
    @classmethod
    def parse_response(cls, message: str) -> Dict[str, str]:
        """
        Parse AI response to extract field values
        
        Args:
            message: Message text from lead/AI
            
        Returns:
            Dictionary of field: value pairs
        """
        updates = {}
        
        for field, pattern in cls.FIELD_PATTERNS.items():
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                updates[field] = match.group(1).strip()
        
        return updates
    
    @classmethod
    async def extract_from_conversation(cls, conversation_messages: List[Dict]) -> Dict[str, str]:
        """
        Extract all field updates from a conversation
        
        Args:
            conversation_messages: List of message objects
            
        Returns:
            Aggregated field updates
        """
        all_updates = {}
        
        for msg in conversation_messages:
            if msg.get("direction") == "incoming":
                updates = cls.parse_response(msg.get("message", ""))
                all_updates.update(updates)
        
        return all_updates



# =====================================================
# V2 — Edge-driven, branch-aware, suspendable executor
# =====================================================
import uuid as _uuid
from datetime import timedelta as _timedelta


def _render_tpl(tpl: str, lead: Dict[str, Any]) -> str:
    """Render placeholders {{lead.nome}}, {{lead.cognome}}, {{nome}} in templates."""
    if not tpl or not isinstance(tpl, str):
        return tpl or ""
    out = tpl
    for k, v in (lead or {}).items():
        if isinstance(v, (str, int, float)):
            out = out.replace(f"{{{{lead.{k}}}}}", str(v))
            out = out.replace(f"{{{{{k}}}}}", str(v))
    return out


def _normalize_branch(label: Optional[str]) -> Optional[str]:
    if not label:
        return None
    return str(label).strip().lower()


class WorkflowExecutorV2:
    """Edge-driven executor supporting branching and wait_for_reply suspension.

    Persistent state: collection `workflow_executions_v2` con documenti:
      { id, workflow_id, lead_id, status: running|waiting|done|failed,
        current_node_id, waiting_node_id, waiting_until (datetime), context,
        history: [{node_id, result, ts}], created_at, updated_at }
    """

    def __init__(self, db, spoki_service=None, chatbot_module=None, calendar_module=None):
        self.db = db
        self.spoki = spoki_service
        self.chatbot = chatbot_module  # spoki_chatbot module
        self.cal = calendar_module     # spoki_chatbot module (find_next_free_slot)

    async def start(self, workflow_id: str, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        wf = await self.db.workflows.find_one({"id": workflow_id}, {"_id": 0})
        if not wf:
            return {"success": False, "error": "workflow not found"}
        nodes = wf.get("nodes", []) or []
        edges = wf.get("edges", []) or []
        trigger_nodes = [n for n in nodes if (n.get("data") or {}).get("nodeType") == "triggers"]
        if not trigger_nodes:
            return {"success": False, "error": "no trigger node"}
        # Pick the first trigger (in future: filter by trigger subtype)
        start_node = trigger_nodes[0]

        exec_doc = {
            "id": str(_uuid.uuid4()),
            "workflow_id": workflow_id,
            "lead_id": trigger_data.get("lead_id") or (trigger_data.get("lead") or {}).get("id"),
            "status": "running",
            "current_node_id": start_node["id"],
            "waiting_node_id": None,
            "waiting_until": None,
            "context": {"trigger": trigger_data, "lead": trigger_data.get("lead") or {}},
            "history": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await self.db.workflow_executions_v2.insert_one(exec_doc)
        return await self._run_loop(exec_doc, nodes, edges)

    async def resume_on_reply(self, lead_id: str, reply_text: str) -> List[Dict[str, Any]]:
        """Trova tutte le esecuzioni in attesa di risposta per il lead e le riprende sul ramo 'reply'."""
        results = []
        async for ex in self.db.workflow_executions_v2.find({"lead_id": lead_id, "status": "waiting"}):
            wf = await self.db.workflows.find_one({"id": ex["workflow_id"]}, {"_id": 0})
            if not wf:
                continue
            ex.pop("_id", None)
            ex["context"]["last_reply"] = reply_text
            res = await self._continue_from_waiting(ex, wf.get("nodes", []), wf.get("edges", []), branch="reply")
            results.append(res)
        return results

    async def process_timeouts(self) -> int:
        """Da chiamare ogni minuto: riprende esecuzioni il cui timeout è scaduto sul ramo 'timeout'."""
        now = datetime.now(timezone.utc)
        count = 0
        async for ex in self.db.workflow_executions_v2.find({
            "status": "waiting",
            "waiting_until": {"$ne": None, "$lte": now},
        }):
            wf = await self.db.workflows.find_one({"id": ex["workflow_id"]}, {"_id": 0})
            if not wf:
                continue
            ex.pop("_id", None)
            await self._continue_from_waiting(ex, wf.get("nodes", []), wf.get("edges", []), branch="timeout")
            count += 1
        return count

    async def _continue_from_waiting(self, ex: Dict, nodes: List[Dict], edges: List[Dict], branch: str) -> Dict:
        wait_node_id = ex.get("waiting_node_id") or ex.get("current_node_id")
        next_id = self._next_node(wait_node_id, edges, branch=branch)
        ex["current_node_id"] = next_id
        ex["waiting_node_id"] = None
        ex["waiting_until"] = None
        ex["status"] = "running" if next_id else "done"
        await self.db.workflow_executions_v2.update_one({"id": ex["id"]}, {"$set": {
            "current_node_id": next_id, "waiting_node_id": None, "waiting_until": None,
            "status": ex["status"], "updated_at": datetime.now(timezone.utc),
            "context": ex["context"],
        }})
        if not next_id:
            return {"success": True, "status": "done"}
        return await self._run_loop(ex, nodes, edges)

    def _next_node(self, current_id: str, edges: List[Dict], branch: Optional[str] = None) -> Optional[str]:
        candidates = [e for e in edges if e.get("source") == current_id]
        if branch:
            with_label = [e for e in candidates if _normalize_branch(e.get("sourceHandle") or e.get("data", {}).get("branch")) == _normalize_branch(branch)]
            if with_label:
                return with_label[0]["target"]
        if candidates:
            return candidates[0]["target"]
        return None

    async def _run_loop(self, ex: Dict, nodes: List[Dict], edges: List[Dict]) -> Dict:
        max_steps = 50
        steps = 0
        while ex["current_node_id"] and steps < max_steps:
            steps += 1
            node = next((n for n in nodes if n["id"] == ex["current_node_id"]), None)
            if not node:
                ex["status"] = "failed"
                break
            res = await self._exec_node_v2(node, ex)
            ex.setdefault("history", []).append({
                "node_id": node["id"], "result": _safe_result(res), "ts": datetime.now(timezone.utc).isoformat(),
            })
            if res.get("suspend"):
                ex["status"] = "waiting"
                ex["waiting_node_id"] = node["id"]
                ex["waiting_until"] = res.get("waiting_until")
                await self.db.workflow_executions_v2.update_one({"id": ex["id"]}, {"$set": {
                    "status": "waiting", "waiting_node_id": node["id"], "waiting_until": res.get("waiting_until"),
                    "context": ex["context"], "history": ex["history"][-30:],
                    "updated_at": datetime.now(timezone.utc),
                }})
                return {"success": True, "status": "waiting", "execution_id": ex["id"]}
            branch = res.get("branch")
            goto = res.get("goto_node_id")
            if goto:
                next_id = goto
            else:
                next_id = self._next_node(node["id"], edges, branch=branch)
            ex["current_node_id"] = next_id
            await self.db.workflow_executions_v2.update_one({"id": ex["id"]}, {"$set": {
                "current_node_id": next_id, "context": ex["context"],
                "history": ex["history"][-30:], "updated_at": datetime.now(timezone.utc),
            }})
            if res.get("stop"):
                break
        ex["status"] = "done" if not ex["current_node_id"] else ex["status"]
        await self.db.workflow_executions_v2.update_one({"id": ex["id"]}, {"$set": {
            "status": ex["status"], "updated_at": datetime.now(timezone.utc),
        }})
        return {"success": True, "status": ex["status"], "execution_id": ex["id"]}

    async def _exec_node_v2(self, node: Dict, ex: Dict) -> Dict[str, Any]:
        data = node.get("data") or {}
        ntype = data.get("nodeType")
        sub = data.get("nodeSubtype")
        cfg = data.get("config") or {}
        ctx = ex.get("context") or {}
        lead = ctx.get("lead") or {}

        if ntype == "triggers":
            return {"success": True}

        if ntype == "delay":
            if sub == "wait_for_reply":
                hours = float(cfg.get("timeout_hours") or 12)
                until = datetime.now(timezone.utc) + _timedelta(hours=hours)
                return {"suspend": True, "waiting_until": until}
            if sub == "wait":
                # esecuzione bloccante semplice (no-op): per durate brevi
                val = float(cfg.get("duration_value") or 0)
                unit = cfg.get("duration_unit") or "hours"
                delta_h = val * (1 if unit == "hours" else (1/60 if unit == "minutes" else 24))
                until = datetime.now(timezone.utc) + _timedelta(hours=delta_h)
                return {"suspend": True, "waiting_until": until}
            return {"success": True}

        if ntype == "conditions":
            if sub == "check_positive_response":
                reply = (ctx.get("last_reply") or "").lower()
                positive = any(w in reply for w in ["si", "sì", "ok", "certo", "yes", "interess", "vorrei"])
                return {"success": True, "branch": "yes" if positive else "no"}
            if sub == "working_hours":
                unit_id = lead.get("commessa_id") or lead.get("unit_id")
                ok = await self._is_in_working_hours(unit_id) if unit_id else True
                return {"success": True, "branch": "yes" if ok else "no"}
            if sub == "if_else":
                # Confronto generico: cfg.field, cfg.op, cfg.value
                field = cfg.get("field") or "trigger.lead.nome"
                op = (cfg.get("op") or "equals").lower()
                value = cfg.get("value")
                actual = _resolve_path(ctx, field)
                result = _compare(actual, op, value)
                return {"success": True, "branch": "yes" if result else "no"}
            if sub == "match_value":
                # Multi-branch: cfg.field, cfg.cases:[{value,label}], cfg.default_label
                field = cfg.get("field") or ""
                actual = _resolve_path(ctx, field)
                cases_raw = cfg.get("cases")
                try:
                    import json as _json
                    cases = _json.loads(cases_raw) if isinstance(cases_raw, str) else (cases_raw or [])
                except Exception:
                    cases = []
                for c in cases:
                    if str(actual or "").lower() == str(c.get("value", "")).lower():
                        return {"success": True, "branch": c.get("label") or str(c.get("value"))}
                return {"success": True, "branch": cfg.get("default_label") or "default"}
            return {"success": True}

        if ntype == "actions":
            if sub == "send_spoki_template" and self.spoki:
                tpl = cfg.get("template_name")
                lang = cfg.get("language") or "it"
                try:
                    vars_raw = cfg.get("variables")
                    import json as _json
                    variables = _json.loads(vars_raw) if vars_raw and isinstance(vars_raw, str) else (vars_raw or {})
                except Exception:
                    variables = {}
                variables = {k: _render_tpl(str(v), lead) for k, v in (variables or {}).items()}
                if not variables.get("nome"):
                    variables["nome"] = lead.get("nome") or "Cliente"
                if ctx.get("test_mode"):
                    await self._log_spoki_msg(lead, "outbound", template_name=tpl, vars=variables, body=None, status="test_skipped", sender="system")
                    return {"success": True, "test_mode": True}
                try:
                    res = await self.spoki.send_template_message(
                        to=lead.get("telefono") or "", template_name=tpl, language=lang, variables=variables,
                    )
                    await self._log_spoki_msg(lead, "outbound", template_name=tpl, vars=variables, body=None, status=res.get("status") or "sent", sender="system", spoki_id=res.get("uuid") or res.get("id") or res.get("message_id"))
                    return {"success": True}
                except Exception as e:
                    await self._log_spoki_msg(lead, "outbound", template_name=tpl, vars=variables, body=None, status="failed", sender="system", error=str(e)[:300])
                    return {"success": False, "error": str(e)}

            if sub == "send_spoki_message" and self.spoki:
                body = _render_tpl(cfg.get("body") or "", lead)
                if ctx.get("test_mode"):
                    await self._log_spoki_msg(lead, "outbound", body=body, status="test_skipped", sender="system")
                    return {"success": True, "test_mode": True}
                try:
                    res = await self.spoki.send_session_message(to=lead.get("telefono") or "", body=body)
                    await self._log_spoki_msg(lead, "outbound", body=body, status=res.get("status") or "sent", sender="system", spoki_id=res.get("uuid") or res.get("id") or res.get("message_id"))
                    return {"success": True}
                except Exception as e:
                    await self._log_spoki_msg(lead, "outbound", body=body, status="failed", sender="system", error=str(e)[:300])
                    return {"success": False, "error": str(e)}

            if sub == "activate_chatbot":
                lead_id = lead.get("id")
                if not lead_id:
                    return {"success": False, "error": "lead mancante"}
                unit_id = lead.get("commessa_id") or lead.get("unit_id")
                await self.db.lead_chatbot_sessions.update_one(
                    {"lead_id": lead_id},
                    {"$set": {"status": "active", "activated_by_workflow": True, "unit_id": unit_id,
                              "updated_at": datetime.now(timezone.utc)},
                     "$setOnInsert": {"id": str(_uuid.uuid4()), "lead_id": lead_id, "messages": [],
                                      "qualification_score": 0, "created_at": datetime.now(timezone.utc)}},
                    upsert=True,
                )
                first_msg = _render_tpl(cfg.get("first_message") or "", lead)
                if first_msg:
                    if ctx.get("test_mode"):
                        await self._log_spoki_msg(lead, "outbound", body=first_msg, status="test_skipped", sender="bot")
                    elif self.spoki and lead.get("telefono"):
                        try:
                            res = await self.spoki.send_session_message(to=lead["telefono"], body=first_msg)
                            await self._log_spoki_msg(lead, "outbound", body=first_msg, status=res.get("status") or "sent", sender="bot")
                        except Exception as e:
                            await self._log_spoki_msg(lead, "outbound", body=first_msg, status="failed", sender="bot", error=str(e)[:300])
                return {"success": True}

            if sub == "run_chatbot" and self.chatbot:
                user_message = ctx.get("last_reply") or ""
                if not user_message:
                    return {"success": True, "skipped": True}
                lead_id = lead.get("id")
                # storia da chatbot session
                session = await self.db.lead_chatbot_sessions.find_one({"lead_id": lead_id}, {"_id": 0}) or {"messages": []}
                if session.get("bot_paused"):
                    return {"success": True, "skipped": True, "reason": "bot_paused"}
                history = session.get("messages") or []
                slot_hint = None
                unit_id = lead.get("commessa_id")
                if unit_id and self.cal:
                    slot = await self.cal.find_next_free_slot(self.db, unit_id)
                    if slot:
                        slot_hint = f"{slot['weekday']} {slot['date']} alle {slot['time']}"
                unit_cfg = await self.db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0}) if unit_id else None
                reply = await self.chatbot.generate_unit_reply(
                    self.db, lead_id, unit_cfg, user_message, history,
                    system_prompt=(unit_cfg or {}).get("chatbot_system_prompt"),
                    next_free_slot_hint=slot_hint,
                )
                bot_text = (reply.get("reply") or "").strip() or "Grazie!"
                history.append({"role": "user", "content": user_message, "ts": datetime.now(timezone.utc).isoformat()})
                history.append({"role": "assistant", "content": bot_text, "ts": datetime.now(timezone.utc).isoformat()})
                await self.db.lead_chatbot_sessions.update_one(
                    {"lead_id": lead_id},
                    {"$set": {"messages": history[-50:], "intent_detected": reply.get("intent"),
                              "qualification_score": int(reply.get("qualification_score") or 0),
                              "activated_by_workflow": True,
                              "updated_at": datetime.now(timezone.utc)},
                     "$setOnInsert": {"lead_id": lead_id, "created_at": datetime.now(timezone.utc), "status": "active"}},
                    upsert=True,
                )
                if cfg.get("auto_send_reply", True) and self.spoki and lead.get("telefono"):
                    try:
                        res = await self.spoki.send_session_message(to=lead["telefono"], body=bot_text)
                        await self._log_spoki_msg(lead, "outbound", body=bot_text, status=res.get("status") or "sent", sender="bot")
                    except Exception as e:
                        await self._log_spoki_msg(lead, "outbound", body=bot_text, status="failed", sender="bot", error=str(e)[:300])
                ctx["chatbot_last_reply"] = reply
                # branch in base a intent: 'ready_to_book' → branch 'book', altrimenti continua
                if reply.get("ready_to_book"):
                    return {"success": True, "branch": "book"}
                return {"success": True}

            if sub == "create_appointment" and self.cal:
                unit_id = lead.get("commessa_id")
                duration = int(cfg.get("duration_minutes") or 30)
                slot = await self.cal.find_next_free_slot(self.db, unit_id, duration_min=duration) if unit_id else None
                if not slot:
                    return {"success": False, "error": "Nessuno slot disponibile"}
                appt_id = str(_uuid.uuid4())
                await self.db.appointments.insert_one({
                    "id": appt_id, "unit_id": unit_id, "lead_id": lead.get("id"),
                    "contact_phone": lead.get("telefono"), "contact_name": lead.get("nome"),
                    "appointment_date": slot["date"], "appointment_time": slot["time"],
                    "duration_minutes": slot["duration_minutes"], "status": "pending",
                    "booked_via": "workflow", "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                })
                ctx["last_appointment"] = {"id": appt_id, **slot}
                return {"success": True}

            if sub == "add_tag":
                tag = cfg.get("tag")
                if tag and lead.get("id"):
                    await self.db.leads.update_one({"id": lead["id"]}, {"$addToSet": {"tags": tag}})
                return {"success": True}

            if sub == "remove_tag":
                tag = cfg.get("tag")
                if tag and lead.get("id"):
                    await self.db.leads.update_one({"id": lead["id"]}, {"$pull": {"tags": tag}})
                return {"success": True}

            if sub == "go_to":
                target = cfg.get("target_node_id")
                if target:
                    return {"success": True, "goto_node_id": target}
                return {"success": True}

            if sub == "set_status":
                new_status = cfg.get("status")
                if new_status and lead.get("id"):
                    await self.db.leads.update_one({"id": lead["id"]}, {"$set": {"status": new_status}})
                return {"success": True}

            if sub == "assign_to_user":
                uid = cfg.get("user_id") or (cfg.get("user_ids") or [None])[0]
                if uid and lead.get("id"):
                    await self.db.leads.update_one({"id": lead["id"]}, {"$set": {"assigned_agent_id": uid}})
                return {"success": True}

        # fallback: pass-through
        return {"success": True, "skipped": True}

    async def _is_in_working_hours(self, unit_id: str) -> bool:
        cfg = await self.db.unit_calendar_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        if not cfg:
            return True
        wh = cfg.get("working_hours") or []
        now = datetime.now(timezone.utc)
        weekday = now.weekday()
        cur = now.strftime("%H:%M")
        for h in wh:
            if h.get("weekday") == weekday and h.get("start_time") <= cur <= h.get("end_time"):
                return True
        return False

    async def _log_spoki_msg(self, lead, direction, body=None, template_name=None, vars=None, status=None, sender="system", error=None, spoki_id=None):
        await self.db.spoki_messages.insert_one({
            "id": str(_uuid.uuid4()),
            "unit_id": lead.get("commessa_id"), "lead_id": lead.get("id"),
            "direction": direction, "phone_number": lead.get("telefono") or "",
            "body": body, "template_name": template_name, "template_variables": vars,
            "status": status, "sender": sender, "error": error,
            "spoki_message_id": spoki_id, "created_at": datetime.now(timezone.utc),
        })


def _safe_result(r):
    try:
        return {k: v for k, v in (r or {}).items() if isinstance(v, (str, int, float, bool, dict, list)) and k != "waiting_until"}
    except Exception:
        return {}


def _resolve_path(ctx, path):
    cur = ctx
    for part in (path or "").split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def _compare(actual, op, value):
    try:
        if op in ("equals", "eq", "=="):
            return str(actual) == str(value)
        if op in ("not_equals", "ne", "!="):
            return str(actual) != str(value)
        if op in ("contains",):
            return str(value).lower() in str(actual or "").lower()
        if op in ("starts_with",):
            return str(actual or "").lower().startswith(str(value).lower())
        if op in ("greater_than", "gt", ">"):
            return float(actual) > float(value)
        if op in ("less_than", "lt", "<"):
            return float(actual) < float(value)
    except Exception:
        return False
    return False
