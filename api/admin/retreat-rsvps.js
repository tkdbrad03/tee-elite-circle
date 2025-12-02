const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { retreat_id } = req.query;

  if (!retreat_id) {
    return res.status(400).json({ error: 'Retreat ID required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT 
        r.id,
        r.retreat_id,
        r.created_at,
        m.name as member_name,
        m.email as member_email
      FROM retreat_rsvps r
      JOIN members m ON r.member_id = m.id
      WHERE r.retreat_id = $1
      ORDER BY r.created_at DESC
    `, [retreat_id]);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get retreat RSVPs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
