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
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const { ghin } = req.body || {};
    if (!ghin) return res.status(400).json({ error: 'GHIN number required' });

    // Basic validation: GHIN is 7 digits
    const cleanGhin = String(ghin).trim().replace(/\D/g, '');
    if (cleanGhin.length < 5 || cleanGhin.length > 8) {
      return res.status(400).json({ error: 'Invalid GHIN number format' });
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

    // Update the member's GHIN number
    // Try with ghin column; if it doesn't exist, add it gracefully
    try {
      await client.query(
        'UPDATE members SET ghin = $1 WHERE id = $2',
        [cleanGhin, memberId]
      );
    } catch (colErr) {
      // Column might not exist yet — add it
      await client.query('ALTER TABLE members ADD COLUMN IF NOT EXISTS ghin TEXT');
      await client.query(
        'UPDATE members SET ghin = $1 WHERE id = $2',
        [cleanGhin, memberId]
      );
    }

    return res.status(200).json({ success: true, ghin: cleanGhin });

  } catch (err) {
    console.error('Update GHIN error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
