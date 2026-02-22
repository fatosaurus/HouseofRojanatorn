import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, Expand, Factory, Gem, History, LogOut, Settings, ShoppingBag, UserCog, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getInventoryItem, getInventoryItems, getInventorySummary, getUsageBatches } from '../api/client'
import type { InventoryItem, InventoryItemDetail, InventorySummary } from '../api/types'
import { useSession } from '../app/useSession'
import { AnalyticsPanel } from '../components/dashboard/AnalyticsPanel'
import { CustomersPanel } from '../components/dashboard/CustomersPanel'
import { ManufacturingPanel } from '../components/dashboard/ManufacturingPanel'
import { PurchasesPanel } from '../components/dashboard/PurchasesPanel'
import { SettingsPanel } from '../components/dashboard/SettingsPanel'
import { UsersPanel } from '../components/dashboard/UsersPanel'

type DashboardTab = 'customers' | 'purchases' | 'inventory' | 'manufacturing' | 'history' | 'analytics' | 'users' | 'settings'
const INVENTORY_PAGE_SIZE = 50

const DASHBOARD_TABS: DashboardTab[] = [
  'customers',
  'purchases',
  'inventory',
  'manufacturing',
  'history',
  'analytics',
  'users',
  'settings'
]

const SIDEBAR_ITEMS: Array<{ tab: DashboardTab, label: string, Icon: LucideIcon }> = [
  { tab: 'customers', label: 'Customers', Icon: Users },
  { tab: 'purchases', label: 'Purchases', Icon: ShoppingBag },
  { tab: 'inventory', label: 'Gemstones', Icon: Gem },
  { tab: 'manufacturing', label: 'Manufacturing', Icon: Factory },
  { tab: 'history', label: 'History', Icon: History },
  { tab: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { tab: 'users', label: 'Users', Icon: UserCog },
  { tab: 'settings', label: 'Settings', Icon: Settings }
]

function resolveDashboardTab(segment: string | undefined): DashboardTab | null {
  if (!segment) {
    return null
  }

  return DASHBOARD_TABS.includes(segment as DashboardTab)
    ? (segment as DashboardTab)
    : null
}

function parseInventoryRoute(pathname: string): { detailId: number | null, isFull: boolean, isInvalid: boolean } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'inventory') {
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

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return value.toFixed(digits)
}

