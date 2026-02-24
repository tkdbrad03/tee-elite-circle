const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify session
  const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];
  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { notification_email } = req.body;
  if (!notification_email || !notification_email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get member from session
    const sessionRes = await client.query(
      `SELECT member_email FROM member_sessions WHERE token = $1 AND expires_at > NOW()`,
      [sessionToken]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberEmail = sessionRes.rows[0].member_email;

    // Add column if it doesn't exist (safe to run multiple times)
    await client.query(`
      ALTER TABLE invitational_payments
      ADD COLUMN IF NOT EXISTS priority_notification_email TEXT,
      ADD COLUMN IF NOT EXISTS priority_access_confirmed_at TIMESTAMPTZ
    `);

    // Update the member's record
    const result = await client.query(`
      UPDATE invitational_payments
      SET
        priority_notification_email = $1,
        priority_access_confirmed_at = NOW()
      WHERE email = $2
      RETURNING id
    `, [notification_email.trim().toLowerCase(), memberEmail]);

    if (result.rows.length === 0) {
      // Member exists in sessions but not in payments — insert a record
      await client.query(`
        INSERT INTO invitational_payments (email, priority_notification_email, priority_access_confirmed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (email) DO UPDATE SET
          priority_notification_email = $2,
          priority_access_confirmed_at = NOW()
      `, [memberEmail, notification_email.trim().toLowerCase()]);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Priority access save error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
