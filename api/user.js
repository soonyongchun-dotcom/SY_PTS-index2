// This file is intended for deployment on a serverless platform (Vercel, Netlify Functions, etc.).
// It proxies user lookup to JSONBox and adds CORS headers.

const BOX_ID = 'sy-putting-box';
const JSONBOX_BASE = `https://jsonbox.io/${BOX_ID}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const q = encodeURIComponent(`type:user,id:${id}`);
    const resp = await fetch(`${JSONBOX_BASE}?q=${q}`);
    const data = await resp.json();
    return res.status(200).json(data[0] || null);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch from JSONBox' });
  }
};
