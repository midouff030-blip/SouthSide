const express = require('express');
const router = express.Router();
const ShopItem = require('../models/ShopItem');

router.get('/shop', async (req, res) => {
  try {
    let query = {};
    if (req.query.category) query.category = req.query.category;
    const items = await ShopItem.find(query);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shop', async (req, res) => {
  try {
    const item = await ShopItem.create(req.body);
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/shop/:id', async (req, res) => {
  try {
    await ShopItem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;