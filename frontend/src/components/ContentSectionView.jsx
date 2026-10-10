import { informationPages } from './InformationPage'

function splitValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function ContentSectionView({ section, posts, onOpenPosts }) {
  const labels = {
    categories: ['Categories', 'Browse posts by category.', 'categories'],
    tags: ['Tags', 'Browse posts by tag.', 'tags'],
    series: ['Series', 'Chapter navigation collected from posts.', 'series'],
  }
  const [title, description, field] = labels[section] || ['Pages', 'Public information pages.', '']
  const counts = new Map()

  posts.forEach((post) => {
    const values = field === 'series'
      ? (post.prevChapter || post.nextChapter ? ['Chapter links'] : [])
      : splitValues(post[field])
    values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
  })

  if (section === 'pages') {
    return (
      <section className="user-card content-section-card">
        <div className="card-header">
          <div>
            <h2>Pages</h2>
            <p className="subtitle">{description}</p>
          </div>
          <span className="pill">{Object.keys(informationPages).length} pages</span>
        </div>
        <div className="taxonomy-grid">{Object.entries(informationPages).map(([path, page]) => <a className="taxonomy-item" key={path} href={path} target="_blank" rel="noreferrer">{page.heading}</a>)}</div>
      </section>
    )
  }

  const entries = [...counts.entries()].sort((first, second) => second[1] - first[1])
  return (
    <section className="user-card content-section-card">
      <div className="card-header">
        <div>
          <h2>{title}</h2>
          <p className="subtitle">{description}</p>
        </div>
        <span className="pill">{entries.length} items</span>
      </div>
      {entries.length === 0 ? (
        <div className="dashboard-empty">No {title.toLowerCase()} found.</div>
      ) : (
        <div className="taxonomy-grid">
          {entries.map(([value, count]) => (
            <button type="button" className="taxonomy-item" key={value} onClick={() => onOpenPosts({ field, value })}>
              <strong>{value}</strong>
              <span>{count} posts</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default ContentSectionView
