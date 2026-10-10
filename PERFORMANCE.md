# Performance changes

Reviewed the application source, routes, schema/migrations, styles, configuration,
documentation and existing tests. Dependency lockfiles were checked as dependency
metadata; generated builds, installed dependencies and private environment values
are not application source under review.

## Implemented

- Reader feed: 12 summaries per page, with a separate category-count endpoint and
  a related-post endpoint returning up to 3 published posts. Existing `/api/posts`
  remains compatible with old clients.
- Public list/category/article/related responses use a bounded, in-process cache:
  30-second TTL, 100 entries, at most 8 MiB of serialized cached values. Concurrent
  requests for the same key share a database load. Create/update/delete clears the
  cache; an older in-flight query cannot refill it after invalidation.
- Browsers revalidate public API responses; authenticated API responses are
  private/no-store, as do API mutation responses (including login). Express
  compresses eligible responses. Hashed build assets and uniquely named uploads
  use one-year immutable caching; frontend HTML remains revalidated. Vercel also
  sets the immutable policy for built assets under `/assets/`.
- Reader thumbnails use resized, automatically compressed Cloudinary versions.
  Article images have responsive candidates; the first image is eager and later
  images are lazy. Only unsigned, versioned Cloudinary originals are transformed.
  Signed URLs, existing responsive markup and other hosts are preserved.
- Admin and article-rendering JavaScript load on demand. Article rendering code
  starts loading alongside the article API request. Sanitization remains enabled.
- Admin lists request summaries; opening the editor fetches full content before
  displaying the form. Stale edit responses and errors cannot overwrite a newer
  selection or reopen the editor after navigation or logout.
- Dashboard runs 4 independent queries concurrently, deriving per-admin post
  statistics from the existing user aggregation instead of running a fifth query.
- Added indexes for published feed ordering, author/date queries, date filtering
  and content-image URL lookup. Slug already has a unique index.
- Local preview object URLs are released. Share-page HTML reads are asynchronous;
  the fallback OG image path now points to the actual frontend directory.

## Measurements and validation

Before changes, the production build had 318.13 kB of initial JavaScript
(97.71 kB gzip). The optimized build is approximately 221 kB (69 kB gzip).
Article and admin chunks load separately; this is not the total size of all routes.

Earlier live samples: HTML TTFB about 0.51 seconds; the 374-post list was 95,417
bytes with TTFB about 1.22 seconds. Thumbnail samples fell from 723,182 / 2,232,063
bytes to 82,510 / 111,708 bytes. These are individual measurements, not a
before/after Lighthouse or real-user speed score.

- Backend: `cd backend`, `npm ci`, `npm test`. Includes embedded PostgreSQL tests
  for SQL, migrations, pagination, categories, draft exclusion, invalidation,
  summaries/full content and gzip; no production database is used.
- Frontend: `cd frontend`, `npm ci`, `npm run build`, `npm run lint`, `npm test`.
  Browser tests use mocked API responses and run on desktop/mobile viewports.
  They verify pagination, categories, errors/retry, direct article links,
  sanitization, image loading and full-content editing/saving.
- Browser tests default to installed Microsoft Edge. Set `PLAYWRIGHT_CHANNEL`
  to another installed supported channel if needed.

## Deployment

1. Deploy backend dependencies and code first (`npm ci --omit=dev`).
2. In the backend environment, run `npm run migrate` against the intended database
   and restart the backend process. The migration has been tested on a temporary
   database, not applied to the production database by this change.
3. Build and deploy the frontend with its production `VITE_API_URL`.
4. Check the homepage, next page, categories, direct story links and editing, then
   measure cold/warm loads on an actual phone. Compare API timing, LCP and image
   bytes. Verify the host/proxy preserves compression and cache headers.

The cache is local to each backend process. Other replicas or external database
edits can remain stale for up to 30 seconds; use shared invalidation if deploying
multiple replicas that require immediate synchronization. Admin metadata lists
still load all matching posts to preserve existing client-side filters and counts;
full descriptions are fetched only for editing. Deep offset pagination and topic
ranking should be remeasured as the dataset grows. Local/external image hosts do
not gain Cloudinary resizing automatically.

No production deployment, production migration or hosting change was performed.

## Follow-up validation (2026-09-18)

- Restored the documented editor request guard, parallel article-module loading
  and cache headers in the current source.
- Backend: 12 tests passed, including authenticated/public cache headers, login
  response headers and invalid-token responses.
- Frontend: production build passed; initial JavaScript was 218.23 kB
  (68.04 kB gzip). Lint completed with no errors and one existing Fast Refresh
  warning in `InformationPage.jsx`.
- Playwright: 24 tests passed across desktop/mobile, including delayed editor
  responses and article-module loading while the API is pending. Four AdSense
  tests were skipped because this local build has ads disabled.
- Deployment cache headers still need verification on the actual hosting service.
