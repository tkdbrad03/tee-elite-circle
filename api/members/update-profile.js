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
    const { name, bio, offering, looking_for, finished_scorecard } = req.body;

    // Update member
    await sql`
      UPDATE members
      SET 
        name = COALESCE(${name}, name),
        bio = ${bio},
        offering = ${offering},
        looking_for = ${looking_for},
        finished_scorecard = ${finished_scorecard},
        updated_at = NOW()
      WHERE id = ${memberId}
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
