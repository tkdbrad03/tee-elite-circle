const { Client } = require('pg');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'TeeElite2026Admin';

// ─── EDIT THESE TO MATCH YOUR ACTUAL CONTENT ───────────────────────────────
const SEED_DATA = [
  {
    id: 'playlist',
    tagline: 'Your curated pre-round confidence audio + mindset ritual guide',
    drive_url: null,          // ← paste your Google Drive link here if ready
    available_now: true
  },
  {
    id: 'priority',
    tagline: 'Get advance notice before public registration opens — exclusive tiers unavailable to the general list',
    drive_url: null,
    available_now: true
  },
  {
    id: 'vault',
    tagline: 'The 9-Hole Networking Flow, Fairway Follow-Up Scripts, Wealth While You Golf Blueprint & more',
    drive_url: null,
    available_now: true
  },
  {
    id: 'ray',
    tagline: 'Elevate your game with expert instruction from Ray, a master-trained golf educator from Keiser University',
    drive_url: null,
    available_now: false
  },
  {
    id: 'roundtable',
    tagline: 'Sunday, May 3 · 6:00–7:30pm — intimate executive conversation, 12 women maximum',
    drive_url: null,
    available_now: false
  },
  {
    id: 'sprint',
    tagline: '45-minute 1:1 strategy session with Dr. TMac — come with one challenge, leave with a path forward',
    drive_url: 'https://calendar.app.google/U1Fxvr7UtL3YGtW77',
    available_now: false
  }
];
// ───────────────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const auth = req.headers['x-admin-secret'] || req.query.secret;
  if (auth !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const results = [];

    for (const item of SEED_DATA) {
      // Only update fields that are provided — never wipe existing drive_url if item.drive_url is null
      const updateParts = [];
      const values = [item.id];
      let idx = 2;

      if (item.tagline !== undefined) {
        updateParts.push(`tagline = $${idx++}`);
        values.push(item.tagline);
      }

      if (item.drive_url !== null && item.drive_url !== undefined) {
        updateParts.push(`drive_url = $${idx++}`);
        values.push(item.drive_url);
      }

      if (item.available_now !== undefined) {
        updateParts.push(`available_now = $${idx++}`);
        values.push(item.available_now);
      }

      if (updateParts.length === 0) {
        results.push({ id: item.id, status: 'skipped — nothing to update' });
        continue;
      }

      updateParts.push(`updated_at = NOW()`);

      const sql = `UPDATE wallet_items SET ${updateParts.join(', ')} WHERE id = $1`;
      const r = await client.query(sql, values);

      results.push({
        id: item.id,
        status: r.rowCount > 0 ? 'updated' : 'not found — item may not exist yet'
      });
    }

    return res.status(200).json({ success: true, results });

  } catch (err) {
    console.error('Seed wallet items error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
