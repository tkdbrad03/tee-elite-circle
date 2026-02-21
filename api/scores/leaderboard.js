const { Client } = require('pg');

const PARS = [4,3,5,4,4,4,4,3,5,4,4,3,4,4,3,4,4,5];
const TOTAL_PAR = 72;

// Contest holes
const CTP_HOLES = [2, 8, 12, 15];
const LD_HOLES = [9];

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get current mode
    let mode = 'practice';
    try {
      const modeRes = await client.query('SELECT mode FROM scorecard_mode WHERE id = 1');
      mode = modeRes.rows[0]?.mode || 'practice';
    } catch(e) { /* table may not exist yet */ }

    // Get all scores for current mode
    let scores = [];
    try {
      const res2 = await client.query(
        'SELECT team_number, hole_number, strokes, ctp_winner, ld_winner FROM hole_scores WHERE mode = $1 ORDER BY team_number, hole_number',
        [mode]
      );
      scores = res2.rows;
    } catch(e) { /* table may not exist yet */ }

    // Build leaderboard for teams 1-6
    const teams = Array.from({ length: 6 }, (_, i) => {
      const teamNum = i + 1;
      const teamScores = scores.filter(s => s.team_number === teamNum);

      // Build hole-by-hole array
      const holes = PARS.map((par, idx) => {
        const holeNum = idx + 1;
        const score = teamScores.find(s => s.hole_number === holeNum);
        return {
          hole: holeNum,
          par,
          strokes: score ? score.strokes : null,
          toPar: score ? score.strokes - par : null,
          ctp_winner: score?.ctp_winner || null,
          ld_winner: score?.ld_winner || null,
          is_ctp: CTP_HOLES.includes(holeNum),
          is_ld: LD_HOLES.includes(holeNum)
        };
      });

      const holesCompleted = holes.filter(h => h.strokes !== null).length;
      const totalStrokes = holes.reduce((sum, h) => sum + (h.strokes || 0), 0);
      const parThru = holes
        .filter(h => h.strokes !== null)
        .reduce((sum, h) => sum + h.par, 0);
      const scoreToPar = holesCompleted > 0 ? totalStrokes - parThru : null;

      return {
        team_number: teamNum,
        team_name: `Team ${teamNum}`,
        holes_completed: holesCompleted,
        total_strokes: holesCompleted > 0 ? totalStrokes : null,
        score_to_par: scoreToPar,
        holes
      };
    });

    // Sort: teams that have started by score, then teams that haven't started
    const started = teams.filter(t => t.holes_completed > 0)
      .sort((a, b) => a.score_to_par - b.score_to_par);
    const notStarted = teams.filter(t => t.holes_completed === 0);
    const leaderboard = [...started, ...notStarted];

    // Collect contest winners (last name entered wins)
    const ctpWinners = {};
    const ldWinners = {};
    scores.forEach(s => {
      if (s.ctp_winner && CTP_HOLES.includes(s.hole_number)) {
        ctpWinners[s.hole_number] = s.ctp_winner;
      }
      if (s.ld_winner && LD_HOLES.includes(s.hole_number)) {
        ldWinners[s.hole_number] = s.ld_winner;
      }
    });

    return res.status(200).json({
      mode,
      leaderboard,
      contests: { ctp: ctpWinners, ld: ldWinners },
      total_par: TOTAL_PAR,
      last_updated: new Date().toISOString()
    });

  } catch(err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch(_) {}
  }
};
