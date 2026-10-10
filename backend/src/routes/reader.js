const express = require('express');

const summaryColumns = `p.id, p.title, p.slug,
  p.feature_image AS "featureImage", p.categories, p.tags, p.created_at`;

function createReaderRouter({ pool, cache }) {
  const router = express.Router();
  const endpoint = (key, load) => async (request, response, next) => {
    try {
      // Revalidate in browsers; invalidation is controlled by the server cache.
      response.set('Cache-Control', request.headers.authorization ? 'private, no-store' : 'no-cache');
      response.json(await cache.get(key(request), () => load(request)));
    } catch (error) { next(error); }
  };

  router.get('/posts', (request, response, next) => {
    const page = Number(request.query.page || 1);
    const category = request.query.category || '';
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || typeof category !== 'string' || category.length > 255) {
      return response.status(400).json({ message: 'Invalid page or category.' });
    }
    request.readerQuery = { page, category: category.trim().toLowerCase() };
    next();
  }, endpoint(r => `list:${JSON.stringify(r.readerQuery)}`, async (request) => {
    const { page, category } = request.readerQuery;
    const result = await pool.query(`SELECT ${summaryColumns} FROM posts p
      WHERE p.status = 'published'
        AND ($1::text = '' OR EXISTS (
          SELECT 1 FROM unnest(string_to_array(p.categories, ',')) AS topic
          WHERE lower(btrim(topic)) = $1))
      ORDER BY p.created_at DESC, p.id DESC LIMIT 13 OFFSET $2`, [category, (page - 1) * 12]);
    return { posts: result.rows.slice(0, 12), page, hasMore: result.rows.length > 12 };
  }));

  router.get('/categories', endpoint(() => 'categories', async () => {
    const result = await pool.query(`SELECT btrim(topic) AS name, COUNT(*)::int AS count
      FROM posts p CROSS JOIN LATERAL unnest(string_to_array(p.categories, ',')) AS topic
      WHERE p.status = 'published' AND btrim(topic) <> ''
      GROUP BY btrim(topic) ORDER BY count DESC, name ASC`);
    return result.rows;
  }));

  router.get('/posts/:slug/related', endpoint(r => `related:${r.params.slug}`, async (request) => {
    const result = await pool.query(`WITH source AS (
        SELECT id, string_to_array(lower(concat_ws(',', categories, tags)), ',') AS topics
        FROM posts WHERE slug = $1 AND status = 'published'
      ), ranked AS (
        SELECT p.*, (SELECT COUNT(*) FROM unnest(string_to_array(lower(concat_ws(',', p.categories, p.tags)), ',')) AS topic
          WHERE btrim(topic) <> '' AND EXISTS (SELECT 1 FROM unnest(source.topics) AS source_topic WHERE btrim(source_topic) = btrim(topic))) AS matches
        FROM posts p CROSS JOIN source WHERE p.status = 'published' AND p.id <> source.id
      ) SELECT ${summaryColumns}, p.matches FROM ranked p
      ORDER BY p.matches DESC, p.created_at DESC, p.id DESC LIMIT 3`, [request.params.slug]);
    return result.rows.some(post => Number(post.matches) > 0)
      ? result.rows.filter(post => Number(post.matches) > 0) : result.rows;
  }));

  router.get('/posts/:slug', async (request, response, next) => {
    try {
      const post = await cache.get(`article:${request.params.slug}`, async () => {
        const result = await pool.query(`SELECT p.id, p.title, p.slug, p.description,
          p.feature_image AS "featureImage", p.categories, p.tags, p.created_at,
          p.prev_chapter AS "prevChapter", p.next_chapter AS "nextChapter",
          u.name AS "authorName" FROM posts p LEFT JOIN users u ON u.id = p.author_id
          WHERE p.slug = $1 AND p.status = 'published' LIMIT 1`, [request.params.slug]);
        return result.rows[0] || null;
      });
      response.set('Cache-Control', request.headers.authorization ? 'private, no-store' : 'no-cache');
      if (!post) return response.status(404).json({ message: 'Post not found' });
      return response.json(post);
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createReaderRouter };
