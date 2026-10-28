const mongoose = require('mongoose');

const StreamerSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  live: { type: Boolean, default: false },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Streamer', StreamerSchema);