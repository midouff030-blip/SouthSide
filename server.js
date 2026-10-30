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
  WEBHOOK_WHITELIST: process.env.WEBHOOK_WHITELIST,
  WEBHOOK_POLICE: process.env.WEBHOOK_POLICE,
  WEBHOOK_EMS: process.env.WEBHOOK_EMS,
  WEBHOOK_GANG: process.env.WEBHOOK_GANG,
  DISCORD_WEBHOOK_LOGS: process.env.DISCORD_WEBHOOK_LOGS,
  ROLE_ACCEPTED_WHITELIST: process.env.ROLE_ACCEPTED_WHITELIST || process.env.ROLE_ACCEPTED_ID,
  ROLE_ACCEPTED_POLICE: process.env.ROLE_ACCEPTED_POLICE,
  ROLE_ACCEPTED_EMS: process.env.ROLE_ACCEPTED_EMS,
  ROLE_ACCEPTED_GANG: process.env.ROLE_ACCEPTED_GANG
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

// ===== Webhook & Role Helpers =====
function getWebhookUrl(type) {
    if (!type) return CONFIG.WEBHOOK_WHITELIST;
    if (type.includes('Whitelist')) return CONFIG.WEBHOOK_WHITELIST;
    if (type.includes('Police')) return CONFIG.WEBHOOK_POLICE;
    if (type.includes('EMS')) return CONFIG.WEBHOOK_EMS;
    if (type.includes('Gang')) return CONFIG.WEBHOOK_GANG;
    return CONFIG.WEBHOOK_WHITELIST;
}

async function assignDiscordRole(discordId, type) {
    if (!CONFIG.DISCORD_BOT_TOKEN || !CONFIG.GUILD_ID || !discordId) return;
    let roleId = '';
    if (type.includes('Whitelist')) roleId = CONFIG.ROLE_ACCEPTED_WHITELIST;
    else if (type.includes('Police')) roleId = CONFIG.ROLE_ACCEPTED_POLICE;
    else if (type.includes('EMS')) roleId = CONFIG.ROLE_ACCEPTED_EMS;
    else if (type.includes('Gang')) roleId = CONFIG.ROLE_ACCEPTED_GANG;

    if (!roleId) return;

    try {
        await fetch(`https://discord.com/api/v10/guilds/${CONFIG.GUILD_ID}/members/${discordId}/roles/${roleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${CONFIG.DISCORD_BOT_TOKEN}` }
        });
    } catch(e) { console.error("Error assigning role:", e); }
}

