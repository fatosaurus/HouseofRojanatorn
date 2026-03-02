import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Expand, Plus, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createSupplier,
  createSupplierPurchase,
  getSupplier,
  getSupplierPurchases,
  getSuppliers
} from '../../api/client'
import type { Supplier, SupplierPurchaseHistory } from '../../api/types'

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface SupplierDraft {
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  taxId: string
  notes: string
}

interface PurchaseDraft {
  purchaseDate: string
  referenceNo: string
  description: string
  totalAmount: string
  notes: string
}

const EMPTY_SUPPLIER_DRAFT: SupplierDraft = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  notes: ''
}

const EMPTY_PURCHASE_DRAFT: PurchaseDraft = {
  purchaseDate: '',
  referenceNo: '',
  description: '',
  totalAmount: '',
  notes: ''
}

function parseSuppliersRoute(pathname: string): { detailId: string | null, isFull: boolean, isInvalid: boolean } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'suppliers') {
    return { detailId: null, isFull: false, isInvalid: false }
  }

  const detailSegment = parts[2]
  const fullSegment = parts[3]

  if (!detailSegment) {
    return { detailId: null, isFull: false, isInvalid: parts.length > 2 }
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

function readApiError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback
  }

  try {
    const parsed = JSON.parse(error.message) as { error?: string }
    if (parsed.error?.trim()) {
      return parsed.error
    }
  } catch {
    // ignore parse error
  }

  return error.message || fallback
}

