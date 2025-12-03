import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'image/heic', 'image/heif', 'image/avif',
            // Videos
            'video/mp4', 'video/quicktime', 'video/webm', 'video/mov',
            'video/3gpp', 'video/x-m4v', 'video/mpeg',
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob.url);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Client upload error:', error);
    return res.status(400).json({ error: error.message });
  }
}
