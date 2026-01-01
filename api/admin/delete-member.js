const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const memberId = req.query.id || req.body?.id;

  if (!memberId) {
    return res.status(400).json({ error: 'Member ID required' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Delete from members table
    const memberResult = await client.query(
      'DELETE FROM members WHERE id = $1',
      [memberId]
    );

    // Delete from applications table (if exists)
    await client.query(
      'DELETE FROM applications WHERE id = $1',
      [memberId]
    );

    if (memberResult.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Member deleted successfully'
    });

  } catch (error) {
    console.error('Delete member error:', error);
    return res.status(500).json({ error: 'Failed to delete member: ' + error.message });
  } finally {
    await client.end();
  }
};
