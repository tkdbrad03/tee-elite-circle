const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { post_id, content, title, category } = req.body;

  if (!post_id || !content) {
    return res.status(400).json({ error: 'Post ID and content required' });
  }

  // Get session token from cookie
  const cookies = req.headers.cookie || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : null;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get member from session
    const sessionResult = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionResult.rows[0].member_id;

    // Verify the post belongs to this member
    const postResult = await client.query(
      'SELECT member_id FROM posts WHERE id = $1',
      [post_id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postResult.rows[0].member_id !== memberId) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    // Update the post
    await client.query(
      'UPDATE posts SET content = $1, title = $2, category = $3, updated_at = NOW() WHERE id = $4',
      [content, title || null, category || 'general', post_id]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
