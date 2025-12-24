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
    const { id, pin } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    await client.connect();

    if (pin) {
      // Unpin all posts first (only one can be pinned)
      await client.query('UPDATE blog_posts SET is_pinned = false WHERE is_pinned = true');
      
      // Pin the requested post
      await client.query('UPDATE blog_posts SET is_pinned = true WHERE id = $1', [id]);
    } else {
      // Just unpin this post
      await client.query('UPDATE blog_posts SET is_pinned = false WHERE id = $1', [id]);
    }

    return res.status(200).json({ 
      success: true, 
      message: pin ? 'Post pinned successfully' : 'Post unpinned successfully'
    });
  } catch (error) {
    console.error('Toggle pin error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
