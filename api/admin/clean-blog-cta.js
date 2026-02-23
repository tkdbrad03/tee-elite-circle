const { Client } = require(‘pg’);

module.exports = async (req, res) => {
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
// Fetch all posts that contain the CTA
const fetchResult = await client.query(`
  SELECT id, title, content
  FROM blog_posts
  WHERE content ILIKE '%tmacmastermind%'
     OR content ILIKE '%APPLY FOR MEMBERSHIP%'
     OR content ILIKE '%landing.html#apply%'
`);

if (fetchResult.rows.length === 0) {
  return res.status(200).json({ message: 'No posts found with CTA. Already clean!', updated: 0 });
}

let updatedCount = 0;

for (const post of fetchResult.rows) {
  let cleaned = post.content;

  // Remove everything from the CTA block onward
  // The CTA always appears at the end of the post content
  const markers = [
    'Listen to This Episode',
    'Ready to be in the room',
    'APPLY FOR MEMBERSHIP',
    'Apply for Membership',
    'tmacmastermind.com/landing',
    'landing.html#apply'
  ];

  for (const marker of markers) {
    const idx = cleaned.indexOf(marker);
    if (idx !== -1) {
      // Walk back to find the opening tag before this marker
      const before = cleaned.substring(0, idx);
      const lastTag = before.lastIndexOf('<');
      if (lastTag !== -1) {
        cleaned = cleaned.substring(0, lastTag).trimEnd();
      }
      break;
    }
  }

  if (cleaned !== post.content) {
    await client.query(
      'UPDATE blog_posts SET content = $1, updated_at = NOW() WHERE id = $2',
      [cleaned, post.id]
    );
    updatedCount++;
  }
}

return res.status(200).json({
  message: `Success! CTA removed from ${updatedCount} post(s).`,
  updated: updatedCount,
  posts: fetchResult.rows.map(r => ({ id: r.id, title: r.title }))
});
```

} catch (error) {
console.error(‘Clean CTA error:’, error);
return res.status(500).json({ error: error.message });
} finally {
await client.end();
}
};
