const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Create signals table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_signals (
        id SERIAL PRIMARY KEY,
        room_name VARCHAR(100) NOT NULL,
        from_peer VARCHAR(100) NOT NULL,
        to_peer VARCHAR(100) NOT NULL,
        signal_type VARCHAR(20) NOT NULL,
        signal_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        read BOOLEAN DEFAULT FALSE
      )
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_live_signals_to_peer 
      ON live_signals(to_peer, read, room_name)
    `);

    if (req.method === 'POST') {
      // Send a signal
      const { room_name, from_peer, to_peer, signal_type, signal_data } = req.body;

      if (!room_name || !from_peer || !to_peer || !signal_type || !signal_data) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      await client.query(
        `INSERT INTO live_signals (room_name, from_peer, to_peer, signal_type, signal_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [room_name, from_peer, to_peer, signal_type, signal_data]
      );

      return res.status(200).json({ success: true });

    } else if (req.method === 'GET') {
      // Get pending signals for a peer
      const { room_name, peer_id } = req.query;

      if (!room_name || !peer_id) {
        return res.status(400).json({ error: 'Missing room_name or peer_id' });
      }

      const result = await client.query(
        `SELECT id, from_peer, signal_type, signal_data 
         FROM live_signals 
         WHERE room_name = $1 AND to_peer = $2 AND read = FALSE
         ORDER BY created_at ASC`,
        [room_name, peer_id]
      );

      // Mark as read
      if (result.rows.length > 0) {
        const ids = result.rows.map(r => r.id);
        await client.query(
          `UPDATE live_signals SET read = TRUE WHERE id = ANY($1)`,
          [ids]
        );
      }

      return res.status(200).json({ signals: result.rows });

    } else if (req.method === 'DELETE') {
      // Clean up old signals for a room
      const { room_name } = req.body;

      if (room_name) {
        await client.query(
          `DELETE FROM live_signals WHERE room_name = $1`,
          [room_name]
        );
      } else {
        // Clean up signals older than 1 hour
        await client.query(
          `DELETE FROM live_signals WHERE created_at < NOW() - INTERVAL '1 hour'`
        );
      }

      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Signal error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
