// API endpoint: /api/videos/delete
// Deletes video from Vercel Blob and database

const { del } = require('@vercel/blob');
const { query } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    // Get video info first
    const videoResult = await query(
      'SELECT blob_url FROM videos WHERE id = $1',
      [id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const { blob_url } = videoResult.rows[0];

    // Delete from Vercel Blob
    await del(blob_url);

    // Delete from database
    await query('DELETE FROM videos WHERE id = $1', [id]);

    return res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('Video deletion error:', error);
    return res.status(500).json({ error: 'Failed to delete video' });
  }
};
