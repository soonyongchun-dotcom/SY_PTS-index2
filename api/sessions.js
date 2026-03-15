// Serverless endpoint for session CRUD via JSONBox.
// Requires Bearer token (admin or user) to access.

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

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${header}.${body}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    if (signature !== expected) return null;
    return JSON.parse(Buffer.from(body, 'base64').toString());
  } catch {
    return null;
  }
}

const ADMIN_TOKEN = 'ADMIN_TOKEN';

const requireAuth = (req, res) => {
  const auth = (req.headers.authorization || '').split(' ');
  if (auth[0] !== 'Bearer' || !auth[1]) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (auth[1] === ADMIN_TOKEN) {
    return { id: 'admin', isAdmin: true };
  }

  const payload = verifyToken(auth[1]);
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
  return payload;
};

const { createHandler } = require('./netlify');

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const payload = requireAuth(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
      const q = encodeURIComponent(`type:session,userId:${userId}`);
      const resp = await fetch(`${JSONBOX_BASE}?q=${q}`);
      const data = await resp.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const resp = await fetch(`${JSONBOX_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      return res.status(201).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save session' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};

module.exports = handler;
module.exports.handler = createHandler(handler);
