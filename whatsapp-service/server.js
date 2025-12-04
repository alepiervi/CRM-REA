const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001';
const PORT = process.env.PORT || 3001;

// Store active WhatsApp clients per session
const activeClients = new Map();
const qrCodes = new Map();
const qrImages = new Map();

// Ensure sessions directory exists
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

console.log('🚀 WhatsApp-Web.js Service Starting...');

/**
 * Initialize WhatsApp client for a specific session
 */
async function initWhatsAppSession(unitId, sessionId) {
    try {
        console.log(`📱 Initializing WhatsApp session: ${sessionId} for unit: ${unitId}`);
        
        // Check if session already exists
        if (activeClients.has(sessionId)) {
            const clientData = activeClients.get(sessionId);
            console.log(`⚠️ Session ${sessionId} already exists with status: ${clientData.status}`);
            return clientData;
        }

        // Create WhatsApp client with LocalAuth
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: sessionId,
                dataPath: SESSIONS_DIR
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        // Store client data
        const clientData = {
            client,
            unitId,
            sessionId,
            status: 'initializing',
            connectedAt: null,
            phoneNumber: null,
            qr: null
        };
        
        activeClients.set(sessionId, clientData);

        // QR Code Event
        client.on('qr', async (qr) => {
            console.log(`📲 QR Code received for session: ${sessionId}`);
            clientData.status = 'qr_ready';
            clientData.qr = qr;
            qrCodes.set(sessionId, qr);
            
            // Generate QR code image
            try {
                const qrImage = await qrcode.toDataURL(qr);
                qrImages.set(sessionId, qrImage);
                console.log(`✅ QR Code image generated for: ${sessionId}`);
            } catch (err) {
                console.error(`❌ Error generating QR image:`, err.message);
            }
            
            // Notify FastAPI
            try {
                await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                    session_id: sessionId,
                    unit_id: unitId,
                    status: 'qr_ready'
                });
            } catch (error) {
                console.error('Failed to notify FastAPI about QR:', error.message);
            }
        });

        // Ready Event
        client.on('ready', async () => {
            console.log(`✅ WhatsApp client ready for session: ${sessionId}`);
            clientData.status = 'connected';
            clientData.connectedAt = new Date().toISOString();
            clientData.phoneNumber = client.info?.wid?.user || null;
            clientData.qr = null;
            qrCodes.delete(sessionId);
            qrImages.delete(sessionId);
            
            // Notify FastAPI
            try {
                await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                    session_id: sessionId,
                    unit_id: unitId,
                    status: 'connected',
                    phone_number: clientData.phoneNumber
                });
            } catch (error) {
                console.error('Failed to notify FastAPI about connection:', error.message);
            }
        });

        // Authenticated Event
        client.on('authenticated', () => {
            console.log(`🔐 Session authenticated: ${sessionId}`);
            clientData.status = 'authenticated';
        });

        // Authentication Failure Event
        client.on('auth_failure', async (msg) => {
            console.error(`❌ Authentication failure for ${sessionId}:`, msg);
            clientData.status = 'auth_failed';
            
            try {
                await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                    session_id: sessionId,
                    unit_id: unitId,
                    status: 'auth_failed'
                });
            } catch (error) {
                console.error('Failed to notify FastAPI about auth failure:', error.message);
            }
        });

        // Disconnected Event
        client.on('disconnected', async (reason) => {
            console.log(`🔌 Client disconnected for ${sessionId}:`, reason);
            clientData.status = 'disconnected';
            activeClients.delete(sessionId);
            qrCodes.delete(sessionId);
            qrImages.delete(sessionId);
            
            try {
                await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                    session_id: sessionId,
                    unit_id: unitId,
                    status: 'disconnected'
                });
            } catch (error) {
                console.error('Failed to notify FastAPI about disconnection:', error.message);
            }
        });

        // Message Received Event
        client.on('message', async (msg) => {
            try {
                const contact = await msg.getContact();
                const phoneNumber = contact.number || msg.from.replace('@c.us', '');
                const messageText = msg.body;
                
                console.log(`📩 Message from ${phoneNumber}: ${messageText.substring(0, 50)}...`);
                
                // Forward to FastAPI webhook
                await axios.post(`${FASTAPI_URL}/api/whatsapp/webhook`, {
                    unit_id: unitId,
                    session_id: sessionId,
                    phone_number: phoneNumber,
                    message: messageText,
                    message_id: msg.id.id,
                    timestamp: msg.timestamp
                });
            } catch (error) {
                console.error('Error handling incoming message:', error.message);
            }
        });

        // Initialize client
        await client.initialize();
        console.log(`🔄 Client initialization started for: ${sessionId}`);
        
        return clientData;

    } catch (error) {
        console.error(`❌ Error initializing WhatsApp for ${sessionId}:`, error.message);
        throw error;
    }
}

