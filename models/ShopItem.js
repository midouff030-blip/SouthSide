const mongoose = require('mongoose');
const ShopSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  stock: { type: Number, default: 1 },
  image: String
});
module.exports = mongoose.model('ShopItem', ShopSchema);