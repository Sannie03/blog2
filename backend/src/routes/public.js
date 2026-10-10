const express = require('express');
const fs = require('fs');
const path = require('path');
const { frontendDist } = require('../config');
const { escapeHtml, plainText } = require('../utils/content');

function createPublicRouter(pool) {
  const router = express.Router();

  router.get('/og-image.png', (_request, response) => {
    const fallbackImage = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'hero.png');
    if (!fs.existsSync(fallbackImage)) return response.status(404).end();
    return response.type('png').sendFile(fallbackImage);
  });

  router.get(['/post/:slug', '/story/:slug'], async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT p.title, p.slug, p.description, p.feature_image AS "featureImage",
                u.name AS "authorName"
         FROM posts p
         LEFT JOIN users u ON u.id = p.author_id
         WHERE p.slug = $1 AND p.status = 'published' LIMIT 1`,
        [request.params.slug]
      );
      const post = result.rows[0];
      if (!post) return response.status(404).send('Post not found');

      const requestOrigin = `${request.protocol}://${request.get('host')}`;
      const frontendUrl = (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || requestOrigin).replace(/\/$/, '');
      const assetBaseUrl = requestOrigin.replace(/\/$/, '');
      const articleUrl = `${frontendUrl}/story/${encodeURIComponent(post.slug)}`;
      const toPublicAssetUrl = (value) => {
        if (!value || typeof value !== 'string') return '';
        const normalized = value.trim();
        if (!normalized) return '';
        try {
          const parsed = new URL(normalized, assetBaseUrl);
          if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.origin)) {
            return `${assetBaseUrl}${parsed.pathname}${parsed.search}`;
          }
          return parsed.toString();
        } catch {
          return '';
        }
      };
      const markdownImage = String(post.description || '').match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/);
      const htmlImage = String(post.description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
      const imageUrl = toPublicAssetUrl(post.featureImage)
        || toPublicAssetUrl(markdownImage?.[1])
        || toPublicAssetUrl(htmlImage?.[1])
        || `${assetBaseUrl}/og-image.png`;
      const title = escapeHtml(`${post.title} | NextStoryPart`);
      const description = escapeHtml(plainText(post.description) || 'Stories worth staying for on NextStoryPart.');
      const image = imageUrl ? escapeHtml(imageUrl) : '';
      const imageType = /\.png(?:$|[?#])/i.test(imageUrl) ? 'image/png'
        : /\.webp(?:$|[?#])/i.test(imageUrl) ? 'image/webp'
          : /\.gif(?:$|[?#])/i.test(imageUrl) ? 'image/gif' : 'image/jpeg';
      const author = escapeHtml(post.authorName || 'NextStoryPart Editorial');
      const crawlerContent = escapeHtml(post.description || '').replace(/\r?\n/g, '<br>');
      const frontendIndexPath = path.join(frontendDist, 'index.html');
      const sameDomainRedirect = frontendUrl === requestOrigin;
      const isCrawler = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot/i.test(request.get('user-agent') || '');

      if (request.path.startsWith('/post/') && !isCrawler) return response.redirect(301, articleUrl);
      if (!isCrawler && !fs.existsSync(frontendIndexPath) && !sameDomainRedirect) {
        return response.redirect(302, `${frontendUrl}/post/${encodeURIComponent(post.slug)}`);
      }

      const metadata = `
        <meta name="description" content="${description}">
        <link rel="canonical" href="${escapeHtml(articleUrl)}">
        <meta property="og:type" content="article">
        <meta property="og:site_name" content="NextStoryPart">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:url" content="${escapeHtml(articleUrl)}">
        <meta property="article:author" content="${author}">
        ${image ? `<meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta property="og:image:type" content="${imageType}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${title}">` : ''}
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:creator" content="${author}">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
        ${image ? `<meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="${title}">` : ''}`;
      if (isCrawler) {
        return response.type('html').send(
          `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${metadata}</head><body><article><h1>${title}</h1><p>${description}</p>${image ? `<img src="${image}" alt="${title}">` : ''}<div>${crawlerContent}</div></article></body></html>`
        );
      }

      const frontendIndex = fs.existsSync(frontendIndexPath)
        ? await fs.promises.readFile(frontendIndexPath, 'utf8')
        : `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${metadata}</head><body><div id="root"></div></body></html>`;
      return response.type('html').send(frontendIndex
        .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
        .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${description}">`)
        .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(articleUrl)}">`)
        .replace('</head>', `${metadata}\n  </head>`));
    } catch {
      return response.status(500).send('Unable to create share preview');
    }
  });

  return router;
}

module.exports = { createPublicRouter };
