import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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

function getInitial(value: string): string {
  const normalized = value.trim()
  return normalized ? normalized.charAt(0).toUpperCase() : '?'
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

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseCustomersRoute(pathname: string): { detailId: string | null, isFull: boolean, isInvalid: boolean } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'customers') {
    return { detailId: null, isFull: false, isInvalid: false }
  }

  const detailSegment = parts[2]
  const fullSegment = parts[3]

  if (!detailSegment) {
    return {
      detailId: null,
      isFull: false,
      isInvalid: parts.length > 2
    }
  }

  if (!GUID_REGEX.test(detailSegment)) {
    return { detailId: null, isFull: false, isInvalid: true }
  }

  if (fullSegment && fullSegment !== 'full') {
    return { detailId: detailSegment, isFull: false, isInvalid: true }
  }

  return {
    detailId: detailSegment,
    isFull: fullSegment === 'full',
    isInvalid: parts.length > 4
  }
}

interface CustomerDetailProps {
  customer: Customer
  activity: CustomerActivity[]
  noteDraft: string
  isSaving: boolean
  onNoteChange: (value: string) => void
  onAddNote: () => void
}

function CustomerDetailContent({ customer, activity, noteDraft, isSaving, onNoteChange, onAddNote }: CustomerDetailProps) {
  return (
    <>
      <section className="customer-detail-hero">
        <span className="customer-avatar customer-avatar-large">{getInitial(customer.name)}</span>
        <h4>{customer.name}</h4>
        <p>
          Customer since
          {' '}
          {formatDate(customer.customerSince)}
        </p>
      </section>

      <section className="customer-detail-section">
        <h4>Contact Information</h4>
        <div className="customer-contact-grid">
          <article>
            <span>Email</span>
            <p>{customer.email ?? '-'}</p>
          </article>
          <article>
            <span>Phone</span>
            <p>{customer.phone ?? '-'}</p>
          </article>
          <article className="customer-contact-span">
            <span>Address</span>
            <p>{customer.address ?? '-'}</p>
          </article>
          <article>
            <span>Nickname</span>
            <p>{customer.nickname ?? '-'}</p>
          </article>
        </div>
      </section>

      <section className="customer-detail-section">
        <h4>Purchase Summary</h4>
        <div className="customer-summary-grid">
          <article>
            <span>Total Spent</span>
            <strong>{formatCurrency(customer.totalSpent)}</strong>
          </article>
          <article>
            <span>Purchases</span>
            <strong>{customer.purchaseCount}</strong>
          </article>
        </div>
      </section>

      {customer.notes ? (
        <section className="customer-detail-section">
          <h4>Notes</h4>
          <p className="panel-placeholder">{customer.notes}</p>
        </section>
      ) : null}

      <section className="crm-note-editor customer-note-editor">
        <h4>Append Note</h4>
        <textarea rows={3} value={noteDraft} onChange={event => onNoteChange(event.target.value)} placeholder="Add relationship or order notes..." />
        <div className="crm-form-actions">
          <button type="button" className="primary-btn" onClick={onAddNote} disabled={isSaving || !noteDraft.trim()}>
            {isSaving ? 'Saving...' : 'Append Note'}
          </button>
        </div>
      </section>

      <section className="usage-lines customer-detail-section">
        <h4>Customer Activity ({activity.length})</h4>
        {activity.length === 0 ? (
          <p className="panel-placeholder">No activity logged yet.</p>
        ) : (
          <div className="activity-list">
            {activity.map(item => (
              <article key={item.id}>
                <p>
                  <strong>{item.status.replace(/_/g, ' ')}</strong>
                  {' • '}
                  {formatDate(item.activityAtUtc)}
                </p>
                <p>{item.manufacturingCode} / {item.pieceName}</p>
                {item.notes ? <p>{item.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export function CustomersPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parseCustomersRoute(location.pathname), [location.pathname])

  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<CustomerActivity[]>([])
  const [noteDraft, setNoteDraft] = useState('')

  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (route.isInvalid) {
      navigate('/dashboard/customers', { replace: true })
    }
  }, [navigate, route.isInvalid])

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

  useEffect(() => {
    if (!route.detailId) {
      setSelectedCustomer(null)
      setSelectedActivity([])
      setIsLoadingDetail(false)
      setNoteDraft('')
      return
    }

    let cancelled = false
    setIsLoadingDetail(true)
    setError(null)

    void Promise.all([
      getCustomer(route.detailId),
      getCustomerActivity(route.detailId, 100)
    ])
      .then(([customer, activity]) => {
        if (!cancelled) {
          setSelectedCustomer(customer)
          setSelectedActivity(activity)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load selected customer profile.')
          setSelectedCustomer(null)
          setSelectedActivity([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [route.detailId])

  function openCustomer(id: string) {
    navigate(`/dashboard/customers/${id}`)
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
      navigate(`/dashboard/customers/${created.id}`)
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

  function closeDetail() {
    navigate('/dashboard/customers')
  }

  function openFullDetail() {
    if (!route.detailId) {
      return
    }

    navigate(`/dashboard/customers/${route.detailId}/full`)
  }

  function closeFullDetail() {
    if (!route.detailId) {
      navigate('/dashboard/customers')
      return
    }

    navigate(`/dashboard/customers/${route.detailId}`)
  }

  const listCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Customer Information</h3>
          <p>{totalCount.toLocaleString()} customer profiles with spend history</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setIsCreating(current => !current)}>
          {isCreating ? 'Cancel' : '+ New Customer'}
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
                <tr
                  key={customer.id}
                  className={route.detailId === customer.id ? 'is-selected' : ''}
                  onClick={() => openCustomer(customer.id)}
                >
                  <td>
                    <div className="customer-name-cell">
                      <span className="customer-avatar">{getInitial(customer.name)}</span>
                      <div>
                        <strong>{customer.name}</strong>
                        {customer.nickname ? <p className="inline-subtext">{customer.nickname}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td>{customer.email ?? '-'}</td>
                  <td>{customer.phone ?? '-'}</td>
                  <td className="accent-value">{formatCurrency(customer.totalSpent)}</td>
                  <td>
                    <span className="metric-badge">{customer.purchaseCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  if (route.isFull) {
    return (
      <section className="content-card detail-page-card">
        <div className="card-head">
          <div>
            <h3>Customer Details</h3>
            <p>Full page profile view with notes and activity.</p>
          </div>
          <div className="detail-actions-row">
            <button type="button" className="secondary-btn" onClick={closeFullDetail}>
              Back To Split View
            </button>
            <button type="button" className="secondary-btn" onClick={closeDetail}>
              Back To Table
            </button>
          </div>
        </div>

        {isLoadingDetail ? (
          <p className="panel-placeholder">Loading customer details...</p>
        ) : selectedCustomer ? (
          <CustomerDetailContent
            customer={selectedCustomer}
            activity={selectedActivity}
            noteDraft={noteDraft}
            isSaving={isSaving}
            onNoteChange={setNoteDraft}
            onAddNote={() => {
              void handleAddNote()
            }}
          />
        ) : (
          <p className="panel-placeholder">No customer detail found for this route.</p>
        )}
      </section>
    )
  }

  return (
    <div className={`content-split ${route.detailId ? 'has-detail' : ''}`}>
      <div className="content-split-main">
        {listCard}
      </div>

      {route.detailId ? (
        <aside className="detail-side-panel">
          <div className="drawer-head">
            <h3>Customer Detail</h3>
            <div className="detail-actions-row">
              <button type="button" className="secondary-btn" onClick={openFullDetail}>
                Full Screen
              </button>
              <button type="button" className="secondary-btn" onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>

          {isLoadingDetail ? (
            <p className="panel-placeholder">Loading customer details...</p>
          ) : selectedCustomer ? (
            <CustomerDetailContent
              customer={selectedCustomer}
              activity={selectedActivity}
              noteDraft={noteDraft}
              isSaving={isSaving}
              onNoteChange={setNoteDraft}
              onAddNote={() => {
                void handleAddNote()
              }}
            />
          ) : (
            <p className="panel-placeholder">No customer detail found for this record.</p>
          )}
        </aside>
      ) : null}
    </div>
  )
}
