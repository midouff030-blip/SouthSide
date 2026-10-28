const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query(`CREATE TABLE IF NOT EXISTS tickets (id SERIAL PRIMARY KEY, type VARCHAR(50), subject VARCHAR(255), message TEXT, status VARCHAR(50) DEFAULT 'pending', reason TEXT, "discordUser" VARCHAR(255), "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).catch(() => {});

router.get('/tickets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tickets ORDER BY id DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tickets', async (req, res) => {
  try {
    const { type, subject, message } = req.body;
    const user = req.user ? req.user.username : 'anonymous';
    const result = await pool.query(
      'INSERT INTO tickets (type, subject, message, "discordUser") VALUES ($1, $2, $3, $4) RETURNING *',
      [type, subject, message, user]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const result = await pool.query(
      'UPDATE tickets SET status = $1, reason = $2 WHERE id = $3 RETURNING *',
      [status, reason, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
