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

    const result = await client.query(
      `SELECT id, name, tagline, points, cap, available_now, drive_url
       FROM wallet_items
       WHERE active = true
       ORDER BY sort_order ASC, created_at ASC`
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Wallet items public error:', err);
    return res.status(500).json({ error: 'Failed to load marketplace items' });
  } finally {
    await client.end();
  }
};
