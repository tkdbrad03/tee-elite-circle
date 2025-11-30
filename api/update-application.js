const { Client } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { id, status, deposit_paid, paid_in_full, stripe_payment_id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Application ID required' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (deposit_paid !== undefined) {
      updates.push(`deposit_paid = $${paramCount++}`);
      values.push(deposit_paid);
    }
    if (paid_in_full !== undefined) {
      updates.push(`paid_in_full = $${paramCount++}`);
      values.push(paid_in_full);
    }
    if (stripe_payment_id !== undefined) {
      updates.push(`stripe_payment_id = $${paramCount++}`);
      values.push(stripe_payment_id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await client.query(
      `UPDATE applications SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Update application error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.end();
  }
};
