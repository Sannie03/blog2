const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const port = process.env.PORT || 4000;
const uploadRoot = path.join(__dirname, '..', 'uploads');
const uploadDir = path.join(uploadRoot, 'posts');
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_URL
  || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
].join(',')).split(',').map((origin) => origin.trim()).filter(Boolean);

module.exports = {
  port,
  uploadRoot,
  uploadDir,
  frontendDist,
  hasCloudinaryConfig,
  allowedOrigins,
};
