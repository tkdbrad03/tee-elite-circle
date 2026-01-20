// api/save-assessment.js
// Vercel serverless function to save assessment responses

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, responses, scores, zone } = req.body;

    // Validate required fields
    if (!email || !responses || !scores || !zone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert assessment into database
    const result = await sql`
      INSERT INTO permission_assessments 
        (email, responses, scores, zone, created_at)
      VALUES 
        (${email}, ${JSON.stringify(responses)}, ${JSON.stringify(scores)}, ${zone}, NOW())
      RETURNING id, created_at
    `;

    // Send confirmation email (you can trigger this via your email service)
    await sendAssessmentEmail(email, zone, scores);

    return res.status(200).json({
      success: true,
      id: result.rows[0].id,
      timestamp: result.rows[0].created_at
    });

  } catch (error) {
    console.error('Error saving assessment:', error);
    return res.status(500).json({ 
      error: 'Failed to save assessment',
      details: error.message 
    });
  }
}

async function sendAssessmentEmail(email, zone, scores) {
  // TODO: Integrate with your email service (Nodemailer/SendGrid/etc)
  // For now, just log
  console.log(`Send assessment results email to ${email} - Zone: ${zone}`);
  
  // Example email content structure:
  const emailContent = {
    to: email,
    subject: `Your Permission Ecosystem Results: ${zone.toUpperCase()}`,
    html: `
      <h2>You're in the ${zone.toUpperCase()} stage</h2>
      <p>Your scores:</p>
      <ul>
        <li>Permission: ${scores.permission}</li>
        <li>Intimacy: ${scores.intimacy}</li>
        <li>Power: ${scores.power}</li>
      </ul>
      <p>View your full results and next steps: https://tmacmastermind.com/permission-assessment.html</p>
    `
  };

  // Actual email sending would happen here
  // await emailService.send(emailContent);
}
