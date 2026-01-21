// api/save-assessment.js
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

    const { email, responses, scores, zone } = req.body;

    if (!email || !responses || !scores || !zone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS permission_assessments (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        responses JSONB NOT NULL,
        scores JSONB NOT NULL,
        zone VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Check if this email already has an assessment
    const existingAssessment = await client.query(
      `SELECT id FROM permission_assessments WHERE email = $1 LIMIT 1`,
      [email]
    );

    const isFirstTime = existingAssessment.rows.length === 0;

    // Insert assessment
    const result = await client.query(
      `INSERT INTO permission_assessments (email, responses, scores, zone, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, created_at`,
      [email, JSON.stringify(responses), JSON.stringify(scores), zone]
    );

    // Only send email if this is their first assessment
    if (isFirstTime) {
      try {
        await sendAssessmentEmail(email, zone, scores);
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      id: result.rows[0].id,
      timestamp: result.rows[0].created_at,
      emailSent: isFirstTime
    });

  } catch (error) {
    console.error('Error saving assessment:', error);
    return res.status(500).json({ error: 'Failed to save assessment' });
  } finally {
    await client.end();
  }
};

async function sendAssessmentEmail(email, zone, scores) {
  const insights = {
    permission: "You're in the Permission stage. Right now, you're working through the question: Am I allowed? You're recognizing desires you've been editing, noticing where rest feels uncomfortable, and beginning to name truths you've kept quiet.",
    intimacy: "You're in the Intimacy stage. The question you're sitting with is: Can I trust myself? You've given yourself permission to want more, and now you're learning to trust your own voice without needing external validation.",
    power: "You're in the Power stage. Your question is: Will I take my seat? You trust yourself. You know what you want. Now the work is visibility, presence, and unapologetic receiving."
  };

  const emailContent = {
    subject: `Your Permission Ecosystem Results: ${zone.toUpperCase()}`,
    content: `
      <div style="text-align: center; margin-bottom: 32px;">
        <h2 style="font-size: 28px; font-weight: 400; color: #2d4a3a; margin-bottom: 20px;">You're in the ${zone.toUpperCase()} stage</h2>
      </div>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-bottom: 24px;">
        ${insights[zone]}
      </p>
      
      <div style="margin: 32px 0; padding: 24px; background-color: #f5f2ed;">
        <p style="font-size: 13px; color: #2d4a3a; margin-bottom: 16px;">Your scores:</p>
        <p style="font-size: 15px; color: #2d4a3a; margin: 8px 0;">Permission: ${scores.permission}</p>
        <p style="font-size: 15px; color: #2d4a3a; margin: 8px 0;">Intimacy: ${scores.intimacy}</p>
        <p style="font-size: 15px; color: #2d4a3a; margin: 8px 0;">Power: ${scores.power}</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.8; color: #555555; margin-top: 24px;">
        Keep this email for your reference. Your results are a starting point, not a destination.
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
