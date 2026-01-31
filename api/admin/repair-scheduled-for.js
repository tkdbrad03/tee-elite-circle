const { Client } = require('pg');

module.exports = async (req, res) => {
  // Basic protection so nobody random hits this endpoint
  const token = req.query.token || req.headers['x-repair-token'];
  if (!process.env.REPAIR_TOKEN || token !== process.env.REPAIR_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Repair: if scheduled_for was accidentally pushed forward, reset it to created_at
    const result = await client.query(`
      UPDATE blog_posts
      SET scheduled_for = created_at
      WHERE scheduled_for IS NOT NULL
        AND created_at IS NOT NULL
        AND scheduled_for > created_at
      RETURNING id, title, created_at, scheduled_for
    `);

    return res.status(200).json({
      success: true,
      repairedCount: result.rowCount || 0,
      repaired: result.rows
    });
  } catch (error) {
    console.error('Repair scheduled_for error:', error);
    return res.status(500).json({ error: 'Database error', message: error.message });
  } finally {
    await client.end();
  }
};
