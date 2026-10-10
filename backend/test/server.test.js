const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
process.env.AUTH_SECRET = 'integration-test-secret';
const { app, pool } = require('../src/server');
const { hashPassword, signToken } = require('../src/auth');

test('actual server mounts reader, authentication, ownership and cache invalidation routes', async () => {
  const db = new PGlite();
  const originalQuery = pool.query;
  pool.query = (...args) => db.query(...args);
  let server;
  try {
    await db.exec(fs.readFileSync(path.join(__dirname, '../src/init.sql'), 'utf8'));
    for (const id of [1, 2]) await db.query("INSERT INTO users (id,name,username,email,password,role) VALUES ($1,$2,$2,$2,$3,'admin')", [id, `admin${id}`, hashPassword('old-password')]);
    await db.exec("INSERT INTO posts (title,slug,author_id) VALUES ('First','first',1), ('Second','second',2)");
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const headers = { Authorization: `Bearer ${signToken({ id: 1, role: 'admin' })}`, 'Content-Type': 'application/json' };
    for (const endpoint of ['/posts?summary=1', '/posts/first', '/dashboard', '/public/posts', '/public/posts/first']) {
      const response = await fetch(`${base}${endpoint}`, { headers });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
    assert.equal((await fetch(`${base}/posts`)).headers.get('cache-control'), 'no-cache');
    assert.equal((await fetch(`${base}/public/posts`)).headers.get('cache-control'), 'no-cache');
    assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).headers.get('cache-control'), 'private, no-store');
    assert.equal((await fetch(`${base}/posts`, { headers: { Authorization: 'Bearer invalid' } })).headers.get('cache-control'), 'private, no-store');
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const publicList = await (await fetch(`${base}/public/posts`)).json();
    assert.equal(publicList.posts.length, 2);
    assert.equal((await fetch(`${base}/public/posts/first`)).status, 200);
    assert.equal((await fetch(`${base}/public/posts/first/related`)).status, 200);
    assert.equal((await fetch(`${base}/public/categories`)).status, 200);
    const own = await (await fetch(`${base}/posts?summary=1`, { headers })).json();
    assert.deepEqual(own.map(post => post.slug), ['first']);
    assert.equal((await fetch(`${base}/posts/2`, { method: 'DELETE', headers })).status, 403);
    assert.equal((await fetch(`${base}/posts/2`, { method: 'PUT', headers, body: JSON.stringify({ title: 'Unauthorized' }) })).status, 403);
    assert.equal((await fetch(`${base}/password`, { method: 'PUT', headers, body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }) })).status, 200);
    assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin1', password: 'new-password' }) })).status, 200);
    assert.equal((await fetch(`${base}/dashboard`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/images/content`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${base}/images/content`, { method: 'DELETE' })).status, 401);
    assert.equal((await fetch(`${base}/posts/1`, { method: 'DELETE', headers })).status, 200);
    assert.equal((await (await fetch(`${base}/public/posts`)).json()).posts.length, 1);
    assert.equal((await fetch(`${base}/public/posts/first`)).status, 404);
    const missing = await fetch(`${base}/missing`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /json/);

    // Check the complete role boundary through the mounted application.
    const admin2 = { ...headers, Authorization: `Bearer ${signToken({ id: 2, role: 'superadmin' })}` };
    const call = (endpoint, method = 'GET', auth = {}, body) => fetch(`${base}${endpoint}`, {
      method, headers: auth, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const [endpoint, method] of [['/posts', 'POST'], ['/posts/2', 'PUT'], ['/posts/2', 'DELETE'], ['/password', 'PUT'], ['/admins', 'POST'], ['/dashboard', 'GET']]) {
      assert.equal((await call(endpoint, method)).status, 401, `Guest cannot ${method} ${endpoint}`);
    }
    assert.equal((await call('/admins', 'POST', admin2, { name: 'Blocked' })).status, 403, 'Token role cannot override database role');
    assert.equal((await call('/admins/1/adsense-access', 'PUT', admin2, { enabled: true })).status, 403);
    const created = await call('/posts', 'POST', admin2, { title: 'Private second', slug: 'private-second', status: 'draft', authorId: 1, author_id: 1 });
    assert.equal(created.status, 201);
    const draft = await created.json();
    assert.equal(draft.authorId, 2, 'Author is always the signed-in admin');
    assert.equal((await call('/public/posts/private-second')).status, 404);
    assert.equal((await call('/posts/private-second', 'GET', headers)).status, 404);
    assert.equal((await call('/posts/private-second', 'GET', admin2)).status, 200);
    const list2 = await (await call('/posts', 'GET', admin2)).json();
    assert.equal(list2.length, 2);
    assert.ok(list2.every(post => post.authorId === 2));
    const list1 = await (await call('/posts?authorId=2&role=superadmin', 'GET', headers)).json();
    assert.deepEqual(list1, []);
    const ownDashboard = await (await call('/dashboard?userId=2&role=superadmin', 'GET', headers)).json();
    assert.equal(ownDashboard.totalPosts, 0);
    assert.deepEqual(ownDashboard.users.map(user => user.id), [1]);
    const edited = await call(`/posts/${draft.id}`, 'PUT', admin2, { title: 'Published second', status: 'published', authorId: 1 });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).authorId, 2);
    assert.equal((await call('/public/posts/private-second')).status, 200);

    await db.query("INSERT INTO users (id,name,username,email,password,role) VALUES (3,'Owner','owner','owner@test',$1,'superadmin')", [hashPassword('owner-password')]);
    await db.exec("SELECT setval('users_id_seq', 3)");
    const owner = { ...headers, Authorization: `Bearer ${signToken({ id: 3, role: 'superadmin' })}` };
    const newAdmin = await call('/admins', 'POST', owner, { name: 'Third', username: 'third', email: 'third@test', password: 'third-password', role: 'superadmin' });
    assert.equal(newAdmin.status, 201);
    assert.equal((await newAdmin.json()).role, 'admin');
    const signedIn = await call('/login', 'POST', { 'Content-Type': 'application/json' }, { username: 'third', password: 'third-password' });
    assert.equal(signedIn.status, 200, 'Admin created by superadmin can log in');
    const third = await signedIn.json();
    const thirdHeaders = { ...headers, Authorization: `Bearer ${third.token}` };
    assert.equal((await call('/password', 'PUT', thirdHeaders, { currentPassword: 'third-password', newPassword: 'third-new-password', userId: 2 })).status, 200);
    assert.equal((await call('/login', 'POST', { 'Content-Type': 'application/json' }, { username: 'admin2', password: 'old-password' })).status, 200, 'Changing password does not affect another admin');
    const allPosts = await (await call('/posts', 'GET', owner)).json();
    assert.equal(allPosts.length, 2);
    assert.equal((await call('/posts/2', 'PUT', owner, { title: 'Owner edit' })).status, 200);
    assert.equal((await call(`/posts/${draft.id}`, 'DELETE', owner)).status, 200);
    assert.equal((await call('/public/posts/private-second')).status, 404);
    await db.query('DELETE FROM users WHERE id = $1', [third.user.id]);
    assert.equal((await call('/posts', 'GET', thirdHeaders)).status, 401, 'Deleted accounts cannot fall back to a public admin list');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    await pool.end();
    await db.close();
  }
});
