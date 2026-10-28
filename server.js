const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const { Pool } = require('pg'); // تأكد من تثبيت pg: npm install pg

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ مهم لـ Render (proxy)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== اتصال Supabase (PostgreSQL) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // ضروري لـ Supabase
});

pool.connect()
  .then(() => console.log('✅ Supabase (PostgreSQL) connected'))
  .catch(err => console.error('❌ Database connection error:', err));

// ===== SESSION (بدون MongoStore، استعمل MemoryStore مؤقتاً) =====
// ⚠️ MemoryStore ماشي مناسب للإنتاج، ولكن كيخدم مؤقتاً حتى تربط Redis أو غيره
app.use(session({
  secret: process.env.SESSION_SECRET || 'southside-secret',
  resave: false,
  saveUninitialized: false,
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

// ===== FALLBACK =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 SouthSide S2 running on port ${PORT}`);
});
