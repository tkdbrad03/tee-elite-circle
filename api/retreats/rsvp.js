const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { retreat_id } = req.body;

  if (!retreat_id) {
    return res.status(400).json({ error: 'Retreat ID required' });
  }

  // Get session token from cookie
  const cookies = req.headers.cookie || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : null;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get member from session
    const sessionResult = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionResult.rows[0].member_id;

    // Check if already RSVP'd
    const existingRSVP = await client.query(
      'SELECT id FROM retreat_rsvps WHERE retreat_id = $1 AND member_id = $2',
      [retreat_id, memberId]
    );

    let confirmed = false;

    if (existingRSVP.rows.length > 0) {
      // Remove RSVP (toggle off)
      await client.query(
        'DELETE FROM retreat_rsvps WHERE retreat_id = $1 AND member_id = $2',
        [retreat_id, memberId]
      );
      confirmed = false;
    } else {
      // Add RSVP (toggle on)
      await client.query(
        'INSERT INTO retreat_rsvps (retreat_id, member_id) VALUES ($1, $2)',
        [retreat_id, memberId]
      );
      confirmed = true;
    }

    // Get updated count
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM retreat_rsvps WHERE retreat_id = $1',
      [retreat_id]
    );

    return res.status(200).json({ 
      confirmed,
      count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('RSVP error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
