import { getDb } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin check would go here - for now allowing all authenticated requests
  const memberId = req.query.id || req.body?.id;

  if (!memberId) {
    return res.status(400).json({ error: 'Member ID required' });
  }

  try {
    const db = await getDb();

    // Delete the member
    const result = await db.run('DELETE FROM members WHERE id = ?', [memberId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Failed to delete member' });
  }
}
