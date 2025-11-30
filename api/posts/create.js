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

    // Get member from session
    const sessionCheck = await sql`
      SELECT member_id FROM sessions 
      WHERE token = ${sessionToken} AND expires_at > NOW()
    `;

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionCheck.rows[0].member_id;
    const { title, content, category, image_url, post_type = 'win' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await sql`
      INSERT INTO posts (member_id, title, content, category, image_url, post_type)
      VALUES (${memberId}, ${title || null}, ${content}, ${category || null}, ${image_url || null}, ${post_type})
      RETURNING id
    `;

    return res.status(200).json({ success: true, post_id: result.rows[0].id });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
