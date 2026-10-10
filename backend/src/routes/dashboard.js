const express = require('express');

function createDashboardRouter({ authenticate, requireRole, getDashboardData }) {
  const router = express.Router();

  router.get('/dashboard', authenticate, requireRole('admin', 'superadmin'), async (request, response) => {
    try {
      const userId = request.user.role === 'superadmin' ? null : request.user.id;
      const data = await getDashboardData(userId, request.user.role, {
        from: request.query.from,
        to: request.query.to,
      });
      return response.json(data);
    } catch (error) {
      return response.status(error.status || 500).json({ message: error.message || 'Unable to load dashboard.' });
    }
  });

  return router;
}

module.exports = { createDashboardRouter };
