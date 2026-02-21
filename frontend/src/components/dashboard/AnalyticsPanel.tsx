import { useEffect, useState } from 'react'
import { getAnalyticsOverview } from '../../api/client'
import type { AnalyticsOverview } from '../../api/types'

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

        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Revenue</th>
                <th>Customers</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {analytics.monthlyRevenue.map(point => (
                <tr key={point.month}>
                  <td>{point.month}</td>
                  <td>{formatCurrency(point.revenue)}</td>
                  <td>{point.customers}</td>
                  <td>{point.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
