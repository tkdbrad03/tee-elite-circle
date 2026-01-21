// /api/admin/assessment-dashboard.js
// CommonJS (works with default Vercel Node runtime when package.json does NOT set "type": "module")

const { Pool } = require('pg');

// Prefer whatever your environment provides (Vercel Postgres commonly uses POSTGRES_URL)
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.PG_URL ||
  '';

const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : null;

module.exports = async function handler(req, res) {
  // Basic CORS preflight support (safe for same-origin too)
  if (req.method === 'OPTIONS') {
    res.status(204);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  // If DB is not configured, return a graceful payload (so the dashboard can still render)
  if (!pool) {
    return res.status(200).json({
      ok: true,
      totals: { totalAssessments: 0, last7Days: 0, avgScore7Days: null },
      recent: [],
      warnings: ['Database connection string not configured (DATABASE_URL/POSTGRES_URL).']
    });
  }

  try {
    // Totals
    const totalsQ = await pool.query(`
      SELECT
        COUNT(*)::int AS "totalAssessments",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS "last7Days",
        ROUND(AVG(total_score) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 1) AS "avgScore7Days"
      FROM assessments
    `);

    // Recent rows for table/list
    const recentQ = await pool.query(`
      SELECT
        id,
        created_at AS "createdAt",
        email,
        full_name AS "fullName",
        result_type AS "resultType",
        total_score AS "totalScore"
      FROM assessments
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return res.status(200).json({
      ok: true,
      totals: totalsQ.rows[0] || { totalAssessments: 0, last7Days: 0, avgScore7Days: null },
      recent: recentQ.rows || []
    });
  } catch (err) {
    // Return a usable payload (not a hard 500) so the UI can show the warning and keep working.
    console.error('assessment-dashboard error:', err);
    return res.status(200).json({
      ok: true,
      totals: { totalAssessments: 0, last7Days: 0, avgScore7Days: null },
      recent: [],
      warnings: ['Database query failed. Check Vercel logs and DB schema.']
    });
  }
};
