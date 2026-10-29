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
const wss = new WebSocket.Server({ server, path: '/ws' }); // نخليوه احتياطي
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true })); 
app.use(express.json({ limit: '50mb' })); // باش نقبلو الصور الكبيرة (Base64)
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

// 🔴 متغيرات للستريم واللاعبين (بدل WebSocket)
let currentPlayers = [];
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

// ===== FiveM Stats =====
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

// ===== 🔴 Routes الجديدة (HTTP بدل WebSocket) =====

// استقبال اللاعبين من فايف إم
app.post('/api/update-players', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    currentPlayers = req.body.players || [];
    res.json({ success: true });
});

// استقبال الصورة من فايف إم
app.post('/api/stream-frame', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const { playerId, frame } = req.body;
    if (playerId && frame) {
        liveFrames[playerId] = frame;
    }
    res.json({ success: true });
});

// استقبال اللوقز من فايف إم (الطريقة الجديدة)
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

// جلب اللاعبين للـ Admin Panel
app.get('/api/players', isAdmin, (req, res) => {
    res.json(currentPlayers);
});

// جلب الصورة للـ Admin Panel
app.get('/api/stream-frame/:id', isAdmin, (req, res) => {
    const frame = liveFrames[req.params.id];
    res.json({ frame: frame || null });
});

// ===== جلب اللوقز =====
app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const db = getDB();
    res.json({ logs: db.fivemLogs.slice(-150).reverse() });
});

app.get('/api/site-logs', isAdmin, (req, res) => res.json(getDB().siteLogs.reverse()));

// ===== Auth Routes =====
app.get('/api/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/?login=failed' }), (req, res) => res.redirect('/?login=success'));
app.get('/api/auth/me', (req, res) => {
  if (req.user) res.json({ loggedIn: true, username: req.user.username, id: req.user.id, avatar: req.user.avatar });
  else res.json({ loggedIn: false });
});
app.get('/api/auth/logout', (req, res) => req.logout(() => res.redirect('/')));
app.get('/api/auth/check-admin', isAdmin, (req, res) => res.json({ isAdmin: true })); 

