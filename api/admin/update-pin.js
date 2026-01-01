const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, new_pin } = req.body;

  if (!member_id || !new_pin) {
    return res.status(400).json({ error: 'Member ID and new pin required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check if new pin is already taken in applications
    const existingAppPin = await client.query(
      'SELECT id FROM applications WHERE pin_number = $1 AND id != $2',
      [new_pin, member_id]
    );
    
    if (existingAppPin.rows.length > 0) {
      return res.status(400).json({ error: `Pin #${String(new_pin).padStart(2, '0')} is already assigned to another member` });
    }

    // Check if new pin is already taken in members
    const existingMemberPin = await client.query(
      'SELECT id FROM members WHERE pin_number = $1 AND id != $2',
      [new_pin, member_id]
    );
    
    if (existingMemberPin.rows.length > 0) {
      return res.status(400).json({ error: `Pin #${String(new_pin).padStart(2, '0')} is already assigned to another member` });
    }

    // Update pin in applications table
    await client.query(
      'UPDATE applications SET pin_number = $1 WHERE id = $2',
      [new_pin, member_id]
    );

    // Update pin in members table
    await client.query(
      'UPDATE members SET pin_number = $1 WHERE id = $2',
      [new_pin, member_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Pin updated successfully',
      new_pin: new_pin
    });

  } catch (error) {
    console.error('Update pin error:', error);
    return res.status(500).json({ error: 'Failed to update pin: ' + error.message });
  } finally {
    await client.end();
  }
};