/**
 * Send message via specific session
 */
async function sendMessageViaSession(sessionId, phoneNumber, text) {
    try {
        const clientData = activeClients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        if (clientData.status !== 'connected') {
            throw new Error(`Session ${sessionId} not connected. Status: ${clientData.status}`);
        }
        
        const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
        await clientData.client.sendMessage(chatId, text);
        
        console.log(`✉️ Message sent to ${phoneNumber} via session ${sessionId}`);
        return { success: true };
        
    } catch (error) {
        console.error('Error sending message:', error.message);
        return { success: false, error: error.message };
    }
}

// ==================== REST API ENDPOINTS ====================

/**
 * Initialize new WhatsApp session
 */
app.post('/init-session', async (req, res) => {
    const { unit_id, session_id } = req.body;
    
    if (!unit_id || !session_id) {
        return res.status(400).json({ error: 'unit_id and session_id are required' });
    }
    
    try {
        const clientData = await initWhatsAppSession(unit_id, session_id);
        res.json({
            success: true,
            message: 'Session initialization started',
            session_id: session_id,
            status: clientData.status
        });
    } catch (error) {
        console.error('Init session error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get QR code for session
 */
app.get('/qr/:session_id', (req, res) => {
    const { session_id } = req.params;
    const clientData = activeClients.get(session_id);
    const qr = qrCodes.get(session_id);
    const qrImage = qrImages.get(session_id);
    
    if (!clientData) {
        return res.json({
            qr: null,
            qr_image: null,
            available: false,
            status: 'not_found',
            message: 'Session not initialized'
        });
    }
    
    if (clientData.status === 'connected') {
        return res.json({
            qr: null,
            qr_image: null,
            available: false,
            status: 'connected',
            message: 'Session already connected',
            phone_number: clientData.phoneNumber
        });
    }
    
    res.json({
        qr: qr || null,
        qr_image: qrImage || null,
        available: qr ? true : false,
        status: clientData.status
    });
});

/**
 * Send message
 */
app.post('/send', async (req, res) => {
    const { session_id, phone_number, message } = req.body;
    
    if (!session_id || !phone_number || !message) {
        return res.status(400).json({ error: 'session_id, phone_number, and message are required' });
    }
    
    const result = await sendMessageViaSession(session_id, phone_number, message);
    res.json(result);
});

/**
 * Get session status
 */
app.get('/status/:session_id', (req, res) => {
    const { session_id } = req.params;
    const clientData = activeClients.get(session_id);
    
    if (!clientData) {
        return res.json({
            connected: false,
            status: 'not_initialized'
        });
    }
    
    res.json({
        connected: clientData.status === 'connected',
        status: clientData.status,
        unit_id: clientData.unitId,
        phone_number: clientData.phoneNumber,
        connected_at: clientData.connectedAt
    });
});

/**
 * Get all active sessions
 */
app.get('/sessions', (req, res) => {
    const sessions = [];
    
    activeClients.forEach((data, sessionId) => {
        sessions.push({
            session_id: sessionId,
            unit_id: data.unitId,
            status: data.status,
            phone_number: data.phoneNumber,
            connected_at: data.connectedAt
        });
    });
    
    res.json({ sessions, total: sessions.length });
});

/**
 * Disconnect session
 */
app.post('/disconnect/:session_id', async (req, res) => {
    const { session_id } = req.params;
    const clientData = activeClients.get(session_id);
    
    if (!clientData) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        await clientData.client.logout();
        activeClients.delete(session_id);
        qrCodes.delete(session_id);
        qrImages.delete(session_id);
        
        res.json({ success: true, message: 'Session disconnected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        active_sessions: activeClients.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ WhatsApp-Web.js service running on port ${PORT}`);
    console.log(`📡 Ready to handle WhatsApp connections`);
    console.log(`🔗 FastAPI URL: ${FASTAPI_URL}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    for (const [sessionId, clientData] of activeClients.entries()) {
        try {
            await clientData.client.destroy();
            console.log(`✅ Disconnected session: ${sessionId}`);
        } catch (error) {
            console.error(`❌ Error disconnecting session ${sessionId}:`, error.message);
        }
    }
    
    process.exit(0);
});
