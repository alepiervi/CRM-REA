"""Service classes e configurazioni esterne (estratti da server.py - refactoring fase 3).

Contiene: ArubadriveService, ChatBotService, TwilioService, CallCenterService,
ACDService, WhatsAppService, LeadQualificationBot + relative istanze singleton,
helper per file upload e costanti env (Aruba, Twilio, upload, LLM).
"""
import asyncio
import base64
import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import aiofiles
import aiohttp
import httpx
from fastapi import HTTPException
from emergentintegrations.llm.chat import LlmChat, UserMessage
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Dial, Say, Record, Connect, Stream
from twilio.request_validator import RequestValidator

from helpers import provincia_matches

from database import db
from models import *  # noqa: F401,F403

# Aruba Drive Configuration
ARUBA_DRIVE_API_KEY = os.environ.get("ARUBA_DRIVE_API_KEY", "")
ARUBA_DRIVE_CLIENT_ID = os.environ.get("ARUBA_DRIVE_CLIENT_ID", "")
ARUBA_DRIVE_CLIENT_SECRET = os.environ.get("ARUBA_DRIVE_CLIENT_SECRET", "")
ARUBA_DRIVE_BASE_URL = os.environ.get("ARUBA_DRIVE_BASE_URL", "https://api.arubacloud.com")

