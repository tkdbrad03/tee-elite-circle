const { Client } = require("pg");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Protect this route so nobody can run it publicly
  const key = req.headers["x-migrate-key"];
  if (!key || key !== process.env.MIGRATE_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Add columns
    await client.query(`
      ALTER TABLE members
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
    `);

    await client.query(`
      ALTER TABLE members
      ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'CIRCLE';
    `);

    // Backfill any NULLs (safety)
    await client.query(`
      UPDATE members
      SET active = true
      WHERE active IS NULL;
    `);

    await client.query(`
      UPDATE members
      SET member_type = 'CIRCLE'
      WHERE member_type IS NULL OR member_type = '';
    `);

    return res.status(200).json({ ok: true, message: "members table updated (active, member_type)." });
  } catch (err) {
    console.error("migrate-members error:", err);
    return res.status(500).json({ ok: false, error: "Migration failed", details: err.message });
  } finally {
    await client.end();
  }
};
