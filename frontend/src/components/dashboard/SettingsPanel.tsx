import { useEffect, useState } from 'react'
import { getManufacturingSettings, updateManufacturingSettings } from '../../api/client'
import type { ManufacturingCustomField, ManufacturingProcessStep } from '../../api/types'
import { useSession } from '../../app/useSession'

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
}

const FIELD_TYPES: ManufacturingCustomField['fieldType'][] = ['text', 'textarea', 'number', 'date', 'select']

export function SettingsPanel() {
  const { role } = useSession()
  const [steps, setSteps] = useState<ManufacturingProcessStep[]>([])
  const [fields, setFields] = useState<ManufacturingCustomField[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isAdmin = role === 'admin'

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const settings = await getManufacturingSettings()
      setSteps(settings.steps)
      setFields(settings.fields)
    } catch {
      setError('Unable to load manufacturing settings.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

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

      const updated = await updateManufacturingSettings(payload)
      setSteps(updated.steps)
      setFields(updated.fields)
      setSuccess('Settings saved.')
    } catch {
      setError('Unable to save settings.')
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
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Production Settings</h3>
          <p>Configure workflow steps and dynamic manufacturing fields.</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {success ? <p className="panel-placeholder">{success}</p> : null}

      <div className="usage-lines">
        <div className="card-head">
          <h4>Production Steps</h4>
          <button type="button" className="secondary-btn" onClick={addStep}>Add Step</button>
        </div>
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Step Key</th>
                <th>Label</th>
                <th>Require Photo</th>
                <th>Require Comment</th>
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
                    <button type="button" className="secondary-btn" onClick={() => removeStep(index)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="usage-lines">
        <div className="card-head">
          <h4>Manufacturing Fields</h4>
          <button type="button" className="secondary-btn" onClick={addField}>Add Field</button>
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
                <th>Options (select)</th>
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
                    <button type="button" className="secondary-btn" onClick={() => removeField(index)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
