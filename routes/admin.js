const express = require('express');
const router = express.Router();

router.post('/admin-login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Wrong password' });
});

module.exports = router;