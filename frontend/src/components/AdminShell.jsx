import DashboardView from './DashboardView'
import CreatePostForm from './CreatePostForm'
import PostManagement from './PostManagement'
import ContentSectionView from './ContentSectionView'
import ChangePasswordForm from './ChangePasswordForm'
import { adsenseEnabled } from '../services/adsense'


const roleLabels = { superadmin: 'Super Admin', admin: 'Admin', user: 'User' }

function AdminShell({
  view,
  currentUser,
  canAccessAds,
  dashboard,
  dashboardFilters,
  posts,
  postFilterRequest,
  form,
  adminForm,
  adminStatus,
  status,
  isSavingPost,
  onNavigate,
  onOpenPosts,
  onNewPost,
  onEdit,
  onDelete,
  onSubmitPost,
  onResetPost,
  onUploadImage,
  onApplyFilters,
  onCreateAdmin,
  onToggleAdSenseAccess,
  setForm,
  setAdminForm,
}) {
  const isSuperAdmin = currentUser?.role === 'superadmin'
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-row"><span className="brand-mark">◈</span><div className="brand-column"><span className="brand-title">Blog editor</span><span className="brand-role">{roleLabels[currentUser?.role] || 'User'}</span></div></div>
        <div className="user-badge"><span className="user-label">Signed in</span><strong>{currentUser?.username || 'Unknown user'}</strong></div>
        <nav className="nav-group"><div className="nav-label">Overview</div><button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}><span className="icon" aria-hidden="true">▣</span><span>Dashboard</span></button></nav>
        <nav className="nav-group"><div className="nav-label">Content</div><button className={`nav-item ${view === 'create-post' || view === 'posts' ? 'active' : ''}`} onClick={() => onOpenPosts(null)}><span className="icon" aria-hidden="true">¤</span><span>Posts</span></button>
          {['categories', 'series', 'tags', 'pages', 'reports'].map((item) => <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} type="button" onClick={() => onNavigate(item)}><span className="icon" aria-hidden="true">{item === 'categories' ? '▣' : item === 'series' ? '☆' : item === 'tags' ? '◌' : item === 'pages' ? '▭' : '⚑'}</span><span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}
        </nav>
        <nav className="nav-group"><div className="nav-label">System</div>{canAccessAds && <button className={`nav-item ${view === 'ads' ? 'active' : ''}`} type="button" onClick={() => onNavigate('ads')}><span className="icon" aria-hidden="true">◔</span><span>Ads</span></button>}</nav>
        <button type="button" className={`nav-item ${view === 'password' ? 'active' : ''}`} onClick={() => onNavigate('password')}>Change password</button>
        <button className="logout-btn" onClick={() => onNavigate('logout')}>Logout</button>
      </aside>
      <main className="main-panel">
        {view === 'password' && <ChangePasswordForm />}
        {view !== 'create-post' && status && <p role="status">{status}</p>}
        {(view === 'dashboard' || view === 'reports') && <DashboardView dashboard={dashboard} dashboardFilters={dashboardFilters} onApplyFilters={onApplyFilters} currentUser={currentUser} roleLabels={roleLabels} canCreateAdmin={isSuperAdmin} onCreateAdmin={onCreateAdmin} onToggleAdSenseAccess={onToggleAdSenseAccess} adminForm={adminForm} setAdminForm={setAdminForm} adminStatus={adminStatus} />}
        {['categories', 'series', 'tags', 'pages'].includes(view) && <ContentSectionView section={view} posts={posts} onOpenPosts={onOpenPosts} />}
        {view === 'ads' && <section className="user-card content-section-card"><div className="card-header"><h2>AdSense</h2><span className="pill">{canAccessAds ? (adsenseEnabled ? 'Auto ads enabled' : 'Auto ads disabled') : 'Access denied'}</span></div>{canAccessAds ? <a href="https://www.google.com/adsense/" target="_blank" rel="noreferrer">Open Google AdSense</a> : <p className="subtitle">Ask the Super Admin to grant AdSense access to this account.</p>}</section>}
        {view === 'posts' && <PostManagement key={postFilterRequest ? `${postFilterRequest.field}-${postFilterRequest.value}` : 'all-posts'} posts={posts} initialFilter={postFilterRequest} onNewPost={onNewPost} onEdit={onEdit} onDelete={onDelete} />}
        {view === 'create-post' && <CreatePostForm form={form} setForm={setForm} onSubmit={onSubmitPost} onUploadImage={onUploadImage} onReset={onResetPost} onBack={() => onNavigate('posts')} status={status} isSaving={isSavingPost} />}
      </main>
    </div>
  )
}

export default AdminShell
