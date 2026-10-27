const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/api/stats', async (req, res) => {
  try {
    const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${process.env.FIVEM_SERVER_ID}`);
    const d = await r.json();
    res.json({ online: true, name: d.Data?.hostname, players: d.Data?.clients || 0, maxPlayers: d.Data?.sv_maxclients || 0 });
  } catch (e) { res.json({ online: false }); }
});

app.post('/api/admin-login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get('/api/streamers', async (req, res) => {
  const { data } = await supabase.from('streamers').select('*');
  res.json(data || []);
});

app.get('/api/shop', async (req, res) => {
  const { data } = await supabase.from('shop_items').select('*');
  res.json(data || []);
});

app.post('/api/tickets', async (req, res) => {
  const { data, error } = await supabase.from('tickets').insert([req.body]).select();
  if(error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(process.env.PORT || 3000, () => console.log('Server Running'));
