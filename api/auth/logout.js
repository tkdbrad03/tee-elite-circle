const { Client } = require('pg');
const { getSessionFromRequest, clearSessionCookie } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sessionToken = getSessionFromRequest(req);

    if (sessionToken) {
      await client.connect();
      await client.query('DELETE FROM sessions WHERE token = $1', [sessionToken]);
    }

    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client._connected) {
      await client.end();
    }
  }
};
