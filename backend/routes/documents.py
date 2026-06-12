"""Route: Upload e gestione documenti — estratte da server.py (refactoring fase 3, giugno 2026)."""
import asyncio
import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, HTTPException, Depends, Query, Body, Request,
    UploadFile, File, Form, status,
)
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse, Response

from database import db
from security import (
    get_current_user, get_password_hash, verify_password, create_access_token,
    pwd_context, ACCESS_TOKEN_EXPIRE_MINUTES,
    get_user_commessa_authorizations, check_commessa_access, get_user_accessible_commesse,
    get_user_accessible_sub_agenzie, can_user_access_cliente, can_user_access_cliente_notes,
    can_user_delete_cliente, can_user_modify_cliente, can_user_access_document,
    get_user_accessible_documents,
)
from helpers import (
    ITALIAN_PROVINCES, PROVINCE_TO_CODE, normalize_province_name, provincia_matches,
    MAX_UNWORKED_LEADS_PER_AGENT, assign_lead_to_agent,
    parse_uploaded_file, validate_cliente_data, process_import_batch,
    create_excel_report, create_clienti_excel_report,
    get_user_ip, detect_client_changes, _expand_segmento_filter_values,
)
from services import (
    UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_FILE_TYPES,
    aruba_service, validate_uploaded_file, save_temporary_file, create_document_record,
)
from notifications import notify_agent_new_lead, send_email_notification
from audit import log_client_action
from models import *  # noqa: F401,F403
from pathlib import Path
from services import NextcloudClient

router = APIRouter()
logger = logging.getLogger(__name__)

last_upload_debug = {
    "timestamp": None,
    "success": False,
    "aruba_attempted": False,
    "aruba_success": False,
    "error": None,
    "logs": []
}

@router.get("/documents/upload-debug")
async def get_upload_debug():
    """Get debug information about last upload attempt - NO AUTH for debugging"""
    return last_upload_debug