// ===== Gangs =====
app.get('/api/gangs', (req, res) => res.json(getDB().gangs || []));
app.post('/api/gangs', isAdmin, async (req, res) => { 
  try {
    const db = getDB(); 
    let bossAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
    let underbossAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
    const botToken = CONFIG.DISCORD_BOT_TOKEN;
    if (botToken && req.body.bossId) {
        try { const r1 = await fetch(`https://discord.com/api/v10/users/${req.body.bossId}`, { headers: { Authorization: `Bot ${botToken}` } }); if (r1.ok) { const d1 = await r1.json(); if (d1.avatar) bossAvatar = `https://cdn.discordapp.com/avatars/${req.body.bossId}/${d1.avatar}.${d1.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; } } catch (e) {}
    }
    if (botToken && req.body.underbossId) {
        try { const r2 = await fetch(`https://discord.com/api/v10/users/${req.body.underbossId}`, { headers: { Authorization: `Bot ${botToken}` } }); if (r2.ok) { const d2 = await r2.json(); if (d2.avatar) underbossAvatar = `https://cdn.discordapp.com/avatars/${req.body.underbossId}/${d2.avatar}.${d2.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; } } catch (e) {}
    }
    const gang = { id: Date.now().toString(), name: req.body.name || 'Unknown', logo: req.body.logo || '', boss: req.body.boss || '', bossId: req.body.bossId || '', bossAvatar, underboss: req.body.underboss || '', underbossId: req.body.underbossId || '', underbossAvatar, members: [] };
    db.gangs.push(gang); saveDB(db); addSiteLog('GANG_ADD', req.user ? req.user.username : 'Admin', `Added gang: ${gang.name}`); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/gangs/:id', isAdmin, async (req, res) => { 
  try {
    const db = getDB(); const gang = db.gangs.find(g => g.id === req.params.id);
    if (!gang) return res.status(404).json({ error: 'Gang not found' });
    gang.name = req.body.name || gang.name; gang.logo = req.body.logo || gang.logo; gang.boss = req.body.boss || gang.boss; gang.bossId = req.body.bossId || gang.bossId; gang.underboss = req.body.underboss || gang.underboss; gang.underbossId = req.body.underbossId || gang.underbossId;
    saveDB(db); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/gangs/:id', isAdmin, (req, res) => { const db = getDB(); db.gangs = db.gangs.filter(g => g.id !== req.params.id); saveDB(db); res.json({ success: true }); });
app.post('/api/gangs/:id/members', isAdmin, async (req, res) => { 
  try {
    const db = getDB(); const gang = db.gangs.find(g => g.id === req.params.id);
    if (!gang) return res.status(404).json({ error: 'Gang not found' });
    const discordId = req.body.discordId; const memberName = req.body.memberName || 'Member'; let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
    const botToken = CONFIG.DISCORD_BOT_TOKEN;
    if (botToken && discordId) { try { const discordRes = await fetch(`https://discord.com/api/v10/users/${discordId}`, { headers: { Authorization: `Bot ${botToken}` } }); if (discordRes.ok) { const userData = await discordRes.json(); if (userData.avatar) avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.${userData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; } } catch (e) {} }
    gang.members.push({ discordId: discordId, name: memberName, avatar: avatarUrl }); saveDB(db); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Shop =====
app.get('/api/shop', (req, res) => res.json(getDB().shop));
app.post('/api/shop', isAdmin, (req, res) => { const db = getDB(); const item = { id: Date.now().toString(), ...req.body }; db.shop.push(item); saveDB(db); addSiteLog('SHOP_ADD', req.user ? req.user.username : 'Admin', `Added item: ${item.name}`); res.json(item); });
app.delete('/api/shop/:id', isAdmin, (req, res) => { const db = getDB(); db.shop = db.shop.filter(i => i.id !== req.params.id); saveDB(db); res.json({ success: true }); });

// ===== Tickets & Webhooks =====
app.get('/api/tickets', isAdmin, (req, res) => res.json(getDB().tickets));

app.get('/api/check-cooldown', async (req, res) => {
    const { discordId, type } = req.query;
    if (!discordId || discordId === 'Guest') return res.json({ blocked: false });
    
    const db = getDB();
    const lastRejected = db.tickets
        .filter(t => t.discordId === discordId && t.type === type && t.status === 'rejected')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

    if (lastRejected && lastRejected.createdAt) {
        const timePassed = Date.now() - lastRejected.createdAt;
        const hoursPassed = timePassed / (1000 * 60 * 60);
        if (hoursPassed < 24) {
            const hoursLeft = Math.ceil(24 - hoursPassed);
            return res.json({ blocked: true, hoursLeft: hoursLeft });
        }
    }
    res.json({ blocked: false });
});

app.post('/api/tickets', async (req, res) => { 
    try {
        const db = getDB(); 
        const discordId = req.body.discordId || 'Guest';
        const type = req.body.type;
        
        if (discordId !== 'Guest') {
            const lastRejected = db.tickets
                .filter(t => t.discordId === discordId && t.type === type && t.status === 'rejected')
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

            if (lastRejected && lastRejected.createdAt) {
                const timePassed = Date.now() - lastRejected.createdAt;
                const hoursPassed = timePassed / (1000 * 60 * 60);
                if (hoursPassed < 24) {
                    const hoursLeft = Math.ceil(24 - hoursPassed);
                    return res.status(403).json({ error: `You must wait ${hoursLeft} hours before applying for ${type} again.` });
                }
            }
        }

        const ticket = { 
            id: Date.now().toString(), status: 'pending', reason: '', 
            user: req.user ? req.user.username : 'Guest', 
            discordId: discordId, 
            createdAt: Date.now(),
            ...req.body 
        }; 
        db.tickets.push(ticket); saveDB(db); 
        addSiteLog('TICKET_NEW', ticket.user, `Submitted ${ticket.type}`);

        if (ticket.discordId && ticket.discordId !== 'Guest' && CONFIG.ROLE_WAITING_ID) {
            try {
                const botToken = CONFIG.DISCORD_BOT_TOKEN;
                const guildId = CONFIG.GUILD_ID;
                if (botToken && guildId) {
                    await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${ticket.discordId}/roles/${CONFIG.ROLE_WAITING_ID}`, {
                        method: 'PUT', headers: { Authorization: `Bot ${botToken}` }
                    });
                }
            } catch (err) { console.error(err); }
        }
        res.json(ticket); 
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tickets/:id', isAdmin, async (req, res) => {
  const db = getDB(); 
  const t = db.tickets.find(x => x.id === req.params.id);
  
  if (t) { 
    t.status = req.body.status; 
    t.reason = req.body.reason || ''; 
    saveDB(db); 
    addSiteLog('TICKET_UPDATE', req.user ? req.user.username : 'Admin', `Ticket ${t.type} ${t.status.toUpperCase()}`);

    const userMention = t.discordId && t.discordId !== 'Guest' ? `<@${t.discordId}>` : `**${t.user}**`;
    let webhookURL = CONFIG.WEBHOOK_WHITELIST;
    let embed = {};
    let gangName = "";

    if (t.type.includes("Gang")) {
        webhookURL = CONFIG.WEBHOOK_GANG;
        try { let parsed = JSON.parse(t.message); gangName = parsed.gang_name || "Unknown Gang"; } catch(e) {}
    } else if (t.type.includes("Police")) {
        webhookURL = CONFIG.WEBHOOK_POLICE;
    } else if (t.type.includes("EMS")) {
        webhookURL = CONFIG.WEBHOOK_EMS;
    }

    if (t.status === 'accepted') {
        if (t.type.includes("Gang")) {
            embed = { title: "🔔 Gang Application Accepted", description: `Congratulations ${userMention}!\nYour gang application has been ACCEPTED ✅\n\n**${gangName}**\n\nPlease contact the <@&${CONFIG.ADMIN_ROLE_ID}> to receive your roles and complete the final setup.\n\nGood luck and represent your gang with pride.`, color: 0x2ecc71, footer: { text: "SouthSide S2 | Roleplay" } };
        } else if (t.type.includes("Police")) {
            embed = { title: "👮‍♂️ Police Application Accepted", description: `Congratulations ${userMention}!\nYour application for the **Police Department** has been ACCEPTED ✅\n\nWelcome to the force, Officer!\nPlease contact the PD High Command for your interview and training.`, color: 0x3498db, footer: { text: "SouthSide S2 | Police Dept" } };
        } else if (t.type.includes("EMS")) {
            embed = { title: "🚑 EMS Application Accepted", description: `Congratulations ${userMention}!\nYour application for **EMS** has been ACCEPTED ✅\n\nWelcome to the medical team!\nPlease contact the EMS Chief for your uniform and duty protocols.`, color: 0xe74c3c, footer: { text: "SouthSide S2 | EMS Dept" } };
        } else {
            embed = { title: "✅ Whitelist Accepted", description: `Congratulations ${userMention}!\nYour Whitelist application has been ACCEPTED ✅\n\nWelcome to SouthSide S2! You can now connect to the server using the IP provided on the website.`, color: 0x2ecc71, footer: { text: "SouthSide S2 | Roleplay" } };
        }
    } else if (t.status === 'rejected') {
        if (t.type.includes("Gang")) {
            embed = { title: "❌ Gang Application Rejected", description: `${userMention}\n\n${gangName}\n\nYour application has been rejected because:\n**${t.reason}**\n\nBetter luck next time!`, color: 0xe74c3c, footer: { text: "SouthSide S2 | Roleplay" } };
        } else if (t.type.includes("Police")) {
            embed = { title: "❌ Police Application Rejected", description: `Sorry ${userMention}, your application for the **Police Department** has been REJECTED ❌\n\n**Reason:** ${t.reason}\n\nYou can re-apply in 24 hours.`, color: 0xe74c3c, footer: { text: "SouthSide S2 | Police Dept" } };
        } else if (t.type.includes("EMS")) {
            embed = { title: "❌ EMS Application Rejected", description: `Sorry ${userMention}, your application for **EMS** has been REJECTED ❌\n\n**Reason:** ${t.reason}\n\nYou can re-apply in 24 hours.`, color: 0xe74c3c, footer: { text: "SouthSide S2 | EMS Dept" } };
        } else {
            embed = { title: "❌ Whitelist Rejected", description: `Sorry ${userMention}, your Whitelist application has been REJECTED ❌\n\n**Reason:** ${t.reason}\n\nYou can re-apply in 24 hours.`, color: 0xe74c3c, footer: { text: "SouthSide S2 | Roleplay" } };
        }
    }

    // 🔴 بعثان الويب هوك
    if (webhookURL && embed.title) {
        try {
            await fetch(webhookURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: userMention, embeds: [embed] }) });
        } catch (error) { console.error("Webhook Error:", error); }
    }

    // 🔴 تحديث الرتب
    if (t.discordId && t.discordId !== 'Guest') {
        const botToken = CONFIG.DISCORD_BOT_TOKEN;
        const guildId = CONFIG.GUILD_ID;
        if (botToken && guildId) {
            try {
                const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${t.discordId}`, { headers: { Authorization: `Bot ${botToken}` } });
                if (memberRes.ok) {
                    const memberData = await memberRes.json();
                    let currentRoles = memberData.roles || []; 
                    if (t.status === 'accepted' && CONFIG.ROLE_ACCEPTED_ID) {
                        if (!currentRoles.includes(CONFIG.ROLE_ACCEPTED_ID)) currentRoles.push(CONFIG.ROLE_ACCEPTED_ID);
                        if (CONFIG.ROLE_WAITING_ID) currentRoles = currentRoles.filter(r => r !== CONFIG.ROLE_WAITING_ID);
                    } else if (t.status === 'rejected' && CONFIG.ROLE_WAITING_ID) {
                        currentRoles = currentRoles.filter(r => r !== CONFIG.ROLE_WAITING_ID);
                    }
                    await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${t.discordId}`, {
                        method: 'PATCH', headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roles: currentRoles })
                    });
                }
            } catch (err) { console.error(err); }
        }
    }
  }
  res.json(t);
});

app.post('/api/admin-login', (req, res) => {
  if (req.body.password === CONFIG.ADMIN_PASSWORD) { req.session.isAdmin = true; res.json({ success: true }); } 
  else { res.status(401).json({ success: false }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
