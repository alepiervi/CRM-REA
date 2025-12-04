const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001';
const PORT = process.env.PORT || 3002;

// Store active bots per unit_id
const activeBots = new Map();
const userMappings = new Map(); // Map telegram chat_id to CRM lead phone

console.log('🤖 Telegram Service Starting...');

/**
 * Initialize Telegram Bot for a specific unit
 */
function initTelegramBot(unitId, botToken) {
    try {
        console.log(`Initializing Telegram bot for unit: ${unitId}`);
        
        const bot = new TelegramBot(botToken, { polling: true });
        
        // Store bot reference
        activeBots.set(unitId, {
            bot,
            unitId,
            token: botToken,
            status: 'active',
            connectedAt: new Date().toISOString()
        });

        // Handle /start command
        bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, 
                '👋 Benvenuto nel sistema CRM Nureal!\n\n' +
                'Per associare questo account al tuo numero, invia: /registra +393123456789\n\n' +
                'Riceverai qui i messaggi del CRM.'
            );
        });

        // Handle /registra command
        bot.onText(/\/registra (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const phoneNumber = match[1].trim();
            
            // Save mapping
            userMappings.set(chatId, {
                phone: phoneNumber,
                unitId: unitId,
                registeredAt: new Date().toISOString()
            });
            
            bot.sendMessage(chatId, 
                `✅ Account associato al numero: ${phoneNumber}\n\n` +
                'Ora riceverai i messaggi del CRM qui su Telegram!'
            );
            
            console.log(`User registered: ChatID ${chatId} → Phone ${phoneNumber}`);
        });

        // Handle incoming messages
        bot.on('message', async (msg) => {
            // Skip commands
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const messageText = msg.text || '[Media]';
            
            // Get user mapping
            const userMapping = userMappings.get(chatId);
            if (!userMapping) {
                bot.sendMessage(chatId, 
                    '⚠️ Account non registrato.\n\n' +
                    'Per registrarti, invia: /registra +393123456789'
                );
                return;
            }

            console.log(`📨 Message from ${userMapping.phone}: ${messageText}`);

            // Forward to FastAPI webhook
            try {
                const response = await axios.post(`${FASTAPI_URL}/api/telegram/webhook`, {
                    unit_id: unitId,
                    chat_id: chatId,
                    phone_number: userMapping.phone,
                    message: messageText,
                    message_id: msg.message_id,
                    timestamp: msg.date
                });

                // Send automatic reply if FastAPI provides one
                if (response.data.reply) {
                    await bot.sendMessage(chatId, response.data.reply);
                }
            } catch (error) {
                console.error('Error forwarding to FastAPI:', error.message);
            }
        });

        console.log(`✅ Telegram bot active for unit: ${unitId}`);
        
        // Notify FastAPI
        axios.post(`${FASTAPI_URL}/api/telegram-session-update`, {
            unit_id: unitId,
            status: 'active'
        }).catch(err => console.error('Failed to notify FastAPI:', err.message));

        return { success: true, unit_id: unitId };

    } catch (error) {
        console.error(`Failed to initialize bot for ${unitId}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send message via Telegram bot
 */
async function sendMessage(unitId, phoneNumber, message) {
    try {
        const botData = activeBots.get(unitId);
        if (!botData) {
            throw new Error(`No active bot for unit: ${unitId}`);
        }

        // Find chat_id for this phone number
        let targetChatId = null;
        for (const [chatId, mapping] of userMappings.entries()) {
            if (mapping.phone === phoneNumber && mapping.unitId === unitId) {
                targetChatId = chatId;
                break;
            }
        }

        if (!targetChatId) {
            console.log(`⚠️ No Telegram user registered for phone: ${phoneNumber}`);
            return { 
                success: false, 
                error: 'User not registered on Telegram',
                info: 'User needs to open Telegram bot and use /registra command'
            };
        }

        await botData.bot.sendMessage(targetChatId, message);
        console.log(`✅ Message sent to ${phoneNumber} via Telegram`);
        
        return { success: true };

    } catch (error) {
        console.error('Error sending message:', error.message);
        return { success: false, error: error.message };
    }
}

// ==================== REST API ENDPOINTS ====================

/**
 * Initialize new Telegram bot
 */
app.post('/init-bot', async (req, res) => {
    const { unit_id, bot_token } = req.body;
    
    if (!unit_id || !bot_token) {
        return res.status(400).json({ error: 'unit_id and bot_token are required' });
    }

    try {
        // Check if bot already exists
        if (activeBots.has(unit_id)) {
            return res.json({ 
                success: true, 
                message: 'Bot already active',
                unit_id
            });
        }

        const result = initTelegramBot(unit_id, bot_token);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Send message
 */
app.post('/send', async (req, res) => {
    const { unit_id, phone_number, message } = req.body;
    
    if (!unit_id || !phone_number || !message) {
        return res.status(400).json({ 
            error: 'unit_id, phone_number, and message are required' 
        });
    }

    const result = await sendMessage(unit_id, phone_number, message);
    res.json(result);
});

/**
 * Get bot status
 */
app.get('/status/:unit_id', (req, res) => {
    const { unit_id } = req.params;
    const botData = activeBots.get(unit_id);
    
    if (!botData) {
        return res.json({ 
            active: false, 
            status: 'not_initialized'
        });
    }
    
    res.json({
        active: true,
        status: botData.status,
        unit_id: botData.unitId,
        connected_at: botData.connectedAt,
        registered_users: Array.from(userMappings.values())
            .filter(m => m.unitId === unit_id)
            .length
    });
});

/**
 * Get all active bots
 */
app.get('/bots', (req, res) => {
    const bots = [];
    
    activeBots.forEach((data, unitId) => {
        bots.push({
            unit_id: unitId,
            status: data.status,
            connected_at: data.connectedAt,
            registered_users: Array.from(userMappings.values())
                .filter(m => m.unitId === unitId)
                .length
        });
    });
    
    res.json({ bots, total: bots.length });
});

/**
 * Get registered users
 */
app.get('/users', (req, res) => {
    const users = [];
    
    userMappings.forEach((data, chatId) => {
        users.push({
            chat_id: chatId,
            phone: data.phone,
            unit_id: data.unitId,
            registered_at: data.registeredAt
        });
    });
    
    res.json({ users, total: users.length });
});

/**
 * Stop bot
 */
app.post('/stop/:unit_id', async (req, res) => {
    const { unit_id } = req.params;
    const botData = activeBots.get(unit_id);
    
    if (!botData) {
        return res.status(404).json({ error: 'Bot not found' });
    }
    
    try {
        botData.bot.stopPolling();
        activeBots.delete(unit_id);
        
        res.json({ success: true, message: 'Bot stopped' });
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
        active_bots: activeBots.size,
        registered_users: userMappings.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🤖 Telegram service running on port ${PORT}`);
    console.log(`Ready to handle Telegram bots for testing`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    activeBots.forEach((botData) => {
        botData.bot.stopPolling();
    });
    process.exit(0);
});
