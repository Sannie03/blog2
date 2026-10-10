import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { API_URL } from '../services/api'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function parseMarkdown(content) {
  if (!content || typeof content !== 'string') {
    return ''
  }

  try {
    const normalizedContent = content
      .replace(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/gi, API_URL)
    return DOMPurify.sanitize(marked(normalizedContent), {
      USE_PROFILES: { html: true },
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|\/|#)/i,
    })
  } catch (error) {
    console.error('Markdown parse error:', error)
    return DOMPurify.sanitize(String(content), {
      USE_PROFILES: { html: true },
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|\/|#)/i,
    })
  }
}
