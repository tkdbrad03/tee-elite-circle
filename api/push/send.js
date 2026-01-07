const { Client } = require('pg');
const webpush = require('web-push');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Configure web-push with VAPID keys
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured');
    return res.status(500).json({ error: 'Push notifications not configured' });
  }

  webpush.setVapidDetails(
    'mailto:hello@tmacmastermind.com',
    vapidPublicKey,
    vapidPrivateKey
  );

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const { title, body, url } = req.body;

    // Get all push subscriptions
    const result = await client.query(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions`
    );

    const subscriptions = result.rows;
    console.log(`Sending push to ${subscriptions.length} subscribers`);

    const payload = JSON.stringify({
      title: title || '🔴 Dr. TMac is LIVE!',
      body: body || 'Join the live session now!',
      url: url || '/live.html',
      icon: '/images/tee-elite-favicon.png',
      badge: '/images/tee-elite-favicon.png'
    });

    // Send to all subscribers
    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    // Count successes and failures
    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Clean up failed subscriptions (expired or unsubscribed)
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const error = results[i].reason;
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription no longer valid, remove it
          await client.query(
            `DELETE FROM push_subscriptions WHERE endpoint = $1`,
            [subscriptions[i].endpoint]
          );
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      sent, 
      failed,
      total: subscriptions.length 
    });

  } catch (error) {
    console.error('Push send error:', error);
    return res.status(500).json({ error: 'Failed to send notifications' });
  } finally {
    await client.end();
  }
};
