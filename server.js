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
const wss = new WebSocket.Server({ server, path: '/ws' });
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true })); 
app.use(express.json({ limit: '50mb' })); // باش نقبلو الصور الكبيرة
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
  FIVEM_LOG_KEY: process.env.FIVEM_LOG_KEY || 'southside-secret-123',
  ROLE_ACCEPTED_ID: process.env.ROLE_ACCEPTED_ID, 
  ROLE_WAITING_ID: process.env.ROLE_WAITING_ID    
};

// ===== Database =====
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [], siteLogs: [], fivemLogs: [] }, null, 2));
}
const getDB = () => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    if (!db.fivemLogs) db.fivemLogs = [];
    if (!db.siteLogs) db.siteLogs = [];
    return db;
};
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

const addSiteLog = (action, user, details) => {
    const db = getDB();
    db.siteLogs.push({ time: new Date().toISOString(), action, user, details });
    if (db.siteLogs.length > 500) db.siteLogs.shift();
    saveDB(db);
};

// 🔴 الستريم (الصور)
const liveFrames = {};

// ===== Sessions =====
app.use(session({
  secret: CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, 
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

// ===== Discord Auth =====
const DiscordStrategy = require('passport-discord').Strategy;
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new DiscordStrategy({
  clientID: CONFIG.DISCORD_CLIENT_ID,
  clientSecret: CONFIG.DISCORD_CLIENT_SECRET,
  callbackURL: CONFIG.DISCORD_CALLBACK_URL,
  scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// ===== 🔴 الحماية =====
async function isAdmin(req, res, next) {
  if (req.headers['x-admin-password'] === CONFIG.ADMIN_PASSWORD) return next();
  if (req.session && req.session.isAdmin) return next(); 
  if (req.user && req.user.id) {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${CONFIG.GUILD_ID}/members/${req.user.id}`, {
        headers: { Authorization: `Bot ${CONFIG.DISCORD_BOT_TOKEN}` }
      });
      if (response.ok) {
        const memberData = await response.json();
        if (memberData.roles && memberData.roles.includes(CONFIG.ADMIN_ROLE_ID)) return next(); 
      }
    } catch (e) { console.error("Role check error:", e); }
  }
  res.status(403).json({ error: 'Access Denied.' });
}

// ===== WebSocket =====
wss.on('connection', (ws, req) => {
    console.log('🔗 Client Connected');
    let isAuthenticated = false;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'auth') {
                if (data.key === CONFIG.FIVEM_LOG_KEY) {
                    isAuthenticated = true;
                    console.log('✅ Authenticated successfully!');
                } else {
                    ws.close();
                }
                return;
            }

            if (!isAuthenticated) return;

            if (data.type === 'log') {
                const db = getDB();
                db.fivemLogs.push({ time: new Date().toISOString(), message: data.message, category: data.category });
                if (db.fivemLogs.length > 500) db.fivemLogs.shift();
                saveDB(db);
            }

            if (data.type === 'update_players') {
                ws.players = data.players;
            }

            if (data.type === 'stream_frame') {
                liveFrames[data.playerId] = data.frame;
            }

        } catch (err) {}
    });

    ws.on('close', () => console.log('🔗 Client Disconnected'));
});

// ===== FiveM Stats & Logs =====
app.get('/api/stats', async (req, res) => {
    try {
        const base = `http://${CONFIG.FIVEM_IP}:${CONFIG.FIVEM_PORT}`;
        const dynRes = await fetch(`${base}/dynamic.json`, { timeout: 5000 });
        if (!dynRes.ok) throw new Error('unreachable');
        const dyn = await dynRes.json();
        let name = 'SouthSide S2';
        try {
            const infoRes = await fetch(`${base}/info.json`, { timeout: 3000 });
            if (infoRes.ok) { const info = await infoRes.json(); name = info.hostname || name; }
        } catch (_) {}
        res.json({ online: true, players: dyn.clients || 0, maxPlayers: dyn.sv_maxclients || 128, name, ip: `connect ${CONFIG.FIVEM_IP}:${CONFIG.FIVEM_PORT}` });
    } catch (e) {
        res.json({ online: false, players: 0, maxPlayers: 128, name: 'SouthSide S2', ip: 'connect play.southsiderp.tn' });
    }
});

app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json({ logs: db.fivemLogs.slice(-150).reverse() });
});

app.get('/api/site-logs', isAdmin, (req, res) => res.json(getDB().siteLogs.reverse()));

// 🔴 Route متاع اللاعبين
app.get('/api/players', isAdmin, (req, res) => {
    let allPlayers = [];
    wss.clients.forEach(client => {
        if (client.players && client.players.length > 0) {
            allPlayers = client.players;
        }
    });
    res.json(allPlayers);
});

// 🔴 Route متاع الستريم
app.get('/api/stream-frame/:id', isAdmin, (req, res) => {
    const frame = liveFrames[req.params.id];
    res.json({ frame: frame || null });
});

// ===== Auth Routes =====
app.get('/api/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/?login=failed' }), (req, res) => res.redirect('/?login=success'));
app.get('/api/auth/me', (req, res) => {
  if (req.user) res.json({ loggedIn: true, username: req.user.username, id: req.user.id, avatar: req.user.avatar });
  else res.json({ loggedIn: false });
});
app.get('/api/auth/logout', (req, res) => req.logout(() => res.redirect('/')));
app.get('/api/auth/check-admin', isAdmin, (req, res) => res.json({ isAdmin: true })); 

// ===== باقي الـ APIs (Gangs, Shop, Tickets, Admin Login) =====
// (هنا تحط الكود القديم متاع Gangs, Shop, Tickets, Admin Login)

app.post('/api/admin-login', (req, res) => {
  if (req.body.password === CONFIG.ADMIN_PASSWORD) { req.session.isAdmin = true; res.json({ success: true }); } 
  else { res.status(401).json({ success: false }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
