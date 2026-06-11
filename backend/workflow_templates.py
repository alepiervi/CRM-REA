"""
Workflow Templates - Pre-configured workflows for common scenarios
"""
from datetime import datetime, timezone
from typing import Dict, Any
import uuid


def get_lead_qualification_template(unit_id: str) -> Dict[str, Any]:
    """
    Creates a pre-configured workflow template for Lead Qualification with AI
    
    Workflow Flow (NOTA: Agente già assegnato e WhatsApp già inviato dal webhook):
    1. Lead Created (Trigger) - Lead già assegnato ad agente + WhatsApp benvenuto già inviato
    2. Wait for Response - Attende risposta del lead
    3. Check Positive Response - Verifica se risposta è positiva
    4. Start AI Assistant - Avvia conversazione AI
    5. Update Lead Fields - Aggiorna campi lead da conversazione AI
    
    Args:
        unit_id: ID of the unit to assign this workflow to
        
    Returns:
        Complete workflow configuration ready to be saved
    """
    
    workflow_id = str(uuid.uuid4())
    
    # Define nodes
    nodes = [
        # TRIGGER: Lead Created (già assegnato ad agente + WhatsApp inviato)
        {
            "id": "trigger_lead_created",
            "type": "default",
            "position": {"x": 250, "y": 50},
            "data": {
                "label": "Lead Creato e Assegnato",
                "nodeType": "triggers",
                "nodeSubtype": "lead_created",
                "config": {
                    "name": "Lead Creato",
                    "description": "Lead già assegnato ad agente e WhatsApp benvenuto inviato",
                    "event": "lead_created"
                }
            },
            "style": {
                "background": "#22c55e",
                "color": "white",
                "border": "2px solid #16a34a",
                "borderRadius": "8px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "width": 200,
                "height": 50
            }
        },
        
        # ACTION 1: Wait for Response (Attendi Risposta)
        {
            "id": "action_wait_response",
            "type": "default",
            "position": {"x": 250, "y": 150},
            "data": {
                "label": "Attendi Risposta",
                "nodeType": "delays",
                "nodeSubtype": "wait",
                "config": {
                    "name": "Attendi Risposta WhatsApp",
                    "description": "Attende che il lead risponda al messaggio di benvenuto",
                    "wait_time": "5 minutes"
                }
            },
            "style": {
                "background": "#64748b",
                "color": "white",
                "border": "2px solid #475569",
                "borderRadius": "8px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "width": 200,
                "height": 50
            }
        },
        
        # CONDITION: Check Positive Response
        {
            "id": "condition_positive_response",
            "type": "default",
            "position": {"x": 250, "y": 250},
            "data": {
                "label": "Risposta Positiva?",
                "nodeType": "conditions",
                "nodeSubtype": "check_positive_response",
                "config": {
                    "name": "Verifica Risposta Positiva",
                    "description": "Controlla se il lead ha risposto SI/OK/CERTO",
                    "positive_keywords": ["si", "ok", "certo", "va bene", "yes", "perfetto"]
                }
            },
            "style": {
                "background": "#a855f7",
                "color": "white",
                "border": "2px solid #9333ea",
                "borderRadius": "8px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "width": 200,
                "height": 50
            }
        },
        
        # ACTION 2: Start AI Conversation
        {
            "id": "action_start_ai",
            "type": "default",
            "position": {"x": 250, "y": 350},
            "data": {
                "label": "Avvia AI Assistant",
                "nodeType": "actions",
                "nodeSubtype": "start_ai_conversation",
                "config": {
                    "name": "Avvia AI Assistant",
                    "description": "Inizia conversazione AI per qualificare lead"
                }
            },
            "style": {
                "background": "#3b82f6",
                "color": "white",
                "border": "2px solid #2563eb",
                "borderRadius": "8px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "width": 200,
                "height": 50
            }
        },
        
        # ACTION 3: Update Lead Fields
        {
            "id": "action_update_lead",
            "type": "default",
            "position": {"x": 250, "y": 450},
            "data": {
                "label": "Aggiorna Anagrafica",
                "nodeType": "actions",
                "nodeSubtype": "update_lead_field",
                "config": {
                    "name": "Aggiorna Campi Lead",
                    "description": "Estrae info da AI e aggiorna campi lead"
                }
            },
            "style": {
                "background": "#3b82f6",
                "color": "white",
                "border": "2px solid #2563eb",
                "borderRadius": "8px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "width": 200,
                "height": 50
            }
        }
    ]
    
    # Define edges (connections) - Nuovo flusso senza "Assegna a Unit"
    edges = [
        {
            "id": "edge_1",
            "source": "trigger_lead_created",
            "target": "action_wait_response",
            "type": "smoothstep",
            "animated": True
        },
        {
            "id": "edge_2",
            "source": "action_wait_response",
            "target": "condition_positive_response",
            "type": "smoothstep",
            "animated": True
        },
        {
            "id": "edge_3",
            "source": "condition_positive_response",
            "target": "action_start_ai",
            "type": "smoothstep",
            "animated": True,
            "label": "SI",
            "style": {"stroke": "#22c55e", "strokeWidth": 2}
        },
        {
            "id": "edge_4",
            "source": "action_start_ai",
            "target": "action_update_lead",
            "type": "smoothstep",
            "animated": True
        }
    ]
    
    # Create complete workflow
    workflow = {
        "id": workflow_id,
        "name": "Lead Qualification AI - Template",
        "description": "Workflow automatico per qualificare lead con AI Assistant e WhatsApp",
        "unit_id": unit_id,
        "trigger_type": "lead_created",
        "is_active": False,  # Inactive by default - user must activate
        "is_published": False,
        "nodes": nodes,
        "edges": edges,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "metadata": {
            "template": True,
            "template_name": "lead_qualification_ai",
            "template_version": "1.0"
        }
    }
    
    return workflow


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def get_spoki_welcome_template(unit_id: str) -> Dict[str, Any]:
    """Welcome WhatsApp via Spoki + Wait + Chatbot AI + Appointment."""
    nodes = [
        {
            "id": "t_lead_created",
            "type": "default",
            "position": {"x": 350, "y": 30},
            "data": {"label": "Lead Creato", "nodeType": "triggers", "nodeSubtype": "lead_created", "config": {}},
            "style": {"background": "#22c55e", "color": "white", "border": "2px solid #16a34a", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_welcome",
            "type": "default",
            "position": {"x": 350, "y": 120},
            "data": {"label": "Spoki: Invia Welcome", "nodeType": "actions", "nodeSubtype": "send_spoki_template",
                     "config": {"template_name": "benvenuto", "language": "it", "variables": '{"nome":"{{lead.nome}}"}'}},
            "style": {"background": "#10b981", "color": "white", "border": "2px solid #059669", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "d_wait_reply",
            "type": "default",
            "position": {"x": 350, "y": 210},
            "data": {"label": "Attendi Risposta 12h", "nodeType": "delay", "nodeSubtype": "wait_for_reply",
                     "config": {"timeout_hours": 12}},
            "style": {"background": "#6366f1", "color": "white", "border": "2px solid #4f46e5", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_chatbot",
            "type": "default",
            "position": {"x": 200, "y": 320},
            "data": {"label": "Chatbot AI", "nodeType": "actions", "nodeSubtype": "run_chatbot",
                     "config": {"auto_send_reply": True}},
            "style": {"background": "#6366f1", "color": "white", "border": "2px solid #4f46e5", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_tag_nonrisponde",
            "type": "default",
            "position": {"x": 500, "y": 320},
            "data": {"label": "Tag: mai_risposto", "nodeType": "actions", "nodeSubtype": "add_tag",
                     "config": {"tag": "mai_risposto"}},
            "style": {"background": "#10b981", "color": "white", "border": "2px solid #059669", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_appointment",
            "type": "default",
            "position": {"x": 200, "y": 420},
            "data": {"label": "Crea Appuntamento", "nodeType": "actions", "nodeSubtype": "create_appointment",
                     "config": {"duration_minutes": 30, "auto_propose_slot": True}},
            "style": {"background": "#8b5cf6", "color": "white", "border": "2px solid #7c3aed", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
    ]
    edges = [
        {"id": "e1", "source": "t_lead_created", "target": "a_welcome", "type": "smoothstep", "animated": True},
        {"id": "e2", "source": "a_welcome", "target": "d_wait_reply", "type": "smoothstep", "animated": True},
        {"id": "e3", "source": "d_wait_reply", "target": "a_chatbot", "sourceHandle": "reply", "type": "smoothstep", "label": "Risposta", "animated": True},
        {"id": "e4", "source": "d_wait_reply", "target": "a_tag_nonrisponde", "sourceHandle": "timeout", "type": "smoothstep", "label": "Timeout", "animated": True},
        {"id": "e5", "source": "a_chatbot", "target": "a_appointment", "sourceHandle": "book", "type": "smoothstep", "label": "Prenota", "animated": True},
    ]
    return {
        "id": str(uuid.uuid4()), "name": "Spoki Welcome + Chatbot + Appuntamento",
        "description": "Lead → Welcome WhatsApp → Wait 12h → Chatbot AI → Appuntamento (o tag mai_risposto su timeout)",
        "unit_id": unit_id, "trigger_type": "lead_created",
        "is_active": False, "is_published": False, "nodes": nodes, "edges": edges,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(), "version": 1,
        "metadata": {"template": True, "template_name": "spoki_welcome_chatbot_appointment", "template_version": "1.0"},
    }


def get_spoki_reminder_template(unit_id: str) -> Dict[str, Any]:
    """Reminder appuntamento il giorno prima."""
    nodes = [
        {
            "id": "t_lead",
            "type": "default", "position": {"x": 300, "y": 30},
            "data": {"label": "Lead Creato", "nodeType": "triggers", "nodeSubtype": "lead_created", "config": {}},
            "style": {"background": "#22c55e", "color": "white", "border": "2px solid #16a34a", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "d_wait_24h",
            "type": "default", "position": {"x": 300, "y": 130},
            "data": {"label": "Wait 24h", "nodeType": "delay", "nodeSubtype": "wait",
                     "config": {"duration_value": 24, "duration_unit": "hours"}},
            "style": {"background": "#9ca3af", "color": "white", "border": "2px solid #6b7280", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_reminder",
            "type": "default", "position": {"x": 300, "y": 230},
            "data": {"label": "Reminder WhatsApp", "nodeType": "actions", "nodeSubtype": "send_spoki_message",
                     "config": {"body": "Ciao {{lead.nome}}! Ti ricordiamo il tuo appuntamento di domani."}},
            "style": {"background": "#10b981", "color": "white", "border": "2px solid #059669", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
    ]
    edges = [
        {"id": "e1", "source": "t_lead", "target": "d_wait_24h", "type": "smoothstep", "animated": True},
        {"id": "e2", "source": "d_wait_24h", "target": "a_reminder", "type": "smoothstep", "animated": True},
    ]
    return {
        "id": str(uuid.uuid4()), "name": "Reminder Appuntamento 24h",
        "description": "Manda reminder WhatsApp dopo 24h dalla creazione lead",
        "unit_id": unit_id, "trigger_type": "lead_created",
        "is_active": False, "is_published": False, "nodes": nodes, "edges": edges,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(), "version": 1,
        "metadata": {"template": True, "template_name": "spoki_reminder_24h", "template_version": "1.0"},
    }


def get_lead_routing_template(unit_id: str) -> Dict[str, Any]:
    """Routing multi-sorgente: tagga il lead in base al campo sorgente."""
    nodes = [
        {
            "id": "t_lead", "type": "default", "position": {"x": 300, "y": 30},
            "data": {"label": "Lead Creato", "nodeType": "triggers", "nodeSubtype": "lead_created", "config": {}},
            "style": {"background": "#22c55e", "color": "white", "border": "2px solid #16a34a", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "c_match", "type": "default", "position": {"x": 300, "y": 130},
            "data": {"label": "Switch Sorgente", "nodeType": "conditions", "nodeSubtype": "match_value",
                     "config": {"field": "trigger.lead.source",
                                "cases": '[{"value":"sito","label":"sito_web"},{"value":"meta","label":"facebook"},{"value":"edison","label":"edison"}]',
                                "default_label": "default"}},
            "style": {"background": "#d946ef", "color": "white", "border": "2px solid #c026d3", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_tag_sito", "type": "default", "position": {"x": 80, "y": 250},
            "data": {"label": "Tag: sorgente_sito", "nodeType": "actions", "nodeSubtype": "add_tag",
                     "config": {"tag": "sorgente_sito_web"}},
            "style": {"background": "#10b981", "color": "white", "border": "2px solid #059669", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_tag_meta", "type": "default", "position": {"x": 310, "y": 250},
            "data": {"label": "Tag: facebook", "nodeType": "actions", "nodeSubtype": "add_tag",
                     "config": {"tag": "sorgente_facebook"}},
            "style": {"background": "#10b981", "color": "white", "border": "2px solid #059669", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
        {
            "id": "a_tag_edison", "type": "default", "position": {"x": 540, "y": 250},
            "data": {"label": "Tag: edison", "nodeType": "actions", "nodeSubtype": "add_tag",
                     "config": {"tag": "sorgente_edison"}},
            "style": {"background": "#10b981", "color": "white", "border": "2px solid #059669", "borderRadius": "8px", "fontSize": "12px", "fontWeight": "bold", "width": 180, "height": 40},
        },
    ]
    edges = [
        {"id": "e1", "source": "t_lead", "target": "c_match", "type": "smoothstep", "animated": True},
        {"id": "e2", "source": "c_match", "target": "a_tag_sito", "sourceHandle": "sito_web", "type": "smoothstep", "label": "Sito", "animated": True},
        {"id": "e3", "source": "c_match", "target": "a_tag_meta", "sourceHandle": "facebook", "type": "smoothstep", "label": "Meta", "animated": True},
        {"id": "e4", "source": "c_match", "target": "a_tag_edison", "sourceHandle": "edison", "type": "smoothstep", "label": "Edison", "animated": True},
    ]
    return {
        "id": str(uuid.uuid4()), "name": "Lead Routing per Sorgente",
        "description": "Smista i lead in entrata e aggiunge tag in base a trigger.lead.source",
        "unit_id": unit_id, "trigger_type": "lead_created",
        "is_active": False, "is_published": False, "nodes": nodes, "edges": edges,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(), "version": 1,
        "metadata": {"template": True, "template_name": "lead_routing_source", "template_version": "1.0"},
    }


# Mappa template_id → (function, metadata)
TEMPLATE_REGISTRY = {
    "lead_qualification_ai": None,  # gestito dalla funzione separata sopra
    "spoki_welcome_chatbot_appointment": get_spoki_welcome_template,
    "spoki_reminder_24h": get_spoki_reminder_template,
    "lead_routing_source": get_lead_routing_template,
}


def get_available_templates() -> list:
    """
    Returns list of available workflow templates with parameter schemas
    """
    return [
        {
            "id": "lead_qualification_ai",
            "name": "Lead Qualification AI",
            "description": "Workflow completo per qualificare lead con AI Assistant via WhatsApp",
            "trigger": "lead_created", "nodes_count": 6, "icon": "bot", "color": "indigo",
            "features": [
                "Auto-assegnazione a Unit", "Messaggio WhatsApp benvenuto",
                "Verifica risposta positiva", "Conversazione AI Assistant",
                "Aggiornamento automatico campi",
            ],
            "parameters": [],
        },
        {
            "id": "spoki_welcome_chatbot_appointment",
            "name": "Spoki Welcome + Chatbot + Appuntamento",
            "description": "Lead → Welcome WhatsApp → Wait 12h → Chatbot AI → Appuntamento",
            "trigger": "lead_created", "nodes_count": 6, "icon": "message-circle", "color": "green",
            "features": [
                "Template welcome Spoki con {{nome}}",
                "Attesa risposta 12h con timeout",
                "Chatbot OpenAI gpt-4o-mini",
                "Creazione appuntamento automatica su slot libero",
                "Tag 'mai_risposto' su timeout",
            ],
            "parameters": [
                {"key": "welcome_template_name", "label": "Nome template Spoki di benvenuto", "type": "text", "default": "benvenuto", "applies_to": {"node_id": "a_welcome", "config_field": "template_name"}},
                {"key": "welcome_language", "label": "Lingua template", "type": "text", "default": "it", "applies_to": {"node_id": "a_welcome", "config_field": "language"}},
                {"key": "timeout_hours", "label": "Timeout attesa risposta (ore)", "type": "number", "default": 12, "applies_to": {"node_id": "d_wait_reply", "config_field": "timeout_hours"}},
                {"key": "timeout_tag", "label": "Tag su timeout", "type": "text", "default": "mai_risposto", "applies_to": {"node_id": "a_tag_nonrisponde", "config_field": "tag"}},
                {"key": "appointment_duration", "label": "Durata appuntamento (minuti)", "type": "number", "default": 30, "applies_to": {"node_id": "a_appointment", "config_field": "duration_minutes"}},
            ],
        },
        {
            "id": "spoki_reminder_24h",
            "name": "Reminder 24h",
            "description": "Manda un reminder WhatsApp dopo 24h dalla creazione lead",
            "trigger": "lead_created", "nodes_count": 3, "icon": "clock", "color": "amber",
            "features": ["Wait 24h", "Reminder testuale Spoki", "Setup in 30 secondi"],
            "parameters": [
                {"key": "wait_hours", "label": "Ore di attesa prima del reminder", "type": "number", "default": 24, "applies_to": {"node_id": "d_wait_24h", "config_field": "duration_value"}},
                {"key": "reminder_body", "label": "Testo reminder ({{lead.nome}} supportato)", "type": "textarea", "default": "Ciao {{lead.nome}}! Ti ricordiamo il tuo appuntamento di domani.", "applies_to": {"node_id": "a_reminder", "config_field": "body"}},
            ],
        },
        {
            "id": "lead_routing_source",
            "name": "Lead Routing per Sorgente",
            "description": "Smista lead in entrata e aggiunge tag in base alla sorgente (sito/meta/edison)",
            "trigger": "lead_created", "nodes_count": 5, "icon": "split", "color": "fuchsia",
            "features": ["Switch multi-ramo su source", "Tag automatico per sorgente", "Estendibile con nuove sorgenti"],
            "parameters": [
                {"key": "source_field", "label": "Campo lead da valutare", "type": "text", "default": "trigger.lead.source", "applies_to": {"node_id": "c_match", "config_field": "field"}},
                {"key": "tag_sito", "label": "Tag se sorgente = sito", "type": "text", "default": "sorgente_sito_web", "applies_to": {"node_id": "a_tag_sito", "config_field": "tag"}},
                {"key": "tag_meta", "label": "Tag se sorgente = meta", "type": "text", "default": "sorgente_facebook", "applies_to": {"node_id": "a_tag_meta", "config_field": "tag"}},
                {"key": "tag_edison", "label": "Tag se sorgente = edison", "type": "text", "default": "sorgente_edison", "applies_to": {"node_id": "a_tag_edison", "config_field": "tag"}},
            ],
        },
    ]


def apply_template_overrides(workflow: dict, overrides: dict) -> dict:
    """Applica i parametri di personalizzazione al workflow appena generato.

    overrides è un dict {key: value} dove key corrisponde a parameters[*].key del template.
    Per ogni override troviamo applies_to.node_id e settiamo config[applies_to.config_field] = value.
    """
    if not overrides:
        return workflow
    templates = {t["id"]: t for t in get_available_templates()}
    tpl_name = (workflow.get("metadata") or {}).get("template_name")
    tpl = templates.get(tpl_name)
    if not tpl:
        return workflow
    params_by_key = {p["key"]: p for p in (tpl.get("parameters") or [])}
    for key, val in overrides.items():
        p = params_by_key.get(key)
        if not p or val is None or val == "":
            continue
        applies = p.get("applies_to") or {}
        target_node_id = applies.get("node_id")
        cfg_field = applies.get("config_field")
        if not target_node_id or not cfg_field:
            continue
        for n in workflow.get("nodes", []):
            if n.get("id") == target_node_id:
                cfg = n.setdefault("data", {}).setdefault("config", {})
                # Type-cast for number fields
                if p.get("type") == "number":
                    try:
                        val = float(val) if "." in str(val) else int(val)
                    except Exception:
                        pass
                cfg[cfg_field] = val
                break
    return workflow
