import { createUploadUrl } from '@vercel/blob/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the request body from the stream
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const bodyStr = Buffer.concat(buffers).toString();
    const body = JSON.parse(bodyStr || '{}');
    const { filename, contentType } = body;

    // Create a signed upload URL using Vercel Blob
    const { url, id } = await createUploadUrl({
      access: 'public',
      contentType,
      metadata: { filename },
    });

    return res.status(200).json({ url, id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
