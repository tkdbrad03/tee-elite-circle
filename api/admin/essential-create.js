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
    const { name, description, category, image_url, affiliate_url, display_order } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    await client.connect();

    const result = await client.query(
      `INSERT INTO golf_essentials (name, description, category, image_url, affiliate_url, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, category`,
      [name, description || '', category, image_url || '', affiliate_url || '', display_order || 0]
    );

    return res.status(200).json({ 
      success: true, 
      essential: result.rows[0]
    });
  } catch (error) {
    console.error('Create essential error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
