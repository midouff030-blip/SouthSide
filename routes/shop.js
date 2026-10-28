const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// إنشاء الجدول أوتوماتيكياً
pool.query(`CREATE TABLE IF NOT EXISTS shop (id SERIAL PRIMARY KEY, name VARCHAR(255), price INT, category VARCHAR(50), stock INT, image TEXT)`).catch(() => {});

router.get('/shop', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shop ORDER BY id DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shop', async (req, res) => {
  try {
    const { name, price, category, stock, image } = req.body;
    const result = await pool.query(
      'INSERT INTO shop (name, price, category, stock, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, price, category, stock, image]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/shop/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM shop WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
