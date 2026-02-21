const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // GET — current mode
    if (req.method === 'GET') {
      const modeRes = await client.query('SELECT mode FROM scorecard_mode WHERE id = 1');
      return res.status(200).json({ mode: modeRes.rows[0]?.mode || 'practice' });
    }

    if (req.method === 'POST') {
      const { action, mode, team_number, hole_number, strokes, ctp_winner, ld_winner } = req.body || {};

      // Toggle mode
      if (action === 'set_mode') {
        if (!['practice', 'live'].includes(mode)) {
          return res.status(400).json({ error: 'mode must be practice or live' });
        }
        await client.query(
          'UPDATE scorecard_mode SET mode = $1, updated_at = NOW() WHERE id = 1',
          [mode]
        );
        // Wipe practice scores when switching to live
        if (mode === 'live') {
          await client.query("DELETE FROM hole_scores WHERE mode = 'practice'");
        }
        return res.status(200).json({ success: true, mode });
      }

      // Override a score
      if (action === 'override') {
        if (!team_number || !hole_number || strokes === undefined) {
          return res.status(400).json({ error: 'team_number, hole_number, strokes required' });
        }
        const modeRes = await client.query('SELECT mode FROM scorecard_mode WHERE id = 1');
        const currentMode = modeRes.rows[0]?.mode || 'practice';

        await client.query(`
          INSERT INTO hole_scores (team_number, hole_number, strokes, ctp_winner, ld_winner, mode, entered_by)
          VALUES ($1, $2, $3, $4, $5, $6, 'admin')
          ON CONFLICT (team_number, hole_number, mode)
          DO UPDATE SET strokes = $3, ctp_winner = $4, ld_winner = $5, entered_by = 'admin', entered_at = NOW()
        `, [team_number, hole_number, strokes, ctp_winner || null, ld_winner || null, currentMode]);

        return res.status(200).json({ success: true });
      }

      // Delete a score (clear a hole)
      if (action === 'delete') {
        if (!team_number || !hole_number) {
          return res.status(400).json({ error: 'team_number and hole_number required' });
        }
        const modeRes = await client.query('SELECT mode FROM scorecard_mode WHERE id = 1');
        const currentMode = modeRes.rows[0]?.mode || 'practice';
        await client.query(
          'DELETE FROM hole_scores WHERE team_number = $1 AND hole_number = $2 AND mode = $3',
          [team_number, hole_number, currentMode]
        );
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch(err) {
    console.error('Admin scores error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch(_) {}
  }
};
