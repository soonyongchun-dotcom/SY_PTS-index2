// Serverless auth endpoint (Vercel/Netlify).
// POST /api/auth { id, passcode } -> { token, isAdmin }

const BOX_ID = 'sy-putting-box';
const JSONBOX_BASE = `https://jsonbox.io/${BOX_ID}`;

const SECRET = process.env.JWT_SECRET || 'change-me-please';
const crypto = require('crypto');

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.${signature}`;
}

const ADMIN_ID = 'csy62';
const ADMIN_PASSCODE = '1013';

const { createHandler } = require('./netlify');

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { id, passcode } = body;
    if (!id || !passcode) return res.status(400).json({ error: 'id and passcode are required' });

    // Admin shortcut
    if (id === ADMIN_ID && passcode === ADMIN_PASSCODE) {
      const token = sign({ id, isAdmin: true });
      return res.status(200).json({ token, isAdmin: true });
    }

    const q = encodeURIComponent(`type:user,id:${id}`);
    const resp = await fetch(`${JSONBOX_BASE}?q=${q}`);
    if (!resp.ok) return res.status(500).json({ error: 'Failed to fetch user' });

    const data = await resp.json();
    const user = data[0];
    if (!user || !user.hash || !user.salt) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const hash = crypto
      .pbkdf2Sync(passcode, user.salt, 310000, 32, 'sha256')
      .toString('hex');

    if (hash !== user.hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = sign({ id, isAdmin: false });
    return res.status(200).json({ token, isAdmin: false });
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = handler;
exports.handler = createHandler(handler);

