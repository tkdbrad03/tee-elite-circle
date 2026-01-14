const nodemailer = require('nodemailer');

function sanitizeEmailHtml(html) {
  // Removes common "junk" or unsafe tags that can sneak in via copy/paste.
  // Most email clients block scripts anyway, but this keeps your outgoing HTML clean.
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<(object|embed)\b[^>]*>.*?<\/\1>/gis, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contacts, subject, template, useTemplate } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Contacts array required' });
  }

  if (!subject) {
    return res.status(400).json({ error: 'Subject required' });
  }

  if (!template || String(template).trim().length === 0) {
    return res.status(400).json({ error: 'Email template required' });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Missing Gmail environment variables' });
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  // Track results
  const results = {
    sent: 0,
    failed: 0,
    details: []
  };

  // Plain email wrapper (NO newline conversion — allow real HTML)
  const createPlainEmail = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; font-size: 16px; line-height: 1.8; color: #333333;">
    ${content}
  </div>
</body>
</html>
`;

  // Branded email template (NO newline conversion — allow real HTML)
  const createBrandedEmail = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f7f0ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f0ef; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a2f23; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #e8ccc8; font-style: italic;">TMac Inspired presents</p>
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; font-family: Georgia, serif; color: #ffffff; letter-spacing: 0.05em;">The Tee Elite Circle</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 48px;">
              <div style="font-size: 15px; line-height: 1.8; color: #555555;">
                ${content}
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a2f23; padding: 32px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff;">The Tee Elite Circle</p>
              <p style="margin: 0 0 16px 0; font-size: 11px; letter-spacing: 0.15em; color: #e8ccc8;">WHERE GOLF MEETS GREATNESS</p>
              <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.6;">
                You’re receiving this because you're part of the Tee Elite Circle community.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  // Gmail-friendly pacing (20/min approx)
  const DELAY_BETWEEN_EMAILS = 3000;

  // Sanitize ONCE, then personalize per recipient
  const safeTemplate = sanitizeEmailHtml(template);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const timestamp = new Date().toISOString();

    const firstName = contact.first_name || 'there';

    // Replace placeholder in HTML template
    const personalizedContent = safeTemplate.replace(/{first_name}/gi, firstName);

    // Wrap with selected layout
    const htmlContent = useTemplate
      ? createBrandedEmail(personalizedContent)
      : createPlainEmail(personalizedContent);

    const mailOptions = {
      from: `"Dr. TMac" <${process.env.GMAIL_USER}>`,
      to: contact.email,
      subject,
      html: htmlContent
    };

    try {
      await transporter.sendMail(mailOptions);

      results.sent++;
      results.details.push({
        email: contact.email,
        first_name: contact.first_name || '',
        success: true,
        error: '',
        timestamp
      });

    } catch (error) {
      results.failed++;
      results.details.push({
        email: contact.email,
        first_name: contact.first_name || '',
        success: false,
        error: error?.message || 'Send failed',
        timestamp
      });
    }

    if (i < contacts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_EMAILS));
    }
  }

  return res.status(200).json({
    success: true,
    message: `Campaign complete: ${results.sent} sent, ${results.failed} failed`,
    sent: results.sent,
    failed: results.failed,
    results: results.details // IMPORTANT: array for your frontend .forEach
  });
};
