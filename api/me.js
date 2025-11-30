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

    // Get member from session
    const result = await sql`
      SELECT m.id, m.name, m.email, m.pin_number, m.bio, m.photo_url, 
             m.looking_for, m.offering, m.finished_scorecard
      FROM members m
      JOIN sessions s ON s.member_id = m.id
      WHERE s.token = ${sessionToken}
        AND s.expires_at > NOW()
    `;

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Get member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
