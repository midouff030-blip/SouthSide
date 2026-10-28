const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ مهم لـ Render (proxy)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== MongoDB Connection =====
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    // ما نطيحوش السيرفر، نخليوه يخدم (باش الموقع يبان على الأقل)
  }
};
connectDB();

// ===== SESSION =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'southside-secret-2026',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// ===== PASSPORT =====
app.use(passport.initialize());
app.use(passport.session());

// ===== ROUTES =====
app.use('/api', require('./routes/stats'));
app.use('/api', require('./routes/shop'));
app.use('/api', require('./routes/streamers'));
app.use('/api', require('./routes/tickets'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/auth'));

// ===== FALLBACK (لـ React/Vue، كيرجع index.html) =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 SouthSide S2 running on port ${PORT}`);
});
