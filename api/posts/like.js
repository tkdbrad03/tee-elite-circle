const { sql } = require('@vercel/postgres');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = getSessionFromRequest(req);

    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionCheck = await sql`
      SELECT member_id FROM sessions 
      WHERE token = ${sessionToken} AND expires_at > NOW()
    `;

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionCheck.rows[0].member_id;
    const { post_id } = req.body;

    if (!post_id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Check if already liked
    const existing = await sql`
      SELECT id FROM likes WHERE post_id = ${post_id} AND member_id = ${memberId}
    `;

    if (existing.rows.length > 0) {
      // Unlike
      await sql`DELETE FROM likes WHERE post_id = ${post_id} AND member_id = ${memberId}`;
      return res.status(200).json({ liked: false });
    } else {
      // Like
      await sql`INSERT INTO likes (post_id, member_id) VALUES (${post_id}, ${memberId})`;
      return res.status(200).json({ liked: true });
    }
  } catch (error) {
    console.error('Like error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
