const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const Streamer = require('../models/Streamer');

// GET /api/streamers → live status from Kick
router.get('/streamers', async (req, res) => {
  try {
    const streamers = await Streamer.find();

    const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID;
    const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET;

    let token = null;
    if (KICK_CLIENT_ID && KICK_CLIENT_SECRET) {
      try {
        const tokenRes = await fetch('https://id.kick.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${KICK_CLIENT_ID}&client_secret=${KICK_CLIENT_SECRET}`
        });
        const tokenData = await tokenRes.json();
        token = tokenData.access_token;
      } catch (_) {}
    }

    const enriched = await Promise.all(streamers.map(async (s) => {
      let live = s.live;
      let avatar = s.avatar;
      if (token) {
        try {
          const liveRes = await fetch(
            `https://api.kick.com/public/v1/channels?slug=${s.username}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const liveData = await liveRes.json();
          if (liveData.data && liveData.data[0]) {
            live = liveData.data[0].livestream !== null;
            avatar = liveData.data[0].user?.profile_pic || avatar;
          }
        } catch (_) {}
      }
      return { id: s._id, username: s.username, live, avatar };
    }));

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/streamers
router.post('/streamers', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    const s = await Streamer.create({ username });
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/streamers/:id
router.delete('/streamers/:id', async (req, res) => {
  try {
    await Streamer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;