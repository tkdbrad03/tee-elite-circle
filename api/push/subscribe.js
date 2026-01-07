const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Create push subscriptions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        member_id INTEGER,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    if (req.method === 'POST') {
      // Save a subscription
      const { member_id, subscription } = req.body;

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Missing subscription data' });
      }

      const { endpoint, keys } = subscription;

      // Upsert subscription (update if endpoint exists)
      await client.query(`
        INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (endpoint) 
        DO UPDATE SET member_id = $1, p256dh = $3, auth = $4
      `, [member_id || null, endpoint, keys.p256dh, keys.auth]);

      return res.status(200).json({ success: true });

    } else if (req.method === 'DELETE') {
      // Remove a subscription
      const { endpoint } = req.body;

      if (endpoint) {
        await client.query(
          `DELETE FROM push_subscriptions WHERE endpoint = $1`,
          [endpoint]
        );
      }

      return res.status(200).json({ success: true });

    } else if (req.method === 'GET') {
      // Get all subscriptions (for sending notifications)
      const result = await client.query(
        `SELECT endpoint, p256dh, auth FROM push_subscriptions`
      );

      return res.status(200).json({ subscriptions: result.rows });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Push subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
