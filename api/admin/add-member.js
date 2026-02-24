const { Client } = require("pg");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

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
