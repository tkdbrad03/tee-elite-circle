// api/admin/assessment-dashboard.js
const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get total counts
    const totals = await client.query(`
      SELECT 
        COUNT(DISTINCT email) as total_unique_users,
        COUNT(*) as total_assessments
      FROM permission_assessments
    `);

    // Get distribution by zone
    const distribution = await client.query(`
      SELECT 
        zone,
        COUNT(*) as total_count,
        COUNT(DISTINCT email) as unique_users,
        ROUND(AVG((scores->>'permission')::numeric), 2) as avg_permission_score,
        ROUND(AVG((scores->>'intimacy')::numeric), 2) as avg_intimacy_score,
        ROUND(AVG((scores->>'power')::numeric), 2) as avg_power_score
      FROM permission_assessments
      GROUP BY zone
    `);

    // Get retreat interest summary
    const retreatInterest = await client.query(`
      SELECT 
        retreat_type,
        COUNT(*) as total_interest,
        COUNT(DISTINCT email) as unique_people
      FROM retreat_interest
      GROUP BY retreat_type
      ORDER BY total_interest DESC
    `);

    // Get retreat interest by zone
    const retreatByZone = await client.query(`
      SELECT 
        zone,
        COUNT(*) as count
      FROM retreat_interest
      GROUP BY zone
      ORDER BY count DESC
    `);

    // Get recent assessments
    const recentAssessments = await client.query(`
      SELECT 
        email,
        zone,
        scores,
        created_at
      FROM permission_assessments
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return res.status(200).json({
      summary: {
        totalUniqueUsers: totals.rows[0].total_unique_users || 0,
        totalAssessments: totals.rows[0].total_assessments || 0
      },
      distribution: distribution.rows,
      retreatInterest: retreatInterest.rows,
      retreatByZone: retreatByZone.rows,
      recentAssessments: recentAssessments.rows
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({ error: 'Failed to fetch data' });
  } finally {
    await client.end();
  }
};
