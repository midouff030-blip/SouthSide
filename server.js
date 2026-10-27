const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ===== STATS =====
app.get('/api/stats', async (req, res) => {
  try {
    const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${process.env.FIVEM_SERVER_ID}`);
    const d = await r.json();
    res.json({ online: true, name: d.Data?.hostname, players: d.Data?.clients || 0, maxPlayers: d.Data?.sv_maxclients || 0 });
  } catch (e) { res.json({ online: false, players: 0, maxPlayers: 0 }); }
});

// ===== ADMIN LOGIN =====
app.post('/api/admin-login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-secret' });
  } else {
    res.status(401).json({ success: false, error: 'Wrong password' });
  }
});

// ===== STREAMERS =====
app.get('/api/streamers', async (req, res) => {
  const { data } = await supabase.from('streamers').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});
app.post('/api/streamers', async (req, res) => {
  const { data, error } = await supabase.from('streamers').insert([{ username: req.body.username }]).select();
  if (error) return res.status(500).json(error);
  res.json(data[0]);
});
app.delete('/api/streamers/:id', async (req, res) => {
  await supabase.from('streamers').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ===== SHOP =====
app.get('/api/shop', async (req, res) => {
  const { data } = await supabase.from('shop_items').select('*');
  res.json(data || []);
});
app.post('/api/shop', async (req, res) => {
  const { data, error } = await supabase.from('shop_items').insert([req.body]).select();
  if (error) return res.status(500).json(error);
  res.json(data[0]);
});
app.delete('/api/shop/:id', async (req, res) => {
  await supabase.from('shop_items').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ===== TICKETS (SUPPORT & APPLICATIONS) =====
app.get('/api/tickets', async (req, res) => {
  const { data } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});
app.post('/api/tickets', async (req, res) => {
  const { data, error } = await supabase.from('tickets').insert([req.body]).select();
  if (error) return res.status(500).json(error);
  res.json(data[0]);
});
app.put('/api/tickets/:id', async (req, res) => {
  const { data, error } = await supabase.from('tickets').update({ status: req.body.status }).eq('id', req.params.id).select();
  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

// ===== DISCORD LOGIN =====
app.get('/api/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});
app.get('/api/auth/callback', async (req, res) => {
  if (!req.query.code) return res.redirect('/?login=denied');
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: req.query.code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI
  });
  try {
    const t = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const token = await t.json();
    if (token.access_token) res.redirect('/?login=success');
    else res.redirect('/?login=failed');
  } catch (e) { res.redirect('/?login=error'); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('✅ Server Running'));
