const express = require('express');

function createImagesRouter({ authenticate, requireRole, upload, saveUploadedImage, removeUploadedImage, pool }) {
  const router = express.Router();

  router.post('/images/content', authenticate, requireRole('admin', 'superadmin'), upload.single('image'), async (request, response) => {
    if (!request.file) return response.status(400).json({ message: 'Image file is required.' });
    const saved = await saveUploadedImage(request.file, 'content');
    if (!saved) return response.status(400).json({ message: 'Invalid image file.' });
    try {
      await pool.query(
        'INSERT INTO content_images (url, filename, uploaded_by) VALUES ($1, $2, $3)',
        [saved.url, saved.filename, request.user.id]
      );
      return response.status(201).json({ url: saved.url });
    } catch (error) {
      await removeUploadedImage(saved.url);
      return response.status(500).json({ message: error.message || 'Unable to upload image.' });
    }
  });

  router.delete('/images/content', authenticate, requireRole('admin', 'superadmin'), async (request, response) => {
    const url = String(request.body?.url || '').trim();
    if (!url) return response.status(400).json({ message: 'Image URL is required.' });
    try {
      const imageResult = await pool.query(
        'SELECT id, url, uploaded_by FROM content_images WHERE url = $1 LIMIT 1',
        [url]
      );
      const image = imageResult.rows[0];
      if (!image) return response.status(404).json({ message: 'Content image not found.' });
      if (request.user.role !== 'superadmin' && image.uploaded_by !== request.user.id) {
        return response.status(403).json({ message: 'You can only remove images that you uploaded.' });
      }
      const references = await pool.query(
        `SELECT 1 FROM posts
         WHERE feature_image = $1 OR POSITION($1 IN description) > 0
         LIMIT 1`,
        [url]
      );
      if (references.rows.length > 0) return response.status(409).json({ message: 'This image is still used by a post.' });
      await pool.query('DELETE FROM content_images WHERE id = $1', [image.id]);
      await removeUploadedImage(image.url);
      return response.json({ message: 'Content image deleted successfully.' });
    } catch (error) {
      return response.status(500).json({ message: error.message || 'Unable to remove content image.' });
    }
  });

  return router;
}

module.exports = { createImagesRouter };
