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

    // Update December 25-29 posts
    const updates = [
      { title: '%December 25, 2025%', date: '2025-12-25 06:00:00' },
      { title: '%December 26, 2025%', date: '2025-12-26 06:00:00' },
      { title: '%December 27, 2025%', date: '2025-12-27 06:00:00' },
      { title: '%December 28, 2025%', date: '2025-12-28 06:00:00' },
      { title: '%December 29, 2025%', date: '2025-12-29 06:00:00' }
    ];

    let updated = 0;
    
    for (const update of updates) {
      const result = await client.query(
        'UPDATE blog_posts SET scheduled_for = $1 WHERE title LIKE $2',
        [update.date, update.title]
      );
      updated += result.rowCount;
    }

    return res.status(200).json({ 
      success: true, 
      message: `Updated ${updated} posts` 
    });
  } catch (error) {
    console.error('Fix dates error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
};
