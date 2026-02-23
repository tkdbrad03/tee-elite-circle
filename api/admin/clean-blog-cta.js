const { Client } = require(‘pg’);

module.exports = async (req, res) => {
// Simple security check - must pass ?secret=cleanCTA2026
if (req.query.secret !== ‘cleanCTA2026’) {
return res.status(401).json({ error: ‘Unauthorized’ });
}

const client = new Client({
connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

try {
await client.connect();

```
// First, see how many posts have the CTA
const countResult = await client.query(`
  SELECT COUNT(*) as total
  FROM blog_posts
  WHERE content LIKE '%tmacmastermind%'
     OR content LIKE '%APPLY FOR MEMBERSHIP%'
     OR content LIKE '%Apply for Membership%'
     OR content LIKE '%landing.html#apply%'
`);

const total = parseInt(countResult.rows[0].total);

if (total === 0) {
  return res.status(200).json({ message: 'No posts found with CTA. Already clean!', updated: 0 });
}

// Remove the CTA block - handles variations of how it was saved by Quill editor
// Pattern covers the outer wrapper div with any content inside containing the membership link
const result = await client.query(`
  UPDATE blog_posts
  SET content = REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        content,
        '<[^>]*class="[^"]*blog-modal-apply[^"]*"[^>]*>.*?</[^>]+>',
        '',
        'gi'
      ),
      '<p[^>]*>\\s*Ready to be in the room[^<]*</p>\\s*<[^>]*>\\s*<a[^>]*landing\\.html#apply[^>]*>.*?</a>\\s*</[^>]*>',
      '',
      'gi'
    ),
    '<a[^>]*(?:tmacmastermind\\.com/landing\\.html#apply|landing\\.html#apply)[^>]*>.*?</a>',
    '',
    'gi'
  ),
  updated_at = NOW()
  WHERE content LIKE '%tmacmastermind%'
     OR content LIKE '%APPLY FOR MEMBERSHIP%'
     OR content LIKE '%Apply for Membership%'
     OR content LIKE '%landing.html#apply%'
  RETURNING id, title
`);

return res.status(200).json({
  message: `Success! CTA removed from ${result.rows.length} post(s).`,
  updated: result.rows.length,
  posts: result.rows.map(r => ({ id: r.id, title: r.title }))
});
```

} catch (error) {
console.error(‘Clean CTA error:’, error);
return res.status(500).json({ error: error.message });
} finally {
await client.end();
}
};
