"""Modelli Pydantic ed Enum del CRM Nureal.

Estratti da server.py durante il refactoring (giugno 2026).
Importati in server.py con `from models import *`.
"""
import uuid
from datetime import datetime, timezone, timedelta, date
from enum import Enum
from typing import List, Optional, Dict, Any, Union

from pydantic import BaseModel, Field, EmailStr, ValidationError, model_validator

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"  # NEW: Supervisor per Unit - gestisce lead della sua Unit
    SUPER_REFERENTE = "super_referente"  # NEW: Vede multipli referenti e tutta la loro rete
    REFERENTE = "referente"
    AGENTE = "agente"
    # Nuovi ruoli specializzati per commesse e sub agenzie
    RESPONSABILE_COMMESSA = "responsabile_commessa"
    BACKOFFICE_COMMESSA = "backoffice_commessa" 
    RESPONSABILE_SUB_AGENZIA = "responsabile_sub_agenzia"
    BACKOFFICE_SUB_AGENZIA = "backoffice_sub_agenzia"
    AGENTE_SPECIALIZZATO = "agente_specializzato"  # agente che carica clienti legati a lui
    OPERATORE = "operatore"
    # Ruoli Store e Presidi  
    RESPONSABILE_STORE = "responsabile_store"
    STORE_ASSIST = "store_assist"
    RESPONSABILE_PRESIDI = "responsabile_presidi"
    PROMOTER_PRESIDI = "promoter_presidi"
    # Ruolo Area Manager
    AREA_MANAGER = "area_manager"

class LeadStatus(str, Enum):
    NUOVO = "nuovo"
    ASSEGNATO = "assegnato"
    CONTATTATO = "contattato"
    
class CallOutcome(str, Enum):
    FISSATO_APPUNTAMENTO = "FISSATO APPUNTAMENTO"
    KO = "KO"
    NR = "NR"
    RICHIAMARE = "RICHIAMARE"
    CONTRATTUALIZATO = "CONTRATTUALIZATO"
    IN_QUALIFICAZIONE_BOT = "In Qualificazione Bot"
    DA_CONTATTARE = "Da Contattare"

class HouseType(str, Enum):
    APPARTAMENTO = "appartamento"
    VILLA = "villa"
    CASA_INDIPENDENTE = "casa_indipendente"
    ALTRO = "altro"

# Entity Type Enum for Commesse and Users
class EntityType(str, Enum):
    CLIENTI = "clienti"
    LEAD = "lead"
    BOTH = "both"

# Document Management Enum
class DocumentManagement(str, Enum):
    DISABLED = "disabled"
    CLIENTI_ONLY = "clienti_only"
    LEAD_ONLY = "lead_only"
    BOTH = "both"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    password_hash: str  # Campo per la password hashata
    role: UserRole
    is_active: bool = True
    unit_id: Optional[str] = None
    sub_agenzia_id: Optional[str] = None  # Assegnazione diretta a sub agenzia
    referente_id: Optional[str] = None  # For agents only
    provinces: List[str] = []  # For agents - provinces they cover
    unit_autorizzate: List[str] = []  # NEW: For agents - units they can receive leads from
    referenti_autorizzati: List[str] = []  # NEW: For Super Referente - referenti they can manage
    # Nuovi campi per gestione autorizzazioni specializzate
    commesse_autorizzate: List[str] = []  # IDs commesse per responsabile/backoffice commessa
    servizi_autorizzati: List[str] = []   # IDs servizi specifici per la commessa
    sub_agenzie_autorizzate: List[str] = []  # IDs sub agenzie per responsabile/backoffice sub agenzia
    can_view_analytics: bool = False      # Se può vedere analytics (responsabili sì, backoffice no)
    entity_management: EntityType = EntityType.CLIENTI  # NEW: what entities this user can manage
    password_change_required: bool = True  # NEW: Force password change on first login
    password_last_changed: Optional[datetime] = None  # NEW: Track last password change for 90-day expiry
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    timezone: str = "Europe/Rome"  # NEW (giu 2026): fuso orario preferito dell'utente per display e filtri data

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole
    unit_id: Optional[str] = None
    sub_agenzia_id: Optional[str] = None  # Assegnazione diretta a sub agenzia
    referente_id: Optional[str] = None
    provinces: List[str] = []
    unit_autorizzate: List[str] = []  # NEW: Units agent can receive leads from
    referenti_autorizzati: List[str] = []  # NEW: For Super Referente
    # Nuovi campi per autorizzazioni specializzate
    commesse_autorizzate: List[str] = []
    servizi_autorizzati: List[str] = []
    sub_agenzie_autorizzate: List[str] = []
    can_view_analytics: Optional[bool] = None  # Auto-impostato in base al ruolo
    entity_management: EntityType = EntityType.CLIENTI  # NEW: specify what entities user can manage

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None  # Optional password for updates
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    unit_id: Optional[str] = None
    sub_agenzia_id: Optional[str] = None
    referente_id: Optional[str] = None
    provinces: Optional[List[str]] = None
    unit_autorizzate: Optional[List[str]] = None  # NEW: Units agent can receive leads from
    commesse_autorizzate: Optional[List[str]] = None
    servizi_autorizzati: Optional[List[str]] = None
    sub_agenzie_autorizzate: Optional[List[str]] = None
    referenti_autorizzati: Optional[List[str]] = None  # NEW: For Super Referente
    can_view_analytics: Optional[bool] = None
    password_change_required: Optional[bool] = None
    password_last_changed: Optional[datetime] = None  # NEW: For tracking password expiry
    timezone: Optional[str] = None  # NEW (giu 2026): fuso orario preferito dell'utente

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class AIUnit(BaseModel):  # AI/Assistant Unit model - renamed to avoid conflict with Lead Unit
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    webhook_url: str = Field(default_factory=lambda: f"/api/webhook/{str(uuid.uuid4())}")
    assistant_id: Optional[str] = None  # OpenAI Assistant ID for this unit
    commesse_autorizzate: List[str] = Field(default_factory=list)  # Lista ID commesse autorizzate
    servizi_autorizzati: List[str] = Field(default_factory=list)   # NEW: Lista ID servizi autorizzati
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AIUnitCreate(BaseModel):  # Renamed to avoid conflict with Lead Unit
    name: str
    description: Optional[str] = None
    assistant_id: Optional[str] = None
    commesse_autorizzate: List[str] = Field(default_factory=list)
    servizi_autorizzati: List[str] = Field(default_factory=list)   # NEW: Lista ID servizi autorizzati

class AIUnitUpdate(BaseModel):  # Renamed to avoid conflict with Lead Unit
    name: Optional[str] = None
    description: Optional[str] = None
    assistant_id: Optional[str] = None
    commesse_autorizzate: Optional[List[str]] = None
    servizi_autorizzati: Optional[List[str]] = None               # NEW: Lista ID servizi autorizzati

