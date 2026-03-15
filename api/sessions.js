// Serverless endpoint for session CRUD via JSONBox.
// Supports: GET /api/sessions?userId=...  (list sessions)
//           POST /api/sessions          (create session)

const BOX_ID = 'sy-putting-box';
const JSONBOX_BASE = `https://jsonbox.io/${BOX_ID}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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
