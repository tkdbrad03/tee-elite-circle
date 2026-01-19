const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Main handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await pool.connect();
    
    try {
      // Total audits completed
      const totalAudits = await client.query(
        'SELECT COUNT(*) as count FROM matriarch_audits'
      );

      // Category breakdown
      const categoryBreakdown = await client.query(`
        SELECT 
          category,
          COUNT(*) as count,
          ROUND(AVG(score), 1) as avg_score
        FROM matriarch_audits
        GROUP BY category
        ORDER BY avg_score DESC
      `);

      // PDF downloads
      const pdfDownloads = await client.query(`
        SELECT COUNT(DISTINCT email) as count
        FROM audit_engagement
        WHERE event_type = 'pdf_download'
      `);

      // Flipbook opens
      const flipbookOpens = await client.query(`
        SELECT COUNT(DISTINCT email) as count
        FROM audit_engagement
        WHERE event_type = 'flipbook_open'
      `);

      // Video engagement
      const videoStats = await client.query(`
        SELECT 
          COUNT(DISTINCT email) as viewers,
          AVG((event_data->>'watchTime')::float) as avg_watch_time,
          AVG((event_data->>'percentWatched')::float) as avg_percent_watched,
          COUNT(*) FILTER (WHERE (event_data->>'percentWatched')::float >= 90) as completed_views
        FROM audit_engagement
        WHERE event_type = 'video_progress'
      `);

      // Recent audits (last 30 days)
      const recentAudits = await client.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM matriarch_audits
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // Engagement funnel
      const totalAuditCount = parseInt(totalAudits.rows[0].count);
      const pdfCount = parseInt(pdfDownloads.rows[0].count);
      const flipbookCount = parseInt(flipbookOpens.rows[0].count);
      const videoViewers = parseInt(videoStats.rows[0]?.viewers || 0);

      const analytics = {
        overview: {
          totalAudits: totalAuditCount,
          pdfDownloads: pdfCount,
          flipbookOpens: flipbookCount,
          videoViewers: videoViewers,
          pdfDownloadRate: totalAuditCount > 0 ? Math.round((pdfCount / totalAuditCount) * 100) : 0,
          flipbookOpenRate: totalAuditCount > 0 ? Math.round((flipbookCount / totalAuditCount) * 100) : 0,
          videoViewRate: totalAuditCount > 0 ? Math.round((videoViewers / totalAuditCount) * 100) : 0
        },
        categories: categoryBreakdown.rows,
        videoEngagement: {
          totalViewers: videoViewers,
          avgWatchTime: Math.round(parseFloat(videoStats.rows[0]?.avg_watch_time || 0)),
          avgPercentWatched: Math.round(parseFloat(videoStats.rows[0]?.avg_percent_watched || 0)),
          completedViews: parseInt(videoStats.rows[0]?.completed_views || 0)
        },
        recentActivity: recentAudits.rows
      };

      return res.status(200).json(analytics);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Analytics fetch error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error.message 
    });
  }
};
