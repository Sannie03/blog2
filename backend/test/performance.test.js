const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const compression = require('compression');
const { PGlite } = require('@electric-sql/pglite');
const { createPublicCache } = require('../src/services/public-cache');
const { createReaderRouter } = require('../src/routes/reader');
const { createPostsRouter } = require('../src/routes/posts');
const { getDashboardData } = require('../src/services/dashboard-service');

test('cache expires, bounds memory, and rejects stale fills after invalidation', async () => {
  let now = 0;
  const cache = createPublicCache({ ttl: 10, maxEntries: 2, maxBytes: 50, now: () => now });
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cache.get('one', load), 1);
  assert.equal(await cache.get('one', load), 1);
  now = 11;
  assert.equal(await cache.get('one', load), 2);
  await cache.get('two', load);
  await cache.get('three', load);
  assert.equal(await cache.get('one', load), 5);
  let finish;
  const pending = cache.get('pending', () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  finish('old');
  await pending;
  assert.equal(await cache.get('pending', async () => 'fresh'), 'fresh');
  await cache.get('large', async () => 'x'.repeat(100));
  assert.equal(await cache.get('large', async () => 'small'), 'small');
});

test('concurrent public requests share one database load; failed loads can retry', async () => {
  const cache = createPublicCache();
  let calls = 0;
  const values = await Promise.all(Array.from({ length: 10 }, () => cache.get('same', async () => ++calls)));
  assert.deepEqual(values, Array(10).fill(1));
  await assert.rejects(cache.get('error', async () => { throw new Error('offline'); }));
  assert.equal(await cache.get('error', async () => 'recovered'), 'recovered');
});

