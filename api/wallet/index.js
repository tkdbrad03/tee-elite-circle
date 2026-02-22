const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

const ACTIVATION_DATE = new Date('2026-04-18T23:59:00-04:00');
const EXPIRY_DAYS = 30;
const STARTING_POINTS = 100;

const ITEMS = [
  { id: 'playlist',    name: 'Curated Confidence Playlist',         points: 10,  cap: null, fulfillment: 'auto' },
  { id: 'priority',   name: 'Priority Access to Future Events',     points: 20,  cap: null, fulfillment: 'auto' },
  { id: 'vault',      name: 'Influence on the Course Mini Vault',   points: 25,  cap: null, fulfillment: 'auto' },
  { id: 'ray',        name: 'Tee Elite Performance Clinic with Ray',points: 30,  cap: 12,   fulfillment: 'manual' },
  { id: 'roundtable', name: 'Executive Roundtable',                 points: 60,  cap: 12,   fulfillment: 'manual' },
  { id: 'sprint',     name: 'Strategy Sprint with Dr. TMac',        points: 75,  cap: 8,    fulfillment: 'booking', url: 'https://calendar.app.google/U1Fxvr7UtL3YGtW77' },
];

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS scramble_wallet (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL UNIQUE,
      points_balance INTEGER NOT NULL DEFAULT 100,
      activated_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS scramble_wishlist (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(member_id, item_id)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS scramble_redemptions (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      points_spent INTEGER NOT NULL,
      redeemed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(member_id, item_id)
    )
  `);
}

async function getMemberId(client, req) {
  const token = getSessionFromRequest(req);
  if (!token) return null;
  const r = await client.query(
    'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return r.rows[0]?.member_id || null;
}

async function getOrCreateWallet(client, memberId) {
  await client.query(
    'INSERT INTO scramble_wallet (member_id, points_balance) VALUES ($1, $2) ON CONFLICT (member_id) DO NOTHING',
    [memberId, STARTING_POINTS]
  );
  const r = await client.query('SELECT * FROM scramble_wallet WHERE member_id = $1', [memberId]);
  return r.rows[0];
}

async function getCapacity(client) {
  const r = await client.query(
    'SELECT item_id, COUNT(*) as redeemed FROM scramble_redemptions GROUP BY item_id'
  );
  const map = {};
  r.rows.forEach(row => { map[row.item_id] = parseInt(row.redeemed); });
  return map;
}

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await ensureTables(client);

    const memberId = await getMemberId(client, req);
    if (!memberId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const isActive = now >= ACTIVATION_DATE;

    // GET - wallet state
    if (req.method === 'GET') {
      const wallet = await getOrCreateWallet(client, memberId);
      const capacity = await getCapacity(client);

      // Wishlist
      const wlRes = await client.query(
        'SELECT item_id FROM scramble_wishlist WHERE member_id = $1', [memberId]
      );
      const wishlist = wlRes.rows.map(r => r.item_id);

      // Redemptions
      const redRes = await client.query(
        'SELECT item_id, redeemed_at FROM scramble_redemptions WHERE member_id = $1', [memberId]
      );
      const redeemed = {};
      redRes.rows.forEach(r => { redeemed[r.item_id] = r.redeemed_at; });

      // Expiry
      let expiresAt = null;
      let daysLeft = null;
      if (isActive) {
        expiresAt = new Date(ACTIVATION_DATE.getTime() + EXPIRY_DAYS * 86400000);
        daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86400000));
      }

      const items = ITEMS.map(item => ({
        ...item,
        redeemed_count: capacity[item.id] || 0,
        slots_left: item.cap ? item.cap - (capacity[item.id] || 0) : null,
        is_wishlisted: wishlist.includes(item.id),
        is_redeemed: !!redeemed[item.id],
        redeemed_at: redeemed[item.id] || null,
        available: !item.cap || (capacity[item.id] || 0) < item.cap
      }));

      return res.status(200).json({
        points_balance: wallet.points_balance,
        starting_points: STARTING_POINTS,
        is_active: isActive,
        activation_date: ACTIVATION_DATE.toISOString(),
        expires_at: expiresAt?.toISOString() || null,
        days_left: daysLeft,
        wishlist,
        items
      });
    }

    // POST - wishlist or redeem
    if (req.method === 'POST') {
      const { action, item_id } = req.body || {};
      const item = ITEMS.find(i => i.id === item_id);
      if (!item) return res.status(400).json({ error: 'Invalid item' });

      // WISHLIST TOGGLE
      if (action === 'wishlist') {
        const exists = await client.query(
          'SELECT id FROM scramble_wishlist WHERE member_id = $1 AND item_id = $2',
          [memberId, item_id]
        );
        if (exists.rows.length > 0) {
          await client.query(
            'DELETE FROM scramble_wishlist WHERE member_id = $1 AND item_id = $2',
            [memberId, item_id]
          );
          return res.status(200).json({ wishlisted: false });
        } else {
          await client.query(
            'INSERT INTO scramble_wishlist (member_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [memberId, item_id]
          );
          return res.status(200).json({ wishlisted: true });
        }
      }

      // REDEEM
      if (action === 'redeem') {
        if (!isActive) return res.status(400).json({ error: 'Wallet not yet active' });

        const wallet = await getOrCreateWallet(client, memberId);
        if (wallet.points_balance < item.points) {
          return res.status(400).json({ error: 'Insufficient points' });
        }

        // Check already redeemed
        const alreadyR = await client.query(
          'SELECT id FROM scramble_redemptions WHERE member_id = $1 AND item_id = $2',
          [memberId, item_id]
        );
        if (alreadyR.rows.length > 0) {
          return res.status(400).json({ error: 'Already redeemed' });
        }

        // Check capacity
        if (item.cap) {
          const capRes = await client.query(
            'SELECT COUNT(*) as cnt FROM scramble_redemptions WHERE item_id = $1',
            [item_id]
          );
          if (parseInt(capRes.rows[0].cnt) >= item.cap) {
            return res.status(400).json({ error: 'Sold out' });
          }
        }

        // Deduct points and record redemption
        await client.query(
          'UPDATE scramble_wallet SET points_balance = points_balance - $1 WHERE member_id = $2',
          [item.points, memberId]
        );
        await client.query(
          'INSERT INTO scramble_redemptions (member_id, item_id, points_spent) VALUES ($1, $2, $3)',
          [memberId, item_id, item.points]
        );

        const newBalance = wallet.points_balance - item.points;
        return res.status(200).json({
          success: true,
          new_balance: newBalance,
          item,
          fulfillment: item.fulfillment,
          booking_url: item.url || null
        });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Wallet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
