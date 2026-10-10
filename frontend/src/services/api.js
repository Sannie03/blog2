const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '')

const getApiBaseUrl = () => {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ''

  return normalizeBaseUrl(envUrl)
}

export const API_URL = getApiBaseUrl()
export const PUBLIC_SITE_URL = normalizeBaseUrl(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PUBLIC_SITE_URL) || ''
)

export function getPublicPostUrl(slug) {
  const baseUrl = PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const path = `/story/${encodeURIComponent(slug)}`
  if (!baseUrl) return path
  try {
    return new URL(path, baseUrl).toString()
  } catch {
    return path
  }
}

export function normalizeAssetUrl(value) {
  if (!value || typeof value !== 'string') return value
  const normalizedValue = value.trim()
  if (!normalizedValue) return ''
  if (normalizedValue.startsWith('//')) return `https:${normalizedValue}`
  if (normalizedValue.startsWith('/') && API_URL) return `${API_URL}${normalizedValue}`
  return normalizedValue
    .replace(/^https?:\/\/localhost:\d+/i, API_URL)
    .replace(/^https?:\/\/127\.0\.0\.1:\d+/i, API_URL)
}

function authHeaders(headers = {}) {
  const token = localStorage.getItem('blog_admin_token')
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

async function getJsonOrThrow(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || ''
  const raw = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof raw === 'string' ? raw : raw.message || fallbackMessage
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function fetchDashboard(filters = {}) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await fetch(`${API_URL}/api/dashboard${query}`, { headers: authHeaders() })
  return getJsonOrThrow(response, 'Failed to load dashboard')
}

export async function fetchPosts({ authenticated = true, summary = false } = {}) {
  const response = await fetch(`${API_URL}/api/posts${summary ? '?summary=1' : ''}`, {
    headers: authenticated ? authHeaders() : {},
  })
  return getJsonOrThrow(response, 'Failed to load posts')
}

export async function fetchReaderData(path, signal) {
  const response = await fetch(`${API_URL}/api/public${path}`, { signal })
  return getJsonOrThrow(response, 'Unable to load stories. Please try again.')
}

export async function fetchPostBySlug(slug, { authenticated = true } = {}) {
  const response = await fetch(`${API_URL}/api/${authenticated ? '' : 'public/'}posts/${encodeURIComponent(slug)}`, {
    headers: authenticated ? authHeaders() : {},
  })
  return getJsonOrThrow(response, 'Failed to load article')
}

export async function uploadContentImage(file) {
  const payload = new FormData()
  payload.append('image', file)
  const response = await fetch(`${API_URL}/api/images/content`, {
    method: 'POST',
    headers: authHeaders(),
    body: payload,
  })
  return getJsonOrThrow(response, 'Unable to upload content image')
}

export async function deleteContentImage(url) {
  const response = await fetch(`${API_URL}/api/images/content`, {
    method: 'DELETE',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ url }),
  })
  return getJsonOrThrow(response, 'Unable to remove content image')
}

export async function loginUser(payload) {
  const response = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await getJsonOrThrow(response, 'Login failed')
  return data
}

export async function changePassword(payload) {
  const response = await fetch(`${API_URL}/api/password`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return getJsonOrThrow(response, 'Unable to change password.')
}

export async function createPost(payload) {
  const isFormData = payload instanceof FormData

  const response = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: authHeaders(isFormData ? {} : { 'Content-Type': 'application/json' }),
    body: isFormData ? payload : JSON.stringify(payload),
  })

  return getJsonOrThrow(response, 'Unable to create post')
}

export async function updatePost(postId, payload) {
  const isFormData = payload instanceof FormData

  const response = await fetch(`${API_URL}/api/posts/${postId}`, {
    method: 'PUT',
    headers: authHeaders(isFormData ? {} : { 'Content-Type': 'application/json' }),
    body: isFormData ? payload : JSON.stringify(payload),
  })

  return getJsonOrThrow(response, 'Unable to update post')
}

export async function createAdminUser(payload) {
  const response = await fetch(`${API_URL}/api/admins`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  const data = await getJsonOrThrow(response, 'Unable to create admin account')
  return data
}

export async function deletePost(postId) {
  const response = await fetch(`${API_URL}/api/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  })

  return getJsonOrThrow(response, 'Unable to delete post')
}

export async function updateAdminAdSenseAccess(userId, enabled) {
  const response = await fetch(`${API_URL}/api/admins/${userId}/adsense-access`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enabled }),
  })

  const data = await getJsonOrThrow(response, 'Unable to update AdSense access')
  return data
}
