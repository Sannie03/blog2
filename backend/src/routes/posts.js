const express = require('express');
const { getUniqueSlug } = require('../utils/content');

function createPostsRouter({ pool, optionalAuthenticate, authenticate, requireRole, upload, saveUploadedImage, removeUploadedImage, cleanupRegisteredContentImages, publicCache }) {
  const router = express.Router();

  router.get('/posts/:slug', optionalAuthenticate, async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.title, p.slug, p.status, p.description, p.author_id AS "authorId",
                u.name AS "authorName", p.created_at, p.feature_image AS "featureImage", p.categories, p.tags,
                p.prev_chapter AS "prevChapter", p.next_chapter AS "nextChapter"
         FROM posts p
         LEFT JOIN users u ON p.author_id = u.id
         WHERE p.slug = $1
           AND (p.status = 'published' OR ($2::int IS NOT NULL AND (p.author_id = $2 OR $3 = 'superadmin')))
         LIMIT 1`,
        [request.params.slug, request.user?.id || null, request.user?.role || '']
      );
      if (result.rows.length === 0) return response.status(404).json({ message: 'Post not found' });
      return response.json(result.rows[0]);
    } catch (error) {
      return response.status(500).json({ message: error.message });
    }
  });

  router.get('/posts', optionalAuthenticate, async (request, response) => {
    try {
      const userId = request.user?.role === 'superadmin' ? null : request.user?.id || null;
      const role = request.user?.role || 'public';
      const descriptionSelect = role === 'public' || request.query.summary === '1' ? 'LEFT(p.description, 180) AS description' : 'p.description';
      let query = `
        SELECT p.id, p.title, p.slug, p.status, ${descriptionSelect}, p.author_id AS "authorId",
               u.name AS "authorName", p.created_at, p.feature_image AS "featureImage",
               p.categories, p.tags, p.prev_chapter AS "prevChapter", p.next_chapter AS "nextChapter"
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id`;
      const params = [];
      if (role === 'public') {
        query += " WHERE p.status = 'published'";
      } else if (role !== 'superadmin') {
        query += ' WHERE p.author_id = $1';
        params.push(Number(userId));
      }
      query += ' ORDER BY p.created_at DESC';
      const result = await pool.query(query, params);
      return response.json(result.rows);
    } catch (error) {
      return response.status(500).json({ message: error.message });
    }
  });

  router.post('/posts', authenticate, requireRole('admin', 'superadmin'), upload.single('featureImageFile'), async (request, response) => {
    const body = request.body || {};
    const { title, slug, description, featureImage, categories, tags, prevChapter, nextChapter, status } = body;
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) return response.status(400).json({ message: 'Title is required' });
    if (normalizedTitle.length > 255 || [categories, tags, prevChapter, nextChapter].some((value) => String(value || '').length > 255)) {
      return response.status(400).json({ message: 'One or more post fields are too long.' });
    }

    let uploadedImage = featureImage || '';
    let savedUpload = null;
    if (request.file) {
      savedUpload = await saveUploadedImage(request.file);
      if (!savedUpload) return response.status(400).json({ message: 'Invalid image file.' });
      uploadedImage = savedUpload.url;
    }
    try {
      const uniqueSlug = await getUniqueSlug(pool, slug, normalizedTitle);
      const result = await pool.query(
        `INSERT INTO posts (title, slug, author_id, status, description, feature_image, categories, tags, prev_chapter, next_chapter)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, title, slug, description, feature_image AS "featureImage", categories, tags,
                   prev_chapter AS "prevChapter", next_chapter AS "nextChapter", status, author_id AS "authorId"`,
        [normalizedTitle, uniqueSlug, request.user.id, status === 'draft' ? 'draft' : 'published',
          description == null ? '' : String(description), uploadedImage, categories || '', tags || '', prevChapter || '', nextChapter || '']
      );
      publicCache?.clear();
      return response.status(201).json(result.rows[0]);
    } catch (error) {
      if (savedUpload) await removeUploadedImage(savedUpload.url);
      if (error.code === '23505') return response.status(409).json({ message: 'A post with this slug already exists.' });
      return response.status(500).json({ message: error.message });
    }
  });

  router.put('/posts/:id', authenticate, requireRole('admin', 'superadmin'), upload.single('featureImageFile'), async (request, response) => {
    const id = Number(request.params.id);
    const body = request.body || {};
    const { title, slug, description, featureImage, categories, tags, prevChapter, nextChapter, status } = body;
    if (!request.params.id || Number.isNaN(id)) return response.status(400).json({ message: 'Valid post ID is required' });
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) return response.status(400).json({ message: 'Title is required' });
    if (normalizedTitle.length > 255 || [categories, tags, prevChapter, nextChapter].some((value) => String(value || '').length > 255)) {
      return response.status(400).json({ message: 'One or more post fields are too long.' });
    }

    let savedUpload = null;
    let databaseUpdated = false;
    try {
      const existing = await pool.query('SELECT id, author_id, slug, feature_image, description FROM posts WHERE id = $1 LIMIT 1', [id]);
      if (existing.rows.length === 0) return response.status(404).json({ message: 'Post not found' });
      const post = existing.rows[0];
      if (request.user.role !== 'superadmin' && post.author_id !== request.user.id) {
        return response.status(403).json({ message: 'You can only edit your own posts' });
      }

      let finalFeatureImage = Object.prototype.hasOwnProperty.call(body, 'featureImage') ? featureImage : post.feature_image;
      if (request.file) {
        savedUpload = await saveUploadedImage(request.file);
        if (!savedUpload) return response.status(400).json({ message: 'Invalid image file.' });
        finalFeatureImage = savedUpload.url;
      }
      const uniqueSlug = await getUniqueSlug(pool, slug || post.slug || normalizedTitle, normalizedTitle, id);
      const result = await pool.query(
        `UPDATE posts SET title = $1, description = $2, feature_image = $3, categories = $4, tags = $5,
                prev_chapter = $6, next_chapter = $7, slug = $8, status = $9, updated_at = NOW()
         WHERE id = $10
         RETURNING id, title, slug, description, feature_image AS "featureImage", categories, tags,
                   prev_chapter AS "prevChapter", next_chapter AS "nextChapter", status,
                   author_id AS "authorId", created_at, updated_at`,
        [normalizedTitle, description == null ? '' : String(description), finalFeatureImage, categories || '', tags || '',
          prevChapter || '', nextChapter || '', uniqueSlug, status === 'draft' ? 'draft' : 'published', id]
      );
      databaseUpdated = true;
      publicCache?.clear();

      if (post.feature_image && post.feature_image !== finalFeatureImage) {
        try {
          const references = await pool.query(
            `SELECT 1 FROM (
               SELECT 1 FROM posts WHERE feature_image = $1 OR POSITION($1 IN description) > 0
               UNION ALL SELECT 1 FROM content_images WHERE url = $1
             ) image_references LIMIT 1`,
            [post.feature_image]
          );
          if (references.rows.length === 0) await removeUploadedImage(post.feature_image);
        } catch (cleanupError) {
          console.error('Old feature image cleanup failed:', cleanupError.message);
        }
      }
      await cleanupRegisteredContentImages(post.description, post.feature_image);
      return response.json(result.rows[0]);
    } catch (error) {
      if (savedUpload && !databaseUpdated) await removeUploadedImage(savedUpload.url);
      if (error.code === '23505') return response.status(409).json({ message: 'A post with this slug already exists.' });
      return response.status(500).json({ message: error.message });
    }
  });

  router.delete('/posts/:id', authenticate, requireRole('admin', 'superadmin'), async (request, response) => {
    const id = Number(request.params.id);
    if (!request.params.id || Number.isNaN(id)) return response.status(400).json({ message: 'Valid post ID is required' });
    try {
      const existing = await pool.query('SELECT id, author_id, feature_image, description FROM posts WHERE id = $1 LIMIT 1', [id]);
      if (existing.rows.length === 0) return response.status(404).json({ message: 'Post not found' });
      const post = existing.rows[0];
      if (request.user.role !== 'superadmin' && post.author_id !== request.user.id) {
        return response.status(403).json({ message: 'You can only delete your own posts' });
      }
      await pool.query('DELETE FROM posts WHERE id = $1', [id]);
      publicCache?.clear();
      const references = await pool.query(
        `SELECT 1 FROM (
           SELECT 1 FROM posts WHERE feature_image = $1 OR POSITION($1 IN description) > 0
           UNION ALL SELECT 1 FROM content_images WHERE url = $1
         ) image_references LIMIT 1`,
        [post.feature_image]
      );
      if (references.rows.length === 0) await removeUploadedImage(post.feature_image);
      await cleanupRegisteredContentImages(post.description, post.feature_image);
      return response.json({ message: 'Post deleted successfully' });
    } catch (error) {
      return response.status(500).json({ message: error.message });
    }
  });

  return router;
}

module.exports = { createPostsRouter };
