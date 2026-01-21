// api/retreat-interest.js
// Vercel serverless function to save retreat interest

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, zone, retreatType } = req.body;

    if (!email || !zone || !retreatType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert retreat interest
    const result = await sql`
      INSERT INTO retreat_interest 
        (email, zone, retreat_type, created_at)
      VALUES 
        (${email}, ${zone}, ${retreatType}, NOW())
      RETURNING id, created_at
    `;

    // Get count of interested people for this retreat type
    const countResult = await sql`
      SELECT COUNT(*) as count 
      FROM retreat_interest 
      WHERE retreat_type = ${retreatType}
    `;

    const interestCount = parseInt(countResult.rows[0].count);

    // Send confirmation email
    await sendRetreatConfirmation(email, retreatType, interestCount);

    return res.status(200).json({
      success: true,
      id: result.rows[0].id,
      interestCount: interestCount,
      message: `${interestCount} ${interestCount === 1 ? 'person' : 'people'} interested in the ${retreatType} retreat`
    });

  } catch (error) {
    console.error('Error saving retreat interest:', error);
    return res.status(500).json({ 
      error: 'Failed to save retreat interest',
      details: error.message 
    });
  }
}

async function sendRetreatConfirmation(email, retreatType, count) {
  console.log(`Send retreat confirmation to ${email} - Type: ${retreatType}, Count: ${count}`);
  
  // TODO: Integrate with your email service
  const emailContent = {
    to: email,
    subject: `You're on the list for the ${retreatType.toUpperCase()} Retreat`,
    html: `
      <h2>Thank you for your interest!</h2>
      <p>You're now on the waitlist for the ${retreatType.toUpperCase()} Retreat.</p>
      <p>We currently have ${count} ${count === 1 ? 'person' : 'people'} interested. We'll notify you when we're ready to launch.</p>
      <p>In the meantime, continue your journey at <a href="https://tmacmastermind.com">tmacmastermind.com</a></p>
    `
  };

  // await emailService.send(emailContent);
}
