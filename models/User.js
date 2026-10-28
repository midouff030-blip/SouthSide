const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  discordId: { type: String, unique: true, required: true },
  username: String,
  discriminator: String,
  avatar: String,
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);