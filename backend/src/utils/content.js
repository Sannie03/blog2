function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'post';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function plainText(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*_`>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

async function getUniqueSlug(pool, inputSlug, title, excludeId = null) {
  const baseSlug = slugify(inputSlug || title || 'post');
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await pool.query(
      excludeId
        ? 'SELECT 1 FROM posts WHERE slug = $1 AND id <> $2 LIMIT 1'
        : 'SELECT 1 FROM posts WHERE slug = $1 LIMIT 1',
      excludeId ? [candidate, excludeId] : [candidate]
    );
    if (existing.rows.length === 0) return candidate;
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

module.exports = { slugify, escapeHtml, plainText, getUniqueSlug };
