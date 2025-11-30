const { Client } = require('pg');
const { sendEmail, depositConfirmedEmail, adminDepositPaidEmail, ADMIN_EMAIL } = require('../lib/email');

// Stripe webhook handler for payment confirmations
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get the event data from Stripe
    const event = req.body;

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const paymentId = session.payment_intent;

      if (!customerEmail) {
        console.error('No customer email in session');
        return res.status(200).json({ received: true });
      }

      await client.connect();

      // Find application by email
      const result = await client.query(
        'SELECT * FROM applications WHERE LOWER(email) = LOWER($1)',
        [customerEmail]
      );

      if (result.rows.length > 0) {
        const application = result.rows[0];

        // Update application with deposit paid
        await client.query(
          `UPDATE applications 
           SET deposit_paid = true, 
               stripe_payment_id = $1, 
               status = 'deposit_paid',
               updated_at = NOW() 
           WHERE id = $2`,
          [paymentId, application.id]
        );

        // Send deposit confirmation email to customer
        try {
          const emailContent = depositConfirmedEmail(application.full_name);
          await sendEmail({
            to: customerEmail,
            subject: emailContent.subject,
            content: emailContent.content
          });
          console.log('Deposit confirmation email sent to:', customerEmail);
        } catch (emailErr) {
          console.error('Failed to send deposit confirmation email:', emailErr);
        }

        // Send notification to admin
        try {
          const adminEmailContent = adminDepositPaidEmail(application.full_name, customerEmail);
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: adminEmailContent.subject,
            content: adminEmailContent.content
          });
          console.log('Admin deposit notification sent');
        } catch (emailErr) {
          console.error('Failed to send admin deposit notification:', emailErr);
        }
      } else {
        console.log('No application found for email:', customerEmail);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  } finally {
    await client.end();
  }
};