class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Short ID for reference
    nome: Optional[str] = None  # Made optional - Zapier might not send this
    cognome: Optional[str] = None  # Made optional - Zapier might not send this
    telefono: Optional[str] = None  # Made optional - Zapier might not send this
    email: Optional[str] = None  # Made optional - Zapier might not send this
    provincia: Optional[str] = None  # Made optional to fix validation errors
    tipologia_abitazione: Optional[str] = None  # Changed to string for dynamic values
    ip_address: Optional[str] = None
    indirizzo: Optional[str] = None  # NEW: Address
    otp: Optional[str] = None  # NEW: OTP code
    inserzione: Optional[str] = None  # NEW: Ad/Insertion
    regione: Optional[str] = None  # NEW: Region
    url: Optional[str] = None  # NEW: URL source
    campagna: Optional[str] = None  # Made optional to fix validation errors
    gruppo: Optional[str] = None  # Made optional to fix validation errors (unit_id)
    contenitore: Optional[str] = None  # Made optional to fix validation errors
    unit_id: Optional[str] = None  # NEW: Unit assignment
    unit_nome: Optional[str] = None  # NEW: Unit name for display (populated in response)
    commessa_id: Optional[str] = None  # NEW: Commessa assignment
    status: Optional[str] = None  # NEW: Dynamic status (not enum)
    privacy_consent: Optional[bool] = None  # None = non arrivato da Zapier, True/False = arrivato da Zapier
    marketing_consent: Optional[bool] = None  # None = non arrivato da Zapier, True/False = arrivato da Zapier
    assigned_agent_id: Optional[str] = None
    esito: Optional[str] = None  # Changed to string for dynamic values from lead_statuses
    esito_at_assignment: Optional[str] = None  # NEW: Status when lead was assigned (to track if worked)
    note: Optional[str] = None
    custom_fields: Dict[str, Any] = {}
    documents: List[str] = []  # URLs to stored documents
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_at: Optional[datetime] = None
    contacted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None  # NEW: When lead was closed
    tempo_gestione_minuti: Optional[int] = None  # NEW: Time to close in minutes

class LeadCreate(BaseModel):
    nome: Optional[str] = None  # Made optional - Zapier might not send this
    cognome: Optional[str] = None  # Made optional - Zapier might not send this
    telefono: Optional[str] = None  # Made optional - Zapier might not send this
    email: Optional[str] = None  # Made optional - Zapier might not send this
    provincia: Optional[str] = None  # Made optional to fix validation errors
    tipologia_abitazione: Optional[str] = None  # Changed to string for dynamic values
    ip_address: Optional[str] = None
    indirizzo: Optional[str] = None  # NEW: Address
    otp: Optional[str] = None  # NEW: OTP code
    inserzione: Optional[str] = None  # NEW: Ad/Insertion
    regione: Optional[str] = None  # NEW: Region
    url: Optional[str] = None  # NEW: URL source
    campagna: Optional[str] = None  # Made optional to fix validation errors
    gruppo: Optional[str] = None  # Made optional to fix validation errors
    contenitore: Optional[str] = None  # Made optional to fix validation errors
    unit_id: Optional[str] = None  # NEW: Unit assignment
    commessa_id: Optional[str] = None  # NEW: Commessa assignment
    status: Optional[str] = None  # NEW: Dynamic status
    privacy_consent: Optional[bool] = None  # None = non arrivato da Zapier, True/False = arrivato da Zapier
    marketing_consent: Optional[bool] = None  # None = non arrivato da Zapier, True/False = arrivato da Zapier
    custom_fields: Dict[str, Any] = {}

class LeadUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    campagna: Optional[str] = None
    provincia: Optional[str] = None
    tipologia_abitazione: Optional[str] = None  # Changed to string for dynamic values
    indirizzo: Optional[str] = None
    regione: Optional[str] = None
    url: Optional[str] = None
    otp: Optional[str] = None
    inserzione: Optional[str] = None
    privacy_consent: Optional[bool] = None
    marketing_consent: Optional[bool] = None
    status: Optional[str] = None  # Dynamic status from database
    esito: Optional[str] = None  # Changed to string for dynamic values from lead_statuses
    note: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None

# NEW: Unit model for lead management units
class Unit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    commessa_id: Optional[str] = None  # Legacy field for backward compatibility (deprecated)
    commesse_autorizzate: List[str] = []  # Multiple commesse support - this is now the primary field
    campagne_autorizzate: List[str] = []  # Campaign names this unit handles (optional, for filtering)
    assistant_id: Optional[str] = None  # OpenAI Assistant ID for this unit
    welcome_message: Optional[str] = None  # WhatsApp welcome message template for new leads
    auto_assign_enabled: bool = True  # NEW: Enable/disable automatic lead assignment by province
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class UnitCreate(BaseModel):
    nome: str
    commessa_id: Optional[str] = None  # Legacy field (optional for backward compatibility)
    commesse_autorizzate: List[str] = []  # Multiple commesse - primary field
    campagne_autorizzate: List[str] = []
    auto_assign_enabled: bool = True  # NEW: Enable/disable automatic assignment

class UnitUpdate(BaseModel):
    nome: Optional[str] = None
    commessa_id: Optional[str] = None
    commesse_autorizzate: Optional[List[str]] = None  # NEW: Additional commesse
    campagne_autorizzate: Optional[List[str]] = None
    auto_assign_enabled: Optional[bool] = None  # NEW: Enable/disable automatic assignment
    is_active: Optional[bool] = None
    assistant_id: Optional[str] = None  # NEW: OpenAI Assistant ID assignment
    welcome_message: Optional[str] = None  # NEW: WhatsApp welcome message template

# NEW: Dynamic Lead Status model
class LeadStatusModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    unit_id: Optional[str] = None  # If None, status is global
    ordine: int = 0  # Order for display
    colore: Optional[str] = None  # Hex color code
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadStatusCreate(BaseModel):
    nome: str
    unit_id: Optional[str] = None
    ordine: int = 0
    colore: Optional[str] = None

class LeadStatusUpdate(BaseModel):
    nome: Optional[str] = None
    ordine: Optional[int] = None
    colore: Optional[str] = None
    is_active: Optional[bool] = None

# Lead History/Audit Log Model
class LeadHistoryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    user_id: str
    username: str
    action: str  # "create", "update", "assign", "status_change", etc.
    changes: Dict[str, Any] = {}  # {field: {old: value, new: value}}
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None

