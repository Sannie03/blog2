import { useEffect, useState } from 'react'
import { fetchReaderData } from '../services/api'

export function useReaderData(path, category) {
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: '', data: null, error: '' })
  const isArticle = /^\/(story|post)\//.test(path)
  const isCategories = path === '/categories'
  const enabled = isArticle || isCategories || path === '/' || path === '/posts'
  const slug = isArticle ? path.split('/').slice(2).join('/') : ''
  const endpoint = isArticle ? `/posts/${slug}/related` : isCategories ? '/categories' : '/posts'
  const query = !isArticle && !isCategories ? `?${new URLSearchParams({ page, category })}` : ''
  const key = `${endpoint}${query}`

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchReaderData(key, controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ key, data, error: '' }) })
      .catch(error => { if (!controller.signal.aborted) setState({ key, data: null, error: error.message }) })
    return () => controller.abort()
  }, [key, enabled, attempt])

  const current = state.key === key ? state : { data: null, error: '' }
  return {
    posts: isCategories ? [] : isArticle ? current.data || [] : current.data?.posts || [],
    categories: isCategories ? current.data || [] : [],
    loading: enabled && !current.data && !current.error,
    error: current.error,
    hasMore: Boolean(current.data?.hasMore),
    page,
    setPage,
    retry: () => { setState({ key: '', data: null, error: '' }); setAttempt(value => value + 1) },
  }
}
