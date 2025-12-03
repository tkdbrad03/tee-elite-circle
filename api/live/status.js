const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for member session - but allow unauthenticated for admin panel
  // (admin panel uses localStorage, not session cookies)
  const sessionToken = getSessionFromRequest(req);

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check if table exists, if not return not live
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'live_status'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(200).json({ 
        is_live: false,
        room_name: null,
        topic: null,
        host_name: null,
        started_at: null
      });
    }

    const result = await client.query(`
      SELECT is_live, room_name, topic, host_name, started_at 
      FROM live_status 
      WHERE id = 1
    `);

    if (result.rows.length === 0) {
      return res.status(200).json({ 
        is_live: false,
        room_name: null,
        topic: null,
        host_name: null,
        started_at: null
      });
    }

    const status = result.rows[0];

    return res.status(200).json({
      is_live: status.is_live,
      room_name: status.room_name,
      topic: status.topic,
      host_name: status.host_name,
      started_at: status.started_at
    });

  } catch (error) {
    console.error('Live status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
