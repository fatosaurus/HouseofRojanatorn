import { useEffect, useMemo, useState } from 'react'
import { getInventoryItem, getInventoryItems, getInventorySummary, getUsageBatch, getUsageBatches } from '../api/client'
import type { InventoryItem, InventorySummary, UsageBatch, UsageBatchDetail } from '../api/types'
import { useSession } from '../app/useSession'

type DashboardTab = 'inventory' | 'usage'

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
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

function categoryLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function DashboardPage() {
  const { email, role, signOut } = useSession()
  const [activeTab, setActiveTab] = useState<DashboardTab>('inventory')

  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventoryTotal, setInventoryTotal] = useState(0)
  const [usageBatches, setUsageBatches] = useState<UsageBatch[]>([])
  const [usageTotal, setUsageTotal] = useState(0)

  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryType, setInventoryType] = useState('all')
  const [inventoryStatus, setInventoryStatus] = useState('all')
  const [usageSearch, setUsageSearch] = useState('')
  const [usageCategory, setUsageCategory] = useState('all')

  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null)
  const [selectedUsageBatch, setSelectedUsageBatch] = useState<UsageBatchDetail | null>(null)

  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [isLoadingInventory, setIsLoadingInventory] = useState(true)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoadingSummary(true)
    void getInventorySummary()
      .then(result => {
        if (!cancelled) {
          setSummary(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Unable to load inventory summary.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSummary(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoadingInventory(true)
    void getInventoryItems({
      search: inventorySearch,
      type: inventoryType,
      status: inventoryStatus,
      limit: 120,
      offset: 0
    })
      .then(result => {
        if (!cancelled) {
          setInventory(result.items)
          setInventoryTotal(result.totalCount)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Unable to load inventory records.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingInventory(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [inventorySearch, inventoryStatus, inventoryType])

  useEffect(() => {
    let cancelled = false
    setIsLoadingUsage(true)
    void getUsageBatches({
      search: usageSearch,
      category: usageCategory,
      limit: 120,
      offset: 0
    })
      .then(result => {
        if (!cancelled) {
          setUsageBatches(result.items)
          setUsageTotal(result.totalCount)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Unable to load usage history.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingUsage(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [usageCategory, usageSearch])

  async function openInventoryDetail(itemId: number) {
    try {
      const detail = await getInventoryItem(itemId)
      setSelectedInventory(detail)
    } catch {
      setErrorMessage('Unable to load selected inventory item.')
    }
  }

  async function openUsageDetail(batchId: number) {
    try {
      const detail = await getUsageBatch(batchId)
      setSelectedUsageBatch(detail)
    } catch {
      setErrorMessage('Unable to load selected usage batch.')
    }
  }

  const uniqueGemTypes = useMemo(() => {
    const values = new Set<string>()
    for (const item of inventory) {
      if (item.gemstoneType) {
        values.add(item.gemstoneType)
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b))
  }, [inventory])

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand-mark">
          <span className="brand-dot" />
          <div>
            <h1>House of Rojanatorn</h1>
            <p>Gem Inventory Suite</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className={activeTab === 'inventory' ? 'active' : ''} onClick={() => setActiveTab('inventory')}>
            Gemstones
          </button>
          <button type="button" className={activeTab === 'usage' ? 'active' : ''} onClick={() => setActiveTab('usage')}>
            Usage History
          </button>
        </nav>

        <section className="sidebar-user">
          <p>{email}</p>
          <span>{role.toUpperCase()}</span>
        </section>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h2>Operations Dashboard</h2>
            <p>Mapped from real 2026 stock workbook and Azure SQL data.</p>
          </div>
          <button type="button" className="secondary-btn" onClick={signOut}>
            Sign Out
          </button>
        </header>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <section className="stats-grid">
          <article>
            <h3>Total Gem Entries</h3>
            <strong>{isLoadingSummary ? '...' : (summary?.totalItems ?? 0).toLocaleString()}</strong>
          </article>
          <article>
            <h3>Low Stock</h3>
            <strong>{isLoadingSummary ? '...' : (summary?.lowStockItems ?? 0).toLocaleString()}</strong>
          </article>
          <article>
            <h3>Total Carats</h3>
            <strong>{isLoadingSummary ? '...' : (summary?.totalBalanceCarats ?? 0).toFixed(2)}</strong>
          </article>
          <article>
            <h3>Est. Value</h3>
            <strong>{isLoadingSummary ? '...' : formatCurrency(summary?.estimatedInventoryValue ?? 0)}</strong>
          </article>
        </section>

        {activeTab === 'inventory' ? (
          <section className="content-card">
            <div className="card-head">
              <div>
                <h3>Gemstone Inventory</h3>
                <p>{inventoryTotal.toLocaleString()} records loaded from Azure SQL</p>
              </div>
              <div className="filter-grid">
                <input
                  placeholder="Search type, shape, owner, or code"
                  value={inventorySearch}
                  onChange={event => setInventorySearch(event.target.value)}
                />
                <select value={inventoryType} onChange={event => setInventoryType(event.target.value)}>
                  <option value="all">All types</option>
                  {uniqueGemTypes.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select value={inventoryStatus} onChange={event => setInventoryStatus(event.target.value)}>
                  <option value="all">All status</option>
                  <option value="available">Available</option>
                  <option value="low-stock">Low stock</option>
                  <option value="out-of-stock">Out of stock</option>
                </select>
              </div>
            </div>

            {isLoadingInventory ? (
              <p className="panel-placeholder">Loading inventory data...</p>
            ) : (
              <div className="inventory-grid">
                {inventory.map(item => {
                  const statusClass =
                    item.effectiveBalanceCt > 1 || item.effectiveBalancePcs > 10
                      ? 'ok'
                      : item.effectiveBalanceCt > 0 || item.effectiveBalancePcs > 0
                        ? 'low'
                        : 'out'

                  return (
                    <button key={item.id} type="button" className="inventory-card" onClick={() => void openInventoryDetail(item.id)}>
                      <div className="inventory-title-row">
                        <h4>
                          #{item.gemstoneNumber ?? item.gemstoneNumberText ?? item.id}
                          {' '}
                          {item.gemstoneType ?? 'Unknown gemstone'}
                        </h4>
                        <span className={`stock-pill ${statusClass}`}>
                          {statusClass === 'ok' ? 'Available' : statusClass === 'low' ? 'Low' : 'Out'}
                        </span>
                      </div>
                      <p>{item.shape ?? 'Shape N/A'}</p>
                      <dl>
                        <div>
                          <dt>Balance</dt>
                          <dd>
                            {(item.effectiveBalanceCt ?? 0).toFixed(2)}
                            ct /
                            {' '}
                            {(item.effectiveBalancePcs ?? 0).toFixed(0)}
                            pcs
                          </dd>
                        </div>
                        <div>
                          <dt>Owner</dt>
                          <dd>{item.ownerName ?? '-'}</dd>
                        </div>
                        <div>
                          <dt>Buying Date</dt>
                          <dd>{formatDate(item.buyingDate)}</dd>
                        </div>
                      </dl>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="content-card">
            <div className="card-head">
              <div>
                <h3>Product Usage History</h3>
                <p>{usageTotal.toLocaleString()} usage batches loaded</p>
              </div>
              <div className="filter-grid">
                <input placeholder="Search requester or product code" value={usageSearch} onChange={event => setUsageSearch(event.target.value)} />
                <select value={usageCategory} onChange={event => setUsageCategory(event.target.value)}>
                  <option value="all">All categories</option>
                  <option value="earrings">Earrings</option>
                  <option value="necklace">Necklace</option>
                  <option value="bracelet">Bracelet</option>
                  <option value="brooch">Brooch</option>
                  <option value="clips_cufflinks">Clips & Cufflinks</option>
                  <option value="ring">Ring</option>
                </select>
              </div>
            </div>

            {isLoadingUsage ? (
              <p className="panel-placeholder">Loading usage batches...</p>
            ) : (
              <div className="usage-table-wrap">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Product Code</th>
                      <th>Requester</th>
                      <th>Total</th>
                      <th>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageBatches.map(batch => (
                      <tr key={batch.id} onClick={() => void openUsageDetail(batch.id)}>
                        <td>{categoryLabel(batch.productCategory)}</td>
                        <td>{formatDate(batch.transactionDate)}</td>
                        <td>{batch.productCode ?? '-'}</td>
                        <td>{batch.requesterName ?? '-'}</td>
                        <td>{formatCurrency(batch.totalAmount)}</td>
                        <td>{batch.lineCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {selectedInventory ? (
          <section className="detail-drawer">
            <div className="drawer-head">
              <h3>Gemstone Detail</h3>
              <button type="button" className="secondary-btn" onClick={() => setSelectedInventory(null)}>
                Close
              </button>
            </div>
            <div className="drawer-grid">
              <p><strong>Code:</strong> {selectedInventory.gemstoneNumber ?? selectedInventory.gemstoneNumberText ?? '-'}</p>
              <p><strong>Type:</strong> {selectedInventory.gemstoneType ?? '-'}</p>
              <p><strong>Shape:</strong> {selectedInventory.shape ?? '-'}</p>
              <p><strong>Weight/PCS Raw:</strong> {selectedInventory.weightPcsRaw ?? '-'}</p>
              <p><strong>Price/CT Raw:</strong> {selectedInventory.pricePerCtRaw ?? '-'}</p>
              <p><strong>Price/PC Raw:</strong> {selectedInventory.pricePerPieceRaw ?? '-'}</p>
              <p><strong>Buying Date:</strong> {formatDate(selectedInventory.buyingDate)}</p>
              <p><strong>Owner:</strong> {selectedInventory.ownerName ?? '-'}</p>
            </div>
          </section>
        ) : null}

        {selectedUsageBatch ? (
          <section className="detail-drawer">
            <div className="drawer-head">
              <h3>Usage Batch Detail</h3>
              <button type="button" className="secondary-btn" onClick={() => setSelectedUsageBatch(null)}>
                Close
              </button>
            </div>
            <div className="drawer-grid">
              <p><strong>Category:</strong> {categoryLabel(selectedUsageBatch.productCategory)}</p>
              <p><strong>Date:</strong> {formatDate(selectedUsageBatch.transactionDate)}</p>
              <p><strong>Product Code:</strong> {selectedUsageBatch.productCode ?? '-'}</p>
              <p><strong>Requester:</strong> {selectedUsageBatch.requesterName ?? '-'}</p>
              <p><strong>Total:</strong> {formatCurrency(selectedUsageBatch.totalAmount)}</p>
              <p><strong>Source:</strong> {selectedUsageBatch.sourceSheet} row {selectedUsageBatch.sourceRow ?? '-'}</p>
            </div>
            <div className="usage-lines">
              <h4>Gem Usage Lines</h4>
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Gem #</th>
                    <th>Name</th>
                    <th>Used PCS</th>
                    <th>Used CT</th>
                    <th>Line Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUsageBatch.lines.map(line => (
                    <tr key={line.id}>
                      <td>{line.gemstoneNumber ?? '-'}</td>
                      <td>{line.gemstoneName ?? '-'}</td>
                      <td>{line.usedPcs ?? '-'}</td>
                      <td>{line.usedWeightCt ?? '-'}</td>
                      <td>{formatCurrency(line.lineAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
