const { Client } = require('pg');

// IMPORTANT: update this cookie name to match what createSessionCookie() sets.
// From your screenshot it starts with "tec_ses".
// Put the exact cookie name here:
const SESSION_COOKIE_NAME = 'tec_session'; // <-- CHANGE THIS

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(p => p.trim());
  const hit = parts.find(p => p.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null;
}

module.exports = async (req, res) => {
  const sessionToken = getCookie(req, SESSION_COOKIE_NAME);
  if (!sessionToken) return res.status(401).json({ error: 'Not logged in' });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1) Find session -> member_id
    const s = await client.query(
      `SELECT member_id
       FROM sessions
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [sessionToken]
    );

    if (s.rows.length === 0) return res.status(401).json({ error: 'Session expired' });

    const memberId = s.rows[0].member_id;

    // 2) Load member + role
    const m = await client.query(
      `SELECT id, email, name, member_type, active
       FROM members
       WHERE id = $1
       LIMIT 1`,
      [memberId]
    );

    if (m.rows.length === 0) return res.status(401).json({ error: 'Member not found' });

    return res.status(200).json({ ok: true, member: m.rows[0] });
  } catch (e) {
    console.error('me error:', e);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    await client.end();
  }
};
