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
