export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false,
  },
};


const { put } = require('@vercel/blob');
const { query } = require('../lib/db');
const formidable = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024, // 500MB limit
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const videoFile = files.video?.[0] || files.video;
    
    if (!videoFile) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Read file buffer
    const fileBuffer = await fs.promises.readFile(videoFile.filepath);
    
    // Determine file extension (MOV, MP4, etc.)
    const originalName = videoFile.originalFilename || videoFile.name || 'video';
    const extension = originalName.split('.').pop().toLowerCase();
    
    // Upload to Vercel Blob
    const blob = await put(`videos/${Date.now()}-${originalName}`, fileBuffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: videoFile.mimetype || `video/${extension}`,
    });

    // Clean up temp file
    await fs.promises.unlink(videoFile.filepath);

    // Store metadata in database
    const title = fields.title?.[0] || fields.title || originalName;
    const description = fields.description?.[0] || fields.description || null;
    const postSlug = fields.postSlug?.[0] || fields.postSlug || null;

    const result = await query(
      `INSERT INTO videos (title, description, blob_url, blob_key, file_size, post_slug)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title,
        description,
        blob.url,
        blob.pathname,
        videoFile.size,
        postSlug,
      ]
    );

    return res.status(200).json({
      success: true,
      video: result.rows[0],
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to upload video',
      details: error.message 
    });
  }
};
