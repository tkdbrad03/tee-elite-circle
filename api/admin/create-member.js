const { Client } = require('pg');
const bcrypt = require('bcryptjs');
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

    const { application_id } = req.body;

    if (!application_id) {
      return res.status(400).json({ error: 'Application ID required' });
    }

    // Get application
    const appResult = await client.query(
      'SELECT * FROM applications WHERE id = $1',
      [application_id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appResult.rows[0];

    // Check if member already exists
    const existingMember = await client.query(
      'SELECT id FROM members WHERE email = $1',
      [application.email]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'Member account already exists for this email' });
    }

    // Get next pin number
    const pinResult = await client.query(
      'SELECT COALESCE(MAX(pin_number), 0) + 1 as next_pin FROM members'
    );
    const nextPin = pinResult.rows[0].next_pin;

    // Generate temporary password
    const tempPassword = 'TeeElite' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create member account
    await client.query(
      `INSERT INTO members (email, password_hash, name, pin_number, bio, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [application.email, passwordHash, application.full_name, nextPin, '']
    );

    // Update application status
    await client.query(
      `UPDATE applications SET paid_in_full = true, deposit_paid = true, status = 'member', updated_at = NOW() WHERE id = $1`,
      [application_id]
    );

    // Send welcome email with login credentials
    try {
      const emailContent = welcomeEmail(application.full_name, application.email, tempPassword, nextPin);
      await sendEmail({
        to: application.email,
        subject: emailContent.subject,
        content: emailContent.content
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      success: true,
      email: application.email,
      temp_password: tempPassword,
      pin_number: nextPin
    });

  } catch (error) {
    console.error('Create member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
