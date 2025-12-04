const nodemailer = require('nodemailer');

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

  if (!template) {
    return res.status(400).json({ error: 'Email template required' });
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  // Track results with details
  const results = {
    sent: 0,
    failed: 0,
    details: []
  };

  // Simple plain text email wrapper (no branding template)
  const createPlainEmail = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; font-size: 16px; line-height: 1.8; color: #333333;">
    ${content.replace(/\n/g, '<br>')}
  </div>
</body>
</html>
`;

  // Branded email template
  const createBrandedEmail = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Tee Elite Circle</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: 'Georgia', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF8F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a2f23; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.2em; color: #e8ccc8; font-style: italic;">TMac Inspired presents</p>
              <h1 style="margin: 0; font-size: 28px; font-weight: 400; color: #ffffff; letter-spacing: 0.05em;">The Tee Elite Circle</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 48px;">
              <div style="font-size: 15px; line-height: 1.8; color: #555555;">
                ${content.replace(/\n/g, '<br>')}
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a2f23; padding: 32px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff;">The Tee Elite Circle</p>
              <p style="margin: 0 0 16px 0; font-size: 11px; letter-spacing: 0.15em; color: #e8ccc8;">WHERE GOLF MEETS GREATNESS</p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">A TMac Inspired Experience</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  // Send emails with PROPER rate limiting for Gmail
  // Gmail Workspace allows ~2000/day but recommends max 20/minute to avoid issues
  const DELAY_BETWEEN_EMAILS = 3000; // 3 seconds between each email (20 per minute)
  
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const timestamp = new Date().toISOString();
    
    // Replace {first_name} placeholder
    const firstName = contact.first_name || 'there';
    const personalizedContent = template.replace(/{first_name}/gi, firstName);
    
    // Choose template style
    const htmlContent = useTemplate 
      ? createBrandedEmail(personalizedContent) 
      : createPlainEmail(personalizedContent);

    const mailOptions = {
      from: `"Dr. TMac" <${process.env.GMAIL_USER}>`,
      to: contact.email,
      subject: subject,
      html: htmlContent
    };

    try {
      await transporter.sendMail(mailOptions);
      results.sent++;
      results.details.push({
        email: contact.email,
        name: contact.first_name || '',
        status: 'sent',
        timestamp
      });
    } catch (error) {
      results.failed++;
      results.details.push({
        email: contact.email,
        name: contact.first_name || '',
        status: 'failed',
        error: error.message,
        timestamp
      });
    }
    
    // Wait between emails to respect Gmail rate limits
    if (i < contacts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS));
    }
  }

  return res.status(200).json({
    success: true,
    message: `Campaign complete: ${results.sent} sent, ${results.failed} failed`,
    results
  });
};