@router.post("/documents/upload")
async def upload_document(
    entity_type: str = Form(...),  # Cambiato da document_type per compatibilità frontend
    entity_id: str = Form(...),  # lead_id or cliente_id
    file: UploadFile = File(...),
    uploaded_by: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a PDF document for a specific lead or cliente"""
    
    global last_upload_debug
    last_upload_debug = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "success": False,
        "aruba_attempted": False,
        "aruba_success": False,
        "error": None,
        "logs": []
    }
    
    def add_debug_log(message):
        last_upload_debug["logs"].append(f"{datetime.now(timezone.utc).isoformat()}: {message}")
        logging.info(message)
    
    add_debug_log(f"📥 Upload started - entity_type: {entity_type}, entity_id: {entity_id}, file: {file.filename}")
    
    # Validate document type
    try:
        doc_type = DocumentType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    # Check if entity exists and user has access
    if doc_type == DocumentType.LEAD:
        entity = await db.leads.find_one({"id": entity_id})
        if not entity:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Check lead access (existing logic)
        if current_user.role == UserRole.REFERENTE and entity.get("unit_id") != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this lead")
        elif current_user.role == UserRole.AGENTE:
            if entity.get("assigned_to") != current_user.id and entity.get("unit_id") != current_user.unit_id:
                raise HTTPException(status_code=403, detail="Access denied to this lead")
                
    elif doc_type == DocumentType.CLIENTE:
        entity = await db.clienti.find_one({"id": entity_id})
        add_debug_log(f"🔍 Cliente lookup: found={entity is not None}")
        if not entity:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        # Document uploads are universally permitted - ALL authenticated users can upload
        # No access check needed for document upload
        # Note: We don't need to validate the full Cliente model for document upload
        add_debug_log(f"✅ Cliente found: {entity.get('nome', '')} {entity.get('cognome', '')}")
    
    try:
        add_debug_log("🚀 Starting file processing...")
        # NEW: Smart Aruba Drive Integration with per-commessa configuration
        aruba_drive_path = None
        storage_type = None  # Will be set based on actual upload result
        
        add_debug_log("📁 Getting Aruba Drive config...")
        
        # Get commessa-specific Aruba Drive config for clients
        aruba_config = None
        commessa = None
        if doc_type == DocumentType.CLIENTE:
            commessa_id = entity.get("commessa_id") if entity else None
            add_debug_log(f"📋 Commessa ID: {commessa_id}")
            if commessa_id:
                try:
                    commessa = await db.commesse.find_one({"id": commessa_id})
                    add_debug_log(f"📋 Commessa found: {commessa is not None}")
                    if commessa and commessa.get("aruba_drive_config", {}).get("enabled"):
                        aruba_config = commessa["aruba_drive_config"]
                        logging.info(f"📋 Using Aruba Drive config for commessa: {commessa.get('nome')}")
                except Exception as e:
                    add_debug_log(f"❌ Error finding commessa: {str(e)}")
                    commessa = None
        
        # Se non c'è config dalla commessa, cerca config globale in settings
        if not aruba_config:
            try:
                global_settings = await db.settings.find_one({"key": "aruba_drive_global"})
                if global_settings and global_settings.get("value", {}).get("enabled"):
                    aruba_config = global_settings["value"]
                    add_debug_log(f"📋 Using global Aruba Drive config")
            except Exception as e:
                add_debug_log(f"⚠️ Error checking global config: {str(e)}")
        
        # Se ancora non c'è config, forza errore - l'upload DEVE andare su Aruba
        if not aruba_config or not aruba_config.get("enabled"):
            add_debug_log("❌ Nessuna configurazione Aruba Drive trovata")
            raise HTTPException(
                status_code=400, 
                detail="Errore: Aruba Drive non è configurato per questa commessa. Contattare l'amministratore per configurare l'integrazione Aruba Drive."
            )
        
        add_debug_log(f"📁 Aruba config found: {aruba_config is not None}")
        
        # Generate filename with client information
        original_filename = file.filename or "documento"
        file_extension = Path(original_filename).suffix or ".bin"
        add_debug_log(f"📄 Original filename: {original_filename}, ext: {file_extension}")
        
        # Create enhanced filename with client data for better organization
        if doc_type == DocumentType.CLIENTE:
            nome = entity.get("nome", "").strip()
            cognome = entity.get("cognome", "").strip()
            telefono = entity.get("telefono", "").strip()
            
            # Clean phone number (remove spaces, +, parentheses)
            clean_telefono = "".join(c for c in telefono if c.isdigit())
            
            # Create client prefix
            client_prefix = ""
            if nome and cognome:
                client_prefix = f"{nome}_{cognome}"
                if clean_telefono:
                    client_prefix += f"_{clean_telefono}"
            elif nome or cognome:
                client_prefix = nome or cognome
                if clean_telefono:
                    client_prefix += f"_{clean_telefono}"
            elif clean_telefono:
                client_prefix = clean_telefono
            
            # Clean original filename
            clean_original = "".join(c for c in Path(original_filename).stem if c.isalnum() or c in (' ', '-', '_')).rstrip()
            
            # Combine client info with original filename
            if client_prefix and clean_original:
                unique_filename = f"{client_prefix}_{clean_original}{file_extension}"
            elif client_prefix:
                unique_filename = f"{client_prefix}_documento{file_extension}"
            else:
                unique_filename = f"{clean_original}{file_extension}" if clean_original else f"documento{file_extension}"
        else:
            # For leads, use original filename logic
            safe_filename = "".join(c for c in original_filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
            unique_filename = safe_filename if safe_filename else f"documento{file_extension}"
        
        # Ensure filename is not too long (max 200 characters)
        if len(unique_filename) > 200:
            stem = Path(unique_filename).stem[:190]
            unique_filename = f"{stem}{file_extension}"
        
        # Read file content
        content = await file.read()
        
        # Try Nextcloud upload if configured
        upload_success = False
        if aruba_config and aruba_config.get('enabled'):
            add_debug_log(f"✅ Nextcloud config found: enabled={aruba_config.get('enabled')}")
            last_upload_debug["aruba_attempted"] = True
            try:
                # Get Nextcloud configuration
                base_url = aruba_config.get("url", "https://vkbu5u.arubadrive.com")
                username = aruba_config.get("username", "crm")
                password = aruba_config.get("password", "Casilina25")
                
                # Folder name (e.g., "Fastweb", "Telepass")
                if aruba_config.get("root_folder_path"):
                    folder_name = aruba_config["root_folder_path"].strip('/')
                elif commessa:
                    folder_name = commessa.get('nome', 'Documenti')
                else:
                    folder_name = 'Documenti'
                
                logging.info(f"🌐 Nextcloud WebDAV upload")
                logging.info(f"📁 Target folder: /{folder_name}/")
                add_debug_log(f"🌐 Using Nextcloud WebDAV: folder=/{folder_name}/")
                
                # ============================================
                # NEXTCLOUD WEBDAV UPLOAD (Fast, lightweight, no browser)
                # ============================================
                
                add_debug_log(f"🚀 Starting Nextcloud WebDAV upload")
                
                # Initialize Nextcloud client
                nextcloud = NextcloudClient(
                    base_url=base_url,
                    username=username,
                    password=password,
                    folder_path=folder_name
                )
                
                # Build structured filename with client info
                structured_filename = nextcloud.build_filename(entity, unique_filename)
                
                add_debug_log(f"📝 Structured filename: {structured_filename}")
                
                # Upload file via WebDAV
                success, cloud_path = await nextcloud.upload_file(content, structured_filename)
                
                if success:
                    aruba_drive_path = cloud_path
                    storage_type = "nextcloud"
                    upload_success = True
                    add_debug_log(f"✅ Nextcloud upload successful: {cloud_path}")
                    last_upload_debug["aruba_success"] = True
                else:
                    add_debug_log(f"❌ WebDAV upload returned False, using local storage fallback")
                    
            except Exception as nextcloud_exception:
                add_debug_log(f"❌ Nextcloud exception: {type(nextcloud_exception).__name__}: {str(nextcloud_exception)}")
                import traceback
                add_debug_log(f"🔍 Full traceback: {traceback.format_exc()}")
                last_upload_debug["error"] = f"{type(nextcloud_exception).__name__}: {str(nextcloud_exception)}"
                # NUOVO: Se Aruba è configurato ma fallisce, restituisci errore invece di fallback locale
                raise HTTPException(
                    status_code=503, 
                    detail=f"Errore di connessione al server Aruba Drive. Il documento NON è stato salvato. Dettaglio: {str(nextcloud_exception)}"
                )
        
        # MODIFICATO: Se Aruba è configurato ma l'upload non è andato a buon fine, errore
        if not upload_success:
            add_debug_log(f"❌ Aruba Drive upload fallito - NON salvo localmente")
            raise HTTPException(
                status_code=503, 
                detail="Errore: il server Aruba Drive non ha risposto correttamente. Il documento NON è stato salvato."
            )
        
        # Cloud upload successful - no local copy needed
        file_path = None
        add_debug_log(f"☁️ Cloud upload successful - no local copy")
        
        # Ensure storage_type is always set (safety check)
        if storage_type is None:
            storage_type = "nextcloud"
            add_debug_log(f"⚠️ storage_type was None, defaulting to 'nextcloud'")
        
        # Save document metadata
        document_data = {
            "id": str(uuid.uuid4()),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "filename": unique_filename,  # Use the enhanced filename with client name/phone
            "original_filename": file.filename,  # Keep original for reference
            "file_path": str(file_path) if file_path else None,
            "cloud_path": aruba_drive_path if storage_type == "nextcloud" else None,
            "aruba_drive_path": aruba_drive_path or f"/local/{entity_type}/{entity_id}/{unique_filename}",  # Legacy field
            "file_size": len(content),
            "file_type": file.content_type or "application/octet-stream",
            "created_by": uploaded_by,
            "created_at": datetime.now(timezone.utc),
            "storage_type": storage_type,
            "nextcloud_config_used": bool(aruba_config)  # Track if Nextcloud was used
        }
        
        await db.documents.insert_one(document_data)
        
        add_debug_log(f"💾 Document saved to database: storage_type={storage_type}, aruba_path={aruba_drive_path}")
        last_upload_debug["success"] = True
        
        # 📝 LOG: Registra l'upload del documento (solo per clienti)
        if doc_type == DocumentType.CLIENTE:
            await log_client_action(
                cliente_id=entity_id,
                action=ClienteLogAction.DOCUMENT_UPLOADED,
                description=f"Documento caricato: {unique_filename}",
                user=current_user,
                new_value=unique_filename,
                metadata={
                    "document_id": document_data["id"],
                    "file_size": len(content),
                    "file_type": file.content_type or "application/octet-stream",
                    "aruba_drive_path": document_data["aruba_drive_path"],
                    "original_filename": file.filename
                }
            )
        
        return {
            "success": True,
            "message": "Documento caricato con successo",
            "document_id": document_data["id"],
            "filename": file.filename,
            "aruba_drive_path": document_data["aruba_drive_path"]
        }
                
    except HTTPException:
        raise
    except Exception as e:
        # Clean up temporary file on error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )

@router.get("/documents/lead/{lead_id}")
async def list_lead_documents(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """List all documents for a specific lead"""
    
    # Check if lead exists
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Query documents with pagination
    documents = await db.documents.find({
        "lead_id": lead_id,
        "is_active": True
    }).skip(skip).limit(limit).to_list(length=None)
    
    # Get total count for pagination
    total_count = await db.documents.count_documents({
        "lead_id": lead_id,
        "is_active": True
    })
    
    document_list = []
    for doc in documents:
        document_list.append({
            "id": doc["id"],
            "document_id": doc["document_id"],
            "filename": doc["original_filename"],
            "size": doc["file_size"],
            "content_type": doc["content_type"],
            "upload_status": doc["upload_status"],
            "uploaded_by": doc["uploaded_by"],
            "download_count": doc.get("download_count", 0),
            "created_at": doc["created_at"].isoformat(),
            "download_url": f"/api/documents/download/{doc['document_id']}"
        })
    
    return {
        "lead": {
            "id": lead["id"],
            "nome": lead["nome"],
            "cognome": lead["cognome"],
            "lead_id": lead.get("lead_id", lead["id"][:8])
        },
        "documents": document_list,
        "pagination": {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": (skip + limit) < total_count
        }
    }

# REMOVED: Duplicate download endpoint - using newer version at line 9942

# REMOVED: Duplicate delete endpoint - using newer version at line 9908

# Endpoint duplicato rimosso - ora utilizziamo solo quello alla linea 7871 con DocumentResponse

# Analytics endpoints
