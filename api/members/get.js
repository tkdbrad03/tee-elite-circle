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

    // Verify session
    const sessionCheck = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // If a specific member id is requested (for profile view)
    const memberId = req.query.id;
    if (memberId) {
      const result = await client.query(
        'SELECT id, name, photo_url, handicap, favorite_course FROM members WHERE id = $1',
        [memberId]
      );
      return res.status(200).json(result.rows[0] || null);
    }

    // Get all members
    const result = await client.query(
      'SELECT id, name, photo_url, handicap, favorite_course FROM members ORDER BY name ASC'
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
