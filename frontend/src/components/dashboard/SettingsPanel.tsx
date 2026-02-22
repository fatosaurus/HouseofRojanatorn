import { useEffect, useMemo, useState } from 'react'
import { Eye, Plus, Save, Trash2, UserRound, Users, Wrench, X } from 'lucide-react'
import {
  createManufacturingPerson,
  deleteManufacturingPerson,
  deleteUser,
  getManufacturingPersonProfile,
  getManufacturingSettings,
  inviteUser,
  listUsers,
  updateManufacturingPerson,
  updateManufacturingSettings
} from '../../api/client'
import type {
  ManufacturingCustomField,
  ManufacturingPerson,
  ManufacturingPersonProfile,
  ManufacturingProcessStep,
  UserSummary
} from '../../api/types'
import { useSession } from '../../app/useSession'

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
}

const FIELD_TYPES: ManufacturingCustomField['fieldType'][] = ['text', 'textarea', 'number', 'date', 'select']
type WorkforceRole = 'designer' | 'craftsman'
type SettingsSection = 'profile' | 'users' | 'designers' | 'craftsmen' | 'steps' | 'fields'

interface EditablePerson {
  id: number
  role: WorkforceRole
  name: string
  email: string
  phone: string
  isActive: boolean
}

function mapEditablePeople(role: WorkforceRole, items: ManufacturingPerson[]): EditablePerson[] {
  return items
    .filter(item => item.role === role)
    .map(item => ({
      id: item.id,
      role,
      name: item.name,
      email: item.email ?? '',
      phone: item.phone ?? '',
      isActive: item.isActive
    }))
}

function createDraftPerson(role: WorkforceRole): EditablePerson {
  return {
    id: -Date.now() - Math.floor(Math.random() * 1000),
    role,
    name: '',
    email: '',
    phone: '',
    isActive: true
  }
}

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value)
}

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)

  if (parts.length === 0) {
    return 'U'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))

  if (parts.length === 0) {
    return 'User'
  }

  return parts.join(' ')
}

