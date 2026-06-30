"""Route: Autenticazione e gestione utenti — estratte da server.py (refactoring fase 3, giugno 2026)."""
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

router = APIRouter()
logger = logging.getLogger(__name__)

# Auth endpoints
@router.post("/auth/login", response_model=Token)
async def login_for_access_token(form_data: UserLogin):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    # NEW: Check password expiry (90 days) for all users except Admin
    password_change_required = user.get("password_change_required", False)
    
    if user.get("role") != "admin":
        password_last_changed = user.get("password_last_changed")
        if password_last_changed:
            # Convert to datetime if it's a string
            if isinstance(password_last_changed, str):
                password_last_changed = datetime.fromisoformat(password_last_changed.replace('Z', '+00:00'))
            
            # Ensure password_last_changed is timezone-aware
            if password_last_changed.tzinfo is None:
                password_last_changed = password_last_changed.replace(tzinfo=timezone.utc)
            
            # Calculate days since last password change
            days_since_change = (datetime.now(timezone.utc) - password_last_changed).days
            
            # If more than 90 days, force password change
            if days_since_change >= 90:
                password_change_required = True
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"password_change_required": True}}
                )
        elif not password_last_changed:
            # If password_last_changed is None (old users), set it to now and require change
            password_change_required = True
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "password_change_required": True,
                    "password_last_changed": datetime.now(timezone.utc)
                }}
            )
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    # Update user object with password_change_required status
    user["password_change_required"] = password_change_required
    user_obj = User(**user)
    return {"access_token": access_token, "token_type": "bearer", "user": user_obj}

@router.get("/auth/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    # Get fresh user data from database to ensure all fields are included
    user_data = await db.users.find_one({"username": current_user.username})
    if user_data:
        # Convert ObjectId to string and return raw data to ensure all fields are present
        user_data["_id"] = str(user_data["_id"])
        # NEW (giu 2026): assicura sempre un fuso orario (default Europe/Rome per utenti legacy)
        user_data["timezone"] = user_data.get("timezone") or "Europe/Rome"
        # NEW (feb 2026): per gli utenti backoffice_sub_agenzia espone il flag della propria sub agenzia
        # `bo_sub_agenzia_can_change_status` permette al frontend di abilitare la modifica dello status cliente.
        user_data["bo_sub_agenzia_can_change_status"] = False
        if user_data.get("role") == UserRole.BACKOFFICE_SUB_AGENZIA and user_data.get("sub_agenzia_id"):
            sub_doc = await db.sub_agenzie.find_one({"id": user_data["sub_agenzia_id"]})
            if sub_doc and sub_doc.get("can_change_status"):
                user_data["bo_sub_agenzia_can_change_status"] = True
        return user_data
    return current_user

@router.patch("/auth/me/timezone")
async def update_my_timezone(payload: Dict[str, Any] = Body(...), current_user: User = Depends(get_current_user)):
    """Self-service: l'utente aggiorna il proprio fuso orario preferito (IANA, es. 'Europe/Rome')."""
    from zoneinfo import ZoneInfo
    tz = (payload or {}).get("timezone")
    if not tz or not isinstance(tz, str):
        raise HTTPException(status_code=400, detail="Campo 'timezone' obbligatorio")
    try:
        ZoneInfo(tz)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Fuso orario non valido: {tz}")
    await db.users.update_one({"id": current_user.id}, {"$set": {"timezone": tz}})
    return {"timezone": tz}

@router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: User = Depends(get_current_user)):
    """Change user password - required on first login"""
    
    # Verify current password
    user_doc = await db.users.find_one({"username": current_user.username})
    if not user_doc or not verify_password(password_data.current_password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check that new password is different from current password
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nuova password deve essere diversa da quella attuale"
        )
    
    # Hash new password
    hashed_password = get_password_hash(password_data.new_password)
    
    # Update password, clear password change requirement, and set password_last_changed
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "password_hash": hashed_password,
            "password_change_required": False,  # Clear the requirement
            "password_last_changed": datetime.now(timezone.utc)  # NEW: Track password change date
        }}
    )
    
    return {"message": "Password changed successfully"}

