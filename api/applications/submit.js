const { Client } = require('pg');
const { sendEmail, applicationReceivedEmail } = require('../lib/email');

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

    const {
      full_name,
      email,
      phone,
      location,
      golf_relationship,
      season_of_life,
      what_draws_you,
      what_to_elevate,
      interest_level,
      anything_else
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !location || !golf_relationship || 
        !season_of_life || !what_draws_you || !what_to_elevate || !interest_level) {
      return res.status(400).json({ error: 'Please fill in all required fields' });
    }

    // Check if email already applied
    const existing = await client.query(
      'SELECT id FROM applications WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      // Update existing application
      await client.query(
        `UPDATE applications SET 
          full_name = $1,
          phone = $2,
          location = $3,
          golf_relationship = $4,
          season_of_life = $5,
          what_draws_you = $6,
          what_to_elevate = $7,
          interest_level = $8,
          anything_else = $9,
          updated_at = NOW()
        WHERE email = $10`,
        [full_name, phone, location, golf_relationship, season_of_life,
         what_draws_you, what_to_elevate, interest_level, anything_else, email.toLowerCase()]
      );
    } else {
      // Insert new application
      await client.query(
        `INSERT INTO applications 
          (full_name, email, phone, location, golf_relationship, season_of_life,
           what_draws_you, what_to_elevate, interest_level, anything_else)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [full_name, email.toLowerCase(), phone, location, golf_relationship,
         season_of_life, what_draws_you, what_to_elevate, interest_level, anything_else]
      );
    }

    // Determine redirect based on interest level
    let redirectUrl;
    
    if (interest_level === 'Ready to secure my founding seat') {
      // Direct to payment page
      redirectUrl = '/payment.html?email=' + encodeURIComponent(email);
    } else if (interest_level === 'Likely to join if dates and location align') {
      // Warm lead - thank you page
      redirectUrl = '/thank-you-warm.html';
    } else {
      // Curious - different thank you page
      redirectUrl = '/thank-you-curious.html';
    }

    // Send confirmation email
    try {
      const emailContent = applicationReceivedEmail(full_name);
      await sendEmail({
        to: email,
        subject: emailContent.subject,
        content: emailContent.content
      });
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
      // Don't fail the request if email fails
    }

    return res.status(200).json({ 
      success: true, 
      redirect: redirectUrl 
    });

  } catch (error) {
    console.error('Application submission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
