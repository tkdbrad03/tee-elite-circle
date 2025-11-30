const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sessionToken = getSessionFromRequest(req);

    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await client.connect();

    const sessionCheck = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const { category } = req.query;

    let result;
    if (category && category !== 'all') {
      result = await client.query(
        'SELECT id, title, description, file_url, category, created_at FROM resources WHERE category = $1 ORDER BY created_at DESC',
        [category]
      );
    } else {
      result = await client.query(
        'SELECT id, title, description, file_url, category, created_at FROM resources ORDER BY created_at DESC'
      );
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get resources error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
