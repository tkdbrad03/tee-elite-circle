const crypto = require('crypto');

function makeToken(email) {
  const secret = process.env.UNSUB_SECRET || '';
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(String(email).toLowerCase()).digest('hex');
}

async function addToSuppression(email) {
  const url = process.env.SUPPRESSION_WEBAPP_URL;
  const token = process.env.SUPPRESSION_TOKEN;
  if (!url || !token) throw new Error('Missing SUPPRESSION_WEBAPP_URL or SUPPRESSION_TOKEN');

  const endpoint = `${url}${url.includes('?') ? '&' : '?'}action=add&token=${encodeURIComponent(token)}`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'unsubscribe' })
  });

  if (!resp.ok) throw new Error(`Suppression add failed (${resp.status})`);
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Suppression add error');
  return data;
}

function page(title, bodyHtml) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:40px 20px;background:#FAF8F5;font-family:Georgia,serif;color:#2A2422;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:22px;">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  try {
    const email = String(req.query.e || '').toLowerCase().trim();
    const token = String(req.query.t || '').trim();

    if (!email || !token) {
      res.status(200).setHeader('Content-Type', 'text/html');
      return res.end(
        page('Unsubscribe', `
          <h2 style="margin:0 0 10px;">Unsubscribe</h2>
          <p style="margin:0;line-height:1.7;color:rgba(0,0,0,0.7);">
            This link is missing details. Please use the unsubscribe link from the email you received.
          </p>
        `)
      );
    }

    const expected = makeToken(email);
    if (!expected || token !== expected) {
      res.status(403).setHeader('Content-Type', 'text/html');
      return res.end(
        page('Unsubscribe', `
          <h2 style="margin:0 0 10px;">Unsubscribe</h2>
          <p style="margin:0;line-height:1.7;color:rgba(0,0,0,0.7);">
            Invalid or expired unsubscribe link.
          </p>
        `)
      );
    }

    await addToSuppression(email);

    res.status(200).setHeader('Content-Type', 'text/html');
    return res.end(
      page('Unsubscribed', `
        <h2 style="margin:0 0 10px;">You’re unsubscribed</h2>
        <p style="margin:0;line-height:1.7;color:rgba(0,0,0,0.7);">
          You will not receive additional emails from this list.
        </p>
      `)
    );
  } catch (e) {
    res.status(500).setHeader('Content-Type', 'text/html');
    return res.end(page('Error', `<p style="margin:0;">Error: ${e?.message || 'Server error'}</p>`));
  }
};