# User management endpoints
@router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    # Check permissions: ADMIN or RESPONSABILE_COMMESSA
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # RESPONSABILE_COMMESSA restrictions
    if current_user.role == UserRole.RESPONSABILE_COMMESSA:
        # Can only create users in their authorized commesse/servizi
        if not hasattr(current_user, 'commesse_autorizzate') or not current_user.commesse_autorizzate:
            raise HTTPException(status_code=403, detail="No authorized commesse")
        
        # Restrict which roles can be created
        allowed_roles = [
            UserRole.AGENTE,
            UserRole.OPERATORE,
            UserRole.STORE_ASSIST,
            UserRole.AGENTE_SPECIALIZZATO,
            UserRole.PROMOTER_PRESIDI,
            UserRole.BACKOFFICE_COMMESSA,
            UserRole.BACKOFFICE_SUB_AGENZIA,
            UserRole.RESPONSABILE_SUB_AGENZIA,
            UserRole.AREA_MANAGER,
            UserRole.RESPONSABILE_PRESIDI
        ]
        if user_data.role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Cannot create user with role {user_data.role}")
        
        # Ensure created user gets only commesse/servizi that RESPONSABILE_COMMESSA has access to
        if user_data.commesse_autorizzate:
            # Check if all requested commesse are in responsabile's authorized list
            unauthorized_commesse = set(user_data.commesse_autorizzate) - set(current_user.commesse_autorizzate)
            if unauthorized_commesse:
                raise HTTPException(status_code=403, detail=f"Cannot assign unauthorized commesse")
        else:
            # Auto-assign responsabile's commesse if not specified
            user_data.commesse_autorizzate = current_user.commesse_autorizzate
        
        if user_data.servizi_autorizzati:
            # Check if all requested servizi are in responsabile's authorized list
            if hasattr(current_user, 'servizi_autorizzati') and current_user.servizi_autorizzati:
                unauthorized_servizi = set(user_data.servizi_autorizzati) - set(current_user.servizi_autorizzati)
                if unauthorized_servizi:
                    raise HTTPException(status_code=403, detail=f"Cannot assign unauthorized servizi")
        elif hasattr(current_user, 'servizi_autorizzati') and current_user.servizi_autorizzati:
            # Auto-assign responsabile's servizi if not specified
            user_data.servizi_autorizzati = current_user.servizi_autorizzati
    
    # Check if username or email already exists
    existing_user = await db.users.find_one({
        "$or": [{"username": user_data.username}, {"email": user_data.email}]
    })
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # Validate provinces for agents
    if user_data.role == UserRole.AGENTE:
        invalid_provinces = [p for p in user_data.provinces if p not in ITALIAN_PROVINCES]
        if invalid_provinces:
            raise HTTPException(status_code=400, detail=f"Invalid provinces: {invalid_provinces}")
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password_hash"] = get_password_hash(user_data.password)
    del user_dict["password"]
    
    # Auto-set can_view_analytics based on role
    if user_dict.get("can_view_analytics") is None:
        user_dict["can_view_analytics"] = user_data.role in [
            UserRole.ADMIN, 
            UserRole.RESPONSABILE_COMMESSA, 
            UserRole.RESPONSABILE_SUB_AGENZIA,
            UserRole.AGENTE_SPECIALIZZATO,  # Per analytics dei propri clienti
            UserRole.OPERATORE  # Per analytics dei propri clienti
        ]
    
    # Ensure all required fields are present with default values if missing
    user_dict.setdefault("is_active", True)
    user_dict.setdefault("provinces", [])
    user_dict.setdefault("commesse_autorizzate", [])
    user_dict.setdefault("servizi_autorizzati", [])
    user_dict.setdefault("sub_agenzie_autorizzate", [])
    user_dict.setdefault("password_change_required", True)  # Force password change on first login
    user_dict.setdefault("password_last_changed", datetime.now(timezone.utc))  # NEW: Set initial password date
    user_dict.setdefault("created_at", datetime.now(timezone.utc))
    user_dict.setdefault("last_login", None)
    
    # Area Manager: Auto-populate commesse_autorizzate and servizi_autorizzati from assigned sub agenzie
    if user_data.role == UserRole.AREA_MANAGER and user_dict.get("sub_agenzie_autorizzate"):
        # Get all commesse and servizi from assigned sub agenzie
        sub_agenzie_docs = await db.sub_agenzie.find({
            "id": {"$in": user_dict["sub_agenzie_autorizzate"]},
            "is_active": True
        }).to_list(length=None)
        
        # Collect all commesse and servizi from these sub agenzie
        all_commesse = set()
        all_servizi = set()
        for sub_agenzia in sub_agenzie_docs:
            sub_commesse = sub_agenzia.get("commesse_autorizzate", [])
            sub_servizi = sub_agenzia.get("servizi_autorizzati", [])
            all_commesse.update(sub_commesse)
            all_servizi.update(sub_servizi)
        
        user_dict["commesse_autorizzate"] = list(all_commesse)
        user_dict["servizi_autorizzati"] = list(all_servizi)
        print(f"🌍 AREA MANAGER AUTO-POPULATION: {user_data.username} - Sub Agenzie: {len(user_dict['sub_agenzie_autorizzate'])}, Commesse: {len(user_dict['commesse_autorizzate'])}, Servizi: {len(user_dict['servizi_autorizzati'])}")

    # 🔧 Coerenza commesse↔servizi (creazione utente):
    # 1. Se l'admin assegna servizi, le commesse parent vengono aggiunte automaticamente
    # 2. Per backoffice_sub_agenzia / responsabile_sub_agenzia, se non c'è alcun servizio
    #    di una commessa, la commessa viene rimossa
    srv_ids_init = list(user_dict.get("servizi_autorizzati", []) or [])
    if srv_ids_init:
        srvs_init = await db.servizi.find(
            {"id": {"$in": srv_ids_init}}, {"_id": 0, "id": 1, "commessa_id": 1}
        ).to_list(length=None)
        parent_commesse_init = {s.get("commessa_id") for s in srvs_init if s.get("commessa_id")}
        if parent_commesse_init:
            existing_commesse_init = set(user_dict.get("commesse_autorizzate", []) or [])
            merged_commesse_init = list(existing_commesse_init | parent_commesse_init)
            if set(merged_commesse_init) != existing_commesse_init:
                user_dict["commesse_autorizzate"] = merged_commesse_init
                print(
                    f"🔧 CREATE USER {user_data.username}: aggiunte commesse parent "
                    f"{parent_commesse_init - existing_commesse_init}"
                )

    if user_data.role in (UserRole.BACKOFFICE_SUB_AGENZIA, UserRole.RESPONSABILE_SUB_AGENZIA):
        final_servizi_init = list(user_dict.get("servizi_autorizzati", []) or [])
        final_commesse_init = list(user_dict.get("commesse_autorizzate", []) or [])
        if final_commesse_init:
            srvs_for_clean = await db.servizi.find(
                {"id": {"$in": final_servizi_init}}, {"_id": 0, "id": 1, "commessa_id": 1}
            ).to_list(length=None) if final_servizi_init else []
            parent_set = {s.get("commessa_id") for s in srvs_for_clean if s.get("commessa_id")}
            cleaned = [c for c in final_commesse_init if c in parent_set]
            removed_init = set(final_commesse_init) - set(cleaned)
            if removed_init:
                user_dict["commesse_autorizzate"] = cleaned
                print(
                    f"🧹 CREATE USER {user_data.username}: rimosse commesse senza servizi "
                    f"{removed_init}"
                )

    # Create User object and save to database
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    
    return user_obj

