// Serverless user management (for Vercel/Netlify). Supports:
// - GET /api/user?id=<id> (get user info, admin only)
// - GET /api/user?list=true (list users, admin only)
// - POST /api/user (create user, admin only)
// - DELETE /api/user?id=<id> (delete user, admin only)

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

const requireAdmin = (req, res) => {
  const auth = (req.headers.authorization || '').split(' ');
  if (auth[0] !== 'Bearer' || !auth[1]) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (auth[1] === ADMIN_TOKEN) {
    return { id: 'admin', isAdmin: true };
  }

  const payload = verifyToken(auth[1]);
  if (!payload || !payload.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return payload;
};

const { createHandler } = require('./netlify');

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const payload = requireAdmin(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    const { id, list } = req.query;

    try {
      const q = list ? 'type:user' : `type:user,id:${id}`;
      const resp = await fetch(`${JSONBOX_BASE}?q=${encodeURIComponent(q)}`);
      const data = await resp.json();
      return res.status(200).json(list ? data : data[0] || null);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch from JSONBox' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.id || !body.passcode) {
        return res.status(400).json({ error: 'id and passcode are required' });
      }

      // 이미 존재하는 사용자 확인
      const q = encodeURIComponent(`type:user,id:${body.id}`);
      const checkResp = await fetch(`${JSONBOX_BASE}?q=${q}`);
      const existing = await checkResp.json();
      if (existing.length > 0) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .pbkdf2Sync(body.passcode, salt, 310000, 32, 'sha256')
        .toString('hex');
      const resp = await fetch(`${JSONBOX_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', id: body.id, hash, salt }),
      });
      const data = await resp.json();
      return res.status(201).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const resp = await fetch(`${JSONBOX_BASE}?q=${encodeURIComponent(`type:user,id:${id}`)}`);
      const data = await resp.json();
      if (!data.length) return res.status(404).json({ error: 'Not found' });
      const recordId = data[0]['_id'];
      await fetch(`${JSONBOX_BASE}/${recordId}`, { method: 'DELETE' });
      return res.status(204).end();
    } catch {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};

module.exports = handler;
exports.handler = createHandler(handler);
