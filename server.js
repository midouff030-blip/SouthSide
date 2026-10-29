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
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ⚠️ حط بياناتك هنا مباشرة (بلا .env)
// ==========================================
const CONFIG = {
  SESSION_SECRET: 'southside-secret-123', // أي كلمة سر
  ADMIN_PASSWORD: 'admin123', // الباسوورد اللي باش تدخل بيها للـ Admin
  ADMIN_DISCORD_ID: '123456789012345678', // 🔴 حط الـ ID متاعك هنا
  
  DISCORD_CLIENT_ID: 'your_client_id', // 🔴 حط الـ Client ID
  DISCORD_CLIENT_SECRET: 'your_client_secret', // 🔴 حط الـ Client Secret
  DISCORD_CALLBACK_URL: 'https://your-app.onrender.com/api/auth/discord/callback', // 🔴 بدّل بالرابط متاعك
  DISCORD_BOT_TOKEN: 'your_bot_token', // 🔴 حط التوكن متاع البوت
  
  FIVEM_IP: '127.0.0.1', // 🔴 بدّلها بـ IP متاع السيرفر
  FIVEM_PORT: '30120'
};

// ===== Database =====
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [] }, null, 2));
}
const getDB = () => JSON.parse(fs.readFileSync(dbPath));
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
  scope: ['identify']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// ===== Admin Protection =====
function isAdmin(req, res, next) {
  if (req.user && req.user.id === CONFIG.ADMIN_DISCORD_ID) {
    return next();
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

// ===== Auth Routes =====
app.get('/api/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/?login=failed' }), (req, res) => res.redirect('/?login=success'));
app.get('/api/auth/me', (req, res) => {
  if (req.user) res.json({ loggedIn: true, username: req.user.username, id: req.user.id, avatar: req.user.avatar });
  else res.json({ loggedIn: false });
});
app.get('/api/auth/logout', (req, res) => req.logout(() => res.redirect('/')));

// ===== Gangs =====
app.get('/api/gangs', (req, res) => res.json(getDB().gangs || []));

