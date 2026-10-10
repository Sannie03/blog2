const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { uploadRoot, uploadDir, hasCloudinaryConfig } = require('../config');

if (hasCloudinaryConfig && !process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_request, file, callback) => {
    callback(null, new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']).has(file.mimetype));
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 2 * 1024 * 1024,
    fieldNameSize: 100,
    fields: 10,
  },
});

async function saveUploadedImage(file, subdirectory = 'posts') {
  if (!file || !Buffer.isBuffer(file.buffer)) return null;
  const signatures = {
    'image/jpeg': file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    'image/png': file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/gif': ['GIF87a', 'GIF89a'].includes(file.buffer.subarray(0, 6).toString('ascii')),
    'image/webp': file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  if (!signatures[file.mimetype]) return null;

  const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' }[file.mimetype];
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;

  if (hasCloudinaryConfig) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `blog/${subdirectory}`, public_id: filename.replace(extension, ''), resource_type: 'image' },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      );
      stream.end(file.buffer);
    });
    return { filename, url: result.secure_url, publicId: result.public_id };
  }

  const directory = path.join(uploadRoot, subdirectory);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, filename), file.buffer, { flag: 'wx' });
  const publicBaseUrl = process.env.PUBLIC_URL || process.env.APP_URL || 'http://localhost:4000';
  return { filename, url: `${publicBaseUrl.replace(/\/$/, '')}/uploads/${subdirectory}/${filename}`, publicId: null };
}

async function removeUploadedImage(url) {
  if (!url || typeof url !== 'string') return;
  if (url.includes('res.cloudinary.com')) {
    try {
      const pathname = new URL(url).pathname;
      const uploadIndex = pathname.indexOf('/upload/');
      if (uploadIndex >= 0) {
        const publicPath = pathname.slice(uploadIndex + '/upload/'.length).replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicPath, { resource_type: 'image' });
      }
    } catch {
      // Cleanup failures must not undo a completed database operation.
    }
    return;
  }

  try {
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith('/uploads/')) return;
    const relativePath = pathname.slice('/uploads/'.length);
    const filePath = path.join(uploadRoot, relativePath);
    const uploadsRoot = path.resolve(uploadRoot);
    if (!path.resolve(filePath).startsWith(`${uploadsRoot}${path.sep}`)) return;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Cleanup failures must not undo a completed database operation.
  }
}

async function cleanupRegisteredContentImages(pool, content = '', extraUrl = '') {
  try {
    const candidates = await pool.query(
      `SELECT id, url FROM content_images
       WHERE POSITION(url IN $1::text) > 0 OR ($2::text <> '' AND url = $2)`,
      [String(content || ''), String(extraUrl || '')]
    );
    for (const image of candidates.rows) {
      const references = await pool.query(
        `SELECT 1 FROM posts
         WHERE feature_image = $1 OR POSITION($1 IN description) > 0
         LIMIT 1`,
        [image.url]
      );
      if (references.rows.length > 0) continue;
      const deleted = await pool.query('DELETE FROM content_images WHERE id = $1 RETURNING url', [image.id]);
      if (deleted.rows.length > 0) await removeUploadedImage(image.url);
    }
  } catch (error) {
    console.error('Content image cleanup failed:', error.message);
  }
}

module.exports = { upload, saveUploadedImage, removeUploadedImage, cleanupRegisteredContentImages };
