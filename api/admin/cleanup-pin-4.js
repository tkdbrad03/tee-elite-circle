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
    await client.connect();

    // Find who has Pin #4
    const appResult = await client.query(
      'SELECT id, full_name, email, pin_number FROM applications WHERE pin_number = 4'
    );

    const memberResult = await client.query(
      'SELECT id, name, email, pin_number FROM members WHERE pin_number = 4'
    );

    let freed = false;
    let details = {};

    // If there's a record in applications with Pin #4
    if (appResult.rows.length > 0) {
      const record = appResult.rows[0];
      details.applications = record;
      
      // Delete it
      await client.query('DELETE FROM applications WHERE pin_number = 4');
      freed = true;
    }

    // If there's a record in members with Pin #4
    if (memberResult.rows.length > 0) {
      const record = memberResult.rows[0];
      details.members = record;
      
      // Delete it
      await client.query('DELETE FROM members WHERE pin_number = 4');
      freed = true;
    }

    if (!freed) {
      return res.status(200).json({
        message: 'Pin #4 is already available - no records found',
        freed: false
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pin #4 is now available',
      freed: true,
      deleted_records: details
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: 'Cleanup failed: ' + error.message });
  } finally {
    await client.end();
  }
};
