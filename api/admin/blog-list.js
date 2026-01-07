const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Use scheduled_for for ordering (with fallback to created_at)
    const result = await client.query(
      'SELECT * FROM blog_posts ORDER BY COALESCE(scheduled_for, created_at) DESC'
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('List blog posts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
