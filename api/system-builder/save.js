const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
  }
  return client;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, data } = req.body;

    if (!email || !data) {
      return res.status(400).json({ error: 'Email and data are required' });
    }

    const db = await connectDB();

    // Create table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_builder_responses (
        id SERIAL PRIMARY KEY,
        member_email VARCHAR(255) NOT NULL,
        system_name VARCHAR(500),
        system_type VARCHAR(100),
        help_with TEXT,
        makes_easy TEXT,
        solved_twice TEXT,
        thanked_for TEXT,
        outcome TEXT,
        helps_people TEXT,
        components JSONB,
        boundaries JSONB,
        commitment_date DATE,
        allowing JSONB,
        reflection_1 TEXT,
        reflection_2 TEXT,
        reflection_3 TEXT,
        full_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if member already has a response
    const existing = await db.query(
      'SELECT id FROM system_builder_responses WHERE member_email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      // Update existing response
      await db.query(`
        UPDATE system_builder_responses SET
          system_name = $1,
          system_type = $2,
          help_with = $3,
          makes_easy = $4,
          solved_twice = $5,
          thanked_for = $6,
          outcome = $7,
          helps_people = $8,
          components = $9,
          boundaries = $10,
          commitment_date = $11,
          allowing = $12,
          reflection_1 = $13,
          reflection_2 = $14,
          reflection_3 = $15,
          full_data = $16,
          updated_at = CURRENT_TIMESTAMP
        WHERE member_email = $17
      `, [
        data.systemName || null,
        data.systemType || null,
        data.helpWith || null,
        data.makesEasy || null,
        data.solvedTwice || null,
        data.thankedFor || null,
        data.outcome || null,
        data.helpsPeople || null,
        JSON.stringify(data.components || []),
        JSON.stringify(data.boundaries || []),
        data.commitmentDate || null,
        JSON.stringify(data.allowing || []),
        data.reflection1 || null,
        data.reflection2 || null,
        data.reflection3 || null,
        JSON.stringify(data),
        email
      ]);

      return res.status(200).json({ 
        success: true, 
        message: 'System updated successfully' 
      });
    } else {
      // Insert new response
      const result = await db.query(`
        INSERT INTO system_builder_responses (
          member_email, system_name, system_type, help_with, makes_easy,
          solved_twice, thanked_for, outcome, helps_people, components,
          boundaries, commitment_date, allowing, reflection_1, reflection_2,
          reflection_3, full_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `, [
        email,
        data.systemName || null,
        data.systemType || null,
        data.helpWith || null,
        data.makesEasy || null,
        data.solvedTwice || null,
        data.thankedFor || null,
        data.outcome || null,
        data.helpsPeople || null,
        JSON.stringify(data.components || []),
        JSON.stringify(data.boundaries || []),
        data.commitmentDate || null,
        JSON.stringify(data.allowing || []),
        data.reflection1 || null,
        data.reflection2 || null,
        data.reflection3 || null,
        JSON.stringify(data)
      ]);

      return res.status(201).json({ 
        success: true, 
        message: 'System saved successfully',
        id: result.rows[0].id
      });
    }

  } catch (error) {
    console.error('System Builder Save Error:', error);
    return res.status(500).json({ error: 'Failed to save system data' });
  }
};
