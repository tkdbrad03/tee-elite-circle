const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sessionToken = getSessionFromRequest(req);

    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await client.connect();

    // Verify session and get member
    const sessionCheck = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const currentMemberId = sessionCheck.rows[0].member_id;
    const { type, limit, id } = req.query;
    const postLimit = parseInt(limit) || 50;

    let result;
    
    // If ID is provided, fetch single post
    if (id) {
      result = await client.query(
        `SELECT 
          p.id, p.title, p.content, p.category, p.image_url, p.post_type, p.created_at, p.member_id,
          m.name as author_name, m.pin_number as author_pin, m.photo_url as author_photo,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p
        JOIN members m ON p.member_id = m.id
        WHERE p.id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      return res.status(200).json(result.rows[0]);
    }
    
    if (type === 'discussion') {
      result = await client.query(
        `SELECT 
          p.id, p.title, p.content, p.category, p.image_url, p.created_at, p.member_id,
          m.name as author_name, m.pin_number as author_pin, m.photo_url as author_photo,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p
        JOIN members m ON p.member_id = m.id
        WHERE p.post_type = 'discussion'
        ORDER BY p.created_at DESC
        LIMIT $1`,
        [postLimit]
      );
    } else {
      result = await client.query(
        `SELECT 
          p.id, p.content, p.image_url, p.post_type, p.created_at, p.member_id,
          m.name as author_name, m.pin_number as author_pin, m.photo_url as author_photo,
          (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
          EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.member_id = $1) as liked
        FROM posts p
        JOIN members m ON p.member_id = m.id
        WHERE p.post_type = 'win'
        ORDER BY p.created_at DESC
        LIMIT $2`,
        [currentMemberId, postLimit]
      );
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get posts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
