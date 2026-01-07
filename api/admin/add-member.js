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

    const { 
      full_name, 
      email, 
      phone, 
      location, 
      pin_number
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !location || !pin_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if pin number is already taken in applications
    const existingAppPin = await client.query(
      'SELECT id FROM applications WHERE pin_number = $1',
      [pin_number]
    );
    
    if (existingAppPin.rows.length > 0) {
      return res.status(400).json({ error: `Pin #${String(pin_number).padStart(2, '0')} is already assigned` });
    }

    // Check if pin number is already taken in members
    const existingMemberPin = await client.query(
      'SELECT id FROM members WHERE pin_number = $1',
      [pin_number]
    );
    
    if (existingMemberPin.rows.length > 0) {
      return res.status(400).json({ error: `Pin #${String(pin_number).padStart(2, '0')} is already assigned` });
    }

    // Check if email already exists in applications
    const existingAppEmail = await client.query(
      'SELECT id FROM applications WHERE email = $1',
      [email]
    );
    
    if (existingAppEmail.rows.length > 0) {
      return res.status(400).json({ error: 'A member with this email already exists' });
    }

    // Check if email already exists in members
    const existingMemberEmail = await client.query(
      'SELECT id FROM members WHERE email = $1',
      [email]
    );
    
    if (existingMemberEmail.rows.length > 0) {
      return res.status(400).json({ error: 'A member account with this email already exists' });
    }

    // Insert into applications table
    const appResult = await client.query(
      `INSERT INTO applications (
        full_name,
        email,
        phone,
        location,
        pin_number,
        paid_in_full,
        deposit_paid,
        interest_level,
        status,
        golf_relationship,
        season_of_life,
        what_draws_you,
        what_to_elevate,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING id`,
      [
        full_name,
        email,
        phone || null,
        location,
        pin_number,
        true,
        true,
        'Ready to secure my founding seat',
        'member',
        'Founding Member - Direct Add',
        'Founding Member',
        'Founding Member - Direct Add',
        'Founding Member - Direct Add'
      ]
    );

    // Generate temporary password
    const tempPassword = 'TeeElite' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create member account
    await client.query(
      `INSERT INTO members (email, password_hash, name, pin_number, bio, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [email, passwordHash, full_name, pin_number, '']
    );

    // Send welcome email with login credentials
    try {
      const emailContent = welcomeEmail(full_name, email, tempPassword, pin_number);
      await sendEmail({
        to: email,
        subject: emailContent.subject,
        content: emailContent.content
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
      // Don't fail the request if email fails
    }

    return res.status(200).json({ 
      success: true, 
      id: appResult.rows[0].id,
      email: email,
      temp_password: tempPassword,
      pin_number: pin_number,
      message: 'Member added and account created successfully'
    });

  } catch (error) {
    console.error('Error adding member:', error);
    return res.status(500).json({ error: 'Failed to add member' });
  } finally {
    await client.end();
  }
};
