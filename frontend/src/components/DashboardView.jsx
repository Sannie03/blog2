import { useState } from 'react'

function DashboardView({ dashboard, dashboardFilters, onApplyFilters, currentUser, roleLabels, canCreateAdmin, onCreateAdmin, onToggleAdSenseAccess, adminForm, setAdminForm, adminStatus }) {
  const currentRoleLabel = roleLabels?.[currentUser?.role] || 'User'
  const admins = (dashboard.users || []).filter((user) => user.role === 'admin' || user.role === 'superadmin')
  const chartMaximum = Math.max(...(dashboard.chart || []).map((item) => Number(item.total) || 0), 1)
  const [fromDate, setFromDate] = useState(dashboardFilters?.from || '')
  const [toDate, setToDate] = useState(dashboardFilters?.to || '')
  const userTotal = (dashboard.users || []).reduce((total, user) => total + Number(user.posts_count || 0), 0)
  const userColors = ['#3478f6', '#14b8a6', '#f59e0b', '#e35d6a', '#7c5cff', '#64748b']
  const userSegments = (dashboard.users || [])
    .filter((user) => Number(user.posts_count || 0) > 0)
    .map((user, index) => ({
      ...user,
      color: userColors[index % userColors.length],
      percentage: userTotal ? (Number(user.posts_count) / userTotal) * 100 : 0,
    }))
  let segmentStart = 0
  const donutGradient = userSegments.length
    ? `conic-gradient(${userSegments.map((user) => {
      const end = segmentStart + user.percentage
      const segment = `${user.color} ${segmentStart}% ${end}%`
      segmentStart = end
      return segment
    }).join(', ')})`
    : '#e5eaf2'

  function applyDateFilter(event) {
    event.preventDefault()
    onApplyFilters({ from: fromDate, to: toDate })
  }

  function resetDateFilter() {
    setFromDate('')
    setToDate('')
    onApplyFilters({ from: '', to: '' })
  }

  return (
    <>
      <section className="dashboard-summary-grid">
        <article className="dashboard-stat-card"><span>Total posts</span><strong>{dashboard.totalPosts}</strong><small>Selected period</small></article>
        <article className="dashboard-stat-card"><span>Published</span><strong>{dashboard.publishedPosts}</strong><small>Public posts</small></article>
        <article className="dashboard-stat-card"><span>Drafts</span><strong>{dashboard.draftPosts}</strong><small>Read-only history</small></article>
        <article className="dashboard-stat-card"><span>Admin accounts</span><strong>{dashboard.adminCount}</strong><small>Management access</small></article>
        <article className="dashboard-stat-card"><span>Users with posts</span><strong>{userSegments.length}</strong><small>Selected period</small></article>
      </section>

      <div className="dashboard-visual-grid">
      <section className="chart-card">
        <div className="dashboard-section-heading">
          <div>
            <h2>Posts by Day &amp; Status</h2>
            <p>Y-axis: number of posts, X-axis: database date.</p>
          </div>
          <form className="dashboard-date-filter" onSubmit={applyDateFilter}>
            <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <button type="submit" className="primary-btn">Apply</button>
            <button type="button" className="filter-button muted" onClick={resetDateFilter}>Reset</button>
          </form>
        </div>
        <div className="chart-wrap">
          <div className="bars" aria-label="Post chart">
            {dashboard.chart.length === 0 ? <div className="dashboard-empty">No posts in this period.</div> : dashboard.chart.map((item) => (
              <div key={item.date} className="bar-group">
                <div className="bar total" style={{ height: `${(Number(item.published || 0) / chartMaximum) * 100}%` }} />
                <div className="bar admin" style={{ height: `${(Number(item.drafts || 0) / chartMaximum) * 100}%` }} />
                <span className="day-label">{item.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-legend">
          <span className="legend-dot total-dot" /> Published
          <span className="legend-dot admin-dot" /> Drafts
          <span className="legend-text">Total posts: {dashboard.totalPosts}</span>
        </div>
      </section>

      <section className="summary-card">
        <div className="donut-wrap">
          <div className="donut-chart" style={{ background: donutGradient }}>
            <div className="donut-inner">
              <strong>{userTotal}</strong>
              <span>posts</span>
            </div>
          </div>
        </div>

        <div className="donut-legend">
          <h3>Posts by User</h3>
          <p className="subtitle">User posts / total posts in the selected period.</p>
          {userSegments.length === 0 ? <div className="dashboard-empty">No user data.</div> : userSegments.map((user) => (
            <div className="legend-row" key={user.id}>
              <span className="small-dot" style={{ background: user.color }} />
              <span>{user.name || user.username}</span>
              <strong>{user.posts_count}</strong>
            </div>
          ))}
        </div>
      </section>
      </div>

      <section className="user-card">
        <div className="card-header">
          <h3>Access level</h3>
          <span className="pill">{currentRoleLabel}</span>
        </div>

        <p className="subtitle">{canCreateAdmin
          ? 'You are acting as the main system owner and can create new admin accounts for management or AdSense access.'
          : 'You are a standard admin. Only the Super Admin can create additional admin accounts.'}</p>
      </section>

      {canCreateAdmin && (
        <section className="user-card">
          <div className="card-header">
            <h3>AdSense permissions</h3>
            <span className="pill">Super admin</span>
          </div>

          <div className="adsense-list">
            {admins.map((user) => (
              <div key={user.id} className="adsense-row">
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <button
                  type="button"
                  className={user.adsense_access ? 'secondary-btn danger' : 'primary-btn'}
                  onClick={() => onToggleAdSenseAccess(user.id, !user.adsense_access)}
                >
                  {user.adsense_access ? 'Revoke access' : 'Grant access'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {canCreateAdmin && (
        <section className="user-card">
          <div className="card-header">
            <h3>Create admin account</h3>
            <span className="pill">Super admin only</span>
          </div>

          <p className="subtitle">Use this form to create a dedicated management account for AdSense or operational admin tasks.</p>

          <form className="admin-form" onSubmit={onCreateAdmin}>
            <div className="two-col compact-row">
              <div className="field-group">
                <label>Full name</label>
                <input
                  type="text"
                  value={adminForm.name}
                  onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })}
                  placeholder="Manager name"
                />
              </div>
              <div className="field-group">
                <label>Username</label>
                <input
                  type="text"
                  value={adminForm.username}
                  onChange={(event) => setAdminForm({ ...adminForm, username: event.target.value })}
                  placeholder="adsadmin"
                />
              </div>
            </div>

            <div className="two-col compact-row">
              <div className="field-group">
                <label>Email</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })}
                  placeholder="manager@example.com"
                />
              </div>
              <div className="field-group">
                <label>Password</label>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-btn">Create admin</button>
            </div>
          </form>

          {adminStatus && <div className="status-message">{adminStatus}</div>}
        </section>
      )}

      <section className="user-card">
        <div className="card-header">
          <h3>Users &amp; Post Counts</h3>
          <span className="pill">{dashboard.users.length} users</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Posts</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.users.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.username}</td>
                <td>{row.email}</td>
                <td>{row.role || 'user'}</td>
                <td>
                  <span className="post-count">{row.posts_count}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {dashboard.adminStats && dashboard.adminStats.length > 0 && (
        <section className="user-card">
          <div className="card-header">
            <h3>Admin Post Counts</h3>
            <span className="pill">{dashboard.adminStats.length} admins</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Admin</th>
                <th>Username</th>
                <th>Role</th>
                <th>Posts Created</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.adminStats.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.name}</td>
                  <td>{admin.username}</td>
                  <td>
                    <span className="role-badge">{admin.role}</span>
                  </td>
                  <td>
                    <strong>{admin.postCount}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

export default DashboardView
