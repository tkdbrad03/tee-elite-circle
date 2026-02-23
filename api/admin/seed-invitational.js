const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.query.secret !== 'seedTEE418') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Pass ?email=your@email.com&secret=seedTEE418' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    await client.query(`CREATE TABLE IF NOT EXISTS invitational_payments (email TEXT PRIMARY KEY, paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

    await client.query(
      `INSERT INTO invitational_payments (email, paid_at) VALUES ($1, NOW()) ON CONFLICT (email) DO UPDATE SET paid_at = NOW()`,
      [email.toLowerCase().trim()]
    );

    return res.status(200).json({ success: true, message: 'Seeded: ' + email });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
