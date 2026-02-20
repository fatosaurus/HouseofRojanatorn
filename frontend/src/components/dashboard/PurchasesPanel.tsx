import { useEffect, useMemo, useState } from 'react'
import { getManufacturingProjects } from '../../api/client'
import type { ManufacturingProjectSummary } from '../../api/types'

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

export function PurchasesPanel() {
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<ManufacturingProjectSummary[]>([])

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    setError(null)

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

  const totals = useMemo(() => {
    const revenue = records.reduce((sum, record) => sum + record.sellingPrice, 0)
    const cost = records.reduce((sum, record) => sum + record.totalCost, 0)
    const profit = revenue - cost
    const avg = records.length > 0 ? revenue / records.length : 0

    return { revenue, profit, avg }
  }, [records])

  return (
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
                <tr key={record.id}>
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
}