class CustomField(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    field_type: str  # text, number, date, boolean, select
    options: List[str] = []  # For select type
    required: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomFieldCreate(BaseModel):
    name: str
    field_type: str
    options: List[str] = []
    required: bool = False


# ============================================================
# CLIENTE CUSTOM FIELDS (Fase 1) - Per (Commessa + Tipologia Contratto)
# ============================================================
class ClienteCustomField(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    commessa_id: str  # Required: which commessa this field applies to
    tipologia_contratto_id: str  # Required: which tipologia_contratto (UUID)
    section_id: Optional[str] = None  # FASE 2: link to ClienteCustomSection (null = default group)
    name: str  # Machine-readable name (e.g. "codice_cliente_esterno")
    label: str  # Display label (e.g. "Codice Cliente Esterno")
    field_type: str  # text, number, date, select, multi_select, checkbox, textarea, email, phone
    options: List[str] = []  # For select/multi_select
    placeholder: Optional[str] = None
    required: bool = False
    order: int = 0  # For display ordering
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ClienteCustomFieldCreate(BaseModel):
    commessa_id: str
    tipologia_contratto_id: str
    section_id: Optional[str] = None  # FASE 2
    name: str
    label: str
    field_type: str
    options: List[str] = []
    placeholder: Optional[str] = None
    required: bool = False
    order: int = 0


class ClienteCustomFieldUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[List[str]] = None
    placeholder: Optional[str] = None
    required: Optional[bool] = None
    order: Optional[int] = None
    active: Optional[bool] = None
    section_id: Optional[str] = None  # FASE 2: Nullable — allows moving field to a section


# ============================================================
# CLIENTE CUSTOM SECTIONS (Fase 2) - Per (Commessa + Tipologia Contratto)
# ============================================================
class ClienteCustomSection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    commessa_id: str
    tipologia_contratto_id: str
    name: str  # Display name (e.g. "Dati contratto avanzati")
    icon: Optional[str] = "📋"  # Emoji or icon string
    order: int = 0
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ClienteCustomSectionCreate(BaseModel):
    commessa_id: str
    tipologia_contratto_id: str
    name: str
    icon: Optional[str] = "📋"
    order: int = 0


class ClienteCustomSectionUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None


# ============================================================
# CLIENTE CUSTOM STATUSES (Fase 3) - Per (Commessa + Tipologia Contratto)
# Analytics-friendly: each status has a "stage" for funnel analytics.
# ============================================================
class StatusStage(str, Enum):
    NUOVO = "nuovo"
    IN_LAVORAZIONE = "in_lavorazione"
    CHIUSO_VINTO = "chiuso_vinto"
    CHIUSO_PERSO = "chiuso_perso"


class ClienteCustomStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    commessa_id: str
    tipologia_contratto_id: str
    name: str  # Display name (e.g. "Richiamo domani")
    value: str  # Machine/stored value (normalized, e.g. "richiamo_domani")
    color: str = "#6366f1"  # Hex color (default indigo-500)
    icon: Optional[str] = None  # Optional emoji
    stage: StatusStage = StatusStage.IN_LAVORAZIONE
    order: int = 0
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ClienteCustomStatusCreate(BaseModel):
    commessa_id: str
    tipologia_contratto_id: str
    name: str
    color: str = "#6366f1"
    icon: Optional[str] = None
    stage: StatusStage = StatusStage.IN_LAVORAZIONE
    order: int = 0


class ClienteCustomStatusUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    stage: Optional[StatusStage] = None
    order: Optional[int] = None
    active: Optional[bool] = None


class Container(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContainerCreate(BaseModel):
    name: str
    unit_id: str

class DocumentType(str, Enum):
    LEAD = "lead"
    CLIENTE = "clienti"  # Cambiato per allinearsi al frontend che invia "clienti"

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    
    # Support both Lead and Cliente documents
    document_type: DocumentType = DocumentType.LEAD
    lead_id: Optional[str] = None  # For Lead documents
    cliente_id: Optional[str] = None  # For Cliente documents
    
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    aruba_drive_file_id: Optional[str] = None
    aruba_drive_url: Optional[str] = None
    upload_status: str = "pending"  # pending, uploading, completed, failed
    download_count: int = 0
    last_downloaded_at: Optional[datetime] = None
    uploaded_by: str
    tags: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentUpload(BaseModel):
    document_type: DocumentType
    lead_id: Optional[str] = None
    cliente_id: Optional[str] = None
    uploaded_by: str

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    session_id: str  # Può essere unit_id o unit_id-user_id per chat private
    user_id: str
    message: str
    message_type: str = "user"  # user, assistant, system
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str  # Unique identifier per sessione
    unit_id: str
    participants: List[str] = []  # User IDs dei partecipanti
    session_type: str = "unit"  # unit, private, lead
    is_active: bool = True
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIConfiguration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    openai_api_key: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AIConfigurationCreate(BaseModel):
    openai_api_key: str

class OpenAIAssistant(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    model: str
    instructions: Optional[str] = None
    created_at: int

class WhatsAppConfiguration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str  # AGGIUNTO: Ogni Unit ha la sua configurazione WhatsApp
    phone_number: str  # Numero di telefono WhatsApp Business
    qr_code: Optional[str] = None  # QR Code data per connessione
    is_connected: bool = False
    connection_status: str = "disconnected"  # disconnected, connecting, connected
    last_seen: Optional[datetime] = None
    device_info: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class WhatsAppConfigurationCreate(BaseModel):
    phone_number: str
    unit_id: Optional[str] = None  # Opzionale, se None usa unit corrente

class WhatsAppMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_id: str = Field(default_factory=lambda: f"msg_{str(uuid.uuid4())[:12]}")
    lead_id: str  # Lead associato alla conversazione
    phone_number: str  # Numero WhatsApp del lead
    message: str
    message_type: str = "text"  # text, image, document, voice
    direction: str  # incoming, outgoing
    sender: str  # lead_phone, bot, agent_id
    status: str = "sent"  # sent, delivered, read, failed
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = {}

class WhatsAppConversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    phone_number: str
    contact_name: Optional[str] = None
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0
    status: str = "active"  # active, archived, blocked
    assigned_agent: Optional[str] = None
    bot_stage: Optional[str] = None  # bot conversation stage
    is_bot_active: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadWhatsAppValidation(BaseModel):
    lead_id: str
    phone_number: str
    is_whatsapp: Optional[bool] = None
    validation_status: str = "pending"  # pending, valid, invalid, error
    validation_date: Optional[datetime] = None

# Workflow Builder Models (FASE 3)
class Workflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    unit_id: str
    folder_id: Optional[str] = None  # NEW: organizzazione per cartelle
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_active: bool = True
    is_published: bool = False
    workflow_data: Optional[dict] = None  # Canvas layout and configuration
    nodes: Optional[list] = None  # Workflow nodes (for ReactFlow)
    edges: Optional[list] = None  # Workflow edges (for ReactFlow)
    trigger_type: Optional[str] = None  # Trigger type (e.g., "lead_created")
    version: Optional[int] = None  # Workflow version
    metadata: Optional[dict] = None  # Additional metadata


class WorkflowFolder(BaseModel):
    """Cartella per organizzare i workflow (es. WhatsApp, Calendari, Nutrimento)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    emoji: Optional[str] = None  # es. "📅", "🤖"
    color: Optional[str] = None  # hex, es. "#3b82f6"
    parent_id: Optional[str] = None  # supporta annidamento
    sort_order: int = 0
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class WorkflowFolderCreate(BaseModel):
    name: str
    emoji: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: int = 0


class WorkflowFolderUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class LeadTag(BaseModel):
    """Tag riusabile per leads (es. 'sorgente_sito_web', 'cliente_vip')."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # univoco (lowercase, no spazi)
    label: Optional[str] = None  # nome visualizzato
    color: Optional[str] = "#64748b"
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadTagCreate(BaseModel):
    name: str
    label: Optional[str] = None
    color: Optional[str] = "#64748b"
    description: Optional[str] = None


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    folder_id: Optional[str] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[str] = None  # supporta spostamento tra cartelle (None = root)
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    workflow_data: Optional[dict] = None
    nodes: Optional[list] = None  # NEW (giu 2026): persiste i nodi top-level letti da canvas/executor
    edges: Optional[list] = None  # NEW (giu 2026): persiste gli edge top-level

class WorkflowNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    node_type: str  # trigger, action, condition, delay
    node_subtype: str  # specific type like "form_submitted", "send_email"
    name: str
    position_x: int
    position_y: int
    configuration: Optional[dict] = None  # Node-specific settings
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkflowNodeCreate(BaseModel):
    node_type: str
    node_subtype: str
    name: str
    position_x: int
    position_y: int
    configuration: Optional[dict] = None

class WorkflowNodeUpdate(BaseModel):
    name: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    configuration: Optional[dict] = None

class NodeConnection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    source_node_id: str
    target_node_id: str
    source_handle: Optional[str] = None  # For conditional branches
    target_handle: Optional[str] = None
    condition_data: Optional[dict] = None  # For conditional connections
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NodeConnectionCreate(BaseModel):
    source_node_id: str
    target_node_id: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    condition_data: Optional[dict] = None

class WorkflowExecution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    contact_id: Optional[str] = None
    status: str = "pending"  # pending, running, completed, failed, cancelled, paused
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    current_node_id: Optional[str] = None
    execution_data: Optional[dict] = None  # Runtime variables and context
    error_message: Optional[str] = None
    retry_count: int = 0

class ExecutionStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    execution_id: str
    node_id: str
    step_order: int
    status: str  # pending, running, completed, failed
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    error_message: Optional[str] = None

class WorkflowExecutionCreate(BaseModel):
    contact_id: Optional[str] = None
    trigger_data: Optional[dict] = None

# Call Center Models
class CallStatus(str, Enum):
    QUEUED = "queued"
    RINGING = "ringing"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no-answer"
    CANCELED = "canceled"
    ABANDONED = "abandoned"

class CallDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

class AgentStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    BREAK = "break"
    TRAINING = "training"

class Call(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    call_sid: str  # Twilio Call SID
    direction: CallDirection
    from_number: str
    to_number: str
    agent_id: Optional[str] = None
    unit_id: str
    status: CallStatus = CallStatus.QUEUED
    priority: int = 1  # 1 = normal, 2 = high, 3 = urgent
    queue_time: Optional[datetime] = None
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: Optional[int] = None  # seconds
    recording_sid: Optional[str] = None
    recording_url: Optional[str] = None
    caller_country: Optional[str] = None
    caller_state: Optional[str] = None
    caller_city: Optional[str] = None
    disposition: Optional[str] = None  # resolved, escalated, callback_requested
    notes: Optional[str] = None
    satisfaction_score: Optional[int] = None  # 1-5 rating
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class CallCreate(BaseModel):
    direction: CallDirection
    from_number: str
    to_number: str
    unit_id: str
    priority: int = 1

class CallUpdate(BaseModel):
    status: Optional[CallStatus] = None
    agent_id: Optional[str] = None
    disposition: Optional[str] = None
    notes: Optional[str] = None
    satisfaction_score: Optional[int] = None

class AgentCallCenter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Reference to existing User model
    status: AgentStatus = AgentStatus.OFFLINE
    skills: List[str] = []  # e.g., ["sales", "support", "italian", "english"]
    languages: List[str] = ["italian"]
    department: str = "general"
    max_concurrent_calls: int = 1
    experience_score: int = 1  # 1-10 rating
    extension: Optional[str] = None
    last_activity: Optional[datetime] = None
    total_calls_today: int = 0
    calls_in_progress: int = 0
    avg_call_duration: Optional[float] = None
    customer_satisfaction: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AgentCreate(BaseModel):
    user_id: str
    skills: List[str] = []
    languages: List[str] = ["italian"]
    department: str = "general"
    max_concurrent_calls: int = 1
    extension: Optional[str] = None

class AgentUpdate(BaseModel):
    status: Optional[AgentStatus] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    department: Optional[str] = None
    max_concurrent_calls: Optional[int] = None
    extension: Optional[str] = None

class CallQueue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    description: Optional[str] = None
    skills_required: List[str] = []
    priority_weight: int = 1
    max_wait_time: int = 600  # seconds
    overflow_destination: Optional[str] = None  # queue name or voicemail
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CallQueueCreate(BaseModel):
    name: str
    unit_id: str
    description: Optional[str] = None
    skills_required: List[str] = []
    max_wait_time: int = 600

class CallRecording(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    call_sid: str
    recording_sid: str  # Twilio Recording SID
    agent_id: Optional[str] = None
    duration: Optional[int] = None  # seconds
    file_size: Optional[int] = None  # bytes
    storage_url: Optional[str] = None
    transcription: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed
    is_encrypted: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None

class OutboundCampaign(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    description: Optional[str] = None
    status: str = "draft"  # draft, active, paused, completed
    caller_id: str  # Phone number to use as caller ID
    total_contacts: int = 0
    contacted: int = 0
    connected: int = 0
    completed: int = 0
    script: Optional[str] = None
    schedule_start: Optional[datetime] = None
    schedule_end: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class OutboundContact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_id: str
    lead_id: Optional[str] = None  # If based on existing lead
    phone_number: str
    name: Optional[str] = None
    status: str = "pending"  # pending, called, answered, busy, no_answer, failed
    attempts: int = 0
    max_attempts: int = 3
    last_attempt: Optional[datetime] = None
    next_attempt: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PhoneNumber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone_number: str
    twilio_sid: str
    unit_id: str
    is_active: bool = True
    capabilities: List[str] = ["voice", "sms"]  # voice, sms, mms
    is_dynamic: bool = False  # For dynamic number rotation
    rotation_interval: Optional[int] = None  # minutes
    last_rotated: Optional[datetime] = None
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CallAnalytics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime
    unit_id: str
    total_calls: int = 0
    inbound_calls: int = 0
    outbound_calls: int = 0
    answered_calls: int = 0
    abandoned_calls: int = 0
    avg_wait_time: Optional[float] = None
    avg_call_duration: Optional[float] = None
    service_level_20s: Optional[float] = None  # % of calls answered within 20 seconds
    agent_utilization: Optional[float] = None
    customer_satisfaction: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Sistema Autorizzazioni Gerarchiche Models
class Commessa(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    descrizione: Optional[str] = None
    descrizione_interna: Optional[str] = None  # NEW: Internal detailed description
    webhook_zapier: str = Field(default_factory=lambda: f"https://hooks.zapier.com/hooks/catch/{uuid.uuid4().hex[:8]}/{uuid.uuid4().hex[:8]}/")  # NEW: Auto-generated webhook
    entity_type: EntityType = EntityType.CLIENTI  # NEW: what entity type this commessa manages
    
    # NEW: Feature flags
    has_whatsapp: bool = False  # NEW: Can use WhatsApp functionality
    has_ai: bool = False  # NEW: Can use AI features
    has_call_center: bool = False  # NEW: Can use call center
    
    # NEW: Document management configuration
    document_management: DocumentManagement = DocumentManagement.DISABLED  # NEW: Document access control
    
    # RESTORED: Aruba Drive configuration per commessa (filiera-specific)
    aruba_drive_config: Optional[Dict[str, Any]] = None  # Configurazione Aruba Drive specifica per filiera/commessa
    
    is_active: bool = True
    responsabile_id: Optional[str] = None  # User ID del Responsabile Commessa
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class CommessaCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    descrizione_interna: Optional[str] = None  # NEW
    entity_type: EntityType = EntityType.CLIENTI  # NEW
    
    # NEW: Feature configurations
    has_whatsapp: bool = False
    has_ai: bool = False
    has_call_center: bool = False
    document_management: DocumentManagement = DocumentManagement.DISABLED
    
    # RESTORED: Aruba Drive configuration per commessa
    aruba_drive_config: Optional[Dict[str, Any]] = None
    
    responsabile_id: Optional[str] = None

class CommessaUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    descrizione_interna: Optional[str] = None  # NEW
    entity_type: Optional[EntityType] = None  # NEW
    
    # NEW: Feature updates
    has_whatsapp: Optional[bool] = None
    has_ai: Optional[bool] = None
    has_call_center: Optional[bool] = None
    document_management: Optional[DocumentManagement] = None
    
    # RESTORED: Aruba Drive configuration per commessa
    aruba_drive_config: Optional[Dict[str, Any]] = None
    
    responsabile_id: Optional[str] = None
    is_active: Optional[bool] = None

class Servizio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    commessa_id: str
    nome: str
    descrizione: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServizioCreate(BaseModel):
    commessa_id: str
    nome: str
    descrizione: Optional[str] = None

class SubAgenzia(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    descrizione: Optional[str] = None
    responsabile_id: str  # User ID del responsabile della sub agenzia
    commesse_autorizzate: List[str] = []  # Lista di commessa_id autorizzate
    servizi_autorizzati: List[str] = []   # NEW: Lista di servizio_id autorizzati
    # NEW (feb 2026): privilegi gestiti dall'Admin
    can_change_status: bool = False  # Se True, gli utenti backoffice_sub_agenzia di questa sub agenzia possono modificare lo status dei clienti
    hidden_tipologie_for_bo_commessa: List[str] = []  # Nomi/label tipologie contratto i cui clienti (di questa sub agenzia) NON sono visibili ai backoffice_commessa
    is_active: bool = True
    created_by: str  # admin o responsabile_commessa che l'ha creata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class SubAgenziaCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    responsabile_id: str
    commesse_autorizzate: List[str] = []
    servizi_autorizzati: List[str] = []   # NEW: Lista di servizio_id autorizzati
    can_change_status: bool = False
    hidden_tipologie_for_bo_commessa: List[str] = []

class SubAgenziaUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    responsabile_id: Optional[str] = None
    commesse_autorizzate: Optional[List[str]] = None
    servizi_autorizzati: Optional[List[str]] = None   # NEW: Lista di servizio_id autorizzati
    can_change_status: Optional[bool] = None
    hidden_tipologie_for_bo_commessa: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ClienteStatus(str, Enum):
    INSERITO = "inserito"
    KO = "ko"
    INFOLINE = "infoline"
    INVIATA_CONSUMER = "inviata_consumer"
    PROBLEMATICHE_INSERIMENTO = "problematiche_inserimento"
    ATTESA_DOCUMENTI_CLIENTI = "attesa_documenti_clienti"
    NON_ACQUISIBILE_RICHIESTA_ESCALATION = "non_acquisibile_richiesta_escalation"
    IN_GESTIONE_STRUTTURA_CONSULENTE = "in_gestione_struttura_consulente"
    NON_RISPONDE = "non_risponde"
    PASSATA_AL_BO = "passata_al_bo"
    DA_INSERIRE = "da_inserire"
    INSERITO_SOTTO_ALTRO_CANALE = "inserito_sotto_altro_canale"
    PROVENIENTE_DA_ALTRO_CANALE = "proveniente_da_altro_canale"
    SCONTRINARE = "scontrinare"

# REMOVED: Static enums replaced with dynamic string fields to support user-created values
# TipologiaContratto and Segmento are now managed dynamically via database collections
# class TipologiaContratto(str, Enum):
#     ENERGIA_FASTWEB = "energia_fastweb"
#     TELEFONIA_FASTWEB = "telefonia_fastweb"
#     MOBILE_FASTWEB = "mobile_fastweb"
#     HO_MOBILE = "ho_mobile"
#     TELEPASS = "telepass"

# class Segmento(str, Enum):
#     PRIVATO = "privato"
#     BUSINESS = "business"

class TipoDocumento(str, Enum):
    CARTA_IDENTITA = "carta_identita"
    PATENTE = "patente"
    PASSAPORTO = "passaporto"

class Tecnologia(str, Enum):
    FIBRA = "fibra"
    NGN_GPON = "ngn_gpon"
    VULA = "vula"
    SVULA = "svula"
    BS_NGA = "bs_nga"
    BS_GPON = "bs_gpon"
    ADSL = "adsl"
    ADSL_WS = "adsl_ws"
    FWA = "fwa"

class ModalitaPagamento(str, Enum):
    IBAN = "iban"
    CARTA_CREDITO = "carta_credito"

class EnergiaTipologia(str, Enum):
    SWITCH = "Switch"
    SWITCH_CON_VOLTURA = "Switch con voltura"
    SUBENTRO = "Subentro"
    NUOVO_ALLACCIO = "Nuovo Allaccio"

# Sigle Province Italiane per dropdown
PROVINCE_ITALIANE = [
    "AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ", 
    "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN", 
    "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT", 
    "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "VS", "ME", "MI", "MO", "MB", "NA", 
    "NO", "NU", "OG", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT", 
    "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "SS", "SV", "SI", 
    "SR", "SO", "TA", "TE", "TR", "TO", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC", 
    "VR", "VV", "VI", "VT"
]

class ConvergenzaItem(BaseModel):
    numero_cellulare: Optional[str] = None
    iccid: Optional[str] = None
    operatore: Optional[str] = None
    offerta_sim: Optional[str] = None
    assigned_user_id: Optional[str] = None  # NEW: User assigned to this specific SIM

class MobileItem(BaseModel):
    telefono_da_portare: Optional[str] = None
    iccid: Optional[str] = None
    operatore: Optional[str] = None
    titolare_diverso: Optional[str] = None

class Cliente(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Short ID
    
    # Campi base sempre presenti
    numero_ordine: Optional[str] = None
    account: Optional[str] = None
    ragione_sociale: Optional[str] = None  # Solo se Business
    cognome: str  # Obbligatorio
    nome: str  # Obbligatorio
    data_nascita: Optional[str] = None  # Changed from date to str to fix BSON serialization
    luogo_nascita: Optional[str] = None
    comune_residenza: Optional[str] = None
    provincia: Optional[str] = None  # Sigla provincia
    cap: Optional[str] = None
    indirizzo: Optional[str] = None
    indirizzo_attivazione: Optional[str] = None  # NEW: Indirizzo di attivazione servizio (se diverso da residenza)
    comune_attivazione: Optional[str] = None  # NEW: Comune di installazione/attivazione
    provincia_attivazione: Optional[str] = None  # NEW: Provincia di attivazione
    cap_attivazione: Optional[str] = None  # NEW: CAP di attivazione
    email: str  # Obbligatorio
    telefono: str  # Obbligatorio
    telefono2: Optional[str] = None
    partita_iva: Optional[str] = None  # Solo se Business
    codice_fiscale: str  # Obbligatorio
    
    # Documento
    tipo_documento: Optional[TipoDocumento] = None
    numero_documento: Optional[str] = None
    data_rilascio: Optional[str] = None  # Changed from date to str to fix BSON serialization
    luogo_rilascio: Optional[str] = None
    scadenza_documento: Optional[str] = None  # Changed from date to str to fix BSON serialization
    
    # Campi specifici Telefonia Fastweb
    tecnologia: Optional[Tecnologia] = None
    codice_migrazione: Optional[str] = None
    numero_portabilita: Optional[str] = None  # NEW: Numero Portabilità
    gestore: Optional[str] = None
    convergenza: bool = False
    convergenza_items: List[ConvergenzaItem] = []
    mobile_items: List[MobileItem] = []
    
    # Campi specifici Energia Fastweb  
    codice_pod: Optional[str] = None
    energia_tipologia: Optional[EnergiaTipologia] = None
    codice_pdr: Optional[str] = None
    energia_consumo_annuo: Optional[str] = None
    energia_potenza_contatore: Optional[str] = None
    energia_remi: Optional[str] = None
    energia_potenza_impegnata: Optional[str] = None
    energia_fornitore_attuale: Optional[str] = None  # NEW: Fornitore attuale (per switch)
    # Campi condizionali per "Switch con voltura"
    energia_vecchio_intestatario_nome: Optional[str] = None
    energia_vecchio_intestatario_cognome: Optional[str] = None
    energia_vecchio_intestatario_cf: Optional[str] = None
    
    # Campi specifici Telepass
    obu: Optional[str] = None
    
    # Modalità pagamento
    modalita_pagamento: Optional[ModalitaPagamento] = None
    iban: Optional[str] = None
    intestatario_diverso: Optional[str] = None
    numero_carta: Optional[str] = None
    mese_carta: Optional[str] = None
    anno_carta: Optional[str] = None
    
    # Note
    note: Optional[str] = None
    note_backoffice: Optional[str] = None  # Solo in modifica
    
    # Campi sistema esistenti
    commessa_id: str
    sub_agenzia_id: str
    servizio_id: Optional[str] = None
    tipologia_contratto: Optional[str] = None  # Dynamic field - accepts any user-created tipologia
    tipologia_contratto_id: Optional[str] = None  # ADDED: UUID for filtering offerte
    segmento: Optional[str] = None  # Dynamic field - accepts any user-created segmento (UUID or tipo)
    segmento_nome: Optional[str] = None  # ENRICHED: Human-readable segmento name for display
    offerta_id: Optional[str] = None  # ADDED: Offerta ID for displaying selected offer
    sub_offerta_id: Optional[str] = None  # NEW: Sotto-offerta ID (per offerte Vodafone con sotto-offerte)
    status: str = ClienteStatus.DA_INSERIRE.value  # Can be a ClienteStatus enum value OR a custom status value
    # ===== POST VENDITA FIELDS =====
    passed_to_post_vendita: bool = False  # Flag: cliente is visible in Post Vendita section
    post_vendita_status: Optional[str] = None  # Workflow status (configurabile per commessa)
    post_vendita_status_label: Optional[str] = None  # Etichetta umana dello status PV (cache per UI)
    post_vendita_status_updated_at: Optional[datetime] = None
    post_vendita_stage: Optional[str] = None  # 'lavorazione' | 'attivato' | 'ko' (derivato dallo status PV)
    codice_account: Optional[str] = None  # Codice account assegnato dal sistema esterno (compilato via import)
    # ===============================
    dati_aggiuntivi: Dict[str, Any] = {}
    created_by: str
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    last_contact: Optional[datetime] = None
    
    @model_validator(mode='before')
    @classmethod
    def convert_empty_strings_to_none(cls, data: Any) -> Any:
        """Convert empty strings to None for enum fields to prevent validation errors"""
        if isinstance(data, dict):
            enum_fields = ['tipo_documento', 'tecnologia', 'modalita_pagamento', 'energia_tipologia']
            for field in enum_fields:
                if field in data and data[field] == '':
                    data[field] = None
        return data

class ClienteCreate(BaseModel):
    # Campi base sempre presenti
    numero_ordine: Optional[str] = None
    account: Optional[str] = None
    codice_account: Optional[str] = None  # Codice account assegnato dal sistema esterno (compilato via import)
    ragione_sociale: Optional[str] = None  # Solo se Business
    cognome: str  # Obbligatorio
    nome: str  # Obbligatorio
    data_nascita: Optional[str] = None  # Changed from date to str to fix BSON serialization
    luogo_nascita: Optional[str] = None
    comune_residenza: Optional[str] = None
    provincia: Optional[str] = None  # Sigla provincia
    cap: Optional[str] = None
    indirizzo: Optional[str] = None
    indirizzo_attivazione: Optional[str] = None  # NEW: Indirizzo di attivazione servizio (se diverso da residenza)
    comune_attivazione: Optional[str] = None  # NEW: Comune di installazione/attivazione
    provincia_attivazione: Optional[str] = None  # NEW: Provincia di attivazione
    cap_attivazione: Optional[str] = None  # NEW: CAP di attivazione
    email: str  # Obbligatorio
    telefono: str  # Obbligatorio
    telefono2: Optional[str] = None
    partita_iva: Optional[str] = None  # Solo se Business
    codice_fiscale: str  # Obbligatorio
    
    # Documento
    tipo_documento: Optional[TipoDocumento] = None
    numero_documento: Optional[str] = None
    data_rilascio: Optional[str] = None  # Changed from date to str to fix BSON serialization
    luogo_rilascio: Optional[str] = None
    scadenza_documento: Optional[str] = None  # Changed from date to str to fix BSON serialization
    
    # Campi specifici Telefonia Fastweb
    tecnologia: Optional[Tecnologia] = None
    codice_migrazione: Optional[str] = None
    numero_portabilita: Optional[str] = None  # NEW: Numero Portabilità
    gestore: Optional[str] = None
    convergenza: bool = False
    convergenza_items: List[ConvergenzaItem] = []
    mobile_items: List[MobileItem] = []
    
    # Campi specifici Energia Fastweb  
    codice_pod: Optional[str] = None
    energia_tipologia: Optional[EnergiaTipologia] = None
    codice_pdr: Optional[str] = None
    energia_consumo_annuo: Optional[str] = None
    energia_potenza_contatore: Optional[str] = None
    energia_remi: Optional[str] = None
    energia_potenza_impegnata: Optional[str] = None
    energia_fornitore_attuale: Optional[str] = None  # NEW: Fornitore attuale (per switch)
    # Campi condizionali per "Switch con voltura"
    energia_vecchio_intestatario_nome: Optional[str] = None
    energia_vecchio_intestatario_cognome: Optional[str] = None
    energia_vecchio_intestatario_cf: Optional[str] = None
    
    # Campi specifici Telepass
    obu: Optional[str] = None
    
    # Modalità pagamento
    modalita_pagamento: Optional[ModalitaPagamento] = None
    iban: Optional[str] = None
    intestatario_diverso: Optional[str] = None
    numero_carta: Optional[str] = None
    mese_carta: Optional[str] = None
    anno_carta: Optional[str] = None
    
    # Note
    note: Optional[str] = None
    
    # Campi sistema esistenti
    commessa_id: str
    sub_agenzia_id: str
    servizio_id: Optional[str] = None
    tipologia_contratto: Optional[str] = None  # Dynamic field - accepts any user-created tipologia
    tipologia_contratto_id: Optional[str] = None  # ADDED: UUID for filtering offerte
    segmento: Optional[str] = None  # Dynamic field - accepts any user-created segmento
    offerta_id: Optional[str] = None  # ADDED: Offerta ID for displaying selected offer
    sub_offerta_id: Optional[str] = None  # NEW: Sotto-offerta ID (per offerte con sotto-offerte)
    assigned_to: Optional[str] = None  # NEW: User assigned to this client
    dati_aggiuntivi: Dict[str, Any] = {}
    
    @model_validator(mode='before')
    @classmethod
    def convert_empty_strings_to_none(cls, data: Any) -> Any:
        """Convert empty strings to None for enum fields to prevent validation errors"""
        if isinstance(data, dict):
            enum_fields = ['tipo_documento', 'tecnologia', 'modalita_pagamento', 'energia_tipologia']
            for field in enum_fields:
                if field in data and data[field] == '':
                    data[field] = None
        return data

class ClienteUpdate(BaseModel):
    # Campi base sempre presenti
    numero_ordine: Optional[str] = None
    account: Optional[str] = None
    ragione_sociale: Optional[str] = None
    cognome: Optional[str] = None
    nome: Optional[str] = None
    data_nascita: Optional[str] = None  # Changed from date to str to fix BSON serialization
    luogo_nascita: Optional[str] = None
    comune_residenza: Optional[str] = None
    provincia: Optional[str] = None
    cap: Optional[str] = None
    indirizzo: Optional[str] = None
    indirizzo_attivazione: Optional[str] = None  # NEW: Indirizzo di attivazione servizio (se diverso da residenza)
    comune_attivazione: Optional[str] = None  # NEW: Comune di installazione/attivazione
    provincia_attivazione: Optional[str] = None  # NEW: Provincia di attivazione
    cap_attivazione: Optional[str] = None  # NEW: CAP di attivazione
    email: Optional[str] = None  # Fix feb 2026: reso opzionale — l'EditClienteModal manda payload parziale e ClienteUpdate restituiva 422 sui PUT senza email (es. cambio status da BO Sub Agenzia)
    telefono: Optional[str] = None
    telefono2: Optional[str] = None
    partita_iva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    
    # Documento
    tipo_documento: Optional[TipoDocumento] = None
    numero_documento: Optional[str] = None
    data_rilascio: Optional[str] = None  # Changed from date to str to fix BSON serialization
    luogo_rilascio: Optional[str] = None
    scadenza_documento: Optional[str] = None  # Changed from date to str to fix BSON serialization
    
    # Campi specifici Telefonia Fastweb
    tecnologia: Optional[Tecnologia] = None
    codice_migrazione: Optional[str] = None
    numero_portabilita: Optional[str] = None  # NEW: Numero Portabilità
    gestore: Optional[str] = None
    convergenza: Optional[bool] = None
    convergenza_items: Optional[List[ConvergenzaItem]] = None
    mobile_items: Optional[List[MobileItem]] = None
    
    # Campi specifici Energia Fastweb
    codice_pod: Optional[str] = None
    energia_tipologia: Optional[EnergiaTipologia] = None
    codice_pdr: Optional[str] = None
    energia_consumo_annuo: Optional[str] = None
    energia_potenza_contatore: Optional[str] = None
    energia_remi: Optional[str] = None
    energia_potenza_impegnata: Optional[str] = None
    # Campi condizionali per "Switch con voltura"
    energia_vecchio_intestatario_nome: Optional[str] = None
    energia_vecchio_intestatario_cognome: Optional[str] = None
    energia_vecchio_intestatario_cf: Optional[str] = None
    
    # Campi specifici Telepass
    obu: Optional[str] = None
    
    # Modalità pagamento
    modalita_pagamento: Optional[ModalitaPagamento] = None
    iban: Optional[str] = None
    intestatario_diverso: Optional[str] = None
    numero_carta: Optional[str] = None
    mese_carta: Optional[str] = None
    anno_carta: Optional[str] = None
    
    # Note
    note: Optional[str] = None
    note_backoffice: Optional[str] = None
    
    # Campi sistema esistenti
    sub_agenzia_id: Optional[str] = None  # ADDED: per consentire spostamento cliente tra sub agenzie (admin / responsabile_commessa / backoffice_commessa)
    servizio_id: Optional[str] = None
    tipologia_contratto: Optional[str] = None  # Dynamic field - accepts any user-created tipologia
    tipologia_contratto_id: Optional[str] = None  # ADDED: UUID for filtering offerte
    segmento: Optional[str] = None  # Dynamic field - accepts any user-created segmento
    offerta_id: Optional[str] = None  # ADDED: Offerta ID for displaying selected offer
    sub_offerta_id: Optional[str] = None  # NEW: Sotto-offerta ID
    status: Optional[str] = None  # Can be a ClienteStatus enum value OR a custom status value
    # ===== POST VENDITA FIELDS =====
    passed_to_post_vendita: Optional[bool] = None
    post_vendita_status: Optional[str] = None
    codice_account: Optional[str] = None
    # ===============================
    note: Optional[str] = None
    dati_aggiuntivi: Optional[Dict[str, Any]] = None
    assigned_to: Optional[str] = None
    last_contact: Optional[datetime] = None
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @model_validator(mode='before')
    @classmethod
    def convert_empty_strings_to_none(cls, data: Any) -> Any:
        """Convert empty strings to None for enum fields to prevent validation errors"""
        if isinstance(data, dict):
            enum_fields = ['tipo_documento', 'tecnologia', 'modalita_pagamento', 'energia_tipologia']
            for field in enum_fields:
                if field in data and data[field] == '':
                    data[field] = None
        return data

# Modello risposta paginata per clienti
class ClientiPaginatedResponse(BaseModel):
    clienti: List[Cliente]
    total: int
    page: int
    page_size: int
    total_pages: int

class LeadsPaginatedResponse(BaseModel):
    leads: List[Lead]
    total: int
    page: int
    page_size: int
    total_pages: int

# Sistema di Audit Log per clienti
class ClienteLogAction(str, Enum):
    CREATED = "created"
    UPDATED = "updated" 
    STATUS_CHANGED = "status_changed"
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_DELETED = "document_deleted"
    ASSIGNED = "assigned"
    CONTACTED = "contacted"
    NOTE_ADDED = "note_added"

class ClienteLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente_id: str  # ID del cliente
    action: ClienteLogAction  # Tipo di azione
    description: str  # Descrizione dell'azione
    user_id: str  # ID dell'utente che ha eseguito l'azione
    user_name: str  # Nome dell'utente (per facilità di visualizzazione)
    user_role: str  # Ruolo dell'utente
    old_value: Optional[str] = None  # Valore precedente (per modifiche)
    new_value: Optional[str] = None  # Nuovo valore (per modifiche)
    metadata: Optional[Dict[str, Any]] = {}  # Metadati aggiuntivi
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None  # IP dell'utente (se disponibile)

class ClienteLogCreate(BaseModel):
    cliente_id: str
    action: ClienteLogAction
    description: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class UserCommessaAuthorization(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    commessa_id: str
    sub_agenzia_id: Optional[str] = None  # Se è assegnato a specifica sub agenzia
    role_in_commessa: UserRole
    can_view_all_agencies: bool = False  # Per BackOffice Commessa e Responsabile
    can_modify_clients: bool = False
    can_create_clients: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCommessaAuthorizationCreate(BaseModel):
    user_id: str
    commessa_id: str
    sub_agenzia_id: Optional[str] = None
    role_in_commessa: UserRole
    can_view_all_agencies: bool = False
    can_modify_clients: bool = False
    can_create_clients: bool = False

# Importazione Clienti Models
class ImportPreview(BaseModel):
    headers: List[str]
    sample_data: List[List[str]]
    total_rows: int
    file_type: str

class FieldMapping(BaseModel):
    csv_field: str
    client_field: str
    required: bool = False
    example_value: Optional[str] = None

class ImportConfiguration(BaseModel):
    commessa_id: str
    sub_agenzia_id: str
    field_mappings: List[FieldMapping]
    skip_header: bool = True
    skip_duplicates: bool = True
    validate_phone: bool = True
    validate_email: bool = True

class ImportResult(BaseModel):
    total_processed: int
    successful: int
    failed: int
    errors: List[str]
    created_client_ids: List[str]

# Tipologie Contratto Models
class TipologiaContrattoModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    descrizione: Optional[str] = None
    servizio_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    created_by: str

class TipologiaContrattoCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    servizio_id: Optional[str] = None
    is_active: bool = True

class TipologiaContrattoUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    servizio_id: Optional[str] = None
    is_active: Optional[bool] = None

# Segmento Models
class SegmentoType(str, Enum):
    PRIVATO = "privato"
    BUSINESS = "business"

class SegmentoModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: SegmentoType
    nome: str  # "Privato" or "Business"
    tipologia_contratto_id: str
    # NEW: Aruba Drive configuration per segmento (moved from Commessa level)
    aruba_config: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class SegmentoCreate(BaseModel):
    tipo: SegmentoType
    tipologia_contratto_id: str
    aruba_config: Optional[Dict[str, Any]] = None
    is_active: bool = True

class SegmentoUpdate(BaseModel):
    aruba_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

# Configurazione Aruba Drive specifica per segmento (moved from commessa level)
class SegmentoArubaDriveConfig(BaseModel):
    enabled: bool = False
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    root_folder_path: Optional[str] = None  # Cartella root per questo segmento
    auto_create_structure: bool = True  # Crea automaticamente la struttura cartelle
    folder_structure: Dict[str, Any] = {}  # Struttura cartelle personalizzata
    connection_timeout: int = 30
    upload_timeout: int = 60
    retry_attempts: int = 3

# Offerta Models
class OffertaModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    descrizione: Optional[str] = None
    commessa_id: Optional[str] = None  # ADDED: Link to commessa
    servizio_id: Optional[str] = None  # ADDED: Link to servizio
    tipologia_contratto_id: Optional[str] = None  # ADDED: Link to tipologia contratto
    segmento_id: str
    has_sub_offerte: bool = False  # NEW: Indica se questa offerta ha sotto-offerte
    parent_offerta_id: Optional[str] = None  # NEW: ID dell'offerta principale (se è una sotto-offerta)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    created_by: str

class OffertaCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    commessa_id: Optional[str] = None  # ADDED: Link to commessa
    servizio_id: Optional[str] = None  # ADDED: Link to servizio
    tipologia_contratto_id: Optional[str] = None  # ADDED: Link to tipologia contratto
    segmento_id: str
    has_sub_offerte: bool = False  # NEW: Indica se questa offerta avrà sotto-offerte
    parent_offerta_id: Optional[str] = None  # NEW: ID offerta principale (per sotto-offerte)
    is_active: bool = True

class OffertaUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    commessa_id: Optional[str] = None  # ADDED: Link to commessa
    servizio_id: Optional[str] = None  # ADDED: Link to servizio
    tipologia_contratto_id: Optional[str] = None  # ADDED: Link to tipologia contratto
    has_sub_offerte: Optional[bool] = None  # NEW: Aggiorna se ha sotto-offerte
    is_active: Optional[bool] = None

