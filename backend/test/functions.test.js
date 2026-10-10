const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Keep this suite local even when a developer has Cloudinary credentials.
process.env.AUTH_SECRET = 'functional-test-secret';
for (const key of ['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) process.env[key] = '';
process.env.PUBLIC_URL = 'http://127.0.0.1';
process.env.PUBLIC_SITE_URL = 'https://reader.test';
const { app, pool } = require('../src/server');
const { hashPassword, signToken } = require('../src/auth');
const { removeUploadedImage } = require('../src/services/image-service');

test('functional routes with a temporary database and real local image uploads', async t => {
  const db = new PGlite();
  const originalQuery = pool.query;
  pool.query = (...args) => db.query(...args);
  const uploaded = [];
  let server;
  try {
    await db.exec(fs.readFileSync(path.join(__dirname, '../src/init.sql'), 'utf8'));
    for (const [id, role] of [[1, 'superadmin'], [2, 'admin'], [3, 'admin']]) {
      await db.query('INSERT INTO users (id,name,username,email,password,role) VALUES ($1,$2,$2,$2,$3,$4)', [id, `account${id}`, hashPassword('test-password'), role]);
    }
    await db.exec("SELECT setval('users_id_seq', 3)");
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const call = (endpoint, { id, method = 'GET', body, headers = {} } = {}) => fetch(origin + endpoint, {
      method, redirect: 'manual', headers: {
        ...(id ? { Authorization: `Bearer ${signToken({ id })}` } : {}),
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers,
      }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    const json = async (endpoint, options, status = 200) => {
      const response = await call(endpoint, options);
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    };
    const png = fs.readFileSync(path.join(__dirname, '../../frontend/src/assets/hero.png'));
    const imageForm = (field = 'image', bytes = png, type = 'image/png') => {
      const form = new FormData();
      form.append(field, new Blob([bytes], { type }), 'test.png');
      return form;
    };

    await t.test('accounts, duplicate validation, permission toggles and login rate limit', async () => {
      await json('/api/admins', { id: 1, method: 'POST', body: { name: 'New', username: 'new-admin', email: 'new@test', password: 'test-password' } }, 201);
      await json('/api/admins', { id: 1, method: 'POST', body: { name: 'New', username: 'new-admin', email: 'new@test', password: 'test-password' } }, 409);
      for (const enabled of [true, false]) {
        const result = await json('/api/admins/2/adsense-access', { id: 1, method: 'PUT', body: { enabled } });
        assert.equal(result.adsense_access, enabled);
        const login = await json('/api/login', { method: 'POST', body: { username: 'account2', password: 'test-password' } });
        assert.equal(login.user.adsense_access, enabled);
      }
      await json('/api/admins/3/adsense-access', { id: 2, method: 'PUT', body: { enabled: true } }, 403);
      for (let attempt = 0; attempt < 10; attempt++) await json('/api/login', { method: 'POST', body: { username: 'missing-account', password: 'bad' } }, 401);
      await json('/api/login', { method: 'POST', body: { username: 'missing-account', password: 'bad' } }, 429);
    });

    await t.test('content images: upload, serve, reject invalid files, ownership and reference cleanup', async () => {
      const saved = await json('/api/images/content', { id: 2, method: 'POST', body: imageForm() }, 201);
      uploaded.push(saved.url);
      const image = await call(new URL(saved.url).pathname);
      assert.equal(image.status, 200);
      assert.match(image.headers.get('content-type'), /image\/png/);
      assert.match(image.headers.get('cache-control'), /max-age=31536000.*immutable/);
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
      await json('/api/images/content', { id: 2, method: 'POST', body: imageForm('image', Buffer.from('not an image')) }, 400);
      await json('/api/images/content', { id: 2, method: 'POST', body: imageForm('image', Buffer.from('text'), 'text/plain') }, 400);
      await json('/api/images/content', { id: 2, method: 'POST', body: imageForm('image', Buffer.alloc(10 * 1024 * 1024 + 1)) }, 400);
      await json('/api/images/content', { id: 3, method: 'DELETE', body: { url: saved.url } }, 403);
      const post = await json('/api/posts', { id: 2, method: 'POST', body: { title: 'Image post', description: `![image](${saved.url})` } }, 201);
      await json('/api/images/content', { id: 2, method: 'DELETE', body: { url: saved.url } }, 409);
      await json(`/api/posts/${post.id}`, { id: 2, method: 'PUT', body: { title: 'Image removed', description: '' } });
      assert.equal((await db.query('SELECT * FROM content_images WHERE url = $1', [saved.url])).rows.length, 0);
      assert.equal(fs.existsSync(path.join(__dirname, '..', new URL(saved.url).pathname)), false);
      await json(`/api/posts/${post.id}`, { id: 2, method: 'DELETE' });
      const unused = await json('/api/images/content', { id: 2, method: 'POST', body: imageForm() }, 201);
      uploaded.push(unused.url);
      await json('/api/images/content', { id: 1, method: 'DELETE', body: { url: unused.url } });
    });

    await t.test('feature image multipart CRUD, chapter fields, unique slugs and draft visibility', async () => {
      const form = imageForm('featureImageFile');
      for (const [key, value] of Object.entries({ title: 'Chapter one', slug: 'chapter', description: 'Full body', status: 'draft', categories: 'Travel', tags: 'Story', prevChapter: '/story/before', nextChapter: '/story/after' })) form.append(key, value);
      const post = await json('/api/posts', { id: 2, method: 'POST', body: form }, 201);
      uploaded.push(post.featureImage);
      assert.equal(post.nextChapter, '/story/after');
      await json('/api/public/posts/chapter', {}, 404);
      const second = await json('/api/posts', { id: 2, method: 'POST', body: { title: 'Another chapter', slug: 'chapter' } }, 201);
      assert.equal(second.slug, 'chapter-1');
      await json(`/api/posts/${post.id}`, { id: 2, method: 'PUT', body: { ...post, status: 'published' } });
      assert.equal((await json('/api/public/posts/chapter')).description, 'Full body');
      await json('/api/posts', { id: 2, method: 'POST', body: { title: '' } }, 400);
      await json('/api/posts', { id: 2, method: 'POST', body: { title: 'x'.repeat(256) } }, 400);
      await json(`/api/posts/${post.id}`, { id: 2, method: 'DELETE' });
      assert.equal(fs.existsSync(path.join(__dirname, '..', new URL(post.featureImage).pathname)), false);
      await json(`/api/posts/${second.id}`, { id: 2, method: 'DELETE' });
    });

    await t.test('dashboard counts and dates use database records and isolate authors', async () => {
      await db.exec("INSERT INTO posts(title,slug,author_id,status,created_at) VALUES ('Published','dated-public',2,'published','2026-09-10 12:00'),('Draft','dated-draft',2,'draft','2026-09-10 13:00'),('Other','dated-other',3,'published','2026-09-11 12:00')");
      const own = await json('/api/dashboard?from=2026-09-10&to=2026-09-10', { id: 2 });
      assert.equal(own.totalPosts, 2);
      assert.equal(own.publishedPosts, 1);
      assert.equal(own.draftPosts, 1);
      assert.equal(own.users.length, 1);
      assert.equal(own.users[0].id, 2);
      assert.deepEqual(own.chart, [{ date: '2026-09-10', total: 2, published: 1, drafts: 1 }]);
      const all = await json('/api/dashboard?from=2026-09-10&to=2026-09-11', { id: 1 });
      assert.equal(all.totalPosts, 3);
      assert.equal(all.users.reduce((sum, user) => sum + user.posts_count, 0), 3);
    });

    await t.test('share metadata escapes content, uses canonical URL and excludes drafts', async () => {
      const post = await json('/api/posts', { id: 2, method: 'POST', body: { title: 'Title <script>bad</script>', slug: 'share', description: '![cover](https://example.test/cover.png)\nHello <script>bad</script>' } }, 201);
      const crawler = await call('/story/share', { headers: { 'User-Agent': 'facebookexternalhit' } });
      assert.equal(crawler.status, 200);
      const html = await crawler.text();
      assert.match(html, /rel="canonical" href="https:\/\/reader.test\/story\/share"/);
      assert.match(html, /property="og:image" content="https:\/\/example.test\/cover.png"/);
      assert.doesNotMatch(html, /<script>bad<\/script>/);
      assert.equal((await call('/story/dated-draft', { headers: { 'User-Agent': 'googlebot' } })).status, 404);
      const redirect = await call('/post/share');
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get('location'), 'https://reader.test/story/share');
      assert.equal((await call('/og-image.png')).status, 200);
      await json(`/api/posts/${post.id}`, { id: 2, method: 'DELETE' });
    });

    await t.test('deleting a feature image preserves references in another post body', async () => {
      const form = imageForm('featureImageFile');
      form.append('title', 'Source image');
      const source = await json('/api/posts', { id: 2, method: 'POST', body: form }, 201);
      uploaded.push(source.featureImage);
      const reference = await json('/api/posts', { id: 2, method: 'POST', body: { title: 'Reused image', description: `![reused](${source.featureImage})` } }, 201);
      await json(`/api/posts/${source.id}`, { id: 2, method: 'DELETE' });
      const imagePath = path.join(__dirname, '..', new URL(source.featureImage).pathname);
      const remains = fs.existsSync(imagePath);
      await json(`/api/posts/${reference.id}`, { id: 2, method: 'DELETE' });
      assert.equal(remains, true, 'An image still used in published content must remain on disk');
    });

    await t.test('dashboard rejects impossible calendar dates as client errors', async () => {
      const response = await call('/api/dashboard?from=2026-02-31', { id: 1 });
      assert.equal(response.status, 400);
    });
  } finally {
    for (const url of uploaded) await removeUploadedImage(url);
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    await pool.end();
    await db.close();
  }
});
