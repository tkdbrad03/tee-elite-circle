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
    const { post_id } = req.body;

    if (!post_id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Check if already liked
    const existing = await client.query(
      'SELECT id FROM likes WHERE post_id = $1 AND member_id = $2',
      [post_id, memberId]
    );

    if (existing.rows.length > 0) {
      // Unlike
      await client.query('DELETE FROM likes WHERE post_id = $1 AND member_id = $2', [post_id, memberId]);
      return res.status(200).json({ liked: false });
    } else {
      // Like
      await client.query('INSERT INTO likes (post_id, member_id) VALUES ($1, $2)', [post_id, memberId]);
      return res.status(200).json({ liked: true });
    }
  } catch (error) {
    console.error('Like error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
