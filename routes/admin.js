const express = require('express');
const router = express.Router();

router.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true, token: 'admin-' + Date.now() });
  }
  return res.status(401).json({ success: false, error: 'Wrong password' });
});

module.exports = router;