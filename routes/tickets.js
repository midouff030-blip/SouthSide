const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

// POST /api/tickets → créer une application
router.post('/tickets', async (req, res) => {
  try {
    const { type, subject, message } = req.body;
    if (!type || !subject || !message) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const discordUser = req.user ? req.user.username : 'anonymous';
    const ticket = await Ticket.create({ type, subject, message, discordUser });
    res.json(ticket);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tickets (admin)
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/tickets/:id → accept / reject + reason
router.put('/tickets/:id', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status, reason: reason || '' },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    res.json(ticket);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;