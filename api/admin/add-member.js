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
    } = req.body;

    // Validate required fields
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if pin number is already taken in applications
    );
    
    }

    // Check if pin number is already taken in members
    );
    
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
        true,
        true,
        Ready to join,
        'member',
        'Direct Add',
        'Player',
        'Direct Add',
        'Direct Add'
      ]
    );

    // Generate temporary password
    const tempPassword = 'TeeElite' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create member account
    await client.query(
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    );

    // Send welcome email with login credentials
    try {
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
      message: 'Member added and account created successfully'
    });

  } catch (error) {
    console.error('Error adding member:', error);
    return res.status(500).json({ error: 'Failed to add member' });
  } finally {
    await client.end();
  }
};
