const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' }); // WebSocket Path
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true })); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ✅ إعدادات
// ==========================================
const CONFIG = {
  SESSION_SECRET: process.env.SESSION_SECRET || 'default_secret',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  GUILD_ID: process.env.GUILD_ID,
  ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_CALLBACK_URL: process.env.DISCORD_CALLBACK_URL,
  WEBHOOK_WHITELIST: process.env.WEBHOOK_WHITELIST || process.env.DISCORD_WEBHOOK_RESULTS,
  WEBHOOK_GANG: process.env.WEBHOOK_GANG || process.env.DISCORD_WEBHOOK_RESULTS,
  WEBHOOK_POLICE: process.env.WEBHOOK_POLICE || process.env.DISCORD_WEBHOOK_RESULTS,
  WEBHOOK_EMS: process.env.WEBHOOK_EMS || process.env.DISCORD_WEBHOOK_RESULTS,
  FIVEM_IP: process.env.FIVEM_IP || '127.0.0.1',
  FIVEM_PORT: process.env.FIVEM_PORT || '30120',
  FIVEM_LOG_KEY: process.env.FIVEM_LOG_KEY || 'secret_key',
  ROLE_ACCEPTED_ID: process.env.ROLE_ACCEPTED_ID, 
  ROLE_WAITING_ID: process.env.ROLE_WAITING_ID    
};

// ===== Database =====
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [], siteLogs: [], fivemLogs: [], players: [] }, null, 2));
}
const getDB = () => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    if (!db.fivemLogs) db.fivemLogs = [];
    if (!db.players) db.players = [];
    return db;
};
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

const addSiteLog = (action, user, details) => {
    const db = getDB();
    db.siteLogs.push({ time: new Date().toISOString(), action, user, details });
    if (db.siteLogs.length > 500) db.siteLogs.shift();
    saveDB(db);
};

// ===== 🔴 WebSocket للاتصال مع فايف إم =====
wss.on('connection', (ws, req) => {
    console.log('🔗 FiveM WebSocket Connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // 1. تحديث قائمة اللاعبين (للـ Multi Stream)
            if (data.type === 'update_players') {
                const db = getDB();
                db.players = data.players; // قائمة اللاعبين
                saveDB(db);
                // نبعثو التحديث للـ Admin Panel
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client !== ws) {
                        client.send(JSON.stringify({ type: 'players_updated', players: data.players }));
                    }
                });
            }
            
            // 2. استقبال اللوقز
            if (data.type === 'log') {
                const db = getDB();
                db.fivemLogs.push({ time: new Date().toISOString(), message: data.message, category: data.category });
                if (db.fivemLogs.length > 500) db.fivemLogs.shift();
                saveDB(db);
                // نبعثو اللوغ الجديد للـ Admin Panel
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client !== ws) {
                        client.send(JSON.stringify({ type: 'new_log', log: data.message }));
                    }
                });
            }

            // 3. استقبال الستريم (فيديو)
            if (data.type === 'stream_frame') {
                // نبعثو الفريم للـ Admin Panel (اللي حاب يتفرج)
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client !== ws) {
                        client.send(JSON.stringify({ type: 'stream_frame', playerId: data.playerId, frame: data.frame }));
                    }
                });
            }

        } catch (err) {
            console.error('WS Error:', err);
        }
    });

    ws.on('close', () => console.log('🔗 FiveM WebSocket Disconnected'));
});

// ===== باقي الكود (Auth, Tickets, Gangs, Shop) =====
// ... (حط الكود القديم متاع الـ Auth والـ Tickets والـ Gangs والـ Shop هنا) ...

// 🔴 Route باش الـ Admin يجيب الستريمز واللاعبين
app.get('/api/players', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.players || []);
});

app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.fivemLogs.reverse() || []);
});

// 🔴 Route متاع الـ WebSocket للـ Frontend
// باش الـ Admin Panel يتصل بالـ WebSocket
// الـ Admin Panel راح يتصل بـ ws://your-site/ws

server.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
