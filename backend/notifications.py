"""Notifiche email (SMTP Aruba) e reminder lead (estratti da server.py - refactoring fase 3)."""
import asyncio
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from database import db
from models import *  # noqa: F401,F403

# Email System - Temporarily disabled due to import issues
# SMTP Configuration
SMTP_HOST = os.environ.get("SMTP_HOST", "smtps.aruba.it")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "CRM Notifiche")

async def send_email_notification(to_email: str, subject: str, body_html: str):
    """Send email notification via SMTP (Aruba)"""
    if not SMTP_USER or not SMTP_PASSWORD:
        logging.warning("[EMAIL] SMTP credentials not configured - email not sent")
        return False
    
    try:
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import ssl
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        
        # Attach HTML body
        html_part = MIMEText(body_html, 'html', 'utf-8')
        msg.attach(html_part)
        
        # Send via SMTP SSL
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        
        logging.info(f"[EMAIL] Email sent successfully to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logging.error(f"[EMAIL] Failed to send email to {to_email}: {str(e)}")
        return False

async def notify_agent_new_lead(agent_id: str, lead_data: dict):
    """Send email notification to agent about new lead assignment"""
    logging.info(f"[EMAIL] notify_agent_new_lead CALLED for agent_id={agent_id}, lead_id={lead_data.get('id')}")
    try:
        # Get agent info
        agent = await db.users.find_one({"id": agent_id})
        if not agent or not agent.get("email"):
            logging.warning(f"[EMAIL] Agent {agent_id} not found or has no email")
            return False
        
        agent_email = agent["email"]
        agent_name = agent.get("username", "Agente")
        
        # Lead info (senza dati sensibili)
        lead_name = f"{lead_data.get('nome', '')} {lead_data.get('cognome', '')}".strip() or "N/A"
        lead_provincia = lead_data.get('provincia', 'N/A')
        lead_campagna = lead_data.get('campagna', 'N/A')
        
        subject = f"🆕 Nuovo Lead Assegnato: {lead_name}"
        
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }}
                .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
                .lead-info {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }}
                .lead-info h3 {{ margin: 0 0 10px 0; color: #667eea; }}
                .info-row {{ margin: 8px 0; }}
                .label {{ font-weight: bold; color: #555; }}
                .footer {{ background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }}
                .cta-button {{ display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 15px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Nuovo Lead Assegnato</h1>
                </div>
                <div class="content">
                    <p>Ciao <strong>{agent_name}</strong>,</p>
                    <p>Ti è stato assegnato un nuovo lead da gestire:</p>
                    
                    <div class="lead-info">
                        <h3>📋 Dettagli Lead</h3>
                        <div class="info-row"><span class="label">Nome:</span> {lead_name}</div>
                        <div class="info-row"><span class="label">Provincia:</span> {lead_provincia}</div>
                        <div class="info-row"><span class="label">Campagna:</span> {lead_campagna}</div>
                    </div>
                    
                    <p>⏰ <strong>Ricorda:</strong> Accedi al CRM per visualizzare i dettagli completi e contattare il lead il prima possibile!</p>
                    
                    <center>
                        <a href="#" class="cta-button">Accedi al CRM</a>
                    </center>
                </div>
                <div class="footer">
                    <p>Questa è una notifica automatica dal sistema CRM.</p>
                    <p>© {datetime.now().year} Nureal - Tutti i diritti riservati</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        logging.info(f"[EMAIL] Attempting to send email to {agent_email} for lead {lead_data.get('id')}")
        result = await send_email_notification(agent_email, subject, body_html)
        logging.info(f"[EMAIL] send_email_notification result: {result}")
        
        if result:
            # Log the notification
            await db.lead_notifications.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": lead_data.get("id"),
                "agent_id": agent_id,
                "type": "new_lead_assignment",
                "sent_at": datetime.now(timezone.utc),
                "email": agent_email,
                "success": True
            })
        
        return result
        
    except Exception as e:
        logging.error(f"[EMAIL] Error in notify_agent_new_lead: {str(e)}")
        return False

async def send_lead_reminder_email(agent_id: str, lead_data: dict, days_unworked: int):
    """Send reminder email for unworked leads (3 days or 7 days)"""
    try:
        # Get agent info
        agent = await db.users.find_one({"id": agent_id})
        if not agent or not agent.get("email"):
            logging.warning(f"[EMAIL] Agent {agent_id} not found or has no email for reminder")
            return False
        
        agent_email = agent["email"]
        agent_name = agent.get("username", "Agente")
        
        # Lead info (senza dati sensibili)
        lead_id = lead_data.get("id")
        lead_name = f"{lead_data.get('nome', '')} {lead_data.get('cognome', '')}".strip() or "N/A"
        lead_provincia = lead_data.get('provincia', 'N/A')
        assigned_at = lead_data.get('assigned_at')
        
        if isinstance(assigned_at, str):
            assigned_at_str = assigned_at[:10]
        elif assigned_at:
            assigned_at_str = assigned_at.strftime("%d/%m/%Y")
        else:
            assigned_at_str = "N/A"
        
        # Different urgency levels
        if days_unworked >= 7:
            urgency_color = "#dc2626"  # Red
            urgency_text = "URGENTE"
            urgency_emoji = "🚨"
            subject = f"🚨 URGENTE: Lead non gestito da 7+ giorni - {lead_name}"
        else:
            urgency_color = "#f59e0b"  # Orange
            urgency_text = "PROMEMORIA"
            urgency_emoji = "⏰"
            subject = f"⏰ Promemoria: Lead da gestire - {lead_name}"
        
        # Email body per l'agente
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: {urgency_color}; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }}
                .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
                .lead-info {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid {urgency_color}; }}
                .lead-info h3 {{ margin: 0 0 10px 0; color: {urgency_color}; }}
                .info-row {{ margin: 8px 0; }}
                .label {{ font-weight: bold; color: #555; }}
                .warning-box {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                .urgent-box {{ background: #fee2e2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                .footer {{ background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }}
                .cta-button {{ display: inline-block; background: {urgency_color}; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 15px; }}
                .days-badge {{ display: inline-block; background: {urgency_color}; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{urgency_emoji} {urgency_text}</h1>
                    <p>Lead non gestito da <span class="days-badge">{days_unworked} giorni</span></p>
                </div>
                <div class="content">
                    <p>Ciao <strong>{agent_name}</strong>,</p>
                    
                    {"<div class='urgent-box'><strong>⚠️ ATTENZIONE:</strong> Questo lead è in attesa da oltre 7 giorni. È fondamentale contattarlo al più presto!</div>" if days_unworked >= 7 else "<div class='warning-box'><strong>📌 Nota:</strong> Questo lead è in attesa da 3 giorni. Ti consigliamo di contattarlo presto.</div>"}
                    
                    <div class="lead-info">
                        <h3>📋 Dettagli Lead</h3>
                        <div class="info-row"><span class="label">Nome:</span> {lead_name}</div>
                        <div class="info-row"><span class="label">Provincia:</span> {lead_provincia}</div>
                        <div class="info-row"><span class="label">Assegnato il:</span> {assigned_at_str}</div>
                        <div class="info-row"><span class="label">Giorni in attesa:</span> <strong style="color: {urgency_color}">{days_unworked}</strong></div>
                    </div>
                    
                    <p>Per favore, accedi al CRM per visualizzare i dettagli completi e aggiorna lo status del lead dopo averlo contattato.</p>
                    
                    <center>
                        <a href="#" class="cta-button">Gestisci Lead</a>
                    </center>
                </div>
                <div class="footer">
                    <p>Questa è una notifica automatica dal sistema CRM.</p>
                    <p>© {datetime.now().year} Nureal - Tutti i diritti riservati</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Invia email all'agente
        result = await send_email_notification(agent_email, subject, body_html)
        
        if result:
            # Log the reminder
            await db.lead_notifications.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "agent_id": agent_id,
                "type": f"reminder_{days_unworked}_days",
                "sent_at": datetime.now(timezone.utc),
                "email": agent_email,
                "success": True
            })
        
        # Per i 7 giorni, invia anche al Referente
        if days_unworked >= 7:
            referente_id = agent.get("referente_id")
            if referente_id:
                referente = await db.users.find_one({"id": referente_id})
                if referente and referente.get("email"):
                    referente_email = referente["email"]
                    referente_name = referente.get("username", "Referente")
                    
                    # Email body per il Referente
                    referente_subject = f"🚨 SEGNALAZIONE: Lead non gestito da {agent_name} - {days_unworked}+ giorni"
                    
                    referente_body_html = f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                            .header {{ background: #7c3aed; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }}
                            .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
                            .alert-box {{ background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                            .agent-info {{ background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }}
                            .lead-info {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }}
                            .lead-info h3 {{ margin: 0 0 10px 0; color: #dc2626; }}
                            .info-row {{ margin: 8px 0; }}
                            .label {{ font-weight: bold; color: #555; }}
                            .footer {{ background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }}
                            .cta-button {{ display: inline-block; background: #7c3aed; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 15px; }}
                            .days-badge {{ display: inline-block; background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>👁️ Segnalazione Referente</h1>
                                <p>Lead in attesa da <span class="days-badge">{days_unworked}+ giorni</span></p>
                            </div>
                            <div class="content">
                                <p>Ciao <strong>{referente_name}</strong>,</p>
                                
                                <div class="alert-box">
                                    <strong>⚠️ ATTENZIONE:</strong> Un lead assegnato a un tuo agente non è stato gestito da oltre 7 giorni.
                                </div>
                                
                                <div class="agent-info">
                                    <h4 style="margin: 0 0 10px 0; color: #b45309;">👤 Agente Responsabile</h4>
                                    <div class="info-row"><span class="label">Nome Agente:</span> <strong>{agent_name}</strong></div>
                                    <div class="info-row"><span class="label">Email Agente:</span> {agent_email}</div>
                                </div>
                                
                                <div class="lead-info">
                                    <h3>📋 Dettagli Lead Non Gestito</h3>
                                    <div class="info-row"><span class="label">Nome Lead:</span> {lead_name}</div>
                                    <div class="info-row"><span class="label">Provincia:</span> {lead_provincia}</div>
                                    <div class="info-row"><span class="label">Assegnato il:</span> {assigned_at_str}</div>
                                    <div class="info-row"><span class="label">Giorni in attesa:</span> <strong style="color: #dc2626">{days_unworked}</strong></div>
                                </div>
                                
                                <p>Ti consigliamo di verificare la situazione con l'agente e, se necessario, riassegnare il lead.</p>
                                
                                <center>
                                    <a href="#" class="cta-button">Accedi al CRM</a>
                                </center>
                            </div>
                            <div class="footer">
                                <p>Questa è una notifica automatica dal sistema CRM.</p>
                                <p>© {datetime.now().year} Nureal - Tutti i diritti riservati</p>
                            </div>
                        </div>
                    </body>
                    </html>
                    """
                    
                    referente_result = await send_email_notification(referente_email, referente_subject, referente_body_html)
                    
                    if referente_result:
                        await db.lead_notifications.insert_one({
                            "id": str(uuid.uuid4()),
                            "lead_id": lead_id,
                            "agent_id": referente_id,
                            "type": "reminder_7_days_referente",
                            "sent_at": datetime.now(timezone.utc),
                            "email": referente_email,
                            "success": True,
                            "related_agent_id": agent_id,
                            "related_agent_name": agent_name
                        })
                        logging.info(f"[EMAIL] Sent 7-day referente notification for lead {lead_id} to {referente_email}")
                else:
                    logging.warning(f"[EMAIL] Referente {referente_id} not found or has no email")
            else:
                logging.info(f"[EMAIL] Agent {agent_id} has no referente assigned")
            
            # SUPER REFERENTE: Cerca Super Referenti che hanno questo referente autorizzato
            if referente_id:
                super_referenti = await db.users.find({
                    "role": "super_referente",
                    "referenti_autorizzati": referente_id,
                    "is_active": True
                }).to_list(length=None)
                
                for super_ref in super_referenti:
                    if super_ref.get("email"):
                        super_ref_email = super_ref["email"]
                        super_ref_name = super_ref.get("username", "Super Referente")
                        referente_name_for_email = referente.get("username", "N/A") if referente else "N/A"
                        
                        super_ref_subject = f"🚨 SEGNALAZIONE: Lead non gestito nella tua rete - {days_unworked}+ giorni"
                        
                        super_ref_body_html = f"""
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }}
                                .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
                                .alert-box {{ background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                                .referente-info {{ background: #ddd6fe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #7c3aed; }}
                                .agent-info {{ background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }}
                                .lead-info {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }}
                                .lead-info h3 {{ margin: 0 0 10px 0; color: #dc2626; }}
                                .info-row {{ margin: 8px 0; }}
                                .label {{ font-weight: bold; color: #555; }}
                                .footer {{ background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }}
                                .cta-button {{ display: inline-block; background: #6366f1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 15px; }}
                                .days-badge {{ display: inline-block; background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }}
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>👁️ Segnalazione Super Referente</h1>
                                    <p>Lead in attesa da <span class="days-badge">{days_unworked}+ giorni</span></p>
                                </div>
                                <div class="content">
                                    <p>Ciao <strong>{super_ref_name}</strong>,</p>
                                    
                                    <div class="alert-box">
                                        <strong>⚠️ ATTENZIONE:</strong> Un lead nella tua rete non è stato gestito da oltre 7 giorni.
                                    </div>
                                    
                                    <div class="referente-info">
                                        <h4 style="margin: 0 0 10px 0; color: #6d28d9;">👔 Referente</h4>
                                        <div class="info-row"><span class="label">Nome Referente:</span> <strong>{referente_name_for_email}</strong></div>
                                    </div>
                                    
                                    <div class="agent-info">
                                        <h4 style="margin: 0 0 10px 0; color: #b45309;">👤 Agente Responsabile</h4>
                                        <div class="info-row"><span class="label">Nome Agente:</span> <strong>{agent_name}</strong></div>
                                        <div class="info-row"><span class="label">Email Agente:</span> {agent_email}</div>
                                    </div>
                                    
                                    <div class="lead-info">
                                        <h3>📋 Dettagli Lead Non Gestito</h3>
                                        <div class="info-row"><span class="label">Nome Lead:</span> {lead_name}</div>
                                        <div class="info-row"><span class="label">Provincia:</span> {lead_provincia}</div>
                                        <div class="info-row"><span class="label">Assegnato il:</span> {assigned_at_str}</div>
                                        <div class="info-row"><span class="label">Giorni in attesa:</span> <strong style="color: #dc2626">{days_unworked}</strong></div>
                                    </div>
                                    
                                    <p>Ti consigliamo di verificare la situazione con il Referente e l'Agente responsabile.</p>
                                    
                                    <center>
                                        <a href="#" class="cta-button">Accedi al CRM</a>
                                    </center>
                                </div>
                                <div class="footer">
                                    <p>Questa è una notifica automatica dal sistema CRM.</p>
                                    <p>© {datetime.now().year} Nureal - Tutti i diritti riservati</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """
                        
                        super_ref_result = await send_email_notification(super_ref_email, super_ref_subject, super_ref_body_html)
                        
                        if super_ref_result:
                            await db.lead_notifications.insert_one({
                                "id": str(uuid.uuid4()),
                                "lead_id": lead_id,
                                "agent_id": super_ref["id"],
                                "type": "reminder_7_days_super_referente",
                                "sent_at": datetime.now(timezone.utc),
                                "email": super_ref_email,
                                "success": True,
                                "related_agent_id": agent_id,
                                "related_agent_name": agent_name,
                                "related_referente_id": referente_id,
                                "related_referente_name": referente_name_for_email
                            })
                            logging.info(f"[EMAIL] Sent 7-day super referente notification for lead {lead_id} to {super_ref_email}")
        
        return result
        
    except Exception as e:
        logging.error(f"[EMAIL] Error in send_lead_reminder_email: {str(e)}")
        return False

async def check_and_send_lead_reminders():
    """Background task to check for unworked leads and send reminders"""
    logging.info("[REMINDER] Starting lead reminder check...")
    
    try:
        now = datetime.now(timezone.utc)
        three_days_ago = now - timedelta(days=3)
        seven_days_ago = now - timedelta(days=7)
        
        # Find leads that are unworked (esito == esito_at_assignment) and assigned
        unworked_leads = await db.leads.find({
            "assigned_agent_id": {"$exists": True, "$ne": None},
            "esito_at_assignment": {"$exists": True},
            "$expr": {"$eq": ["$esito", "$esito_at_assignment"]},
            "assigned_at": {"$exists": True}
        }).to_list(length=None)
        
        logging.info(f"[REMINDER] Found {len(unworked_leads)} unworked leads")
        
        reminders_sent_3d = 0
        reminders_sent_7d = 0
        
        for lead in unworked_leads:
            lead_id = lead.get("id")
            agent_id = lead.get("assigned_agent_id")
            assigned_at = lead.get("assigned_at")
            
            if not assigned_at or not agent_id:
                continue
            
            # Convert to datetime if string
            if isinstance(assigned_at, str):
                assigned_at = datetime.fromisoformat(assigned_at.replace('Z', '+00:00'))
            
            # Ensure timezone aware
            if assigned_at.tzinfo is None:
                assigned_at = assigned_at.replace(tzinfo=timezone.utc)
            
            days_since_assignment = (now - assigned_at).days
            
            # Check if reminder already sent today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # 7-day reminder (priority)
            if days_since_assignment >= 7:
                # Check if 7-day reminder already sent
                existing_7d = await db.lead_notifications.find_one({
                    "lead_id": lead_id,
                    "type": "reminder_7_days",
                    "sent_at": {"$gte": today_start}
                })
                
                if not existing_7d:
                    success = await send_lead_reminder_email(agent_id, lead, days_since_assignment)
                    if success:
                        reminders_sent_7d += 1
                        logging.info(f"[REMINDER] Sent 7-day reminder for lead {lead_id} to agent {agent_id}")
            
            # 3-day reminder (only if not yet at 7 days)
            elif days_since_assignment >= 3:
                # Check if 3-day reminder already sent
                existing_3d = await db.lead_notifications.find_one({
                    "lead_id": lead_id,
                    "type": "reminder_3_days",
                    "sent_at": {"$gte": today_start}
                })
                
                if not existing_3d:
                    success = await send_lead_reminder_email(agent_id, lead, days_since_assignment)
                    if success:
                        reminders_sent_3d += 1
                        logging.info(f"[REMINDER] Sent 3-day reminder for lead {lead_id} to agent {agent_id}")
        
        logging.info(f"[REMINDER] Completed: {reminders_sent_3d} 3-day reminders, {reminders_sent_7d} 7-day reminders sent")
        
        return {
            "reminders_3_days": reminders_sent_3d,
            "reminders_7_days": reminders_sent_7d,
            "total_unworked_leads": len(unworked_leads)
        }
        
    except Exception as e:
        logging.error(f"[REMINDER] Error in check_and_send_lead_reminders: {str(e)}")
        return None

# Background scheduler for reminders
reminder_scheduler_running = False

async def start_reminder_scheduler():
    """Start background scheduler for lead reminders - runs every hour"""
    global reminder_scheduler_running
    
    if reminder_scheduler_running:
        logging.info("[SCHEDULER] Reminder scheduler already running")
        return
    
    reminder_scheduler_running = True
    logging.info("[SCHEDULER] Starting lead reminder scheduler (runs every hour)")
    
    while reminder_scheduler_running:
        try:
            # Run reminder check
            await check_and_send_lead_reminders()
        except Exception as e:
            logging.error(f"[SCHEDULER] Error in reminder scheduler: {str(e)}")
        
        # Wait 1 hour before next check
        await asyncio.sleep(3600)  # 3600 seconds = 1 hour


