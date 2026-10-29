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
// ⚠️ حط بياناتك هنا (بدل اللي بين '...')
// ==========================================
const CONFIG = {
  SESSION_SECRET: 'southside_secret_xyz123', 
  ADMIN_PASSWORD: 'adminpassword123', // للاحتياط كان دخلت بالباسوورد
  ADMIN_DISCORD_ID: '123456789012345678', // الـ ID متاعك (باش تبقى أدمين دايما حتى لو تبدلت الرتبة)
  
  // --- 🔴 الحوايج الجديدة متاع الرتبة ---
  GUILD_ID: '123456789012345678', // 🔴 ID متاع سيرفر الديسكورد متاعك
  ADMIN_ROLE_ID: '987654321098765432', // 🔴 ID متاع رتبة الـ Admin في الديسكورد
  
  DISCORD_CLIENT_ID: '1234567890', 
  DISCORD_CLIENT_SECRET: 'abcdefg123456', 
  DISCORD_BOT_TOKEN: 'MTIzNDU2Nzg5...', 
  DISCORD_CALLBACK_URL: 'https://your-app-name.onrender.com/api/auth/discord/callback', 
  
  FIVEM_IP: '127.0.0.1',
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
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

// ===== Discord Auth (زدنا guilds باش نقراو الرتب) =====
const DiscordStrategy = require('passport-discord').Strategy;
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new DiscordStrategy({
  clientID: CONFIG.DISCORD_CLIENT_ID,
  clientSecret: CONFIG.DISCORD_CLIENT_SECRET,
  callbackURL: CONFIG.DISCORD_CALLBACK_URL,
  scope: ['identify', 'guilds'] // 🔴 زدنا guilds هنا
}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken; // نحتفظو بالتوكن باش نستعملوه بعد
  done(null, profile);
}));

app.use(passport.initialize());
app.use(passport.session());

// ===== 🔴 دالة الحماية الجديدة (تتشيك على الرتبة) =====
async function isAdmin(req, res, next) {
  // 1. إلا كان دخل بالباسوورد (Session)
  if (req.session && req.session.isAdmin) return next();

  // 2. إلا كان دخل بـ Discord
  if (req.user && req.user.accessToken) {
    // إلا كان هو صاحب السيرفر (Admin Discord ID)
    if (req.user.id === CONFIG.ADMIN_DISCORD_ID) return next();

    try {
      // نجيبو الرتب متاع اللاعب في السيرفر
      const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${CONFIG.GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${req.user.accessToken}` }
      });

      if (response.ok) {
        const memberData = await response.json();
        // نتشيكو هل اللاعب عنده الرتبة
        if (memberData.roles && memberData.roles.includes(CONFIG.ADMIN_ROLE_ID)) {
          return next(); // ✅ عنده الرتبة، ينجم يعدي
        }
      }
    } catch (error) {
      console.error("Error checking role:", error);
    }
  }

  // إلا ما كانش أدمين
  res.status(403).json({ error: 'Access Denied. Admins only.' });
}

// ===== FiveM Stats =====
app.get('/api/stats', async (req, res) => {
    // ... (كود الاحصائيات متاعك كيما هو، ما تبدلش فيه) ...
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
// (كود العصابات متاعك كيما هو، ما تبدلش فيه، خليه كيما عطيتك في المرة اللي فاتت)
// ...

// ===== Shop =====
// (كود الشوب متاعك كيما هو)
// ...

// ===== Tickets =====
app.get('/api/tickets', isAdmin, (req, res) => res.json(getDB().tickets)); // 🔒 محمية بالرتبة
app.post('/api/tickets', (req, res) => {
  const db = getDB();
  const ticket = { id: Date.now().toString(), status: 'pending', reason: '', user: req.user ? req.user.username : 'Guest', ...req.body };
  db.tickets.push(ticket); saveDB(db); res.json(ticket);
});
app.put('/api/tickets/:id', isAdmin, (req, res) => { // 🔒 محمية بالرتبة
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
