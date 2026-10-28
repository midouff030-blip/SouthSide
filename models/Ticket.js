const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  type: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  reason: { type: String, default: '' },
  discordUser: { type: String, default: 'anonymous' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);