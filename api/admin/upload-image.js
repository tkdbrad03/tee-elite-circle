const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('image')) {
      return res.status(400).json({ error: 'Must be an image file' });
    }

    // Generate unique filename
    const ext = contentType.split('/')[1] || 'jpg';
    const filename = `blog-${Date.now()}.${ext}`;

    // Upload to Vercel Blob
    const blob = await put(filename, req, {
      access: 'public',
      contentType: contentType
    });

    return res.status(200).json({ 
      success: true, 
      url: blob.url 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
};

// Disable body parsing for file uploads
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
