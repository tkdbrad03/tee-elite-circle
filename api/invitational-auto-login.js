const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { generateSessionToken, createSessionCookie } = require('../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { email, name, code } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Server-side event code check
    if (String(code || '').trim().toUpperCase() !== 'TEE418') {
      return res.status(401).json({ error: 'Invalid code' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if this email has a completed payment
    const paid = await client.query(
      'SELECT email FROM invitational_payments WHERE email = $1',
      [cleanEmail]
    );

    if (paid.rows.length === 0) {
      return res.status(403).json({ error: 'Payment not found for this email yet.' });
    }

    // Check if member already exists
    let result = await client.query(
      'SELECT id, email, name FROM members WHERE email = $1',
      [cleanEmail]
    );

    let member;

    if (result.rows.length === 0) {
      // Create a random password hash (they won't use it for normal login)
      const randomPassword = Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const insert = await client.query(
        'INSERT INTO members (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [cleanEmail, passwordHash, name || 'Invitational Member']
      );

      member = insert.rows[0];
    } else {
      member = result.rows[0];
    }

    // Generate session token
    const sessionToken = generateSessionToken();

    await client.query(
      `INSERT INTO sessions (token, member_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [sessionToken, member.id]
    );

    res.setHeader('Set-Cookie', createSessionCookie(sessionToken));

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Invitational auto login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
