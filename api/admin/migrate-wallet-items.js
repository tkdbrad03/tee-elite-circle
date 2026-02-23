const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.query.secret !== 'migrateWALLET2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        cap INTEGER DEFAULT NULL,
        available_now BOOLEAN DEFAULT FALSE,
        drive_url TEXT DEFAULT NULL,
        active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed the 6 current items (skip if already exist)
    const items = [
      { id: 'playlist',    name: 'Curated Confidence Playlist',          tagline: 'Pre-tee confidence playlist, a private audio message from Dr. TMac, and the Pre-Tee Ritual guide.',                                                                                                                        points: 10, cap: null, available_now: true,  sort_order: 1 },
      { id: 'priority',   name: 'Priority Access to Future Events',      tagline: 'Early access window, private registration tier, and advance notice before public release.',                                                                                                                                   points: 20, cap: null, available_now: true,  sort_order: 2 },
      { id: 'vault',      name: 'Influence on the Course Mini Vault',    tagline: 'The 9-Hole Networking Flow, Fairway Follow-Up Scripts, Wealth While You Golf Blueprint, Sponsorship Pitch Template, and the Bogey Bounce-Back System.',                                                                       points: 25, cap: null, available_now: true,  sort_order: 3 },
      { id: 'ray',        name: 'Tee Elite Performance Clinic with Ray', tagline: 'A 90-minute in-person performance session designed to improve scoring, confidence, and course strategy. Recording available if you cannot attend.',                                                                            points: 30, cap: 12,  available_now: false, sort_order: 4 },
      { id: 'roundtable', name: 'Executive Roundtable',                  tagline: 'Small group, 90-minute strategic session led by Dr. TMac. Sunday, May 3 · 6:00–7:30pm.',                                                                                                                                     points: 60, cap: 12,  available_now: false, sort_order: 5 },
      { id: 'sprint',     name: 'Strategy Sprint with Dr. TMac',         tagline: 'One focused 45-minute session. You choose: business clarity, visibility, confidence reset, income activation, or personal brand alignment.',                                                                                   points: 75, cap: 8,   available_now: false, sort_order: 6 }
    ];

    for (const item of items) {
      await client.query(`
        INSERT INTO wallet_items (id, name, tagline, points, cap, available_now, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [item.id, item.name, item.tagline, item.points, item.cap, item.available_now, item.sort_order]);
    }

    return res.status(200).json({ success: true, message: 'wallet_items table created and seeded with 6 items.' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
