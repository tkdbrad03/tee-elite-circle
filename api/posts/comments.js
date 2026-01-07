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

    const { post_id } = req.query;

    if (!post_id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    const result = await client.query(
      `SELECT c.id, c.content, c.created_at, m.name as author_name
      FROM comments c
      JOIN members m ON c.member_id = m.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC`,
      [post_id]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
