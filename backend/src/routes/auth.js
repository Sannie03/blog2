const express = require('express');
const { hashPassword, verifyPassword, signToken } = require('../auth');

function createAuthRouter({ pool, authenticate, requireRole, checkLoginRateLimit, clearLoginRateLimit }) {
  const router = express.Router();

  router.put('/password', authenticate, requireRole('admin', 'superadmin'), async (request, response) => {
    const { currentPassword, newPassword } = request.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6 || newPassword.length > 256) {
      return response.status(400).json({ message: 'Enter your current password and a new password between 6 and 256 characters.' });
    }
    if (currentPassword === newPassword) return response.status(400).json({ message: 'Choose a different new password.' });
    try {
      const result = await pool.query('SELECT password FROM users WHERE id = $1', [request.user.id]);
      const previous = result.rows[0]?.password;
      if (!verifyPassword(currentPassword, previous)) return response.status(400).json({ message: 'Current password is incorrect.' });
      const updated = await pool.query('UPDATE users SET password = $1 WHERE id = $2 AND password = $3 RETURNING id', [hashPassword(newPassword), request.user.id, previous]);
      if (!updated.rows.length) return response.status(409).json({ message: 'Password has changed. Please try again.' });
      return response.json({ message: 'Password changed successfully.' });
    } catch {
      return response.status(500).json({ message: 'Unable to change password.' });
    }
  });

  router.post('/login', async (request, response) => {
    const { username, password } = request.body || {};
    if (!checkLoginRateLimit(request)) {
      return response.status(429).json({ message: 'Too many login attempts. Try again later.' });
    }

    try {
      const normalizedUsername = String(username || '').trim();
      const result = await pool.query(
        'SELECT id, username, password, role, name, adsense_access FROM users WHERE username = $1 LIMIT 1',
        [normalizedUsername]
      );
      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password)) {
        return response.status(401).json({ message: 'Invalid username or password' });
      }
      if (!['admin', 'superadmin'].includes(user.role)) {
        return response.status(403).json({ message: 'This account does not have access to the admin area.' });
      }

      clearLoginRateLimit(request);
      const token = signToken(user);
      return response.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          adsense_access: Boolean(user.adsense_access),
        },
        token,
        message: 'Login successful',
      });
    } catch (error) {
      return response.status(500).json({ message: error.message || 'Login failed' });
    }
  });

  router.post('/admins', authenticate, requireRole('superadmin'), async (request, response) => {
    const { name, username, email, password } = request.body || {};
    if (!name || !username || !email || !password) {
      return response.status(400).json({ message: 'Name, username, email and password are required.' });
    }

    const normalizedName = String(name).trim();
    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedName || !normalizedUsername || !normalizedEmail || String(password).trim().length < 6) {
      return response.status(400).json({ message: 'Please provide valid account information and a password with at least 6 characters.' });
    }

    try {
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
        [normalizedUsername, normalizedEmail]
      );
      if (existing.rows.length > 0) {
        return response.status(409).json({ message: 'Username or email already exists.' });
      }

      const result = await pool.query(
        `INSERT INTO users (name, username, email, password, role, posts_count)
         VALUES ($1, $2, $3, $4, 'admin', 0)
         RETURNING id, name, username, email, role, posts_count`,
        [normalizedName, normalizedUsername, normalizedEmail, hashPassword(password)]
      );
      return response.status(201).json(result.rows[0]);
    } catch (error) {
      return response.status(500).json({ message: error.message || 'Unable to create admin account.' });
    }
  });

  router.put('/admins/:id/adsense-access', authenticate, requireRole('superadmin'), async (request, response) => {
    const { id } = request.params;
    const { enabled } = request.body || {};
    try {
      const result = await pool.query(
        "UPDATE users SET adsense_access = $1 WHERE id = $2 AND role IN ('admin', 'superadmin') RETURNING id, name, username, email, role, adsense_access",
        [Boolean(enabled), Number(id)]
      );
      if (result.rows.length === 0) return response.status(404).json({ message: 'Admin account not found.' });
      return response.json(result.rows[0]);
    } catch (error) {
      return response.status(500).json({ message: error.message || 'Unable to update AdSense access.' });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
