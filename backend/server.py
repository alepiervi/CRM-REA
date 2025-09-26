from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from enum import Enum
import smtplib
# Email imports temporarily disabled
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import tempfile
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import aiofiles
# import magic  # Temporaneamente commentato per risolvere problema libmagic
import httpx
from typing import BinaryIO
import io
# Email imports removed - not used in current implementation
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Dial, Say, Record, Connect, Stream
from twilio.request_validator import RequestValidator
import pandas as pd
import numpy as np
# import aioredis  # Temporarily disabled due to version conflict
import json
from typing import Union

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT and Password hashing
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Aruba Drive Configuration
ARUBA_DRIVE_API_KEY = os.environ.get("ARUBA_DRIVE_API_KEY", "")
ARUBA_DRIVE_CLIENT_ID = os.environ.get("ARUBA_DRIVE_CLIENT_ID", "")
ARUBA_DRIVE_CLIENT_SECRET = os.environ.get("ARUBA_DRIVE_CLIENT_SECRET", "")
ARUBA_DRIVE_BASE_URL = os.environ.get("ARUBA_DRIVE_BASE_URL", "https://api.arubacloud.com")

# File Upload Configuration
UPLOAD_DIR = "./uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_FILE_TYPES = ["application/pdf"]

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# OpenAI ChatBot Configuration
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_API_KEY_SID = os.environ.get("TWILIO_API_KEY_SID", "")
TWILIO_API_KEY_SECRET = os.environ.get("TWILIO_API_KEY_SECRET", "")
DEFAULT_CALLER_ID = os.environ.get("DEFAULT_CALLER_ID", "")
WEBHOOK_BASE_URL = os.environ.get("WEBHOOK_BASE_URL", "https://localhost")
RECORDING_STORAGE_BUCKET = os.environ.get("RECORDING_STORAGE_BUCKET", "")
MAX_CALL_DURATION = int(os.environ.get("MAX_CALL_DURATION", "3600"))
CALL_RECORDING_ENABLED = os.environ.get("CALL_RECORDING_ENABLED", "true").lower() == "true"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="CRM Lead Management System", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Italian Provinces (110 provinces)
ITALIAN_PROVINCES = [
    "Agrigento", "Alessandria", "Ancona", "Arezzo", "Ascoli Piceno", "Asti", "Avellino", "Bari", 
    "Barletta-Andria-Trani", "Belluno", "Benevento", "Bergamo", "Biella", "Bologna", "Bolzano", 
    "Brescia", "Brindisi", "Cagliari", "Caltanissetta", "Campobasso", "Carbonia-Iglesias", "Caserta", 
    "Catania", "Catanzaro", "Chieti", "Como", "Cosenza", "Cremona", "Crotone", "Cuneo", "Enna", 
    "Fermo", "Ferrara", "Firenze", "Foggia", "Forlì-Cesena", "Frosinone", "Genova", "Gorizia", 
    "Grosseto", "Imperia", "Isernia", "L'Aquila", "La Spezia", "Latina", "Lecce", "Lecco", "Livorno", 
    "Lodi", "Lucca", "Macerata", "Mantova", "Massa-Carrara", "Matera", "Messina", "Milano", "Modena", 
    "Monza e Brianza", "Napoli", "Novara", "Nuoro", "Olbia-Tempio", "Oristano", "Padova", "Palermo", 
    "Parma", "Pavia", "Perugia", "Pesaro e Urbino", "Pescara", "Piacenza", "Pisa", "Pistoia", "Pordenone", 
    "Potenza", "Prato", "Ragusa", "Ravenna", "Reggio Calabria", "Reggio Emilia", "Rieti", "Rimini", 
    "Roma", "Rovigo", "Salerno", "Medio Campidano", "Sassari", "Savona", "Siena", "Siracusa", "Sondrio", 
    "Taranto", "Teramo", "Terni", "Torino", "Ogliastra", "Trapani", "Trento", "Treviso", "Trieste", 
    "Udine", "Varese", "Venezia", "Verbano-Cusio-Ossola", "Vercelli", "Verona", "Vibo Valentia", 
    "Vicenza", "Viterbo"
]

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    REFERENTE = "referente"
    AGENTE = "agente"
    # Nuovi ruoli specializzati per commesse e sub agenzie
    RESPONSABILE_COMMESSA = "responsabile_commessa"
    BACKOFFICE_COMMESSA = "backoffice_commessa" 
    RESPONSABILE_SUB_AGENZIA = "responsabile_sub_agenzia"
    BACKOFFICE_SUB_AGENZIA = "backoffice_sub_agenzia"
    AGENTE_SPECIALIZZATO = "agente_specializzato"  # agente che carica clienti legati a lui
    OPERATORE = "operatore"

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

class HouseType(str, Enum):
    APPARTAMENTO = "appartamento"
    VILLA = "villa"
    CASA_INDIPENDENTE = "casa_indipendente"
    ALTRO = "altro"

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
    # Nuovi campi per gestione autorizzazioni specializzate
    commesse_autorizzate: List[str] = []  # IDs commesse per responsabile/backoffice commessa
    servizi_autorizzati: List[str] = []   # IDs servizi specifici per la commessa
    sub_agenzie_autorizzate: List[str] = []  # IDs sub agenzie per responsabile/backoffice sub agenzia
    can_view_analytics: bool = False      # Se può vedere analytics (responsabili sì, backoffice no)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole
    unit_id: Optional[str] = None
    sub_agenzia_id: Optional[str] = None  # Assegnazione diretta a sub agenzia
    referente_id: Optional[str] = None
    provinces: List[str] = []
    # Nuovi campi per autorizzazioni specializzate
    commesse_autorizzate: List[str] = []
    servizi_autorizzati: List[str] = []
    sub_agenzie_autorizzate: List[str] = []
    can_view_analytics: Optional[bool] = None  # Auto-impostato in base al ruolo

class UserLogin(BaseModel):
    username: str
    password: str

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
    commesse_autorizzate: Optional[List[str]] = None
    servizi_autorizzati: Optional[List[str]] = None
    sub_agenzie_autorizzate: Optional[List[str]] = None
    can_view_analytics: Optional[bool] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Unit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    webhook_url: str = Field(default_factory=lambda: f"/api/webhook/{str(uuid.uuid4())}")
    assistant_id: Optional[str] = None  # OpenAI Assistant ID for this unit
    commesse_autorizzate: List[str] = Field(default_factory=list)  # Lista ID commesse autorizzate
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class UnitCreate(BaseModel):
    name: str
    description: Optional[str] = None
    assistant_id: Optional[str] = None
    commesse_autorizzate: List[str] = Field(default_factory=list)

class UnitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assistant_id: Optional[str] = None
    commesse_autorizzate: Optional[List[str]] = None

class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Short ID for reference
    nome: str
    cognome: str
    telefono: str
    email: Optional[EmailStr] = None
    provincia: str
    tipologia_abitazione: HouseType
    ip_address: Optional[str] = None
    campagna: str
    gruppo: str  # unit id
    contenitore: str
    privacy_consent: bool = False
    marketing_consent: bool = False
    assigned_agent_id: Optional[str] = None
    esito: Optional[CallOutcome] = None
    note: Optional[str] = None
    custom_fields: Dict[str, Any] = {}
    documents: List[str] = []  # URLs to stored documents
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_at: Optional[datetime] = None
    contacted_at: Optional[datetime] = None

class LeadCreate(BaseModel):
    nome: str
    cognome: str
    telefono: str
    email: Optional[EmailStr] = None
    provincia: str
    tipologia_abitazione: HouseType
    ip_address: Optional[str] = None
    campagna: str
    gruppo: str
    contenitore: str
    privacy_consent: bool = False
    marketing_consent: bool = False
    custom_fields: Dict[str, Any] = {}

class LeadUpdate(BaseModel):
    esito: Optional[CallOutcome] = None
    note: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None

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
    CLIENTE = "cliente"

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
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_active: bool = True
    is_published: bool = False
    workflow_data: Optional[dict] = None  # Canvas layout and configuration

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    workflow_data: Optional[dict] = None

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
    is_active: bool = True
    responsabile_id: Optional[str] = None  # User ID del Responsabile Commessa
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class CommessaCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    responsabile_id: Optional[str] = None

class CommessaUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
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
    is_active: bool = True
    created_by: str  # admin o responsabile_commessa che l'ha creata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class SubAgenziaCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = None
    responsabile_id: str
    commesse_autorizzate: List[str] = []

class SubAgenziaUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    responsabile_id: Optional[str] = None
    commesse_autorizzate: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ClienteStatus(str, Enum):
    NUOVO = "nuovo"
    IN_LAVORAZIONE = "in_lavorazione"
    CONTATTATO = "contattato"
    CONVERTITO = "convertito"

class TipologiaContratto(str, Enum):
    ENERGIA_FASTWEB = "energia_fastweb"
    TELEFONIA_FASTWEB = "telefonia_fastweb" 
    HO_MOBILE = "ho_mobile"
    TELEPASS = "telepass"

class Segmento(str, Enum):
    RESIDENZIALE = "residenziale"
    BUSINESS = "business"

