const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../lib/email');

function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

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

    const { email } = req.body || {};
    const cleanEmail = (email || '').toLowerCase().trim();

    // Always return a generic success message to avoid account enumeration
    if (!cleanEmail) {
      return res.status(200).json({ success: true });
    }

    const result = await client.query(
      'SELECT id, email, name FROM members WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ success: true });
    }

    const member = result.rows[0];

    const tempPassword = generateTempPassword(12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await client.query(
      'UPDATE members SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, member.id]
    );

    const subject = 'Your Tee Elite Hub temporary password';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.8; color: #2C2C2C;">
        <h2 style="margin: 0 0 12px 0; font-weight: 500;">Tee Elite Hub access</h2>
        <p style="margin: 0 0 16px 0;">
          Here is your temporary password. Use it to log in, then change it once you are inside.
        </p>

        <div style="margin: 18px 0; padding: 14px 16px; background: #1a2f23; color: #ffffff;">
          <div style="font-size: 12px; opacity: 0.8; letter-spacing: 0.12em; text-transform: uppercase;">Temporary password</div>
          <div style="font-size: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-top: 6px;">${tempPassword}</div>
        </div>

        <p style="margin: 0 0 16px 0;">
          Login here: <a href="https://tmacmastermind.com/member-login.html" style="color:#a67c52; text-decoration: underline;">tmacmastermind.com/member-login.html</a>
        </p>

        <p style="margin: 0; font-size: 13px; color: #555;">
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `;

    await sendEmail({
      to: member.email,
      subject,
      html
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
