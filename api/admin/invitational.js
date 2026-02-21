const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Auto-create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitational_tracking (
        member_id INTEGER PRIMARY KEY,
        mulligan_front BOOLEAN NOT NULL DEFAULT FALSE,
        mulligan_back BOOLEAN NOT NULL DEFAULT FALSE,
        drink_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // GET — list all invitational members with their tracking data
    if (req.method === 'GET') {
      // Pull from invitational_payments joined to members
      // Falls back to all members if payments table doesn't exist yet
      let players;
      try {
        const result = await client.query(`
          SELECT
            m.id,
            m.name,
            m.email,
            m.ghin,
            COALESCE(t.mulligan_front, FALSE) AS mulligan_front,
            COALESCE(t.mulligan_back, FALSE) AS mulligan_back,
            COALESCE(t.drink_redeemed, FALSE) AS drink_redeemed
          FROM members m
          INNER JOIN invitational_payments ip ON LOWER(m.email) = LOWER(ip.email)
          LEFT JOIN invitational_tracking t ON m.id = t.member_id
          ORDER BY m.name ASC
        `);
        players = result.rows;
      } catch(e) {
        // Fallback: show all members if invitational_payments doesn't exist
        const result = await client.query(`
          SELECT
            m.id,
            m.name,
            m.email,
            m.ghin,
            COALESCE(t.mulligan_front, FALSE) AS mulligan_front,
            COALESCE(t.mulligan_back, FALSE) AS mulligan_back,
            COALESCE(t.drink_redeemed, FALSE) AS drink_redeemed
          FROM members m
          LEFT JOIN invitational_tracking t ON m.id = t.member_id
          ORDER BY m.name ASC
        `);
        players = result.rows;
      }

      return res.status(200).json({ players });
    }

    // POST — log a mulligan or drink redemption
    if (req.method === 'POST') {
      const { action, member_id, half, sold, redeemed } = req.body || {};
      if (!action || !member_id) return res.status(400).json({ error: 'action and member_id required' });

      // Ensure row exists
      await client.query(`
        INSERT INTO invitational_tracking (member_id)
        VALUES ($1)
        ON CONFLICT (member_id) DO NOTHING
      `, [member_id]);

      if (action === 'mulligan') {
        if (!half || !['front', 'back'].includes(half)) {
          return res.status(400).json({ error: 'half must be front or back' });
        }
        const col = half === 'front' ? 'mulligan_front' : 'mulligan_back';
        await client.query(
          `UPDATE invitational_tracking SET ${col} = $1, updated_at = NOW() WHERE member_id = $2`,
          [!!sold, member_id]
        );

        // Also update member record mulligan count for hub display
        const frontRes = await client.query(
          'SELECT mulligan_front, mulligan_back FROM invitational_tracking WHERE member_id = $1',
          [member_id]
        );
        if (frontRes.rows.length > 0) {
          const { mulligan_front, mulligan_back } = frontRes.rows[0];
          const total = (mulligan_front ? 1 : 0) + (mulligan_back ? 1 : 0);
          try {
            await client.query(
              'UPDATE members SET mulligans_purchased = $1 WHERE id = $2',
              [total, member_id]
            );
          } catch(e) {
            // Add column if missing
            await client.query('ALTER TABLE members ADD COLUMN IF NOT EXISTS mulligans_purchased INTEGER DEFAULT 0');
            await client.query(
              'UPDATE members SET mulligans_purchased = $1 WHERE id = $2',
              [total, member_id]
            );
          }
        }
        return res.status(200).json({ success: true });
      }

      if (action === 'drink') {
        await client.query(
          'UPDATE invitational_tracking SET drink_redeemed = $1, updated_at = NOW() WHERE member_id = $2',
          [!!redeemed, member_id]
        );

        // Update member drink_tickets so hub reflects redemption
        try {
          await client.query(
            'UPDATE members SET drink_tickets = $1 WHERE id = $2',
            [redeemed ? 0 : 1, member_id]
          );
        } catch(e) {
          await client.query('ALTER TABLE members ADD COLUMN IF NOT EXISTS drink_tickets INTEGER DEFAULT 1');
          await client.query(
            'UPDATE members SET drink_tickets = $1 WHERE id = $2',
            [redeemed ? 0 : 1, member_id]
          );
        }
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch(err) {
    console.error('Admin invitational error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch(_) {}
  }
};
