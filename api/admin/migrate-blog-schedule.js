const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Add scheduled_for column to blog_posts
    await client.query(`
      ALTER TABLE blog_posts 
      ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE
    `);

    return res.status(200).json({ 
      success: true, 
      message: 'Migration complete: scheduled_for column added to blog_posts'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
};
