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
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
  FIVEM_LOG_KEY: process.env.FIVEM_LOG_KEY || 'southside-secret-123',
  ROLE_ACCEPTED_ID: process.env.ROLE_ACCEPTED_ID, 
  ROLE_WAITING_ID: process.env.ROLE_WAITING_ID    
};

const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [], siteLogs: [], fivemLogs: [], bans: [] }, null, 2));
}
const getDB = () => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    if (!db.fivemLogs) db.fivemLogs = [];
    if (!db.siteLogs) db.siteLogs = [];
    if (!db.bans) db.bans = [];
    return db;
};
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

const addSiteLog = (action, user, details) => {
    const db = getDB();
    db.siteLogs.push({ time: new Date().toISOString(), action, user, details });
    if (db.siteLogs.length > 500) db.siteLogs.shift();
    saveDB(db);
};

// 🔴 متغيرات السيرفر
let currentPlayers = [];
let serverStats = { online: false, players: 0, maxPlayers: 128, lastUpdate: 0 };
let liveFrames = {};
let banQueue = []; // قائمة اللاعبين اللي لازم يتطردو

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

// ===== WebSocket (احتياطي للوقز القديمة) =====
wss.on('connection', (ws, req) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'log' && data.key === CONFIG.FIVEM_LOG_KEY) {
                const db = getDB();
                db.fivemLogs.push({ time: new Date().toISOString(), message: data.message, category: data.category });
                if (db.fivemLogs.length > 500) db.fivemLogs.shift();
                saveDB(db);
            }
        } catch (err) {}
    });
});

// ===== 🔴 Routes الجديدة للـ Stats، Logs، Stream، Ban =====

// 1. استقبال الـ Stats
app.post('/api/server-stats', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    serverStats = {
        online: req.body.online || true,
        players: req.body.players || 0,
        maxPlayers: req.body.maxPlayers || 128,
        lastUpdate: Date.now()
    };
    res.json({ success: true });
});

// 2. جلب الـ Stats للواجهة
app.get('/api/stats', (req, res) => {
    const isOnline = serverStats.lastUpdate && (Date.now() - serverStats.lastUpdate < 30000);
    res.json({
        online: isOnline,
        players: isOnline ? serverStats.players : 0,
        maxPlayers: serverStats.maxPlayers || 128,
        name: 'SouthSide S2',
        ip: `connect play.southsiderp.tn`
    });
});

// 3. استقبال اللاعبين
app.post('/api/update-players', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    currentPlayers = req.body.players || [];
    res.json({ success: true });
});

// 4. جلب اللاعبين للـ Admin
app.get('/api/players', isAdmin, (req, res) => {
    res.json(currentPlayers);
});

// 5. استقبال اللوجز
app.post('/api/send-log', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const { category, message } = req.body;
    if (category && message) {
        const db = getDB();
        db.fivemLogs.push({ time: new Date().toISOString(), message: message, category: category });
        if (db.fivemLogs.length > 500) db.fivemLogs.shift();
        saveDB(db);
    }
    res.json({ success: true });
});

app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json({ logs: db.fivemLogs.slice(-150).reverse() });
});

app.get('/api/site-logs', isAdmin, (req, res) => res.json(getDB().siteLogs.reverse()));

// 6. استقبال الصورة من الستريم
app.post('/api/stream-frame', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const { playerId, frame } = req.body;
    if (playerId && frame) liveFrames[playerId] = frame;
    res.json({ success: true });
});

app.get('/api/stream-frame/:id', isAdmin, (req, res) => {
    res.json({ frame: liveFrames[req.params.id] || null });
});

// 7. 🔴 Ban لاعب
app.post('/api/ban-player', isAdmin, (req, res) => {
    const { playerId, reason } = req.body;
    if (!playerId) return res.status(400).json({ error: 'Player ID required' });
    
    // نضيفو اللاعب للـ Queue باش السكريبت ياخو ويسمو
    banQueue.push({ playerId, reason });
    
    // نسجلو في اللوقز
    addSiteLog('BAN', req.user ? req.user.username : 'Admin', `Banned Player ID: ${playerId}. Reason: ${reason || 'No reason'}`);
    
    res.json({ success: true });
});

// 8. السكريبت يسقسي واش فما لاعبين مطرودين (Ban Queue)
app.post('/api/get-bans', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const bans = [...banQueue]; // ناخذو نسخة
    banQueue = []; // نفرغو القائمة باش ما يتطردش مرتين
    res.json({ bans });
});

// ===== باقي الـ APIs (Auth, Gangs, Shop, Tickets, Admin Login) =====
// (حط الكود القديم متاعهم هنا...)

app.get('/api/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/?login=failed' }), (req, res) => res.redirect('/?login=success'));
app.get('/api/auth/me', (req, res) => {
  if (req.user) res.json({ loggedIn: true, username: req.user.username, id: req.user.id, avatar: req.user.avatar });
  else res.json({ loggedIn: false });
});
app.get('/api/auth/logout', (req, res) => req.logout(() => res.redirect('/')));
app.get('/api/auth/check-admin', isAdmin, (req, res) => res.json({ isAdmin: true })); 

app.post('/api/admin-login', (req, res) => {
  if (req.body.password === CONFIG.ADMIN_PASSWORD) { req.session.isAdmin = true; res.json({ success: true }); } 
  else { res.status(401).json({ success: false }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
