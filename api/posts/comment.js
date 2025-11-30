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
    const { post_id, content } = req.body;

    if (!post_id || !content) {
      return res.status(400).json({ error: 'Post ID and content are required' });
    }

    const result = await sql`
      INSERT INTO comments (post_id, member_id, content)
      VALUES (${post_id}, ${memberId}, ${content})
      RETURNING id
    `;

    return res.status(200).json({ success: true, comment_id: result.rows[0].id });
  } catch (error) {
    console.error('Comment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
