import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getManufacturingProject, getManufacturingProjects } from '../../api/client'
import type { ManufacturingProjectDetail, ManufacturingProjectSummary } from '../../api/types'

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

function labelize(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parsePurchasesRoute(pathname: string): { detailId: number | null, isFull: boolean, isInvalid: boolean } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'purchases') {
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

  const detailId = Number(detailSegment)
  if (!Number.isInteger(detailId) || detailId <= 0) {
    return { detailId: null, isFull: false, isInvalid: true }
  }

  if (fullSegment && fullSegment !== 'full') {
    return { detailId, isFull: false, isInvalid: true }
  }

  return {
    detailId,
    isFull: fullSegment === 'full',
    isInvalid: parts.length > 4
  }
}

function PurchaseDetailContent({ detail }: { detail: ManufacturingProjectDetail }) {
  return (
    <>
      <div className="drawer-grid">
        <p><strong>Code:</strong> {detail.manufacturingCode}</p>
        <p><strong>Piece:</strong> {detail.pieceName}</p>
        <p><strong>Type:</strong> {labelize(detail.pieceType)}</p>
        <p><strong>Status:</strong> {labelize(detail.status)}</p>
        <p><strong>Customer:</strong> {detail.customerName ?? '-'}</p>
        <p><strong>Sold At:</strong> {formatDate(detail.soldAt)}</p>
        <p><strong>Designer:</strong> {detail.designerName ?? '-'}</p>
        <p><strong>Craftsman:</strong> {detail.craftsmanName ?? '-'}</p>
        <p><strong>Selling Price:</strong> {formatCurrency(detail.sellingPrice)}</p>
        <p><strong>Total Cost:</strong> {formatCurrency(detail.totalCost)}</p>
        <p><strong>Gemstone Cost:</strong> {formatCurrency(detail.gemstoneCost)}</p>
        <p><strong>Completion Date:</strong> {formatDate(detail.completionDate)}</p>
      </div>

      {detail.usageNotes ? (
        <div className="usage-lines">
          <h4>Notes</h4>
          <p>{detail.usageNotes}</p>
        </div>
      ) : null}

      <div className="usage-lines">
        <h4>Gemstones ({detail.gemstones.length})</h4>
        {detail.gemstones.length === 0 ? (
          <p className="panel-placeholder">No gemstones linked to this record.</p>
        ) : (
          <div className="activity-list">
            {detail.gemstones.map(gem => (
              <article key={gem.id}>
                <p>
                  <strong>{gem.gemstoneCode ?? `#${gem.inventoryItemId ?? '?'}`}</strong>
                  {' • '}
                  {gem.gemstoneType ?? 'Unknown'}
                </p>
                <p>{gem.weightUsedCt} ct / {gem.piecesUsed} pcs</p>
                <p>{formatCurrency(gem.lineCost)}</p>
                {gem.notes ? <p>{gem.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="usage-lines">
        <h4>Activity Log ({detail.activityLog.length})</h4>
        {detail.activityLog.length === 0 ? (
          <p className="panel-placeholder">No activity entries found.</p>
        ) : (
          <div className="activity-list">
            {detail.activityLog.map(entry => (
              <article key={entry.id}>
                <p>
                  <strong>{labelize(entry.status)}</strong>
                  {' • '}
                  {formatDate(entry.activityAtUtc)}
                </p>
                {entry.notes ? <p>{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function PurchasesPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parsePurchasesRoute(location.pathname), [location.pathname])

  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<ManufacturingProjectSummary[]>([])
  const [selectedDetail, setSelectedDetail] = useState<ManufacturingProjectDetail | null>(null)

  function beginListLoad() {
    setIsLoading(true)
    setError(null)
  }

  function resetDetailState() {
    setSelectedDetail(null)
    setIsLoadingDetail(false)
  }

  function beginDetailLoad() {
    setIsLoadingDetail(true)
    setError(null)
  }

  useEffect(() => {
    if (route.isInvalid) {
      navigate('/dashboard/purchases', { replace: true })
    }
  }, [navigate, route.isInvalid])

  useEffect(() => {
    let cancelled = false

    beginListLoad()

    void getManufacturingProjects({
      status: 'sold',
      search,
      limit: 150,
      offset: 0
    })
      .then(page => {
        if (!cancelled) {
          setRecords(page.items)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load sold purchases.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [search])

  useEffect(() => {
    if (!route.detailId) {
      resetDetailState()
      return
    }

    let cancelled = false
    beginDetailLoad()

    void getManufacturingProject(route.detailId)
      .then(detail => {
        if (!cancelled) {
          setSelectedDetail(detail)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load selected purchase details.')
          setSelectedDetail(null)
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

  const totals = useMemo(() => {
    const revenue = records.reduce((sum, record) => sum + record.sellingPrice, 0)
    const cost = records.reduce((sum, record) => sum + record.totalCost, 0)
    const profit = revenue - cost
    const avg = records.length > 0 ? revenue / records.length : 0

    return { revenue, profit, avg }
  }, [records])

  function openDetail(projectId: number) {
    navigate(`/dashboard/purchases/${projectId}`)
  }

  function closeDetail() {
    resetDetailState()
    navigate('/dashboard/purchases')
  }

  function openFullDetail() {
    if (!route.detailId) {
      return
    }

    navigate(`/dashboard/purchases/${route.detailId}/full`)
  }

  function closeFullDetail() {
    if (!route.detailId) {
      navigate('/dashboard/purchases')
      return
    }

    navigate(`/dashboard/purchases/${route.detailId}`)
  }

  const listCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Purchase History</h3>
          <p>{records.length.toLocaleString()} completed sold transactions</p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="stats-grid compact-stats">
        <article>
          <h3>Total Revenue</h3>
          <strong>{formatCurrency(totals.revenue)}</strong>
        </article>
        <article>
          <h3>Total Profit</h3>
          <strong>{formatCurrency(totals.profit)}</strong>
        </article>
        <article>
          <h3>Average Sale</h3>
          <strong>{formatCurrency(totals.avg)}</strong>
        </article>
        <article>
          <h3>Transactions</h3>
          <strong>{records.length}</strong>
        </article>
      </section>

      <div className="filter-grid single-row-filter">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by customer, code, piece name" />
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading sold transactions...</p>
      ) : (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Piece</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Sold Date</th>
                <th>Sale Price</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} onClick={() => openDetail(record.id)}>
                  <td>{record.manufacturingCode}</td>
                  <td>{record.pieceName}</td>
                  <td>{labelize(record.pieceType)}</td>
                  <td>{record.customerName ?? '-'}</td>
                  <td>{formatDate(record.soldAt)}</td>
                  <td>{formatCurrency(record.sellingPrice)}</td>
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
            <h3>Purchase Details</h3>
            <p>Full page detail view for a sold manufacturing project.</p>
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
          <p className="panel-placeholder">Loading purchase details...</p>
        ) : selectedDetail ? (
          <PurchaseDetailContent detail={selectedDetail} />
        ) : (
          <p className="panel-placeholder">No purchase detail found for this route.</p>
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
            <h3>Purchase Detail</h3>
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
            <p className="panel-placeholder">Loading purchase details...</p>
          ) : selectedDetail ? (
            <PurchaseDetailContent detail={selectedDetail} />
          ) : (
            <p className="panel-placeholder">No purchase detail found for this record.</p>
          )}
        </aside>
      ) : null}
    </div>
  )
}
