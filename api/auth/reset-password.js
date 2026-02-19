const { Client } = require('pg');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  const { email, newPassword, secretKey } = req.body;
  
  if (secretKey !== 'tmac-reset-2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const hash = await bcrypt.hash(newPassword, 10);
    await client.query(
      'UPDATE members SET password_hash = $1 WHERE email = $2',
      [hash, email.toLowerCase()]
    );
    return res.status(200).json({ success: true });
  } finally {
    await client.end();
  }
};
