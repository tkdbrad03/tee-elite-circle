const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
  }
  return client;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = await connectDB();

    const result = await db.query(
      'SELECT full_data, created_at, updated_at FROM system_builder_responses WHERE member_email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        found: false,
        message: 'No saved data found' 
      });
    }

    return res.status(200).json({
      found: true,
      data: result.rows[0].full_data,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    });

  } catch (error) {
    console.error('System Builder Get Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve system data' });
  }
};
