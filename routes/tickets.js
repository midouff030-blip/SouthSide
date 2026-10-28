const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

router.post('/tickets', async (req, res) => {
  try {
    const { type, subject, message } = req.body;
    const user = req.user ? req.user.username : 'anonymous';
    const ticket = await Ticket.create({ type, subject, message, user });
    res.json(ticket);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status, reason }, { new: true });
    res.json(ticket);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;