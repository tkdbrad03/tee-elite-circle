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
    const { id, title, excerpt, content, image_url, video_url, published, scheduled_for } = req.body;

    if (!id || !title) {
      return res.status(400).json({ error: 'ID and title are required' });
    }

    await client.connect();

    const result = await client.query(
      `UPDATE blog_posts 
       SET title = $1, excerpt = $2, content = $3, image_url = $4, video_url = $5, published = $6, scheduled_for = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING id, title, published, scheduled_for, updated_at`,
      [title, excerpt || '', content || '', image_url || '', video_url || '', published || false, scheduled_for || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    return res.status(200).json({ 
      success: true, 
      post: result.rows[0]
    });
  } catch (error) {
    console.error('Update blog post error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
