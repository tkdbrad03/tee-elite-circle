const { sql } = require('@vercel/postgres');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = getSessionFromRequest(req);

    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify session and get member
    const sessionCheck = await sql`
      SELECT member_id FROM sessions 
      WHERE token = ${sessionToken} AND expires_at > NOW()
    `;

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const currentMemberId = sessionCheck.rows[0].member_id;
    const { type, limit } = req.query;
    const postLimit = parseInt(limit) || 50;

    let result;
    
    if (type === 'discussion') {
      result = await sql`
        SELECT 
          p.id, p.title, p.content, p.category, p.image_url, p.created_at,
          m.name as author_name, m.pin_number as author_pin, m.photo_url as author_photo,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p
        JOIN members m ON p.member_id = m.id
        WHERE p.post_type = 'discussion'
        ORDER BY p.created_at DESC
        LIMIT ${postLimit}
      `;
    } else {
      result = await sql`
        SELECT 
          p.id, p.content, p.image_url, p.post_type, p.created_at,
          m.name as author_name, m.pin_number as author_pin, m.photo_url as author_photo,
          (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
          EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.member_id = ${currentMemberId}) as liked
        FROM posts p
        JOIN members m ON p.member_id = m.id
        WHERE p.post_type = 'win'
        ORDER BY p.created_at DESC
        LIMIT ${postLimit}
      `;
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get posts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
