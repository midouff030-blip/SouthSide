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

// ===== Database =====
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ 
        players: [], 
        bans: [], 
        detections: [], 
        logs: [], 
        stats: { online: false, players: 0, maxPlayers: 128, lastUpdate: 0 },
        actions: [],
        liveFrames: {},
        tickets: [],
        gangs: [],
        shop: [],
        playerStats: {}
    }, null, 2));
}
const getDB = () => JSON.parse(fs.readFileSync(dbPath));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

app.use(session({
  secret: CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, 
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

// ===== Auth =====
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

// ===== Routes =====

// 1. Stats
app.post('/api/server-stats', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.stats = { online: true, players: req.body.players || 0, maxPlayers: req.body.maxPlayers || 128, lastUpdate: Date.now() };
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    const db = getDB();
    const isOnline = db.stats.lastUpdate && (Date.now() - db.stats.lastUpdate < 30000);
    res.json({ 
        online: isOnline, 
        players: isOnline ? db.stats.players : 0, 
        maxPlayers: db.stats.maxPlayers || 128, 
        name: 'SouthSide S2', 
        ip: `connect play.southsiderp.tn` 
    });
});

// 2. Players
app.post('/api/update-players', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.players = req.body.players || [];
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/players', isAdmin, (req, res) => {
    const db = getDB();
    let players = db.players || [];
    
    // نضيفو stats لكل لاعب
    players = players.map(p => {
        const stats = (db.playerStats && db.playerStats[p.id]) || { bans: 0, warns: 0, kicks: 0 };
        return { ...p, stats };
    });
    
    res.json(players);
});

// 3. Logs
app.post('/api/send-log', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.logs.push({ time: new Date().toISOString(), message: req.body.message, category: req.body.category });
    if (db.logs.length > 500) db.logs.shift();
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.logs.slice(-150).reverse());
});

// 4. Stream
app.post('/api/stream-frame', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    if (!db.liveFrames) db.liveFrames = {};
    if (req.body.playerId && req.body.frame) db.liveFrames[req.body.playerId] = req.body.frame;
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/stream-frame/:id', isAdmin, (req, res) => {
    const db = getDB();
    res.json({ frame: (db.liveFrames && db.liveFrames[req.params.id]) || null });
});

// 5. Actions (Ban, Kick, Warn, Stream)
app.post('/api/action', isAdmin, (req, res) => {
    const { playerId, type, reason } = req.body;
    if (!playerId || !type) return res.status(400).json({ error: 'Missing data' });
    
    const db = getDB();
    if (!db.actions) db.actions = [];
    if (!db.playerStats) db.playerStats = {};
    
    db.actions.push({ playerId, type, reason, time: new Date().toISOString() });
    
    if (!db.playerStats[playerId]) db.playerStats[playerId] = { bans: 0, warns: 0, kicks: 0 };
    if (type === 'ban') db.playerStats[playerId].bans++;
    if (type === 'warn') db.playerStats[playerId].warns++;
    if (type === 'kick') db.playerStats[playerId].kicks++;
    
    db.logs.push({ time: new Date().toISOString(), message: `Action: ${type.toUpperCase()} on Player ID ${playerId} | Reason: ${reason}`, category: 'ADMIN' });
    saveDB(db);

    res.json({ success: true });
});

app.post('/api/get-actions', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    const actions = db.actions || [];
    db.actions = []; 
    saveDB(db);
    res.json({ actions });
});

// 6. Bans & Detections
app.get('/api/bans', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.bans || []);
});

app.get('/api/detections', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.detections || []);
});

// 7. Player Stats & Logs
app.get('/api/player-stats/:id', isAdmin, (req, res) => {
    const db = getDB();
    const stats = (db.playerStats && db.playerStats[req.params.id]) || { bans: 0, warns: 0, kicks: 0 };
    res.json(stats);
});

app.get('/api/player-logs/:id', isAdmin, (req, res) => {
    const db = getDB();
    const logs = db.logs.filter(l => l.message.includes(req.params.id)).reverse();
    res.json(logs);
});

// 8. Tickets
app.get('/api/tickets', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.tickets || []);
});

app.post('/api/tickets', (req, res) => {
    const db = getDB();
    if (!db.tickets) db.tickets = [];
    const ticket = { id: Date.now().toString(), status: 'pending', reason: '', user: req.user ? req.user.username : 'Guest', ...req.body };
    db.tickets.push(ticket);
    saveDB(db);
    res.json(ticket);
});

app.put('/api/tickets/:id', isAdmin, (req, res) => {
    const db = getDB();
    const t = db.tickets.find(x => x.id === req.params.id);
    if (t) {
        t.status = req.body.status;
        t.reason = req.body.reason || '';
        saveDB(db);
    }
    res.json(t);
});

// 9. Gangs
app.get('/api/gangs', (req, res) => {
    const db = getDB();
    res.json(db.gangs || []);
});

app.post('/api/gangs', isAdmin, async (req, res) => { 
    const db = getDB();
    if (!db.gangs) db.gangs = [];
    const gang = { id: Date.now().toString(), name: req.body.name, logo: req.body.logo, boss: req.body.boss, members: [] };
    db.gangs.push(gang);
    saveDB(db);
    res.json(gang);
});

app.delete('/api/gangs/:id', isAdmin, (req, res) => {
    const db = getDB();
    db.gangs = db.gangs.filter(g => g.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

// 10. Shop
app.get('/api/shop', (req, res) => {
    const db = getDB();
    res.json(db.shop || []);
});

app.post('/api/shop', isAdmin, (req, res) => {
    const db = getDB();
    if (!db.shop) db.shop = [];
    const item = { 
        id: Date.now().toString(), 
        name: req.body.name, 
        price: req.body.price, 
        image: req.body.image,
        category: req.body.category || 'Other'
    };
    db.shop.push(item);
    saveDB(db);
    res.json(item);
});

app.delete('/api/shop/:id', isAdmin, (req, res) => {
    const db = getDB();
    db.shop = db.shop.filter(i => i.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

// 11. Auth Routes
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
