import { createUploadUrl } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, contentType } = await new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => resolve(JSON.parse(body || '{}')));
    });

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
