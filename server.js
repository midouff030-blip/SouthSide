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
  
  // 🔴 Webhooks لكل قسم
  WEBHOOK_WHITELIST: process.env.WEBHOOK_WHITELIST, 
  WEBHOOK_GANG: process.env.WEBHOOK_GANG,
  WEBHOOK_POLICE: process.env.WEBHOOK_POLICE,
  WEBHOOK_EMS: process.env.WEBHOOK_EMS,
  DISCORD_WEBHOOK_LOGS: process.env.DISCORD_WEBHOOK_LOGS, // لوغز الأدمن
  
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
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [], siteLogs: [] }, null, 2));
}
const getDB = () => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    if (!db.gangs) db.gangs = [];
    if (!db.shop) db.shop = [];
    if (!db.tickets) db.tickets = [];
    if (!db.siteLogs) db.siteLogs = [];
    return db;
};
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// دالة تسجيل اللوقز في السيت
const addSiteLog = (action, user, details) => {
    const db = getDB();
    db.siteLogs.push({ time: new Date().toISOString(), action, user, details });
    if (db.siteLogs.length > 500) db.siteLogs.shift(); // نمسحو القديم
    saveDB(db);
};

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

// ===== FiveM Stats & Logs =====
app.get('/api/stats', async (req, res) => { /* ... الكود القديم متاع الفايف إم ... */ });
app.post('/api/fivem-logs', (req, res) => { /* ... الكود القديم ... */ });
app.get('/api/fivem-logs', isAdmin, (req, res) => {
    const logFilePath = CONFIG.FIVEM_LOG_PATH;
    if (!fs.existsSync(logFilePath)) return res.json({ error: `Log file not found.` });
    try {
        const logs = fs.readFileSync(logFilePath, 'utf8').split('\n').reverse();
        res.json({ logs: logs.filter(line => line.trim() !== '').slice(0, 150) });
    } catch (err) { res.status(500).json({ error: "Error reading log file." }); }
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

// ===== Gangs, Shop, etc. (كود قديم، أنا اختصرتو باش نركز على المهم) =====
// ... (حط الكود القديم متاع Gangs و Shop هنا) ...

// ===== Tickets & Webhooks =====
app.get('/api/tickets', isAdmin, (req, res) => res.json(getDB().tickets));

app.post('/api/tickets', async (req, res) => { 
    try {
        const db = getDB(); 
        const ticket = { 
            id: Date.now().toString(), status: 'pending', reason: '', 
            user: req.user ? req.user.username : 'Guest', 
            discordId: req.body.discordId || 'Guest', ...req.body 
        }; 
        db.tickets.push(ticket); saveDB(db); 

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

    const userMention = t.discordId && t.discordId !== 'Guest' ? `<@${t.discordId}>` : `**${t.user}**`;
    let webhookURL = CONFIG.WEBHOOK_WHITELIST; // الافتراضي
    let embed = {};

    // 🔴 اختيار الويب هوك والرسالة حسب نوع التطبيق
    if (t.type.includes("Gang")) webhookURL = CONFIG.WEBHOOK_GANG;
    else if (t.type.includes("Police")) webhookURL = CONFIG.WEBHOOK_POLICE;
    else if (t.type.includes("EMS")) webhookURL = CONFIG.WEBHOOK_EMS;

    let gangName = "";
    if (t.type.includes("Gang")) {
        try { 
            let parsed = JSON.parse(t.message); 
            gangName = parsed.gang_name || "Unknown Gang"; 
        } catch(e) {}
    }

    // 🔴 تنسيق الرسالة (كيما الصور)
    if (t.status === 'accepted') {
        embed = {
            title: t.type.includes("Gang") ? "🔔 Gang Application Accepted" : "✅ Whitelist Accepted",
            description: t.type.includes("Gang") 
                ? `Congratulations ${userMention}!\nYour gang application has been ACCEPTED ✅\n\n**${gangName}**\n\nPlease contact the <@&${CONFIG.ADMIN_ROLE_ID}> to receive your roles and complete the final setup.\n\nGood luck and represent your gang with pride.`
                : `Congratulations ${userMention}! Your application for **${t.type}** has been **ACCEPTED**.\n\nWelcome aboard!`,
            color: 0x2ecc71,
            footer: { text: "SouthSide S2 | Roleplay" }
        };
    } else if (t.status === 'rejected') {
        embed = {
            title: t.type.includes("Gang") ? "❌ Gang Application Rejected" : "❌ Whitelist Rejected",
            description: t.type.includes("Gang")
                ? `${userMention}\n\n${gangName}\n\nYour application has been rejected because:\n**${t.reason}**\n\nPlease provide a detailed backstory and complete all required information before submitting a new application.\n\nBetter luck next time!`
                : `Sorry ${userMention}, your application for **${t.type}** has been **REJECTED**.\n\n**Reason:** ${t.reason}`,
            color: 0xe74c3c,
            footer: { text: "SouthSide S2 | Roleplay" }
        };
    }

    // نبعثو الويب هوك للقناة المناسبة
    if (webhookURL && embed.title) {
        try {
            await fetch(webhookURL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: userMention, embeds: [embed] })
            });
        } catch (error) { console.error("Webhook Error:", error); }
    }

    // 🔴 تحديث الرتب في الديسكورد
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

// 🔴 Route لجلب Site Logs
app.get('/api/site-logs', isAdmin, (req, res) => {
    res.json(getDB().siteLogs.reverse()); // نرجعوهم من الجديد للقديم
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
