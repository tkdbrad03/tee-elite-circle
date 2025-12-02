const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
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

    // Verify session and get member
    const sessionResult = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionResult.rows[0].member_id;

    // Get all clinic signup counts and check if current user is signed up
    const result = await client.query(`
      SELECT 
        clinic_id,
        COUNT(*) as count,
        BOOL_OR(member_id = $1) as signed_up
      FROM clinic_signups
      GROUP BY clinic_id
    `, [memberId]);

    // Also check for clinics user signed up for with 0 others
    const userSignups = await client.query(
      'SELECT clinic_id FROM clinic_signups WHERE member_id = $1',
      [memberId]
    );

    const clinicData = {};
    
    // Add counts from grouped query
    result.rows.forEach(row => {
      clinicData[row.clinic_id] = {
        clinic_id: row.clinic_id,
        count: parseInt(row.count),
        signed_up: row.signed_up
      };
    });

    // Ensure user's signups are included
    userSignups.rows.forEach(row => {
      if (!clinicData[row.clinic_id]) {
        clinicData[row.clinic_id] = {
          clinic_id: row.clinic_id,
          count: 1,
          signed_up: true
        };
      }
    });

    return res.status(200).json(Object.values(clinicData));
  } catch (error) {
    console.error('Get clinic signups error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
