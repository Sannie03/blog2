const { verifyToken, getBearerToken } = require('../auth');

function createAuthMiddleware(pool) {
  async function authenticate(request, response, next) {
    const tokenUser = verifyToken(getBearerToken(request));
    if (!tokenUser) return response.status(401).json({ message: 'Authentication required.' });

    try {
      const result = await pool.query(
        'SELECT id, username, name, role, adsense_access FROM users WHERE id = $1 LIMIT 1',
        [tokenUser.sub]
      );
      const user = result.rows[0];
      if (!user) return response.status(401).json({ message: 'Authentication required.' });
      request.user = user;
      return next();
    } catch (error) {
      return response.status(500).json({ message: error.message || 'Authentication failed.' });
    }
  }

  function requireRole(...roles) {
    return (request, response, next) => {
      if (!request.user || !roles.includes(request.user.role)) {
        return response.status(403).json({ message: 'You do not have permission to perform this action.' });
      }
      return next();
    };
  }

  async function optionalAuthenticate(request, response, next) {
    const bearerToken = getBearerToken(request);
    if (request.headers.authorization && !bearerToken) {
      return response.status(401).json({ message: 'Invalid authentication token.' });
    }
    const tokenUser = verifyToken(bearerToken);
    if (!tokenUser) {
      return bearerToken
        ? response.status(401).json({ message: 'Invalid authentication token.' })
        : next();
    }

    try {
      const result = await pool.query(
        'SELECT id, username, name, role, adsense_access FROM users WHERE id = $1 LIMIT 1',
        [tokenUser.sub]
      );
      if (!result.rows[0]) return response.status(401).json({ message: 'Authentication required.' });
      request.user = result.rows[0];
      return next();
    } catch (error) {
      return response.status(500).json({ message: error.message || 'Authentication failed.' });
    }
  }

  return { authenticate, optionalAuthenticate, requireRole };
}

module.exports = { createAuthMiddleware };
