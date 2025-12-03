import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, title, excerpt, content, image_url, published } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: 'ID and title are required' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    await sql`
      UPDATE blog_posts 
      SET 
        title = ${title},
        excerpt = ${excerpt || null},
        content = ${content || null},
        image_url = ${image_url || null},
        published = ${published || false},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
}
