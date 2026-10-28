const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const FIVEM_IP = process.env.FIVEM_IP;
const FIVEM_PORT = process.env.FIVEM_PORT || '30120';

router.get('/stats', async (req, res) => {
  try {
    if (!FIVEM_IP) {
      return res.json({ online: false, players: 0, maxPlayers: 128, name: 'Not configured', ip: '' });
    }
    const base = `http://${FIVEM_IP}:${FIVEM_PORT}`;
    const dynRes = await fetch(`${base}/dynamic.json`, { timeout: 5000 });
    if (!dynRes.ok) throw new Error('unreachable');
    const dyn = await dynRes.json();

    let name = 'SouthSide S2';
    try {
      const infoRes = await fetch(`${base}/info.json`, { timeout: 3000 });
      if (infoRes.ok) {
        const info = await infoRes.json();
        name = info.hostname || name;
      }
    } catch (_) {}

    res.json({
      online: true,
      players: dyn.clients || 0,
      maxPlayers: dyn.sv_maxclients || 128,
      name,
      ip: `connect ${FIVEM_IP}:${FIVEM_PORT}`
    });
  } catch (e) {
    res.json({ online: false, players: 0, maxPlayers: 128, name: 'Offline', ip: '' });
  }
});

module.exports = router;