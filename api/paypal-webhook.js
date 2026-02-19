// /api/paypal-webhook.js
const { Client } = require("pg");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const event = req.body;

    // We only care about successful payments
    if (event?.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      return res.status(200).send("Ignored");
    }

    const payerEmail = event?.resource?.payer?.email_address;
    if (!payerEmail) return res.status(200).send("No payer email");

    const email = payerEmail.toLowerCase().trim();

    await client.connect();

    // Option A: store in a simple payments table (recommended for speed)
    // Create this table once:
    // CREATE TABLE IF NOT EXISTS invitational_payments (
    //   email TEXT PRIMARY KEY,
    //   paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    // );

    await client.query(
      `INSERT INTO invitational_payments (email, paid_at)
       VALUES ($1, NOW())
       ON CONFLICT (email) DO UPDATE SET paid_at = NOW()`,
      [email]
    );

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PayPal webhook error:", err);
    return res.status(500).send("Error");
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
