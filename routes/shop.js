const express = require('express');
const router = express.Router();
const ShopItem = require('../models/ShopItem');

// GET /api/shop
router.get('/shop', async (req, res) => {
  try {
    let query = {};
    if (req.query.category) query.category = req.query.category;
    const items = await ShopItem.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop
router.post('/shop', async (req, res) => {
  try {
    const { name, price, category, stock, image } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Missing fields' });
    const item = await ShopItem.create({
      name, price: parseInt(price),
      category: category || 'Other',
      stock: stock || 1,
      image: image || ''
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/shop/:id
router.delete('/shop/:id', async (req, res) => {
  try {
    await ShopItem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;