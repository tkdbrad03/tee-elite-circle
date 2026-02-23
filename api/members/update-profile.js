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
    const { name, handicap, favorite_course, finished_scorecard } = req.body;

    await client.query(
      `UPDATE members SET
        name = COALESCE($1, name),
        handicap = $2,
        favorite_course = $3,
        finished_scorecard = $4,
        updated_at = NOW()
      WHERE id = $5`,
      [name, handicap || null, favorite_course || null, finished_scorecard || null, memberId]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
