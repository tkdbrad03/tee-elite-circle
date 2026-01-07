const { Client } = require('pg');
const { put } = require('@vercel/blob');
const { getSessionFromRequest } = require('../../session-protection');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sessionToken = getSessionFromRequest(req);

    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await client.connect();

    // Get member from session
    const sessionCheck = await client.query(
      'SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const memberId = sessionCheck.rows[0].member_id;

    // Get the file from the request
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Must be multipart/form-data' });
    }

    // Read the raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Parse multipart form data manually (simple version)
    const boundary = contentType.split('boundary=')[1];
    const parts = buffer.toString('binary').split('--' + boundary);
    
    let fileBuffer = null;
    let filename = 'profile.jpg';
    let mimeType = 'image/jpeg';

    for (const part of parts) {
      if (part.includes('filename=')) {
        // Extract filename
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }

        // Extract content type
        const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);
        if (contentTypeMatch) {
          mimeType = contentTypeMatch[1].trim();
        }

        // Extract file content (after double CRLF)
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const content = part.slice(headerEnd + 4);
          // Remove trailing boundary markers
          const cleanContent = content.replace(/\r\n--$/, '').replace(/--\r\n$/, '').replace(/\r\n$/, '');
          fileBuffer = Buffer.from(cleanContent, 'binary');
        }
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Vercel Blob
    const blob = await put(`profiles/${memberId}-${Date.now()}-${filename}`, fileBuffer, {
      access: 'public',
      contentType: mimeType
    });

    // Update member photo_url
    await client.query(
      'UPDATE members SET photo_url = $1, updated_at = NOW() WHERE id = $2',
      [blob.url, memberId]
    );

    return res.status(200).json({ 
      success: true, 
      photo_url: blob.url 
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
