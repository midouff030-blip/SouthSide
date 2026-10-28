const mongoose = require('mongoose');
const TicketSchema = new mongoose.Schema({
  type: String,
  subject: String,
  message: String,
  status: { type: String, default: 'pending' },
  reason: { type: String, default: '' },
  user: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Ticket', TicketSchema);