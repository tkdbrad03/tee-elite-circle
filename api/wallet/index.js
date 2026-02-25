const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

const ACTIVATION_DATE = new Date('2026-04-18T23:59:00-04:00');
const EXPIRY_DAYS = 30;
const STARTING_POINTS = 100;

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS scramble_wallet (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL UNIQUE,
      points_balance INTEGER NOT NULL DEFAULT ${STARTING_POINTS},
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
  r.rows.forEach(row => { map[row.item_id] = parseInt(row.redeemed, 10) || 0; });
  return map;
}

async function getItemsFromDb(client) {
  // Match your wallet-items-public.js schema
  const r = await client.query(`
    SELECT
      id,
      name,
      tagline,
      points,
      cap,
      available_now,
      drive_url
    FROM wallet_items
    WHERE active = true
    ORDER BY sort_order ASC, created_at ASC
  `);

  return r.rows;
}

function normalizeItem(raw, capacity, wishlistIds, redeemedMap) {
  const points = Number(raw.points) || 0;
  const cap = raw.cap === null || raw.cap === undefined ? null : Number(raw.cap);

  const redeemedCount = capacity[raw.id] || 0;
  const slotsLeft = cap ? Math.max(0, cap - redeemedCount) : null;

  return {
    id: raw.id,
    name: raw.name,
    tagline: raw.tagline || '',
    // also provide description in case any older UI references it
    description: raw.tagline || '',
    points,
    cap,
    available_now: !!raw.available_now,
    url: raw.drive_url || null,

    redeemed_count: redeemedCount,
    slots_left: slotsLeft,

    is_wishlisted: wishlistIds.includes(raw.id),
    is_redeemed: !!redeemedMap[raw.id],
    redeemed_at: redeemedMap[raw.id] || null,

    available: !cap || redeemedCount < cap
  };
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

    // GET wallet state
    if (req.method === 'GET') {
      const wallet = await getOrCreateWallet(client, memberId);
      const capacity = await getCapacity(client);

      const wlRes = await client.query(
        'SELECT item_id FROM scramble_wishlist WHERE member_id = $1',
        [memberId]
      );
      const wishlist = wlRes.rows.map(r => r.item_id);

      const redRes = await client.query(
        'SELECT item_id, redeemed_at FROM scramble_redemptions WHERE member_id = $1',
        [memberId]
      );
      const redeemed = {};
      redRes.rows.forEach(r => { redeemed[r.item_id] = r.redeemed_at; });

      let expiresAt = null;
      let daysLeft = null;
      if (isActive) {
        expiresAt = new Date(ACTIVATION_DATE.getTime() + EXPIRY_DAYS * 86400000);
        daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86400000));
      }

      const dbItems = await getItemsFromDb(client);
      const items = dbItems.map(it => normalizeItem(it, capacity, wishlist, redeemed));

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

    // POST wishlist/redeem
    if (req.method === 'POST') {
      const { action, item_id } = req.body || {};
      if (!action || !item_id) return res.status(400).json({ error: 'Missing action or item_id' });

      const dbItems = await getItemsFromDb(client);
      const item = dbItems.find(i => i.id === item_id);
      if (!item) return res.status(400).json({ error: 'Invalid item' });

      // ✅ THIS is what you were missing
      const cost = Number(item.points) || 0;

      // WISHLIST toggle (deduct/refund points)
      if (action === 'wishlist') {
        const wallet = await getOrCreateWallet(client, memberId);

        const exists = await client.query(
          'SELECT id FROM scramble_wishlist WHERE member_id = $1 AND item_id = $2',
          [memberId, item_id]
        );

        if (exists.rows.length > 0) {
          // remove + refund points
          await client.query(
            'DELETE FROM scramble_wishlist WHERE member_id = $1 AND item_id = $2',
            [memberId, item_id]
          );
          await client.query(
            'UPDATE scramble_wallet SET points_balance = points_balance + $1 WHERE member_id = $2',
            [cost, memberId]
          );
        } else {
          // add + deduct points
          if (wallet.points_balance < cost) {
            return res.status(400).json({ error: 'Insufficient points' });
          }
          await client.query(
            'INSERT INTO scramble_wishlist (member_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [memberId, item_id]
          );
          await client.query(
            'UPDATE scramble_wallet SET points_balance = points_balance - $1 WHERE member_id = $2',
            [cost, memberId]
          );
        }

        // return updated state (so UI updates immediately)
        const updatedWallet = await getOrCreateWallet(client, memberId);

        const wlRes = await client.query(
          'SELECT item_id FROM scramble_wishlist WHERE member_id = $1',
          [memberId]
        );
        const wishlist = wlRes.rows.map(r => r.item_id);

        const capacity = await getCapacity(client);

        const redeemedRes = await client.query(
          'SELECT item_id, redeemed_at FROM scramble_redemptions WHERE member_id = $1',
          [memberId]
        );
        const redeemed = {};
        redeemedRes.rows.forEach(r => { redeemed[r.item_id] = r.redeemed_at; });

        const dbItems2 = await getItemsFromDb(client);
        const items = dbItems2.map(it => normalizeItem(it, capacity, wishlist, redeemed));

        return res.status(200).json({
          points_balance: updatedWallet.points_balance,
          wishlist,
          items
        });
      }

      // REDEEM
      if (action === 'redeem') {
        if (!isActive) return res.status(400).json({ error: 'Wallet not yet active' });

        const wallet = await getOrCreateWallet(client, memberId);
        if (wallet.points_balance < cost) {
          return res.status(400).json({ error: 'Insufficient points' });
        }

        const alreadyR = await client.query(
          'SELECT id FROM scramble_redemptions WHERE member_id = $1 AND item_id = $2',
          [memberId, item_id]
        );
        if (alreadyR.rows.length > 0) {
          return res.status(400).json({ error: 'Already redeemed' });
        }

        // capacity check
        const cap = item.cap === null || item.cap === undefined ? null : Number(item.cap);
        if (cap) {
          const capRes = await client.query(
            'SELECT COUNT(*) as cnt FROM scramble_redemptions WHERE item_id = $1',
            [item_id]
          );
          if ((parseInt(capRes.rows[0].cnt, 10) || 0) >= cap) {
            return res.status(400).json({ error: 'Sold out' });
          }
        }

        await client.query(
          'UPDATE scramble_wallet SET points_balance = points_balance - $1 WHERE member_id = $2',
          [cost, memberId]
        );

        await client.query(
          'INSERT INTO scramble_redemptions (member_id, item_id, points_spent) VALUES ($1, $2, $3)',
          [memberId, item_id, cost]
        );

        return res.status(200).json({
          success: true,
          new_balance: wallet.points_balance - cost
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
