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
    const { title, excerpt, content, image_url, published } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    await client.connect();

    const result = await client.query(
      `INSERT INTO blog_posts (title, excerpt, content, image_url, published)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, published, created_at`,
      [title, excerpt || '', content || '', image_url || '', published || false]
    );

    return res.status(200).json({ 
      success: true, 
      post: result.rows[0]
    });
  } catch (error) {
    console.error('Create blog post error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
