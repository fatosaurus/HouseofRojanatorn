import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getAnalyticsOverview } from '../../api/client'
import type { AnalyticsOverview } from '../../api/types'
import { usePagedSelection } from '../common/usePagedSelection'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value)
}

function formatDate(raw: string): string {
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function AnalyticsPanel() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [monthlySearch, setMonthlySearch] = useState('')
  const [volumeFilter, setVolumeFilter] = useState<'all' | 'high-revenue' | 'high-orders'>('all')

  useEffect(() => {
    let cancelled = false

    void getAnalyticsOverview()
      .then(result => {
        if (!cancelled) {
          setAnalytics(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load analytics overview.')
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
  }, [])

  if (isLoading) {
    return (
      <section className="content-card">
        <p className="panel-placeholder">Loading analytics...</p>
      </section>
    )
  }

  if (error || !analytics) {
    return (
      <section className="content-card">
        <p className="error-banner">{error ?? 'Analytics data unavailable.'}</p>
      </section>
    )
  }

  const filteredMonthly = useMemo(() => {
    const lookup = monthlySearch.trim().toLowerCase()
    return analytics.monthlyRevenue.filter(point => {
      if (lookup && !point.month.toLowerCase().includes(lookup)) {
        return false
      }
      if (volumeFilter === 'high-revenue') {
        return point.revenue >= 100000
      }
      if (volumeFilter === 'high-orders') {
        return point.orders >= 10
      }
      return true
    })
  }, [analytics.monthlyRevenue, monthlySearch, volumeFilter])

  const monthlyCollection = usePagedSelection({
    items: filteredMonthly,
    getId: item => item.month,
    initialPageSize: 10
  })

  return (
    <>
      <section className="stats-grid">
        <article>
          <h3>This Month Revenue</h3>
          <strong>{formatCurrency(analytics.currentMonth.revenue)}</strong>
        </article>
        <article>
          <h3>This Month Sales</h3>
          <strong>{analytics.currentMonth.transactions}</strong>
        </article>
        <article>
          <h3>Total Customers</h3>
          <strong>{analytics.totals.customers}</strong>
        </article>
        <article>
          <h3>Average Order Value</h3>
          <strong>{formatCurrency(analytics.totals.avgOrderValue)}</strong>
        </article>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <h3>Revenue Trend (Last 6 Months)</h3>
            <p>Monthly aggregate based on sold manufacturing records.</p>
          </div>
        </div>

        <div className="filter-grid">
          <input value={monthlySearch} onChange={event => setMonthlySearch(event.target.value)} placeholder="Search month" />
          <select value={volumeFilter} onChange={event => setVolumeFilter(event.target.value as 'all' | 'high-revenue' | 'high-orders')}>
            <option value="all">All months</option>
            <option value="high-revenue">High revenue</option>
            <option value="high-orders">High orders</option>
          </select>
        </div>

        <div className="table-controls-row">
          <div className="auth-mode-row table-view-switch">
            <button type="button" className={monthlyCollection.viewMode === 'table' ? 'active' : ''} onClick={() => monthlyCollection.setViewMode('table')}>Table</button>
            <button type="button" className={monthlyCollection.viewMode === 'grid' ? 'active' : ''} onClick={() => monthlyCollection.setViewMode('grid')}>Grid</button>
          </div>
          <div className="table-pagination-inline">
            <span>{monthlyCollection.selectedCount} selected</span>
            <select value={monthlyCollection.pageSize} onChange={event => monthlyCollection.setPageSize(Number(event.target.value))}>
              <option value={10}>10 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <button type="button" className="icon-btn" onClick={() => monthlyCollection.setPage(current => Math.max(1, current - 1))} disabled={monthlyCollection.page <= 1}>
              <ChevronLeft size={16} />
            </button>
            <span>{monthlyCollection.page}/{monthlyCollection.totalPages}</span>
            <button type="button" className="icon-btn" onClick={() => monthlyCollection.setPage(current => Math.min(monthlyCollection.totalPages, current + 1))} disabled={monthlyCollection.page >= monthlyCollection.totalPages}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {monthlyCollection.pageItems.length === 0 ? (
          <p className="panel-placeholder">No monthly records found for this filter.</p>
        ) : monthlyCollection.viewMode === 'grid' ? (
          <div className="table-card-grid">
            {monthlyCollection.pageItems.map(point => (
              <article key={point.month} className="table-card">
                <label className="table-row-checkbox" onClick={event => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={monthlyCollection.selectedIds.has(point.month)}
                    onChange={() => monthlyCollection.toggleRowSelection(point.month)}
                  />
                </label>
                <h4>{point.month}</h4>
                <p className="accent-value">{formatCurrency(point.revenue)}</p>
                <p>{point.customers} customers</p>
                <p>{point.orders} orders</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={monthlyCollection.isPageSelected}
                      ref={element => {
                        if (element) {
                          element.indeterminate = monthlyCollection.isPagePartiallySelected
                        }
                      }}
                      onChange={() => monthlyCollection.togglePageSelection()}
                    />
                  </th>
                  <th>Month</th>
                  <th>Revenue</th>
                  <th>Customers</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {monthlyCollection.pageItems.map(point => (
                  <tr key={point.month}>
                    <td onClick={event => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={monthlyCollection.selectedIds.has(point.month)}
                        onChange={() => monthlyCollection.toggleRowSelection(point.month)}
                      />
                    </td>
                    <td>{point.month}</td>
                    <td>{formatCurrency(point.revenue)}</td>
                    <td>{point.customers}</td>
                    <td>{point.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <h3>Top Customers</h3>
            <p>Highest lifetime purchase value.</p>
          </div>
        </div>

        {analytics.topCustomers.length === 0 ? (
          <p className="panel-placeholder">No sold customer data yet.</p>
        ) : (
          <div className="activity-list">
            {analytics.topCustomers.map(customer => (
              <article key={customer.customerId}>
                <p>
                  <strong>{customer.customerName}</strong>
                  {' • '}
                  {customer.purchases} purchases
                </p>
                <p>{formatCurrency(customer.totalSpent)}</p>
                <p>Last purchase: {formatDate(customer.lastPurchaseUtc)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
