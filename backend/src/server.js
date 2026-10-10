const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const { port, uploadRoot, frontendDist, allowedOrigins } = require('./config');
const pool = require('./db');
const { createAuthMiddleware } = require('./middleware/auth');
const rateLimit = require('./rate-limit');
const images = require('./services/image-service');
const { createPublicCache } = require('./services/public-cache');
const { getDashboardData } = require('./services/dashboard-service');
const { createAuthRouter } = require('./routes/auth');
const { createPostsRouter } = require('./routes/posts');
const { createImagesRouter } = require('./routes/images');
const { createDashboardRouter } = require('./routes/dashboard');
const { createReaderRouter } = require('./routes/reader');
const { createPublicRouter } = require('./routes/public');
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: allowedOrigins }));
app.use(compression());
app.use('/api', (request, response, next) => {
  response.set('Cache-Control', request.headers.authorization || !['GET', 'HEAD'].includes(request.method)
    ? 'private, no-store' : 'no-cache');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/uploads', express.static(uploadRoot, { maxAge: '1y', immutable: true }));
const publicCache = createPublicCache();
const dependencies = {
  pool, ...createAuthMiddleware(pool), ...rateLimit, ...images, publicCache,
  cleanupRegisteredContentImages: (...args) => images.cleanupRegisteredContentImages(pool, ...args),
};
app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT NOW()');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) { next(error); }
});
app.use('/api/public', createReaderRouter({ pool, cache: publicCache }));
app.use('/api', createAuthRouter(dependencies));
app.use('/api', createPostsRouter(dependencies));
app.use('/api', createImagesRouter(dependencies));
app.use('/api', createDashboardRouter({ ...dependencies, getDashboardData: (...args) => getDashboardData(pool, ...args) }));
app.use('/api', (_request, response) => response.status(404).json({ message: 'API endpoint not found.' }));
app.use(createPublicRouter(pool));
app.use('/assets', express.static(path.join(frontendDist, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(frontendDist, { maxAge: 0 }));
app.get('/{*path}', (_request, response) => {
  const index = path.join(frontendDist, 'index.html');
  if (fs.existsSync(index)) return response.sendFile(index);
  return response.status(404).send('Page not found');
});
app.use((error, _request, response, _next) => {
  console.error(error.message);
  response.status(error.status || (error.name === 'MulterError' ? 400 : 500)).json({ message: error.status || error.name === 'MulterError' ? error.message : 'Unable to process request.' });
});
if (require.main === module) app.listen(port, () => console.log(`Server listening on port ${port}`));
module.exports = { app, pool };
