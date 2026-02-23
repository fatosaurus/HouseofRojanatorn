import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlatformActivity } from '../../api/client'
import type { PlatformActivityLog } from '../../api/types'

const PAGE_SIZE = 120

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

function titleCase(value: string): string {
  if (!value) {
    return '-'
  }

  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function HistoryPanel() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [records, setRecords] = useState<PlatformActivityLog[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPage(currentSearch: string, currentCategory: string) {
    setIsLoading(true)
    setError(null)

    try {
      const page = await getPlatformActivity({
        search: currentSearch,
        category: currentCategory,
        limit: PAGE_SIZE,
        offset: 0
      })

      setRecords(page.items)
      setTotalCount(page.totalCount)
      setOffset(page.items.length)
    } catch {
      setError('Unable to load platform activity.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPage(search, category)
  }, [search, category])

  async function loadMore() {
    if (isLoading || isLoadingMore || records.length >= totalCount) {
      return
    }

    setIsLoadingMore(true)
    setError(null)

    try {
      const page = await getPlatformActivity({
        search,
        category,
        limit: PAGE_SIZE,
        offset
      })

      setRecords(current => [...current, ...page.items])
      setTotalCount(page.totalCount)
      setOffset(current => current + page.items.length)
    } catch {
      setError('Unable to load more activity entries.')
    } finally {
      setIsLoadingMore(false)
    }
  }

  function openActivity(item: PlatformActivityLog) {
    if (!item.route) {
      return
    }

    navigate(item.route)
  }

  return (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Platform Activity</h3>
          <p>{totalCount.toLocaleString()} actions captured across manufacturing, customers, sales, and inventory.</p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="filter-grid">
        <input
          placeholder="Search action, code, actor"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <select value={category} onChange={event => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="sales">Sales</option>
          <option value="customers">Customers</option>
          <option value="inventory">Inventory</option>
          <option value="usage">Usage</option>
        </select>
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading activity feed...</p>
      ) : records.length === 0 ? (
        <p className="panel-placeholder">No activity records found for this filter.</p>
      ) : (
        <>
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Reference</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item, index) => (
                  <tr
                    key={`${item.eventType}-${item.eventAtUtc}-${index}`}
                    onClick={() => openActivity(item)}
                    style={{ cursor: item.route ? 'pointer' : 'default' }}
                  >
                    <td>{formatDate(item.eventAtUtc)}</td>
                    <td>{titleCase(item.category)}</td>
                    <td>
                      <strong>{item.title}</strong>
                      {item.description ? <p className="inline-subtext">{item.description}</p> : null}
                    </td>
                    <td>{item.referenceCode ?? '-'}</td>
                    <td>{item.actorName ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <p>
              Showing
              {' '}
              {records.length.toLocaleString()}
              {' '}
              of
              {' '}
              {totalCount.toLocaleString()}
              {' '}
              events
            </p>
            {records.length < totalCount ? (
              <button type="button" className="secondary-btn" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'See more'}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
