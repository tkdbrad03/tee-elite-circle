const { Client } = require('pg');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  
  try {
    client = new Client({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Update December 25-29 posts with their correct scheduled dates
    const queries = [
      `UPDATE blog_posts SET scheduled_for = '2025-12-25 06:00:00' WHERE title LIKE '%December 25, 2025%'`,
      `UPDATE blog_posts SET scheduled_for = '2025-12-26 06:00:00' WHERE title LIKE '%December 26, 2025%'`,
      `UPDATE blog_posts SET scheduled_for = '2025-12-27 06:00:00' WHERE title LIKE '%December 27, 2025%'`,
      `UPDATE blog_posts SET scheduled_for = '2025-12-28 06:00:00' WHERE title LIKE '%December 28, 2025%'`,
      `UPDATE blog_posts SET scheduled_for = '2025-12-29 06:00:00' WHERE title LIKE '%December 29, 2025%'`
    ];

    let totalUpdated = 0;

    for (const query of queries) {
      const result = await client.query(query);
      totalUpdated += result.rowCount || 0;
    }

    return res.status(200).json({ 
      success: true, 
      message: `Successfully updated ${totalUpdated} posts`,
      updated: totalUpdated
    });

  } catch (error) {
    console.error('Fix dates error:', error);
    return res.status(500).json({ 
      error: 'Database error',
      message: error.message,
      details: error.toString()
    });
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
  }
};
