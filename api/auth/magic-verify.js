const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const { generateSessionToken, createSessionCookie } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const decoded = jwt.verify(token, process.env.JWT_MAGIC_SECRET);

    await client.connect();

    const result = await client.query(
      'SELECT id FROM members WHERE id = $1',
      [decoded.memberId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const sessionToken = generateSessionToken();

    await client.query(
      'INSERT INTO sessions (token, member_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [sessionToken, decoded.memberId]
    );

    res.setHeader('Set-Cookie', createSessionCookie(sessionToken));

    return res.status(200).json({ success: true });

  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired link' });
  } finally {
    await client.end();
  }
};
