const mongoose = require('mongoose');

const ShopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, default: 'Other' },
  stock: { type: Number, default: 1 },
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShopItem', ShopItemSchema);