const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.query.secret !== 'migrateTEE2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS handicap TEXT`);
    await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS favorite_course TEXT`);

    return res.status(200).json({ success: true, message: 'Columns added: handicap, favorite_course' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
