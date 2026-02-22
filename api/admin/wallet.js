const { Client } = require('pg');

const ITEMS = [
  { id: 'playlist',    name: 'Curated Confidence Playlist',          points: 10, cap: null },
  { id: 'priority',   name: 'Priority Access to Future Events',      points: 20, cap: null },
  { id: 'vault',      name: 'Influence on the Course Mini Vault',    points: 25, cap: null },
  { id: 'ray',        name: 'Tee Elite Performance Clinic with Ray', points: 30, cap: 12   },
  { id: 'roundtable', name: 'Executive Roundtable',                  points: 60, cap: 12   },
  { id: 'sprint',     name: 'Strategy Sprint with Dr. TMac',         points: 75, cap: 8    },
];

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Wishlist demand signals
    let wishlistData = [];
    try {
      const wlRes = await client.query(`
        SELECT sw.item_id, COUNT(*) as wishlist_count,
               array_agg(m.name ORDER BY m.name) as members
        FROM scramble_wishlist sw
        JOIN members m ON sw.member_id = m.id
        GROUP BY sw.item_id
        ORDER BY wishlist_count DESC
      `);
      wishlistData = wlRes.rows;
    } catch(e) {}

    // Redemption data
    let redemptionData = [];
    try {
      const redRes = await client.query(`
        SELECT sr.item_id, COUNT(*) as redemption_count,
               SUM(sr.points_spent) as total_points,
               MIN(sr.redeemed_at) as first_redemption,
               MAX(sr.redeemed_at) as last_redemption,
               array_agg(m.name || ' (' || m.email || ')' ORDER BY sr.redeemed_at) as redeemers
        FROM scramble_redemptions sr
        JOIN members m ON sr.member_id = m.id
        GROUP BY sr.item_id
        ORDER BY redemption_count DESC
      `);
      redemptionData = redRes.rows;
    } catch(e) {}

    // Member-level redemption timing
    let memberTiming = [];
    try {
      const timingRes = await client.query(`
        SELECT m.name, m.email,
               COUNT(sr.id) as items_redeemed,
               SUM(sr.points_spent) as points_spent,
               MIN(sr.redeemed_at) as first_redemption,
               sw.points_balance as remaining_balance
        FROM members m
        LEFT JOIN scramble_redemptions sr ON m.id = sr.member_id
        LEFT JOIN scramble_wallet sw ON m.id = sw.member_id
        WHERE sw.member_id IS NOT NULL
        GROUP BY m.name, m.email, sw.points_balance
        ORDER BY first_redemption ASC NULLS LAST
      `);
      memberTiming = timingRes.rows;
    } catch(e) {}

    // Summary stats
    let totalWallets = 0, totalRedemptions = 0, totalPointsSpent = 0, zeroRedemptions = 0;
    try {
      const sumRes = await client.query(`
        SELECT COUNT(*) as wallets,
               COALESCE(SUM(100 - points_balance), 0) as points_spent
        FROM scramble_wallet
      `);
      totalWallets = parseInt(sumRes.rows[0]?.wallets || 0);
      totalPointsSpent = parseInt(sumRes.rows[0]?.points_spent || 0);

      const redCountRes = await client.query('SELECT COUNT(*) as cnt FROM scramble_redemptions');
      totalRedemptions = parseInt(redCountRes.rows[0]?.cnt || 0);

      const zeroRes = await client.query(`
        SELECT COUNT(*) as cnt FROM scramble_wallet
        WHERE member_id NOT IN (SELECT DISTINCT member_id FROM scramble_redemptions)
      `);
      zeroRedemptions = parseInt(zeroRes.rows[0]?.cnt || 0);
    } catch(e) {}

    // Build full item report
    const itemReport = ITEMS.map(item => {
      const wl = wishlistData.find(w => w.item_id === item.id);
      const rd = redemptionData.find(r => r.item_id === item.id);
      return {
        ...item,
        wishlist_count: parseInt(wl?.wishlist_count || 0),
        wishlist_members: wl?.members || [],
        redemption_count: parseInt(rd?.redemption_count || 0),
        slots_left: item.cap ? item.cap - parseInt(rd?.redemption_count || 0) : null,
        total_points_collected: parseInt(rd?.total_points || 0),
        first_redemption: rd?.first_redemption || null,
        last_redemption: rd?.last_redemption || null,
        redeemers: rd?.redeemers || []
      };
    });

    return res.status(200).json({
      summary: {
        total_wallets: totalWallets,
        total_redemptions: totalRedemptions,
        total_points_spent: totalPointsSpent,
        zero_redemptions: zeroRedemptions,
        redemption_rate: totalWallets > 0 ? Math.round((totalWallets - zeroRedemptions) / totalWallets * 100) : 0
      },
      items: itemReport,
      member_timing: memberTiming
    });

  } catch (err) {
    console.error('Admin wallet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
