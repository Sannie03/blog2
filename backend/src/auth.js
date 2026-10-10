const crypto = require('crypto');

const tokenSecret = process.env.AUTH_SECRET;
if (!tokenSecret) {
  throw new Error('AUTH_SECRET must be configured before starting the backend.');
}
const tokenLifetimeSeconds = 24 * 60 * 60;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== 'string') return false;
  // Plaintext passwords are deliberately not accepted. Existing installations
  // must be migrated to scrypt hashes before enabling this server.
  if (!storedPassword.startsWith('scrypt$')) return false;

  const parts = storedPassword.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expected] = parts;
  if (!/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]{128}$/i.test(expected)) return false;
  let actual;
  try {
    actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  } catch {
    return false;
  }
  return actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: Number(user.id),
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.sub || !decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function getBearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  getBearerToken,
};