# File Upload Configuration
UPLOAD_DIR = "./uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_FILE_TYPES = [
    "application/pdf",
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    # Audio formats
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", 
    "audio/aac", "audio/x-m4a", "audio/flac", "audio/x-flac",
    "audio/webm", "audio/x-wav", "audio/vnd.wave"
]

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
    
    # NOTE: create_folder method moved to line 10056 with proper Playwright implementation
    
    async def navigate_to_folder(self, folder_path):
        """Navigate to specific folder in Aruba Drive with enhanced reliability"""
        try:
            folders = folder_path.split('/')
            current_path = []
            
            for i, folder in enumerate(folders):
                if not folder:  # Skip empty strings
                    continue
                    
                current_path.append(folder)
                logging.info(f"🗂️ Navigating to folder: {folder} (step {i+1}/{len([f for f in folders if f])})")
                
                # Human-like interaction: wait and scroll to top
                await self.page.wait_for_timeout(500)
                await self.page.evaluate("() => window.scrollTo(0, 0)")
                
                # Look for folder link with multiple strategies
                folder_selectors = [
                    f'a:has-text("{folder}")', f'[title="{folder}"]',
                    f'.folder:has-text("{folder}")', f'.directory:has-text("{folder}")',
                    f'[data-name="{folder}"]', f'.file-item:has-text("{folder}")',
                    f'.folder-icon + *:has-text("{folder}")'
                ]
                
                folder_found = False
                for selector in folder_selectors:
                    try:
                        element = await self.page.wait_for_selector(selector, timeout=5000)
                        if element:
                            # Ensure element is visible
                            await element.scroll_into_view_if_needed()
                            await self.page.wait_for_timeout(300)
                            
                            # Double-click for folder navigation (more reliable)
                            await element.dblclick()
                            
                            # Wait for navigation to complete
                            await self.page.wait_for_timeout(2000)
                            await self.page.wait_for_load_state('networkidle', timeout=10000)
                            
                            logging.info(f"✅ Successfully navigated to: {'/'.join(current_path)}")
                            folder_found = True
                            break
                    except Exception as e:
                        logging.debug(f"Folder selector {selector} failed: {e}")
                        continue
                
                if not folder_found:
                    logging.error(f"❌ Could not find folder: {folder} in path {'/'.join(current_path[:-1])}")
                    
                    # Try to create the folder if it doesn't exist
                    logging.info(f"🛠️ Attempting to create missing folder: {folder}")
                    created = await self.create_folder(folder)
                    if created:
                        logging.info(f"✅ Created and navigated to new folder: {folder}")
                        folder_found = True
                    else:
                        return False
                
                if not folder_found:
                    return False
            
            logging.info(f"🎯 Successfully navigated to complete path: {folder_path}")
            return True
            
        except Exception as e:
            logging.error(f"❌ Navigation failed for path {folder_path}: {e}")
            return False

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
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt',
                          '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.flac', '.webm']
    
    # Check file extension
    if file.filename:
        file_ext = os.path.splitext(file.filename.lower())[1]
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo di file non supportato. Estensioni permesse: {', '.join(ALLOWED_EXTENSIONS)}"
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
    
    # Get file extension from original filename
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
    
    document_data = {
        "document_type": document_type,
        "filename": f"{uuid.uuid4()}{file_extension}",
        "original_filename": file.filename or f"document{file_extension}",
        "file_size": file_size,
        "content_type": getattr(file, 'content_type', "application/octet-stream"),
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
            timeout_at_utc = qualification["timeout_at"]
            # Ensure timeout_at is timezone-aware
            if timeout_at_utc.tzinfo is None:
                timeout_at_utc = timeout_at_utc.replace(tzinfo=timezone.utc)
                
            if datetime.now(timezone.utc) > timeout_at_utc:
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
            
            # MODIFICATO: NON assegnare automaticamente dopo qualificazione
            # Il lead rimane non assegnato fino a quando lo status non viene cambiato a "Lead Interessato"
            if result == "qualified" and score >= 70:
                logging.info(f"Lead {lead_id} qualified with score {score} - will be assigned when status changes to 'Lead Interessato'")
                # Aggiorna solo lo status a "Bot Qualificato" senza assegnare
                await db.leads.update_one(
                    {"id": lead_id},
                    {"$set": {"esito": "Bot Qualificato", "qualification_score": score}}
                )
                
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
                # Lead responded but didn't complete - NON assegnare, rimane in attesa
                await self.complete_qualification(lead_id, "timeout", 50)
                logging.info(f"Lead {lead_id} timeout with responses - will be assigned when status changes to 'Lead Interessato'")
                # Aggiorna solo lo status senza assegnare
                await db.leads.update_one(
                    {"id": lead_id},
                    {"$set": {"esito": "Timeout Bot"}}
                )
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
            
            # Filter agents by province if specified (using normalization for flexible matching)
            suitable_agents = []
            for agent in agents:
                if provincia_matches(agent.get("provinces", []), provincia):
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

# Costante: numero massimo di lead non gestiti per agente


# Client WebDAV Nextcloud / Aruba Drive (spostato da server.py - fase 3)
class NextcloudClient:
    """
    Nextcloud WebDAV client for document management.
    Fast, lightweight, no browser automation needed.
    """
    
    def __init__(self, base_url: str, username: str, password: str, folder_path: str):
        """
        Initialize Nextcloud client
        
        Args:
            base_url: Nextcloud base URL (e.g., https://vkbu5u.arubadrive.com)
            username: Nextcloud username
            password: Nextcloud password
            folder_path: Folder name in Nextcloud (e.g., "Fastweb")
        """
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.folder_path = folder_path.strip('/')
        
        # WebDAV endpoint (Aruba Drive uses /webdav/ not /dav/files/)
        self.webdav_base = f"{self.base_url}/remote.php/webdav"
        
        # Auth
        self.auth = aiohttp.BasicAuth(self.username, self.password)
        
        # Headers for Aruba Drive/Nextcloud compatibility
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Nextcloud)',
            'OCS-APIRequest': 'true'
        }
        
        logging.info(f"🌐 Nextcloud client initialized: {self.base_url}")
        logging.info(f"📁 Target folder: /{self.folder_path}/")
    
    async def ensure_folder_exists(self, session: aiohttp.ClientSession):
        """Create folder if doesn't exist"""
        folder_url = f"{self.webdav_base}/{self.folder_path}"
        
        try:
            # Check if exists (PROPFIND)
            async with session.request('PROPFIND', folder_url, auth=self.auth, headers=self.headers) as resp:
                if resp.status == 207:  # Multi-Status = exists
                    logging.info(f"✅ Folder exists: /{self.folder_path}/")
                    return True
                elif resp.status == 404:
                    # Create folder (MKCOL)
                    async with session.request('MKCOL', folder_url, auth=self.auth, headers=self.headers) as create_resp:
                        if create_resp.status in [201, 405]:  # 201 Created or 405 Already exists
                            logging.info(f"✅ Folder created: /{self.folder_path}/")
                            return True
                        else:
                            logging.error(f"❌ Failed to create folder: {create_resp.status}")
                            return False
        except Exception as e:
            logging.error(f"❌ Error ensuring folder exists: {e}")
            return False
        
        return True
    
    def build_filename(self, cliente: dict, original_filename: str) -> str:
        """
        Build structured filename with client info
        
        Format: {NumeroOrdine}_{Telefono}_{Nome}_{Cognome}_{OriginalFile}
        If numero_ordine empty: {Telefono}_{Nome}_{Cognome}_{OriginalFile}
        """
        numero_ordine = cliente.get('numero_ordine', '').strip()
        telefono = cliente.get('telefono_mobile', '').strip() or cliente.get('telefono_fisso', '').strip()
        nome = cliente.get('nome', '').strip()
        cognome = cliente.get('cognome', '').strip()
        
        # Sanitize for filename
        def sanitize(s):
            return s.replace('/', '_').replace('\\', '_').replace(' ', '_')
        
        parts = []
        
        if numero_ordine:
            parts.append(sanitize(numero_ordine))
        
        if telefono:
            parts.append(sanitize(telefono))
        
        if nome:
            parts.append(sanitize(nome))
        
        if cognome:
            parts.append(sanitize(cognome))
        
        parts.append(original_filename)
        
        filename = '_'.join(parts)
        
        logging.info(f"📝 Built filename: {filename}")
        return filename
    
    async def upload_file(self, file_content: bytes, filename: str) -> tuple[bool, str]:
        """
        Upload file to Nextcloud via WebDAV
        
        Returns:
            (success: bool, path: str)
        """
        try:
            async with aiohttp.ClientSession() as session:
                # Ensure folder exists
                await self.ensure_folder_exists(session)
                
                # Upload file (PUT)
                file_url = f"{self.webdav_base}/{self.folder_path}/{filename}"
                
                logging.info(f"📤 Uploading to: {file_url}")
                
                # Merge headers
                upload_headers = {**self.headers, 'Content-Type': 'application/octet-stream'}
                
                async with session.put(
                    file_url,
                    data=file_content,
                    auth=self.auth,
                    headers=upload_headers
                ) as resp:
                    if resp.status in [201, 204]:  # Created or No Content
                        path = f"/{self.folder_path}/{filename}"
                        logging.info(f"✅ Upload successful: {path}")
                        return True, path
                    else:
                        error = await resp.text()
                        logging.error(f"❌ Upload failed ({resp.status}): {error}")
                        return False, ""
                        
        except Exception as e:
            logging.error(f"❌ Upload exception: {e}")
            return False, ""
    
    async def download_file(self, filename: str) -> tuple[bool, bytes]:
        """
        Download file from Nextcloud
        
        Returns:
            (success: bool, content: bytes)
        """
        try:
            async with aiohttp.ClientSession() as session:
                file_url = f"{self.webdav_base}/{self.folder_path}/{filename}"
                
                logging.info(f"📥 Downloading from: {file_url}")
                
                async with session.get(file_url, auth=self.auth, headers=self.headers) as resp:
                    if resp.status == 200:
                        content = await resp.read()
                        logging.info(f"✅ Download successful: {len(content)} bytes")
                        return True, content
                    else:
                        logging.error(f"❌ Download failed: {resp.status}")
                        return False, b""
                        
        except Exception as e:
            logging.error(f"❌ Download exception: {e}")
            return False, b""
    
    async def list_files(self) -> list[dict]:
        """
        List files in folder
        
        Returns:
            List of file info dicts
        """
        try:
            async with aiohttp.ClientSession() as session:
                folder_url = f"{self.webdav_base}/{self.folder_path}"
                
                # PROPFIND to list files
                propfind_body = '''<?xml version="1.0"?>
                <d:propfind xmlns:d="DAV:">
                    <d:prop>
                        <d:displayname/>
                        <d:getcontentlength/>
                        <d:getlastmodified/>
                        <d:getcontenttype/>
                    </d:prop>
                </d:propfind>'''
                
                propfind_headers = {**self.headers, 'Depth': '1', 'Content-Type': 'application/xml'}
                
                async with session.request(
                    'PROPFIND',
                    folder_url,
                    auth=self.auth,
                    data=propfind_body,
                    headers=propfind_headers
                ) as resp:
                    if resp.status == 207:
                        xml_text = await resp.text()
                        # Parse XML response (simplified)
                        files = []
                        # TODO: Parse XML properly if needed
                        logging.info(f"✅ Listed files in /{self.folder_path}/")
                        return files
                    else:
                        logging.error(f"❌ List failed: {resp.status}")
                        return []
                        
        except Exception as e:
            logging.error(f"❌ List exception: {e}")
            return []
    
    async def delete_file(self, filename: str) -> bool:
        """Delete file from Nextcloud"""
        try:
            async with aiohttp.ClientSession() as session:
                file_url = f"{self.webdav_base}/{self.folder_path}/{filename}"
                
                async with session.delete(file_url, auth=self.auth, headers=self.headers) as resp:
                    if resp.status in [204, 404]:  # No Content or Not Found
                        logging.info(f"✅ File deleted: {filename}")
                        return True
                    else:
                        logging.error(f"❌ Delete failed: {resp.status}")
                        return False
                        
        except Exception as e:
            logging.error(f"❌ Delete exception: {e}")
            return False


