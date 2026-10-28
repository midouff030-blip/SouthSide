const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // تأكد من تثبيت pg: npm install pg

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== اتصال Supabase =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // ضروري لـ Supabase
});

pool.connect()
  .then(() => console.log('✅ Supabase connected successfully!'))
  .catch(err => console.error('❌ Supabase connection error:', err.message));

// ===== Routes (مؤقتاً، باش نختبرو غير الاتصال) =====
// هنا غادي نرجعو نحطو الروتس من بعد
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ===== Fallback =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 SouthSide S2 running on port ${PORT}`);
});
