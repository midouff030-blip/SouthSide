const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== 1. قاعدة البيانات البسيطة (JSON) =====
const dbPath = path.join(__dirname, 'data.json');
// إنشاء الملف أوتوماتيكياً إلا ما كانش
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ shop: [], tickets: [] }, null, 2));
}

const getDB = () => JSON.parse(fs.readFileSync(dbPath));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// ===== 2. الجلسات و الديسكورد (Login) =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'southside-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'none' } // ضروري باش يخدم مع Render
}));

const DiscordStrategy = require('passport-discord').Strategy;
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID || 'YOUR_ID_HERE',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || 'YOUR_SECRET_HERE',
  callbackURL: process.env.DISCORD_CALLBACK_URL || 'https://southside-ibui.onrender.com/api/auth/discord/callback',
  scope: ['identify']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// ===== 3. الروابط (API Routes) =====

// --- Auth (الديسكورد) ---
app.get('/api/auth/discord', passport.authenticate('discord'));

app.get('/api/auth/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/?login=failed' }), 
  (req, res) => res.redirect('/?login=success') // كيرجعك للصفحة الرئيسية
);

app.get('/api/auth/me', (req, res) => {
  if (req.user) res.json({ loggedIn: true, username: req.user.username });
  else res.json({ loggedIn: false });
});

app.get('/api/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// --- Shop (المتجر) ---
app.get('/api/shop', (req, res) => {
  res.json(getDB().shop);
});

app.post('/api/shop', (req, res) => {
  const db = getDB();
  const item = { id: Date.now().toString(), ...req.body };
  db.shop.push(item);
  saveDB(db);
  res.json(item);
});

app.delete('/api/shop/:id', (req, res) => {
  const db = getDB();
  db.shop = db.shop.filter(i => i.id !== req.params.id);
  saveDB(db);
  res.json({ success: true });
});

// --- Tickets (التطبيقات) ---
app.get('/api/tickets', (req, res) => {
  res.json(getDB().tickets);
});

app.post('/api/tickets', (req, res) => {
  const db = getDB();
  const ticket = { 
    id: Date.now().toString(), 
    status: 'pending', 
    reason: '', 
    user: req.user ? req.user.username : 'Guest', 
    ...req.body 
  };
  db.tickets.push(ticket);
  saveDB(db);
  res.json(ticket);
});

app.put('/api/tickets/:id', (req, res) => {
  const db = getDB();
  const ticket = db.tickets.find(t => t.id === req.params.id);
  if (ticket) {
    ticket.status = req.body.status;
    ticket.reason = req.body.reason || '';
    saveDB(db);
  }
  res.json(ticket);
});

// --- Admin Login ---
app.post('/api/admin-login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Wrong password' });
});

// ===== 4. Fallback (أي رابط آخر يمشي للـ index.html) =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== 5. تشغيل السيرفر =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 SouthSide S2 Live on port ${PORT}`);
});
