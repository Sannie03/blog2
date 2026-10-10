const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 10;

function getLoginKey(request) {
  return `${request.ip || 'unknown'}:${String(request.body?.username || '').trim().toLowerCase()}`;
}

function checkLoginRateLimit(request) {
  if (loginAttempts.size > 10000) {
    const now = Date.now();
    for (const [key, attempts] of loginAttempts.entries()) {
      if (!attempts.some((time) => now - time < LOGIN_WINDOW_MS)) loginAttempts.delete(key);
    }
  }

  const key = getLoginKey(request);
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < LOGIN_WINDOW_MS);
  if (recent.length >= LOGIN_LIMIT) return false;
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

function clearLoginRateLimit(request) {
  loginAttempts.delete(getLoginKey(request));
}

module.exports = { checkLoginRateLimit, clearLoginRateLimit };
