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

    if (req.query.inspect === '1') {
      const fetched = await client.query(
        'SELECT id, title, RIGHT(content, 800) as tail FROM blog_posts WHERE id IN (65, 94)'
      );
      return res.status(200).json(fetched.rows);
    }

    if (req.query.clean === 'cleanCTA2026') {
      const fetched = await client.query(
        "SELECT id, title, content FROM blog_posts WHERE content ILIKE '%tmacmastermind%' OR content ILIKE '%APPLY FOR MEMBERSHIP%' OR content ILIKE '%landing.html#apply%'"
      );
      var count = 0;
      var markers = ['Listen to This Episode', 'Ready to be in the room', 'APPLY FOR MEMBERSHIP', 'Apply for Membership', 'tmacmastermind.com/landing', 'landing.html#apply'];
      for (var i = 0; i < fetched.rows.length; i++) {
        var post = fetched.rows[i];
        var cleaned = post.content;
        for (var m = 0; m < markers.length; m++) {
          var idx = cleaned.indexOf(markers[m]);
          if (idx !== -1) {
            var before = cleaned.substring(0, idx);
            var lastTag = before.lastIndexOf('<');
            if (lastTag !== -1) { cleaned = cleaned.substring(0, lastTag).trimEnd(); }
            break;
          }
        }
        if (cleaned !== post.content) {
          await client.query('UPDATE blog_posts SET content = $1, updated_at = NOW() WHERE id = $2', [cleaned, post.id]);
          count++;
        }
      }
      return res.status(200).json({ message: 'Done! Cleaned ' + count + ' posts.' });
    }

    const result = await client.query(
      'SELECT * FROM blog_posts ORDER BY COALESCE(scheduled_for, created_at) DESC'
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('List blog posts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
