const { Client } = require('pg');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Auto-create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitational_votes (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL,
        poll_id TEXT NOT NULL,
        option TEXT NOT NULL,
        voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(member_id, poll_id)
      )
    `);

    // GET — return tallies + whether this member already voted
    if (req.method === 'GET') {
      const { poll_id } = req.query;
      if (!poll_id) return res.status(400).json({ error: 'poll_id required' });

      // Get tallies (no auth needed — public result)
      const tally = await client.query(
        `SELECT option, COUNT(*) as count FROM invitational_votes WHERE poll_id = $1 GROUP BY option`,
        [poll_id]
      );

      // Check if this member already voted
      let myVote = null;
      const sessionToken = getSessionFromRequest(req);
      if (sessionToken) {
        const sessionResult = await client.query(
          'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
          [sessionToken]
        );
        if (sessionResult.rows.length > 0) {
          const memberId = sessionResult.rows[0].member_id;
          const existing = await client.query(
            'SELECT option FROM invitational_votes WHERE member_id = $1 AND poll_id = $2',
            [memberId, poll_id]
          );
          if (existing.rows.length > 0) myVote = existing.rows[0].option;
        }
      }

      const counts = {};
      let total = 0;
      tally.rows.forEach(row => {
        counts[row.option] = parseInt(row.count);
        total += parseInt(row.count);
      });

      return res.status(200).json({ counts, total, myVote });
    }

    // POST — cast a vote
    if (req.method === 'POST') {
      const sessionToken = getSessionFromRequest(req);
      if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

      const sessionResult = await client.query(
        'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
        [sessionToken]
      );
      if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired' });

      const memberId = sessionResult.rows[0].member_id;
      const { poll_id, option } = req.body || {};

      if (!poll_id || !option) return res.status(400).json({ error: 'poll_id and option required' });

      // Insert or ignore if already voted (UNIQUE constraint)
      await client.query(
        `INSERT INTO invitational_votes (member_id, poll_id, option)
         VALUES ($1, $2, $3)
         ON CONFLICT (member_id, poll_id) DO NOTHING`,
        [memberId, poll_id, option]
      );

      // Return fresh tallies
      const tally = await client.query(
        `SELECT option, COUNT(*) as count FROM invitational_votes WHERE poll_id = $1 GROUP BY option`,
        [poll_id]
      );

      const counts = {};
      let total = 0;
      tally.rows.forEach(row => {
        counts[row.option] = parseInt(row.count);
        total += parseInt(row.count);
      });

      return res.status(200).json({ counts, total, myVote: option });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
