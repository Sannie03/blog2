import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './App.css'
import LoginForm from './components/LoginForm'
import ReaderView from './components/ReaderView'
import { informationPages } from './components/InformationPage'
import { adminViewPaths } from './adminRoutes'
import * as api from './services/api'
import { useAdSense } from './services/adsense'
import { loadArticleContent } from './utils/articleLoader'

const AdminShell = lazy(() => import('./components/AdminShell'))
const defaultForm = { title: '', slug: '', description: '', featureImage: '', featureImageFile: null, categories: '', tags: '', status: 'published', prevChapter: '', nextChapter: '' }
const emptyAdmin = { name: '', username: '', email: '', password: '' }
const emptyDashboard = { users: [], adminStats: [], chart: [], totalPosts: 0, adminCount: 0 }
function App() {
  const editRequest = useRef(0)
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search)
  const [user, setUser] = useState(() => {
    try { return localStorage.getItem('blog_admin_token') ? JSON.parse(localStorage.getItem('blog_admin_user_data')) : null } catch { return null }
  })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [posts, setPosts] = useState([])
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [dashboardFilters, setDashboardFilters] = useState({ from: '', to: '' })
  const [form, setForm] = useState(defaultForm)
  const [editingId, setEditingId] = useState(null)
  const [adminForm, setAdminForm] = useState(emptyAdmin)
  const [adminStatus, setAdminStatus] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState(null)
  const [article, setArticle] = useState({ path: '', post: null })
  const path = location.split('?')[0]
  const category = new URLSearchParams(location.split('?')[1]).get('category') || ''
  const isAdmin = path.startsWith('/admin')
  useAdSense(path)
  const view = Object.keys(adminViewPaths).find(key => adminViewPaths[key] === path) || 'dashboard'
  function navigate(next, topic = '') {
    editRequest.current++
    const url = topic ? `${next}?${new URLSearchParams({ category: topic })}` : next
    window.history.pushState({}, '', url)
    setLocation(url)
    window.scrollTo({ top: 0 })
  }
  function logout() {
    editRequest.current++
    for (const key of ['session', 'token', 'user_data', 'user', 'role']) localStorage.removeItem(`blog_admin_${key}`)
    setUser(null)
    setPosts([])
    setDashboard(emptyDashboard)
    setForm(defaultForm)
    setEditingId(null)
    setAdminForm(emptyAdmin)
    setAdminStatus('')
    setDashboardFilters({ from: '', to: '' })
    setFilter(null)
  }
  function report(error) {
    if (error.status === 401) logout()
    setStatus(error.status === 401 ? 'Session expired. Please log in again.' : error.message)
  }
  async function refreshPosts() {
    try { setPosts(await api.fetchPosts({ summary: true })) } catch (error) { report(error) }
  }
  async function refreshDashboard(filters = dashboardFilters) {
    try { setDashboard(await api.fetchDashboard(filters)) } catch (error) { report(error) }
  }
  useEffect(() => {
    const sync = () => { editRequest.current++; setLocation(window.location.pathname + window.location.search) }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  useEffect(() => {
    if (!isAdmin || !user) return
    let cancelled = false
    Promise.all([api.fetchPosts({ summary: true }), api.fetchDashboard()])
      .then(([items, data]) => { if (!cancelled) { setPosts(items); setDashboard(data) } })
      .catch(error => { if (!cancelled) report(error) })
    return () => { cancelled = true }
  }, [isAdmin, user])
  useEffect(() => {
    if (!/^\/(story|post)\//.test(path)) return
    let cancelled = false
    void loadArticleContent().catch(() => {})
    Promise.resolve().then(() => api.fetchPostBySlug(decodeURIComponent(path.split('/').slice(2).join('/')), { authenticated: false }))
      .then(post => { if (!cancelled) setArticle({ path, post }) })
      .catch(() => { if (!cancelled) setArticle({ path, post: null }) })
    return () => { cancelled = true }
  }, [path])
  useEffect(() => {
    const post = article.path === path ? article.post : null
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${api.PUBLIC_SITE_URL || window.location.origin}${path}`)
    document.title = post ? `${post.title} | NextStoryPart` : informationPages[path]?.title || 'NextStoryPart'
    const description = post ? post.title : informationPages[path]?.description || 'Stories worth staying for on NextStoryPart.'
    for (const [attribute, key, content] of [
      ['name', 'description', description],
      ['property', 'og:title', document.title],
      ['property', 'og:description', description],
      ['property', 'og:url', window.location.href],
      ['property', 'og:image', api.normalizeAssetUrl(post?.featureImage || '')],
    ]) {
      let element = document.querySelector(`meta[${attribute}="${key}"]`)
      if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.appendChild(element) }
      element.setAttribute('content', content)
    }
  }, [article, path])
  async function login(event) {
    event.preventDefault()
    try {
      const data = await api.loginUser(loginForm)
      localStorage.setItem('blog_admin_token', data.token)
      localStorage.setItem('blog_admin_session', 'true')
      localStorage.setItem('blog_admin_user_data', JSON.stringify(data.user))
      setUser(data.user)
      setStatus('')
      setLoginForm({ username: '', password: '' })
    } catch (error) {
      setStatus(error.status === 401 ? 'Invalid username or password.' : error.message)
    }
  }
  function openPosts(nextFilter) { setFilter(nextFilter); navigate(adminViewPaths.posts) }
  function newPost() { setForm(defaultForm); setEditingId(null); setStatus(''); navigate(adminViewPaths['create-post']) }
  async function editPost(post) {
    const request = ++editRequest.current
    try {
      const full = await api.fetchPostBySlug(post.slug)
      if (request !== editRequest.current) return
      setForm({ ...defaultForm, ...full })
      setEditingId(post.id)
      setStatus('')
      navigate(adminViewPaths['create-post'])
    } catch (error) { if (request === editRequest.current) report(error) }
  }
  async function savePost(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const payload = new FormData()
      for (const key of Object.keys(defaultForm)) {
        if (key !== 'featureImageFile') payload.append(key, form[key] || '')
      }
      if (form.featureImageFile) payload.append('featureImageFile', form.featureImageFile)
      if (editingId) await api.updatePost(editingId, payload)
      else await api.createPost(payload)
      setForm(defaultForm); setEditingId(null)
      setStatus('Post saved successfully.')
      openPosts(null)
      await Promise.all([refreshPosts(), refreshDashboard()])
    } catch (error) { report(error) } finally { setSaving(false) }
  }
  async function removePost(id) {
    if (!window.confirm('Delete this post?')) return
    try {
      await api.deletePost(id)
      setPosts(current => current.filter(post => post.id !== id))
      setStatus('Post deleted successfully.')
      await refreshDashboard()
    } catch (error) { report(error) }
  }
  async function createAdmin(event) {
    event.preventDefault()
    try { await api.createAdminUser(adminForm); setAdminForm(emptyAdmin); setAdminStatus('Admin created successfully.'); await refreshDashboard() }
    catch (error) { setAdminStatus(error.message); if (error.status === 401) report(error) }
  }
  async function toggleAds(id, enabled) {
    try { await api.updateAdminAdSenseAccess(id, enabled); await refreshDashboard() }
    catch (error) { setAdminStatus(error.message); if (error.status === 401) report(error) }
  }
  if (!isAdmin) return <ReaderView key={`${path}:${category}`} readerPath={path} informationPath={path} readerCategory={category} selectedReaderPost={article.path === path ? article.post : null} readerArticleLoading={/^\/(story|post)\//.test(path) && article.path !== path} onNavigate={navigate} onOpenPost={post => navigate(`/story/${encodeURIComponent(post.slug)}`)} />
  if (!user) return <LoginForm loginForm={loginForm} setLoginForm={setLoginForm} onLogin={login} status={status} />
  return <Suspense fallback={<p>Loading admin...</p>}><AdminShell view={view} currentUser={user} canAccessAds={user.role === 'superadmin' || Boolean(user.adsense_access)} dashboard={dashboard} dashboardFilters={dashboardFilters} posts={posts} postFilterRequest={filter} form={form} adminForm={adminForm} adminStatus={adminStatus} status={status} isSavingPost={saving} onNavigate={next => { if (next === 'logout') { logout(); navigate('/') } else navigate(adminViewPaths[next] || adminViewPaths.dashboard) }} onOpenPosts={openPosts} onNewPost={newPost} onEdit={editPost} onDelete={removePost} onSubmitPost={savePost} onResetPost={() => { setForm(defaultForm); setStatus('') }} onUploadImage={api.uploadContentImage} onApplyFilters={filters => { setDashboardFilters(filters); refreshDashboard(filters) }} onCreateAdmin={createAdmin} onToggleAdSenseAccess={toggleAds} setForm={setForm} setAdminForm={setAdminForm} /></Suspense>
}
export default App
