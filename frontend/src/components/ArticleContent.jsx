import { memo, useMemo } from 'react'
import { parseMarkdown } from '../utils/markdown'
import { optimizedImageUrl } from '../utils/images'

const ArticleContent = memo(function ArticleContent({ content }) {
  const html = useMemo(() => {
    // Work on sanitized, detached markup before the browser requests images.
    const template = document.createElement('template')
    template.innerHTML = parseMarkdown(content)
    template.content.querySelectorAll('img').forEach((image, index) => {
      const original = image.getAttribute('src')
      const optimized = optimizedImageUrl(original, 1600)
      if (optimized && optimized !== original && !image.hasAttribute('srcset') && !image.closest('picture')) {
        image.setAttribute('src', optimized)
        image.setAttribute('srcset', [480, 800, 1200, 1600].map(width => `${optimizedImageUrl(original, width)} ${width}w`).join(', '))
        image.setAttribute('sizes', '(max-width: 560px) calc(100vw - 60px), (max-width: 980px) calc(100vw - 100px), 820px')
      }
      image.setAttribute('decoding', 'async')
      image.setAttribute('loading', index === 0 ? 'eager' : 'lazy')
      if (index === 0) image.setAttribute('fetchpriority', 'high')
    })
    return template.innerHTML
  }, [content])
  return <div className="post-content" dangerouslySetInnerHTML={{ __html: html }} />
})

export default ArticleContent
