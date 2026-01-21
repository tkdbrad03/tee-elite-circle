// api/admin/send-retreat-campaign.js
const { Client } = require('pg');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { retreatType, subject, message } = req.body;

    if (!retreatType || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: retreatType, subject, message' });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Email configuration missing' });
    }

    await client.connect();

    // Get all unique emails for this retreat type
    const result = await client.query(
      `SELECT DISTINCT email, zone, created_at 
       FROM retreat_interest 
       WHERE retreat_type = $1 
       ORDER BY created_at DESC`,
      [retreatType]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: `No one has registered interest in the ${retreatType} retreat yet` });
    }

    const recipients = result.rows;

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Send emails
    const results = { sent: 0, failed: 0, details: [] };
    const DELAY_BETWEEN_EMAILS = 3000; // 3 seconds between emails

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const timestamp = new Date().toISOString();

      const emailContent = {
        from: `"Dr. TMac" <${process.env.GMAIL_USER}>`,
        to: recipient.email,
        subject: subject,
        html: createRetreatEmail(message, retreatType)
      };

      try {
        await transporter.sendMail(emailContent);
        results.sent++;
        results.details.push({ 
          email: recipient.email, 
          success: true, 
          timestamp 
        });
      } catch (err) {
        results.failed++;
        results.details.push({ 
          email: recipient.email, 
          success: false, 
          error: err.message, 
          timestamp 
        });
      }

      // Delay between emails to avoid rate limiting
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS));
      }
    }

    return res.status(200).json({
      success: true,
      message: `Campaign sent to ${results.sent} recipients`,
      sent: results.sent,
      failed: results.failed,
      retreatType: retreatType,
      details: results.details
    });

  } catch (error) {
    console.error('Error sending retreat campaign:', error);
    return res.status(500).json({ error: 'Failed to send campaign' });
  } finally {
    await client.end();
  }
};

function createRetreatEmail(message, retreatType) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>The Tee Elite Circle - ${retreatType.toUpperCase()} Retreat</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: 'Georgia', serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF8F5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
              <tr>
                <td style="background-color: #1a2f23; padding: 40px 48px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #e8ccc8; font-style: italic;">TMac Inspired presents</p>
                  <h1 style="margin: 0; font-size: 32px; font-weight: 400; color: #ffffff; letter-spacing: 0.05em;">The Tee Elite Circle</h1>
                  <p style="margin: 16px 0 0 0; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #e8ccc8;">${retreatType} Retreat</p>
                </td>
              </tr>

              <tr>
                <td style="background-color: #ffffff; padding: 48px;">
                  <div style="font-size: 15px; line-height: 1.8; color: #555555;">
                    ${message}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #1a2f23; padding: 32px 48px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff;">The Tee Elite Circle</p>
                  <p style="margin: 0; font-size: 11px; letter-spacing: 0.15em; color: #e8ccc8;">WHERE GOLF MEETS GREATNESS</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
