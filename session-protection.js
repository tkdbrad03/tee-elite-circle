// Session protection utilities for Tee Elite Circle

const crypto = require('crypto');

// Generate a secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Verify session token format
function isValidTokenFormat(token) {
  return token && typeof token === 'string' && token.length === 64;
}

// Parse session cookie from request
function getSessionFromRequest(req) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  
  const sessionCookie = cookies
    .split(';')
    .find(c => c.trim().startsWith('tec_session='));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1].trim();
}

// Create session cookie header
function createSessionCookie(token, maxAge = 86400 * 7) {
  return `tec_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// Clear session cookie header
function clearSessionCookie() {
  return 'tec_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

// Protected route wrapper
function withAuth(handler) {
  return async (req, res) => {
    const sessionToken = getSessionFromRequest(req);
    
    if (!sessionToken || !isValidTokenFormat(sessionToken)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Add session to request for use in handler
    req.sessionToken = sessionToken;
    
    return handler(req, res);
  };
}

module.exports = {
  generateSessionToken,
  isValidTokenFormat,
  getSessionFromRequest,
  createSessionCookie,
  clearSessionCookie,
  withAuth
};
