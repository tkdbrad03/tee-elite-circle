const { sql } = require('@vercel/postgres');
const { getSessionFromRequest, clearSessionCookie } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = getSessionFromRequest(req);

    if (sessionToken) {
      // Delete session from database
      await sql`
        DELETE FROM sessions
        WHERE token = ${sessionToken}
      `;
    }

    // Clear session cookie
    res.setHeader('Set-Cookie', clearSessionCookie());

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