@router.get("/users", response_model=List[User])
async def get_users(unit_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"is_active": True}  # Only active users
    
    if current_user.role == UserRole.ADMIN:
        # Admin can see all users, optionally filtered by unit
        if unit_id:
            query["unit_id"] = unit_id
    elif current_user.role == UserRole.SUPER_REFERENTE:
        # Super Referente sees ALL users in their Unit (agents, referenti, etc.)
        super_ref_unit_id = current_user.unit_id
        referenti_ids = current_user.referenti_autorizzati or []
        
        if super_ref_unit_id:
            # Get ALL users from the same Unit
            query = {
                "is_active": True,
                "$or": [
                    {"id": current_user.id},  # Include themselves
                    {"unit_id": super_ref_unit_id}  # All users in the same Unit
                ]
            }
        elif referenti_ids:
            # Fallback: if no unit_id, use referenti_autorizzati
            agents_under_referenti = await db.users.find({
                "referente_id": {"$in": referenti_ids},
                "is_active": True
            }).to_list(length=None)
            agent_ids = [a["id"] for a in agents_under_referenti]
            all_ids = [current_user.id] + referenti_ids + agent_ids
            query = {
                "is_active": True,
                "id": {"$in": all_ids}
            }
        else:
            query = {"id": current_user.id}  # Only themselves if no unit and no referenti
    elif current_user.role == UserRole.REFERENTE:
        # Referente can see their agents in their unit
        query = {
            "is_active": True,
            "$or": [
                {"id": current_user.id},
                {"referente_id": current_user.id}
            ]
        }
        if unit_id:
            query["unit_id"] = unit_id
    elif current_user.role in [UserRole.RESPONSABILE_COMMESSA, UserRole.BACKOFFICE_COMMESSA, 
                                UserRole.RESPONSABILE_SUB_AGENZIA, UserRole.BACKOFFICE_SUB_AGENZIA]:
        # These roles can see all users with overlapping permissions (commesse or sub_agenzie)
        or_conditions = [{"role": "admin"}]  # Include admins
        
        print(f"🔍 GET /users - User {current_user.username} role: {current_user.role}")
        print(f"📋 User commesse_autorizzate: {getattr(current_user, 'commesse_autorizzate', [])}")
        print(f"📋 User sub_agenzie_autorizzate: {getattr(current_user, 'sub_agenzie_autorizzate', [])}")
        
        # Add condition for users with same commesse
        if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
            or_conditions.append({
                "commesse_autorizzate": {
                    "$in": current_user.commesse_autorizzate
                }
            })
            
            # IMPORTANT: Also include users with sub_agenzie that belong to current user's commesse
            # Find all sub_agenzie under these commesse
            print(f"🔎 Searching sub_agenzie for commesse: {current_user.commesse_autorizzate}")
            sub_agenzie_in_commesse = await db.sub_agenzie.find({
                "commessa_id": {"$in": current_user.commesse_autorizzate}
            }).to_list(length=None)
            
            print(f"📦 Found {len(sub_agenzie_in_commesse)} sub_agenzie")
            if sub_agenzie_in_commesse:
                sub_agenzia_ids = [sa["id"] for sa in sub_agenzie_in_commesse]
                print(f"📝 Sub agenzia IDs: {sub_agenzia_ids}")
                or_conditions.append({
                    "sub_agenzie_autorizzate": {
                        "$in": sub_agenzia_ids
                    }
                })
        
        # Add condition for users with same sub_agenzie
        if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
            or_conditions.append({
                "sub_agenzie_autorizzate": {
                    "$in": current_user.sub_agenzie_autorizzate
                }
            })
        
        print(f"🔍 Query OR conditions count: {len(or_conditions)}")
        
        query = {
            "is_active": True,
            "$or": or_conditions
        }
    elif current_user.role == UserRole.SUPERVISOR:
        # Supervisor can see all users in their authorized units (agents, referenti, etc.)
        supervisor_units = (current_user.unit_autorizzate or [])
        if current_user.unit_id and current_user.unit_id not in supervisor_units:
            supervisor_units.append(current_user.unit_id)
        
        if supervisor_units:
            query = {
                "is_active": True,
                "unit_id": {"$in": supervisor_units}
            }
        else:
            # No units assigned - can only see themselves
            query["id"] = current_user.id
    else:
        # Other roles can only see themselves
        query["id"] = current_user.id
    
    users = await db.users.find(query).to_list(length=None)
    
    print(f"✅ Found {len(users)} users from database")
    
    # Robust user processing with error handling
    valid_users = []
    for user in users:
        try:
            # Ensure password_hash exists (safety check)
            if 'password_hash' not in user:
                print(f"Warning: User {user.get('username', 'unknown')} missing password_hash, skipping")
                continue
            
            valid_user = User(**user)
            valid_users.append(valid_user)
            print(f"👤 User: {valid_user.username}, Role: {valid_user.role}, Commesse: {getattr(valid_user, 'commesse_autorizzate', [])}, Sub-Agenzie: {getattr(valid_user, 'sub_agenzie_autorizzate', [])}")
        except Exception as e:
            print(f"Error processing user {user.get('username', 'unknown')}: {e}")
            continue
    
    print(f"✅ Returning {len(valid_users)} valid users")
    return valid_users

