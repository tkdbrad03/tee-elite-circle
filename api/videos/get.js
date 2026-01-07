export const config = {
  runtime: 'nodejs',
};


const { query } = require('../lib/db');  // Change to this

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, postSlug, all } = req.query;

    let result;

    if (all === 'true') {
      // Get all videos
      result = await query(
        'SELECT * FROM videos ORDER BY created_at DESC'
      );
    } else if (id) {
      // Get specific video by ID
      result = await query(
        'SELECT * FROM videos WHERE id = $1',
        [id]
      );
    } else if (postSlug) {
      // Get video(s) for a specific blog post
      result = await query(
        'SELECT * FROM videos WHERE post_slug = $1 ORDER BY created_at DESC',
        [postSlug]
      );
    } else {
      return res.status(400).json({ error: 'No query parameters provided' });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    return res.status(200).json({
      success: true,
      videos: result.rows,
    });
  } catch (error) {
    console.error('Video retrieval error:', error);
    return res.status(500).json({ error: 'Failed to retrieve video' });
  }
};