app.post('/api/gangs', isAdmin, async (req, res) => {
  try {
    const db = getDB(); if (!db.gangs) db.gangs = [];
    let bossAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
    let underbossAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
    const botToken = CONFIG.DISCORD_BOT_TOKEN;

    if (botToken && req.body.bossId) {
        try {
            const res1 = await fetch(`https://discord.com/api/v10/users/${req.body.bossId}`, { headers: { Authorization: `Bot ${botToken}` } });
            if (res1.ok) { const data1 = await res1.json(); if (data1.avatar) { const ext = data1.avatar.startsWith('a_') ? 'gif' : 'png'; bossAvatar = `https://cdn.discordapp.com/avatars/${req.body.bossId}/${data1.avatar}.${ext}?size=256`; } }
        } catch (e) {}
    }

    if (botToken && req.body.underbossId) {
        try {
            const res2 = await fetch(`https://discord.com/api/v10/users/${req.body.underbossId}`, { headers: { Authorization: `Bot ${botToken}` } });
            if (res2.ok) { const data2 = await res2.json(); if (data2.avatar) { const ext = data2.avatar.startsWith('a_') ? 'gif' : 'png'; underbossAvatar = `https://cdn.discordapp.com/avatars/${req.body.underbossId}/${data2.avatar}.${ext}?size=256`; } }
        } catch (e) {}
    }

    const gang = { 
        id: Date.now().toString(), name: req.body.name || 'Unknown', logo: req.body.logo || '',
        boss: req.body.boss || '', bossId: req.body.bossId || '', bossAvatar: bossAvatar,
        underboss: req.body.underboss || '', underbossId: req.body.underbossId || '', underbossAvatar: underbossAvatar,
        members: [] 
    };
    db.gangs.push(gang); saveDB(db); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gangs/:id', isAdmin, async (req, res) => {
  try {
    const db = getDB(); 
    const gang = db.gangs.find(g => g.id === req.params.id);
    if (!gang) return res.status(404).json({ error: 'Gang not found' });
    
    gang.name = req.body.name || gang.name;
    gang.logo = req.body.logo || gang.logo;
    gang.boss = req.body.boss || gang.boss;
    gang.bossId = req.body.bossId || gang.bossId;
    gang.underboss = req.body.underboss || gang.underboss;
    gang.underbossId = req.body.underbossId || gang.underbossId;

    const botToken = CONFIG.DISCORD_BOT_TOKEN;
    if (botToken) {
        if (gang.bossId) {
            try {
                const r1 = await fetch(`https://discord.com/api/v10/users/${gang.bossId}`, { headers: { Authorization: `Bot ${botToken}` } });
                if (r1.ok) { const d1 = await r1.json(); if (d1.avatar) gang.bossAvatar = `https://cdn.discordapp.com/avatars/${gang.bossId}/${d1.avatar}.${d1.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; }
            } catch (e) {}
        }
        if (gang.underbossId) {
            try {
                const r2 = await fetch(`https://discord.com/api/v10/users/${gang.underbossId}`, { headers: { Authorization: `Bot ${botToken}` } });
                if (r2.ok) { const d2 = await r2.json(); if (d2.avatar) gang.underbossAvatar = `https://cdn.discordapp.com/avatars/${gang.underbossId}/${d2.avatar}.${d2.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`; }
            } catch (e) {}
        }
    }

    saveDB(db); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gangs/:id', isAdmin, (req, res) => {
  const db = getDB(); db.gangs = db.gangs.filter(g => g.id !== req.params.id);
  saveDB(db); res.json({ success: true });
});

app.post('/api/gangs/:id/members', isAdmin, async (req, res) => {
  try {
    const db = getDB(); 
    const gang = db.gangs.find(g => g.id === req.params.id);
    if (!gang) return res.status(404).json({ error: 'Gang not found' });

    const discordId = req.body.discordId;
    const memberName = req.body.memberName || 'Member';
    let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';

    const botToken = CONFIG.DISCORD_BOT_TOKEN;
    if (botToken && discordId) {
        try {
            const discordRes = await fetch(`https://discord.com/api/v10/users/${discordId}`, { headers: { Authorization: `Bot ${botToken}` } });
            if (discordRes.ok) {
                const userData = await discordRes.json();
                if (userData.avatar) {
                    const ext = userData.avatar.startsWith('a_') ? 'gif' : 'png';
                    avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.${ext}?size=256`;
                }
            }
        } catch (e) {}
    }

    gang.members.push({ discordId: discordId, name: memberName, avatar: avatarUrl }); 
    saveDB(db); res.json(gang);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Shop =====
app.get('/api/shop', (req, res) => res.json(getDB().shop));
app.post('/api/shop', isAdmin, (req, res) => {
  const db = getDB(); const item = { id: Date.now().toString(), ...req.body };
  db.shop.push(item); saveDB(db); res.json(item);
});
app.delete('/api/shop/:id', isAdmin, (req, res) => {
  const db = getDB(); db.shop = db.shop.filter(i => i.id !== req.params.id);
  saveDB(db); res.json({ success: true });
});

// ===== Tickets =====
app.get('/api/tickets', isAdmin, (req, res) => res.json(getDB().tickets));
app.post('/api/tickets', (req, res) => {
  const db = getDB();
  const ticket = { id: Date.now().toString(), status: 'pending', reason: '', user: req.user ? req.user.username : 'Guest', ...req.body };
  db.tickets.push(ticket); saveDB(db); res.json(ticket);
});
app.put('/api/tickets/:id', isAdmin, (req, res) => {
  const db = getDB(); const t = db.tickets.find(x => x.id === req.params.id);
  if (t) { t.status = req.body.status; t.reason = req.body.reason || ''; saveDB(db); }
  res.json(t);
});

// ===== Admin =====
app.post('/api/admin-login', (req, res) => {
  if (req.body.password === CONFIG.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
