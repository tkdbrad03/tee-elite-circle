const { Client } = require('pg');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'TeeElite2026Admin';

module.exports = async (req, res) => {
  // Simple admin auth via header or query param
  const auth = req.headers['x-admin-secret'] || req.query.secret;
  if (auth !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // GET — list all items
    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT * FROM wallet_items ORDER BY sort_order ASC, created_at ASC'
      );
      return res.status(200).json(result.rows);
    }

    // POST — add new item
    if (req.method === 'POST') {
      const { id, name, tagline, points, cap, available_now, drive_url, sort_order } = req.body;
      if (!id || !name || points === undefined) {
        return res.status(400).json({ error: 'id, name, and points are required' });
      }
      // Ensure id is url-safe
      const safeId = id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      await client.query(`
        INSERT INTO wallet_items (id, name, tagline, points, cap, available_now, drive_url, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [safeId, name, tagline || null, parseInt(points), cap ? parseInt(cap) : null,
          available_now || false, drive_url || null, parseInt(sort_order) || 99]);
      return res.status(201).json({ success: true, id: safeId });
    }

    // PUT — update existing item
    if (req.method === 'PUT') {
      const { id, name, tagline, points, cap, available_now, drive_url, active, sort_order } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      await client.query(`
        UPDATE wallet_items SET
          name = COALESCE($2, name),
          tagline = COALESCE($3, tagline),
          points = COALESCE($4, points),
          cap = COALESCE($5, cap),
          available_now = COALESCE($6, available_now),
          drive_url = COALESCE($7, drive_url),
          active = COALESCE($8, active),
          sort_order = COALESCE($9, sort_order),
          updated_at = NOW()
        WHERE id = $1
      `, [id, name || null, tagline || null, points ? parseInt(points) : null,
          cap ? parseInt(cap) : null, available_now, drive_url || null,
          active !== undefined ? active : null, sort_order ? parseInt(sort_order) : null]);
      return res.status(200).json({ success: true });
    }

    // DELETE — remove item
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      await client.query('DELETE FROM wallet_items WHERE id = $1', [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Wallet items admin error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
};
