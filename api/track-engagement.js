const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table for engagement tracking
async function initEngagementTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_engagement (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_engagement_email ON audit_engagement(email);
      CREATE INDEX IF NOT EXISTS idx_engagement_type ON audit_engagement(event_type);
      CREATE INDEX IF NOT EXISTS idx_engagement_created ON audit_engagement(created_at DESC);
    `);
  } finally {
    client.release();
  }
}

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
    const { email, eventType, eventData } = req.body;

    // Validate required fields
    if (!email || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize table if needed
    await initEngagementTable();

    // Store engagement event
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO audit_engagement (email, event_type, event_data)
         VALUES ($1, $2, $3)`,
        [email, eventType, JSON.stringify(eventData || {})]
      );
    } finally {
      client.release();
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Event tracked successfully' 
    });

  } catch (error) {
    console.error('Engagement tracking error:', error);
    return res.status(500).json({ 
      error: 'Failed to track event',
      details: error.message 
    });
  }
};
