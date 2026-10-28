const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const dns = require('dns');

// 🔥 هاد السطر كيحل مشكل DNS فـ Render
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== MongoDB =====
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
};
connectDB();

// ===== Session (MySQL/MongoDB) =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'southside-secret-2026',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60 
  }),
  cookie: {
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// ===== Passport =====
app.use(passport.initialize());
app.use(passport.session());

// ===== Routes =====
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/shop'));
app.use('/api', require('./routes/tickets'));
app.use('/api', require('./routes/admin'));

// ===== Fallback =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Live on ${PORT}`);
});