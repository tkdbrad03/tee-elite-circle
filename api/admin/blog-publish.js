const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { id, published } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    await client.connect();

    await client.query(
      'UPDATE blog_posts SET published = $1, updated_at = NOW() WHERE id = $2',
      [published, id]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Publish blog post error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
