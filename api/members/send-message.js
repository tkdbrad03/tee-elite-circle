const { Client } = require('pg');
const nodemailer = require('nodemailer');
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

    await client.connect();

    // Get sender from session
    const sessionResult = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const senderId = sessionResult.rows[0].member_id;

    // Get sender details
    const senderResult = await client.query(
      'SELECT id, name, email FROM members WHERE id = $1',
      [senderId]
    );
    if (senderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    const sender = senderResult.rows[0];

    const { recipient_id, message } = req.body;

    if (!recipient_id || !message || !message.trim()) {
      return res.status(400).json({ error: 'recipient_id and message are required' });
    }

    // Prevent messaging yourself
    if (parseInt(recipient_id) === senderId) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }

    // Get recipient details
    const recipientResult = await client.query(
      'SELECT id, name, email FROM members WHERE id = $1',
      [recipient_id]
    );
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const recipient = recipientResult.rows[0];

    // Send email via Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const firstName = recipient.name ? recipient.name.split(' ')[0] : 'there';
    const senderFirst = sender.name ? sender.name.split(' ')[0] : sender.name;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#163326;padding:36px 48px;text-align:center;border-radius:16px 16px 0 0;">
              <p style="margin:0;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#C9A24A;font-family:sans-serif;">Tee Elite Invitational 2026</p>
              <p style="margin:10px 0 0;font-family:'Georgia',serif;font-size:26px;color:#fff;font-weight:400;">A Message from ${sender.name}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 48px;border-left:1px solid rgba(0,0,0,.08);border-right:1px solid rgba(0,0,0,.08);">
              <p style="margin:0 0 20px;font-family:sans-serif;font-size:15px;color:#555;line-height:1.5;">Hi ${firstName},</p>
              <p style="margin:0 0 28px;font-family:sans-serif;font-size:15px;color:#555;line-height:1.5;">A fellow Invitational member reached out to you through the Tee Elite Hub:</p>

              <!-- Message box -->
              <div style="background:#F8F7F4;border-left:3px solid #C9A24A;padding:20px 24px;margin-bottom:32px;border-radius:0 8px 8px 0;">
                <p style="margin:0;font-family:sans-serif;font-size:15px;color:#2C2C2C;line-height:1.8;white-space:pre-wrap;">${message.trim()}</p>
              </div>

              <p style="margin:0 0 6px;font-family:sans-serif;font-size:14px;color:#888;line-height:1.6;">To reply directly to ${senderFirst}, simply reply to this email or reach out at:</p>
              <p style="margin:0 0 32px;font-family:sans-serif;font-size:14px;color:#163326;font-weight:600;">
                <a href="mailto:${sender.email}" style="color:#A87C28;text-decoration:none;">${sender.email}</a>
              </p>

              <p style="margin:0;font-family:sans-serif;font-size:13px;color:#aaa;line-height:1.6;">See you on the green — April 18, 2026 · Summerfield Crossing Golf Club</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8F7F4;padding:24px 48px;text-align:center;border:1px solid rgba(0,0,0,.06);border-top:none;border-radius:0 0 16px 16px;">
              <p style="margin:0;font-family:sans-serif;font-size:11px;color:#bbb;letter-spacing:.1em;text-transform:uppercase;">The Tee Elite Circle — A TMac Inspired Experience</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Tee Elite Circle" <${process.env.GMAIL_USER}>`,
      replyTo: `"${sender.name}" <${sender.email}>`,
      to: recipient.email,
      subject: `${sender.name} sent you a message — Tee Elite Invitational`,
      html: emailHtml
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Failed to send message. Please try again.' });
  } finally {
    await client.end();
  }
};