class Cliente(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Short ID
    nome: str
    cognome: str
    email: Optional[EmailStr] = None
    telefono: str
    indirizzo: Optional[str] = None
    citta: Optional[str] = None
    provincia: Optional[str] = None
    cap: Optional[str] = None
    codice_fiscale: Optional[str] = None
    partita_iva: Optional[str] = None
    commessa_id: str
    sub_agenzia_id: str
    servizio_id: Optional[str] = None
    tipologia_contratto: Optional[TipologiaContratto] = None  # Nuovo campo
    segmento: Optional[Segmento] = None  # Nuovo campo
    status: ClienteStatus = ClienteStatus.NUOVO
    note: Optional[str] = None
    dati_aggiuntivi: Dict[str, Any] = {}  # Campi personalizzati per commessa
    created_by: str  # User ID di chi ha creato il cliente
    assigned_to: Optional[str] = None  # User ID assegnato per lavorazione
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    last_contact: Optional[datetime] = None

class ClienteCreate(BaseModel):
    nome: str
    cognome: str
    email: Optional[EmailStr] = None
    telefono: str
    indirizzo: Optional[str] = None
    citta: Optional[str] = None
    provincia: Optional[str] = None
    cap: Optional[str] = None
    codice_fiscale: Optional[str] = None
    partita_iva: Optional[str] = None
    commessa_id: str
    sub_agenzia_id: str
    servizio_id: Optional[str] = None
    tipologia_contratto: Optional[TipologiaContratto] = None  # Nuovo campo
    segmento: Optional[Segmento] = None  # Nuovo campo
    note: Optional[str] = None
    dati_aggiuntivi: Dict[str, Any] = {}

class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    indirizzo: Optional[str] = None
    citta: Optional[str] = None
    provincia: Optional[str] = None
    cap: Optional[str] = None
    codice_fiscale: Optional[str] = None
    partita_iva: Optional[str] = None
    servizio_id: Optional[str] = None
    tipologia_contratto: Optional[TipologiaContratto] = None  # Nuovo campo
    segmento: Optional[Segmento] = None  # Nuovo campo  
    status: Optional[ClienteStatus] = None
    note: Optional[str] = None
    dati_aggiuntivi: Optional[Dict[str, Any]] = None
    assigned_to: Optional[str] = None

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

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return User(**user)

# Autorizzazioni Gerarchiche Helper Functions
async def get_user_commessa_authorizations(user_id: str) -> List[UserCommessaAuthorization]:
    """Get all commessa authorizations for a user"""
    authorizations = await db.user_commessa_authorizations.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(length=None)
    return [UserCommessaAuthorization(**auth) for auth in authorizations]

async def check_commessa_access(user: User, commessa_id: str, required_permissions: List[str] = None) -> bool:
    """Check if user has access to a specific commessa"""
    # Admin sempre autorizzato
    if user.role == UserRole.ADMIN:
        return True
    
    # Controllo autorizzazioni specifiche per commessa
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return False
    
    # Se ci sono permessi specifici richiesti, controllarli
    if required_permissions:
        auth_obj = UserCommessaAuthorization(**authorization)
        for permission in required_permissions:
            if not getattr(auth_obj, permission, False):
                return False
    
    return True

async def get_user_accessible_commesse(user: User) -> List[str]:
    """Get list of commessa IDs accessible to user"""
    if user.role == UserRole.ADMIN:
        # Admin vede tutte le commesse
        commesse = await db.commesse.find({"is_active": True}).to_list(length=None)
        return [c["id"] for c in commesse]
    
    # Altri ruoli vedono solo commesse autorizzate
    authorizations = await db.user_commessa_authorizations.find({
        "user_id": user.id,
        "is_active": True
    }).to_list(length=None)
    return [auth["commessa_id"] for auth in authorizations]

async def get_user_accessible_sub_agenzie(user: User, commessa_id: str) -> List[str]:
    """Get list of sub agenzia IDs accessible to user for a specific commessa"""
    if user.role == UserRole.ADMIN:
        # Admin vede tutte le sub agenzie
        sub_agenzie = await db.sub_agenzie.find({
            "commesse_autorizzate": {"$in": [commessa_id]},
            "is_active": True
        }).to_list(length=None)
        return [sa["id"] for sa in sub_agenzie]
    
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return []
    
    auth_obj = UserCommessaAuthorization(**authorization)
    
    # Se può vedere tutte le agenzie (BackOffice Commessa, Responsabile)
    if auth_obj.can_view_all_agencies:
        sub_agenzie = await db.sub_agenzie.find({
            "commesse_autorizzate": {"$in": [commessa_id]},
            "is_active": True
        }).to_list(length=None)
        return [sa["id"] for sa in sub_agenzie]
    
    # Altrimenti solo la sua sub agenzia
    if auth_obj.sub_agenzia_id:
        return [auth_obj.sub_agenzia_id]
    
    return []

async def can_user_modify_cliente(user: User, cliente: Cliente) -> bool:
    """Check if user can modify a specific cliente"""
    if user.role == UserRole.ADMIN:
        return True
    
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": cliente.commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return False
    
    auth_obj = UserCommessaAuthorization(**authorization)
    
    # Deve avere permesso di modifica
    if not auth_obj.can_modify_clients:
        return False
    
    # Se può vedere tutte le agenzie, può modificare tutti i clienti
    if auth_obj.can_view_all_agencies:
        return True
    
    # Altrimenti solo clienti della sua sub agenzia
    return auth_obj.sub_agenzia_id == cliente.sub_agenzia_id

# Document Access Helper Functions
async def can_user_access_document(user: User, document: Document) -> bool:
    """Check if user can access a specific document"""
    if user.role == UserRole.ADMIN:
        return True
    
    # For Lead documents - existing logic
    if document.document_type == DocumentType.LEAD and document.lead_id:
        lead = await db.leads.find_one({"id": document.lead_id})
        if not lead:
            return False
        
        # Check if user has access to the lead's unit
        if user.role == UserRole.REFERENTE:
            return user.unit_id == lead.get("unit_id")
        elif user.role == UserRole.AGENTE:
            return user.id == lead.get("assigned_to") or user.unit_id == lead.get("unit_id")
    
    # For Cliente documents - new authorization logic
    elif document.document_type == DocumentType.CLIENTE and document.cliente_id:
        cliente = await db.clienti.find_one({"id": document.cliente_id})
        if not cliente:
            return False
        
        cliente_obj = Cliente(**cliente)
        
        # Check commessa access first
        if not await check_commessa_access(user, cliente_obj.commessa_id):
            return False
        
        # Check sub agenzia access
        authorization = await db.user_commessa_authorizations.find_one({
            "user_id": user.id,
            "commessa_id": cliente_obj.commessa_id,
            "is_active": True
        })
        
        if not authorization:
            return False
        
        auth_obj = UserCommessaAuthorization(**authorization)
        
        # If can view all agencies (BackOffice Commessa, Responsabile)
        if auth_obj.can_view_all_agencies:
            return True
        
        # Otherwise only own sub agenzia documents
        return auth_obj.sub_agenzia_id == cliente_obj.sub_agenzia_id
    
    return False

async def get_user_accessible_documents(user: User, document_type: Optional[DocumentType] = None) -> List[str]:
    """Get list of document IDs accessible to user"""
    if user.role == UserRole.ADMIN:
        query = {"is_active": True}
        if document_type:
            query["document_type"] = document_type
        documents = await db.documents.find(query).to_list(length=None)
        return [doc["id"] for doc in documents]
    
    accessible_doc_ids = []
    
    # Lead documents access
    if document_type is None or document_type == DocumentType.LEAD:
        if user.role == UserRole.REFERENTE:
            # Can access all leads in their unit
            leads = await db.leads.find({"unit_id": user.unit_id}).to_list(length=None)
            lead_ids = [lead["id"] for lead in leads]
            lead_docs = await db.documents.find({
                "document_type": DocumentType.LEAD,
                "lead_id": {"$in": lead_ids},
                "is_active": True
            }).to_list(length=None)
            accessible_doc_ids.extend([doc["id"] for doc in lead_docs])
            
        elif user.role == UserRole.AGENTE:
            # Can access assigned leads or all leads in unit
            leads = await db.leads.find({
                "$or": [
                    {"assigned_to": user.id},
                    {"unit_id": user.unit_id}
                ]
            }).to_list(length=None)
            lead_ids = [lead["id"] for lead in leads]
            lead_docs = await db.documents.find({
                "document_type": DocumentType.LEAD,
                "lead_id": {"$in": lead_ids},
                "is_active": True
            }).to_list(length=None)
            accessible_doc_ids.extend([doc["id"] for doc in lead_docs])
    
    # Cliente documents access
    if document_type is None or document_type == DocumentType.CLIENTE:
        accessible_commesse = await get_user_accessible_commesse(user)
        
        for commessa_id in accessible_commesse:
            accessible_sub_agenzie = await get_user_accessible_sub_agenzie(user, commessa_id)
            
            if accessible_sub_agenzie:
                # Get clienti for accessible sub agenzie
                clienti = await db.clienti.find({
                    "commessa_id": commessa_id,
                    "sub_agenzia_id": {"$in": accessible_sub_agenzie}
                }).to_list(length=None)
                
                cliente_ids = [cliente["id"] for cliente in clienti]
                
                # Get documents for these clienti
                cliente_docs = await db.documents.find({
                    "document_type": DocumentType.CLIENTE,
                    "cliente_id": {"$in": cliente_ids},
                    "is_active": True
                }).to_list(length=None)
                
                accessible_doc_ids.extend([doc["id"] for doc in cliente_docs])
    
    return accessible_doc_ids

# Importazione Clienti Helper Functions
async def parse_uploaded_file(file_content: bytes, filename: str) -> ImportPreview:
    """Parse uploaded CSV/Excel file and return preview"""
    try:
        # Determine file type
        file_extension = filename.lower().split('.')[-1]
        
        if file_extension == 'csv':
            # Try different encodings for CSV
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(io.BytesIO(file_content), encoding=encoding, nrows=1000)  # Limit preview
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("Unable to decode CSV file with common encodings")
                
        elif file_extension in ['xls', 'xlsx']:
            df = pd.read_excel(io.BytesIO(file_content), nrows=1000)  # Limit preview
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
        
        # Clean column names
        df.columns = df.columns.astype(str).str.strip()
        
        # Get headers
        headers = df.columns.tolist()
        
        # Get sample data (first 5 rows)
        sample_data = []
        for _, row in df.head(5).iterrows():
            sample_data.append([str(val) if pd.notna(val) else "" for val in row.values])
        
        return ImportPreview(
            headers=headers,
            sample_data=sample_data,
            total_rows=len(df),
            file_type=file_extension
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

def validate_cliente_data(data: dict, config: ImportConfiguration) -> tuple[bool, str]:
    """Validate cliente data according to configuration"""
    errors = []
    
    # Check required fields
    nome = data.get('nome', '').strip()
    cognome = data.get('cognome', '').strip()
    telefono = data.get('telefono', '').strip()
    
    if not nome:
        errors.append("Nome is required")
    if not cognome:
        errors.append("Cognome is required")
    if not telefono:
        errors.append("Telefono is required")
    
    # Validate phone if required
    if config.validate_phone and telefono:
        # Simple phone validation (can be enhanced)
        phone_clean = ''.join(filter(str.isdigit, telefono))
        if len(phone_clean) < 9 or len(phone_clean) > 15:
            errors.append(f"Invalid phone format: {telefono}")
    
    # Validate email if provided and validation is enabled
    email = data.get('email', '').strip()
    if config.validate_email and email:
        if '@' not in email or '.' not in email.split('@')[1]:
            errors.append(f"Invalid email format: {email}")
    
    return len(errors) == 0, "; ".join(errors)

async def process_import_batch(
    file_content: bytes,
    filename: str,
    config: ImportConfiguration,
    created_by: str
) -> ImportResult:
    """Process full import batch"""
    try:
        # Parse file
        file_extension = filename.lower().split('.')[-1]
        
        if file_extension == 'csv':
            # Try different encodings for CSV
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("Unable to decode CSV file")
                
        elif file_extension in ['xls', 'xlsx']:
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
        
        # Clean column names
        df.columns = df.columns.astype(str).str.strip()
        
        # Skip header if configured
        if config.skip_header:
            df = df.iloc[1:]
        
        # Create field mapping dictionary
        field_map = {fm.csv_field: fm.client_field for fm in config.field_mappings}
        
        results = ImportResult(
            total_processed=0,
            successful=0,
            failed=0,
            errors=[],
            created_client_ids=[]
        )
        
        # Process each row
        for index, row in df.iterrows():
            try:
                results.total_processed += 1
                
                # Map fields
                cliente_data = {}
                for csv_field, client_field in field_map.items():
                    if csv_field in df.columns:
                        value = row[csv_field]
                        if pd.notna(value) and str(value).strip():
                            cliente_data[client_field] = str(value).strip()
                
                # Add required fields
                cliente_data['commessa_id'] = config.commessa_id
                cliente_data['sub_agenzia_id'] = config.sub_agenzia_id
                
                # Validate data
                is_valid, error_msg = validate_cliente_data(cliente_data, config)
                if not is_valid:
                    results.failed += 1
                    results.errors.append(f"Row {index + 1}: {error_msg}")
                    continue
                
                # Check for duplicates if configured
                if config.skip_duplicates:
                    existing = await db.clienti.find_one({
                        "telefono": cliente_data.get('telefono'),
                        "commessa_id": config.commessa_id,
                        "sub_agenzia_id": config.sub_agenzia_id
                    })
                    if existing:
                        results.failed += 1
                        results.errors.append(f"Row {index + 1}: Duplicate phone number {cliente_data.get('telefono')}")
                        continue
                
                # Create cliente
                cliente = Cliente(
                    **cliente_data,
                    created_by=created_by
                )
                
                await db.clienti.insert_one(cliente.dict())
                results.successful += 1
                results.created_client_ids.append(cliente.id)
                
            except Exception as e:
                results.failed += 1
                results.errors.append(f"Row {index + 1}: {str(e)}")
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import processing error: {str(e)}")

# Aruba Drive Service Functions
class ArubadriveService:
    def __init__(self):
        self.api_key = ARUBA_DRIVE_API_KEY
        self.client_id = ARUBA_DRIVE_CLIENT_ID
        self.client_secret = ARUBA_DRIVE_CLIENT_SECRET
        self.base_url = ARUBA_DRIVE_BASE_URL
        self.access_token = None
        self.token_expires_at = None
    
    async def authenticate(self) -> bool:
        """Authenticate with Aruba Drive API"""
        if not self.api_key or not self.client_id or not self.client_secret:
            logging.warning("Aruba Drive credentials not configured")
            return False
            
        try:
            async with httpx.AsyncClient() as client:
                auth_data = {
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
                
                response = await client.post(
                    f"{self.base_url}/oauth2/token",
                    data=auth_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    self.access_token = token_data.get("access_token")
                    expires_in = token_data.get("expires_in", 3600)
                    self.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                    return True
        except Exception as e:
            logging.error(f"Aruba Drive authentication failed: {e}")
        
        return False
    
    async def get_headers(self) -> Dict[str, str]:
        """Get authenticated headers for API requests"""
        if not self.access_token or self._token_expired():
            await self.authenticate()
        
        return {
            "Authorization": f"Bearer {self.access_token}",
            "X-API-Key": self.api_key
        }
    
    def _token_expired(self) -> bool:
        """Check if current token has expired"""
        if not self.token_expires_at:
            return True
        return datetime.now(timezone.utc) >= self.token_expires_at
    
    async def upload_file(self, file_path: str, filename: str) -> Dict[str, Any]:
        """Upload file to Aruba Drive"""
        try:
            headers = await self.get_headers()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(file_path, "rb") as file_data:
                    files = {"file": (filename, file_data, "application/pdf")}
                    
                    # Remove Content-Type from headers for multipart upload
                    upload_headers = {k: v for k, v in headers.items() if k != "Content-Type"}
                    
                    response = await client.post(
                        f"{self.base_url}/storage/upload",
                        files=files,
                        headers=upload_headers
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    else:
                        raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
                        
        except Exception as e:
            logging.error(f"Aruba Drive upload failed: {e}")
            # For development, return mock response
            return {
                "file_id": f"mock_file_{uuid.uuid4()}",
                "download_url": f"https://mock.arubacloud.com/file/{uuid.uuid4()}",
                "status": "uploaded"
            }
    
    async def download_file(self, file_id: str) -> bytes:
        """Download file from Aruba Drive"""
        try:
            headers = await self.get_headers()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/storage/download/{file_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    return response.content
                else:
                    raise Exception(f"Download failed with status {response.status_code}")
                    
        except Exception as e:
            logging.error(f"Aruba Drive download failed: {e}")
            # Per sviluppo, ritorna contenuto mock PDF
            return b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'

# Document Service Functions
async def validate_uploaded_file(file) -> bool:
    """Validate uploaded file"""
    # Check file size
    if hasattr(file, 'size') and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE} bytes"
        )
    
    # Read file content for validation
    content = await file.read()
    await file.seek(0)  # Reset file pointer
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty files are not allowed")
    
    # Validate content type using python-magic (Temporaneamente disabilitato)
    # try:
    #     mime_type = magic.from_buffer(content, mime=True)
    #     if mime_type not in ALLOWED_FILE_TYPES:
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"File type {mime_type} not allowed. Supported types: {ALLOWED_FILE_TYPES}"
    #         )
    # except Exception as e:
    #     logging.warning(f"Could not detect MIME type: {e}, checking file extension")
        # Fallback to file extension check
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed"
            )
    
    return True

async def save_temporary_file(file) -> str:
    """Save uploaded file to temporary storage"""
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
    temp_filename = f"{file_id}{file_extension}"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)
    
    async with aiofiles.open(temp_path, "wb") as temp_file:
        content = await file.read()
        await temp_file.write(content)
    
    return temp_path

async def create_document_record(document_type: DocumentType, entity_id: str, file, aruba_response: Dict[str, Any], uploaded_by: str) -> Document:
    """Create database record for uploaded document"""
    # Reset file to get accurate size
    await file.seek(0)
    content = await file.read()
    file_size = len(content)
    await file.seek(0)  # Reset again
    
    document_data = {
        "document_type": document_type,
        "filename": f"{uuid.uuid4()}.pdf",
        "original_filename": file.filename or "document.pdf",
        "file_size": file_size,
        "content_type": getattr(file, 'content_type', "application/pdf"),
        "aruba_drive_file_id": aruba_response.get("file_id"),
        "aruba_drive_url": aruba_response.get("download_url"),
        "upload_status": "completed",
        "uploaded_by": uploaded_by
    }
    
    # Set specific ID field based on document type
    if document_type == DocumentType.LEAD:
        document_data["lead_id"] = entity_id
    elif document_type == DocumentType.CLIENTE:
        document_data["cliente_id"] = entity_id
    
    document = Document(**document_data)
    
    # Save to MongoDB
    await db.documents.insert_one(document.dict())
    
    return document

# Initialize Aruba Drive service
aruba_service = ArubadriveService()

# ChatBot Service
class ChatBotService:
    def __init__(self):
        self.api_key = EMERGENT_LLM_KEY
        self.active_chats = {}  # session_id -> LlmChat instance
    
    async def get_or_create_chat(self, session_id: str, unit_id: str) -> LlmChat:
        """Get existing chat or create new one for session"""
        if session_id not in self.active_chats:
            # Get unit info for context
            unit = await db.units.find_one({"id": unit_id})
            unit_name = unit["name"] if unit else "CRM Unit"
            
            system_message = f"""Sei un assistente AI per il sistema CRM di {unit_name}. 
            Il tuo ruolo è aiutare gli agenti e referenti con:
            - Analisi dei lead e suggerimenti per il follow-up
            - Strategie di comunicazione con i clienti  
            - Organizzazione del lavoro e priorità
            - Risposte a domande sui processi aziendali
            
            Rispoudi sempre in italiano e mantieni un tono professionale ma amichevole.
            Concentrati su consigli pratici e azionabili per migliorare le performance di vendita."""
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=system_message
            ).with_model("openai", "gpt-4o-mini")
            
            self.active_chats[session_id] = chat
        
        return self.active_chats[session_id]
    
    async def send_message(self, session_id: str, unit_id: str, message: str, user_id: str) -> str:
        """Send message to ChatBot and get response"""
        try:
            chat = await self.get_or_create_chat(session_id, unit_id)
            
            user_message = UserMessage(text=message)
            response = await chat.send_message(user_message)
            
            # Save user message to database
            user_msg = ChatMessage(
                unit_id=unit_id,
                session_id=session_id,
                user_id=user_id,
                message=message,
                message_type="user"
            )
            await db.chat_messages.insert_one(user_msg.dict())
            
            # Save assistant response to database
            assistant_msg = ChatMessage(
                unit_id=unit_id,
                session_id=session_id,
                user_id="assistant",
                message=response,
                message_type="assistant"
            )
            await db.chat_messages.insert_one(assistant_msg.dict())
            
            return response
            
        except Exception as e:
            logging.error(f"ChatBot error: {e}")
            return "Mi dispiace, ho riscontrato un errore. Riprova tra poco."
    
    async def get_chat_history(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
        """Get chat history for session"""
        messages = await db.chat_messages.find({
            "session_id": session_id
        }).sort("created_at", -1).limit(limit).to_list(length=None)
        
        # Reverse to get chronological order
        messages.reverse()
        return [ChatMessage(**msg) for msg in messages]
    
    async def create_session(self, unit_id: str, session_type: str = "unit", participants: List[str] = None) -> ChatSession:
        """Create new chat session"""
        session_id = f"{unit_id}-{session_type}-{str(uuid.uuid4())[:8]}"
        
        session = ChatSession(
            session_id=session_id,
            unit_id=unit_id,
            participants=participants or [],
            session_type=session_type
        )
        
        await db.chat_sessions.insert_one(session.dict())
        return session

# Initialize ChatBot service
chatbot_service = ChatBotService()

# Call Center Services
class TwilioService:
    """Service for managing Twilio Voice operations"""
    
    def __init__(self):
        if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
            self.client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        else:
            self.client = None
            logging.warning("Twilio credentials not configured")
        
        self.request_validator = RequestValidator(TWILIO_AUTH_TOKEN) if TWILIO_AUTH_TOKEN else None
    
    async def make_outbound_call(
        self,
        to_number: str,
        from_number: str = None,
        twiml_url: str = None
    ) -> Dict[str, Any]:
        """Make outbound call"""
        if not self.client:
            raise HTTPException(status_code=500, detail="Twilio not configured")
        
        try:
            call = self.client.calls.create(
                to=to_number,
                from_=from_number or DEFAULT_CALLER_ID,
                url=twiml_url or f"{WEBHOOK_BASE_URL}/api/call-center/voice/outbound-twiml"
            )
            
            return {
                "call_sid": call.sid,
                "status": call.status,
                "to": call.to,
                "from": call.from_
            }
        except Exception as e:
            logging.error(f"Error making outbound call: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Call failed: {str(e)}")
    
    async def update_call(self, call_sid: str, **kwargs) -> Dict[str, Any]:
        """Update call status or properties"""
        if not self.client:
            raise HTTPException(status_code=500, detail="Twilio not configured")
        
        try:
            call = self.client.calls(call_sid).update(**kwargs)
            return {
                "call_sid": call.sid,
                "status": call.status
            }
        except Exception as e:
            logging.error(f"Error updating call {call_sid}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")
    
    def validate_request(self, url: str, post_vars: dict, signature: str) -> bool:
        """Validate Twilio webhook request"""
        if not self.request_validator:
            return False
        return self.request_validator.validate(url, post_vars, signature)

class CallCenterService:
    """Service for managing call center operations"""
    
    def __init__(self):
        self.twilio_service = TwilioService()
        self.active_calls = {}  # In-memory cache for active calls
        self.agent_status = {}  # Agent availability cache
    
    async def create_call(self, call_data: CallCreate) -> Call:
        """Create new call record"""
        call = Call(**call_data.dict())
        call.queue_time = datetime.now(timezone.utc)
        
        # Insert into database
        await db.calls.insert_one(call.dict())
        
        # Add to active calls cache
        self.active_calls[call.call_sid] = call
        
        return call
    
    async def update_call_status(
        self,
        call_sid: str,
        status: CallStatus,
        **kwargs
    ) -> Optional[Call]:
        """Update call status and properties"""
        update_data = {"status": status, "updated_at": datetime.now(timezone.utc)}
        
        # Add additional fields
        for key, value in kwargs.items():
            if hasattr(Call, key):
                update_data[key] = value
        
        # Update database
        result = await db.calls.update_one(
            {"call_sid": call_sid},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            # Update cache
            if call_sid in self.active_calls:
                for key, value in update_data.items():
                    setattr(self.active_calls[call_sid], key, value)
            
            # Get updated call
            call_doc = await db.calls.find_one({"call_sid": call_sid})
            return Call(**call_doc) if call_doc else None
        
        return None
    
    async def get_call(self, call_sid: str) -> Optional[Call]:
        """Get call by SID"""
        # Check cache first
        if call_sid in self.active_calls:
            return self.active_calls[call_sid]
        
        # Query database
        call_doc = await db.calls.find_one({"call_sid": call_sid})
        return Call(**call_doc) if call_doc else None
    
    async def assign_agent_to_call(self, call_sid: str, agent_id: str) -> bool:
        """Assign agent to call"""
        update_result = await db.calls.update_one(
            {"call_sid": call_sid},
            {
                "$set": {
                    "agent_id": agent_id,
                    "answered_at": datetime.now(timezone.utc),
                    "status": CallStatus.IN_PROGRESS,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if update_result.modified_count > 0:
            # Update agent status
            await self.update_agent_status(agent_id, AgentStatus.BUSY)
            return True
        
        return False
    
    async def update_agent_status(self, agent_id: str, status: AgentStatus):
        """Update agent status"""
        await db.agent_call_center.update_one(
            {"user_id": agent_id},
            {
                "$set": {
                    "status": status,
                    "last_activity": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Update cache
        self.agent_status[agent_id] = {
            "status": status,
            "last_activity": datetime.now(timezone.utc)
        }
    
    async def get_available_agents(self, unit_id: str = None) -> List[AgentCallCenter]:
        """Get available agents"""
        query = {"status": AgentStatus.AVAILABLE}
        if unit_id:
            # Get users from this unit
            unit_users = await db.users.find({"unit_id": unit_id}).to_list(length=None)
            user_ids = [user["id"] for user in unit_users]
            query["user_id"] = {"$in": user_ids}
        
        agents = await db.agent_call_center.find(query).to_list(length=None)
        return [AgentCallCenter(**agent) for agent in agents]
    
    async def find_best_agent(
        self,
        skills_required: List[str] = None,
        unit_id: str = None
    ) -> Optional[AgentCallCenter]:
        """Find best available agent based on skills and load"""
        available_agents = await self.get_available_agents(unit_id)
        
        if not available_agents:
            return None
        
        # Filter by skills if specified
        if skills_required:
            qualified_agents = []
            for agent in available_agents:
                if all(skill in agent.skills for skill in skills_required):
                    qualified_agents.append(agent)
            available_agents = qualified_agents
        
        if not available_agents:
            return None
        
        # Select agent with lowest current load (simple algorithm)
        return min(available_agents, key=lambda a: a.calls_in_progress)

class ACDService:
    """Automatic Call Distribution service"""
    
    def __init__(self):
        self.call_center_service = CallCenterService()
        self.call_queues = {}  # Queue management
    
    async def route_incoming_call(
        self,
        call_sid: str,
        from_number: str,
        to_number: str,
        unit_id: str = None
    ) -> Dict[str, Any]:
        """Route incoming call to available agent"""
        
        # Create call record
        call_data = CallCreate(
            direction=CallDirection.INBOUND,
            from_number=from_number,
            to_number=to_number,
            unit_id=unit_id or "default"
        )
        call_data.call_sid = call_sid
        call = await self.call_center_service.create_call(call_data)
        
        # Find available agent
        agent = await self.call_center_service.find_best_agent(unit_id=unit_id)
        
        if agent:
            # Assign call to agent
            await self.call_center_service.assign_agent_to_call(call_sid, agent.user_id)
            
            return {
                "action": "connect_agent",
                "agent_id": agent.user_id,
                "call_sid": call_sid
            }
        else:
            # Queue the call
            await self.queue_call(call_sid, unit_id)
            
            return {
                "action": "queue_call",
                "message": "All agents are busy. Please hold.",
                "call_sid": call_sid
            }
    
    async def queue_call(self, call_sid: str, unit_id: str):
        """Add call to queue"""
        queue_name = f"queue_{unit_id}"
        
        if queue_name not in self.call_queues:
            self.call_queues[queue_name] = []
        
        self.call_queues[queue_name].append({
            "call_sid": call_sid,
            "queued_at": datetime.now(timezone.utc),
            "unit_id": unit_id
        })
        
        # Update call status
        await self.call_center_service.update_call_status(
            call_sid,
            CallStatus.QUEUED,
            queue_time=datetime.now(timezone.utc)
        )
    
    async def process_queue(self, unit_id: str = None):
        """Process queued calls when agents become available"""
        queue_name = f"queue_{unit_id}" if unit_id else "queue_default"
        
        if queue_name not in self.call_queues or not self.call_queues[queue_name]:
            return
        
        # Get next call in queue (FIFO)
        queued_call = self.call_queues[queue_name].pop(0)
        call_sid = queued_call["call_sid"]
        
        # Find available agent
        agent = await self.call_center_service.find_best_agent(unit_id=unit_id)
        
        if agent:
            # Assign agent to call
            await self.call_center_service.assign_agent_to_call(call_sid, agent.user_id)
            
            # TODO: Redirect call to agent using Twilio API
            return True
        else:
            # Put back in queue
            self.call_queues[queue_name].insert(0, queued_call)
            return False

# WhatsApp Business API Service
class WhatsAppService:
    """Comprehensive WhatsApp Business API service for CRM integration"""
    
    def __init__(self):
        self.api_key = os.environ.get("WHATSAPP_API_KEY", "")
        self.phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
        self.business_account_id = os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
        self.webhook_verify_token = os.environ.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
        self.redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        self.base_url = "https://graph.facebook.com/v18.0"
        self.redis = None
        
    async def get_redis(self):
        """Get Redis connection"""
        if not self.redis:
            try:
                # self.redis = await aioredis.from_url(self.redis_url)  # Temporarily disabled due to version conflict
                logging.warning("Redis connection disabled due to aioredis version conflict")
                self.redis = None
            except Exception as e:
                logging.warning(f"Redis connection failed: {e}")
                self.redis = None
        return self.redis
    
    def get_headers(self):
        """Get API headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def send_message(self, phone_number: str, message: str, message_type: str = "text") -> dict:
        """Send WhatsApp message"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            # Format phone number
            if not phone_number.startswith('+'):
                phone_number = f"+{phone_number.lstrip('0')}"
            
            payload = {
                "messaging_product": "whatsapp",
                "to": phone_number,
                "type": message_type
            }
            
            if message_type == "text":
                payload["text"] = {"body": message}
            elif message_type == "template":
                # For template messages (future enhancement)
                payload["template"] = {
                    "name": message,
                    "language": {"code": "it"}
                }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=self.get_headers())
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Store message in database
                    await self.store_message({
                        "phone_number": phone_number,
                        "message": message,
                        "message_type": message_type,
                        "direction": "outgoing",
                        "status": "sent",
                        "whatsapp_message_id": result.get("messages", [{}])[0].get("id", ""),
                        "timestamp": datetime.now(timezone.utc)
                    })
                    
                    return {"success": True, "message_id": result.get("messages", [{}])[0].get("id", "")}
                else:
                    logging.error(f"WhatsApp send failed: {response.status_code} - {response.text}")
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logging.error(f"WhatsApp send message error: {e}")
            return {"success": False, "error": str(e)}
    
    async def validate_phone_number(self, phone_number: str) -> dict:
        """Validate if phone number is on WhatsApp"""
        try:
            # For demo purposes, simulate validation
            # In production, use WhatsApp Business API validation endpoint
            
            # Store validation result
            redis = await self.get_redis()
            if redis:
                await redis.setex(f"whatsapp:validation:{phone_number}", 3600, "valid")
            
            # Mock validation - consider most numbers as valid WhatsApp numbers
            is_valid = not any(invalid in phone_number for invalid in ['000', '111', '999'])
            
            return {
                "phone_number": phone_number,
                "is_whatsapp": is_valid,
                "validation_status": "valid" if is_valid else "invalid",
                "validation_date": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logging.error(f"WhatsApp validation error: {e}")
            return {
                "phone_number": phone_number,
                "is_whatsapp": None,
                "validation_status": "error",
                "validation_date": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }
    
    async def generate_qr_code(self, unit_id: str = None) -> dict:
        """Generate WhatsApp QR code for connection simulation"""
        try:
            # For demo purposes, generate a mock QR code
            qr_data = f"whatsapp://connect/{unit_id or 'default'}_{int(datetime.now().timestamp())}"
            
            redis = await self.get_redis()
            if redis:
                # Store QR with 5-minute expiration
                await redis.setex(f"whatsapp:qr:{unit_id or 'default'}", 300, qr_data)
            
            return {
                "qr_code": qr_data,
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                "unit_id": unit_id
            }
            
        except Exception as e:
            logging.error(f"WhatsApp QR generation error: {e}")
            return {"error": str(e)}
    
    async def process_webhook(self, webhook_data: dict) -> dict:
        """Process incoming WhatsApp webhook"""
        try:
            entry = webhook_data.get("entry", [])
            if not entry:
                return {"success": True, "processed": 0}
            
            processed_count = 0
            
            for entry_item in entry:
                changes = entry_item.get("changes", [])
                
                for change in changes:
                    if change.get("field") == "messages":
                        messages = change.get("value", {}).get("messages", [])
                        
                        for message in messages:
                            await self.handle_incoming_message(message)
                            processed_count += 1
            
            return {"success": True, "processed": processed_count}
            
        except Exception as e:
            logging.error(f"WhatsApp webhook processing error: {e}")
            return {"success": False, "error": str(e)}
    
    async def handle_incoming_message(self, message_data: dict):
        """Handle individual incoming WhatsApp message"""
        try:
            phone_number = message_data.get("from", "")
            message_text = message_data.get("text", {}).get("body", "")
            message_id = message_data.get("id", "")
            timestamp = datetime.fromtimestamp(int(message_data.get("timestamp", 0)), tz=timezone.utc)
            
            # Store incoming message
            await self.store_message({
                "phone_number": phone_number,
                "message": message_text,
                "message_type": "text",
                "direction": "incoming",
                "status": "received",
                "whatsapp_message_id": message_id,
                "timestamp": timestamp
            })
            
            # Find associated lead
            lead = await db.leads.find_one({"telefono": phone_number})
            if lead:
                await self.process_lead_message(lead["id"], message_text, phone_number)
            else:
                # Create new lead from WhatsApp conversation
                await self.create_lead_from_whatsapp(phone_number, message_text)
                
        except Exception as e:
            logging.error(f"Handle incoming message error: {e}")
    
    async def process_lead_message(self, lead_id: str, message: str, phone_number: str):
        """Process message from existing lead"""
        try:
            # First check if there's an active qualification process
            qualification = await db.lead_qualifications.find_one({
                "lead_id": lead_id,
                "status": "active"
            })
            
            if qualification:
                # Process response through qualification bot
                processed = await lead_qualification_bot.process_lead_response(lead_id, message, "whatsapp")
                
                if processed:
                    logging.info(f"Processed qualification response from lead {lead_id}: {message}")
                    return
                else:
                    logging.warning(f"Could not process qualification response from lead {lead_id}")
            
            # If no active qualification or processing failed, use standard automated response
            response_message = await self.generate_automated_response(message, lead_id)
            
            if response_message:
                await self.send_message(phone_number, response_message)
                
            # Update lead status if needed
            await self.update_lead_from_message(lead_id, message)
            
        except Exception as e:
            logging.error(f"Process lead message error: {e}")
    
    async def generate_automated_response(self, message: str, lead_id: str) -> Optional[str]:
        """Generate automated response based on message content and lead stage"""
        try:
            message_lower = message.lower()
            
            # Simple keyword-based responses
            if any(word in message_lower for word in ['ciao', 'salve', 'buongiorno', 'buonasera']):
                return "Ciao! Grazie per averci contattato. Un nostro agente ti risponderà al più presto. Come possiamo aiutarti?"
            
            elif any(word in message_lower for word in ['prezzo', 'costo', 'quanto', 'tariffa']):
                return "Per informazioni sui prezzi e le nostre offerte, un consulente ti contatterà a breve per fornirti un preventivo personalizzato."
            
            elif any(word in message_lower for word in ['info', 'informazioni', 'dettagli']):
                return "Saremo felici di fornirti tutte le informazioni necessarie. Un nostro esperto ti contatterà entro 24 ore."
            
            elif any(word in message_lower for word in ['si', 'sì', 'interessato', 'interessata']):
                return "Perfetto! Abbiamo preso nota del tuo interesse. Ti contatteremo al più presto per discutere la soluzione migliore per te."
            
            elif any(word in message_lower for word in ['no', 'non interessato', 'non interessa']):
                return "Nessun problema, grazie per averci fatto sapere. Se in futuro dovessi cambiare idea, siamo sempre qui per aiutarti."
            
            # Default response only for first message of the day
            redis = await self.get_redis()
            if redis:
                last_response_key = f"whatsapp:last_response:{lead_id}"
                today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                
                last_response_date = await redis.get(last_response_key)
                if not last_response_date or last_response_date.decode() != today_key:
                    await redis.setex(last_response_key, 86400, today_key)  # 24 hours
                    return "Grazie per il tuo messaggio! Il nostro team ha ricevuto la tua comunicazione e ti risponderà al più presto."
            
            return None
            
        except Exception as e:
            logging.error(f"Generate automated response error: {e}")
            return None
    
    async def create_lead_from_whatsapp(self, phone_number: str, first_message: str):
        """Create new lead from WhatsApp conversation"""
        try:
            lead_data = {
                "id": str(uuid.uuid4()),
                "nome": "Contatto",
                "cognome": "WhatsApp",
                "telefono": phone_number,
                "email": f"whatsapp_{phone_number.replace('+', '')}@generated.com",
                "esito": "Da Contattare",
                "note": f"Primo messaggio WhatsApp: {first_message}",
                "created_at": datetime.now(timezone.utc),
                "source": "whatsapp",
                "unit_id": None  # Will be assigned by admin
            }
            
            await db.leads.insert_one(lead_data)
            
            # Send welcome message
            welcome_msg = "Benvenuto! Abbiamo ricevuto il tuo messaggio e creato la tua richiesta. Il nostro team ti contatterà al più presto per assisterti."
            await self.send_message(phone_number, welcome_msg)
            
            logging.info(f"Created new lead from WhatsApp: {phone_number}")
            
        except Exception as e:
            logging.error(f"Create lead from WhatsApp error: {e}")
    
    async def update_lead_from_message(self, lead_id: str, message: str):
        """Update lead status based on message content"""
        try:
            message_lower = message.lower()
            
            # Update lead status based on message sentiment
            if any(word in message_lower for word in ['interessato', 'si', 'sì', 'perfetto', 'va bene']):
                await db.leads.update_one(
                    {"id": lead_id},
                    {
                        "$set": {
                            "esito": "Interessato",
                            "updated_at": datetime.now(timezone.utc)
                        },
                        "$push": {
                            "note": f"WhatsApp: {message} (Auto-aggiornato)"
                        }
                    }
                )
            elif any(word in message_lower for word in ['no', 'non interessato', 'non interessa', 'stop']):
                await db.leads.update_one(
                    {"id": lead_id},
                    {
                        "$set": {
                            "esito": "Non Interessato",
                            "updated_at": datetime.now(timezone.utc)
                        },
                        "$push": {
                            "note": f"WhatsApp: {message} (Auto-aggiornato)"
                        }
                    }
                )
                
        except Exception as e:
            logging.error(f"Update lead from message error: {e}")
    
    async def store_message(self, message_data: dict):
        """Store WhatsApp message in database"""
        try:
            message_record = {
                "id": str(uuid.uuid4()),
                "phone_number": message_data["phone_number"],
                "message": message_data["message"],
                "message_type": message_data.get("message_type", "text"),
                "direction": message_data["direction"],
                "status": message_data.get("status", "sent"),
                "whatsapp_message_id": message_data.get("whatsapp_message_id", ""),
                "timestamp": message_data["timestamp"],
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.whatsapp_messages.insert_one(message_record)
            
            # Update conversation
            await self.update_conversation(message_data["phone_number"], message_data["message"])
            
        except Exception as e:
            logging.error(f"Store message error: {e}")
    
    async def update_conversation(self, phone_number: str, last_message: str):
        """Update or create WhatsApp conversation record"""
        try:
            # Find lead by phone number
            lead = await db.leads.find_one({"telefono": phone_number})
            lead_id = lead["id"] if lead else None
            
            # Update or create conversation
            await db.whatsapp_conversations.update_one(
                {"phone_number": phone_number},
                {
                    "$set": {
                        "lead_id": lead_id,
                        "last_message": last_message[:500],  # Truncate long messages
                        "last_message_time": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    },
                    "$inc": {"unread_count": 1}
                },
                upsert=True
            )
            
        except Exception as e:
            logging.error(f"Update conversation error: {e}")
    
    async def get_conversation_history(self, phone_number: str, limit: int = 50) -> List[dict]:
        """Get conversation history for phone number"""
        try:
            messages = await db.whatsapp_messages.find(
                {"phone_number": phone_number}
            ).sort("timestamp", -1).limit(limit).to_list(length=limit)
            
            return messages
            
        except Exception as e:
            logging.error(f"Get conversation history error: {e}")
            return []
    
    async def get_active_conversations(self, unit_id: str = None) -> List[dict]:
        """Get active WhatsApp conversations"""
        try:
            query = {"status": "active"}
            
            # If unit_id specified, filter by leads from that unit
            if unit_id:
                unit_leads = await db.leads.find({"unit_id": unit_id}).to_list(length=None)
                lead_ids = [lead["id"] for lead in unit_leads]
                query["lead_id"] = {"$in": lead_ids}
            
            conversations = await db.whatsapp_conversations.find(query)\
                .sort("last_message_time", -1).to_list(length=100)
            
            return conversations
            
        except Exception as e:
            logging.error(f"Get active conversations error: {e}")
            return []

# Initialize Call Center services
twilio_service = TwilioService()
call_center_service = CallCenterService()
acd_service = ACDService()

# Automated Lead Qualification System (FASE 4)
class LeadQualificationBot:
    """Automated lead qualification system with 12-hour timeout and auto-assignment"""
    
    def __init__(self):
        self.qualification_timeout = 12 * 60 * 60  # 12 hours in seconds
        self.bot_stages = {
            "initial": "initial_contact",
            "interest_check": "checking_interest", 
            "info_gathering": "gathering_info",
            "qualification": "qualifying_lead",
            "completed": "qualification_completed",
            "timeout": "bot_timeout",
            "agent_assigned": "agent_takeover"
        }
        
    async def start_qualification_process(self, lead_id: str):
        """Start automated qualification process for new lead"""
        try:
            lead = await db.leads.find_one({"id": lead_id})
            if not lead:
                logging.error(f"Lead {lead_id} not found for qualification")
                return
                
            # Initialize qualification record
            qualification_data = {
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "stage": "initial",
                "status": "active",
                "started_at": datetime.now(timezone.utc),
                "timeout_at": datetime.now(timezone.utc) + timedelta(hours=12),
                "responses": [],
                "score": 0,
                "qualification_data": {},
                "bot_messages_sent": 0,
                "lead_responses": 0
            }
            
            await db.lead_qualifications.insert_one(qualification_data)
            
            # Send initial qualification message
            await self.send_initial_message(lead_id, lead)
            
            # Schedule timeout check
            await self.schedule_timeout_check(lead_id)
            
            logging.info(f"Started qualification process for lead {lead_id}")
            
        except Exception as e:
            logging.error(f"Error starting qualification for lead {lead_id}: {e}")
    
    async def send_initial_message(self, lead_id: str, lead: dict):
        """Send initial qualification message to lead"""
        try:
            nome = lead.get("nome", "Cliente")
            phone_number = lead.get("telefono")
            
            if not phone_number:
                logging.warning(f"No phone number for lead {lead_id}, skipping qualification")
                return
            
            # Personalized initial message
            message = f"""Ciao {nome}! 👋

Grazie per averci contattato per informazioni sui nostri servizi.

Per offrirti la migliore assistenza possibile, vorrei farti alcune veloci domande:

1️⃣ Sei interessato/a a ricevere informazioni sui nostri servizi? (Rispondi SI o NO)

Il nostro team è qui per aiutarti! 😊"""

            # Send via WhatsApp if possible, otherwise log for manual follow-up
            if await self.is_whatsapp_available(lead_id):
                result = await whatsapp_service.send_message(phone_number, message)
                if result.get("success"):
                    await self.log_bot_message(lead_id, message, "whatsapp")
                else:
                    await self.log_bot_message(lead_id, message, "failed_whatsapp")
            else:
                # Log for manual follow-up by agents
                await self.log_bot_message(lead_id, message, "manual_followup")
                
            # Update lead status
            await db.leads.update_one(
                {"id": lead_id},
                {
                    "$set": {
                        "esito": "In Qualificazione Bot",
                        "bot_qualification_active": True,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
        except Exception as e:
            logging.error(f"Error sending initial qualification message for lead {lead_id}: {e}")
    
    async def process_lead_response(self, lead_id: str, message: str, source: str = "whatsapp"):
        """Process lead response during qualification"""
        try:
            # Get qualification record
            qualification = await db.lead_qualifications.find_one({"lead_id": lead_id, "status": "active"})
            if not qualification:
                return False
                
            # Check if still within timeout
            if datetime.now(timezone.utc) > qualification["timeout_at"]:
                await self.handle_qualification_timeout(lead_id)
                return False
                
            current_stage = qualification["stage"]
            message_lower = message.lower().strip()
            
            # Log the response
            response_data = {
                "message": message,
                "timestamp": datetime.now(timezone.utc),
                "source": source,
                "stage": current_stage
            }
            
            await db.lead_qualifications.update_one(
                {"lead_id": lead_id},
                {
                    "$push": {"responses": response_data},
                    "$inc": {"lead_responses": 1}
                }
            )
            
            # Process response based on current stage
            next_stage = await self.evaluate_response(lead_id, current_stage, message_lower)
            
            if next_stage:
                await self.advance_to_stage(lead_id, next_stage, message_lower)
                
            return True
            
        except Exception as e:
            logging.error(f"Error processing lead response for {lead_id}: {e}")
            return False
    
    async def evaluate_response(self, lead_id: str, current_stage: str, message: str) -> Optional[str]:
        """Evaluate lead response and determine next stage"""
        try:
            positive_responses = ['si', 'sì', 'yes', 'interessato', 'interessata', 'ok', 'va bene', 'perfetto']
            negative_responses = ['no', 'non interessato', 'non interessa', 'stop', 'basta', 'non ora']
            
            if current_stage == "initial":
                if any(word in message for word in positive_responses):
                    return "interest_check"
                elif any(word in message for word in negative_responses):
                    return "completed"  # Not interested
                else:
                    return "interest_check"  # Assume interest for unclear responses
                    
            elif current_stage == "interest_check":
                return "info_gathering"
                
            elif current_stage == "info_gathering":
                return "qualification"
                
            elif current_stage == "qualification":
                return "completed"
                
            return None
            
        except Exception as e:
            logging.error(f"Error evaluating response for lead {lead_id}: {e}")
            return None
    
    async def advance_to_stage(self, lead_id: str, next_stage: str, last_response: str):
        """Advance qualification to next stage"""
        try:
            # Update qualification record
            await db.lead_qualifications.update_one(
                {"lead_id": lead_id},
                {
                    "$set": {
                        "stage": next_stage,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Send appropriate message for the new stage
            await self.send_stage_message(lead_id, next_stage, last_response)
            
        except Exception as e:
            logging.error(f"Error advancing lead {lead_id} to stage {next_stage}: {e}")
    
    async def send_stage_message(self, lead_id: str, stage: str, last_response: str = ""):
        """Send message appropriate for current qualification stage"""
        try:
            lead = await db.leads.find_one({"id": lead_id})
            nome = lead.get("nome", "Cliente")
            phone_number = lead.get("telefono")
            
            message = ""
            
            if stage == "interest_check":
                if any(word in last_response for word in ['si', 'sì', 'interessato']):
                    message = f"""Perfetto {nome}! 🎉

Per poterti offrire la soluzione migliore, dimmi:

2️⃣ In che tipo di abitazione vivi?
A) Appartamento
B) Villa/Casa indipendente 
C) Altro

Scrivi semplicemente la lettera (A, B, o C)"""
                else:
                    message = f"""Capisco {nome}.

Ti va di dirmi comunque che tipo di abitazione hai? Potrebbe esserci una soluzione anche per te!

A) Appartamento  
B) Villa/Casa indipendente
C) Altro"""
                    
            elif stage == "info_gathering":
                message = f"""Grazie per l'informazione! 📋

3️⃣ Ultima domanda: In che zona/provincia ti trovi?

Questo mi aiuta a capire se possiamo offrirti i nostri servizi nella tua area."""
                
            elif stage == "qualification":
                message = f"""Eccellente {nome}! ✅

Hai risposto a tutte le domande. In base alle tue risposte, sembra che i nostri servizi potrebbero fare al caso tuo!

Un nostro consulente specializzato ti contatterà entro 24 ore per:
📞 Spiegarti nel dettaglio la nostra offerta
💰 Fornirti un preventivo personalizzato  
📋 Rispondere a tutte le tue domande

Grazie per il tempo dedicato! A presto! 😊"""
                
                # Mark as qualified
                await self.complete_qualification(lead_id, "qualified", 85)
                return
                
            elif stage == "completed":
                if "non interesse" in last_response or "no" in last_response:
                    message = f"""Capisco perfettamente {nome}.

Grazie comunque per averci contattato! Se in futuro dovessi cambiare idea, saremo sempre qui per aiutarti.

Buona giornata! 😊"""
                    await self.complete_qualification(lead_id, "not_interested", 10)
                    return
                    
            # Send message
            if message and phone_number:
                if await self.is_whatsapp_available(lead_id):
                    result = await whatsapp_service.send_message(phone_number, message)
                    if result.get("success"):
                        await self.log_bot_message(lead_id, message, "whatsapp")
                else:
                    await self.log_bot_message(lead_id, message, "manual_followup")
                    
        except Exception as e:
            logging.error(f"Error sending stage message for lead {lead_id} at stage {stage}: {e}")
    
    async def complete_qualification(self, lead_id: str, result: str, score: int):
        """Complete the qualification process"""
        try:
            # Update qualification record
            await db.lead_qualifications.update_one(
                {"lead_id": lead_id},
                {
                    "$set": {
                        "status": "completed",
                        "stage": "completed", 
                        "result": result,
                        "score": score,
                        "completed_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Update lead record
            esito_mapping = {
                "qualified": "Bot Qualificato",
                "not_interested": "Non Interessato", 
                "timeout": "Timeout Bot",
                "error": "Errore Qualificazione"
            }
            
            await db.leads.update_one(
                {"id": lead_id},
                {
                    "$set": {
                        "esito": esito_mapping.get(result, "Completato Bot"),
                        "bot_qualification_active": False,
                        "bot_qualification_completed": True,
                        "qualification_score": score,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # If qualified, assign to agent
            if result == "qualified" and score >= 70:
                await self.assign_qualified_lead_to_agent(lead_id)
                
            logging.info(f"Completed qualification for lead {lead_id} with result: {result}, score: {score}")
            
        except Exception as e:
            logging.error(f"Error completing qualification for lead {lead_id}: {e}")
    
    async def handle_qualification_timeout(self, lead_id: str):
        """Handle qualification timeout after 12 hours"""
        try:
            # Check current responses
            qualification = await db.lead_qualifications.find_one({"lead_id": lead_id})
            if not qualification:
                return
                
            responses_count = qualification.get("lead_responses", 0)
            
            if responses_count > 0:
                # Lead responded but didn't complete - assign to agent
                await self.complete_qualification(lead_id, "timeout", 50)
                await self.assign_qualified_lead_to_agent(lead_id, "timeout_with_responses")
            else:
                # No response - mark as unresponsive
                await self.complete_qualification(lead_id, "timeout", 20)
                
                # Send final message
                lead = await db.leads.find_one({"id": lead_id})
                if lead and lead.get("telefono"):
                    final_message = f"""Ciao {lead.get('nome', 'Cliente')}!

Non ho ricevuto una tua risposta, ma non ti preoccupare! 😊

Un nostro consulente ti contatterà comunque per assisterti al meglio.

Grazie e a presto!"""
                    
                    if await self.is_whatsapp_available(lead_id):
                        await whatsapp_service.send_message(lead.get("telefono"), final_message)
            
            logging.info(f"Handled timeout for lead {lead_id} with {responses_count} responses")
            
        except Exception as e:
            logging.error(f"Error handling timeout for lead {lead_id}: {e}")
    
    async def assign_qualified_lead_to_agent(self, lead_id: str, assignment_reason: str = "bot_qualified"):
        """Assign qualified lead to best available agent"""
        try:
            lead = await db.leads.find_one({"id": lead_id})
            if not lead:
                return
                
            # Find best agent for this lead
            unit_id = lead.get("unit_id")
            provincia = lead.get("provincia")
            
            # Get agents from same unit or with matching provinces
            query = {"role": "agente", "is_active": True}
            if unit_id:
                query["unit_id"] = unit_id
                
            agents = await db.users.find(query).to_list(length=None)
            
            # Filter agents by province if specified
            suitable_agents = []
            for agent in agents:
                if provincia and provincia in agent.get("provinces", []):
                    suitable_agents.append(agent)
                elif not agent.get("provinces"):  # Agent covers all provinces
                    suitable_agents.append(agent)
            
            # If no province match, use any agent from unit
            if not suitable_agents:
                suitable_agents = agents
                
            if suitable_agents:
                # Select agent with least active leads
                best_agent = None
                min_leads = float('inf')
                
                for agent in suitable_agents:
                    # Count active leads for this agent
                    lead_count = await db.leads.count_documents({
                        "agent_id": agent["id"],
                        "esito": {"$in": ["Da Contattare", "In Lavorazione", "Bot Qualificato"]}
                    })
                    
                    if lead_count < min_leads:
                        min_leads = lead_count
                        best_agent = agent
                        
                if best_agent:
                    # Assign lead to agent
                    await db.leads.update_one(
                        {"id": lead_id},
                        {
                            "$set": {
                                "agent_id": best_agent["id"],
                                "assigned_at": datetime.now(timezone.utc),
                                "assignment_reason": assignment_reason,
                                "esito": "Assegnato da Bot"
                            }
                        }
                    )
                    
                    # Log assignment
                    assignment_log = {
                        "id": str(uuid.uuid4()),
                        "lead_id": lead_id,
                        "agent_id": best_agent["id"],
                        "assignment_reason": assignment_reason,
                        "assigned_at": datetime.now(timezone.utc),
                        "previous_esito": lead.get("esito"),
                        "qualification_score": lead.get("qualification_score", 0)
                    }
                    
                    await db.lead_assignments.insert_one(assignment_log)
                    
                    logging.info(f"Assigned lead {lead_id} to agent {best_agent['username']} (reason: {assignment_reason})")
                    return best_agent["id"]
            
            logging.warning(f"No suitable agents found for lead {lead_id}")
            return None
            
        except Exception as e:
            logging.error(f"Error assigning lead {lead_id} to agent: {e}")
            return None
    
    async def is_whatsapp_available(self, lead_id: str) -> bool:
        """Check if WhatsApp is available for this lead"""
        try:
            lead = await db.leads.find_one({"id": lead_id})
            if not lead or not lead.get("telefono"):
                return False
                
            # Check if we have a WhatsApp validation for this number
            validation = await db.lead_whatsapp_validations.find_one({
                "lead_id": lead_id,
                "is_whatsapp": True
            })
            
            return validation is not None
            
        except Exception as e:
            logging.error(f"Error checking WhatsApp availability for lead {lead_id}: {e}")
            return False
    
    async def log_bot_message(self, lead_id: str, message: str, channel: str):
        """Log bot message for tracking"""
        try:
            log_data = {
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "message": message,
                "channel": channel,  # whatsapp, email, sms, manual_followup, failed_whatsapp
                "sent_at": datetime.now(timezone.utc),
                "message_type": "bot_qualification"
            }
            
            await db.bot_messages.insert_one(log_data)
            
            # Update qualification stats
            await db.lead_qualifications.update_one(
                {"lead_id": lead_id},
                {"$inc": {"bot_messages_sent": 1}}
            )
            
        except Exception as e:
            logging.error(f"Error logging bot message for lead {lead_id}: {e}")
    
    async def schedule_timeout_check(self, lead_id: str):
        """Schedule timeout check for lead (simplified implementation)"""
        try:
            # In production, this would use a task queue like Celery or APScheduler
            # For now, we'll create a scheduled task record
            timeout_task = {
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "task_type": "qualification_timeout",
                "scheduled_at": datetime.now(timezone.utc) + timedelta(hours=12),
                "status": "scheduled",
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.scheduled_tasks.insert_one(timeout_task)
            
        except Exception as e:
            logging.error(f"Error scheduling timeout check for lead {lead_id}: {e}")
    
    async def process_scheduled_tasks(self):
        """Process scheduled qualification timeout tasks"""
        try:
            # Find tasks that should be executed
            current_time = datetime.now(timezone.utc)
            tasks = await db.scheduled_tasks.find({
                "task_type": "qualification_timeout",
                "status": "scheduled",
                "scheduled_at": {"$lte": current_time}
            }).to_list(length=100)
            
            processed_count = 0
            
            for task in tasks:
                try:
                    lead_id = task["lead_id"]
                    
                    # Check if qualification is still active
                    qualification = await db.lead_qualifications.find_one({
                        "lead_id": lead_id,
                        "status": "active"
                    })
                    
                    if qualification:
                        await self.handle_qualification_timeout(lead_id)
                        processed_count += 1
                    
                    # Mark task as completed
                    await db.scheduled_tasks.update_one(
                        {"id": task["id"]},
                        {
                            "$set": {
                                "status": "completed",
                                "processed_at": current_time
                            }
                        }
                    )
                    
                except Exception as e:
                    logging.error(f"Error processing timeout task {task['id']}: {e}")
                    # Mark task as failed
                    await db.scheduled_tasks.update_one(
                        {"id": task["id"]},
                        {
                            "$set": {
                                "status": "failed",
                                "error": str(e),
                                "processed_at": current_time
                            }
                        }
                    )
            
            if processed_count > 0:
                logging.info(f"Processed {processed_count} qualification timeout tasks")
                
            return processed_count
            
        except Exception as e:
            logging.error(f"Error processing scheduled tasks: {e}")
            return 0

# Initialize WhatsApp service
whatsapp_service = WhatsAppService()

# Initialize Lead Qualification Bot
lead_qualification_bot = LeadQualificationBot()

async def assign_lead_to_agent(lead: Lead):
    """Automatically assign lead to agent based on province coverage"""
    # Find agents covering this province
    agents = await db.users.find({
        "role": "agente",
        "is_active": True,
        "provinces": {"$in": [lead.provincia]}
    }).to_list(length=None)
    
    if not agents:
        return None
    
    # Simple round-robin assignment (can be improved with better logic)
    # For now, assign to first available agent
    selected_agent = agents[0]
    
    # Update lead with assignment
    await db.leads.update_one(
        {"id": lead.id},
        {
            "$set": {
                "assigned_agent_id": selected_agent["id"],
                "assigned_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Send email notification to agent (async task)
    asyncio.create_task(notify_agent_new_lead(selected_agent["id"], lead.dict()))
    
    return selected_agent["id"]

# Auth endpoints
@api_router.post("/auth/login", response_model=Token)
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
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(**user)
    return {"access_token": access_token, "token_type": "bearer", "user": user_obj}

@api_router.get("/auth/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    # Get fresh user data from database to ensure all fields are included
    user_data = await db.users.find_one({"username": current_user.username})
    if user_data:
        # Convert ObjectId to string and return raw data to ensure all fields are present
        user_data["_id"] = str(user_data["_id"])
        return user_data
    return current_user

# User management endpoints
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
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
    user_dict.setdefault("created_at", datetime.now(timezone.utc))
    user_dict.setdefault("last_login", None)
    
    # Create User object and save to database
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users(unit_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    
    if current_user.role == UserRole.ADMIN:
        # Admin can see all users, optionally filtered by unit
        if unit_id:
            query["unit_id"] = unit_id
    elif current_user.role == UserRole.REFERENTE:
        # Referente can see their agents in their unit
        query = {
            "$or": [
                {"id": current_user.id},
                {"referente_id": current_user.id}
            ]
        }
        if unit_id:
            query["unit_id"] = unit_id
    else:
        # Agents can only see themselves
        query["id"] = current_user.id
    
    users = await db.users.find(query).to_list(length=None)
    
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
        except Exception as e:
            print(f"Error processing user {user.get('username', 'unknown')}: {e}")
            continue
    
    return valid_users

@api_router.get("/users/referenti/{unit_id}")
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

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update users")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
            else:
                update_data[field] = value
    
    # Update user
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@api_router.delete("/users/{user_id}")
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

@api_router.put("/users/{user_id}/toggle-status")
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

@api_router.get("/provinces")
async def get_provinces():
    return {"provinces": ITALIAN_PROVINCES}

# Unit management
@api_router.post("/units", response_model=Unit)
async def create_unit(unit_data: UnitCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    unit_obj = Unit(**unit_data.dict())
    await db.units.insert_one(unit_obj.dict())
    return unit_obj

@api_router.get("/units", response_model=List[Unit])
async def get_units(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        units = await db.units.find().to_list(length=None)
    else:
        # Users can only see their unit
        units = await db.units.find({"id": current_user.unit_id}).to_list(length=None)
    
    return [Unit(**unit) for unit in units]

@api_router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(unit_id: str, unit_data: UnitUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update units")
    
    # Check if unit exists
    existing_unit = await db.units.find_one({"id": unit_id})
    if not existing_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Update unit data - only update non-None fields
    update_data = {k: v for k, v in unit_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.units.update_one(
        {"id": unit_id},
        {"$set": update_data}
    )
    
    # Return updated unit
    updated_unit = await db.units.find_one({"id": unit_id})
    return Unit(**updated_unit)

@api_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete units")
    
    # Check if unit exists
    existing_unit = await db.units.find_one({"id": unit_id})
    if not existing_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Check if unit has associated users
    users_count = await db.users.count_documents({"unit_id": unit_id})
    if users_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete unit. {users_count} users are still associated with this unit"
        )
    
    # Check if unit has associated leads
    leads_count = await db.leads.count_documents({"gruppo": unit_id})
    if leads_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete unit. {leads_count} leads are still associated with this unit"
        )
    
    # Check if unit has associated containers
    containers_count = await db.containers.count_documents({"unit_id": unit_id})
    if containers_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete unit. {containers_count} containers are still associated with this unit"
        )
    
    # Safe to delete unit
    await db.units.delete_one({"id": unit_id})
    
    return {
        "success": True,
        "message": "Unit deleted successfully",
        "unit_id": unit_id
    }

# Container management
@api_router.post("/containers", response_model=Container)
async def create_container(container_data: ContainerCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    container_obj = Container(**container_data.dict())
    await db.containers.insert_one(container_obj.dict())
    return container_obj

@api_router.get("/containers", response_model=List[Container])
async def get_containers(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        containers = await db.containers.find().to_list(length=None)
    else:
        # Users can only see containers from their unit
        containers = await db.containers.find({"unit_id": current_user.unit_id}).to_list(length=None)
    
    return [Container(**container) for container in containers]

@api_router.put("/containers/{container_id}", response_model=Container)
async def update_container(container_id: str, container_data: ContainerCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update containers")
    
    # Find the container
    container = await db.containers.find_one({"id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Update container
    await db.containers.update_one(
        {"id": container_id},
        {"$set": container_data.dict()}
    )
    
    updated_container = await db.containers.find_one({"id": container_id})
    return Container(**updated_container)

@api_router.delete("/containers/{container_id}")
async def delete_container(container_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete containers")
    
    # Find the container
    container = await db.containers.find_one({"id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Delete container
    await db.containers.delete_one({"id": container_id})
    
    return {"message": "Container deleted successfully"}

# Lead management
@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    """Create lead - accessible via webhook with automatic qualification"""
    # Validate province
    if lead_data.provincia not in ITALIAN_PROVINCES:
        raise HTTPException(status_code=400, detail="Invalid province")
    
    lead_obj = Lead(**lead_data.dict())
    await db.leads.insert_one(lead_obj.dict())
    
    # Start automatic lead qualification if phone number is provided
    if lead_obj.telefono and lead_obj.telefono.strip():
        try:
            # First validate WhatsApp availability
            validation_result = await whatsapp_service.validate_phone_number(lead_obj.telefono)
            
            # Store validation result
            if validation_result.get("is_whatsapp"):
                validation_data = {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead_obj.id,
                    "phone_number": lead_obj.telefono,
                    "is_whatsapp": validation_result["is_whatsapp"],
                    "validation_status": validation_result["validation_status"],
                    "validation_date": datetime.now(timezone.utc),
                    "created_at": datetime.now(timezone.utc)
                }
                await db.lead_whatsapp_validations.insert_one(validation_data)
            
            # Start qualification process
            await lead_qualification_bot.start_qualification_process(lead_obj.id)
            
            logging.info(f"Started automatic qualification for new lead {lead_obj.id}")
            
        except Exception as e:
            logging.error(f"Error starting qualification for new lead {lead_obj.id}: {e}")
            # Continue with normal flow even if qualification fails
            pass
    
    # If qualification is not started, proceed with traditional auto-assignment
    qualification = await db.lead_qualifications.find_one({
        "lead_id": lead_obj.id,
        "status": "active"
    })
    
    if not qualification:
        # Auto-assign to agent using traditional method
        await assign_lead_to_agent(lead_obj)
    
    return lead_obj

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    unit_id: Optional[str] = None,
    campagna: Optional[str] = None,
    provincia: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if current_user.role == UserRole.AGENTE:
        query["assigned_agent_id"] = current_user.id
    elif current_user.role == UserRole.REFERENTE:
        # Get all agents under this referente
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        agent_ids.append(current_user.id)  # Include referente's own leads if any
        query["assigned_agent_id"] = {"$in": agent_ids}
    # Admin can see all leads
    
    # Unit filtering
    if unit_id:
        query["gruppo"] = unit_id
    elif current_user.role != UserRole.ADMIN and current_user.unit_id:
        # Non-admin users can only see leads from their unit
        query["gruppo"] = current_user.unit_id
    
    # Apply additional filters
    if campagna:
        query["campagna"] = campagna
    if provincia:
        query["provincia"] = provincia
    if date_from:
        query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    leads = await db.leads.find(query).to_list(length=None)
    
    # Filter out leads with validation errors to prevent crashes
    valid_leads = []
    for lead_data in leads:
        try:
            lead = Lead(**lead_data)
            valid_leads.append(lead)
        except Exception as e:
            # Log the validation error but continue
            logging.warning(f"Skipping lead {lead_data.get('id', 'unknown')} due to validation error: {str(e)}")
            continue
    
    return valid_leads

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, current_user: User = Depends(get_current_user)):
    # Find the lead
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions
    if current_user.role == UserRole.AGENTE and lead["assigned_agent_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Update lead
    update_data = lead_update.dict(exclude_unset=True)
    if update_data.get("esito"):
        update_data["contacted_at"] = datetime.now(timezone.utc)
    
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    updated_lead = await db.leads.find_one({"id": lead_id})
    return Lead(**updated_lead)

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    """Delete a lead"""
    
    # Find the lead
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions - only admin can delete leads
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete leads")
    
    try:
        # Check if lead has associated documents
        documents_count = await db.documents.count_documents({"lead_id": lead_id, "is_active": True})
        if documents_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete lead. {documents_count} documents are still associated with this lead"
            )
        
        # Delete the lead
        await db.leads.delete_one({"id": lead_id})
        
        return {
            "success": True,
            "message": "Lead deleted successfully",
            "lead_id": lead_id,
            "lead_info": {
                "nome": lead["nome"],
                "cognome": lead["cognome"],
                "email": lead.get("email", ""),
                "telefono": lead.get("telefono", "")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete lead")

# Custom Fields Management
@api_router.get("/custom-fields", response_model=List[CustomField])
async def get_custom_fields(current_user: User = Depends(get_current_user)):
    fields = await db.custom_fields.find().to_list(length=None)
    return [CustomField(**field) for field in fields]

@api_router.post("/custom-fields", response_model=CustomField)
async def create_custom_field(field_data: CustomFieldCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create custom fields")
    
    # Check if field name already exists
    existing_field = await db.custom_fields.find_one({"name": field_data.name})
    if existing_field:
        raise HTTPException(status_code=400, detail="Field name already exists")
    
    field_obj = CustomField(**field_data.dict())
    await db.custom_fields.insert_one(field_obj.dict())
    return field_obj

@api_router.delete("/custom-fields/{field_id}")
async def delete_custom_field(field_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete custom fields")
    
    field = await db.custom_fields.find_one({"id": field_id})
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    
    await db.custom_fields.delete_one({"id": field_id})
    return {"message": "Custom field deleted successfully"}

# Document management endpoints
@api_router.post("/documents/upload")
async def upload_document(
    document_type: str = Form(...),
    entity_id: str = Form(...),  # lead_id or cliente_id
    file: UploadFile = File(...),
    uploaded_by: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a PDF document for a specific lead or cliente"""
    
    # Validate document type
    try:
        doc_type = DocumentType(document_type)
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
        if not entity:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        # Check cliente access using new authorization logic
        cliente_obj = Cliente(**entity)
        if not await can_user_modify_cliente(current_user, cliente_obj):
            raise HTTPException(status_code=403, detail="Access denied to this cliente")
    
    try:
        # Validate file
        await validate_uploaded_file(file)
        
        # Save to temporary storage
        temp_path = await save_temporary_file(file)
        
        try:
            # Upload to Aruba Drive
            aruba_response = await aruba_service.upload_file(temp_path, file.filename)
            
            # Create database record
            document = await create_document_record(doc_type, entity_id, file, aruba_response, uploaded_by)
            
            entity_info = {
                "id": entity["id"],
                "nome": entity["nome"],
                "cognome": entity["cognome"]
            }
            
            return {
                "success": True,
                "message": "Document uploaded successfully",
                "document": {
                    "id": document.id,
                    "document_id": document.document_id,
                    "filename": document.original_filename,
                    "size": document.file_size,
                    "upload_status": document.upload_status,
                    "created_at": document.created_at.isoformat()
                },
                "entity": entity_info,
                "document_type": doc_type
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
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

@api_router.get("/documents/lead/{lead_id}")
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

@api_router.get("/documents/download/{document_id}")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a specific document by document ID"""
    
    # Find document in database
    document = await db.documents.find_one({
        "document_id": document_id,
        "is_active": True
    })
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check access permissions
    document_obj = Document(**document)
    if not await can_user_access_document(current_user, document_obj):
        raise HTTPException(status_code=403, detail="Access denied to this document")
    
    try:
        # Download from Aruba Drive
        file_content = await aruba_service.download_file(document["aruba_drive_file_id"])
        
        # Update download count
        await db.documents.update_one(
            {"document_id": document_id},
            {
                "$set": {"last_downloaded_at": datetime.now(timezone.utc)},
                "$inc": {"download_count": 1}
            }
        )
        
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=document["content_type"],
            headers={
                "Content-Disposition": f"attachment; filename={document['original_filename']}"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )

@api_router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a document (marks as inactive)"""
    
    # Only admin can delete documents
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete documents")
    
    document = await db.documents.find_one({
        "document_id": document_id,
        "is_active": True
    })
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Soft delete in database
        await db.documents.update_one(
            {"document_id": document_id},
            {"$set": {"is_active": False}}
        )
        
        return {
            "success": True,
            "message": "Document deleted successfully",
            "document_id": document_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Deletion failed: {str(e)}"
        )

@api_router.get("/documents")
async def list_all_documents(
    current_user: User = Depends(get_current_user),
    document_type: Optional[str] = None,
    entity_id: Optional[str] = None,  # lead_id or cliente_id
    nome: Optional[str] = None,
    cognome: Optional[str] = None,
    commessa_id: Optional[str] = None,
    sub_agenzia_id: Optional[str] = None,
    uploaded_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """List all documents with filtering options for both Lead and Cliente"""
    
    # Get accessible document IDs based on user permissions
    doc_type_filter = None
    if document_type:
        try:
            doc_type_filter = DocumentType(document_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid document type")
    
    accessible_doc_ids = await get_user_accessible_documents(current_user, doc_type_filter)
    
    if not accessible_doc_ids:
        return {
            "documents": [],
            "pagination": {"total": 0, "skip": skip, "limit": limit, "has_more": False},
            "filters_applied": {"document_type": document_type, "entity_id": entity_id}
        }
    
    # Build document query
    query = {"id": {"$in": accessible_doc_ids}, "is_active": True}
    
    # Add filters
    if document_type:
        query["document_type"] = document_type
    
    if entity_id:
        if not document_type or document_type == "lead":
            query["lead_id"] = entity_id
        elif document_type == "cliente":
            query["cliente_id"] = entity_id
    
    if uploaded_by:
        query["uploaded_by"] = {"$regex": uploaded_by, "$options": "i"}
    
    # Filter by commessa or sub agenzia for clienti
    if commessa_id or sub_agenzia_id:
        if not document_type or document_type == "cliente":
            cliente_query = {}
            if commessa_id:
                cliente_query["commessa_id"] = commessa_id
            if sub_agenzia_id:
                cliente_query["sub_agenzia_id"] = sub_agenzia_id
            
            clienti = await db.clienti.find(cliente_query).to_list(length=None)
            cliente_ids = [c["id"] for c in clienti]
            
            if "cliente_id" in query:
                # Intersection
                query["cliente_id"] = {"$in": [query["cliente_id"]] if isinstance(query["cliente_id"], str) else list(set(query["cliente_id"]["$in"]) & set(cliente_ids))}
            else:
                query["cliente_id"] = {"$in": cliente_ids}
    
    # Name/surname filters for entities
    if nome or cognome:
        entity_ids_to_filter = []
        
        # Filter leads if applicable
        if not document_type or document_type == "lead":
            lead_query = {}
            if nome:
                lead_query["nome"] = {"$regex": nome, "$options": "i"}
            if cognome:
                lead_query["cognome"] = {"$regex": cognome, "$options": "i"}
            
            if lead_query:
                leads = await db.leads.find(lead_query).to_list(length=None)
                lead_ids = [l["id"] for l in leads]
                
                if "lead_id" in query:
                    if isinstance(query["lead_id"], str):
                        if query["lead_id"] in lead_ids:
                            entity_ids_to_filter.extend([query["lead_id"]])
                    else:
                        entity_ids_to_filter.extend(list(set(query["lead_id"]["$in"]) & set(lead_ids)))
                else:
                    query["lead_id"] = {"$in": lead_ids}
        
        # Filter clienti if applicable
        if not document_type or document_type == "cliente":
            cliente_query = {}
            if nome:
                cliente_query["nome"] = {"$regex": nome, "$options": "i"}
            if cognome:
                cliente_query["cognome"] = {"$regex": cognome, "$options": "i"}
            
            if cliente_query:
                clienti = await db.clienti.find(cliente_query).to_list(length=None)
                cliente_ids = [c["id"] for c in clienti]
                
                if "cliente_id" in query:
                    if isinstance(query["cliente_id"], str):
                        if query["cliente_id"] in cliente_ids:
                            entity_ids_to_filter.extend([query["cliente_id"]])
                    else:
                        entity_ids_to_filter.extend(list(set(query["cliente_id"]["$in"]) & set(cliente_ids)))
                else:
                    query["cliente_id"] = {"$in": cliente_ids}
    
    # Get documents with pagination
    documents = await db.documents.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    total_count = await db.documents.count_documents(query)
    
    # Enrich with entity information
    document_list = []
    for doc in documents:
        entity_info = {}
        
        if doc.get("lead_id"):
            lead = await db.leads.find_one({"id": doc["lead_id"]})
            if lead:
                entity_info = {
                    "id": lead["id"],
                    "nome": lead["nome"],
                    "cognome": lead["cognome"],
                    "lead_id": lead.get("lead_id", lead["id"][:8]),
                    "email": lead.get("email", ""),
                    "telefono": lead.get("telefono", ""),
                    "type": "lead"
                }
        
        elif doc.get("cliente_id"):
            cliente = await db.clienti.find_one({"id": doc["cliente_id"]})
            if cliente:
                # Get sub agenzia and commessa info
                sub_agenzia = await db.sub_agenzie.find_one({"id": cliente["sub_agenzia_id"]})
                commessa = await db.commesse.find_one({"id": cliente["commessa_id"]})
                
                entity_info = {
                    "id": cliente["id"],
                    "nome": cliente["nome"],
                    "cognome": cliente["cognome"],
                    "cliente_id": cliente.get("cliente_id", cliente["id"][:8]),
                    "email": cliente.get("email", ""),
                    "telefono": cliente.get("telefono", ""),
                    "sub_agenzia": sub_agenzia["nome"] if sub_agenzia else "N/A",
                    "commessa": commessa["nome"] if commessa else "N/A",
                    "type": "cliente"
                }
        
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
            "document_type": doc.get("document_type", "lead"),
            "entity": entity_info
        })
    
    return {
        "documents": document_list,
        "pagination": {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": (skip + limit) < total_count
        },
        "filters_applied": {
            "document_type": document_type,
            "entity_id": entity_id,
            "nome": nome,
            "cognome": cognome,
            "commessa_id": commessa_id,
            "sub_agenzia_id": sub_agenzia_id,
            "uploaded_by": uploaded_by
        }
    }

# Analytics endpoints
@api_router.get("/analytics/agent/{agent_id}")
async def get_agent_analytics(agent_id: str, current_user: User = Depends(get_current_user)):
    # Permission check
    if current_user.role == UserRole.AGENTE and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Can only view your own analytics")
    elif current_user.role == UserRole.REFERENTE:
        # Check if agent is under this referente
        agent = await db.users.find_one({"id": agent_id})
        if not agent or agent["referente_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Can only view analytics for your agents")
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get agent info
    agent = await db.users.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get agent's leads statistics
    total_leads = await db.leads.count_documents({"assigned_agent_id": agent_id})
    contacted_leads = await db.leads.count_documents({
        "assigned_agent_id": agent_id,
        "esito": {"$ne": None}
    })
    
    # Leads by outcome
    outcomes = {}
    for outcome in CallOutcome:
        count = await db.leads.count_documents({
            "assigned_agent_id": agent_id,
            "esito": outcome.value
        })
        outcomes[outcome.value] = count
    
    # Leads this week/month
    now = datetime.now(timezone.utc)
    week_start = now.replace(hour=0, minute=0, second=0) - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    
    leads_this_week = await db.leads.count_documents({
        "assigned_agent_id": agent_id,
        "created_at": {"$gte": week_start}
    })
    
    leads_this_month = await db.leads.count_documents({
        "assigned_agent_id": agent_id,
        "created_at": {"$gte": month_start}
    })
    
    return {
        "agent": {
            "id": agent["id"],
            "username": agent["username"],
            "email": agent["email"]
        },
        "stats": {
            "total_leads": total_leads,
            "contacted_leads": contacted_leads,
            "contact_rate": round((contacted_leads / total_leads * 100) if total_leads > 0 else 0, 2),
            "leads_this_week": leads_this_week,
            "leads_this_month": leads_this_month,
            "outcomes": outcomes
        }
    }

@api_router.get("/analytics/referente/{referente_id}")
async def get_referente_analytics(referente_id: str, current_user: User = Depends(get_current_user)):
    # Permission check
    if current_user.role == UserRole.REFERENTE and current_user.id != referente_id:
        raise HTTPException(status_code=403, detail="Can only view your own analytics")
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get referente info
    referente = await db.users.find_one({"id": referente_id})
    if not referente:
        raise HTTPException(status_code=404, detail="Referente not found")
    
    # Get all agents under this referente
    agents = await db.users.find({"referente_id": referente_id}).to_list(length=None)
    agent_ids = [agent["id"] for agent in agents]
    
    # Aggregate statistics for all agents under referente
    total_leads = await db.leads.count_documents({"assigned_agent_id": {"$in": agent_ids}})
    contacted_leads = await db.leads.count_documents({
        "assigned_agent_id": {"$in": agent_ids},
        "esito": {"$ne": None}
    })
    
    # Per-agent breakdown
    agent_stats = []
    for agent in agents:
        agent_leads = await db.leads.count_documents({"assigned_agent_id": agent["id"]})
        agent_contacted = await db.leads.count_documents({
            "assigned_agent_id": agent["id"], 
            "esito": {"$ne": None}
        })
        
        agent_stats.append({
            "agent": {
                "id": agent["id"],
                "username": agent["username"],
                "email": agent["email"]
            },
            "total_leads": agent_leads,
            "contacted_leads": agent_contacted,
            "contact_rate": round((agent_contacted / agent_leads * 100) if agent_leads > 0 else 0, 2)
        })
    
    return {
        "referente": {
            "id": referente["id"],
            "username": referente["username"],
            "email": referente["email"]
        },
        "total_agents": len(agents),
        "total_stats": {
            "total_leads": total_leads,
            "contacted_leads": contacted_leads,
            "contact_rate": round((contacted_leads / total_leads * 100) if total_leads > 0 else 0, 2)
        },
        "agent_breakdown": agent_stats
    }

# Excel Export System
async def create_excel_report(leads_data, filename="leads_export"):
    """Create Excel file with leads data"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lead Report"
    
    # Headers
    headers = [
        "Lead ID", "Nome", "Cognome", "Telefono", "Email", "Provincia", 
        "Tipologia Abitazione", "IP Address", "Campagna", "Contenitore",
        "Privacy Consent", "Marketing Consent", "Esito", "Note", 
        "Data Creazione", "Data Assegnazione", "Data Contatto"
    ]
    
    # Header styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    # Data rows
    for row, lead in enumerate(leads_data, 2):
        ws.cell(row=row, column=1, value=lead.get("lead_id", lead.get("id", "")[:8]))
        ws.cell(row=row, column=2, value=lead.get("nome", ""))
        ws.cell(row=row, column=3, value=lead.get("cognome", ""))
        ws.cell(row=row, column=4, value=lead.get("telefono", ""))
        ws.cell(row=row, column=5, value=lead.get("email", ""))
        ws.cell(row=row, column=6, value=lead.get("provincia", ""))
        ws.cell(row=row, column=7, value=lead.get("tipologia_abitazione", "").replace("_", " ").title())
        ws.cell(row=row, column=8, value=lead.get("ip_address", ""))
        ws.cell(row=row, column=9, value=lead.get("campagna", ""))
        ws.cell(row=row, column=10, value=lead.get("contenitore", ""))
        ws.cell(row=row, column=11, value="Sì" if lead.get("privacy_consent") else "No")
        ws.cell(row=row, column=12, value="Sì" if lead.get("marketing_consent") else "No")
        ws.cell(row=row, column=13, value=lead.get("esito", ""))
        ws.cell(row=row, column=14, value=lead.get("note", ""))
        
        # Format dates
        if lead.get("created_at"):
            try:
                date_obj = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                ws.cell(row=row, column=15, value=date_obj.strftime("%d/%m/%Y %H:%M"))
            except:
                ws.cell(row=row, column=15, value=lead.get("created_at", ""))
        
        if lead.get("assigned_at"):
            try:
                date_obj = datetime.fromisoformat(lead["assigned_at"].replace("Z", "+00:00"))
                ws.cell(row=row, column=16, value=date_obj.strftime("%d/%m/%Y %H:%M"))
            except:
                ws.cell(row=row, column=16, value=lead.get("assigned_at", ""))
        
        if lead.get("contacted_at"):
            try:
                date_obj = datetime.fromisoformat(lead["contacted_at"].replace("Z", "+00:00"))
                ws.cell(row=row, column=17, value=date_obj.strftime("%d/%m/%Y %H:%M"))
            except:
                ws.cell(row=row, column=17, value=lead.get("contacted_at", ""))
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
    wb.save(temp_file.name)
    return temp_file.name

@api_router.get("/leads/export")
async def export_leads_excel(
    unit_id: Optional[str] = None,
    campagna: Optional[str] = None,
    provincia: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Export leads to Excel file"""
    query = {}
    
    # Role-based filtering (same as get_leads)
    if current_user.role == UserRole.AGENTE:
        query["assigned_agent_id"] = current_user.id
    elif current_user.role == UserRole.REFERENTE:
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        agent_ids.append(current_user.id)
        query["assigned_agent_id"] = {"$in": agent_ids}
    
    # Unit filtering
    if unit_id:
        query["gruppo"] = unit_id
    elif current_user.role != UserRole.ADMIN and current_user.unit_id:
        query["gruppo"] = current_user.unit_id
    
    # Apply additional filters
    if campagna:
        query["campagna"] = campagna
    if provincia:
        query["provincia"] = provincia
    if date_from:
        query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    # Get leads data
    leads = await db.leads.find(query).to_list(length=None)
    
    if not leads:
        raise HTTPException(status_code=404, detail="Nessun lead trovato con i filtri specificati")
    
    # Create Excel file
    excel_file_path = await create_excel_report(leads, f"leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    
    # Return file
    return FileResponse(
        path=excel_file_path,
        filename=f"leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# Email System - Temporarily disabled due to import issues
async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification"""
    # Temporarily disabled
    return False

async def notify_agent_new_lead(agent_id: str, lead_data: dict):
    """Send email notification to agent about new lead assignment"""
    # Temporarily disabled
    return False

# Webhook endpoint for external integrations (Zapier)
@api_router.post("/webhook/{unit_id}")
async def webhook_receive_lead(unit_id: str, lead_data: LeadCreate):
    """Webhook endpoint for receiving leads from external sources"""
    # Validate that unit exists
    unit = await db.units.find_one({"id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Set the group (unit) for the lead
    lead_data.gruppo = unit_id
    
    return await create_lead(lead_data)

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(unit_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    stats = {}
    
    # Base query for unit filtering
    unit_filter = {}
    if unit_id:
        unit_filter["gruppo"] = unit_id
    elif current_user.role != UserRole.ADMIN and current_user.unit_id:
        unit_filter["gruppo"] = current_user.unit_id
    
    if current_user.role == UserRole.ADMIN:
        # Admin stats - optionally filtered by unit
        if unit_id:
            stats["total_leads"] = await db.leads.count_documents(unit_filter)
            stats["leads_today"] = await db.leads.count_documents({
                **unit_filter,
                "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
            })
            stats["total_users"] = await db.users.count_documents({"unit_id": unit_id})
            unit_info = await db.units.find_one({"id": unit_id})
            stats["unit_name"] = unit_info["name"] if unit_info else "Unknown Unit"
        else:
            stats["total_leads"] = await db.leads.count_documents({})
            stats["total_users"] = await db.users.count_documents({})
            stats["total_units"] = await db.units.count_documents({})
            stats["leads_today"] = await db.leads.count_documents({
                "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
            })
            
    elif current_user.role == UserRole.REFERENTE:
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        
        lead_query = {"assigned_agent_id": {"$in": agent_ids}}
        if unit_filter:
            lead_query.update(unit_filter)
            
        stats["my_agents"] = len(agent_ids)
        stats["total_leads"] = await db.leads.count_documents(lead_query)
        stats["leads_today"] = await db.leads.count_documents({
            **lead_query,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
        
        if current_user.unit_id:
            unit_info = await db.units.find_one({"id": current_user.unit_id})
            stats["unit_name"] = unit_info["name"] if unit_info else "Unknown Unit"
            
    else:  # Agent
        lead_query = {"assigned_agent_id": current_user.id}
        if unit_filter:
            lead_query.update(unit_filter)
            
        stats["my_leads"] = await db.leads.count_documents(lead_query)
        stats["leads_today"] = await db.leads.count_documents({
            **lead_query,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
        stats["contacted_leads"] = await db.leads.count_documents({
            **lead_query,
            "esito": {"$ne": None}
        })
        
        if current_user.unit_id:
            unit_info = await db.units.find_one({"id": current_user.unit_id})
            stats["unit_name"] = unit_info["name"] if unit_info else "Unknown Unit"
    
    return stats

# ChatBot endpoints
@api_router.post("/chat/message")
async def send_chat_message(
    session_id: str = Form(...),
    message: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Send message to chatbot"""
    
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Get session to determine unit_id
    session = await db.chat_sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Check if user has access to this unit
    if current_user.role != UserRole.ADMIN and current_user.unit_id != session["unit_id"]:
        raise HTTPException(status_code=403, detail="Access denied to this chat session")
    
    try:
        response = await chatbot_service.send_message(
            session_id, 
            session["unit_id"], 
            message, 
            current_user.id
        )
        
        # Update session last activity
        await db.chat_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"last_activity": datetime.now(timezone.utc)}}
        )
        
        return {
            "success": True,
            "response": response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Chat message error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get chat history for session"""
    
    # Get session to check access
    session = await db.chat_sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Check access
    if current_user.role != UserRole.ADMIN and current_user.unit_id != session["unit_id"]:
        raise HTTPException(status_code=403, detail="Access denied to this chat session")
    
    try:
        messages = await chatbot_service.get_chat_history(session_id, limit)
        
        return {
            "session_id": session_id,
            "messages": [
                {
                    "id": msg.id,
                    "user_id": msg.user_id,
                    "message": msg.message,
                    "message_type": msg.message_type,
                    "created_at": msg.created_at.isoformat()
                }
                for msg in messages
            ],
            "total_messages": len(messages)
        }
        
    except Exception as e:
        logging.error(f"Get chat history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get chat history")

@api_router.post("/chat/session")
async def create_chat_session(
    session_type: str = Form("unit"),
    participants: Optional[str] = Form(None),  # JSON string of participant IDs
    current_user: User = Depends(get_current_user)
):
    """Create new chat session"""
    
    # Admin can create sessions without unit_id, others need unit_id
    if current_user.role != UserRole.ADMIN and not current_user.unit_id:
        raise HTTPException(status_code=400, detail="User must belong to a unit")
    
    # For admin without unit_id, use first available unit or create system session
    unit_id = current_user.unit_id
    if not unit_id and current_user.role == UserRole.ADMIN:
        # Get first available unit for admin or use system identifier
        first_unit = await db.units.find_one({"is_active": True})
        if first_unit:
            unit_id = first_unit["id"]
        else:
            unit_id = "system"  # Fallback for system-wide admin chat
    
    try:
        participant_list = []
        if participants:
            import json
            participant_list = json.loads(participants)
        
        # Add current user to participants
        if current_user.id not in participant_list:
            participant_list.append(current_user.id)
        
        session = await chatbot_service.create_session(
            unit_id,
            session_type,
            participant_list
        )
        
        return {
            "success": True,
            "session": {
                "session_id": session.session_id,
                "unit_id": session.unit_id,
                "session_type": session.session_type,
                "participants": session.participants,
                "created_at": session.created_at.isoformat()
            }
        }
        
    except Exception as e:
        logging.error(f"Create chat session error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat session")

@api_router.get("/chat/sessions")
async def get_chat_sessions(
    current_user: User = Depends(get_current_user),
    limit: int = 20
):
    """Get chat sessions for current user's unit"""
    
    # Admin can access sessions without unit_id, others need unit_id
    if current_user.role != UserRole.ADMIN and not current_user.unit_id:
        raise HTTPException(status_code=400, detail="User must belong to a unit")
    
    try:
        # For admin, get sessions from all units or specific unit filter
        if current_user.role == UserRole.ADMIN:
            if current_user.unit_id:
                # Admin has specific unit assigned
                query = {"unit_id": current_user.unit_id, "is_active": True}
            else:
                # Admin without unit - get all sessions or system sessions
                query = {"is_active": True}
        else:
            # Regular users - only their unit sessions
            query = {"unit_id": current_user.unit_id, "is_active": True}
        
        sessions = await db.chat_sessions.find(query).sort("last_activity", -1).limit(limit).to_list(length=None)
        
        session_list = []
        for session in sessions:
            # Get last message for preview
            last_message = await db.chat_messages.find_one(
                {"session_id": session["session_id"]},
                sort=[("created_at", -1)]
            )
            
            session_list.append({
                "session_id": session["session_id"],
                "session_type": session["session_type"],
                "participants": session["participants"],
                "last_activity": session["last_activity"].isoformat(),
                "last_message": {
                    "message": last_message["message"] if last_message else "",
                    "message_type": last_message["message_type"] if last_message else "",
                    "created_at": last_message["created_at"].isoformat() if last_message else ""
                } if last_message else None
            })
        
        return {
            "sessions": session_list,
            "total": len(session_list)
        }
        
    except Exception as e:
        logging.error(f"Get chat sessions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get chat sessions")

# AI Configuration endpoints
@api_router.post("/ai-config")
async def create_ai_configuration(
    config_data: AIConfigurationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create or update AI configuration (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can configure AI settings")
    
    try:
        # Test the OpenAI API key
        import openai
        client = openai.OpenAI(api_key=config_data.openai_api_key)
        
        # Test API key by listing assistants
        assistants = client.beta.assistants.list(limit=1)
        
        # Check if configuration already exists
        existing_config = await db.ai_configurations.find_one({"is_active": True})
        
        if existing_config:
            # Update existing configuration
            await db.ai_configurations.update_one(
                {"id": existing_config["id"]},
                {
                    "$set": {
                        "openai_api_key": config_data.openai_api_key,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            config_id = existing_config["id"]
        else:
            # Create new configuration
            ai_config = AIConfiguration(openai_api_key=config_data.openai_api_key)
            await db.ai_configurations.insert_one(ai_config.dict())
            config_id = ai_config.id
        
        return {
            "success": True,
            "message": "AI configuration saved successfully",
            "config_id": config_id,
            "api_key_valid": True
        }
        
    except Exception as e:
        logging.error(f"AI configuration error: {e}")
        return {
            "success": False,
            "message": "Invalid OpenAI API key or configuration error",
            "api_key_valid": False,
            "error": str(e)
        }

@api_router.get("/ai-config")
async def get_ai_configuration(current_user: User = Depends(get_current_user)):
    """Get current AI configuration (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view AI settings")
    
    try:
        config = await db.ai_configurations.find_one({"is_active": True})
        
        if not config:
            return {
                "configured": False,
                "message": "No AI configuration found"
            }
        
        # Don't return the actual API key for security
        return {
            "configured": True,
            "config_id": config["id"],
            "api_key_preview": config["openai_api_key"][:8] + "..." if config["openai_api_key"] else "",
            "created_at": config["created_at"].isoformat(),
            "updated_at": config.get("updated_at", config["created_at"]).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Get AI configuration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI configuration")

@api_router.get("/ai-assistants")
async def list_openai_assistants(current_user: User = Depends(get_current_user)):
    """List available OpenAI assistants (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view assistants")
    
    try:
        # Get AI configuration
        config = await db.ai_configurations.find_one({"is_active": True})
        
        if not config:
            # Instead of raising an error, return empty list with a message
            logging.warning("No AI configuration found for assistants listing")
            return {
                "assistants": [],
                "message": "No AI configuration found. Please configure OpenAI API key first.",
                "configured": False
            }
        
        # List assistants from OpenAI
        import openai
        client = openai.OpenAI(api_key=config["openai_api_key"])
        
        assistants_response = client.beta.assistants.list(limit=50, order="desc")
        
        assistants = []
        for assistant in assistants_response.data:
            assistants.append({
                "id": assistant.id,
                "name": assistant.name or "Unnamed Assistant",
                "description": assistant.description or "",
                "model": assistant.model,
                "instructions": assistant.instructions or "",
                "created_at": assistant.created_at
            })
        
        return {
            "assistants": assistants,
            "message": "Assistants loaded successfully",
            "configured": True
        }
        
    except Exception as e:
        logging.error(f"List assistants error: {str(e)}")
        # Return empty list instead of raising error to prevent dashboard crash
        return {
            "assistants": [],
            "message": f"Error loading assistants: {str(e)}",
            "configured": False
        }
        
        return {
            "assistants": assistants,
            "total": len(assistants)
        }
        
    except Exception as e:
        logging.error(f"List assistants error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list assistants: {str(e)}")

# Advanced WhatsApp Business API endpoints
@api_router.post("/whatsapp-config")
async def configure_whatsapp(
    config_data: WhatsAppConfigurationCreate,
    current_user: User = Depends(get_current_user)
):
    """Configure WhatsApp Business connection (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can configure WhatsApp")
    
    try:
        # Use unit_id from request or current user's unit
        unit_id = config_data.unit_id or current_user.unit_id
        if not unit_id:
            raise HTTPException(status_code=400, detail="Unit ID is required")
        
        # Generate QR code for connection simulation
        qr_result = await whatsapp_service.generate_qr_code(unit_id)
        
        # Create/update WhatsApp configuration
        config_dict = {
            "id": str(uuid.uuid4()),
            "unit_id": unit_id,
            "phone_number": config_data.phone_number,
            "qr_code": qr_result.get("qr_code"),
            "is_connected": False,
            "connection_status": "connecting",
            "webhook_url": f"{os.environ.get('WEBHOOK_BASE_URL', 'https://your-domain.com')}/api/whatsapp/webhook",
            "api_version": "v18.0",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Check if configuration already exists for this unit
        existing_config = await db.whatsapp_configurations.find_one({"unit_id": unit_id})
        if existing_config:
            # Update existing configuration
            await db.whatsapp_configurations.update_one(
                {"unit_id": unit_id},
                {"$set": {
                    "phone_number": config_data.phone_number,
                    "qr_code": qr_result.get("qr_code"),
                    "connection_status": "connecting",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            config_id = existing_config["id"]
        else:
            # Create new configuration
            result = await db.whatsapp_configurations.insert_one(config_dict)
            config_id = config_dict["id"]
        
        return {
            "success": True,
            "message": "WhatsApp configuration saved successfully",
            "config_id": config_id,
            "qr_code": qr_result.get("qr_code"),
            "expires_at": qr_result.get("expires_at"),
            "phone_number": config_data.phone_number,
            "connection_status": "connecting"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"WhatsApp configuration error: {e}")
        raise HTTPException(status_code=500, detail=f"Configuration failed: {str(e)}")

@api_router.get("/whatsapp-config")
async def get_whatsapp_configuration(
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get WhatsApp configuration for specific unit (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view WhatsApp settings")
    
    try:
        # Use unit_id from query or current user's unit
        target_unit_id = unit_id or current_user.unit_id
        
        # For admin users without unit_id, return general status
        if not target_unit_id:
            # Return list of all configurations for admin
            configs = await db.whatsapp_configurations.find({}).to_list(length=None)
            if not configs:
                return {
                    "configured": False,
                    "unit_id": None,
                    "message": "No WhatsApp configurations found. Create one for a specific unit.",
                    "all_configurations": []
                }
            
            # Return info about existing configurations
            config_info = [{"unit_id": c["unit_id"], "phone_number": c.get("phone_number", "N/A")} for c in configs]
            return {
                "configured": True,
                "unit_id": None,
                "message": f"Found {len(configs)} WhatsApp configuration(s)",
                "all_configurations": config_info
            }
        
        # Get configuration from database
        config = await db.whatsapp_configurations.find_one({"unit_id": target_unit_id})
        
        if not config:
            return {
                "configured": False,
                "unit_id": target_unit_id,
                "message": "WhatsApp not configured for this unit"
            }
        
        return {
            "configured": True,
            "unit_id": target_unit_id,
            "phone_number": config["phone_number"],
            "is_connected": config.get("is_connected", False),
            "connection_status": config.get("connection_status", "disconnected"),
            "qr_code": config.get("qr_code"),
            "webhook_url": config.get("webhook_url"),
            "last_seen": config.get("last_seen").isoformat() if config.get("last_seen") else None,
            "created_at": config["created_at"].isoformat(),
            "updated_at": config.get("updated_at", config["created_at"]).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Get WhatsApp configuration error: {str(e)}")
        # Return empty config instead of raising error to prevent frontend crash
        return {
            "configured": False,
            "unit_id": target_unit_id if 'target_unit_id' in locals() else None,
            "message": f"Error loading WhatsApp configuration: {str(e)}",
            "error": True
        }

@api_router.post("/whatsapp-connect")
async def connect_whatsapp(
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Connect WhatsApp for specific unit (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can connect WhatsApp")
    
    try:
        target_unit_id = unit_id or current_user.unit_id
        if not target_unit_id:
            raise HTTPException(status_code=400, detail="Unit ID is required")
        
        # Get configuration
        config = await db.whatsapp_configurations.find_one({"unit_id": target_unit_id})
        if not config:
            raise HTTPException(status_code=404, detail="WhatsApp configuration not found for this unit")
        
        # Simulate connection process
        await db.whatsapp_configurations.update_one(
            {"unit_id": target_unit_id},
            {
                "$set": {
                    "is_connected": True,
                    "connection_status": "connected",
                    "last_seen": datetime.now(timezone.utc),
                    "qr_code": None,  # Clear QR code after connection
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            "success": True,
            "message": "WhatsApp connected successfully",
            "unit_id": target_unit_id,
            "connection_status": "connected",
            "phone_number": config["phone_number"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"WhatsApp connection error: {e}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@api_router.post("/whatsapp/send")
async def send_whatsapp_message(
    phone_number: str = Form(...),
    message: str = Form(...),
    message_type: str = Form("text"),
    current_user: User = Depends(get_current_user)
):
    """Send WhatsApp message"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE, UserRole.AGENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        result = await whatsapp_service.send_message(phone_number, message, message_type)
        
        if result["success"]:
            return {
                "success": True,
                "message": "Message sent successfully",
                "message_id": result.get("message_id"),
                "phone_number": phone_number
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to send message"))
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Send WhatsApp message error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

@api_router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    """WhatsApp webhook for receiving messages"""
    try:
        # Get request data
        webhook_data = await request.json()
        
        # Process webhook
        result = await whatsapp_service.process_webhook(webhook_data)
        
        return {"success": True, "processed": result.get("processed", 0)}
        
    except Exception as e:
        logging.error(f"WhatsApp webhook error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/whatsapp/webhook")
async def verify_whatsapp_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    hub_verify_token: str = Query(..., alias="hub.verify_token")
):
    """Verify WhatsApp webhook"""
    verify_token = os.environ.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
    
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        return int(hub_challenge)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

@api_router.post("/whatsapp/validate-lead")
async def validate_lead_whatsapp(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Validate if lead's phone number is on WhatsApp"""
    
    try:
        # Get lead
        lead = await db.leads.find_one({"id": lead_id})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        phone_number = lead.get("telefono")
        if not phone_number:
            raise HTTPException(status_code=400, detail="Lead has no phone number")
        
        # Validate phone number with WhatsApp
        validation_result = await whatsapp_service.validate_phone_number(phone_number)
        
        # Store validation result
        validation_data = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "phone_number": phone_number,
            "is_whatsapp": validation_result["is_whatsapp"],
            "validation_status": validation_result["validation_status"],
            "validation_date": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.lead_whatsapp_validations.insert_one(validation_data)
        
        return {
            "success": True,
            "lead_id": lead_id,
            "phone_number": phone_number,
            "is_whatsapp": validation_result["is_whatsapp"],
            "validation_status": validation_result["validation_status"],
            "message": f"Phone number {'is' if validation_result['is_whatsapp'] else 'is not'} on WhatsApp"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"WhatsApp validation error: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@api_router.get("/whatsapp/conversations")
async def get_whatsapp_conversations(
    unit_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get WhatsApp conversations for unit"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        target_unit_id = unit_id or current_user.unit_id
        conversations = await whatsapp_service.get_active_conversations(target_unit_id)
        
        return {
            "success": True,
            "conversations": conversations[:limit],
            "total": len(conversations)
        }
        
    except Exception as e:
        logging.error(f"Get WhatsApp conversations error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversations: {str(e)}")

@api_router.get("/whatsapp/conversation/{phone_number}/history")
async def get_conversation_history(
    phone_number: str,
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get conversation history for phone number"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE, UserRole.AGENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        messages = await whatsapp_service.get_conversation_history(phone_number, limit)
        
        return {
            "success": True,
            "phone_number": phone_number,
            "messages": messages,
            "total": len(messages)
        }
        
    except Exception as e:
        logging.error(f"Get conversation history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversation history: {str(e)}")

@api_router.post("/whatsapp/bulk-validate")
async def bulk_validate_leads(
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Bulk validate WhatsApp numbers for leads in unit"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can perform bulk validation")
    
    try:
        # Get leads from unit
        query = {}
        if unit_id:
            query["unit_id"] = unit_id
        elif current_user.unit_id:
            query["unit_id"] = current_user.unit_id
        
        leads = await db.leads.find(query).to_list(length=1000)
        
        validated_count = 0
        results = []
        
        for lead in leads:
            if lead.get("telefono"):
                validation_result = await whatsapp_service.validate_phone_number(lead["telefono"])
                
                # Store validation
                validation_data = {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead["id"],
                    "phone_number": lead["telefono"],
                    "is_whatsapp": validation_result["is_whatsapp"],
                    "validation_status": validation_result["validation_status"],
                    "validation_date": datetime.now(timezone.utc),
                    "created_at": datetime.now(timezone.utc)
                }
                
                await db.lead_whatsapp_validations.insert_one(validation_data)
                
                results.append({
                    "lead_id": lead["id"],
                    "phone_number": lead["telefono"],
                    "is_whatsapp": validation_result["is_whatsapp"]
                })
                
                validated_count += 1
        
        return {
            "success": True,
            "validated_count": validated_count,
            "total_leads": len(leads),
            "unit_id": unit_id or current_user.unit_id,
            "results": results
        }
        
    except Exception as e:
        logging.error(f"Bulk WhatsApp validation error: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk validation failed: {str(e)}")

# Automated Lead Qualification (FASE 4) endpoints
@api_router.post("/lead-qualification/start")
async def start_lead_qualification(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start automated qualification process for a lead"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Verify lead exists
        lead = await db.leads.find_one({"id": lead_id})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Check if qualification already active
        existing_qualification = await db.lead_qualifications.find_one({
            "lead_id": lead_id,
            "status": "active"
        })
        
        if existing_qualification:
            raise HTTPException(status_code=400, detail="Qualification already active for this lead")
        
        # Start qualification process
        await lead_qualification_bot.start_qualification_process(lead_id)
        
        return {
            "success": True,
            "message": "Lead qualification started successfully",
            "lead_id": lead_id,
            "qualification_started": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Start qualification error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start qualification: {str(e)}")

@api_router.get("/lead-qualification/{lead_id}/status")
async def get_qualification_status(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get qualification status for a lead"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE, UserRole.AGENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get qualification record
        qualification = await db.lead_qualifications.find_one({"lead_id": lead_id})
        
        if not qualification:
            return {
                "lead_id": lead_id,
                "qualification_active": False,
                "message": "No qualification found for this lead"
            }
        
        # Calculate time remaining
        time_remaining = None
        if qualification["status"] == "active":
            timeout_at = qualification["timeout_at"]
            current_time = datetime.now(timezone.utc)
            if current_time < timeout_at:
                time_remaining = int((timeout_at - current_time).total_seconds())
        
        return {
            "lead_id": lead_id,
            "qualification_active": qualification["status"] == "active",
            "stage": qualification["stage"],
            "status": qualification["status"],
            "score": qualification.get("score", 0),
            "started_at": qualification["started_at"].isoformat(),
            "timeout_at": qualification["timeout_at"].isoformat(),
            "time_remaining_seconds": time_remaining,
            "responses_count": qualification.get("lead_responses", 0),
            "bot_messages_sent": qualification.get("bot_messages_sent", 0),
            "result": qualification.get("result"),
            "completed_at": qualification.get("completed_at").isoformat() if qualification.get("completed_at") else None
        }
        
    except Exception as e:
        logging.error(f"Get qualification status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get qualification status")

@api_router.post("/lead-qualification/{lead_id}/response")
async def process_qualification_response(
    lead_id: str,
    message: str = Form(...),
    source: str = Form("manual"),
    current_user: User = Depends(get_current_user)
):
    """Process lead response during qualification (for manual input)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE, UserRole.AGENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Process the response
        processed = await lead_qualification_bot.process_lead_response(lead_id, message, source)
        
        if processed:
            return {
                "success": True,
                "message": "Response processed successfully",
                "lead_id": lead_id,
                "response_message": message
            }
        else:
            return {
                "success": False,
                "message": "Could not process response (qualification may be inactive or timed out)",
                "lead_id": lead_id
            }
        
    except Exception as e:
        logging.error(f"Process qualification response error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process response")

@api_router.post("/lead-qualification/{lead_id}/complete")
async def complete_qualification_manually(
    lead_id: str,
    result: str = Form(...),  # qualified, not_interested, error
    score: int = Form(50),
    notes: str = Form(""),
    current_user: User = Depends(get_current_user)
):
    """Manually complete qualification (admin/referente only)"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE]:
        raise HTTPException(status_code=403, detail="Only admin/referente can manually complete qualification")
    
    try:
        # Verify qualification exists and is active
        qualification = await db.lead_qualifications.find_one({
            "lead_id": lead_id,
            "status": "active"
        })
        
        if not qualification:
            raise HTTPException(status_code=404, detail="No active qualification found for this lead")
        
        # Add manual completion note
        if notes:
            await db.lead_qualifications.update_one(
                {"lead_id": lead_id},
                {
                    "$push": {
                        "responses": {
                            "message": f"Manual completion: {notes}",
                            "timestamp": datetime.now(timezone.utc),
                            "source": "manual_admin",
                            "stage": qualification["stage"],
                            "completed_by": current_user.username
                        }
                    }
                }
            )
        
        # Complete qualification
        await lead_qualification_bot.complete_qualification(lead_id, result, score)
        
        return {
            "success": True,
            "message": "Qualification completed manually",
            "lead_id": lead_id,
            "result": result,
            "score": score
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Manual complete qualification error: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete qualification")

@api_router.get("/lead-qualification/active")
async def get_active_qualifications(
    unit_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get active qualification processes"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build query
        query = {"status": "active"}
        
        # Filter by unit if specified and user has access
        if unit_id:
            if current_user.role != UserRole.ADMIN and current_user.unit_id != unit_id:
                raise HTTPException(status_code=403, detail="Access denied to this unit")
            
            # Get leads from specified unit
            unit_leads = await db.leads.find({"unit_id": unit_id}).to_list(length=None)
            lead_ids = [lead["id"] for lead in unit_leads]
            query["lead_id"] = {"$in": lead_ids}
        elif current_user.role != UserRole.ADMIN and current_user.unit_id:
            # Referente - filter by their unit
            unit_leads = await db.leads.find({"unit_id": current_user.unit_id}).to_list(length=None)
            lead_ids = [lead["id"] for lead in unit_leads]
            query["lead_id"] = {"$in": lead_ids}
        
        # Get active qualifications
        qualifications = await db.lead_qualifications.find(query)\
            .sort("started_at", -1).limit(limit).to_list(length=limit)
        
        # Enrich with lead data
        enriched_qualifications = []
        for qual in qualifications:
            lead = await db.leads.find_one({"id": qual["lead_id"]})
            if lead:
                # Calculate time remaining
                time_remaining = None
                if qual["timeout_at"] > datetime.now(timezone.utc):
                    time_remaining = int((qual["timeout_at"] - datetime.now(timezone.utc)).total_seconds())
                
                enriched_qualifications.append({
                    "qualification_id": qual["id"],
                    "lead_id": qual["lead_id"],
                    "lead_name": f"{lead.get('nome', '')} {lead.get('cognome', '')}".strip(),
                    "lead_phone": lead.get("telefono"),
                    "stage": qual["stage"],
                    "score": qual.get("score", 0),
                    "started_at": qual["started_at"].isoformat(),
                    "time_remaining_seconds": time_remaining,
                    "responses_count": qual.get("lead_responses", 0),
                    "bot_messages_sent": qual.get("bot_messages_sent", 0)
                })
        
        return {
            "success": True,
            "active_qualifications": enriched_qualifications,
            "total": len(enriched_qualifications),
            "unit_id": unit_id or current_user.unit_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get active qualifications error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get active qualifications")

@api_router.post("/lead-qualification/process-timeouts")
async def process_qualification_timeouts(
    current_user: User = Depends(get_current_user)
):
    """Process qualification timeouts (admin only - for manual trigger)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can trigger timeout processing")
    
    try:
        processed_count = await lead_qualification_bot.process_scheduled_tasks()
        
        return {
            "success": True,
            "message": f"Processed {processed_count} timeout tasks",
            "processed_count": processed_count
        }
        
    except Exception as e:
        logging.error(f"Process timeouts error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process timeouts")

@api_router.get("/lead-qualification/analytics")
async def get_qualification_analytics(
    unit_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get qualification analytics and statistics"""
    
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build date filter
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
        if date_to:
            date_filter["$lte"] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        
        query = {}
        if date_filter:
            query["started_at"] = date_filter
        
        # Filter by unit if specified and user has access
        if unit_id:
            if current_user.role != UserRole.ADMIN and current_user.unit_id != unit_id:
                raise HTTPException(status_code=403, detail="Access denied to this unit")
            
            unit_leads = await db.leads.find({"unit_id": unit_id}).to_list(length=None)
            lead_ids = [lead["id"] for lead in unit_leads]
            query["lead_id"] = {"$in": lead_ids}
        elif current_user.role != UserRole.ADMIN and current_user.unit_id:
            unit_leads = await db.leads.find({"unit_id": current_user.unit_id}).to_list(length=None)
            lead_ids = [lead["id"] for lead in unit_leads]
            query["lead_id"] = {"$in": lead_ids}
        
        # Get all qualifications for analytics
        qualifications = await db.lead_qualifications.find(query).to_list(length=None)
        
        # Calculate statistics
        total_qualifications = len(qualifications)
        active_qualifications = len([q for q in qualifications if q["status"] == "active"])
        completed_qualifications = len([q for q in qualifications if q["status"] == "completed"])
        
        # Results breakdown
        results_breakdown = {}
        scores_list = []
        
        for qual in qualifications:
            if qual["status"] == "completed":
                result = qual.get("result", "unknown")
                results_breakdown[result] = results_breakdown.get(result, 0) + 1
                if qual.get("score"):
                    scores_list.append(qual["score"])
        
        # Calculate averages
        avg_score = sum(scores_list) / len(scores_list) if scores_list else 0
        avg_responses = sum([q.get("lead_responses", 0) for q in qualifications]) / total_qualifications if total_qualifications > 0 else 0
        avg_bot_messages = sum([q.get("bot_messages_sent", 0) for q in qualifications]) / total_qualifications if total_qualifications > 0 else 0
        
        # Conversion rates
        qualified_count = results_breakdown.get("qualified", 0)
        conversion_rate = (qualified_count / completed_qualifications * 100) if completed_qualifications > 0 else 0
        
        return {
            "success": True,
            "analytics": {
                "total_qualifications": total_qualifications,
                "active_qualifications": active_qualifications,
                "completed_qualifications": completed_qualifications,
                "results_breakdown": results_breakdown,
                "conversion_rate": round(conversion_rate, 2),
                "average_score": round(avg_score, 1),
                "average_responses_per_lead": round(avg_responses, 1),
                "average_bot_messages": round(avg_bot_messages, 1),
                "qualified_leads": qualified_count
            },
            "date_range": {
                "from": date_from,
                "to": date_to
            },
            "unit_id": unit_id or current_user.unit_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get qualification analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get qualification analytics")

# Workflow Builder endpoints (FASE 3)
@api_router.get("/workflows", response_model=List[Workflow])
async def get_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get workflows with filtering and pagination"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow builder")
    
    try:
        # Admin users can access workflows, filter by unit if specified
        query = {}
        if unit_id:
            query["unit_id"] = unit_id
        elif current_user.role != UserRole.ADMIN:
            query["unit_id"] = current_user.unit_id
        
        workflows = await db.workflows.find(query).skip(skip).limit(limit).to_list(length=None)
        return workflows
        
    except Exception as e:
        logging.error(f"Get workflows error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflows")

@api_router.post("/workflows", response_model=Workflow)
async def create_workflow(
    workflow_in: WorkflowCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create workflows")
    
    try:
        workflow_data = workflow_in.dict()
        
        # For admin users, use the first available unit if they don't have a unit_id
        unit_id = current_user.unit_id
        if not unit_id:
            # Get the first available unit for admin users
            first_unit = await db.units.find_one({})
            if first_unit:
                unit_id = first_unit["id"]
            else:
                raise HTTPException(status_code=400, detail="No units available. Create a unit first.")
        
        workflow_data.update({
            "id": str(uuid.uuid4()),
            "created_by": current_user.id,
            "unit_id": unit_id,
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
            "is_published": False
        })
        
        workflow = Workflow(**workflow_data)
        await db.workflows.insert_one(workflow.dict())
        return workflow
        
    except Exception as e:
        logging.error(f"Create workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create workflow")

@api_router.get("/workflows/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get workflow by ID"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        return Workflow(**workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow")

@api_router.put("/workflows/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: str,
    workflow_in: WorkflowUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update workflow (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Prepare update data
        update_data = {k: v for k, v in workflow_in.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Basic validation for publishing
        if update_data.get("is_published") and not workflow.get("is_published"):
            # Check if workflow has at least one trigger node
            trigger_nodes = await db.workflow_nodes.find({
                "workflow_id": workflow_id,
                "node_type": "trigger"
            }).to_list(length=None)
            
            if not trigger_nodes:
                raise HTTPException(
                    status_code=400, 
                    detail="Workflow must have at least one trigger node before publishing")
        
        await db.workflows.update_one(
            {"id": workflow_id},
            {"$set": update_data}
        )
        
        updated_workflow = await db.workflows.find_one({"id": workflow_id})
        return Workflow(**updated_workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update workflow")

@api_router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete workflow (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Check if workflow has active executions
        active_executions = await db.workflow_executions.find({
            "workflow_id": workflow_id,
            "status": {"$in": ["pending", "running"]}
        }).to_list(length=None)
        
        if active_executions:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete workflow with active executions")
        
        # Delete workflow and related data
        await db.workflows.delete_one({"id": workflow_id})
        await db.workflow_nodes.delete_many({"workflow_id": workflow_id})
        await db.node_connections.delete_many({"workflow_id": workflow_id})
        
        return {"detail": "Workflow deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete workflow")

# Workflow Nodes endpoints
@api_router.post("/workflows/{workflow_id}/nodes", response_model=WorkflowNode)
async def create_node(
    workflow_id: str,
    node_in: WorkflowNodeCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow node"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create workflow nodes")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Create the node
        node_data = node_in.dict()
        node_data.update({
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        node = WorkflowNode(**node_data)
        await db.workflow_nodes.insert_one(node.dict())
        return node
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Create node error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create node")

@api_router.get("/workflows/{workflow_id}/nodes", response_model=List[WorkflowNode])
async def get_workflow_nodes(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all nodes for a workflow"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow nodes")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        nodes = await db.workflow_nodes.find({"workflow_id": workflow_id}).to_list(length=None)
        return [WorkflowNode(**node) for node in nodes]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow nodes error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow nodes")

@api_router.put("/nodes/{node_id}", response_model=WorkflowNode)
async def update_node(
    node_id: str,
    node_in: WorkflowNodeUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a workflow node"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update workflow nodes")
    
    try:
        node = await db.workflow_nodes.find_one({"id": node_id})
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check workflow access
        workflow = await db.workflows.find_one({"id": node["workflow_id"]})
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Prepare update data
        update_data = {k: v for k, v in node_in.dict().items() if v is not None}
        
        await db.workflow_nodes.update_one(
            {"id": node_id},
            {"$set": update_data}
        )
        
        updated_node = await db.workflow_nodes.find_one({"id": node_id})
        return WorkflowNode(**updated_node)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update node error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update node")

@api_router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a workflow node"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete workflow nodes")
    
    try:
        node = await db.workflow_nodes.find_one({"id": node_id})
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check workflow access
        workflow = await db.workflows.find_one({"id": node["workflow_id"]})
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Remove all connections involving this node
        await db.node_connections.delete_many({
            "$or": [
                {"source_node_id": node_id},
                {"target_node_id": node_id}
            ]
        })
        
        # Remove the node
        await db.workflow_nodes.delete_one({"id": node_id})
        return {"detail": "Node deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete node error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete node")

# Node Connections endpoints
@api_router.post("/workflows/{workflow_id}/connections", response_model=NodeConnection)
async def create_connection(
    workflow_id: str,
    connection_in: NodeConnectionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new node connection"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create node connections")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Verify both nodes exist and belong to this workflow
        source_node = await db.workflow_nodes.find_one({
            "id": connection_in.source_node_id,
            "workflow_id": workflow_id
        })
        target_node = await db.workflow_nodes.find_one({
            "id": connection_in.target_node_id,
            "workflow_id": workflow_id
        })
        
        if not source_node or not target_node:
            raise HTTPException(status_code=400, detail="Invalid source or target node")
        
        # Create the connection
        connection_data = connection_in.dict()
        connection_data.update({
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        connection = NodeConnection(**connection_data)
        await db.node_connections.insert_one(connection.dict())
        return connection
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Create connection error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create connection")

@api_router.get("/workflows/{workflow_id}/connections", response_model=List[NodeConnection])
async def get_workflow_connections(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all connections for a workflow"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow connections")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        connections = await db.node_connections.find({"workflow_id": workflow_id}).to_list(length=None)
        return [NodeConnection(**conn) for conn in connections]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow connections error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow connections")

@api_router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a node connection"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete node connections")
    
    try:
        connection = await db.node_connections.find_one({"id": connection_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Check workflow access
        workflow = await db.workflows.find_one({"id": connection["workflow_id"]})
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        await db.node_connections.delete_one({"id": connection_id})
        return {"detail": "Connection deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete connection error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete connection")

# Workflow execution endpoints
@api_router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    execution_in: WorkflowExecutionCreate,
    current_user: User = Depends(get_current_user)
):
    """Execute workflow for testing purposes"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can execute workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        if not workflow.get("is_published"):
            raise HTTPException(status_code=400, detail="Cannot execute unpublished workflow")
        
        # Create execution record
        execution_data = {
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "contact_id": execution_in.contact_id,
            "status": "pending",
            "started_at": datetime.now(timezone.utc),
            "execution_data": execution_in.trigger_data or {},
            "retry_count": 0
        }
        
        execution = WorkflowExecution(**execution_data)
        await db.workflow_executions.insert_one(execution.dict())
        
        # For now, we'll just mark it as completed for testing
        # In a real implementation, this would trigger background processing
        await db.workflow_executions.update_one(
            {"id": execution.id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "detail": "Workflow execution started",
            "execution_id": execution.id,
            "workflow_id": workflow_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Execute workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute workflow")

@api_router.get("/workflows/{workflow_id}/executions", response_model=List[WorkflowExecution])
async def get_workflow_executions(
    workflow_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user)
):
    """Get workflow execution history"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow executions")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        executions = await db.workflow_executions.find(
            {"workflow_id": workflow_id}
        ).sort("started_at", -1).skip(skip).limit(limit).to_list(length=None)
        
        return [WorkflowExecution(**exec) for exec in executions]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow executions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow executions")

# Get available node types for the workflow builder
@api_router.get("/workflow-node-types")
async def get_workflow_node_types(current_user: User = Depends(get_current_user)):
    """Get available workflow node types and subtypes"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow node types")
    
    # Return GoHighLevel-style node types
    node_types = {
        "trigger": {
            "name": "Triggers",
            "description": "Events that start a workflow",
            "subtypes": {
                "contact_created": {
                    "name": "Contact Created",
                    "description": "Triggers when a new contact is created",
                    "icon": "user-plus",
                    "color": "green"
                },
                "form_submitted": {
                    "name": "Form Submitted", 
                    "description": "Triggers when a form is submitted",
                    "icon": "form-input",
                    "color": "blue"
                },
                "lead_assigned": {
                    "name": "Lead Assigned",
                    "description": "Triggers when a lead is assigned to an agent",
                    "icon": "user-check",
                    "color": "purple"
                }
            }
        },
        "action": {
            "name": "Actions",
            "description": "Actions to perform in the workflow",
            "subtypes": {
                "send_email": {
                    "name": "Send Email",
                    "description": "Send an email to a contact",
                    "icon": "mail",
                    "color": "blue"
                },
                "send_sms": {
                    "name": "Send SMS",
                    "description": "Send an SMS to a contact",
                    "icon": "message-square",
                    "color": "green"
                },
                "send_whatsapp": {
                    "name": "Send WhatsApp",
                    "description": "Invia un messaggio WhatsApp al contatto",
                    "icon": "message-circle",
                    "color": "green"
                },
                "update_contact": {
                    "name": "Update Contact",
                    "description": "Update contact information",
                    "icon": "edit",
                    "color": "orange"
                },
                "update_contact_field": {
                    "name": "Update Contact Field",
                    "description": "Aggiorna un campo nel record del contatto",
                    "icon": "edit-3",
                    "color": "orange"
                },
                "assign_to_user": {
                    "name": "Assign to User",
                    "description": "Assign contact to a specific user",
                    "icon": "user",
                    "color": "purple"
                },
                "add_tag": {
                    "name": "Add Tag",
                    "description": "Add a tag to the contact",
                    "icon": "tag",
                    "color": "yellow"
                },
                "remove_tag": {
                    "name": "Remove Tag",
                    "description": "Remove a tag from the contact",
                    "icon": "tag",
                    "color": "red"
                },
                "set_status": {
                    "name": "Set Status", 
                    "description": "Imposta lo stato del contatto",
                    "icon": "circle",
                    "color": "blue"
                },
                "create_task": {
                    "name": "Create Task",
                    "description": "Create a task for a user",
                    "icon": "check-square",
                    "color": "red"
                }
            }
        },
        "condition": {
            "name": "Conditions",
            "description": "Decision points in the workflow",
            "subtypes": {
                "if_else": {
                    "name": "If/Else",
                    "description": "Branch workflow based on conditions",
                    "icon": "git-branch",
                    "color": "purple"
                },
                "contact_filter": {
                    "name": "Contact Filter",
                    "description": "Filter contacts based on criteria",
                    "icon": "filter",
                    "color": "blue"
                }
            }
        },
        "delay": {
            "name": "Delays",
            "description": "Wait periods in the workflow",
            "subtypes": {
                "wait": {
                    "name": "Wait",
                    "description": "Wait for a specified amount of time",
                    "icon": "clock",
                    "color": "gray"
                },
                "wait_until": {
                    "name": "Wait Until",
                    "description": "Wait until a specific date/time",
                    "icon": "calendar",
                    "color": "blue"
                }
            }
        }
    }
    
    return node_types

# Copy workflow between units endpoint
@api_router.post("/workflows/{workflow_id}/copy")
async def copy_workflow_to_unit(
    workflow_id: str,
    target_unit_id: str = Query(..., description="ID of target unit"),
    current_user: User = Depends(get_current_user)
):
    """Copy workflow to another unit (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can copy workflows between units")
    
    try:
        # Get source workflow
        source_workflow = await db.workflows.find_one({"id": workflow_id})
        if not source_workflow:
            raise HTTPException(status_code=404, detail="Source workflow not found")
        
        # Check access to source workflow
        if current_user.role != UserRole.ADMIN and source_workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to source workflow")
        
        # Verify target unit exists
        target_unit = await db.units.find_one({"id": target_unit_id})
        if not target_unit:
            raise HTTPException(status_code=404, detail="Target unit not found")
        
        # Create new workflow copy
        new_workflow = Workflow(
            name=f"{source_workflow['name']} (Copia)",
            description=f"Copia da Unit {source_workflow['unit_id']}: {source_workflow.get('description', '')}",
            unit_id=target_unit_id,
            created_by=current_user.id,
            is_active=source_workflow["is_active"],
            is_published=False,  # Copied workflows start as unpublished
            workflow_data=source_workflow.get("workflow_data")
        )
        
        await db.workflows.insert_one(new_workflow.dict())
        
        # Copy workflow nodes
        source_nodes = await db.workflow_nodes.find({"workflow_id": workflow_id}).to_list(length=None)
        node_id_mapping = {}  # Map old node IDs to new ones
        
        for source_node in source_nodes:
            new_node_id = str(uuid.uuid4())
            node_id_mapping[source_node["id"]] = new_node_id
            
            new_node = WorkflowNode(
                id=new_node_id,
                workflow_id=new_workflow.id,
                node_type=source_node["node_type"],
                node_subtype=source_node["node_subtype"],
                name=source_node["name"],
                position_x=source_node["position_x"],
                position_y=source_node["position_y"],
                configuration=source_node.get("configuration")
            )
            
            await db.workflow_nodes.insert_one(new_node.dict())
        
        # Copy workflow connections with updated node IDs
        source_connections = await db.node_connections.find({"workflow_id": workflow_id}).to_list(length=None)
        
        for source_connection in source_connections:
            new_connection = NodeConnection(
                workflow_id=new_workflow.id,
                source_node_id=node_id_mapping.get(source_connection["source_node_id"]),
                target_node_id=node_id_mapping.get(source_connection["target_node_id"]),
                source_handle=source_connection.get("source_handle"),
                target_handle=source_connection.get("target_handle"),
                condition_data=source_connection.get("condition_data")
            )
            
            await db.node_connections.insert_one(new_connection.dict())
        
        return {
            "success": True,
            "message": f"Workflow copied successfully to unit {target_unit['name']}",
            "new_workflow_id": new_workflow.id,
            "source_workflow_id": workflow_id,
            "target_unit_id": target_unit_id,
            "nodes_copied": len(source_nodes),
            "connections_copied": len(source_connections)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Copy workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to copy workflow")

# Call Center Endpoints

# Agent Management
@api_router.post("/call-center/agents", response_model=AgentCallCenter)
async def create_agent(agent_data: AgentCreate, current_user: User = Depends(get_current_user)):
    """Create new call center agent"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if agent already exists
    existing_agent = await db.agent_call_center.find_one({"user_id": agent_data.user_id})
    if existing_agent:
        raise HTTPException(status_code=400, detail="Agent already exists")
    
    # Verify user exists
    user = await db.users.find_one({"id": agent_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    agent = AgentCallCenter(**agent_data.dict())
    await db.agent_call_center.insert_one(agent.dict())
    
    return agent

@api_router.get("/call-center/agents", response_model=List[AgentCallCenter])
async def get_agents(current_user: User = Depends(get_current_user)):
    """Get all call center agents"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    agents = await db.agent_call_center.find().to_list(length=None)
    return [AgentCallCenter(**agent) for agent in agents]

@api_router.get("/call-center/agents/{agent_id}", response_model=AgentCallCenter)
async def get_agent(agent_id: str, current_user: User = Depends(get_current_user)):
    """Get specific agent"""
    if current_user.role not in ["admin", "referente"] and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    agent_doc = await db.agent_call_center.find_one({"user_id": agent_id})
    if not agent_doc:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return AgentCallCenter(**agent_doc)

@api_router.put("/call-center/agents/{agent_id}/status")
async def update_agent_status(
    agent_id: str,
    status_data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """Update agent status"""
    if current_user.role not in ["admin", "referente"] and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    status = status_data.get("status")
    if status not in [s.value for s in AgentStatus]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await call_center_service.update_agent_status(agent_id, AgentStatus(status))
    
    return {"message": "Status updated successfully"}

# Call Management
@api_router.get("/call-center/calls", response_model=List[Call])
async def get_calls(
    unit_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get calls with filters"""
    if current_user.role not in ["admin", "referente"]:
        # Agents can only see their own calls
        agent_id = current_user.id
    
    query = {}
    if unit_id:
        query["unit_id"] = unit_id
    if agent_id:
        query["agent_id"] = agent_id
    if status:
        query["status"] = status
    
    calls = await db.calls.find(query).sort("created_at", -1).limit(limit).to_list(length=None)
    return [Call(**call) for call in calls]

@api_router.get("/call-center/calls/{call_sid}", response_model=Call)
async def get_call(call_sid: str, current_user: User = Depends(get_current_user)):
    """Get specific call"""
    call_doc = await db.calls.find_one({"call_sid": call_sid})
    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")
    
    call = Call(**call_doc)
    
    # Check access permissions
    if current_user.role not in ["admin", "referente"] and call.agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return call

@api_router.post("/call-center/calls/outbound")
async def make_outbound_call(
    call_data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """Make outbound call"""
    to_number = call_data.get("to_number")
    from_number = call_data.get("from_number", DEFAULT_CALLER_ID)
    
    if not to_number:
        raise HTTPException(status_code=400, detail="to_number is required")
    
    try:
        # Create call record
        call_create_data = CallCreate(
            direction=CallDirection.OUTBOUND,
            from_number=from_number,
            to_number=to_number,
            unit_id=current_user.unit_id or "default"
        )
        
        # Make Twilio call
        twilio_result = await twilio_service.make_outbound_call(
            to_number=to_number,
            from_number=from_number
        )
        
        # Create call record with Twilio SID
        call_create_data.call_sid = twilio_result["call_sid"]
        call = await call_center_service.create_call(call_create_data)
        
        # Assign to current user (agent making the call)
        await call_center_service.assign_agent_to_call(twilio_result["call_sid"], current_user.id)
        
        return {
            "call_sid": twilio_result["call_sid"],
            "status": "initiated",
            "to": to_number,
            "from": from_number
        }
        
    except Exception as e:
        logging.error(f"Outbound call error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Call failed: {str(e)}")

# Twilio Webhook Endpoints
@api_router.post("/call-center/voice/incoming")
async def handle_incoming_call(request: Request):
    """Handle incoming call webhook from Twilio"""
    form_data = await request.form()
    
    # Extract call information
    call_sid = form_data.get("CallSid")
    from_number = form_data.get("From")
    to_number = form_data.get("To")
    caller_country = form_data.get("CallerCountry")
    caller_state = form_data.get("CallerState")
    caller_city = form_data.get("CallerCity")
    
    logging.info(f"Incoming call {call_sid} from {from_number} to {to_number}")
    
    try:
        # Route call through ACD
        routing_result = await acd_service.route_incoming_call(
            call_sid=call_sid,
            from_number=from_number,
            to_number=to_number,
            unit_id="default"  # TODO: Determine unit from phone number
        )
        
        # Generate TwiML response
        response = VoiceResponse()
        
        if routing_result["action"] == "connect_agent":
            response.say("Connecting you to an agent. Please hold.")
            
            # TODO: Connect to agent via WebRTC or conference
            dial = Dial()
            dial.number("+1234567890")  # Placeholder - should connect to agent
            response.append(dial)
            
        elif routing_result["action"] == "queue_call":
            response.say(routing_result["message"])
            response.say("Your call is important to us. Please stay on the line.")
            
            # Hold music or queue announcement
            response.play("http://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.wav")
        
        # Start call recording if enabled
        if CALL_RECORDING_ENABLED:
            response.record(
                action=f"/api/call-center/voice/recording-status/{call_sid}",
                recordingStatusCallback=f"/api/call-center/voice/recording-complete/{call_sid}",
                recordingStatusCallbackMethod="POST"
            )
        
        return Response(content=str(response), media_type="application/xml")
        
    except Exception as e:
        logging.error(f"Error handling incoming call: {str(e)}")
        
        # Fallback TwiML
        response = VoiceResponse()
        response.say("We're sorry, but we're experiencing technical difficulties. Please try again later.")
        response.hangup()
        
        return Response(content=str(response), media_type="application/xml")

@api_router.post("/call-center/voice/call-status/{call_sid}")
async def handle_call_status(call_sid: str, request: Request):
    """Handle call status updates from Twilio"""
    form_data = await request.form()
    
    call_status = form_data.get("CallStatus")
    call_duration = form_data.get("CallDuration", "0")
    
    logging.info(f"Call {call_sid} status: {call_status}, duration: {call_duration}")
    
    try:
        # Update call record
        await call_center_service.update_call_status(
            call_sid=call_sid,
            status=CallStatus(call_status.lower().replace("-", "_")),
            duration=int(call_duration) if call_duration.isdigit() else 0
        )
        
        # Handle call completion
        if call_status in ["completed", "failed", "busy", "no-answer", "canceled"]:
            call = await call_center_service.get_call(call_sid)
            if call and call.agent_id:
                # Release agent
                await call_center_service.update_agent_status(call.agent_id, AgentStatus.AVAILABLE)
                
                # Process next call in queue
                await acd_service.process_queue(call.unit_id)
        
        return {"status": "ok"}
        
    except Exception as e:
        logging.error(f"Error handling call status for {call_sid}: {str(e)}")
        return {"status": "error", "message": str(e)}

@api_router.post("/call-center/voice/recording-complete/{call_sid}")
async def handle_recording_complete(call_sid: str, request: Request):
    """Handle recording completion webhook"""
    form_data = await request.form()
    
    recording_sid = form_data.get("RecordingSid")
    recording_url = form_data.get("RecordingUrl")
    recording_duration = form_data.get("RecordingDuration", "0")
    
    logging.info(f"Recording completed for call {call_sid}: {recording_sid}")
    
    try:
        # Create recording record
        recording = CallRecording(
            call_sid=call_sid,
            recording_sid=recording_sid,
            duration=int(recording_duration) if recording_duration.isdigit() else 0,
            storage_url=recording_url,
            status="completed"
        )
        
        await db.call_recordings.insert_one(recording.dict())
        
        # Update call record with recording info
        await db.calls.update_one(
            {"call_sid": call_sid},
            {
                "$set": {
                    "recording_sid": recording_sid,
                    "recording_url": recording_url
                }
            }
        )
        
        return {"status": "ok"}
        
    except Exception as e:
        logging.error(f"Error handling recording completion: {str(e)}")
        return {"status": "error", "message": str(e)}

# Call Analytics
@api_router.get("/call-center/analytics/dashboard")
async def get_call_center_dashboard(
    unit_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get call center dashboard metrics"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        current_time = datetime.now(timezone.utc)
        
        # Active calls count
        active_calls = await db.calls.count_documents({
            "status": {"$in": ["queued", "ringing", "in-progress"]}
        })
        
        # Available agents count
        available_agents = await db.agent_call_center.count_documents({
            "status": "available"
        })
        
        # Today's metrics
        today_start = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
        
        calls_today = await db.calls.count_documents({
            "created_at": {"$gte": today_start}
        })
        
        answered_today = await db.calls.count_documents({
            "created_at": {"$gte": today_start},
            "status": "completed"
        })
        
        abandoned_today = await db.calls.count_documents({
            "created_at": {"$gte": today_start},
            "status": "abandoned"
        })
        
        # Average wait time calculation (simplified)
        avg_wait_pipeline = [
            {"$match": {
                "created_at": {"$gte": today_start},
                "answered_at": {"$ne": None}
            }},
            {"$addFields": {
                "wait_time": {"$subtract": ["$answered_at", "$created_at"]}
            }},
            {"$group": {
                "_id": None,
                "avg_wait_time": {"$avg": "$wait_time"}
            }}
        ]
        
        wait_time_result = await db.calls.aggregate(avg_wait_pipeline).to_list(length=None)
        avg_wait_time = wait_time_result[0]["avg_wait_time"] / 1000 if wait_time_result else 0  # Convert to seconds
        
        return {
            "timestamp": current_time.isoformat(),
            "active_calls": active_calls,
            "available_agents": available_agents,
            "calls_today": calls_today,
            "answered_today": answered_today,
            "abandoned_today": abandoned_today,
            "answer_rate": (answered_today / calls_today * 100) if calls_today > 0 else 0,
            "abandonment_rate": (abandoned_today / calls_today * 100) if calls_today > 0 else 0,
            "avg_wait_time": round(avg_wait_time, 2)
        }
        
    except Exception as e:
        logging.error(f"Dashboard error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard")

# Sistema Autorizzazioni Gerarchiche Endpoints

# Gestione Commesse
@api_router.post("/commesse", response_model=Commessa)
async def create_commessa(commessa_data: CommessaCreate, current_user: User = Depends(get_current_user)):
    """Create new commessa"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    commessa = Commessa(**commessa_data.dict())
    await db.commesse.insert_one(commessa.dict())
    
    return commessa

@api_router.get("/commesse", response_model=List[Commessa])
async def get_commesse(current_user: User = Depends(get_current_user)):
    """Get accessible commesse for current user"""
    accessible_commesse_ids = await get_user_accessible_commesse(current_user)
    
    commesse = await db.commesse.find({
        "id": {"$in": accessible_commesse_ids},
        "is_active": True
    }).to_list(length=None)
    
    return [Commessa(**c) for c in commesse]

@api_router.get("/commesse/{commessa_id}", response_model=Commessa)
async def get_commessa(commessa_id: str, current_user: User = Depends(get_current_user)):
    """Get specific commessa"""
    if not await check_commessa_access(current_user, commessa_id):
        raise HTTPException(status_code=403, detail="Access denied to this commessa")
    
    commessa_doc = await db.commesse.find_one({"id": commessa_id})
    if not commessa_doc:
        raise HTTPException(status_code=404, detail="Commessa not found")
    
    return Commessa(**commessa_doc)

@api_router.put("/commesse/{commessa_id}", response_model=Commessa)
async def update_commessa(commessa_id: str, commessa_update: CommessaUpdate, current_user: User = Depends(get_current_user)):
    """Update commessa"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in commessa_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.commesse.update_one(
        {"id": commessa_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commessa not found")
    
    commessa_doc = await db.commesse.find_one({"id": commessa_id})
    return Commessa(**commessa_doc)

# Gestione Servizi
@api_router.post("/servizi", response_model=Servizio)
async def create_servizio(servizio_data: ServizioCreate, current_user: User = Depends(get_current_user)):
    """Create new servizio"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verifica che la commessa esista
    commessa = await db.commesse.find_one({"id": servizio_data.commessa_id})
    if not commessa:
        raise HTTPException(status_code=404, detail="Commessa not found")
    
    servizio = Servizio(**servizio_data.dict())
    await db.servizi.insert_one(servizio.dict())
    
    return servizio

@api_router.get("/commesse/{commessa_id}/servizi", response_model=List[Servizio])
async def get_servizi_by_commessa(commessa_id: str, current_user: User = Depends(get_current_user)):
    """Get servizi for a specific commessa"""
    if not await check_commessa_access(current_user, commessa_id):
        raise HTTPException(status_code=403, detail="Access denied to this commessa")
    
    servizi = await db.servizi.find({
        "commessa_id": commessa_id,
        "is_active": True
    }).to_list(length=None)
    
    return [Servizio(**s) for s in servizi]

@api_router.get("/tipologie-contratto")
async def get_tipologie_contratto(
    commessa_id: Optional[str] = Query(None), 
    servizio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get available tipologie contratto based on commessa and servizio"""
    
    # Controllo autorizzazione per responsabile commessa
    if current_user.role == UserRole.RESPONSABILE_COMMESSA and commessa_id:
        if not await check_commessa_access(current_user, commessa_id):
            raise HTTPException(status_code=403, detail="Access denied to this commessa")
    
    # Lista base per tutti i servizi di Fastweb
    tipologie_base = [
        {"value": "energia_fastweb", "label": "Energia Fastweb"},
        {"value": "telefonia_fastweb", "label": "Telefonia Fastweb"}
    ]
    
    # Tipologie aggiuntive per servizi specifici
    tipologie_aggiuntive = [
        {"value": "ho_mobile", "label": "Ho Mobile"},
        {"value": "telepass", "label": "Telepass"}
    ]
    
    # Se non specificato, restituisci tutte
    if not servizio_id:
        return tipologie_base + tipologie_aggiuntive
    
    # Logica basata sul servizio
    try:
        servizio = await db.servizi.find_one({"id": servizio_id})
        if not servizio:
            return tipologie_base
        
        servizio_nome = servizio.get("nome", "").lower()
        
        # Per servizi Negozi, Presidi e Agent: aggiunge Ho Mobile e Telepass
        if any(nome in servizio_nome for nome in ["negozi", "presidi", "agent"]):
            return tipologie_base + tipologie_aggiuntive
        else:
            # Per tutti gli altri servizi: solo Energia e Telefonia Fastweb
            return tipologie_base
            
    except Exception as e:
        logging.error(f"Error getting tipologie contratto: {e}")
        return tipologie_base

@api_router.get("/segmenti")  
async def get_segmenti(current_user: User = Depends(get_current_user)):
    """Get available segmenti"""
    return [
        {"value": "residenziale", "label": "Residenziale"},
        {"value": "business", "label": "Business"}
    ]

# Gestione Sub Agenzie
@api_router.post("/sub-agenzie", response_model=SubAgenzia)
async def create_sub_agenzia(sub_agenzia_data: SubAgenziaCreate, current_user: User = Depends(get_current_user)):
    """Create new sub agenzia"""
    # Solo admin e responsabile commessa possono creare sub agenzie
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Verifica che l'utente abbia accesso alle commesse specificate
    for commessa_id in sub_agenzia_data.commesse_autorizzate:
        if not await check_commessa_access(current_user, commessa_id):
            raise HTTPException(status_code=403, detail=f"No access to commessa {commessa_id}")
    
    sub_agenzia = SubAgenzia(
        **sub_agenzia_data.dict(),
        created_by=current_user.id
    )
    await db.sub_agenzie.insert_one(sub_agenzia.dict())
    
    return sub_agenzia

@api_router.get("/sub-agenzie", response_model=List[SubAgenzia])
async def get_sub_agenzie(
    commessa_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get sub agenzie accessible to current user"""
    query = {"is_active": True}
    
    if current_user.role == UserRole.ADMIN:
        # Admin vede tutte
        if commessa_id:
            query["commesse_autorizzate"] = {"$in": [commessa_id]}
    else:
        # Altri vedono solo quelle delle loro commesse
        accessible_commesse = await get_user_accessible_commesse(current_user)
        query["commesse_autorizzate"] = {"$in": accessible_commesse}
        
        if commessa_id:
            if commessa_id not in accessible_commesse:
                raise HTTPException(status_code=403, detail="Access denied to this commessa")
            query["commesse_autorizzate"] = {"$in": [commessa_id]}
    
    sub_agenzie = await db.sub_agenzie.find(query).to_list(length=None)
    return [SubAgenzia(**sa) for sa in sub_agenzie]

@api_router.put("/sub-agenzie/{sub_agenzia_id}", response_model=SubAgenzia)
async def update_sub_agenzia(
    sub_agenzia_id: str,
    sub_agenzia_update: SubAgenziaUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update sub agenzia"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get current sub agenzia
    current_sub_agenzia = await db.sub_agenzie.find_one({"id": sub_agenzia_id})
    if not current_sub_agenzia:
        raise HTTPException(status_code=404, detail="Sub Agenzia not found")
    
    # Verifica autorizzazioni per le nuove commesse
    if sub_agenzia_update.commesse_autorizzate:
        for commessa_id in sub_agenzia_update.commesse_autorizzate:
            if not await check_commessa_access(current_user, commessa_id):
                raise HTTPException(status_code=403, detail=f"No access to commessa {commessa_id}")
    
    update_data = {k: v for k, v in sub_agenzia_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.sub_agenzie.update_one(
        {"id": sub_agenzia_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sub Agenzia not found")
    
    sub_agenzia_doc = await db.sub_agenzie.find_one({"id": sub_agenzia_id})
    return SubAgenzia(**sub_agenzia_doc)

# Gestione Clienti
@api_router.post("/clienti", response_model=Cliente)
async def create_cliente(cliente_data: ClienteCreate, current_user: User = Depends(get_current_user)):
    """Create new cliente"""
    # Verifica accesso alla commessa
    if not await check_commessa_access(current_user, cliente_data.commessa_id, ["can_create_clients"]):
        raise HTTPException(status_code=403, detail="No permission to create clients in this commessa")
    
    # Verifica che la sub agenzia sia autorizzata per la commessa
    sub_agenzia = await db.sub_agenzie.find_one({"id": cliente_data.sub_agenzia_id})
    if not sub_agenzia or cliente_data.commessa_id not in sub_agenzia.get("commesse_autorizzate", []):
        raise HTTPException(status_code=400, detail="Sub agenzia not authorized for this commessa")
    
    cliente = Cliente(
        **cliente_data.dict(),
        created_by=current_user.id
    )
    await db.clienti.insert_one(cliente.dict())
    
    return cliente

@api_router.get("/clienti", response_model=List[Cliente])
async def get_clienti(
    commessa_id: Optional[str] = None,
    sub_agenzia_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get clienti accessible to current user"""
    query = {}
    
    # Filtra per commesse accessibili
    accessible_commesse = await get_user_accessible_commesse(current_user)
    
    # Handle special case "all" from frontend
    if commessa_id and commessa_id != "all":
        if commessa_id not in accessible_commesse:
            raise HTTPException(status_code=403, detail="Access denied to this commessa")
        query["commessa_id"] = commessa_id
    else:
        # If commessa_id is None or "all", filter by all accessible commesse
        if accessible_commesse:
            query["commessa_id"] = {"$in": accessible_commesse}
        else:
            # If user has no accessible commesse, return empty
            return []
    
    # Filtra per sub agenzie accessibili solo se abbiamo una commessa specifica
    if commessa_id and commessa_id != "all":
        accessible_sub_agenzie = await get_user_accessible_sub_agenzie(current_user, commessa_id)
        if sub_agenzia_id:
            if sub_agenzia_id not in accessible_sub_agenzie:
                raise HTTPException(status_code=403, detail="Access denied to this sub agenzia")
            query["sub_agenzia_id"] = sub_agenzia_id
        else:
            query["sub_agenzia_id"] = {"$in": accessible_sub_agenzie}
    
    if status:
        query["status"] = status
    
    clienti = await db.clienti.find(query).sort("created_at", -1).limit(limit).to_list(length=None)
    return [Cliente(**c) for c in clienti]

@api_router.get("/clienti/{cliente_id}", response_model=Cliente)
async def get_cliente(cliente_id: str, current_user: User = Depends(get_current_user)):
    """Get specific cliente"""
    cliente_doc = await db.clienti.find_one({"id": cliente_id})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    cliente = Cliente(**cliente_doc)
    
    # Verifica accesso
    if not await check_commessa_access(current_user, cliente.commessa_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    accessible_sub_agenzie = await get_user_accessible_sub_agenzie(current_user, cliente.commessa_id)
    if cliente.sub_agenzia_id not in accessible_sub_agenzie:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return cliente

@api_router.put("/clienti/{cliente_id}", response_model=Cliente)
async def update_cliente(
    cliente_id: str,
    cliente_update: ClienteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update cliente"""
    cliente_doc = await db.clienti.find_one({"id": cliente_id})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    cliente = Cliente(**cliente_doc)
    
    # Verifica permessi di modifica
    if not await can_user_modify_cliente(current_user, cliente):
        raise HTTPException(status_code=403, detail="No permission to modify this cliente")
    
    update_data = {k: v for k, v in cliente_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.clienti.update_one(
        {"id": cliente_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    cliente_doc = await db.clienti.find_one({"id": cliente_id})
    return Cliente(**cliente_doc)

# Gestione Autorizzazioni Utenti
@api_router.post("/user-commessa-authorizations", response_model=UserCommessaAuthorization)
async def create_user_authorization(
    auth_data: UserCommessaAuthorizationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create user authorization for commessa"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Responsabile commessa può autorizzare solo per le sue commesse
    if current_user.role == UserRole.RESPONSABILE_COMMESSA:
        if not await check_commessa_access(current_user, auth_data.commessa_id):
            raise HTTPException(status_code=403, detail="Access denied to this commessa")
    
    # Verifica che l'utente esista
    user = await db.users.find_one({"id": auth_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Controlla se autorizzazione già esiste
    existing_auth = await db.user_commessa_authorizations.find_one({
        "user_id": auth_data.user_id,
        "commessa_id": auth_data.commessa_id,
        "sub_agenzia_id": auth_data.sub_agenzia_id
    })
    
    if existing_auth:
        raise HTTPException(status_code=400, detail="Authorization already exists")
    
    authorization = UserCommessaAuthorization(**auth_data.dict())
    await db.user_commessa_authorizations.insert_one(authorization.dict())
    
    return authorization

@api_router.get("/user-commessa-authorizations")
async def get_user_authorizations(
    user_id: Optional[str] = None,
    commessa_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get user authorizations"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = {"is_active": True}
    
    if user_id:
        query["user_id"] = user_id
    
    if commessa_id:
        # Responsabile commessa può vedere solo le sue commesse
        if current_user.role == UserRole.RESPONSABILE_COMMESSA:
            if not await check_commessa_access(current_user, commessa_id):
                raise HTTPException(status_code=403, detail="Access denied")
        query["commessa_id"] = commessa_id
    
    authorizations = await db.user_commessa_authorizations.find(query).to_list(length=None)
    return [UserCommessaAuthorization(**auth) for auth in authorizations]

# Analytics per Responsabile Commessa
@api_router.get("/commesse/{commessa_id}/analytics")
async def get_commessa_analytics(commessa_id: str, current_user: User = Depends(get_current_user)):
    """Get analytics for commessa"""
    if not await check_commessa_access(current_user, commessa_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Analytics per sub agenzia
    pipeline = [
        {"$match": {"commessa_id": commessa_id}},
        {"$group": {
            "_id": "$sub_agenzia_id",
            "total_clienti": {"$sum": 1},
            "clienti_completati": {"$sum": {"$cond": [{"$eq": ["$status", "completato"]}, 1, 0]}},
            "clienti_in_lavorazione": {"$sum": {"$cond": [{"$eq": ["$status", "in_lavorazione"]}, 1, 0]}},
            "ultimo_cliente": {"$max": "$created_at"}
        }}
    ]
    
    results = await db.clienti.aggregate(pipeline).to_list(length=None)
    
    # Get sub agenzia details
    sub_agenzie_stats = []
    for result in results:
        sub_agenzia = await db.sub_agenzie.find_one({"id": result["_id"]})
        if sub_agenzia:
            sub_agenzie_stats.append({
                "sub_agenzia_id": result["_id"],
                "sub_agenzia_nome": sub_agenzia["nome"],
                "total_clienti": result["total_clienti"],
                "clienti_completati": result["clienti_completati"],
                "clienti_in_lavorazione": result["clienti_in_lavorazione"],
                "ultimo_cliente": result["ultimo_cliente"]
            })
    
    # Analytics generali commessa
    total_clienti = await db.clienti.count_documents({"commessa_id": commessa_id})
    clienti_completati = await db.clienti.count_documents({
        "commessa_id": commessa_id,
        "status": "completato"
    })
    
    return {
        "commessa_id": commessa_id,
        "total_clienti": total_clienti,
        "clienti_completati": clienti_completati,
        "tasso_completamento": (clienti_completati / total_clienti * 100) if total_clienti > 0 else 0,
        "sub_agenzie_stats": sub_agenzie_stats
    }

# Importazione Clienti Endpoints
@api_router.post("/clienti/import/preview")
async def preview_clienti_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Preview clienti import file"""
    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.OPERATORE, UserRole.BACKOFFICE_COMMESSA, UserRole.BACKOFFICE_AGENZIA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for import")
    
    # Validate file type
    allowed_extensions = ['csv', 'xls', 'xlsx']
    file_extension = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Supported: {allowed_extensions}")
    
    # Read file content
    try:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File too large. Maximum size: 10MB")
        
        preview = await parse_uploaded_file(content, file.filename)
        return preview
        
    except Exception as e:
        logging.error(f"Preview import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.post("/clienti/import/execute", response_model=ImportResult)
async def execute_clienti_import(
    file: UploadFile = File(...),
    config: str = Form(...),  # JSON string of ImportConfiguration
    current_user: User = Depends(get_current_user)
):
    """Execute clienti import"""
    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.OPERATORE, UserRole.BACKOFFICE_COMMESSA, UserRole.BACKOFFICE_AGENZIA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for import")
    
    try:
        # Parse configuration
        import json
        config_dict = json.loads(config)
        import_config = ImportConfiguration(**config_dict)
        
        # Verify access to commessa
        if not await check_commessa_access(current_user, import_config.commessa_id):
            raise HTTPException(status_code=403, detail="Access denied to this commessa")
        
        # Verify sub agenzia exists and is authorized for commessa
        sub_agenzia = await db.sub_agenzie.find_one({"id": import_config.sub_agenzia_id})
        if not sub_agenzia:
            raise HTTPException(status_code=404, detail="Sub agenzia not found")
        
        if import_config.commessa_id not in sub_agenzia.get("commesse_autorizzate", []):
            raise HTTPException(status_code=400, detail="Sub agenzia not authorized for this commessa")
        
        # Read file content
        content = await file.read()
        
        # Process import
        result = await process_import_batch(
            content,
            file.filename,
            import_config,
            current_user.id
        )
        
        return result
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid configuration format")
    except Exception as e:
        logging.error(f"Execute import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@api_router.get("/clienti/import/template/{file_type}")
async def download_import_template(
    file_type: str,
    current_user: User = Depends(get_current_user)
):
    """Download import template file"""
    if file_type not in ['csv', 'xlsx']:
        raise HTTPException(status_code=400, detail="Invalid file type. Use 'csv' or 'xlsx'")
    
    # Define template columns
    template_data = {
        'nome': ['Mario', 'Luigi', 'Anna'],
        'cognome': ['Rossi', 'Verdi', 'Bianchi'],
        'email': ['mario.rossi@email.com', 'luigi.verdi@email.com', 'anna.bianchi@email.com'],
        'telefono': ['+393471234567', '+393487654321', '+393451122334'],
        'indirizzo': ['Via Roma 1', 'Via Milano 23', 'Via Napoli 45'],
        'citta': ['Roma', 'Milano', 'Napoli'],
        'provincia': ['RM', 'MI', 'NA'],
        'cap': ['00100', '20100', '80100'],
        'codice_fiscale': ['RSSMRA80A01H501Z', 'VRDLGU75B15F205X', 'BNCNNA90C45F839Y'],
        'partita_iva': ['12345678901', '98765432109', '11223344556'],
        'note': ['Cliente VIP', 'Contatto commerciale', 'Referenziato']
    }
    
    df = pd.DataFrame(template_data)
    
    if file_type == 'csv':
        # Create CSV
        output = io.BytesIO()
        df.to_csv(output, index=False, encoding='utf-8')
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type="application/csv",
            headers={"Content-Disposition": "attachment; filename=template_clienti.csv"}
        )
    
    elif file_type == 'xlsx':
        # Create Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Clienti', index=False)
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=template_clienti.xlsx"}
        )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# RESPONSABILE COMMESSA ENDPOINTS
# ============================================

@api_router.get("/responsabile-commessa/dashboard")
async def get_responsabile_commessa_dashboard(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    tipologia_contratto: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Dashboard specifica per Responsabile Commessa"""
    if current_user.role != UserRole.RESPONSABILE_COMMESSA:
        raise HTTPException(status_code=403, detail="Access denied: Responsabile Commessa only")
    
    # Get accessible commesse
    accessible_commesse = await get_user_accessible_commesse(current_user)
    if not accessible_commesse:
        return {
            "clienti_oggi": 0,
            "clienti_totali": 0,
            "sub_agenzie": [],
            "punti_lavorazione": {},
            "commesse": []
        }
    
    # Parse date filters
    date_filter = {}
    if date_from:
        try:
            date_filter["$gte"] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
        except:
            pass
    if date_to:
        try:
            date_filter["$lte"] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        except:
            pass
    
    # Query clienti delle commesse autorizzate
    clienti_query = {"commessa_id": {"$in": accessible_commesse}, "is_active": True}
    
    # Filtro per tipologia contratto
    if tipologia_contratto and tipologia_contratto != "all":
        clienti_query["tipologia_contratto"] = tipologia_contratto
    
    # Clienti totali
    clienti_totali = await db.clienti.count_documents(clienti_query)
    
    # Clienti oggi o nel range di date
    clienti_oggi_query = clienti_query.copy()
    if date_filter:
        clienti_oggi_query["created_at"] = date_filter
    else:
        # Default: oggi
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start.replace(hour=23, minute=59, second=59, microsecond=999999)
        clienti_oggi_query["created_at"] = {"$gte": today_start, "$lte": today_end}
    
    clienti_oggi = await db.clienti.count_documents(clienti_oggi_query)
    
    # Get sub agenzie per le commesse autorizzate
    sub_agenzie = await db.sub_agenzie.find({
        "commesse_autorizzate": {"$in": accessible_commesse},
        "is_active": True
    }).to_list(length=None)
    
    # Count clienti per stato (punti di lavorazione)
    pipeline = [
        {"$match": clienti_query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    punti_lavorazione_result = await db.clienti.aggregate(pipeline).to_list(length=None)
    punti_lavorazione = {item["_id"]: item["count"] for item in punti_lavorazione_result}
    
    # Get commesse info
    commesse = await db.commesse.find({
        "id": {"$in": accessible_commesse},
        "is_active": True
    }).to_list(length=None)
    
    return {
        "clienti_oggi": clienti_oggi,
        "clienti_totali": clienti_totali,
        "sub_agenzie": [{
            "id": sa["id"],
            "nome": sa["nome"],
            "responsabile": sa.get("responsabile", ""),
            "stato": sa.get("stato", "attiva"),
            "commesse_count": len([c for c in sa.get("commesse_autorizzate", []) if c in accessible_commesse])
        } for sa in sub_agenzie],
        "punti_lavorazione": punti_lavorazione,
        "commesse": [{
            "id": c["id"],
            "nome": c["nome"],
            "descrizione": c.get("descrizione", "")
        } for c in commesse]
    }

@api_router.get("/responsabile-commessa/clienti")
async def get_responsabile_commessa_clienti(
    commessa_id: Optional[str] = None,
    sub_agenzia_id: Optional[str] = None,
    status: Optional[str] = None,
    tipologia_contratto: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Lista clienti per Responsabile Commessa (solo commesse autorizzate)"""
    if current_user.role != UserRole.RESPONSABILE_COMMESSA:
        raise HTTPException(status_code=403, detail="Access denied: Responsabile Commessa only")
    
    # Get accessible commesse
    accessible_commesse = await get_user_accessible_commesse(current_user)
    if not accessible_commesse:
        return {"clienti": [], "total": 0}
    
    # Build query
    query = {
        "commessa_id": {"$in": accessible_commesse},
        "is_active": True
    }
    
    if commessa_id and commessa_id in accessible_commesse:
        query["commessa_id"] = commessa_id
    
    if sub_agenzia_id:
        query["sub_agenzia_id"] = sub_agenzia_id
        
    if status:
        query["status"] = status
        
    if tipologia_contratto and tipologia_contratto != "all":
        query["tipologia_contratto"] = tipologia_contratto
        
    if search:
        query["$or"] = [
            {"nome": {"$regex": search, "$options": "i"}},
            {"cognome": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"telefono": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db.clienti.count_documents(query)
    
    # Get clienti
    clienti = await db.clienti.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=None)
    
    return {
        "clienti": [{
            "id": c["id"],
            "cliente_id": c.get("cliente_id", c["id"][:8]),
            "nome": c["nome"],
            "cognome": c["cognome"],
            "email": c["email"],
            "telefono": c["telefono"],
            "commessa_id": c["commessa_id"],
            "sub_agenzia_id": c.get("sub_agenzia_id"),
            "status": c.get("status", "nuovo"),
            "created_at": c["created_at"].isoformat()
        } for c in clienti],
        "total": total
    }

@api_router.get("/responsabile-commessa/analytics")
async def get_responsabile_commessa_analytics(
    commessa_id: Optional[str] = None,
    tipologia_contratto: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Analytics per Responsabile Commessa"""
    if current_user.role != UserRole.RESPONSABILE_COMMESSA:
        raise HTTPException(status_code=403, detail="Access denied: Responsabile Commessa only")
    
    # Get accessible commesse
    accessible_commesse = await get_user_accessible_commesse(current_user)
    if not accessible_commesse:
        return {"sub_agenzie_analytics": [], "conversioni": {}}
    
    # Build query
    query = {"commessa_id": {"$in": accessible_commesse}, "is_active": True}
    if commessa_id and commessa_id in accessible_commesse:
        query["commessa_id"] = commessa_id
    
    if tipologia_contratto and tipologia_contratto != "all":
        query["tipologia_contratto"] = tipologia_contratto
    
    # Date filter
    if date_from or date_to:
        date_filter = {}
        if date_from:
            try:
                date_filter["$gte"] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            except:
                pass
        if date_to:
            try:
                date_filter["$lte"] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            except:
                pass
        if date_filter:
            query["created_at"] = date_filter
    
    # Analytics per sub agenzia
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$sub_agenzia_id",
            "totale_clienti": {"$sum": 1},
            "completati": {
                "$sum": {"$cond": [{"$eq": ["$status", "completato"]}, 1, 0]}
            },
            "in_lavorazione": {
                "$sum": {"$cond": [{"$eq": ["$status", "in_lavorazione"]}, 1, 0]}
            }
        }}
    ]
    
    analytics_result = await db.clienti.aggregate(pipeline).to_list(length=None)
    
    # Get sub agenzie info
    sub_agenzie_ids = [item["_id"] for item in analytics_result if item["_id"]]
    sub_agenzie_info = {}
    if sub_agenzie_ids:
        sub_agenzie = await db.sub_agenzie.find({"id": {"$in": sub_agenzie_ids}}).to_list(length=None)
        sub_agenzie_info = {sa["id"]: sa["nome"] for sa in sub_agenzie}
    
    # Format analytics
    sub_agenzie_analytics = []
    total_completati = 0
    total_clienti = 0
    
    for item in analytics_result:
        sa_id = item["_id"]
        nome_sa = sub_agenzie_info.get(sa_id, "Sub Agenzia Sconosciuta") if sa_id else "Nessuna Sub Agenzia"
        completati = item["completati"]
        totale = item["totale_clienti"]
        
        total_completati += completati
        total_clienti += totale
        
        conversion_rate = (completati / totale * 100) if totale > 0 else 0
        
        sub_agenzie_analytics.append({
            "sub_agenzia_id": sa_id,
            "nome": nome_sa,
            "totale_clienti": totale,
            "completati": completati,
            "in_lavorazione": item["in_lavorazione"],
            "conversion_rate": round(conversion_rate, 2)
        })
    
    # Overall conversions
    overall_conversion_rate = (total_completati / total_clienti * 100) if total_clienti > 0 else 0
    
    return {
        "sub_agenzie_analytics": sub_agenzie_analytics,
        "conversioni": {
            "totale_clienti": total_clienti,
            "totale_completati": total_completati,
            "conversion_rate_generale": round(overall_conversion_rate, 2)
        }
    }

@api_router.get("/responsabile-commessa/analytics/export")
async def export_responsabile_commessa_analytics(
    commessa_id: Optional[str] = None,
    tipologia_contratto: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Export Excel analytics per Responsabile Commessa"""
    if current_user.role != UserRole.RESPONSABILE_COMMESSA:
        raise HTTPException(status_code=403, detail="Access denied: Responsabile Commessa only")
    
    # Get analytics data
    analytics_data = await get_responsabile_commessa_analytics(
        commessa_id=commessa_id,
        tipologia_contratto=tipologia_contratto,
        date_from=date_from, 
        date_to=date_to,
        current_user=current_user
    )
    
    if not analytics_data["sub_agenzie_analytics"]:
        raise HTTPException(status_code=404, detail="No data available for export")
    
    # Create Excel data
    excel_data = []
    for item in analytics_data["sub_agenzie_analytics"]:
        excel_data.append({
            "Sub Agenzia": item["nome"],
            "Totale Clienti": item["totale_clienti"],
            "Clienti Completati": item["completati"],
            "Clienti In Lavorazione": item["in_lavorazione"],
            "Tasso Conversione (%)": item["conversion_rate"]
        })
    
    # Create Excel content (simplified - in production use openpyxl)
    import io
    import csv
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["Sub Agenzia", "Totale Clienti", "Clienti Completati", "Clienti In Lavorazione", "Tasso Conversione (%)"])
    writer.writeheader()
    writer.writerows(excel_data)
    
    csv_content = output.getvalue()
    output.close()
    
    # Return as downloadable file
    from fastapi.responses import Response
    
    filename = f"analytics_responsabile_commessa_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Add Emergent LLM key to env
@app.on_event("startup")
async def startup_event():
    # Create default admin user if not exists
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        admin_data = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@example.com",
            "password_hash": get_password_hash("admin123"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(admin_data)
        logger.info("Default admin user created: admin/admin123")
    
    # Create default commesse if not exist
    fastweb_commessa = await db.commesse.find_one({"nome": "Fastweb"})
    if not fastweb_commessa:
        commesse_data = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Fastweb",
                "descrizione": "Commessa per servizi Fastweb",
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Fotovoltaico",
                "descrizione": "Commessa per servizi Fotovoltaico",
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        await db.commesse.insert_many(commesse_data)
        logger.info("Default commesse created: Fastweb, Fotovoltaico")
        
        # Create default servizi for Fastweb
        fastweb_id = commesse_data[0]["id"]
        servizi_fastweb = [
            {
                "id": str(uuid.uuid4()),
                "commessa_id": fastweb_id,
                "nome": "TLS",
                "descrizione": "Servizio TLS",
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "commessa_id": fastweb_id,
                "nome": "Agent",
                "descrizione": "Servizio Agent",
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "commessa_id": fastweb_id,
                "nome": "Negozi",
                "descrizione": "Servizio Negozi",
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "commessa_id": fastweb_id,
                "nome": "Presidi",
                "descrizione": "Servizio Presidi",
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        await db.servizi.insert_many(servizi_fastweb)
        logger.info("Default servizi created for Fastweb")

# Include the router in the main app (MUST be after all endpoints are defined)
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()