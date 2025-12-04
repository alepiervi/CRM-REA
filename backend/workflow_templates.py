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


def get_available_templates() -> list:
    """
    Returns list of available workflow templates
    
    Returns:
        List of template metadata
    """
    return [
        {
            "id": "lead_qualification_ai",
            "name": "Lead Qualification AI",
            "description": "Workflow completo per qualificare lead con AI Assistant via WhatsApp",
            "trigger": "lead_created",
            "nodes_count": 6,
            "features": [
                "Auto-assegnazione a Unit",
                "Messaggio WhatsApp benvenuto",
                "Verifica risposta positiva",
                "Conversazione AI Assistant",
                "Aggiornamento automatico campi"
            ]
        }
    ]
