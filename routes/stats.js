const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.json');

router.get('/tickets', async (req, res) => {
  try {
    const db = await fs.readJson(dbPath);
    res.json(db.tickets || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tickets', async (req, res) => {
  try {
    const db = await fs.readJson(dbPath);
    const { type, subject, message } = req.body;
    const newTicket = {
      id: Date.now().toString(),
      type, subject, message,
      status: 'pending',
      reason: '',
      user: req.user ? req.user.username : 'anonymous'
    };
    db.tickets.push(newTicket);
    await fs.writeJson(dbPath, db);
    res.json(newTicket);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    const db = await fs.readJson(dbPath);
    const { status, reason } = req.body;
    const ticket = db.tickets.find(t => t.id === req.params.id);
    if (ticket) {
      ticket.status = status;
      ticket.reason = reason || '';
      await fs.writeJson(dbPath, db);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;