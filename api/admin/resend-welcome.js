const { Client } = require('pg');
const { sendEmail, welcomeEmail } = require('../lib/email');

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

    const { member_id } = req.body;

    if (!member_id) {
      return res.status(400).json({ error: 'Member ID required' });
    }

    // Get member details
    const result = await client.query(
      'SELECT id, email, name, pin_number FROM members WHERE id = $1',
      [member_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = result.rows[0];

    // Note: We can't retrieve the original password, so we send a "password reset" style email
    // Or you can generate a new temp password and update it

    // For now, send email with instructions to use "forgot password" or contact admin
    const emailContent = {
      subject: "Your Member Portal Access — The Tee Elite Circle",
      content: `
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 80px; height: 80px; border: 2px solid #e8ccc8; border-radius: 50%; line-height: 76px; text-align: center;">
            <span style="color: #a67c52; font-size: 32px; font-family: Georgia, serif;">#${String(member.pin_number).padStart(2, '0')}</span>
          </div>
        </div>
        
        <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 400; color: #2C2C2C; text-align: center;">Welcome, Founding Member</h2>
        <p style="margin: 0 0 32px 0; font-size: 14px; color: #a67c52; text-align: center; letter-spacing: 0.1em;">PIN #${String(member.pin_number).padStart(2, '0')}</p>
        
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
          ${member.name}, here's your updated portal access link.
        </p>
        
        <div style="margin: 32px 0; padding: 32px; background-color: #1a2f23; text-align: center;">
          <p style="margin: 0 0 20px 0; font-size: 12px; letter-spacing: 0.2em; color: #e8ccc8;">YOUR MEMBER PORTAL ACCESS</p>
          
          <p style="margin: 0 0 8px 0; font-size: 13px; color: rgba(255,255,255,0.7);">Email</p>
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #ffffff;">${member.email}</p>
          
          <a href="https://tmacmastermind.com/member-login.html" style="display: inline-block; background-color: #e8ccc8; color: #1a2f23; text-decoration: none; padding: 14px 32px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">Access Your Portal</a>
        </div>
        
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
          Use the password from your original welcome email. If you need a new password, please contact Dr. TMac.
        </p>
        
        <p style="margin: 0; font-size: 15px; line-height: 1.8; color: #555555;">
          See you on the green,<br>
          <strong style="color: #2C2C2C;">Dr. TMac</strong><br>
          <span style="font-size: 13px; color: #a67c52;">Founder, The Tee Elite Circle</span>
        </p>
      `
    };

    await sendEmail({
      to: member.email,
      subject: emailContent.subject,
      content: emailContent.content
    });

    return res.status(200).json({ 
      success: true, 
      message: `Welcome email resent to ${member.email}`
    });

  } catch (error) {
    console.error('Error resending welcome email:', error);
    return res.status(500).json({ error: 'Failed to resend email' });
  } finally {
    await client.end();
  }
};
