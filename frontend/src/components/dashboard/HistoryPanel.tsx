import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getPlatformActivity } from '../../api/client'
import type { PlatformActivityLog } from '../../api/types'
import { usePagedSelection } from '../common/usePagedSelection'

const PAGE_SIZE = 5000

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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activityCollection = usePagedSelection({
    items: records,
    getId: item => `${item.eventType}-${item.eventAtUtc}-${item.referenceCode ?? ''}`,
    initialPageSize: 10
  })

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
    } catch {
      setError('Unable to load platform activity.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPage(search, category)
  }, [search, category])

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

      <div className="table-controls-row">
        <div className="auth-mode-row table-view-switch">
          <button type="button" className={activityCollection.viewMode === 'table' ? 'active' : ''} onClick={() => activityCollection.setViewMode('table')}>Table</button>
          <button type="button" className={activityCollection.viewMode === 'grid' ? 'active' : ''} onClick={() => activityCollection.setViewMode('grid')}>Grid</button>
        </div>
        <div className="table-pagination-inline">
          <span>{activityCollection.selectedCount} selected</span>
          <select value={activityCollection.pageSize} onChange={event => activityCollection.setPageSize(Number(event.target.value))}>
            <option value={10}>10 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <button type="button" className="icon-btn" onClick={() => activityCollection.setPage(current => Math.max(1, current - 1))} disabled={activityCollection.page <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span>{activityCollection.page}/{activityCollection.totalPages}</span>
          <button type="button" className="icon-btn" onClick={() => activityCollection.setPage(current => Math.min(activityCollection.totalPages, current + 1))} disabled={activityCollection.page >= activityCollection.totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading activity feed...</p>
      ) : records.length === 0 ? (
        <p className="panel-placeholder">No activity records found for this filter.</p>
      ) : activityCollection.viewMode === 'grid' ? (
        <div className="table-card-grid">
          {activityCollection.pageItems.map((item, index) => (
            <article
              key={`${item.eventType}-${item.eventAtUtc}-${index}`}
              className="table-card"
              onClick={() => openActivity(item)}
            >
              <label className="table-row-checkbox" onClick={event => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={activityCollection.selectedIds.has(`${item.eventType}-${item.eventAtUtc}-${item.referenceCode ?? ''}`)}
                  onChange={() => activityCollection.toggleRowSelection(`${item.eventType}-${item.eventAtUtc}-${item.referenceCode ?? ''}`)}
                />
              </label>
              <h4>{item.title}</h4>
              <p>{titleCase(item.category)}</p>
              <p>{item.description ?? '-'}</p>
              <p>{formatDate(item.eventAtUtc)}</p>
            </article>
          ))}
        </div>
      ) : (
        <>
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={activityCollection.isPageSelected}
                      ref={element => {
                        if (element) {
                          element.indeterminate = activityCollection.isPagePartiallySelected
                        }
                      }}
                      onChange={() => activityCollection.togglePageSelection()}
                    />
                  </th>
                  <th>When</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Reference</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {activityCollection.pageItems.map((item, index) => (
                  <tr
                    key={`${item.eventType}-${item.eventAtUtc}-${index}`}
                    onClick={() => openActivity(item)}
                    style={{ cursor: item.route ? 'pointer' : 'default' }}
                  >
                    <td onClick={event => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={activityCollection.selectedIds.has(`${item.eventType}-${item.eventAtUtc}-${item.referenceCode ?? ''}`)}
                        onChange={() => activityCollection.toggleRowSelection(`${item.eventType}-${item.eventAtUtc}-${item.referenceCode ?? ''}`)}
                      />
                    </td>
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
              {activityCollection.pageItems.length.toLocaleString()}
              {' '}
              of
              {' '}
              {totalCount.toLocaleString()}
              {' '}
              events
            </p>
          </div>
        </>
      )}
    </section>
  )
}
