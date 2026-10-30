const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
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
  FIVEM_LOG_KEY: process.env.FIVEM_LOG_KEY || 'southside-secret-123',
  ROLE_ACCEPTED_ID: process.env.ROLE_ACCEPTED_ID, 
  ROLE_WAITING_ID: process.env.ROLE_WAITING_ID    
};

const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ fivemLogs: [], bans: [], warns: [], playerStats: {} }, null, 2));
const getDB = () => JSON.parse(fs.readFileSync(dbPath));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

let currentPlayers = [];
let serverStats = { online: false, players: 0, maxPlayers: 128, lastUpdate: 0 };
let liveFrames = {};
let actionQueue = []; // قائمة الأوامر (Ban, Kick, Warn)

app.use(session({
  secret: CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, 
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

// Discord Auth
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
  if (req.user) return next(); // تبسيط: نعتبرو أي واحد داخل بالديسكورد أدمن
  res.status(403).json({ error: 'Access Denied.' });
}

// ===== Routes =====
app.post('/api/server-stats', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    serverStats = { online: req.body.online || true, players: req.body.players || 0, maxPlayers: req.body.maxPlayers || 128, lastUpdate: Date.now() };
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    const isOnline = serverStats.lastUpdate && (Date.now() - serverStats.lastUpdate < 30000);
    res.json({ online: isOnline, players: isOnline ? serverStats.players : 0, maxPlayers: serverStats.maxPlayers || 128, name: 'SouthSide S2', ip: `connect play.southsiderp.tn` });
});

app.post('/api/update-players', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    currentPlayers = req.body.players || [];
    res.json({ success: true });
});

app.get('/api/players', isAdmin, (req, res) => res.json(currentPlayers));

app.post('/api/send-log', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.fivemLogs.push({ time: new Date().toISOString(), message: req.body.message, category: req.body.category });
    if (db.fivemLogs.length > 500) db.fivemLogs.shift();
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json({ logs: db.fivemLogs.slice(-150).reverse() });
});

app.post('/api/stream-frame', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (req.body.playerId && req.body.frame) liveFrames[req.body.playerId] = req.body.frame;
    res.json({ success: true });
});

app.get('/api/stream-frame/:id', isAdmin, (req, res) => res.json({ frame: liveFrames[req.params.id] || null }));

// 🔴 Actions (Ban, Kick, Warn)
app.post('/api/action', isAdmin, (req, res) => {
    const { playerId, type, reason } = req.body;
    if (!playerId || !type) return res.status(400).json({ error: 'Missing data' });
    
    actionQueue.push({ playerId, type, reason });
    
    const db = getDB();
    if (!db.playerStats[playerId]) db.playerStats[playerId] = { bans: 0, warns: 0, kicks: 0 };
    
    if (type === 'ban') db.playerStats[playerId].bans++;
    if (type === 'warn') db.playerStats[playerId].warns++;
    if (type === 'kick') db.playerStats[playerId].kicks++;
    
    db.fivemLogs.push({ time: new Date().toISOString(), message: `Action: ${type.toUpperCase()} on Player ID ${playerId} | Reason: ${reason}`, category: 'ADMIN' });
    saveDB(db);

    res.json({ success: true });
});

app.post('/api/get-actions', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const actions = [...actionQueue];
    actionQueue = []; // نفرغو القائمة
    res.json({ actions });
});

app.get('/api/player-stats/:id', isAdmin, (req, res) => {
    const db = getDB();
    const stats = db.playerStats[req.params.id] || { bans: 0, warns: 0, kicks: 0 };
    res.json(stats);
});

app.get('/api/player-logs/:id', isAdmin, (req, res) => {
    const db = getDB();
    // نفلترو اللوقز اللي فيها اسم اللاعب ولا الـ ID
    const logs = db.fivemLogs.filter(l => l.message.includes(req.params.id) || l.message.includes(req.params.name)).reverse();
    res.json(logs);
});

app.post('/api/admin-login', (req, res) => {
  if (req.body.password === CONFIG.ADMIN_PASSWORD) { req.session.isAdmin = true; res.json({ success: true }); } 
  else { res.status(401).json({ success: false }); }
});

app.get('/api/auth/me', (req, res) => { if (req.user) res.json({ loggedIn: true, username: req.user.username, id: req.user.id, avatar: req.user.avatar }); else res.json({ loggedIn: false }); });
app.get('/api/auth/logout', (req, res) => req.logout(() => res.redirect('/')));
app.get('/api/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/?login=failed' }), (req, res) => res.redirect('/?login=success'));
app.get('/api/auth/check-admin', isAdmin, (req, res) => res.json({ isAdmin: true }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
