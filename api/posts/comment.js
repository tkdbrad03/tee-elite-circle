const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

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

    const memberId = sessionCheck.rows[0].member_id;
    const { post_id, content } = req.body;

    if (!post_id || !content) {
      return res.status(400).json({ error: 'Post ID and content are required' });
    }

    const result = await client.query(
      'INSERT INTO comments (post_id, member_id, content) VALUES ($1, $2, $3) RETURNING id',
      [post_id, memberId, content]
    );

    return res.status(200).json({ success: true, comment_id: result.rows[0].id });
  } catch (error) {
    console.error('Comment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
