const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(
      'SELECT id, email, name FROM members WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Silent success — do not reveal membership status
      return res.status(200).json({ success: true });
    }

    const member = result.rows[0];

    const token = jwt.sign(
      { memberId: member.id },
      process.env.JWT_MAGIC_SECRET,
      { expiresIn: '15m' }
    );

    const magicUrl = `${process.env.PUBLIC_BASE_URL}/member-login.html?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Tee Elite Circle" <${process.env.GMAIL_USER}>`,
      to: member.email,
      subject: 'Your Secure Sign-In Link',
      html: `
        <p>Hello ${member.name},</p>
        <p>Click below to enter The Circle:</p>
        <p><a href="${magicUrl}" style="padding:12px 24px;background:#c9a961;color:white;text-decoration:none;border-radius:6px;">Enter The Circle</a></p>
        <p>This link expires in 15 minutes.</p>
      `
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Magic link error:', error);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    await client.end();
  }
};