async function sendAppWebhook(type, subject, username, details, discordId) {
    const webhookUrl = getWebhookUrl(type);
    if (!webhookUrl) return;

    let appTitle = type;
    if (!appTitle.toLowerCase().includes('application')) {
        appTitle = `${type} Application`;
    }

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `<@${discordId || ''}>`,
                embeds: [{
                    title: `📥 New ${appTitle}`,
                    color: 16711680,
                    fields: [
                        { name: "Subject / Name", value: subject, inline: true },
                        { name: "Submitted By", value: username, inline: true },
                        { name: "Details", value: details || 'N/A', inline: false }
                    ],
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch(e) { console.error("App webhook send error:", e); }
}

async function sendStatusWebhook(ticket, status, reason) {
    const webhookUrl = getWebhookUrl(ticket.type);
    if (!webhookUrl) return;

    const type = ticket.type || 'Application';
    const isAccepted = status === 'accepted';
    const title = isAccepted ? `🎉 ${type} Accepted` : `❌ ${type} Rejected`;
    const color = isAccepted ? 5763719 : 15548997; 
    
    const desc = isAccepted 
        ? `Congratulations <@${ticket.discordId || ''}>! Your application for **${type}** has been ACCEPTED. ✅\n\nWelcome aboard!`
        : `Sorry <@${ticket.discordId || ''}>. Your application for **${type}** has been REJECTED. ❌\n\n**Reason:** ${reason || 'No reason provided.'}\n\n*You can re-apply for this specific department after 24 hours.*`;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `<@${ticket.discordId || ''}>`,
                embeds: [{
                    title: title,
                    description: desc,
                    color: color,
                    fields: [
                        { name: "🛡️ Reviewed By", value: "Staff Team", inline: true },
                        { name: "📅 Date", value: new Date().toLocaleDateString(), inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch(e) { console.error("Status webhook error:", e); }
}

async function sendServerLogWebhook(message, category) {
    const webhookUrl = CONFIG.DISCORD_WEBHOOK_LOGS;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: `📋 Server Log [${category || 'INFO'}]`,
                    description: message,
                    color: 3447003,
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch(e) { console.error("Log webhook error:", e); }
}

// ===== Routes =====

app.get('/api/check-cooldown', (req, res) => {
    const { discordId, type } = req.query;
    if (!discordId || !type) return res.json({ blocked: false });
    
    const db = getDB();
    const lastRejected = (db.tickets || [])
        .filter(t => t.discordId === discordId && t.type === type && t.status === 'rejected')
        .sort((a, b) => b.createdAt - a.createdAt)[0];
        
    if (lastRejected) {
        const hoursPassed = (Date.now() - (lastRejected.createdAt || Date.now())) / (1000 * 60 * 60);
        if (hoursPassed < 24) {
            const hoursLeft = Math.ceil(24 - hoursPassed);
            return res.json({ blocked: true, hoursLeft });
        }
    }
    res.json({ blocked: false });
});

app.post('/api/server-stats', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.stats = { 
        online: req.body.online || true, 
        players: req.body.players || 0, 
        maxPlayers: req.body.maxPlayers || 128, 
        lastUpdate: Date.now() 
    };
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
    players = players.map(p => {
        const stats = (db.playerStats && db.playerStats[p.id]) || { bans: 0, warns: 0, kicks: 0 };
        return { ...p, stats };
    });
    res.json(players);
});

app.post('/api/send-log', async (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.logs.push({ time: new Date().toISOString(), message: req.body.message, category: req.body.category });
    if (db.logs.length > 500) db.logs.shift();
    saveDB(db);

    await sendServerLogWebhook(req.body.message, req.body.category);
    res.json({ success: true });
});

app.get('/api/logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.logs.slice(-150).reverse());
});

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
    
    db.logs.push({ time: new Date().toISOString(), message: `Action: ${type.toUpperCase()} on Player ID ${playerId} | Reason: ${reason || 'N/A'}`, category: 'ADMIN' });
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

app.get('/api/bans', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.bans || []);
});

app.get('/api/detections', isAdmin, (req, res) => {
    const db = getDB();
    res.json(db.detections || []);
});

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

// Tickets & Applications Routes
app.get('/api/tickets', isAdmin, (req, res) => res.json(getDB().tickets || []));

app.post('/api/tickets', async (req, res) => {
    const db = getDB(); 
    if (!db.tickets) db.tickets = [];
    
    const { discordId, type } = req.body;
    
    const lastRejected = (db.tickets || [])
        .filter(t => t.discordId === discordId && t.type === type && t.status === 'rejected')
        .sort((a, b) => b.createdAt - a.createdAt)[0];
        
    if (lastRejected) {
        const hoursPassed = (Date.now() - (lastRejected.createdAt || Date.now())) / (1000 * 60 * 60);
        if (hoursPassed < 24) {
            return res.status(400).json({ error: `You must wait 24 hours before applying for ${type} again.` });
        }
    }

    const username = req.user ? req.user.username : 'Guest';
    const ticket = { 
        id: Date.now().toString(), 
        status: 'pending', 
        user: username,
        createdAt: Date.now(),
        ...req.body 
    };
    db.tickets.push(ticket); 
    saveDB(db); 

    try {
        let parsedMsg = '';
        try {
            let obj = JSON.parse(ticket.message);
            parsedMsg = Object.entries(obj).map(([k, v]) => `**${k}:** ${v}`).join('\n');
        } catch(e) { parsedMsg = ticket.message; }
        
        await sendAppWebhook(ticket.type, ticket.subject, username, parsedMsg, ticket.discordId);
    } catch(e) {}

    res.json(ticket);
});

app.put('/api/tickets/:id', isAdmin, async (req, res) => {
    const db = getDB(); 
    const t = db.tickets.find(x => x.id === req.params.id || x._id === req.params.id);
    if (t) { 
        t.status = req.body.status; 
        t.reason = req.body.reason || ''; 
        saveDB(db); 

        if (t.status === 'accepted') {
            await assignDiscordRole(t.discordId, t.type);
        }

        await sendStatusWebhook(t, t.status, t.reason);
    } 
    res.json(t);
});

app.get('/api/gangs', (req, res) => res.json(getDB().gangs || []));
app.post('/api/gangs', isAdmin, (req, res) => {
    const db = getDB(); if (!db.gangs) db.gangs = [];
    const gang = { id: Date.now().toString(), members: [], ...req.body }; db.gangs.push(gang); saveDB(db); res.json(gang);
});
app.delete('/api/gangs/:id', isAdmin, (req, res) => {
    const db = getDB(); db.gangs = db.gangs.filter(g => g.id !== req.params.id && g._id !== req.params.id); saveDB(db); res.json({ success: true });
});

app.get('/api/shop', (req, res) => res.json(getDB().shop || []));
app.post('/api/shop', isAdmin, (req, res) => {
    const db = getDB(); if (!db.shop) db.shop = [];
    const item = { id: Date.now().toString(), ...req.body }; db.shop.push(item); saveDB(db); res.json(item);
});
app.delete('/api/shop/:id', isAdmin, (req, res) => {
    const db = getDB(); db.shop = db.shop.filter(i => i.id !== req.params.id && i._id !== req.params.id); saveDB(db); res.json({ success: true });
});

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
