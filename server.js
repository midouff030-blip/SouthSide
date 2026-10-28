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

// ===== Database =====
const dbPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [], gangs: [], streamers: [] }, null, 2));
}
const getDB = () => JSON.parse(fs.readFileSync(dbPath));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// ===== Sessions =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'southside-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'none' }
}));

// ===== Discord Auth =====
const DiscordStrategy = require('passport-discord').Strategy;
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// ===== FiveM Stats =====
app.get('/api/stats', async (req, res) => {
    try {
        const FIVEM_IP = process.env.FIVEM_IP || '127.0.0.1';
        const FIVEM_PORT = process.env.FIVEM_PORT || '30120';
        const base = `http://${FIVEM_IP}:${FIVEM_PORT}`;
        const dynRes = await fetch(`${base}/dynamic.json`, { timeout: 5000 });
        if (!dynRes.ok) throw new Error('unreachable');
        const dyn = await dynRes.json();
        let name = 'SouthSide S2';
        try {
            const infoRes = await fetch(`${base}/info.json`, { timeout: 3000 });
            if (infoRes.ok) { const info = await infoRes.json(); name = info.hostname || name; }
        } catch (_) {}
        res.json({ online: true, players: dyn.clients || 0, maxPlayers: dyn.sv_maxclients || 128, name, ip: `connect ${FIVEM_IP}:${FIVEM_PORT}` });
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

// ===== Streamers =====
app.get('/api/streamers', (req, res) => res.json(getDB().streamers || []));
app.post('/api/streamers', (req, res) => {
  const db = getDB(); if (!db.streamers) db.streamers = [];
  const st = { id: Date.now().toString(), ...req.body };
  db.streamers.push(st); saveDB(db); res.json(st);
});
app.delete('/api/streamers/:id', (req, res) => {
  const db = getDB(); db.streamers = db.streamers.filter(s => s.id !== req.params.id);
  saveDB(db); res.json({ success: true });
});

// ===== Gangs =====
app.get('/api/gangs', (req, res) => res.json(getDB().gangs || []));
app.post('/api/gangs', (req, res) => {
  const db = getDB(); if (!db.gangs) db.gangs = [];
  
  const gang = { 
      id: Date.now().toString(), 
      name: req.body.name || 'Unknown',
      boss: req.body.boss || '', 
      bossId: req.body.bossId || '',
      underboss: req.body.underboss || '', 
      underbossId: req.body.underbossId || '',
      members: [] 
  };
  db.gangs.push(gang); saveDB(db); res.json(gang);
});

app.delete('/api/gangs/:id', (req, res) => {
  const db = getDB(); db.gangs = db.gangs.filter(g => g.id !== req.params.id);
  saveDB(db); res.json({ success: true });
});

// إضافة عضو (مع الصورة اللي كتحطها نتا)
app.post('/api/gangs/:id/members', (req, res) => {
  const db = getDB(); const gang = db.gangs.find(g => g.id === req.params.id);
  if (!gang) return res.status(404).json({ error: 'Gang not found' });
  
  const avatar = req.body.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
  
  gang.members.push({ 
      discordId: req.body.discordId, 
      name: req.body.memberName || 'Member', 
      avatar: avatar 
  }); 
  saveDB(db); res.json(gang);
});

// ===== Shop =====
app.get('/api/shop', (req, res) => res.json(getDB().shop));
app.post('/api/shop', (req, res) => {
  const db = getDB(); const item = { id: Date.now().toString(), ...req.body };
  db.shop.push(item); saveDB(db); res.json(item);
});
app.delete('/api/shop/:id', (req, res) => {
  const db = getDB(); db.shop = db.shop.filter(i => i.id !== req.params.id);
  saveDB(db); res.json({ success: true });
});

// ===== Tickets =====
app.get('/api/tickets', (req, res) => res.json(getDB().tickets));
app.post('/api/tickets', (req, res) => {
  const db = getDB();
  const ticket = { id: Date.now().toString(), status: 'pending', reason: '', user: req.user ? req.user.username : 'Guest', ...req.body };
  db.tickets.push(ticket); saveDB(db); res.json(ticket);
});
app.put('/api/tickets/:id', (req, res) => {
  const db = getDB(); const t = db.tickets.find(x => x.id === req.params.id);
  if (t) { t.status = req.body.status; t.reason = req.body.reason || ''; saveDB(db); }
  res.json(t);
});

// ===== Admin =====
app.post('/api/admin-login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
