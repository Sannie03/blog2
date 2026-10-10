function LoginForm({ loginForm, setLoginForm, onLogin, status }) {
  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-brand">BLOG ADMIN</div>
        <h2>Welcome back</h2>
        <p>Sign in to manage your content.</p>

        <form onSubmit={onLogin} className="login-form">
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              required
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            />
          </label>

          <button type="submit" className="login-submit-btn">Login</button>
        </form>

        {status && (
          <div className={`status-message ${/successful|logged out/i.test(status) ? 'success' : 'error'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginForm
