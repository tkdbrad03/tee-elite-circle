const { Pool } = require('pg');
const { sendEmail, ADMIN_EMAIL } = require('./lib/email');

// Database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table for audit results
async function initAuditTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS matriarch_audits (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        score INTEGER NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        answers JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_email ON matriarch_audits(email);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON matriarch_audits(created_at DESC);
    `);
  } finally {
    client.release();
  }
}

// Email templates for audit results
const auditResultsEmail = (firstName, score, category, description) => ({
  subject: `Your Matriarch Audit Results — ${category}`,
  content: `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 100px; height: 100px; border: 3px solid #b59a5d; border-radius: 50%; line-height: 94px; text-align: center;">
        <span style="color: #b59a5d; font-size: 42px; font-weight: bold; font-family: Georgia, serif;">${score}</span>
      </div>
    </div>
    
    <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 400; color: #1a1a1a; text-align: center;">${firstName}, You Are...</h2>
    <p style="margin: 0 0 32px 0; font-size: 18px; color: #b59a5d; text-align: center; letter-spacing: 0.1em; text-transform: uppercase; font-weight: bold;">${category}</p>
    
    <div style="margin: 32px 0; padding: 32px; background-color: #fdfdfd; border-left: 4px solid #b59a5d;">
      <p style="margin: 0; font-size: 16px; line-height: 1.8; color: #4a4a4a; font-style: italic;">
        ${description}
      </p>
    </div>
    
    <h3 style="margin: 32px 0 20px 0; font-size: 22px; font-weight: 400; color: #1a1a1a;">What This Means For You</h3>
    
    ${score <= 40 ? `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
        You're capable of more than your current circumstances reflect. The gap between where you are and where you're meant to be isn't about effort — it's about environment and permission.
      </p>
      
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
        <strong>What you need most:</strong> A room that gives you permission to stop shrinking. A space where ambition is expected, not explained.
      </p>
      
      <div style="margin: 24px 0; padding: 24px; background-color: #f7f0ef;">
        <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
          <strong>The Tee Elite Circle is built for women like you:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
          <li>Who've been playing small while dreaming big</li>
          <li>Who need proximity to women operating at scale</li>
          <li>Who are ready to stop asking for permission to rise</li>
        </ul>
      </div>
    ` : score <= 65 ? `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
        You're building something real, but you're still editing yourself. You have the vision and the drive, but you're navigating alone in rooms that don't reflect your ambition.
      </p>
      
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
        <strong>What you need most:</strong> Strategic proximity. A room where your goals aren't impressive — they're expected. Where women are building at your level and beyond.
      </p>
      
      <div style="margin: 24px 0; padding: 24px; background-color: #f7f0ef;">
        <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
          <strong>The Tee Elite Circle accelerates what you're already building:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
          <li>Elite proximity to women operating at 7+ figure scale</li>
          <li>Strategic golf networking with real business outcomes</li>
          <li>Curated retreats designed for elevation, not education</li>
        </ul>
      </div>
    ` : `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
        You don't need more hustle. You don't need another strategy. What you need is a room that matches your operating level — where the women beside you understand the game you're playing.
      </p>
      
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
        <strong>What you need most:</strong> Peer proximity at scale. Golf as the vehicle. Business, wealth, and legacy as the outcome.
      </p>
      
      <div style="margin: 24px 0; padding: 24px; background-color: #f7f0ef;">
        <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
          <strong>The Tee Elite Circle is designed for women at your level:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
          <li>Where $15K annual investment is a strategic decision, not a sacrifice</li>
          <li>Where golf isn't recreation — it's relationship capital</li>
          <li>Where the women in the room are building empires, not side hustles</li>
        </ul>
      </div>
    `}
    
    <div style="margin: 40px 0; padding: 40px; background-color: #1a1a1a; text-align: center;">
      <p style="margin: 0 0 20px 0; font-size: 14px; letter-spacing: 0.15em; color: #b59a5d; text-transform: uppercase;">The Tee Elite Circle</p>
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.8; color: #ffffff;">
        A $15,000 annual mastermind where accomplished women entrepreneurs use golf as a vehicle for business networking, wealth building, and legacy creation.
      </p>
      <a href="https://tmacmastermind.com/tee-room.html" style="display: inline-block; background-color: #b59a5d; color: #1a1a1a; text-decoration: none; padding: 16px 40px; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: bold;">Apply to The Circle</a>
    </div>
    
    <div style="margin: 32px 0; padding: 24px; border: 2px solid #e8ccc8; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #b59a5d; letter-spacing: 0.1em; text-transform: uppercase;">Limited to 12 Founding Members</p>
      <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #4a4a4a;">
        Selection based on alignment, ambition, and readiness to play at the highest level.
      </p>
    </div>
    
    <p style="margin: 32px 0 0 0; font-size: 15px; line-height: 1.8; color: #4a4a4a;">
      ${firstName}, this isn't about what you're capable of — you already know that.<br><br>
      This is about who you become when you're surrounded by women who reflect your ambition back to you.<br><br>
      See you on the course,<br>
      <strong style="color: #1a1a1a;">Dr. TMac 🏌🏽‍♀️</strong><br>
      <span style="font-size: 13px; color: #b59a5d;">Founder, The Tee Elite Circle</span>
    </p>
  `
});

const adminAuditNotificationEmail = (firstName, email, score, category, answers) => ({
  subject: `New Matriarch Audit: ${firstName} — ${category} (${score}/80)`,
  content: `
    <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 400; color: #2C2C2C;">New Audit Completed</h2>
    
    <div style="margin: 0 0 24px 0; padding: 24px; background-color: #f7f0ef;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Name:</strong> ${firstName}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Score:</strong> ${score}/80</p>
      <p style="margin: 0; font-size: 14px; color: #555555;"><strong>Category:</strong> <span style="color: #b59a5d; font-weight: 600;">${category}</span></p>
    </div>
    
    <h3 style="margin: 24px 0 16px 0; font-size: 18px; font-weight: 400; color: #2C2C2C;">Individual Scores</h3>
    <div style="margin: 0 0 24px 0; padding: 20px; background-color: #fff; border: 1px solid #e0e0e0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">1. Revenue Authority: ${answers.q1}/10</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">2. Time Sovereignty: ${answers.q2}/10</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">3. Wealth Conviction: ${answers.q3}/10</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">4. Strategic Proximity: ${answers.q4}/10</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">5. Energy Ownership: ${answers.q5}/10</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">6. Decisive Autonomy: ${answers.q6}/10</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #555555;">7. Audacity of Action: ${answers.q7}/10</p>
      <p style="margin: 0; font-size: 13px; color: #555555;">8. Core Alignment: ${answers.q8}/10</p>
    </div>
    
    <div style="margin: 24px 0; padding: 24px; background-color: ${score <= 40 ? '#fff3cd' : score <= 65 ? '#d1ecf1' : '#d4edda'}; border-left: 4px solid ${score <= 40 ? '#ffc107' : score <= 65 ? '#17a2b8' : '#28a745'};">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #2C2C2C; text-transform: uppercase; letter-spacing: 0.05em;">
        ${score <= 40 ? 'Sleeping Matriarch' : score <= 65 ? 'Emerging Matriarch' : 'Modern Day Matriarch'}
      </p>
      <p style="margin: 0; font-size: 13px; color: #555555; line-height: 1.6;">
        ${score <= 40 ? 'Needs: Permission + Proximity' : score <= 65 ? 'Needs: Strategic Acceleration' : 'Needs: Elite Peer Room'}
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="https://tmacmastermind.com/admin.html" style="display: inline-block; background-color: #1a2f23; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">View Admin Panel</a>
    </div>
  `
});

// Main handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, email, score, category, description, answers, timestamp } = req.body;

    // Validate required fields
    if (!firstName || !email || !score || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize table if needed
    await initAuditTable();

    // Store in database
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO matriarch_audits (first_name, email, score, category, description, answers)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [firstName, email, score, category, description, JSON.stringify(answers)]
      );
    } finally {
      client.release();
    }

    // Send audit results email to user
    const userEmail = auditResultsEmail(firstName, score, category, description);
    await sendEmail({
      to: email,
      subject: userEmail.subject,
      content: userEmail.content
    });

    // Send notification to admin
    const adminEmail = adminAuditNotificationEmail(firstName, email, score, category, answers);
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: adminEmail.subject,
      content: adminEmail.content
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Audit results sent successfully' 
    });

  } catch (error) {
    console.error('Audit submission error:', error);
    return res.status(500).json({ 
      error: 'Failed to process audit',
      details: error.message 
    });
  }
};
