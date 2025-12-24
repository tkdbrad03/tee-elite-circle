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

    // Auto-publish any scheduled posts whose time has come
    await client.query(
      `UPDATE blog_posts 
       SET published = true, scheduled_for = NULL 
       WHERE published = false 
       AND scheduled_for IS NOT NULL 
       AND scheduled_for <= NOW()`
    );

    // Get published blog posts - public access, no auth required
    // Try to order by is_pinned first, fall back if column doesn't exist
    let result;
    try {
      result = await client.query(
        'SELECT id, title, excerpt, content, image_url, video_url, is_pinned, created_at FROM blog_posts WHERE published = true ORDER BY is_pinned DESC NULLS LAST, created_at DESC'
      );
    } catch (columnError) {
      // Fallback if is_pinned column doesn't exist yet
      result = await client.query(
        'SELECT id, title, excerpt, content, image_url, video_url, created_at FROM blog_posts WHERE published = true ORDER BY created_at DESC'
      );
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get blog posts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
