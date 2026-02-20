import { useEffect, useState } from 'react'
import { addCustomerNote, createCustomer, getCustomer, getCustomerActivity, getCustomers } from '../../api/client'
import type { Customer, CustomerActivity } from '../../api/types'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value)
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

interface CustomerDraft {
  name: string
  nickname: string
  email: string
  phone: string
  address: string
  notes: string
}

const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
  name: '',
  nickname: '',
  email: '',
  phone: '',
  address: '',
  notes: ''
}

export function CustomersPanel() {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<CustomerActivity[]>([])
  const [noteDraft, setNoteDraft] = useState('')

  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT)
  const [isSaving, setIsSaving] = useState(false)

  async function loadCustomers(currentSearch: string) {
    setIsLoading(true)
    setError(null)

    try {
      const page = await getCustomers({
        search: currentSearch,
        limit: 120,
        offset: 0
      })

      setCustomers(page.items)
      setTotalCount(page.totalCount)
    } catch {
      setError('Unable to load customers.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCustomers(search)
  }, [search])

  async function openCustomer(id: string) {
    setError(null)
    try {
      const [customer, activity] = await Promise.all([
        getCustomer(id),
        getCustomerActivity(id, 100)
      ])
      setSelectedCustomer(customer)
      setSelectedActivity(activity)
    } catch {
      setError('Unable to load selected customer profile.')
    }
  }

  async function handleCreate() {
    if (!draft.name.trim()) {
      setError('Customer name is required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const created = await createCustomer({
        name: draft.name.trim(),
        nickname: draft.nickname.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
        notes: draft.notes.trim() || null
      })

      setDraft(EMPTY_CUSTOMER_DRAFT)
      setIsCreating(false)
      await loadCustomers(search)
      await openCustomer(created.id)
    } catch {
      setError('Unable to create customer.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddNote() {
    if (!selectedCustomer || !noteDraft.trim()) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const maybeUpdated = await addCustomerNote(selectedCustomer.id, noteDraft.trim())
      const [activity] = await Promise.all([
        getCustomerActivity(selectedCustomer.id, 100),
        loadCustomers(search)
      ])

      if (maybeUpdated) {
        setSelectedCustomer(maybeUpdated)
      } else {
        const refreshed = await getCustomer(selectedCustomer.id)
        setSelectedCustomer(refreshed)
      }

      setSelectedActivity(activity)
      setNoteDraft('')
    } catch {
      setError('Unable to append customer note.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <section className="content-card">
        <div className="card-head">
          <div>
            <h3>Customer Information</h3>
            <p>{totalCount.toLocaleString()} customer profiles with spend history</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => setIsCreating(current => !current)}>
            {isCreating ? 'Cancel' : 'New Customer'}
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

      {isCreating ? (
          <div className="crm-form-grid">
            <label>
              Name
              <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Nickname
              <input value={draft.nickname} onChange={event => setDraft(current => ({ ...current, nickname: event.target.value }))} />
            </label>
            <label>
              Email
              <input value={draft.email} onChange={event => setDraft(current => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              Phone
              <input value={draft.phone} onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))} />
            </label>
            <label className="crm-form-span">
              Address
              <input value={draft.address} onChange={event => setDraft(current => ({ ...current, address: event.target.value }))} />
            </label>
            <label className="crm-form-span">
              Notes
              <textarea rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
            </label>
            <div className="crm-form-actions crm-form-span">
              <button type="button" className="secondary-btn" onClick={() => setDraft(EMPTY_CUSTOMER_DRAFT)} disabled={isSaving}>
                Reset
              </button>
              <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="filter-grid single-row-filter">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, nickname, email, or phone" />
        </div>

        {isLoading ? (
          <p className="panel-placeholder">Loading customer list...</p>
        ) : (
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Total Spent</th>
                  <th>Purchases</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer.id} onClick={() => void openCustomer(customer.id)}>
                    <td>
                      <strong>{customer.name}</strong>
                      {customer.nickname ? <p className="inline-subtext">{customer.nickname}</p> : null}
                    </td>
                    <td>{customer.email ?? '-'}</td>
                    <td>{customer.phone ?? '-'}</td>
                    <td>{formatCurrency(customer.totalSpent)}</td>
                    <td>{customer.purchaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCustomer ? (
        <section className="detail-drawer">
          <div className="drawer-head">
            <h3>{selectedCustomer.name}</h3>
            <button type="button" className="secondary-btn" onClick={() => setSelectedCustomer(null)}>
              Close
            </button>
          </div>

          <div className="drawer-grid">
            <p>
              <strong>Email:</strong> {selectedCustomer.email ?? '-'}
            </p>
            <p>
              <strong>Phone:</strong> {selectedCustomer.phone ?? '-'}
            </p>
            <p>
              <strong>Customer Since:</strong> {formatDate(selectedCustomer.customerSince)}
            </p>
            <p>
              <strong>Total Spent:</strong> {formatCurrency(selectedCustomer.totalSpent)}
            </p>
          </div>

          <div className="crm-note-editor">
            <h4>Add Note</h4>
            <textarea rows={3} value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Add relationship or order notes..." />
            <div className="crm-form-actions">
              <button type="button" className="primary-btn" onClick={() => void handleAddNote()} disabled={isSaving || !noteDraft.trim()}>
                {isSaving ? 'Saving...' : 'Append Note'}
              </button>
            </div>
          </div>

          <div className="usage-lines">
            <h4>Customer Activity</h4>
            {selectedActivity.length === 0 ? (
              <p className="panel-placeholder">No activity logged yet.</p>
            ) : (
              <div className="activity-list">
                {selectedActivity.map(activity => (
                  <article key={activity.id}>
                    <p>
                      <strong>{activity.status.replace(/_/g, ' ')}</strong>
                      {' • '}
                      {formatDate(activity.activityAtUtc)}
                    </p>
                    <p>{activity.manufacturingCode} / {activity.pieceName}</p>
                    {activity.notes ? <p>{activity.notes}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  )
}
