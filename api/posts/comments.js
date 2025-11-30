const { sql } = require('@vercel/postgres');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
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

    const { post_id } = req.query;

    if (!post_id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    const result = await sql`
      SELECT c.id, c.content, c.created_at, m.name as author_name
      FROM comments c
      JOIN members m ON c.member_id = m.id
      WHERE c.post_id = ${post_id}
      ORDER BY c.created_at ASC
    `;

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
