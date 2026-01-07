const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Add video_url column if it doesn't exist
    await client.query(`
      ALTER TABLE blog_posts 
      ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT ''
    `);

    return res.status(200).json({ 
      success: true, 
      message: 'Migration complete! video_url column added to blog_posts table.'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
};
