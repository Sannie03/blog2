import { useState } from 'react'
import { changePassword } from '../services/api'

export default function ChangePasswordForm() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const form = event.currentTarget
    const data = new FormData(form)
    setMessage('')
    setError(false)
    if (data.get('newPassword') !== data.get('confirmation')) {
      setError(true)
      setMessage('New passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const result = await changePassword({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') })
      form.reset()
      setMessage(result.message)
    } catch (error) {
      setError(true)
      setMessage(error.status === 401 ? 'Session expired. Please log out and sign in again.' : error.message)
    } finally { setSaving(false) }
  }

  return <section className="user-card">
    <h2>Change password</h2>
    <p className="subtitle">Change the password for your signed-in account.</p>
    <form className="content-form" onSubmit={submit}>
      <div className="field-group"><label htmlFor="current-password">Current password</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required disabled={saving} /></div>
      <div className="field-group"><label htmlFor="new-password">New password</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={6} maxLength={256} required disabled={saving} /></div>
      <div className="field-group"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={6} maxLength={256} required disabled={saving} /></div>
      <div className="form-actions"><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Change password'}</button></div>
    </form>
    {message && <p className={`status-message ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{message}</p>}
  </section>
}
