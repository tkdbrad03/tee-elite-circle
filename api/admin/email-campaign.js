const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ---------- HTML hygiene ----------
function sanitizeEmailHtml(html) {
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<(object|embed)\b[^>]*>.*?<\/\1>/gis, '');
}

// ---------- Base URL ----------
function getBaseUrl(req) {
  const envBase = process.env.PUBLIC_BASE_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString();
  const host = req.headers.host;
  return `${proto}://${host}`;
}

// ---------- Token helpers ----------
function makeToken(email) {
  const secret = process.env.UNSUB_SECRET || '';
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(String(email).toLowerCase()).digest('hex');
}

function makeUnsubUrl(baseUrl, email) {
  const t = makeToken(email);
  const e = encodeURIComponent(String(email).toLowerCase());
  return `${baseUrl}/api/unsubscribe?e=${e}&t=${t}`;
}

// ---------- Suppression storage (Upstash REST; fallback = in-memory for quick tests) ----------
async function upstashCmd(cmdArr) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const endpoint = `${url}/${cmdArr.map(encodeURIComponent).join('/')}`;
  const resp = await fetch(endpoint, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!resp.ok) throw new Error(`Upstash error: ${resp.status}`);
  return resp.json();
}

function getMemorySet() {
  if (!globalThis.__tmac_unsub_set) globalThis.__tmac_unsub_set = new Set();
  return globalThis.__tmac_unsub_set;
}

async function isSuppressed(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return false;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const key = `unsub:${e}`;
    const data = await upstashCmd(['get', key]);
    return Boolean(data && data.result);
  }

  // fallback (not reliable across cold starts)
  return getMemorySet().has(e);
}

function buildUnsubFooterHtml(unsubUrl) {
  // No font specified here so it inherits your template fonts automatically
  return `
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid rgba(0,0,0,0.10); font-size:12px; color:rgba(0,0,0,0.55);">
      <a href="${unsubUrl}" style="color:rgba(0,0,0,0.65); text-decoration:underline;">Unsubscribe</a>
    </div>
  `;
}

function buildUnsubFooterText(unsubUrl) {
  return `\n\nUnsubscribe: ${unsubUrl}\n`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { contacts, subject, template, useTemplate } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array required' });
    }
    if (!subject) {
      return res.status(400).json({ error: 'Subject required' });
    }
    if (!template || String(template).trim().length === 0) {
      return res.status(400).json({ error: 'Email template required' });
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Missing Gmail environment variables' });
    }
    if (!process.env.UNSUB_SECRET) {
      return res.status(500).json({ error: 'Missing UNSUB_SECRET environment variable' });
    }

    const baseUrl = getBaseUrl(req);

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Track results
    const results = {
      sent: 0,
      failed: 0,
      details: []
    };

    // --- KEEP YOUR ORIGINAL WRAPPERS / FONTS ---
    // Plain wrapper (unchanged styling; only change is: ${content} instead of content.replace)
    const createPlainEmail = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; font-size: 16px; line-height: 1.8; color: #333333;">
    ${content}
  </div>
</body>
</html>
`;

    // Branded wrapper (keeps your Georgia serif + colors exactly)
    const createBrandedEmail = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Tee Elite Circle</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: 'Georgia', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF8F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a2f23; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #e8ccc8; font-style: italic;">TMac Inspired presents</p>
              <h1 style="margin: 0; font-size: 32px; font-weight: 400; color: #ffffff; letter-spacing: 0.05em;">The Tee Elite Circle</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 48px;">
              <div style="font-size: 15px; line-height: 1.8; color: #555555;">
                ${content}
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a2f23; padding: 32px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff;">The Tee Elite Circle</p>
              <p style="margin: 0 0 16px 0; font-size: 11px; letter-spacing: 0.15em; color: #e8ccc8;">WHERE GOLF MEETS GREATNESS</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // Gmail-friendly pacing
    const DELAY_BETWEEN_EMAILS = 3000;

    // Sanitize once, then personalize
    const safeTemplate = sanitizeEmailHtml(template);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const email = String(contact?.email || '').toLowerCase().trim();
      const firstName = contact?.first_name || 'there';
      const timestamp = new Date().toISOString();

      if (!email) {
        results.failed++;
        results.details.push({ email: '', first_name: firstName, success: false, error: 'Missing email', timestamp });
        continue;
      }

      // Suppression check
      if (await isSuppressed(email)) {
        results.details.push({ email, first_name: firstName, success: true, error: 'Skipped (unsubscribed)', timestamp });
        continue;
      }

      const unsubUrl = makeUnsubUrl(baseUrl, email);

      const personalizedContent = safeTemplate.replace(/{first_name}/gi, firstName);

      // Add unsubscribe footer inside the email content (inherits fonts)
      const contentWithFooter = `${personalizedContent}${buildUnsubFooterHtml(unsubUrl)}`;

      const htmlContent = useTemplate
        ? createBrandedEmail(contentWithFooter)
        : createPlainEmail(contentWithFooter);

      const textFallback =
        sanitizeEmailHtml(personalizedContent)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim() + buildUnsubFooterText(unsubUrl);

      // Headers to help Gmail show a native unsubscribe option
      const listUnsub = `<${unsubUrl}>, <mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`;
      const headers = {
        'List-Unsubscribe': listUnsub,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      };

      const mailOptions = {
        from: `"Dr. TMac" <${process.env.GMAIL_USER}>`,
        to: email,
        subject,
        text: textFallback,
        html: htmlContent,
        headers
      };

      try {
        await transporter.sendMail(mailOptions);

        results.sent++;
        results.details.push({ email, first_name: firstName, success: true, error: '', timestamp });
      } catch (error) {
        results.failed++;
        results.details.push({ email, first_name: firstName, success: false, error: error?.message || 'Send failed', timestamp });
      }

      if (i < contacts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_EMAILS));
      }
    }

    return res.status(200).json({
      success: true,
      message: `Campaign complete: ${results.sent} sent, ${results.failed} failed`,
      sent: results.sent,
      failed: results.failed,
      results: results.details
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
};