@router.get("/users/referenti/{unit_id}")
async def get_referenti_by_unit(unit_id: str, current_user: User = Depends(get_current_user)):
    """Get all referenti for a specific unit"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access this endpoint")
    
    referenti = await db.users.find({
        "role": "referente",
        "unit_id": unit_id,
        "is_active": True
    }).to_list(length=None)
    
    return [{"id": ref["id"], "username": ref["username"], "email": ref["email"]} for ref in referenti]

@router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    # Check permissions: ADMIN or RESPONSABILE_COMMESSA
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Only admin or responsabile commessa can update users")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # RESPONSABILE_COMMESSA restrictions
    if current_user.role == UserRole.RESPONSABILE_COMMESSA:
        # Cannot update themselves
        if user_id == current_user.id:
            raise HTTPException(status_code=403, detail="Cannot update your own account")
        
        # Cannot update ADMIN or other RESPONSABILE_COMMESSA
        user_role = user.get("role")
        if user_role in ["admin", "responsabile_commessa"]:
            raise HTTPException(status_code=403, detail=f"Cannot update user with role {user_role}")
        
        # Can only update users in their authorized commesse
        user_commesse = user.get("commesse_autorizzate", [])
        if not any(commessa in current_user.commesse_autorizzate for commessa in user_commesse):
            raise HTTPException(status_code=403, detail="User not in your authorized commesse")
        
        # Restrict role changes
        if user_update.role is not None:
            allowed_roles = [
                UserRole.AGENTE,
                UserRole.OPERATORE,
                UserRole.STORE_ASSIST,
                UserRole.AGENTE_SPECIALIZZATO,
                UserRole.PROMOTER_PRESIDI,
                UserRole.BACKOFFICE_COMMESSA,
                UserRole.BACKOFFICE_SUB_AGENZIA,
                UserRole.RESPONSABILE_SUB_AGENZIA,
                UserRole.AREA_MANAGER,
                UserRole.RESPONSABILE_PRESIDI
            ]
            if user_update.role not in allowed_roles:
                raise HTTPException(status_code=403, detail=f"Cannot change role to {user_update.role}")
        
        # Restrict commesse/servizi changes to only those they have access to
        if user_update.commesse_autorizzate is not None:
            unauthorized_commesse = set(user_update.commesse_autorizzate) - set(current_user.commesse_autorizzate)
            if unauthorized_commesse:
                raise HTTPException(status_code=403, detail="Cannot assign unauthorized commesse")
        
        if user_update.servizi_autorizzati is not None:
            if hasattr(current_user, 'servizi_autorizzati') and current_user.servizi_autorizzati:
                unauthorized_servizi = set(user_update.servizi_autorizzati) - set(current_user.servizi_autorizzati)
                if unauthorized_servizi:
                    raise HTTPException(status_code=403, detail="Cannot assign unauthorized servizi")
    
    # Check if username or email conflicts with other users (only if they are being updated)
    conflict_conditions = []
    if user_update.username is not None:
        conflict_conditions.append({"username": user_update.username})
    if user_update.email is not None:
        conflict_conditions.append({"email": user_update.email})
    
    if conflict_conditions:
        existing_user = await db.users.find_one({
            "$and": [
                {"id": {"$ne": user_id}},
                {"$or": conflict_conditions}
            ]
        })
        if existing_user:
            raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Validate provinces for agents (only if role is being updated to agent or provinces are being updated)
    if (user_update.role == UserRole.AGENTE and user_update.provinces is not None) or \
       (user_update.provinces is not None and user.get("role") == "agente"):
        provinces_to_validate = user_update.provinces if user_update.provinces is not None else []
        invalid_provinces = [p for p in provinces_to_validate if p not in ITALIAN_PROVINCES]
        if invalid_provinces:
            raise HTTPException(status_code=400, detail=f"Invalid provinces: {invalid_provinces}")
    
    # Prepare update data - only include fields that are not None
    update_data = {}
    for field, value in user_update.dict().items():
        if value is not None:
            if field == "password":
                # Handle password hashing
                update_data["password_hash"] = get_password_hash(value)
                # Force password change on next login when admin resets password
                update_data["password_change_required"] = True
                update_data["password_last_changed"] = None  # Clear last changed date
                print(f"🔐 Password reset by {current_user.username} for user {user_id} - password_change_required set to True")
            else:
                update_data[field] = value
    
    # Area Manager: Auto-populate commesse_autorizzate and servizi_autorizzati from assigned sub agenzie (if sub_agenzie_autorizzate changed or role changed to area_manager)
    is_becoming_area_manager = user_update.role == UserRole.AREA_MANAGER
    is_already_area_manager = user.get("role") == "area_manager"
    sub_agenzie_changed = user_update.sub_agenzie_autorizzate is not None
    
    if (is_becoming_area_manager or is_already_area_manager) and sub_agenzie_changed:
        # Get sub agenzie to use (new ones if provided, otherwise existing ones)
        sub_agenzie_to_use = user_update.sub_agenzie_autorizzate if user_update.sub_agenzie_autorizzate is not None else user.get("sub_agenzie_autorizzate", [])
        
        if sub_agenzie_to_use:
            # Get all commesse and servizi from assigned sub agenzie
            sub_agenzie_docs = await db.sub_agenzie.find({
                "id": {"$in": sub_agenzie_to_use},
                "is_active": True
            }).to_list(length=None)
            
            # Collect all commesse and servizi from these sub agenzie
            all_commesse = set()
            all_servizi = set()
            for sub_agenzia in sub_agenzie_docs:
                sub_commesse = sub_agenzia.get("commesse_autorizzate", [])
                sub_servizi = sub_agenzia.get("servizi_autorizzati", [])
                all_commesse.update(sub_commesse)
                all_servizi.update(sub_servizi)
            
            update_data["commesse_autorizzate"] = list(all_commesse)
            update_data["servizi_autorizzati"] = list(all_servizi)
            print(f"🌍 AREA MANAGER UPDATE AUTO-POPULATION: User {user_id} - Sub Agenzie: {len(sub_agenzie_to_use)}, Commesse: {len(update_data['commesse_autorizzate'])}, Servizi: {len(update_data['servizi_autorizzati'])}")
        else:
            update_data["commesse_autorizzate"] = []
            update_data["servizi_autorizzati"] = []
    
    # 🔧 Coerenza: se vengono aggiornati servizi_autorizzati, garantiamo che le
    # commesse parent dei servizi siano presenti in commesse_autorizzate.
    # Senza questo, il frontend di creazione cliente non mostra mai il servizio
    # perché filtra prima per commessa autorizzata.
    if "servizi_autorizzati" in update_data and update_data["servizi_autorizzati"]:
        srv_ids = update_data["servizi_autorizzati"]
        srvs = await db.servizi.find(
            {"id": {"$in": srv_ids}}, {"_id": 0, "id": 1, "commessa_id": 1}
        ).to_list(length=None)
        parent_commesse = {s.get("commessa_id") for s in srvs if s.get("commessa_id")}
        if parent_commesse:
            existing_commesse = set(
                update_data.get("commesse_autorizzate")
                if "commesse_autorizzate" in update_data
                else (user.get("commesse_autorizzate", []) or [])
            )
            merged_commesse = list(existing_commesse | parent_commesse)
            if set(merged_commesse) != existing_commesse:
                update_data["commesse_autorizzate"] = merged_commesse
                logging.info(
                    f"🔧 USER {user_id}: aggiunte commesse parent {parent_commesse - existing_commesse} "
                    f"per coerenza con i servizi autorizzati"
                )

    # 🧹 Coerenza inversa: solo per backoffice_sub_agenzia / responsabile_sub_agenzia,
    # se vengono aggiornati i servizi_autorizzati, rimuoviamo dalle commesse_autorizzate
    # quelle che non hanno più alcun servizio associato all'utente.
    # Richiesta utente: "quando gli tolgo i servizi associati all'utente deve togliere anche la commessa".
    target_role = update_data.get("role") or user.get("role")
    if (
        "servizi_autorizzati" in update_data
        and target_role in (UserRole.BACKOFFICE_SUB_AGENZIA, UserRole.RESPONSABILE_SUB_AGENZIA)
    ):
        final_servizi = update_data.get("servizi_autorizzati", []) or []
        final_commesse = list(
            update_data.get("commesse_autorizzate")
            if "commesse_autorizzate" in update_data
            else (user.get("commesse_autorizzate", []) or [])
        )
        if final_commesse:
            srvs = await db.servizi.find(
                {"id": {"$in": final_servizi}}, {"_id": 0, "id": 1, "commessa_id": 1}
            ).to_list(length=None) if final_servizi else []
            parent_commesse = {s.get("commessa_id") for s in srvs if s.get("commessa_id")}
            cleaned_commesse = [c for c in final_commesse if c in parent_commesse]
            removed = set(final_commesse) - set(cleaned_commesse)
            if removed:
                update_data["commesse_autorizzate"] = cleaned_commesse
                logging.info(
                    f"🧹 USER {user_id}: rimosse commesse senza servizi associati {removed}"
                )

    # Update user
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete users")
    
    # Don't allow deleting the current admin
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "User deleted successfully"}

@router.put("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can toggle user status")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow disabling the current admin
    if user["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    
    # Toggle the status
    new_status = not user["is_active"]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"User {'activated' if new_status else 'deactivated'} successfully", "is_active": new_status}

@router.get("/provinces")
async def get_provinces():
    return {"provinces": ITALIAN_PROVINCES}

# Unit management

