import { useEffect, useMemo, useState } from 'react'
import { Eye, Plus, Save, Trash2, UserRound, Wrench, X } from 'lucide-react'
import {
  createManufacturingPerson,
  deleteManufacturingPerson,
  getManufacturingPersonProfile,
  getManufacturingSettings,
  updateManufacturingPerson,
  updateManufacturingSettings
} from '../../api/client'
import type {
  ManufacturingCustomField,
  ManufacturingPerson,
  ManufacturingPersonProfile,
  ManufacturingProcessStep
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

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value)
}

export function SettingsPanel() {
  const { role } = useSession()
  const [steps, setSteps] = useState<ManufacturingProcessStep[]>([])
  const [fields, setFields] = useState<ManufacturingCustomField[]>([])
  const [designers, setDesigners] = useState<EditablePerson[]>([])
  const [craftsmen, setCraftsmen] = useState<EditablePerson[]>([])
  const [deletedPersonIds, setDeletedPersonIds] = useState<number[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [profile, setProfile] = useState<ManufacturingPersonProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  const isAdmin = role === 'admin'

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

  useEffect(() => {
    void loadSettings()
  }, [])

  const activeProfileRole = useMemo(() => {
    if (!profile) {
      return null
    }
    return profile.person.role
  }, [profile])

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

  async function saveSettings() {
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
      setSuccess('Settings saved.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : null
      setError(message || 'Unable to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <section className="content-card">
        <h3>Settings</h3>
        <p className="panel-placeholder">Only admin users can edit production pipeline settings.</p>
      </section>
    )
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
    <div className={`settings-layout ${profile ? 'has-profile' : ''}`}>
      <section className="content-card settings-dark-panel">
        <div className="card-head settings-dark-headline">
          <div>
            <h3>Production Settings</h3>
            <p>Configure production steps, workforce directory, and dynamic manufacturing fields.</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => void saveSettings()} disabled={isSaving}>
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
        {success ? <p className="panel-placeholder">{success}</p> : null}

        <div className="settings-dark-block">
          <div className="settings-dark-section-head">
            <div>
              <h4>Production Steps</h4>
              <p>Define each manufacturing stage and required evidence.</p>
            </div>
            <button type="button" className="secondary-btn" onClick={addStep}>
              <Plus size={14} />
              Add Step
            </button>
          </div>

          <div className="usage-table-wrap settings-dark-table-wrap">
            <table className="usage-table settings-dark-table">
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
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="settings-dark-block">
          <div className="settings-dark-section-head">
            <div>
              <h4>
                <UserRound size={16} />
                Designers
              </h4>
              <p>Add and manage designers for manufacturing projects.</p>
            </div>
            <button type="button" className="secondary-btn" onClick={() => addPerson('designer')}>
              <Plus size={14} />
              Add Designer
            </button>
          </div>

          <div className="usage-table-wrap settings-dark-table-wrap">
            <table className="usage-table settings-dark-table workforce-table">
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
                {designers.map((person, index) => (
                  <tr key={`${person.id}-${index}`}>
                    <td>
                      <input
                        value={person.name}
                        placeholder="Designer name"
                        onChange={event => updatePerson('designer', index, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={person.email}
                        placeholder="designer@company.com"
                        onChange={event => updatePerson('designer', index, { email: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={person.phone}
                        placeholder="+66..."
                        onChange={event => updatePerson('designer', index, { phone: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={person.isActive}
                        onChange={event => updatePerson('designer', index, { isActive: event.target.checked })}
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
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removePerson('designer', index)}
                          aria-label="Remove designer"
                          title="Remove designer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="settings-dark-block">
          <div className="settings-dark-section-head">
            <div>
              <h4>
                <Wrench size={16} />
                Craftsmen
              </h4>
              <p>Manage craftsman contacts used in project details and workflow logs.</p>
            </div>
            <button type="button" className="secondary-btn" onClick={() => addPerson('craftsman')}>
              <Plus size={14} />
              Add Craftsman
            </button>
          </div>

          <div className="usage-table-wrap settings-dark-table-wrap">
            <table className="usage-table settings-dark-table workforce-table">
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
                {craftsmen.map((person, index) => (
                  <tr key={`${person.id}-${index}`}>
                    <td>
                      <input
                        value={person.name}
                        placeholder="Craftsman name"
                        onChange={event => updatePerson('craftsman', index, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={person.email}
                        placeholder="craftsman@company.com"
                        onChange={event => updatePerson('craftsman', index, { email: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={person.phone}
                        placeholder="+66..."
                        onChange={event => updatePerson('craftsman', index, { phone: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={person.isActive}
                        onChange={event => updatePerson('craftsman', index, { isActive: event.target.checked })}
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
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removePerson('craftsman', index)}
                          aria-label="Remove craftsman"
                          title="Remove craftsman"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="settings-dark-block">
          <div className="settings-dark-section-head">
            <div>
              <h4>Manufacturing Fields</h4>
              <p>Manage extra dynamic fields for project forms.</p>
            </div>
            <button type="button" className="secondary-btn" onClick={addField}>
              <Plus size={14} />
              Add Field
            </button>
          </div>

          <div className="usage-table-wrap settings-dark-table-wrap">
            <table className="usage-table settings-dark-table">
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
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {profile ? (
        <aside className="detail-side-panel settings-profile-panel">
          <div className="drawer-head">
            <div>
              <h3>{activeProfileRole === 'designer' ? 'Designer Profile' : 'Craftsman Profile'}</h3>
              <p className="panel-placeholder">Linked pieces and production history.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setProfile(null)} aria-label="Close profile" title="Close profile">
              <X size={18} />
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
