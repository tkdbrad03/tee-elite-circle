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

    const result = await client.query(`
      SELECT 
        cs.clinic_id,
        cs.created_at as signup_date,
        m.name as member_name,
        m.email as member_email
      FROM clinic_signups cs
      JOIN members m ON cs.member_id = m.id
      ORDER BY cs.clinic_id, cs.created_at
    `);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get clinic signups error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
