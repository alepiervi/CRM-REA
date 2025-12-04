const { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const P = require('pino')

const app = express()
app.use(cors())
app.use(express.json())

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001'
const PORT = process.env.PORT || 3001

// Store active WhatsApp sockets per unit_id
const activeSockets = new Map()
const qrCodes = new Map()

const logger = P({ level: 'info' })

/**
 * Initialize WhatsApp connection for a specific unit
 */
async function initWhatsAppForUnit(unitId, sessionId) {
    try {
        logger.info(`Initializing WhatsApp for unit: ${unitId}, session: ${sessionId}`)
        
        const authDir = `auth_sessions/${sessionId}`
        const { state, saveCreds } = await useMultiFileAuthState(authDir)

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: P({ level: 'silent' }),
            browser: ['Nureal CRM', 'Chrome', '1.0.0']
        })

        // Store socket reference
        activeSockets.set(sessionId, {
            sock,
            unitId,
            sessionId,
            status: 'connecting',
            connectedAt: null,
            phoneNumber: null
        })

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                logger.info(`QR Code generated for session: ${sessionId}`)
                qrCodes.set(sessionId, qr)
                
                // Update status in FastAPI
                try {
                    await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                        session_id: sessionId,
                        unit_id: unitId,
                        status: 'qr_ready',
                        qr_code: qr
                    })
                } catch (error) {
                    logger.error('Failed to update session status:', error.message)
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                logger.info(`Connection closed for ${sessionId}, reconnecting: ${shouldReconnect}`)

                if (shouldReconnect) {
                    activeSockets.delete(sessionId)
                    qrCodes.delete(sessionId)
                    setTimeout(() => initWhatsAppForUnit(unitId, sessionId), 5000)
                } else {
                    // Logged out - notify FastAPI
                    activeSockets.delete(sessionId)
                    qrCodes.delete(sessionId)
                    try {
                        await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                            session_id: sessionId,
                            unit_id: unitId,
                            status: 'disconnected'
                        })
                    } catch (error) {
                        logger.error('Failed to notify disconnection:', error.message)
                    }
                }
            } else if (connection === 'open') {
                logger.info(`WhatsApp connected for session: ${sessionId}`)
                qrCodes.delete(sessionId)
                
                const sessionData = activeSockets.get(sessionId)
                if (sessionData) {
                    sessionData.status = 'connected'
                    sessionData.connectedAt = new Date().toISOString()
                    sessionData.phoneNumber = sock.user?.id?.split(':')[0] || null
                }

                // Notify FastAPI
                try {
                    await axios.post(`${FASTAPI_URL}/api/whatsapp-session-update`, {
                        session_id: sessionId,
                        unit_id: unitId,
                        status: 'connected',
                        phone_number: sock.user?.id?.split(':')[0] || null
                    })
                } catch (error) {
                    logger.error('Failed to notify connection:', error.message)
                }
            }
        })

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    if (!message.key.fromMe && message.message) {
                        await handleIncomingMessage(sessionId, unitId, message)
                    }
                }
            }
        })

        // Save credentials on update
        sock.ev.on('creds.update', saveCreds)

    } catch (error) {
        logger.error(`WhatsApp initialization error for ${sessionId}:`, error)
        setTimeout(() => initWhatsAppForUnit(unitId, sessionId), 10000)
    }
}

/**
 * Handle incoming WhatsApp messages
 */
async function handleIncomingMessage(sessionId, unitId, message) {
    try {
        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '')
        const messageText = message.message.conversation ||
                           message.message.extendedTextMessage?.text || ''

        logger.info(`Incoming message from ${phoneNumber}: ${messageText.substring(0, 50)}...`)

        // Forward to FastAPI webhook
        const response = await axios.post(`${FASTAPI_URL}/api/whatsapp/webhook`, {
            unit_id: unitId,
            session_id: sessionId,
            phone_number: phoneNumber,
            message: messageText,
            message_id: message.key.id,
            timestamp: message.messageTimestamp
        })

        // Send automatic reply if FastAPI provides one
        if (response.data.reply) {
            await sendMessageViaSession(sessionId, phoneNumber, response.data.reply)
        }

    } catch (error) {
        logger.error('Error handling incoming message:', error.message)
    }
}

