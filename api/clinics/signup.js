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

    const { clinic_id, action } = req.body;

    if (!clinic_id) {
      return res.status(400).json({ error: 'Clinic ID required' });
    }

    await client.connect();

    // Verify session and get member
    const sessionResult = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionResult.rows[0].member_id;

    if (action === 'cancel') {
      // Remove signup
      await client.query(
        'DELETE FROM clinic_signups WHERE clinic_id = $1 AND member_id = $2',
        [clinic_id, memberId]
      );
    } else {
      // Add signup (ignore if already exists)
      await client.query(`
        INSERT INTO clinic_signups (clinic_id, member_id)
        VALUES ($1, $2)
        ON CONFLICT (clinic_id, member_id) DO NOTHING
      `, [clinic_id, memberId]);
    }

    // Get updated count
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM clinic_signups WHERE clinic_id = $1',
      [clinic_id]
    );

    return res.status(200).json({ 
      success: true,
      count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Clinic signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
