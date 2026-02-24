function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(p => p.trim());
  const hit = parts.find(p => p.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null;
}

const SESSION_COOKIE_NAME = 'tec_session'; // <-- SAME cookie name as Step 1
const { Client } = require("pg");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Require ADMIN
const sessionToken = getCookie(req, SESSION_COOKIE_NAME);
if (!sessionToken) return res.status(401).json({ error: 'Not logged in' });

const s = await client.query(
  `SELECT member_id FROM sessions WHERE token = $1 AND expires_at > NOW() LIMIT 1`,
  [sessionToken]
);
if (s.rows.length === 0) return res.status(401).json({ error: 'Session expired' });

const m = await client.query(
  `SELECT member_type FROM members WHERE id = $1 LIMIT 1`,
  [s.rows[0].member_id]
);

const type = String(m.rows[0]?.member_type || '').toUpperCase();
if (type !== 'ADMIN') return res.status(403).json({ error: 'Admins only' });

    const {
      full_name,
      email,
      phone = null,
      location = null,

      // Your admin.html already sends these:
      paid_in_full = true,
      deposit_paid = true,
      interest_level = "Ready to join",
      status = "approved",

      // New fields (optional from UI; safe defaults)
      active = true,
      member_type = "CIRCLE"
    } = req.body || {};

    // Basic validation
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(full_name || "").trim();

    if (!cleanEmail || !cleanName) {
      return res.status(400).json({ error: "Missing required fields: full_name and email" });
    }

    // Normalize member_type
    const type = String(member_type || "CIRCLE").toUpperCase();
    const safeType = ["INVITATIONAL", "CIRCLE", "ADMIN"].includes(type) ? type : "CIRCLE";

    // 1) UPSERT into members (this is what grants login)
    // Your members table uses column names like: email, name, phone, location, etc.
    // We only touch the columns we know exist + new columns from migration.
    const memberUpsertSQL = `
      INSERT INTO members (email, name, phone, location, active, member_type, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        location = EXCLUDED.location,
        active = EXCLUDED.active,
        member_type = EXCLUDED.member_type,
        updated_at = NOW()
      RETURNING id, email, name, active, member_type;
    `;

    const memberResult = await client.query(memberUpsertSQL, [
      cleanEmail,
      cleanName,
      phone,
      location,
      !!active,
      safeType
    ]);

    // 2) Keep your admin dashboard working: insert/update applications too
    // We’ll try insert; if it already exists (same email), update it.
    const appInsertSQL = `
      INSERT INTO applications (
        full_name,
        email,
        phone,
        location,
        paid_in_full,
        deposit_paid,
        interest_level,
        status,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING id;
    `;

    try {
      await client.query(appInsertSQL, [
        cleanName,
        cleanEmail,
        phone,
        location,
        !!paid_in_full,
        !!deposit_paid,
        String(interest_level || "Ready to join"),
        String(status || "approved")
      ]);
    } catch (e) {
      // If email already exists in applications, update it instead.
      // (Works even if unique constraint is on email.)
      if (e && e.code === "23505") {
        const appUpdateSQL = `
          UPDATE applications
          SET
            full_name = $1,
            phone = $2,
            location = $3,
            paid_in_full = $4,
            deposit_paid = $5,
            interest_level = $6,
            status = $7
          WHERE email = $8;
        `;
        await client.query(appUpdateSQL, [
          cleanName,
          phone,
          location,
          !!paid_in_full,
          !!deposit_paid,
          String(interest_level || "Ready to join"),
          String(status || "approved"),
          cleanEmail
        ]);
      } else {
        // If applications table differs, we don’t want to block member creation
        console.error("applications insert/update skipped:", e?.message || e);
      }
    }

    return res.status(200).json({
      ok: true,
      member: memberResult.rows[0],
      message: "Member added/updated."
    });
  } catch (err) {
    console.error("add-member error:", err);
    return res.status(500).json({ error: "Failed to add member", details: err.message });
  } finally {
    await client.end();
  }
};
