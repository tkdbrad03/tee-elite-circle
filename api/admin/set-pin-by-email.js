const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, new_pin } = req.body;
  if (!email || !new_pin) return res.status(400).json({ error: 'email and new_pin required' });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // prevent duplicates
    const taken = await client.query(
      `SELECT 'members' as table, id FROM members WHERE pin_number = $1
       UNION ALL
       SELECT 'applications' as table, id FROM applications WHERE pin_number = $1`,
      [new_pin]
    );
    if (taken.rows.length) {
      return res.status(400).json({ error: `Pin #${String(new_pin).padStart(2,'0')} is already taken`, taken: taken.rows });
    }

    const m = await client.query('UPDATE members SET pin_number = $1 WHERE email = $2 RETURNING id, name, email, pin_number', [new_pin, email]);
    const a = await client.query('UPDATE applications SET pin_number = $1 WHERE email = $2 RETURNING id, full_name, email, pin_number', [new_pin, email]);

    return res.status(200).json({ success: true, members_updated: m.rows, applications_updated: a.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