function InventoryDetailContent({ selectedInventory }: { selectedInventory: InventoryItemDetail }) {
  return (
    <>
      <div className="usage-lines">
        <h4>Details</h4>
        <div className="drawer-grid">
          <p><strong>Inventory ID:</strong> {selectedInventory.id}</p>
          <p><strong>Code:</strong> {selectedInventory.gemstoneNumber ?? selectedInventory.gemstoneNumberText ?? '-'}</p>
          <p><strong>Type:</strong> {selectedInventory.gemstoneType ?? '-'}</p>
          <p><strong>Shape:</strong> {selectedInventory.shape ?? '-'}</p>
          <p><strong>Buying Date:</strong> {formatDate(selectedInventory.buyingDate)}</p>
          <p><strong>Owner:</strong> {selectedInventory.ownerName ?? '-'}</p>
          <p><strong>Raw Weight/PCS:</strong> {selectedInventory.weightPcsRaw ?? '-'}</p>
          <p><strong>Raw Price/CT:</strong> {selectedInventory.pricePerCtRaw ?? '-'}</p>
          <p><strong>Raw Price/PC:</strong> {selectedInventory.pricePerPieceRaw ?? '-'}</p>
          <p><strong>Balance CT:</strong> {formatNumber(selectedInventory.effectiveBalanceCt, 2)}</p>
          <p><strong>Balance PCS:</strong> {formatNumber(selectedInventory.effectiveBalancePcs, 0)}</p>
          <p><strong>Parsed Weight CT:</strong> {formatNumber(selectedInventory.parsedWeightCt, 2)}</p>
          <p><strong>Parsed Qty PCS:</strong> {formatNumber(selectedInventory.parsedQuantityPcs, 0)}</p>
          <p><strong>Parsed Price/CT:</strong> {formatNumber(selectedInventory.parsedPricePerCt, 2)}</p>
          <p><strong>Parsed Price/PC:</strong> {formatNumber(selectedInventory.parsedPricePerPiece, 2)}</p>
        </div>
      </div>

      <div className="usage-lines">
        <h4>
          Manufacturing Activities
          {' '}
          ({selectedInventory.manufacturingActivities.length})
        </h4>
        {selectedInventory.manufacturingActivities.length === 0 ? (
          <p className="panel-placeholder">No manufacturing activity found for this gemstone.</p>
        ) : (
          <div className="activity-list">
            {selectedInventory.manufacturingActivities.map((activity, index) => (
              <article key={`${activity.projectId}-${activity.activityAtUtc ?? 'activity'}-${index}`}>
                <p>
                  <strong>{activity.manufacturingCode}</strong>
                  {' • '}
                  {activity.pieceName}
                </p>
                <p>
                  {activity.status}
                  {' • '}
                  {formatDate(activity.activityAtUtc)}
                </p>
                <p>
                  Used
                  {' '}
                  {formatNumber(activity.piecesUsed, 0)}
                  {' '}
                  pcs /
                  {' '}
                  {formatNumber(activity.weightUsedCt, 2)}
                  {' '}
                  ct
                  {' • '}
                  Line Cost
                  {' '}
                  {formatCurrency(activity.lineCost)}
                </p>
                {activity.craftsmanName ? <p>Craftsman: {activity.craftsmanName}</p> : null}
                {activity.notes ? <p>{activity.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="usage-lines">
        <h4>
          Usage Activities
          {' '}
          ({selectedInventory.usageActivities.length})
        </h4>
        {selectedInventory.usageActivities.length === 0 ? (
          <p className="panel-placeholder">No usage history found for this gemstone.</p>
        ) : (
          <div className="activity-list">
            {selectedInventory.usageActivities.map(activity => (
              <article key={activity.lineId}>
                <p>
                  <strong>{activity.productCode ?? '-'}</strong>
                  {' • '}
                  {activity.productCategory || 'uncategorized'}
                </p>
                <p>
                  {formatDate(activity.transactionDate)}
                  {' • '}
                  {activity.requesterName ?? '-'}
                </p>
                <p>
                  Used
                  {' '}
                  {formatNumber(activity.usedPcs, 0)}
                  {' '}
                  pcs /
                  {' '}
                  {formatNumber(activity.usedWeightCt, 2)}
                  {' '}
                  ct
                </p>
                <p>
                  Line Amount
                  {' '}
                  {formatCurrency(activity.lineAmount)}
                  {' • '}
                  Balance After
                  {' '}
                  {formatNumber(activity.balancePcsAfter, 0)}
                  {' '}
                  pcs /
                  {' '}
                  {formatNumber(activity.balanceCtAfter, 2)}
                  {' '}
                  ct
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function DashboardPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { email, role, signOut } = useSession()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const routeParts = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname])
  const routeTab = useMemo(() => resolveDashboardTab(routeParts[1]), [routeParts])
  const activeTab = routeTab ?? 'customers'
  const inventoryRoute = useMemo(() => parseInventoryRoute(location.pathname), [location.pathname])

  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventoryTotal, setInventoryTotal] = useState(0)
  const [inventoryOffset, setInventoryOffset] = useState(0)
  const [usageTotal, setUsageTotal] = useState(0)

  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryType, setInventoryType] = useState('all')
  const [inventoryStatus, setInventoryStatus] = useState('all')
  const [selectedInventory, setSelectedInventory] = useState<InventoryItemDetail | null>(null)

  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [isLoadingInventory, setIsLoadingInventory] = useState(true)
  const [isLoadingInventoryDetail, setIsLoadingInventoryDetail] = useState(false)
  const [isLoadingMoreInventory, setIsLoadingMoreInventory] = useState(false)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (routeParts[0] !== 'dashboard' || !routeTab) {
      navigate('/dashboard/customers', { replace: true })
    }
  }, [navigate, routeParts, routeTab])

  useEffect(() => {
    if (inventoryRoute.isInvalid) {
      navigate('/dashboard/inventory', { replace: true })
    }
  }, [inventoryRoute.isInvalid, navigate])

  function goToTab(tab: DashboardTab) {
    navigate(`/dashboard/${tab}`)
  }

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
    if (activeTab !== 'inventory') {
      return
    }

    let cancelled = false
    setIsLoadingInventory(true)
    setErrorMessage(null)
    setInventory([])
    setInventoryTotal(0)
    setInventoryOffset(0)

    void getInventoryItems({
      search: inventorySearch,
      type: inventoryType,
      status: inventoryStatus,
      limit: INVENTORY_PAGE_SIZE,
      offset: 0
    })
      .then(result => {
        if (!cancelled) {
          setInventory(result.items)
          setInventoryTotal(result.totalCount)
          setInventoryOffset(result.items.length)
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
  }, [activeTab, inventorySearch, inventoryStatus, inventoryType])

  useEffect(() => {
    if (activeTab !== 'history') {
      return
    }

    let cancelled = false
    setIsLoadingUsage(true)
    void getUsageBatches({
      limit: 1,
      offset: 0
    })
      .then(result => {
        if (!cancelled) {
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
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'inventory' || !inventoryRoute.detailId) {
      setSelectedInventory(null)
      setIsLoadingInventoryDetail(false)
      return
    }

    let cancelled = false
    setIsLoadingInventoryDetail(true)
    setErrorMessage(null)

    void getInventoryItem(inventoryRoute.detailId)
      .then(detail => {
        if (!cancelled) {
          setSelectedInventory(detail)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Unable to load selected inventory item.')
          setSelectedInventory(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingInventoryDetail(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, inventoryRoute.detailId])

  async function loadMoreInventory() {
    if (isLoadingInventory || isLoadingMoreInventory || inventory.length >= inventoryTotal) {
      return
    }

    setIsLoadingMoreInventory(true)
    setErrorMessage(null)

    try {
      const result = await getInventoryItems({
        search: inventorySearch,
        type: inventoryType,
        status: inventoryStatus,
        limit: INVENTORY_PAGE_SIZE,
        offset: inventoryOffset
      })

      setInventory(current => [...current, ...result.items])
      setInventoryTotal(result.totalCount)
      setInventoryOffset(current => current + result.items.length)
    } catch {
      setErrorMessage('Unable to load more inventory records.')
    } finally {
      setIsLoadingMoreInventory(false)
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

  const headerDescription =
    activeTab === 'customers'
      ? 'Customer profiles and relationship notes linked to purchases.'
      : activeTab === 'manufacturing'
        ? 'Production workflow records aligned with the reference prototype.'
        : activeTab === 'users'
          ? 'Invite, activate, and manage platform users and roles.'
          : activeTab === 'settings'
            ? 'Configure production steps and dynamic manufacturing form fields.'
            : activeTab === 'purchases'
              ? 'Sold records derived from manufacturing projects with status = sold.'
              : activeTab === 'analytics'
                ? 'Business metrics generated from sold projects and customer activity.'
                : activeTab === 'history'
                  ? 'Historical import has been migrated into manufacturing records.'
                  : 'Mapped from real 2026 stock workbook and Azure SQL data.'

  function openInventoryDetail(itemId: number) {
    navigate(`/dashboard/inventory/${itemId}`)
  }

  function closeInventoryDetail() {
    navigate('/dashboard/inventory')
  }

  function openInventoryFullDetail() {
    if (!inventoryRoute.detailId) {
      return
    }

    navigate(`/dashboard/inventory/${inventoryRoute.detailId}/full`)
  }

  function closeInventoryFullDetail() {
    if (!inventoryRoute.detailId) {
      navigate('/dashboard/inventory')
      return
    }

    navigate(`/dashboard/inventory/${inventoryRoute.detailId}`)
  }

  const inventoryListCard = (
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
      ) : inventory.length === 0 ? (
        <p className="panel-placeholder">No gemstones match the current filters.</p>
      ) : (
        <>
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>Gem #</th>
                  <th>Type</th>
                  <th>Shape</th>
                  <th>Owner</th>
                  <th>Buying Date</th>
                  <th>Balance (CT)</th>
                  <th>Balance (PCS)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => {
                  const statusClass =
                    item.effectiveBalanceCt > 1 || item.effectiveBalancePcs > 10
                      ? 'ok'
                      : item.effectiveBalanceCt > 0 || item.effectiveBalancePcs > 0
                        ? 'low'
                        : 'out'

                  return (
                    <tr key={item.id} onClick={() => openInventoryDetail(item.id)}>
                      <td>{item.gemstoneNumber ?? item.gemstoneNumberText ?? item.id}</td>
                      <td>{item.gemstoneType ?? '-'}</td>
                      <td>{item.shape ?? '-'}</td>
                      <td>{item.ownerName ?? '-'}</td>
                      <td>{formatDate(item.buyingDate)}</td>
                      <td>{(item.effectiveBalanceCt ?? 0).toFixed(2)}</td>
                      <td>{(item.effectiveBalancePcs ?? 0).toFixed(0)}</td>
                      <td>
                        <span className={`stock-pill ${statusClass}`}>
                          {statusClass === 'ok' ? 'Available' : statusClass === 'low' ? 'Low' : 'Out'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <p>
              Showing
              {' '}
              {inventory.length.toLocaleString()}
              {' '}
              of
              {' '}
              {inventoryTotal.toLocaleString()}
              {' '}
              records
            </p>
            {inventory.length < inventoryTotal ? (
              <button type="button" className="secondary-btn" onClick={() => void loadMoreInventory()} disabled={isLoadingMoreInventory}>
                {isLoadingMoreInventory ? 'Loading...' : 'See more'}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )

  const historyCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>History Moved To Manufacturing</h3>
          <p>Imported records are now treated as manufacturing projects.</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => navigate('/dashboard/manufacturing')}>
          Open Manufacturing
        </button>
      </div>

      <p className="panel-placeholder">
        The old history dataset has been migrated into Manufacturing.
        {' '}
        Click any row in the Manufacturing tab to view full imported details (lines, costs, and notes).
      </p>
      <p className="panel-placeholder">
        Archived raw usage batches currently stored:
        {' '}
        {isLoadingUsage ? '...' : usageTotal.toLocaleString()}
      </p>
    </section>
  )

  return (
    <main className={`dashboard-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="dashboard-sidebar">
        <div className="sidebar-top-row">
          <div className="brand-mark">
            <span className="brand-dot" />
            <div>
              <h1>House of Rojanatorn</h1>
              <p>Gem Inventory Suite</p>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(current => !current)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {SIDEBAR_ITEMS.map(item => (
            <button key={item.tab} type="button" className={activeTab === item.tab ? 'active' : ''} onClick={() => goToTab(item.tab)}>
              <span className="nav-glyph" aria-hidden="true">
                <item.Icon size={16} />
              </span>
              <span className="label-full">{item.label}</span>
            </button>
          ))}
        </nav>

        <section className="sidebar-user">
          <p>{email}</p>
          <span>{role.toUpperCase()}</span>
        </section>

        <button type="button" className="sidebar-signout" onClick={signOut}>
          <span className="nav-glyph" aria-hidden="true"><LogOut size={16} /></span>
          <span className="label-full">Sign Out</span>
        </button>
      </aside>

      <section className="dashboard-main">
        <p className="page-subtitle">{headerDescription}</p>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        {(activeTab === 'inventory' || activeTab === 'history') ? (
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
        ) : null}

        {activeTab === 'customers' ? (
          <CustomersPanel />
        ) : activeTab === 'manufacturing' ? (
          <ManufacturingPanel />
        ) : activeTab === 'purchases' ? (
          <PurchasesPanel />
        ) : activeTab === 'analytics' ? (
          <AnalyticsPanel />
        ) : activeTab === 'users' ? (
          <UsersPanel />
        ) : activeTab === 'settings' ? (
          <SettingsPanel />
        ) : activeTab === 'inventory' ? (
          inventoryRoute.isFull ? (
            <section className="content-card detail-page-card">
              <div className="card-head">
                <div>
                  <h3>Gemstone Detail</h3>
                  <p>Full page gemstone detail and activity trail.</p>
                </div>
                <div className="detail-actions-row">
                  <button type="button" className="icon-btn" onClick={closeInventoryFullDetail} aria-label="Back to split view" title="Back to split view">
                    <ArrowLeft size={18} />
                  </button>
                  <button type="button" className="icon-btn" onClick={closeInventoryDetail} aria-label="Close detail view" title="Close detail view">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {isLoadingInventoryDetail ? (
                <p className="panel-placeholder">Loading inventory detail...</p>
              ) : selectedInventory ? (
                <InventoryDetailContent selectedInventory={selectedInventory} />
              ) : (
                <p className="panel-placeholder">No inventory detail found for this route.</p>
              )}
            </section>
          ) : (
            <div className={`content-split ${inventoryRoute.detailId ? 'has-detail' : ''}`}>
              <div className="content-split-main">
                {inventoryListCard}
              </div>

              {inventoryRoute.detailId ? (
                <aside className="detail-side-panel">
                  <div className="drawer-head">
                    <h3>Gemstone Detail</h3>
                    <div className="detail-actions-row">
                      <button type="button" className="icon-btn" onClick={openInventoryFullDetail} aria-label="Open full screen" title="Open full screen">
                        <Expand size={18} />
                      </button>
                      <button type="button" className="icon-btn" onClick={closeInventoryDetail} aria-label="Close detail panel" title="Close detail panel">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {isLoadingInventoryDetail ? (
                    <p className="panel-placeholder">Loading inventory detail...</p>
                  ) : selectedInventory ? (
                    <InventoryDetailContent selectedInventory={selectedInventory} />
                  ) : (
                    <p className="panel-placeholder">No inventory detail found for this record.</p>
                  )}
                </aside>
              ) : null}
            </div>
          )
        ) : (
          historyCard
        )}
      </section>
    </main>
  )
}