test('PostgreSQL reader queries, mutation invalidation, summaries and compression', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(fs.readFileSync(path.join(__dirname, '../src/init.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../src/migrate.sql'), 'utf8'));
  await db.exec("INSERT INTO users (id,name,username,email,role,password) VALUES (1,'Owner','owner','owner@test','superadmin','test-only')");
  await db.exec(`INSERT INTO posts (title, slug, author_id, description, categories, tags, created_at)
    SELECT 'Story ' || n, 'story-' || n, 1, repeat('Full article text. ', 200),
      CASE WHEN n % 2 = 0 THEN ' Technology , News' ELSE 'Travel' END, '', NOW()
    FROM generate_series(1,27) n;
    INSERT INTO posts (title,slug,status,categories) VALUES ('Secret','secret','draft','Private')`);
  let queries = 0;
  const imagePrefix = `![image](https://example.com/${'long-image-path'.repeat(30)}.png)\n<img src="https://example.com/other.png">\n`;
  await db.query("UPDATE posts SET description = $1 || description WHERE slug = 'story-27'", [imagePrefix]);
  const pool = { query: (...args) => { queries++; return db.query(...args); } };
  const cache = createPublicCache();
  const app = express();
  app.use(compression());
  app.use(express.json());
  const auth = (req, _res, next) => { req.user = req.headers.authorization === 'Bearer second-admin' ? { id: 2, role: 'admin' } : req.headers.authorization ? { id: 1, role: 'superadmin' } : null; next(); };
  app.use('/api/public', createReaderRouter({ pool, cache }));
  app.use('/api', createPostsRouter({ pool, publicCache: cache, optionalAuthenticate: auth, authenticate: auth,
    requireRole: () => (_req, _res, next) => next(), upload: { single: () => (_req, _res, next) => next() },
    saveUploadedImage: async () => null, removeUploadedImage: async () => {}, cleanupRegisteredContentImages: async () => {} }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const get = async url => { const r = await fetch(base + url); assert.equal(r.status, 200); return r.json(); };
  try {
    const first = await get('/public/posts');
    assert.equal(first.posts.length, 12);
    assert.equal(first.posts[0].slug, 'story-27');
    assert.equal(first.posts[0].description, undefined);
    assert.equal(first.hasMore, true);
    const before = queries;
    assert.deepEqual(await get('/public/posts'), first);
    assert.equal(queries, before);
    const second = await get('/public/posts?page=2');
    assert.equal(second.posts.length, 12);
    assert.ok(second.posts.every(p => !first.posts.some(other => other.id === p.id)));
    const last = await get('/public/posts?page=3');
    assert.equal(last.posts.length, 3);
    assert.equal(last.hasMore, false);
    assert.equal((await get('/public/posts?category=TECHNOLOGY')).posts.length, 12);
    assert.equal((await get('/public/posts?page=2&category=technology')).posts.length, 1);
    const categories = await get('/public/categories');
    assert.equal(categories.find(c => c.name === 'Technology').count, 13);
    assert.ok(!categories.some(c => c.name === 'Private'));
    for (const page of ['0', '-1', '1.5', 'nope', '100001']) assert.equal((await fetch(`${base}/public/posts?page=${page}`)).status, 400);
    assert.equal((await fetch(`${base}/public/posts/secret`)).status, 404);
    const related = await get('/public/posts/story-27/related');
    assert.equal(related.length, 3);
    assert.ok(related.every(p => p.slug !== 'story-27' && p.categories === 'Travel'));
    const articleResponse = await fetch(`${base}/public/posts/story-27`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(articleResponse.headers.get('content-encoding'), 'gzip');
    const article = await articleResponse.json();
    assert.ok(article.description.length > 180);
    assert.ok(article.description.startsWith(imagePrefix));
    const headers = { Authorization: 'Bearer test-admin', 'Content-Type': 'application/json' };
    const summaries = await (await fetch(`${base}/posts?summary=1`, { headers })).json();
    assert.ok(summaries.find(p => p.slug === article.slug).description.length <= 180);
    const detail = await (await fetch(`${base}/posts/${article.slug}`, { headers })).json();
    assert.equal(detail.description, article.description);
    const dashboard = await getDashboardData(pool, null, 'superadmin');
    assert.equal(dashboard.totalPosts, 28);
    assert.equal(dashboard.adminStats[0].postCount, 27);
    const updated = await fetch(`${base}/posts/${article.id}`, { method: 'PUT', headers,
      body: JSON.stringify({ ...detail, title: 'Edited', status: 'draft' }) });
    assert.equal(updated.status, 200);
    assert.equal((await fetch(`${base}/public/posts/${article.slug}`)).status, 404);
    assert.ok(!(await get('/public/posts')).posts.some(p => p.id === article.id));
    assert.equal((await get('/public/categories')).find(c => c.name === 'Travel').count, 13);
    const created = await fetch(`${base}/posts`, { method: 'POST', headers,
      body: JSON.stringify({ title: 'Brand new', slug: 'brand-new', description: 'New content', categories: 'New category' }) });
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.equal((await get('/public/posts/brand-new')).title, 'Brand new');
    assert.ok((await get('/public/categories')).some(c => c.name === 'New category'));
    assert.equal((await fetch(`${base}/posts/${saved.id}`, { method: 'DELETE', headers })).status, 200);
    assert.equal((await fetch(`${base}/public/posts/brand-new`)).status, 404);
    assert.ok(!(await get('/public/categories')).some(c => c.name === 'New category'));
    await db.exec("INSERT INTO users (id,name,username,email,role,password) VALUES (2,'Second','second','second@test','admin','test-only'); INSERT INTO posts (title,slug,author_id,status) VALUES ('Own draft','own-draft',2,'draft'), ('Own public','own-public',2,'published')");
    const secondHeaders = { Authorization: 'Bearer second-admin', 'Content-Type': 'application/json' };
    const ownPosts = await (await fetch(`${base}/posts`, { headers: secondHeaders })).json();
    assert.equal(ownPosts.length, 2);
    assert.ok(ownPosts.every(post => post.authorId === 2));
    assert.equal((await fetch(`${base}/posts/1`, { method: 'DELETE', headers: secondHeaders })).status, 403);
    assert.equal((await fetch(`${base}/posts/1`, { method: 'PUT', headers: secondHeaders, body: JSON.stringify({ title: 'Not allowed' }) })).status, 403);
    const allPosts = await (await fetch(`${base}/posts`, { headers })).json();
    assert.ok(allPosts.some(post => post.authorId === 1));
    assert.ok(allPosts.some(post => post.authorId === 2));
    const publicPosts = await get('/posts');
    assert.ok(publicPosts.every(post => post.status === 'published'));
    assert.ok(publicPosts.some(post => post.authorId === 1));
    assert.ok(publicPosts.some(post => post.authorId === 2));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