/**
 * Send message via specific session
 */
async function sendMessageViaSession(sessionId, phoneNumber, text) {
    try {
        const sessionData = activeSockets.get(sessionId)
        if (!sessionData || sessionData.status !== 'connected') {
            throw new Error(`Session ${sessionId} not connected`)
        }

        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`
        await sessionData.sock.sendMessage(jid, { text })
        
        logger.info(`Message sent to ${phoneNumber} via session ${sessionId}`)
        return { success: true }

    } catch (error) {
        logger.error('Error sending message:', error.message)
        return { success: false, error: error.message }
    }
}

// ==================== REST API ENDPOINTS ====================

/**
 * Initialize new WhatsApp session
 */
app.post('/init-session', async (req, res) => {
    const { unit_id, session_id } = req.body
    
    if (!unit_id || !session_id) {
        return res.status(400).json({ error: 'unit_id and session_id are required' })
    }

    try {
        // Check if session already exists
        if (activeSockets.has(session_id)) {
            return res.json({ 
                success: true, 
                message: 'Session already initialized',
                status: activeSockets.get(session_id).status
            })
        }

        // Start initialization
        initWhatsAppForUnit(unit_id, session_id)
        
        res.json({ 
            success: true, 
            message: 'Session initialization started',
            session_id
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

/**
 * Get QR code for session
 */
app.get('/qr/:session_id', (req, res) => {
    const { session_id } = req.params
    const qr = qrCodes.get(session_id)
    
    res.json({ 
        qr: qr || null,
        available: qr ? true : false
    })
})

/**
 * Send message
 */
app.post('/send', async (req, res) => {
    const { session_id, phone_number, message } = req.body
    
    if (!session_id || !phone_number || !message) {
        return res.status(400).json({ error: 'session_id, phone_number, and message are required' })
    }

    const result = await sendMessageViaSession(session_id, phone_number, message)
    res.json(result)
})

/**
 * Get session status
 */
app.get('/status/:session_id', (req, res) => {
    const { session_id } = req.params
    const sessionData = activeSockets.get(session_id)
    
    if (!sessionData) {
        return res.json({ 
            connected: false, 
            status: 'not_initialized'
        })
    }
    
    res.json({
        connected: sessionData.status === 'connected',
        status: sessionData.status,
        unit_id: sessionData.unitId,
        phone_number: sessionData.phoneNumber,
        connected_at: sessionData.connectedAt
    })
})

/**
 * Get all active sessions
 */
app.get('/sessions', (req, res) => {
    const sessions = []
    
    activeSockets.forEach((data, sessionId) => {
        sessions.push({
            session_id: sessionId,
            unit_id: data.unitId,
            status: data.status,
            phone_number: data.phoneNumber,
            connected_at: data.connectedAt
        })
    })
    
    res.json({ sessions, total: sessions.length })
})

/**
 * Disconnect session
 */
app.post('/disconnect/:session_id', async (req, res) => {
    const { session_id } = req.params
    const sessionData = activeSockets.get(session_id)
    
    if (!sessionData) {
        return res.status(404).json({ error: 'Session not found' })
    }
    
    try {
        await sessionData.sock.logout()
        activeSockets.delete(session_id)
        qrCodes.delete(session_id)
        
        res.json({ success: true, message: 'Session disconnected' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        active_sessions: activeSockets.size,
        timestamp: new Date().toISOString()
    })
})

// Start server
app.listen(PORT, () => {
    logger.info(`WhatsApp service running on port ${PORT}`)
    logger.info(`Ready to handle multi-unit WhatsApp connections`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...')
    
    // Disconnect all sessions
    for (const [sessionId, sessionData] of activeSockets.entries()) {
        try {
            await sessionData.sock.logout()
        } catch (error) {
            logger.error(`Error disconnecting session ${sessionId}:`, error.message)
        }
    }
    
    process.exit(0)
})
