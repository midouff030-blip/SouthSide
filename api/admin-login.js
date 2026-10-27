export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }

  if (password === process.env.ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', 'admin_session=ok; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600');
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false, error: 'Wrong password' });
}