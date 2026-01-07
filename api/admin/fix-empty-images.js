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
    await client.connect();

    // Fix empty image_url values - set them to NULL
    const updateResult = await client.query(`
      UPDATE blog_posts 
      SET image_url = NULL 
      WHERE image_url = '' OR image_url = 'null'
    `);

    // Get summary of all posts
    const summaryResult = await client.query(`
      SELECT 
        id, 
        title,
        CASE WHEN image_url IS NULL OR image_url = '' THEN false ELSE true END as has_image,
        CASE WHEN video_url IS NULL OR video_url = '' THEN false ELSE true END as has_video,
        LENGTH(image_url) as image_url_length,
        LENGTH(video_url) as video_url_length
      FROM blog_posts 
      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      message: `Fixed ${updateResult.rowCount} posts with empty image_url`,
      posts: summaryResult.rows
    });

  } catch (error) {
    console.error('Fix image URLs error:', error);
    return res.status(500).json({ 
      error: 'Failed to fix image URLs',
      details: error.message 
    });
  } finally {
    await client.end();
  }
};
