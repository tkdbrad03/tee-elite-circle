const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Create chat table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_chat (
        id SERIAL PRIMARY KEY,
        room_name VARCHAR(100) NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_live_chat_room 
      ON live_chat(room_name, created_at)
    `);

    if (req.method === 'POST') {
      // Send a message
      const { room_name, author_name, message } = req.body;

      if (!room_name || !author_name || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await client.query(
        `INSERT INTO live_chat (room_name, author_name, message)
         VALUES ($1, $2, $3)
         RETURNING id, author_name, message, created_at`,
        [room_name, author_name, message]
      );

      return res.status(200).json({ success: true, message: result.rows[0] });

    } else if (req.method === 'GET') {
      // Get messages for a room
      const { room_name, after_id } = req.query;

      if (!room_name) {
        return res.status(400).json({ error: 'Missing room_name' });
      }

      let query, params;
      
      if (after_id) {
        // Get only new messages after a certain ID
        query = `
          SELECT id, author_name, message, created_at 
          FROM live_chat 
          WHERE room_name = $1 AND id > $2
          ORDER BY created_at ASC
          LIMIT 50
        `;
        params = [room_name, after_id];
      } else {
        // Get last 50 messages
        query = `
          SELECT id, author_name, message, created_at 
          FROM live_chat 
          WHERE room_name = $1
          ORDER BY created_at DESC
          LIMIT 50
        `;
        params = [room_name];
      }

      const result = await client.query(query, params);
      
      // Reverse if we got the last 50 (so oldest first)
      const messages = after_id ? result.rows : result.rows.reverse();

      return res.status(200).json({ messages });

    } else if (req.method === 'DELETE') {
      // Clean up chat for a room (called when ending stream)
      const { room_name } = req.body;

      if (room_name) {
        await client.query(
          `DELETE FROM live_chat WHERE room_name = $1`,
          [room_name]
        );
      } else {
        // Clean up old chat messages (older than 24 hours)
        await client.query(
          `DELETE FROM live_chat WHERE created_at < NOW() - INTERVAL '24 hours'`
        );
      }

      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