export function SuppliersPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parseSuppliersRoute(location.pathname), [location.pathname])

  const [search, setSearch] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isCreating, setIsCreating] = useState(false)
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>(EMPTY_SUPPLIER_DRAFT)

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [purchases, setPurchases] = useState<SupplierPurchaseHistory[]>([])
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>(EMPTY_PURCHASE_DRAFT)

  useEffect(() => {
    if (route.isInvalid) {
      navigate('/dashboard/suppliers', { replace: true })
    }
  }, [navigate, route.isInvalid])

  async function loadSuppliers(currentSearch: string) {
    setIsLoading(true)
    setError(null)
    try {
      const page = await getSuppliers({
        search: currentSearch,
        limit: 150,
        offset: 0
      })
      setSuppliers(page.items)
      setTotalCount(page.totalCount)
    } catch (loadError) {
      setError(readApiError(loadError, 'Unable to load suppliers.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSuppliers(search)
  }, [search])

  useEffect(() => {
    if (!route.detailId) {
      setSelectedSupplier(null)
      setPurchases([])
      setPurchaseDraft(EMPTY_PURCHASE_DRAFT)
      setIsLoadingDetail(false)
      return
    }

    let cancelled = false
    setIsLoadingDetail(true)
    setError(null)
    void Promise.all([
      getSupplier(route.detailId),
      getSupplierPurchases(route.detailId, 200)
    ])
      .then(([supplier, loadedPurchases]) => {
        if (cancelled) {
          return
        }
        setSelectedSupplier(supplier)
        setPurchases(loadedPurchases)
      })
      .catch(loadError => {
        if (cancelled) {
          return
        }
        setError(readApiError(loadError, 'Unable to load supplier details.'))
        setSelectedSupplier(null)
        setPurchases([])
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

  async function handleCreateSupplier() {
    if (!supplierDraft.name.trim()) {
      setError('Supplier name is required.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const created = await createSupplier({
        name: supplierDraft.name.trim(),
        contactName: supplierDraft.contactName.trim() || null,
        email: supplierDraft.email.trim() || null,
        phone: supplierDraft.phone.trim() || null,
        address: supplierDraft.address.trim() || null,
        taxId: supplierDraft.taxId.trim() || null,
        notes: supplierDraft.notes.trim() || null
      })
      setSupplierDraft(EMPTY_SUPPLIER_DRAFT)
      setIsCreating(false)
      await loadSuppliers(search)
      navigate(`/dashboard/suppliers/${created.id}`)
    } catch (createError) {
      setError(readApiError(createError, 'Unable to create supplier.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddPurchase() {
    if (!selectedSupplier) {
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const created = await createSupplierPurchase(selectedSupplier.id, {
        purchaseDate: purchaseDraft.purchaseDate || null,
        referenceNo: purchaseDraft.referenceNo.trim() || null,
        description: purchaseDraft.description.trim() || null,
        totalAmount: purchaseDraft.totalAmount.trim() ? Number(purchaseDraft.totalAmount) : null,
        notes: purchaseDraft.notes.trim() || null,
        currencyCode: 'THB'
      })
      setPurchases(current => [created, ...current])
      setPurchaseDraft(EMPTY_PURCHASE_DRAFT)
      const refreshed = await getSupplier(selectedSupplier.id)
      setSelectedSupplier(refreshed)
      setSuppliers(current => current.map(item => (item.id === refreshed.id ? refreshed : item)))
    } catch (saveError) {
      setError(readApiError(saveError, 'Unable to save purchase history entry.'))
    } finally {
      setIsSaving(false)
    }
  }

  function openDetail(id: string) {
    navigate(`/dashboard/suppliers/${id}`)
  }

  function closeDetail() {
    navigate('/dashboard/suppliers')
  }

  function openFull() {
    if (!route.detailId) {
      return
    }
    navigate(`/dashboard/suppliers/${route.detailId}/full`)
  }

  function closeFull() {
    if (!route.detailId) {
      navigate('/dashboard/suppliers')
      return
    }
    navigate(`/dashboard/suppliers/${route.detailId}`)
  }

  const detailContent = isLoadingDetail ? (
    <p className="panel-placeholder">Loading supplier detail...</p>
  ) : selectedSupplier ? (
    <>
      <div className="drawer-grid">
        <p><strong>Name:</strong> {selectedSupplier.name}</p>
        <p><strong>Contact:</strong> {selectedSupplier.contactName ?? '-'}</p>
        <p><strong>Email:</strong> {selectedSupplier.email ?? '-'}</p>
        <p><strong>Phone:</strong> {selectedSupplier.phone ?? '-'}</p>
        <p><strong>Tax ID:</strong> {selectedSupplier.taxId ?? '-'}</p>
        <p><strong>Created:</strong> {formatDate(selectedSupplier.createdAtUtc)}</p>
        <p><strong>Address:</strong> {selectedSupplier.address ?? '-'}</p>
        <p><strong>Total Purchases:</strong> {selectedSupplier.purchaseCount}</p>
        <p><strong>Total Purchased:</strong> {formatCurrency(selectedSupplier.totalPurchasedAmount)}</p>
      </div>

      <div className="usage-lines">
        <h4>Add Purchase Entry</h4>
        <div className="gemstone-row-grid">
          <label>
            Date
            <input type="date" value={purchaseDraft.purchaseDate} onChange={event => setPurchaseDraft(current => ({ ...current, purchaseDate: event.target.value }))} />
          </label>
          <label>
            Reference
            <input value={purchaseDraft.referenceNo} onChange={event => setPurchaseDraft(current => ({ ...current, referenceNo: event.target.value }))} />
          </label>
          <label>
            Total (THB)
            <input type="number" value={purchaseDraft.totalAmount} onChange={event => setPurchaseDraft(current => ({ ...current, totalAmount: event.target.value }))} />
          </label>
        </div>
        <label className="step-evidence-label">
          Description
          <textarea rows={2} value={purchaseDraft.description} onChange={event => setPurchaseDraft(current => ({ ...current, description: event.target.value }))} />
        </label>
        <label className="step-evidence-label">
          Notes
          <textarea rows={2} value={purchaseDraft.notes} onChange={event => setPurchaseDraft(current => ({ ...current, notes: event.target.value }))} />
        </label>
        <div className="crm-form-actions">
          <button type="button" className="primary-btn" onClick={() => void handleAddPurchase()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>
      </div>

      <div className="usage-lines">
        <h4>Purchase History ({purchases.length})</h4>
        {purchases.length === 0 ? (
          <p className="panel-placeholder">No purchase entries yet.</p>
        ) : (
          <div className="activity-list">
            {purchases.map(item => (
              <article key={item.id}>
                <p>
                  <strong>{item.referenceNo ?? `Purchase #${item.id}`}</strong>
                  {' • '}
                  {formatDate(item.purchaseDate ?? item.createdAtUtc)}
                </p>
                <p>{item.description ?? '-'}</p>
                <p>{formatCurrency(item.totalAmount ?? 0)}</p>
                {item.notes ? <p>{item.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  ) : (
    <p className="panel-placeholder">No supplier detail found for this record.</p>
  )

  const listCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Supplier Directory</h3>
          <p>{totalCount.toLocaleString()} suppliers loaded</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setIsCreating(current => !current)}>
          <Plus size={14} />
          {isCreating ? 'Cancel' : 'New Supplier'}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {isCreating ? (
        <div className="crm-form-grid">
          <label>
            Supplier Name
            <input value={supplierDraft.name} onChange={event => setSupplierDraft(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Contact Name
            <input value={supplierDraft.contactName} onChange={event => setSupplierDraft(current => ({ ...current, contactName: event.target.value }))} />
          </label>
          <label>
            Email
            <input value={supplierDraft.email} onChange={event => setSupplierDraft(current => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Phone
            <input value={supplierDraft.phone} onChange={event => setSupplierDraft(current => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Tax ID
            <input value={supplierDraft.taxId} onChange={event => setSupplierDraft(current => ({ ...current, taxId: event.target.value }))} />
          </label>
          <label className="crm-form-span">
            Address
            <input value={supplierDraft.address} onChange={event => setSupplierDraft(current => ({ ...current, address: event.target.value }))} />
          </label>
          <label className="crm-form-span">
            Notes
            <textarea rows={3} value={supplierDraft.notes} onChange={event => setSupplierDraft(current => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="crm-form-actions crm-form-span">
            <button type="button" className="secondary-btn" onClick={() => setSupplierDraft(EMPTY_SUPPLIER_DRAFT)} disabled={isSaving}>
              Reset
            </button>
            <button type="button" className="primary-btn" onClick={() => void handleCreateSupplier()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Create Supplier'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="single-row-filter filter-grid">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search supplier, contact, email, or phone"
        />
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading suppliers...</p>
      ) : (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Total Purchased</th>
                <th>Entries</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(supplier => (
                <tr key={supplier.id} onClick={() => openDetail(supplier.id)}>
                  <td>{supplier.name}</td>
                  <td>{supplier.contactName ?? '-'}</td>
                  <td>{supplier.phone ?? '-'}</td>
                  <td>{formatCurrency(supplier.totalPurchasedAmount)}</td>
                  <td>{supplier.purchaseCount}</td>
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
            <h3>Supplier Detail</h3>
            <p>Full page supplier profile and purchase history.</p>
          </div>
          <div className="detail-actions-row">
            <button type="button" className="icon-btn" onClick={closeFull} aria-label="Back to split view" title="Back to split view">
              <ArrowLeft size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={closeDetail} aria-label="Close detail view" title="Close detail view">
              <X size={18} />
            </button>
          </div>
        </div>
        {detailContent}
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
            <h3>Supplier Detail</h3>
            <div className="detail-actions-row">
              <button type="button" className="icon-btn" onClick={openFull} aria-label="Open full screen" title="Open full screen">
                <Expand size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={closeDetail} aria-label="Close detail panel" title="Close detail panel">
                <X size={18} />
              </button>
            </div>
          </div>
          {detailContent}
        </aside>
      ) : null}
    </div>
  )
}
