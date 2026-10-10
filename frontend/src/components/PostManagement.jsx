import { useState } from 'react'
import defaultCover from '../assets/hero.png'
import { getPublicPostUrl, normalizeAssetUrl } from '../services/api'

const icons = {
  add: 'M12 5v14M5 12h14',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5',
  view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  copy: 'M9 9h12v12H9zM15 9V3H3v12h6',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  reset: 'M3 10a9 9 0 1 1 2 8M3 3v7h7',
}
function PostIcon({ name }) {
  return <svg className="post-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]} /></svg>
}
const emptyFilters = { search: '', categories: '', tags: '', status: '', authorId: '', from: '', to: '', series: '' }
function PostManagement({ posts, initialFilter, onNewPost, onEdit, onDelete }) {
  const [filters, setFilters] = useState({ ...emptyFilters, ...(initialFilter ? { [initialFilter.field]: initialFilter.value } : {}) })
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const change = (field, value) => { setFilters(current => ({ ...current, [field]: value })); setPage(1) }
  const matchesValue = (value, filter) => !filter || String(value || '').split(',').some(item => item.trim().toLowerCase() === filter.toLowerCase())
  const filtered = posts.filter(post => {
    const date = new Date(post.createdAt || post.created_at)
    const from = filters.from ? new Date(`${filters.from}T00:00:00+07:00`) : null
    const to = filters.to ? new Date(`${filters.to}T23:59:59.999+07:00`) : null
    return `${post.title} ${post.slug}`.toLowerCase().includes(filters.search.toLowerCase())
      && matchesValue(post.categories, filters.categories) && matchesValue(post.tags, filters.tags)
      && (!filters.status || post.status === filters.status)
      && (!filters.authorId || String(post.authorId) === filters.authorId)
      && (!filters.series || post.prevChapter || post.nextChapter)
      && (!from || date >= from) && (!to || date <= to)
  })
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const values = field => [...new Set(posts.flatMap(post => String(post[field] || '').split(',').map(value => value.trim()).filter(Boolean)))].sort()
  const authors = [...new Map(posts.map(post => [post.authorId, post.authorName || `Author ${post.authorId}`])).entries()]
  async function copy(post) {
    try { await navigator.clipboard.writeText(getPublicPostUrl(post.slug)); setMessage('Link copied.') }
    catch { setMessage('Unable to copy link. Open the post and copy its address.') }
  }
  return <section className="posts-manager">
    <div className="post-toolbar"><div className="posts-manager-heading"><p className="section-kicker">Content library</p><h2>Posts</h2><p>{posts.length} total posts</p></div><button className="primary-btn" onClick={onNewPost}><PostIcon name="add" /> Add post</button></div>
    <div className="post-filter-bar">
      <label className="post-search"><PostIcon name="search" /><input aria-label="Search title or slug" placeholder="Search title or slug..." value={filters.search} onChange={event => change('search', event.target.value)} /></label>
      {['categories', 'tags'].map(field => <select key={field} aria-label={field === 'categories' ? 'Category' : 'Tag'} value={filters[field]} onChange={event => change(field, event.target.value)}><option value="">All {field}</option>{values(field).map(value => <option key={value}>{value}</option>)}</select>)}
      <select aria-label="Status" value={filters.status} onChange={event => change('status', event.target.value)}><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option></select>
      <select aria-label="Author" value={filters.authorId} onChange={event => change('authorId', event.target.value)}><option value="">All authors</option>{authors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    </div>
    <div className="post-filter-bar second-row-grid">
      <label>From date (GMT+7)<input type="date" value={filters.from} onChange={event => change('from', event.target.value)} /></label>
      <label>To date (GMT+7)<input type="date" value={filters.to} min={filters.from} onChange={event => change('to', event.target.value)} /></label>
      <span className="post-result-count">{filtered.length} matching posts</span><button type="button" onClick={() => { setFilters(emptyFilters); setPage(1) }}><PostIcon name="reset" /> Reset</button>
    </div>
    {message && <p role="status">{message}</p>}
    <div className="posts-table-wrap"><table className="posts-table"><thead><tr><th className="post-title-col">Post</th><th className="series-col">Series</th><th className="author-col">Author</th><th className="status-col">Status</th><th className="created-col">Created</th><th className="action-col">Actions</th></tr></thead><tbody>
      {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(post => <tr key={post.id}>
        <td className="post-title-col"><div className="post-main-cell"><img className="post-thumb" src={normalizeAssetUrl(post.featureImage) || defaultCover} alt="" width="64" height="48" loading="lazy" /><strong>{post.title}</strong></div></td>
        <td className="series-col">{post.prevChapter || post.nextChapter ? 'Chapter links' : '—'}</td><td className="author-col">{post.authorName}</td><td className="status-col"><span className={`post-status ${post.status === 'published' ? 'published' : 'draft'}`}>{post.status}</span></td><td className="created-col">{new Date(post.createdAt || post.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}</td>
        <td className="action-col"><div className="row-actions">{post.status === 'published' && <a className="action-btn view" aria-label="View" title="View" href={getPublicPostUrl(post.slug)} target="_blank" rel="noreferrer"><PostIcon name="view" /></a>}<button className="action-btn edit" aria-label="Edit" title="Edit" onClick={() => onEdit(post)}><PostIcon name="edit" /></button><button className="action-btn copy" aria-label="Copy link" title="Copy link" onClick={() => copy(post)}><PostIcon name="copy" /></button><button className="action-btn delete" aria-label="Delete" title="Delete" onClick={() => onDelete(post.id)}><PostIcon name="delete" /></button></div></td>
      </tr>)}
      {!filtered.length && <tr><td colSpan="6">No posts available</td></tr>}
    </tbody></table></div>
    <nav className="reader-pagination" aria-label="Post pages"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>
  </section>
}
export default PostManagement
