// api/podcast-subscribe.js
const { Client } = require('pg');
const { sendEmail } = require('./lib/email');

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

    const { first_name, email } = req.body;

    if (!first_name || !email) {
      return res.status(400).json({ error: 'First name and email are required' });
    }

    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast_subscribers (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        subscribed_at TIMESTAMP DEFAULT NOW(),
        source VARCHAR(50) DEFAULT 'website'
      )
    `);

    // Check if email already exists
    const existing = await client.query(
      'SELECT id FROM podcast_subscribers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Already subscribed'
      });
    }

    // Insert new subscriber
    await client.query(
      `INSERT INTO podcast_subscribers (first_name, email, subscribed_at, source)
       VALUES ($1, $2, NOW(), 'website')`,
      [first_name, email]
    );

    // Send welcome email
    try {
      await sendWelcomeEmail(first_name, email);
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed'
    });

  } catch (error) {
    console.error('Error subscribing:', error);
    return res.status(500).json({ error: 'Failed to subscribe' });
  } finally {
    await client.end();
  }
};

async function sendWelcomeEmail(firstName, email) {
  const emailContent = {
    subject: 'Welcome to The Rich Friends Show',
    content: `
      <div style="text-align: center; margin-bottom: 32px;">
        <h2 style="font-size: 28px; font-weight: 400; color: #2d4a3a; margin-bottom: 20px;">Welcome, ${firstName}!</h2>
      </div>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-bottom: 24px;">
        Thank you for subscribing to The Rich Friends Show. You'll now get notified whenever a new episode drops.
      </p>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-bottom: 24px;">
        Every week, we explore power, wealth, relationships, and reinvention for women who refuse to settle.
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://player.captivate.fm/show/452103d8-0a8e-4298-9ec1-63e4805d83b6/" 
           style="display: inline-block; background: #2d4a3a; color: #faf8f5; text-decoration: none; padding: 16px 40px; border-radius: 4px; font-size: 16px;">
          Listen Now
        </a>
      </div>
      
      <p style="margin-top: 32px; font-size: 15px; color: #555555;">
        See you on the course,<br>
        <strong style="color: #2d4a3a;">Dr. TMac</strong>
      </p>
    `
  };

  await sendEmail({
    to: email,
    subject: emailContent.subject,
    content: emailContent.content
  });
}
