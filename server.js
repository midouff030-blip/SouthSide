const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true })); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ✅ قراءة المفاتيح من Render
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
  DISCORD_WEBHOOK_RESULTS: process.env.DISCORD_WEBHOOK_RESULTS, 
  DISCORD_WEBHOOK_LOGS: process.env.DISCORD_WEBHOOK_LOGS, 
  FIVEM_IP: process.env.FIVEM_IP || '127.0.0.1',
  FIVEM_PORT: process.env.FIVEM_PORT || '30120',
  FIVEM_LOG_PATH: process.env.FIVEM_LOG_PATH || './fivem.log',
  FIVEM_LOG_KEY: process.env.FIVEM_LOG_KEY || 'secret_key',
  
  ROLE_ACCEPTED_ID: process.env.ROLE_ACCEPTED_ID, 
  ROLE_WAITING_ID: process.env.ROLE_WAITING_ID    
};

// ===== Database =====
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [] }, null, 2));
}
const getDB = () => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    if (!db.gangs) db.gangs = [];
    if (!db.shop) db.shop = [];
    if (!db.tickets) db.tickets = [];
    return db;
};
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// ===== Sessions =====
app.use(session({
  secret: CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, 
  cookie: { 
    secure: true, 
    sameSite: 'none', 
    maxAge: 24 * 60 * 60 * 1000 
  }
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

// ===== 🔴 الحماية بالرتبة أو بالباسورد =====
async function isAdmin(req, res, next) {
  if (req.headers['x-admin-password'] && req.headers['x-admin-password'] === CONFIG.ADMIN_PASSWORD) {
      return next();
  }
  if (req.session && req.session.isAdmin) return next(); 
  
  if (req.user && req.user.id) {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${CONFIG.GUILD_ID}/members/${req.user.id}`, {
        headers: { Authorization: `Bot ${CONFIG.DISCORD_BOT_TOKEN}` }
      });
      if (response.ok) {
        const memberData = await response.json();
        if (memberData.roles && memberData.roles.includes(CONFIG.ADMIN_ROLE_ID)) {
          return next(); 
        }
      }
    } catch (e) { console.error("Role check error:", e); }
  }
  res.status(403).json({ error: 'Access Denied. Admins only.' });
}

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

// ===== 📥 استقبال اللوقز من FiveM =====
app.post('/api/fivem-logs', (req, res) => {
    if (req.body.key !== CONFIG.FIVEM_LOG_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const logData = req.body.log;
    if (!logData) return res.status(400).json({ error: 'No log data' });
    const logFilePath = CONFIG.FIVEM_LOG_PATH;
    try {
        fs.appendFileSync(logFilePath, `[${new Date().toLocaleTimeString()}] ${logData}\n`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not write log' });
    }
});

// ===== 🚔 قراءة اللوقز للوحة التحكم =====
app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const logFilePath = CONFIG.FIVEM_LOG_PATH;
    if (!fs.existsSync(logFilePath)) {
        return res.json({ error: `Log file not found at: ${logFilePath}` });
    }
    try {
        const logs = fs.readFileSync(logFilePath, 'utf8').split('\n').reverse();
        const last150Logs = logs.filter(line => line.trim() !== '').slice(0, 150);
        res.json({ logs: last150Logs });
    } catch (err) {
        res.status(500).json({ error: "Error reading log file." });
    }
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
    db.gangs.push(gang); saveDB(db); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/gangs/:id', isAdmin, async (req, res) => { 
  try {
    const db = getDB(); const gang = db.gangs.find(g => g.id === req.params.id);
    if (!gang) return res.status(404).json({ error: 'Gang not found' });
    gang.name = req.body.name || gang.name; gang.logo = req.body.logo || gang.logo; gang.boss = req.body.boss || gang.boss; gang.bossId = req.body.bossId || gang.bossId; gang.underboss = req.body.underboss || gang.underboss; gang.underbossId = req.body.underbossId || gang.underbossId;
    const botToken = CONFIG.DISCORD_BOT_TOKEN;
    if (botToken) {
        if (gang.bossId) { try { const r1 = await fetch(`https://discord.com/api/v10/users/${gang.bossId}`, { headers: { Authorization: `Bot ${botToken}` } }); if (r1.ok) { const d1 = await r1.json(); if (d1.avatar) gang.bossAvatar = `https://cdn.discordapp.com/avatars/${gang.bossId}/${d1.avatar}.${d1.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; } } catch (e) {} }
        if (gang.underbossId) { try { const r2 = await fetch(`https://discord.com/api/v10/users/${gang.underbossId}`, { headers: { Authorization: `Bot ${botToken}` } }); if (r2.ok) { const d2 = await r2.json(); if (d2.avatar) gang.underbossAvatar = `https://cdn.discordapp.com/avatars/${gang.underbossId}/${d2.avatar}.${d2.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; } } catch (e) {} }
    }
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
app.post('/api/shop', isAdmin, (req, res) => { const db = getDB(); const item = { id: Date.now().toString(), ...req.body }; db.shop.push(item); saveDB(db); res.json(item); });
app.delete('/api/shop/:id', isAdmin, (req, res) => { const db = getDB(); db.shop = db.shop.filter(i => i.id !== req.params.id); saveDB(db); res.json({ success: true }); });

// ===== Tickets =====
app.get('/api/tickets', isAdmin, (req, res) => res.json(getDB().tickets));

// ✅ إنشاء Ticket مع إضافة الرتبة الأوتوماتيكية
app.post('/api/tickets', async (req, res) => { 
    try {
        const db = getDB(); 
        const ticket = { 
            id: Date.now().toString(), 
            status: 'pending', 
            reason: '', 
            user: req.user ? req.user.username : 'Guest', 
            discordId: req.body.discordId || 'Guest', 
            ...req.body 
        }; 
        db.tickets.push(ticket); 
        saveDB(db); 

        // 🔴 إضافة رتبة "Waiting for Interview"
        if (ticket.discordId && ticket.discordId !== 'Guest' && CONFIG.ROLE_WAITING_ID) {
            console.log(`[DISCORD API] Attempting to ADD Waiting Role (${CONFIG.ROLE_WAITING_ID}) to User: ${ticket.discordId}`);
            try {
                const botToken = CONFIG.DISCORD_BOT_TOKEN;
                const guildId = CONFIG.GUILD_ID;
                if (botToken && guildId) {
                    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${ticket.discordId}/roles/${CONFIG.ROLE_WAITING_ID}`, {
                        method: 'PUT',
                        headers: { Authorization: `Bot ${botToken}` }
                    });
                    if (response.ok) {
                        console.log(`✅ [SUCCESS] Waiting Role ADDED to ${ticket.discordId}`);
                    } else {
                        const errData = await response.text();
                        console.error(`❌ [FAILED] Could not add Waiting Role. Discord API Response: ${response.status} - ${errData}`);
                    }
                }
            } catch (err) {
                console.error("❌ [ERROR] Exception while adding waiting role:", err);
            }
        }

        res.json(ticket); 
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/tickets/:id', isAdmin, async (req, res) => {
  const db = getDB(); 
  const t = db.tickets.find(x => x.id === req.params.id);
  
  if (t) { 
    t.status = req.body.status; 
    t.reason = req.body.reason || ''; 
    saveDB(db); 

    const webhookResults = CONFIG.DISCORD_WEBHOOK_RESULTS;
    const webhookLogs = CONFIG.DISCORD_WEBHOOK_LOGS;
    const userMention = t.discordId && t.discordId !== 'Guest' ? `<@${t.discordId}>` : `**${t.user}**`;

    // ✅ إضافة رتبة "Accepted" كي يتقبل (مع حماية لكل خطوة)
    if (t.status === 'accepted' && t.discordId && t.discordId !== 'Guest' && CONFIG.ROLE_ACCEPTED_ID) {
        const botToken = CONFIG.DISCORD_BOT_TOKEN;
        const guildId = CONFIG.GUILD_ID;

        if (botToken && guildId) {
            // 1. نعطيوه رتبة Accepted أولاً
            console.log(`[DISCORD API] Attempting to ADD Accepted Role (${CONFIG.ROLE_ACCEPTED_ID}) to User: ${t.discordId}`);
            let acceptedSuccess = false;
            try {
                const resAdd = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${t.discordId}/roles/${CONFIG.ROLE_ACCEPTED_ID}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bot ${botToken}` }
                });
                if (resAdd.ok) {
                    console.log(`✅ [SUCCESS] Accepted Role ADDED to ${t.discordId}`);
                    acceptedSuccess = true;
                } else {
                    const errData = await resAdd.text();
                    console.error(`❌ [FAILED] Could not add Accepted Role. Discord API Response: ${resAdd.status} - ${errData}`);
                }
            } catch (err) {
                console.error("❌ [ERROR] Exception while adding accepted role:", err);
            }

            // 2. نحّيو رتبة Waiting (كان كان الـ Accepted تزادت بنجاح برك)
            if (acceptedSuccess && CONFIG.ROLE_WAITING_ID) {
                console.log(`[DISCORD API] Attempting to REMOVE Waiting Role (${CONFIG.ROLE_WAITING_ID}) from User: ${t.discordId}`);
                try {
                    const resDel = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${t.discordId}/roles/${CONFIG.ROLE_WAITING_ID}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bot ${botToken}` }
                    });
                    if (resDel.ok) {
                        console.log(`✅ [SUCCESS] Waiting Role REMOVED from ${t.discordId}`);
                    } else {
                        const errData = await resDel.text();
                        console.error(`❌ [FAILED] Could not remove Waiting Role. Discord API Response: ${resDel.status} - ${errData}`);
                    }
                } catch (err) {
                    console.error("❌ [ERROR] Exception while removing waiting role:", err);
                }
            } else if (!acceptedSuccess) {
                console.log(`⚠️ [SKIPPED] Waiting Role not removed because Accepted Role failed to add.`);
            }
        }
    }

    // ✅ نحّيو رتبة "Waiting" كي يترفض
    if (t.status === 'rejected' && t.discordId && t.discordId !== 'Guest' && CONFIG.ROLE_WAITING_ID) {
        try {
            const botToken = CONFIG.DISCORD_BOT_TOKEN;
            const guildId = CONFIG.GUILD_ID;
            if (botToken && guildId) {
                const resDel = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${t.discordId}/roles/${CONFIG.ROLE_WAITING_ID}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bot ${botToken}` }
                });
                if (resDel.ok) {
                    console.log(`✅ [SUCCESS] Waiting Role REMOVED (Rejected) from ${t.discordId}`);
                } else {
                    console.error(`❌ [FAILED] Could not remove Waiting Role (Rejected).`);
                }
            }
        } catch (err) {
            console.error("❌ [ERROR] Error removing waiting role:", err);
        }
    }

    // ===== Webhooks (Logs + Results) =====
    if (webhookLogs) {
        const logEmbed = {
            title: `Ticket ${t.status.toUpperCase()}: ${t.type}`,
            description: `**User:** ${userMention} (\`${t.discordId || 'N/A'}\`)\n**Action:** ${t.status.toUpperCase()}\n**Reason:** ${t.reason || 'None'}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            color: t.status === 'accepted' ? 0x2ecc71 : 0xe74c3c,
            footer: { text: "SouthSide S2 | Logs" }
        };
        try {
            await fetch(webhookLogs, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [logEmbed] })
            });
        } catch (error) { console.error("Log Webhook Error:", error); }
    }

    if (webhookResults) {
        let resultEmbed = {};
        if (t.status === 'accepted') {
            resultEmbed = {
                title: "✅ Whitelist (Citizen) Accepted",
                description: `Congratulations ${userMention}! Your application for **${t.type}** has been **ACCEPTED**.\n\nWelcome aboard!`,
                color: 0x2ecc71,
                fields: [
                    { name: "🛡️ Reviewed By", value: "Staff Team", inline: true },
                    { name: "📅 Date", value: new Date().toLocaleDateString(), inline: true }
                ],
                footer: { text: "SouthSide S2 | Roleplay" }
            };
        } else if (t.status === 'rejected') {
            resultEmbed = {
                title: "❌ Whitelist (Citizen) Rejected",
                description: `Sorry ${userMention}, your application for **${t.type}** has been **REJECTED**.\n\n**Reason:** ${t.reason}`,
                color: 0xe74c3c,
                fields: [
                    { name: "🛡️ Reviewed By", value: "Staff Team", inline: true },
                    { name: "📅 Date", value: new Date().toLocaleDateString(), inline: true }
                ],
                footer: { text: "SouthSide S2 | Roleplay" }
            };
        }

        try {
            await fetch(webhookResults, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: userMention,
                    embeds: [resultEmbed]
                })
            });
        } catch (error) { console.error("Result Webhook Error:", error); }
    }
  }
  res.json(t);
});

// ===== Admin =====
app.post('/api/admin-login', (req, res) => {
  if (req.body.password === CONFIG.ADMIN_PASSWORD) { req.session.isAdmin = true; res.json({ success: true }); } 
  else { res.status(401).json({ success: false }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
