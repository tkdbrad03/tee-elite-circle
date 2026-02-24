const { Client } = require('pg');

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(p => p.trim());
  const hit = parts.find(p => p.startsWith(name + '=')); 
  return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null;
}

module.exports = async (req, res) => {
  const sessionToken = getCookie(req, 'tec_session');

  if (!sessionToken) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Validate session
    const session = await client.query(
      `SELECT member_id
       FROM sessions
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [sessionToken]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = session.rows[0].member_id;

    // Get member role
    const member = await client.query(
      `SELECT id, email, name, member_type, active
       FROM members
       WHERE id = $1
       LIMIT 1`,
      [memberId]
    );

    if (member.rows.length === 0) {
      return res.status(401).json({ error: 'Member not found' });
    }

    return res.status(200).json({
      ok: true,
      member: member.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    await client.end();
  }
};
