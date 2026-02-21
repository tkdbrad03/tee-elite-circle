const { Client } = require('pg');

const PARS = [4,3,5,4,4,4,4,3,5,4,4,3,4,4,3,4,4,5];

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Auto-create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS scorecard_mode (
        id INTEGER PRIMARY KEY DEFAULT 1,
        mode TEXT NOT NULL DEFAULT 'practice',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO scorecard_mode (id, mode) VALUES (1, 'practice')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hole_scores (
        id SERIAL PRIMARY KEY,
        team_number INTEGER NOT NULL,
        hole_number INTEGER NOT NULL,
        strokes INTEGER NOT NULL,
        ctp_winner TEXT,
        ld_winner TEXT,
        mode TEXT NOT NULL DEFAULT 'practice',
        entered_by TEXT,
        entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(team_number, hole_number, mode)
      )
    `);

    // GET — fetch scores for a team
    if (req.method === 'GET') {
      const { team } = req.query;
      const modeRes = await client.query('SELECT mode FROM scorecard_mode WHERE id = 1');
      const mode = modeRes.rows[0]?.mode || 'practice';

      if (team) {
        const scores = await client.query(
          'SELECT hole_number, strokes, ctp_winner, ld_winner FROM hole_scores WHERE team_number = $1 AND mode = $2 ORDER BY hole_number',
          [parseInt(team), mode]
        );
        return res.status(200).json({ mode, scores: scores.rows });
      }
      return res.status(400).json({ error: 'team required' });
    }

    // POST — submit a hole score
    if (req.method === 'POST') {
      const { team_number, hole_number, strokes, ctp_winner, ld_winner, entered_by } = req.body || {};

      if (!team_number || !hole_number || strokes === undefined) {
        return res.status(400).json({ error: 'team_number, hole_number, and strokes required' });
      }
      if (team_number < 1 || team_number > 6) {
        return res.status(400).json({ error: 'team_number must be 1-6' });
      }
      if (hole_number < 1 || hole_number > 18) {
        return res.status(400).json({ error: 'hole_number must be 1-18' });
      }
      if (strokes < 1 || strokes > 15) {
        return res.status(400).json({ error: 'strokes must be between 1 and 15' });
      }

      const modeRes = await client.query('SELECT mode FROM scorecard_mode WHERE id = 1');
      const mode = modeRes.rows[0]?.mode || 'practice';

      await client.query(`
        INSERT INTO hole_scores (team_number, hole_number, strokes, ctp_winner, ld_winner, mode, entered_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (team_number, hole_number, mode)
        DO UPDATE SET strokes = $3, ctp_winner = $4, ld_winner = $5, entered_by = $7, entered_at = NOW()
      `, [team_number, hole_number, strokes, ctp_winner || null, ld_winner || null, mode, entered_by || null]);

      return res.status(200).json({ success: true, mode, par: PARS[hole_number - 1] });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch(err) {
    console.error('Score submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch(_) {}
  }
};
