import { useEffect, useMemo, useState } from 'react'
import { deleteUser, inviteUser, listUsers } from '../../api/client'
import type { UserSummary } from '../../api/types'
import { useSession } from '../../app/useSession'

function formatDate(raw: string | null | undefined): string {
  if (!raw) {
    return '-'
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return raw
  }

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function UsersPanel() {
  const { role, email } = useSession()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteDays, setInviteDays] = useState('7')
  const [latestInviteToken, setLatestInviteToken] = useState<string | null>(null)

  const isAdmin = role === 'admin'

  const inviteLink = useMemo(() => {
    if (!latestInviteToken) {
      return null
    }

    return `${window.location.origin}/accept-invite?token=${encodeURIComponent(latestInviteToken)}`
  }, [latestInviteToken])

  async function loadUsers() {
    setIsLoading(true)
    setError(null)

    try {
      const result = await listUsers(200)
      setUsers(result.items)
    } catch {
      setError('Unable to load users.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      setError('Invite email is required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const invite = await inviteUser(inviteEmail.trim().toLowerCase(), inviteRole, Number(inviteDays) || 7)
      setLatestInviteToken(invite.token)
      setInviteEmail('')
      await loadUsers()
    } catch {
      setError('Unable to create invite.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm('Delete this user?')) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await deleteUser(userId)
      await loadUsers()
    } catch {
      setError('Unable to delete user.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <section className="content-card">
        <h3>Users</h3>
        <p className="panel-placeholder">Only admin users can manage invited and active accounts.</p>
      </section>
    )
  }

  return (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Users</h3>
          <p>{users.length.toLocaleString()} active or invited users</p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="crm-form-grid">
        <label>
          Invite Email
          <input value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="user@houseofrojanatorn.local" />
        </label>
        <label>
          Role
          <select value={inviteRole} onChange={event => setInviteRole(event.target.value === 'admin' ? 'admin' : 'member')}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Expires (days)
          <input type="number" min={1} max={30} value={inviteDays} onChange={event => setInviteDays(event.target.value)} />
        </label>
        <div className="crm-form-actions">
          <button type="button" className="primary-btn" onClick={() => void handleInvite()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Create Invite'}
          </button>
        </div>
      </div>

      {inviteLink ? (
        <div className="usage-lines">
          <h4>Latest Invite Link</h4>
          <p className="panel-placeholder">Share this link with the invited user to set their password:</p>
          <p><a href={inviteLink}>{inviteLink}</a></p>
        </div>
      ) : null}

      {isLoading ? (
        <p className="panel-placeholder">Loading users...</p>
      ) : (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Invite Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const canDelete = user.email.toLowerCase() !== email.toLowerCase() && user.email.toLowerCase() !== 'admin@houseofrojanatorn.local'
                return (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                    <td>{formatDate(user.lastLoginAtUtc)}</td>
                    <td>{formatDate(user.inviteExpiresAtUtc)}</td>
                    <td>
                      {canDelete ? (
                        <button type="button" className="secondary-btn" onClick={() => void handleDelete(user.id)} disabled={isSaving}>
                          Delete
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
