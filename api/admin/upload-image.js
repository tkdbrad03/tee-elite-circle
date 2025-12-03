const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return res.status(400).json({ error: 'Content-Type header required' });
    }

    // Allow images, videos, and common document types
    const allowedTypes = [
      'image/',
      'video/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];

    const isAllowed = allowedTypes.some(type => contentType.includes(type) || contentType.startsWith(type));
    
    if (!isAllowed) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    // Generate unique filename with appropriate extension
    let ext = 'bin';
    if (contentType.includes('image/')) {
      ext = contentType.split('/')[1] || 'jpg';
    } else if (contentType.includes('video/')) {
      ext = contentType.split('/')[1] || 'mp4';
    } else if (contentType.includes('pdf')) {
      ext = 'pdf';
    } else if (contentType.includes('msword') || contentType.includes('wordprocessingml')) {
      ext = contentType.includes('wordprocessingml') ? 'docx' : 'doc';
    } else if (contentType.includes('ms-excel') || contentType.includes('spreadsheetml')) {
      ext = contentType.includes('spreadsheetml') ? 'xlsx' : 'xls';
    } else if (contentType.includes('ms-powerpoint') || contentType.includes('presentationml')) {
      ext = contentType.includes('presentationml') ? 'pptx' : 'ppt';
    } else if (contentType.includes('text/plain')) {
      ext = 'txt';
    }

    const filename = `upload-${Date.now()}.${ext}`;

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
