const test = require('node:test');
const assert = require('node:assert/strict');
process.env.AUTH_SECRET ||= 'test-secret-for-tests';
const express = require('express');
const { getUniqueSlug, slugify } = require('../src/utils/content');
const { getDashboardData } = require('../src/services/dashboard-service');
const { createPostsRouter } = require('../src/routes/posts');
const { createAuthRouter } = require('../src/routes/auth');
const { hashPassword } = require('../src/auth');

test('slug utilities produce stable slugs and skip collisions', async () => {
  assert.equal(slugify('  Hello, World!  '), 'hello-world');
  let calls = 0;
  const fakePool = { query: async () => ({ rows: calls++ === 0 ? [{}] : [] }) };
  assert.equal(await getUniqueSlug(fakePool, 'Hello World', 'ignored'), 'hello-world-1');
});

test('dashboard service preserves camel-case admin post counts', async () => {
  const fakePool = {
    query: async (sql) => {
      if (sql.includes('COUNT(*) FILTER') && sql.includes('FROM posts p')) {
        if (sql.includes('GROUP BY to_char')) return { rows: [{ date: '2026-09-08', total: 3, published: 2, drafts: 1 }] };
        return { rows: [{ total: 3, published: 2, drafts: 1 }] };
      }
      if (sql.includes('FROM users WHERE role')) return { rows: [{ total: 1 }] };
      if (sql.includes('COUNT(p.id)::int AS posts_count')) return { rows: [{ id: 7, name: 'Admin', username: 'admin', email: 'admin@example.com', role: 'admin', posts_count: 3, adsense_access: false }] };
      if (sql.includes('"postCount"')) return { rows: [{ id: 7, name: 'Admin', username: 'admin', role: 'admin', postCount: 3 }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const dashboard = await getDashboardData(fakePool, null, 'superadmin', { from: '2026-09-01', to: '2026-09-08' });
  assert.equal(dashboard.adminStats[0].postCount, 3);
  assert.deepEqual(dashboard.chart[0], { date: '2026-09-08', total: 3, published: 2, drafts: 1 });
});

test('public posts route returns the list query without authentication', async () => {
  const fakePool = {
    query: async (sql) => {
      assert.match(sql, /status = 'published'/);
      return { rows: [{ id: 1, title: 'Public post', slug: 'public-post', description: 'Short content', status: 'published' }] };
    },
  };
  const passthroughUpload = { single: () => (_request, _response, next) => next() };
  const passthroughAuth = (_request, _response, next) => next();
  const app = express();
  app.use('/api', createPostsRouter({
    pool: fakePool,
    optionalAuthenticate: passthroughAuth,
    authenticate: passthroughAuth,
    requireRole: () => passthroughAuth,
    upload: passthroughUpload,
    saveUploadedImage: async () => null,
    removeUploadedImage: async () => {},
    cleanupRegisteredContentImages: async () => {},
  }));

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/posts`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ id: 1, title: 'Public post', slug: 'public-post', description: 'Short content', status: 'published' }]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('login route rejects non-admin accounts before issuing a token', async () => {
  const fakePool = {
    query: async (sql) => {
      if (sql.includes('FROM users WHERE username')) {
        return { rows: [{ id: 2, username: 'reader', password: hashPassword('reader-password'), role: 'user', name: 'Reader', adsense_access: false }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const passthroughAuth = (_request, _response, next) => next();
  const app = express();
  app.use(express.json());
  app.use('/api', createAuthRouter({
    pool: fakePool,
    authenticate: passthroughAuth,
    requireRole: () => passthroughAuth,
    checkLoginRateLimit: () => true,
    clearLoginRateLimit: () => {},
  }));

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'reader', password: 'reader-password' }),
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /admin area/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('signed-in admin changes only their own password and can log in with the new password', async () => {
  const { createAuthMiddleware } = require('../src/middleware/auth');
  const { signToken, verifyPassword } = require('../src/auth');
  const user = { id: 7, username: 'created-admin', role: 'admin', name: 'Admin', password: hashPassword('old-password') };
  const pool = { query: async (sql, params) => {
    if (sql.startsWith('UPDATE users SET password')) {
      assert.equal(params[1], user.id);
      assert.equal(params[2], user.password);
      assert.notEqual(params[0], 'new-password');
      user.password = params[0];
      return { rows: [{ id: user.id }] };
    }
    return { rows: [user] };
  } };
  const { authenticate, requireRole } = createAuthMiddleware(pool);
  const app = express();
  app.use(express.json());
  app.use('/api', createAuthRouter({ pool, authenticate, requireRole, checkLoginRateLimit: () => true, clearLoginRateLimit: () => {} }));
  const server = app.listen(0);
  try {
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const token = signToken(user);
    const update = (body, authorized = true) => fetch(base + '/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    assert.equal((await update({ currentPassword: 'old-password', newPassword: 'new-password' }, false)).status, 401);
    assert.equal((await update({ currentPassword: 'wrong-password', newPassword: 'new-password' })).status, 400);
    assert.equal((await update({ currentPassword: 'old-password', newPassword: 'short' })).status, 400);
    assert.equal((await update({ currentPassword: 'old-password', newPassword: 'old-password' })).status, 400);
    assert.equal((await update({ currentPassword: 'old-password', newPassword: 'new-password', id: 999 })).status, 200);
    assert.equal(verifyPassword('new-password', user.password), true);
    for (const [password, status] of [['old-password', 401], ['new-password', 200]]) {
      const response = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password }) });
      assert.equal(response.status, status);
    }
    user.role = 'user';
    assert.equal((await update({ currentPassword: 'new-password', newPassword: 'another-password' })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
