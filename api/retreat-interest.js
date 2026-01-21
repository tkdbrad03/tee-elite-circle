// api/retreat-interest.js
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

    const { email, zone, retreatType } = req.body;

    if (!email || !zone || !retreatType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS retreat_interest (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        zone VARCHAR(50) NOT NULL,
        retreat_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Check if this email already registered interest for this retreat type
    const existingInterest = await client.query(
      `SELECT id FROM retreat_interest WHERE email = $1 AND retreat_type = $2 LIMIT 1`,
      [email, retreatType]
    );

    if (existingInterest.rows.length > 0) {
      // Already registered - just return success without inserting again
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM retreat_interest WHERE retreat_type = $1`,
        [retreatType]
      );
      
      return res.status(200).json({
        success: true,
        message: 'Already registered',
        interestCount: parseInt(countResult.rows[0].count)
      });
    }

    // Insert retreat interest
    const result = await client.query(
      `INSERT INTO retreat_interest (email, zone, retreat_type, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, created_at`,
      [email, zone, retreatType]
    );

    // Get count of interested people
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM retreat_interest WHERE retreat_type = $1`,
      [retreatType]
    );

    const interestCount = parseInt(countResult.rows[0].count);

    // Send confirmation email
    try {
      await sendRetreatConfirmation(email, retreatType, interestCount);
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr);
    }

    return res.status(200).json({
      success: true,
      id: result.rows[0].id,
      interestCount: interestCount,
      message: `${interestCount} ${interestCount === 1 ? 'person' : 'people'} interested in the ${retreatType} retreat`
    });

  } catch (error) {
    console.error('Error saving retreat interest:', error);
    return res.status(500).json({ error: 'Failed to save retreat interest' });
  } finally {
    await client.end();
  }
};

async function sendRetreatConfirmation(email, retreatType, count) {
  const emailContent = {
    subject: `You're on the list for the ${retreatType.toUpperCase()} Retreat`,
    content: `
      <div style="text-align: center; margin-bottom: 32px;">
        <h2 style="font-size: 28px; font-weight: 400; color: #2d4a3a; margin-bottom: 20px;">Thank you for your interest!</h2>
      </div>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-bottom: 24px;">
        You're now on the waitlist for the ${retreatType.toUpperCase()} Retreat.
      </p>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-bottom: 24px;">
        We currently have ${count} ${count === 1 ? 'person' : 'people'} interested. We'll notify you when we're ready to launch.
      </p>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-top: 32px;">
        In the meantime, continue your journey at <a href="https://tmacmastermind.com" style="color: #2d4a3a;">tmacmastermind.com</a>
      </p>
      
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