export function SettingsPanel() {
  const { role, email } = useSession()
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')

  const [steps, setSteps] = useState<ManufacturingProcessStep[]>([])
  const [fields, setFields] = useState<ManufacturingCustomField[]>([])
  const [designers, setDesigners] = useState<EditablePerson[]>([])
  const [craftsmen, setCraftsmen] = useState<EditablePerson[]>([])
  const [deletedPersonIds, setDeletedPersonIds] = useState<number[]>([])

  const [users, setUsers] = useState<UserSummary[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteDays, setInviteDays] = useState('7')
  const [latestInviteToken, setLatestInviteToken] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingUsers, setIsSavingUsers] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [profile, setProfile] = useState<ManufacturingPersonProfile | null>(null)

  const isAdmin = role === 'admin'

  const inviteLink = useMemo(() => {
    if (!latestInviteToken) {
      return null
    }

    return `${window.location.origin}/accept-invite?token=${encodeURIComponent(latestInviteToken)}`
  }, [latestInviteToken])

  const pageIdentity = useMemo(() => {
    return {
      initials: initialsFromEmail(email),
      name: displayNameFromEmail(email),
      email,
      role: role === 'admin' ? 'Admin' : 'Member'
    }
  }, [email, role])

  const sectionConfig: Record<SettingsSection, { title: string, subtitle: string }> = {
    profile: {
      title: 'Profile',
      subtitle: 'Manage your own account details visible across the platform.'
    },
    users: {
      title: 'Users',
      subtitle: 'Invite teammates and control account access.'
    },
    designers: {
      title: 'Designers',
      subtitle: 'Manage designers and view all pieces linked to each profile.'
    },
    craftsmen: {
      title: 'Craftsmen',
      subtitle: 'Manage craftsmen and review production output by person.'
    },
    steps: {
      title: 'Production Steps',
      subtitle: 'Configure stage requirements like comments and photo evidence.'
    },
    fields: {
      title: 'Manufacturing Fields',
      subtitle: 'Control dynamic fields shown on manufacturing forms.'
    }
  }

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const settings = await getManufacturingSettings()
      setSteps(settings.steps)
      setFields(settings.fields)
      setDesigners(mapEditablePeople('designer', settings.designers))
      setCraftsmen(mapEditablePeople('craftsman', settings.craftsmen))
      setDeletedPersonIds([])
    } catch {
      setError('Unable to load manufacturing settings.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadUsers() {
    if (!isAdmin) {
      setUsers([])
      setIsLoadingUsers(false)
      return
    }

    setIsLoadingUsers(true)
    try {
      const result = await listUsers(200)
      setUsers(result.items)
    } catch {
      setError('Unable to load users.')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  useEffect(() => {
    void loadSettings()
    void loadUsers()
  }, [isAdmin])

  const activeProfileRole = useMemo(() => {
    if (!profile) {
      return null
    }
    return profile.person.role
  }, [profile])

  const onManufacturingSection = activeSection === 'designers' ||
    activeSection === 'craftsmen' ||
    activeSection === 'steps' ||
    activeSection === 'fields'

  function addStep() {
    setSteps(current => [
      ...current,
      {
        stepKey: '',
        label: '',
        sortOrder: current.length + 1,
        requirePhoto: false,
        requireComment: false,
        isActive: true
      }
    ])
  }

  function removeStep(index: number) {
    setSteps(current => current.filter((_, currentIndex) => currentIndex !== index))
  }

  function addField() {
    setFields(current => [
      ...current,
      {
        fieldKey: '',
        label: '',
        fieldType: 'text',
        sortOrder: current.length + 1,
        isRequired: false,
        isActive: true,
        isSystem: false,
        options: []
      }
    ])
  }

  function removeField(index: number) {
    setFields(current => current.filter((_, currentIndex) => currentIndex !== index))
  }

  function updatePerson(roleKey: WorkforceRole, index: number, patch: Partial<EditablePerson>) {
    const setter = roleKey === 'designer' ? setDesigners : setCraftsmen
    setter(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  function addPerson(roleKey: WorkforceRole) {
    const setter = roleKey === 'designer' ? setDesigners : setCraftsmen
    setter(current => [...current, createDraftPerson(roleKey)])
  }

  function removePerson(roleKey: WorkforceRole, index: number) {
    const setter = roleKey === 'designer' ? setDesigners : setCraftsmen
    setter(current => {
      const person = current[index]
      if (person && person.id > 0) {
        setDeletedPersonIds(ids => Array.from(new Set([...ids, person.id])))
      }
      return current.filter((_, currentIndex) => currentIndex !== index)
    })

    if (profile && profile.person.id === (roleKey === 'designer' ? designers[index]?.id : craftsmen[index]?.id)) {
      setProfile(null)
    }
  }

  async function openProfile(person: EditablePerson) {
    if (person.id <= 0) {
      setError('Save this profile first, then you can open linked pieces.')
      return
    }

    setIsLoadingProfile(true)
    setError(null)
    try {
      const loaded = await getManufacturingPersonProfile(person.id)
      setProfile(loaded)
    } catch {
      setError('Unable to load profile details.')
    } finally {
      setIsLoadingProfile(false)
    }
  }

  async function syncPeople(roleKey: WorkforceRole, list: EditablePerson[]) {
    for (const person of list) {
      const normalizedName = person.name.trim()
      if (!normalizedName) {
        if (person.id > 0) {
          throw new Error(`${roleKey === 'designer' ? 'Designer' : 'Craftsman'} name is required.`)
        }
        continue
      }

      const payload = {
        role: roleKey,
        name: normalizedName,
        email: person.email.trim() || null,
        phone: person.phone.trim() || null,
        isActive: person.isActive
      } as const

      if (person.id > 0) {
        await updateManufacturingPerson(person.id, payload)
      } else {
        await createManufacturingPerson(payload)
      }
    }
  }

  async function saveManufacturingSettings() {
    if (!isAdmin) {
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        steps: steps.map((step, index) => ({
          stepKey: slugify(step.stepKey || step.label),
          label: step.label.trim() || step.stepKey,
          sortOrder: index + 1,
          requirePhoto: step.requirePhoto,
          requireComment: step.requireComment,
          isActive: step.isActive
        })),
        fields: fields.map((field, index) => ({
          fieldKey: field.fieldKey.trim() || slugify(field.label),
          label: field.label.trim() || field.fieldKey,
          fieldType: field.fieldType,
          sortOrder: index + 1,
          isRequired: field.isRequired,
          isActive: field.isActive,
          options: field.fieldType === 'select' ? field.options : []
        }))
      }

      await updateManufacturingSettings(payload)

      for (const personId of deletedPersonIds) {
        await deleteManufacturingPerson(personId)
      }

      await syncPeople('designer', designers)
      await syncPeople('craftsman', craftsmen)

      await loadSettings()
      setSuccess('Manufacturing settings saved.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : null
      setError(message || 'Unable to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      setError('Invite email is required.')
      return
    }

    setIsSavingUsers(true)
    setError(null)

    try {
      const invite = await inviteUser(inviteEmail.trim().toLowerCase(), inviteRole, Number(inviteDays) || 7)
      setLatestInviteToken(invite.token)
      setInviteEmail('')
      await loadUsers()
      setSuccess('Invite created.')
    } catch {
      setError('Unable to create invite.')
    } finally {
      setIsSavingUsers(false)
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm('Delete this user?')) {
      return
    }

    setIsSavingUsers(true)
    setError(null)

    try {
      await deleteUser(userId)
      await loadUsers()
      setSuccess('User deleted.')
    } catch {
      setError('Unable to delete user.')
    } finally {
      setIsSavingUsers(false)
    }
  }

  function renderProfile() {
    return (
      <div className="settings-profile-content">
        <article className="settings-profile-card">
          <h4>Account Overview</h4>
          <p className="panel-placeholder">Your current signed-in identity and role.</p>

          <div className="settings-profile-avatar">{pageIdentity.initials}</div>
          <p className="settings-profile-name">{pageIdentity.name}</p>
          <p className="panel-placeholder">{pageIdentity.role}</p>

          <dl className="settings-profile-meta">
            <div>
              <dt>Primary Email</dt>
              <dd>{pageIdentity.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{pageIdentity.role}</dd>
            </div>
          </dl>
        </article>

        <article className="settings-profile-form-card">
          <h4>Personal Information</h4>
          <p className="panel-placeholder">Editable profile fields can be persisted in a later release.</p>

          <div className="crm-form-grid settings-inline-form">
            <label>
              First Name
              <input defaultValue={pageIdentity.name.split(' ')[0] ?? ''} />
            </label>
            <label>
              Last Name
              <input defaultValue={pageIdentity.name.split(' ').slice(1).join(' ')} />
            </label>
            <label className="crm-form-span">
              Job Title
              <input defaultValue={pageIdentity.role} />
            </label>
            <label className="crm-form-span">
              Email Signature
              <textarea rows={3} defaultValue={`Regards,\n${pageIdentity.name}`} />
            </label>
          </div>
        </article>
      </div>
    )
  }

  function renderUsers() {
    if (!isAdmin) {
      return <p className="panel-placeholder">Only admin users can manage invites and user access.</p>
    }

    return (
      <>
        <div className="crm-form-grid settings-inline-form">
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
            <button type="button" className="primary-btn" onClick={() => void handleInvite()} disabled={isSavingUsers}>
              {isSavingUsers ? 'Saving...' : 'Create Invite'}
            </button>
          </div>
        </div>

        {inviteLink ? (
          <div className="usage-lines">
            <h4>Latest Invite Link</h4>
            <p><a href={inviteLink}>{inviteLink}</a></p>
          </div>
        ) : null}

        {isLoadingUsers ? (
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
                          <button type="button" className="secondary-btn" onClick={() => void handleDeleteUser(user.id)} disabled={isSavingUsers}>
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
      </>
    )
  }

  function renderPeople(roleKey: WorkforceRole) {
    const people = roleKey === 'designer' ? designers : craftsmen
    return (
      <>
        <div className="card-head settings-subhead">
          <h4>{roleKey === 'designer' ? 'Designers' : 'Craftsmen'}</h4>
          <button type="button" className="secondary-btn" onClick={() => addPerson(roleKey)}>
            <Plus size={14} />
            {roleKey === 'designer' ? 'Add Designer' : 'Add Craftsman'}
          </button>
        </div>

        <div className="usage-table-wrap">
          <table className="usage-table workforce-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person, index) => (
                <tr key={`${person.id}-${index}`}>
                  <td>
                    <input
                      value={person.name}
                      placeholder={`${roleKey === 'designer' ? 'Designer' : 'Craftsman'} name`}
                      onChange={event => updatePerson(roleKey, index, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={person.email}
                      placeholder="user@example.com"
                      onChange={event => updatePerson(roleKey, index, { email: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={person.phone}
                      placeholder="+66..."
                      onChange={event => updatePerson(roleKey, index, { phone: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={person.isActive}
                      onChange={event => updatePerson(roleKey, index, { isActive: event.target.checked })}
                    />
                  </td>
                  <td>
                    <div className="workforce-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void openProfile(person)}
                        disabled={person.id <= 0}
                        aria-label="View profile"
                        title="View profile"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removePerson(roleKey, index)}
                        aria-label="Remove"
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderSteps() {
    return (
      <>
        <div className="card-head settings-subhead">
          <h4>Production Steps</h4>
          <button type="button" className="secondary-btn" onClick={addStep}>
            <Plus size={14} />
            Add Step
          </button>
        </div>

        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Step Key</th>
                <th>Label</th>
                <th>Photo</th>
                <th>Comment</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <tr key={`${step.stepKey || 'new'}-${index}`}>
                  <td>
                    <input
                      value={step.stepKey}
                      onChange={event => {
                        const value = event.target.value
                        setSteps(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, stepKey: value } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={step.label}
                      onChange={event => {
                        const value = event.target.value
                        setSteps(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: value } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={step.requirePhoto}
                      onChange={event => {
                        const checked = event.target.checked
                        setSteps(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, requirePhoto: checked } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={step.requireComment}
                      onChange={event => {
                        const checked = event.target.checked
                        setSteps(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, requireComment: checked } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={step.isActive}
                      onChange={event => {
                        const checked = event.target.checked
                        setSteps(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: checked } : item))
                      }}
                    />
                  </td>
                  <td>
                    <button type="button" className="icon-btn" onClick={() => removeStep(index)} aria-label="Remove step" title="Remove step">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderFields() {
    return (
      <>
        <div className="card-head settings-subhead">
          <h4>Manufacturing Fields</h4>
          <button type="button" className="secondary-btn" onClick={addField}>
            <Plus size={14} />
            Add Field
          </button>
        </div>

        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Type</th>
                <th>Required</th>
                <th>Active</th>
                <th>Options</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={`${field.fieldKey || 'field'}-${index}`}>
                  <td>
                    <input
                      value={field.fieldKey}
                      onChange={event => {
                        const value = event.target.value
                        setFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, fieldKey: value } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={field.label}
                      onChange={event => {
                        const value = event.target.value
                        setFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: value } : item))
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={field.fieldType}
                      onChange={event => {
                        const value = event.target.value as ManufacturingCustomField['fieldType']
                        setFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, fieldType: value } : item))
                      }}
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={field.isRequired}
                      onChange={event => {
                        const checked = event.target.checked
                        setFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, isRequired: checked } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={field.isActive}
                      onChange={event => {
                        const checked = event.target.checked
                        setFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: checked } : item))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={field.options.join(', ')}
                      placeholder="A, B, C"
                      onChange={event => {
                        const value = event.target.value
                        setFields(current => current.map((item, itemIndex) => itemIndex === index ? {
                          ...item,
                          options: value
                            .split(',')
                            .map(option => option.trim())
                            .filter(option => option.length > 0)
                        } : item))
                      }}
                    />
                  </td>
                  <td>
                    <button type="button" className="icon-btn" onClick={() => removeField(index)} aria-label="Remove field" title="Remove field">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderActiveSection() {
    switch (activeSection) {
      case 'profile':
        return renderProfile()
      case 'users':
        return renderUsers()
      case 'designers':
        return renderPeople('designer')
      case 'craftsmen':
        return renderPeople('craftsman')
      case 'steps':
        return renderSteps()
      case 'fields':
        return renderFields()
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <section className="content-card">
        <h3>Settings</h3>
        <p className="panel-placeholder">Loading settings...</p>
      </section>
    )
  }

  return (
    <div className={`settings-tier-layout ${profile ? 'has-profile' : ''}`}>
      <aside className="settings-tier-nav content-card">
        <p className="settings-tier-kicker">Settings</p>
        <h3>Control Center</h3>
        <p className="panel-placeholder">Choose what to configure across platform and manufacturing workflows.</p>

        <div className="settings-tier-group">
          <p>Platform Settings</p>
          <button type="button" className={activeSection === 'profile' ? 'active' : ''} onClick={() => setActiveSection('profile')}>
            <UserRound size={15} />
            Profile
          </button>
          {isAdmin ? (
            <button type="button" className={activeSection === 'users' ? 'active' : ''} onClick={() => setActiveSection('users')}>
              <Users size={15} />
              Users
            </button>
          ) : null}
        </div>

        <div className="settings-tier-group">
          <p>Manufacturing Settings</p>
          <button type="button" className={activeSection === 'designers' ? 'active' : ''} onClick={() => setActiveSection('designers')}>
            <UserRound size={15} />
            Designers
          </button>
          <button type="button" className={activeSection === 'craftsmen' ? 'active' : ''} onClick={() => setActiveSection('craftsmen')}>
            <Wrench size={15} />
            Craftsmen
          </button>
          <button type="button" className={activeSection === 'steps' ? 'active' : ''} onClick={() => setActiveSection('steps')}>
            Steps
          </button>
          <button type="button" className={activeSection === 'fields' ? 'active' : ''} onClick={() => setActiveSection('fields')}>
            Fields
          </button>
        </div>
      </aside>

      <section className="content-card settings-tier-main">
        <div className="card-head">
          <div>
            <h3>{sectionConfig[activeSection].title}</h3>
            <p>{sectionConfig[activeSection].subtitle}</p>
          </div>
          {onManufacturingSection && isAdmin ? (
            <button type="button" className="primary-btn" onClick={() => void saveManufacturingSettings()} disabled={isSaving}>
              <Save size={14} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          ) : null}
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
        {success ? <p className="panel-placeholder">{success}</p> : null}

        {renderActiveSection()}
      </section>

      {profile ? (
        <aside className="detail-side-panel settings-profile-panel">
          <div className="drawer-head">
            <div>
              <h3>{activeProfileRole === 'designer' ? 'Designer Profile' : 'Craftsman Profile'}</h3>
              <p className="panel-placeholder">Linked pieces and production history.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setProfile(null)} aria-label="Close profile" title="Close profile">
              <X size={17} />
            </button>
          </div>

          {isLoadingProfile ? (
            <p className="panel-placeholder">Loading profile...</p>
          ) : (
            <>
              <div className="usage-lines">
                <h4>{profile.person.name}</h4>
                <p>{profile.person.email ?? '-'}</p>
                <p>{profile.person.phone ?? '-'}</p>
                <p>
                  Joined
                  {' '}
                  {formatDate(profile.person.createdAtUtc)}
                </p>
              </div>

              <div className="usage-lines">
                <h4>Pieces ({profile.projects.length})</h4>
                {profile.projects.length === 0 ? (
                  <p className="panel-placeholder">No linked manufacturing projects yet.</p>
                ) : (
                  <div className="activity-list">
                    {profile.projects.map(project => (
                      <article key={project.id}>
                        <p>
                          <strong>{project.manufacturingCode}</strong>
                          {' • '}
                          {project.pieceName}
                        </p>
                        <p>
                          {project.status.replace(/_/g, ' ')}
                          {' • '}
                          {formatDate(project.updatedAtUtc)}
                        </p>
                        <p>
                          Cost
                          {' '}
                          {formatCurrency(project.totalCost)}
                          {' • Sale '}
                          {formatCurrency(project.sellingPrice)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      ) : null}
    </div>
  )
}
