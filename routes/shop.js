const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.json');

// إنشاء الملف إلا ما كانش
if (!fs.existsSync(dbPath)) {
  fs.writeJsonSync(dbPath, { shop: [], tickets: [] });
}

router.get('/shop', async (req, res) => {
  try {
    const db = await fs.readJson(dbPath);
    res.json(db.shop || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shop', async (req, res) => {
  try {
    const db = await fs.readJson(dbPath);
    const newItem = { id: Date.now().toString(), ...req.body };
    db.shop.push(newItem);
    await fs.writeJson(dbPath, db);
    res.json(newItem);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/shop/:id', async (req, res) => {
  try {
    const db = await fs.readJson(dbPath);
    db.shop = db.shop.filter(item => item.id !== req.params.id);
    await fs.writeJson(dbPath, db);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;