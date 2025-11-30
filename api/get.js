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

    const { category } = req.query;

    let result;
    if (category && category !== 'all') {
      result = await sql`
        SELECT id, title, description, file_url, category, created_at
        FROM resources
        WHERE category = ${category}
        ORDER BY created_at DESC
      `;
    } else {
      result = await sql`
        SELECT id, title, description, file_url, category, created_at
        FROM resources
        ORDER BY created_at DESC
      `;
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get resources error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
