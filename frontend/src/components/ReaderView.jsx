import defaultCover from '../assets/hero.png'
import { lazy, Suspense } from 'react'
import { useReaderData } from './useReaderData'
import { loadArticleContent } from '../utils/articleLoader'
import { thumbnailUrl } from '../utils/images'
import { informationPages, InformationPage } from './InformationPage'
import { PublicHeader, PublicFooter } from './PublicSiteChrome'

const ArticleContent = lazy(loadArticleContent)

const formatPostDate = (value, locale, options) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale, options)
}

function ReaderView({
  informationPath,
  readerPath,
  readerCategory,
  readerArticleLoading,
  selectedReaderPost,
  onNavigate,
  onOpenPost,
}) {
  const { posts: readerPosts, categories, loading: readerLoading, error, retry, page, setPage, hasMore } = useReaderData(readerPath, readerCategory)
  if (informationPath && informationPages[informationPath]) {
    return <div className="reader-container"><PublicHeader onNavigate={onNavigate} /><InformationPage page={informationPages[informationPath]} /><PublicFooter onNavigate={onNavigate} /></div>
  }

  if (readerArticleLoading) {
    return <div className="reader-container"><PublicHeader onNavigate={onNavigate} /><main className="reader-main"><div className="loading">Loading article...</div></main><PublicFooter onNavigate={onNavigate} /></div>
  }

  if (/^\/(story|post)\//.test(readerPath) && !selectedReaderPost) {
    return <div className="reader-container"><PublicHeader onNavigate={onNavigate} /><main className="reader-main"><p role="alert">Unable to load this article.</p><button onClick={() => window.location.reload()}>Try again</button></main><PublicFooter onNavigate={onNavigate} /></div>
  }

  if (selectedReaderPost) {
    const suggestedPosts = readerPosts

    return (
      <div className="reader-container">
        <PublicHeader onNavigate={onNavigate} />
        <main className="reader-detail">
          <article>
            <div className="post-header">
              <h1>{selectedReaderPost.title}</h1>
              <p className="post-meta"><span className="date">{formatPostDate(selectedReaderPost.created_at || selectedReaderPost.createdAt, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
            </div>
            <Suspense fallback={<div className="loading">Loading content...</div>}><ArticleContent content={selectedReaderPost.description} /></Suspense>
            {(selectedReaderPost.categories || selectedReaderPost.tags) && (
              <div className="post-categories">
                {`${selectedReaderPost.categories || ''},${selectedReaderPost.tags || ''}`.split(',').filter((value) => value.trim()).map((category, index) => <span key={`${category}-${index}`} className="category-tag">{category.trim()}</span>)}
              </div>
            )}
          </article>
          {suggestedPosts.length > 0 && (
            <section className="related-posts" aria-labelledby="related-posts-title">
              <div className="related-heading"><div><p className="section-kicker">Continue reading</p><h2 id="related-posts-title">Related posts</h2></div><span className="related-count">{suggestedPosts.length} posts</span></div>
              <div className="related-grid">
                {suggestedPosts.map((post) => (
                  <article key={post.id} className="related-card" onClick={() => onOpenPost(post)}>
                    {(post.feature_image || post.featureImage || post.featureimage) && <div className="related-card-image"><img src={thumbnailUrl(post.feature_image || post.featureImage || post.featureimage) || defaultCover} alt="" loading="lazy" onError={(event) => { event.currentTarget.src = defaultCover }} /></div>}
                    <div className="related-card-body"><h3>{post.title}</h3></div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
        <PublicFooter onNavigate={onNavigate} />
      </div>
    )
  }

  if (readerPath === '/categories') {

    return (
      <div className="reader-container">
        <PublicHeader onNavigate={onNavigate} />
        <main className="reader-main"><section className="reader-intro"><div><p className="reader-kicker">Browse</p><h2>Story categories</h2></div></section>
          {error ? <div role="alert">{error} <button onClick={retry}>Try again</button></div> : readerLoading ? <div className="loading">Loading categories...</div> : categories.length === 0 ? <div className="empty">No categories found.</div> : <div className="taxonomy-grid">{categories.map(({ name: category, count }) => <button key={category} type="button" className="taxonomy-item" onClick={() => onNavigate('/posts', category)}><strong>{category}</strong><span>{count} stories</span></button>)}</div>}
        </main>
        <PublicFooter onNavigate={onNavigate} />
      </div>
    )
  }

  const visibleReaderPosts = readerCategory
    ? readerPosts.filter((post) => String(post.categories || '').split(',').map((value) => value.trim().toLowerCase()).includes(readerCategory.toLowerCase()))
    : readerPosts
  return (
    <div className="reader-container">
      <PublicHeader onNavigate={onNavigate} />
      <main className="reader-main">
        <section className="reader-intro"><div><p className="reader-kicker">nextstorypart.site</p><h2>{readerCategory || 'NextStoryPart'}</h2><p className="reader-description">Fresh ideas, practical guides and thoughtful perspectives for curious readers.</p></div><div className="reader-intro-mark">NS</div></section>
        <section className="posts-grid">
          {error ? <div role="alert">{error} <button onClick={retry}>Try again</button></div> : readerLoading ? <div className="loading">Loading posts...</div> : visibleReaderPosts.length === 0 ? <div className="empty">No posts found.</div> : visibleReaderPosts.map((post, index) => (
            <article key={post.id} className="post-card" onClick={() => onOpenPost(post)}>
              {(post.feature_image || post.featureImage || post.featureimage) && <div className="post-card-image"><img decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} src={thumbnailUrl(post.feature_image || post.featureImage || post.featureimage) || defaultCover} alt="" loading={index < 3 ? 'eager' : 'lazy'} onError={(event) => { event.currentTarget.src = defaultCover }} /></div>}
              <div className="post-card-content"><h2>{post.title}</h2></div>
            </article>
          ))}
        </section>
        {!readerLoading && !error && (page > 1 || hasMore) && <nav className="reader-pagination" aria-label="Story pages">
          <button type="button" disabled={page === 1} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0 }) }}>Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={!hasMore} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }) }}>Next</button>
        </nav>}
      </main>
      <PublicFooter onNavigate={onNavigate} />
    </div>
  )
}

export default ReaderView
