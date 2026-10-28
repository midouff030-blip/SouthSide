const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const fetch = require('node-fetch');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ===== Models =====
const ShopItem = mongoose.model('ShopItem', new mongoose.Schema({ name: String, price: Number, image: String }));
const Ticket = mongoose.model('Ticket', new mongoose.Schema({ type: String, subject: String, message: String, status: String, reason: String, user: String, date: { type: Date, default: Date.now } }));
const Streamer = mongoose.model('Streamer', new mongoose.Schema({ name: String, url: String, image: String, isLive: Boolean }));
const Gang = mongoose.model('Gang', new mongoose.Schema({ 
    name: String, 
    boss: String, 
    underboss: String, 
    logo: String, 
    members: [{ name: String, discordId: String, avatar: String }] 
}));

// ===== Sessions =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'southside-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'none' }
}));

// ===== Auth =====
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

// ===== Stats =====
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

// ===== Streamers API =====
app.get('/api/streamers', async (req, res) => res.json(await Streamer.find()));
app.post('/api/streamers', async (req, res) => res.json(await Streamer.create(req.body)));
app.delete('/api/streamers/:id', async (req, res) => { await Streamer.findByIdAndDelete(req.params.id); res.json({ success: true }); });

// ===== Gangs API =====
app.get('/api/gangs', async (req, res) => res.json(await Gang.find()));
app.post('/api/gangs', async (req, res) => {
  const gang = await Gang.create({ 
      name: req.body.name, 
      boss: req.body.boss, 
      underboss: req.body.underboss, 
      logo: req.body.logo, 
      members: [] 
  });
  res.json(gang);
});
app.delete('/api/gangs/:id', async (req, res) => { await Gang.findByIdAndDelete(req.params.id); res.json({ success: true }); });
app.post('/api/gangs/:id/members', async (req, res) => {
  const gang = await Gang.findById(req.params.id);
  if(gang) {
      gang.members.push({ 
          name: req.body.memberName || 'Member', 
          discordId: req.body.discordId, 
          avatar: req.body.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png' 
      });
      await gang.save();
      res.json(gang);
  } else {
      res.status(404).json({ error: 'Gang not found' });
  }
});

// ===== Shop API =====
app.get('/api/shop', async (req, res) => res.json(await ShopItem.find()));
app.post('/api/shop', async (req, res) => res.json(await ShopItem.create(req.body)));
app.delete('/api/shop/:id', async (req, res) => { await ShopItem.findByIdAndDelete(req.params.id); res.json({ success: true }); });

// ===== Tickets API =====
app.get('/api/tickets', async (req, res) => res.json(await Ticket.find().sort({ date: -1 })));
app.post('/api/tickets', async (req, res) => {
  const ticket = await Ticket.create({ 
      type: req.body.type, 
      subject: req.body.subject, 
      message: req.body.message, 
      status: 'pending', 
      user: req.user ? req.user.username : 'Guest' 
  });
  res.json(ticket);
});
app.put('/api/tickets/:id', async (req, res) => {
  const t = await Ticket.findByIdAndUpdate(req.params.id, { status: req.body.status, reason: req.body.reason }, { new: true });
  res.json(t);
});

// ===== Admin =====
app.post('/api/admin-login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`🔥 Live on ${PORT}`));
