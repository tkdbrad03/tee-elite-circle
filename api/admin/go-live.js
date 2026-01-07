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

    // Create live_status table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_status (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_live BOOLEAN DEFAULT FALSE,
        room_name VARCHAR(100),
        started_at TIMESTAMP,
        host_name VARCHAR(100) DEFAULT 'Dr. TMac',
        topic VARCHAR(255)
      )
    `);

    // Ensure we have a row
    await client.query(`
      INSERT INTO live_status (id, is_live) 
      VALUES (1, FALSE) 
      ON CONFLICT (id) DO NOTHING
    `);

    const { action, topic, room_name } = req.body;

    if (action === 'start') {
      // Use provided room name or generate one
      const roomName = room_name || `TeeEliteCircle_${Date.now()}`;
      
      await client.query(`
        UPDATE live_status 
        SET is_live = TRUE, 
            room_name = $1, 
            started_at = NOW(),
            topic = $2
        WHERE id = 1
      `, [roomName, topic || 'Live with Dr. TMac']);

      return res.status(200).json({ 
        success: true, 
        is_live: true, 
        room_name: roomName,
        message: 'You are now LIVE!' 
      });

    } else if (action === 'stop') {
      await client.query(`
        UPDATE live_status 
        SET is_live = FALSE, 
            room_name = NULL, 
            started_at = NULL,
            topic = NULL
        WHERE id = 1
      `);

      return res.status(200).json({ 
        success: true, 
        is_live: false,
        message: 'Live session ended' 
      });

    } else {
      return res.status(400).json({ error: 'Invalid action. Use "start" or "stop"' });
    }

  } catch (error) {
    console.error('Go live error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
