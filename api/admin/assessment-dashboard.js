import pkg from 'pg';
const { Client } = pkg;

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NO_SSL ||
    ''
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const base = {
    summary: { totalAssessments: 0, last7Days: 0, avgScore: 0 },
    distribution: [],
    retreatInterest: [],
    retreatByZone: [],
    recentAssessments: [],
    warnings: []
  };

  const connectionString = getConnectionString();
  if (!connectionString) {
    base.warnings.push('DB_NOT_CONFIGURED');
    return res.status(200).json(base);
  }

  const needsSSL = !/localhost|127\.0\.0\.1/i.test(connectionString);

  const client = new Client({
    connectionString,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();

    // Check if expected tables exist; if not, return empty data instead of 500.
    const t = await client.query(
      "SELECT to_regclass('public.permission_assessments') AS permission_assessments, to_regclass('public.retreat_interest') AS retreat_interest"
    );
    const hasAssessments = Boolean(t.rows?.[0]?.permission_assessments);
    const hasRetreat = Boolean(t.rows?.[0]?.retreat_interest);

    if (!hasAssessments) base.warnings.push('MISSING_TABLE_permission_assessments');
    if (!hasRetreat) base.warnings.push('MISSING_TABLE_retreat_interest');

    // --- Assessments ---
    if (hasAssessments) {
      const totalRes = await client.query(
        'SELECT COUNT(*) AS count, AVG(score)::numeric(10,2) AS avg_score FROM permission_assessments'
      );
      const last7Res = await client.query(
        "SELECT COUNT(*) AS count FROM permission_assessments WHERE created_at >= NOW() - INTERVAL '7 days'"
      );

      const totalAssessments = parseInt(totalRes.rows[0]?.count || '0', 10);
      const last7Days = parseInt(last7Res.rows[0]?.count || '0', 10);
      const avgScore = parseFloat(totalRes.rows[0]?.avg_score || '0');

      base.summary = {
        totalAssessments,
        last7Days,
        avgScore
      };

      const distRes = await client.query(
        'SELECT result_type, COUNT(*) AS count FROM permission_assessments GROUP BY result_type ORDER BY count DESC'
      );
      base.distribution = distRes.rows;

      const recentRes = await client.query(
        'SELECT id, name, email, result_type, score, created_at FROM permission_assessments ORDER BY created_at DESC LIMIT 25'
      );
      base.recentAssessments = recentRes.rows;
    }

    // --- Retreat interest ---
    if (hasRetreat) {
      const retreatRes = await client.query(
        'SELECT interest_level, COUNT(*) AS count FROM retreat_interest GROUP BY interest_level ORDER BY count DESC'
      );
      base.retreatInterest = retreatRes.rows;

      const zoneRes = await client.query(
        "SELECT timezone, COUNT(*) AS count FROM retreat_interest WHERE timezone IS NOT NULL AND timezone <> '' GROUP BY timezone ORDER BY count DESC"
      );
      base.retreatByZone = zoneRes.rows;
    }

    return res.status(200).json(base);
  } catch (error) {
    // Fallback: don't break the dashboard UI on server errors.
    base.warnings.push('DB_QUERY_FAILED');
    const debug = process.env.NODE_ENV !== 'production';
    if (debug) base.warnings.push(String(error?.message || error));
    return res.status(200).json(base);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}
