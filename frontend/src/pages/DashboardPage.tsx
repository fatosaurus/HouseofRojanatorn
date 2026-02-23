import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, Expand, Factory, Gem, History, LogOut, Plus, Settings, ShoppingBag, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createInventoryItem, getInventoryItem, getInventoryItems, getInventorySummary, restockInventoryItem } from '../api/client'
import type { InventoryItem, InventoryItemDetail, InventorySummary } from '../api/types'
import { useSession } from '../app/useSession'
import { AnalyticsPanel } from '../components/dashboard/AnalyticsPanel'
import { CustomersPanel } from '../components/dashboard/CustomersPanel'
import { HistoryPanel } from '../components/dashboard/HistoryPanel'
import { ManufacturingPanel } from '../components/dashboard/ManufacturingPanel'
import { PurchasesPanel } from '../components/dashboard/PurchasesPanel'
import { SettingsPanel } from '../components/dashboard/SettingsPanel'

type DashboardTab = 'customers' | 'purchases' | 'inventory' | 'manufacturing' | 'history' | 'analytics' | 'settings'
const INVENTORY_PAGE_SIZE = 50

const DASHBOARD_TABS: DashboardTab[] = [
  'customers',
  'purchases',
  'inventory',
  'manufacturing',
  'history',
  'analytics',
  'settings'
]

const SIDEBAR_ITEMS: Array<{ tab: DashboardTab, label: string, Icon: LucideIcon }> = [
  { tab: 'customers', label: 'Customers', Icon: Users },
  { tab: 'purchases', label: 'Purchases', Icon: ShoppingBag },
  { tab: 'inventory', label: 'Gemstones', Icon: Gem },
  { tab: 'manufacturing', label: 'Manufacturing', Icon: Factory },
  { tab: 'history', label: 'History', Icon: History },
  { tab: 'analytics', label: 'Analytics', Icon: BarChart3 },
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

interface NewGemstoneDraft {
  gemstoneNumberText: string
  gemstoneType: string
  shape: string
  ownerName: string
  buyingDate: string
  balanceCt: string
  balancePcs: string
  parsedPricePerCt: string
  parsedPricePerPiece: string
}

interface RestockGemstoneDraft {
  inventoryItemId: string
  additionalCt: string
  additionalPcs: string
  buyingDate: string
  ownerName: string
  parsedPricePerCt: string
  parsedPricePerPiece: string
}

const EMPTY_NEW_GEMSTONE_DRAFT: NewGemstoneDraft = {
  gemstoneNumberText: '',
  gemstoneType: '',
  shape: '',
  ownerName: '',
  buyingDate: '',
  balanceCt: '',
  balancePcs: '',
  parsedPricePerCt: '',
  parsedPricePerPiece: ''
}

const EMPTY_RESTOCK_DRAFT: RestockGemstoneDraft = {
  inventoryItemId: '',
  additionalCt: '',
  additionalPcs: '',
  buyingDate: '',
  ownerName: '',
  parsedPricePerCt: '',
  parsedPricePerPiece: ''
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
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

  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryType, setInventoryType] = useState('all')
  const [inventoryStatus, setInventoryStatus] = useState('all')
  const [selectedInventory, setSelectedInventory] = useState<InventoryItemDetail | null>(null)
  const [isCreatingGemstone, setIsCreatingGemstone] = useState(false)
  const [isRestockingGemstone, setIsRestockingGemstone] = useState(false)
  const [newGemstoneDraft, setNewGemstoneDraft] = useState<NewGemstoneDraft>(EMPTY_NEW_GEMSTONE_DRAFT)
  const [restockDraft, setRestockDraft] = useState<RestockGemstoneDraft>(EMPTY_RESTOCK_DRAFT)
  const [isSavingInventoryAction, setIsSavingInventoryAction] = useState(false)

  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [isLoadingInventory, setIsLoadingInventory] = useState(true)
  const [isLoadingInventoryDetail, setIsLoadingInventoryDetail] = useState(false)
  const [isLoadingMoreInventory, setIsLoadingMoreInventory] = useState(false)
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

  async function refreshInventoryData(currentSearch: string, currentType: string, currentStatus: string) {
    setIsLoadingInventory(true)
    setErrorMessage(null)
    setInventory([])
    setInventoryTotal(0)
    setInventoryOffset(0)

    try {
      const result = await getInventoryItems({
        search: currentSearch,
        type: currentType,
        status: currentStatus,
        limit: INVENTORY_PAGE_SIZE,
        offset: 0
      })
      setInventory(result.items)
      setInventoryTotal(result.totalCount)
      setInventoryOffset(result.items.length)
    } catch {
      setErrorMessage('Unable to load inventory records.')
    } finally {
      setIsLoadingInventory(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'inventory') {
      return
    }

    void refreshInventoryData(inventorySearch, inventoryType, inventoryStatus)
  }, [activeTab, inventorySearch, inventoryStatus, inventoryType])

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

  async function refreshInventorySummary() {
    try {
      const result = await getInventorySummary()
      setSummary(result)
    } catch {
      setErrorMessage('Unable to refresh inventory summary.')
    }
  }

  async function handleCreateGemstone() {
    if (!newGemstoneDraft.gemstoneType.trim()) {
      setErrorMessage('Gemstone type is required.')
      return
    }

    setIsSavingInventoryAction(true)
    setErrorMessage(null)

    try {
      await createInventoryItem({
        gemstoneNumberText: newGemstoneDraft.gemstoneNumberText.trim() || null,
        gemstoneType: newGemstoneDraft.gemstoneType.trim() || null,
        shape: newGemstoneDraft.shape.trim() || null,
        ownerName: newGemstoneDraft.ownerName.trim() || null,
        buyingDate: newGemstoneDraft.buyingDate || null,
        balanceCt: parseOptionalNumber(newGemstoneDraft.balanceCt),
        balancePcs: parseOptionalNumber(newGemstoneDraft.balancePcs),
        parsedWeightCt: parseOptionalNumber(newGemstoneDraft.balanceCt),
        parsedQuantityPcs: parseOptionalNumber(newGemstoneDraft.balancePcs),
        parsedPricePerCt: parseOptionalNumber(newGemstoneDraft.parsedPricePerCt),
        parsedPricePerPiece: parseOptionalNumber(newGemstoneDraft.parsedPricePerPiece),
        pricePerCtRaw: newGemstoneDraft.parsedPricePerCt.trim() || null,
        pricePerPieceRaw: newGemstoneDraft.parsedPricePerPiece.trim() || null
      })

      setNewGemstoneDraft(EMPTY_NEW_GEMSTONE_DRAFT)
      setIsCreatingGemstone(false)
      await Promise.all([
        refreshInventoryData(inventorySearch, inventoryType, inventoryStatus),
        refreshInventorySummary()
      ])
    } catch {
      setErrorMessage('Unable to create gemstone.')
    } finally {
      setIsSavingInventoryAction(false)
    }
  }

  async function handleRestockGemstone() {
    const inventoryItemId = Number(restockDraft.inventoryItemId)
    if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0) {
      setErrorMessage('Select a valid gemstone to restock.')
      return
    }

    if (!parseOptionalNumber(restockDraft.additionalCt) && !parseOptionalNumber(restockDraft.additionalPcs)) {
      setErrorMessage('Enter additional CT or PCS to restock.')
      return
    }

    setIsSavingInventoryAction(true)
    setErrorMessage(null)

    try {
      const updated = await restockInventoryItem(inventoryItemId, {
        additionalCt: parseOptionalNumber(restockDraft.additionalCt),
        additionalPcs: parseOptionalNumber(restockDraft.additionalPcs),
        buyingDate: restockDraft.buyingDate || null,
        ownerName: restockDraft.ownerName.trim() || null,
        parsedPricePerCt: parseOptionalNumber(restockDraft.parsedPricePerCt),
        parsedPricePerPiece: parseOptionalNumber(restockDraft.parsedPricePerPiece),
        pricePerCtRaw: restockDraft.parsedPricePerCt.trim() || null,
        pricePerPieceRaw: restockDraft.parsedPricePerPiece.trim() || null
      })

      setRestockDraft(EMPTY_RESTOCK_DRAFT)
      setIsRestockingGemstone(false)
      await Promise.all([
        refreshInventoryData(inventorySearch, inventoryType, inventoryStatus),
        refreshInventorySummary()
      ])
      setSelectedInventory(updated)
    } catch {
      setErrorMessage('Unable to restock gemstone.')
    } finally {
      setIsSavingInventoryAction(false)
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
        <div className="detail-actions-row">
          <button type="button" className="secondary-btn" onClick={() => {
            setIsRestockingGemstone(false)
            setIsCreatingGemstone(current => !current)
          }}>
            {isCreatingGemstone ? 'Cancel' : (
              <>
                <Plus size={14} />
                New Gemstone
              </>
            )}
          </button>
          <button type="button" className="secondary-btn" onClick={() => {
            setIsCreatingGemstone(false)
            setIsRestockingGemstone(current => !current)
          }}>
            {isRestockingGemstone ? 'Cancel' : 'Restock Existing'}
          </button>
        </div>
      </div>

      <>
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

        {isCreatingGemstone ? (
          <div className="crm-form-grid">
            <label>
              Gem Code / Number
              <input value={newGemstoneDraft.gemstoneNumberText} onChange={event => setNewGemstoneDraft(current => ({ ...current, gemstoneNumberText: event.target.value }))} />
            </label>
            <label>
              Gemstone Type
              <input value={newGemstoneDraft.gemstoneType} onChange={event => setNewGemstoneDraft(current => ({ ...current, gemstoneType: event.target.value }))} />
            </label>
            <label>
              Shape
              <input value={newGemstoneDraft.shape} onChange={event => setNewGemstoneDraft(current => ({ ...current, shape: event.target.value }))} />
            </label>
            <label>
              Owner
              <input value={newGemstoneDraft.ownerName} onChange={event => setNewGemstoneDraft(current => ({ ...current, ownerName: event.target.value }))} />
            </label>
            <label>
              Buying Date
              <input type="date" value={newGemstoneDraft.buyingDate} onChange={event => setNewGemstoneDraft(current => ({ ...current, buyingDate: event.target.value }))} />
            </label>
            <label>
              Balance (CT)
              <input value={newGemstoneDraft.balanceCt} onChange={event => setNewGemstoneDraft(current => ({ ...current, balanceCt: event.target.value }))} />
            </label>
            <label>
              Balance (PCS)
              <input value={newGemstoneDraft.balancePcs} onChange={event => setNewGemstoneDraft(current => ({ ...current, balancePcs: event.target.value }))} />
            </label>
            <label>
              Price Per CT
              <input value={newGemstoneDraft.parsedPricePerCt} onChange={event => setNewGemstoneDraft(current => ({ ...current, parsedPricePerCt: event.target.value }))} />
            </label>
            <label>
              Price Per Piece
              <input value={newGemstoneDraft.parsedPricePerPiece} onChange={event => setNewGemstoneDraft(current => ({ ...current, parsedPricePerPiece: event.target.value }))} />
            </label>
            <div className="crm-form-actions crm-form-span">
              <button type="button" className="secondary-btn" onClick={() => setNewGemstoneDraft(EMPTY_NEW_GEMSTONE_DRAFT)} disabled={isSavingInventoryAction}>
                Reset
              </button>
              <button type="button" className="primary-btn" onClick={() => void handleCreateGemstone()} disabled={isSavingInventoryAction}>
                {isSavingInventoryAction ? 'Saving...' : 'Save Gemstone'}
              </button>
            </div>
          </div>
        ) : null}

        {isRestockingGemstone ? (
          <div className="crm-form-grid">
              <label className="crm-form-span">
                Existing Gemstone
                <select value={restockDraft.inventoryItemId} onChange={event => setRestockDraft(current => ({ ...current, inventoryItemId: event.target.value }))}>
                  <option value="">Select gemstone</option>
                  {inventory.map(item => (
                    <option key={item.id} value={String(item.id)}>
                      {(item.gemstoneNumber ?? item.gemstoneNumberText ?? item.id)}
                      {' • '}
                      {item.gemstoneType ?? '-'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Additional CT
                <input value={restockDraft.additionalCt} onChange={event => setRestockDraft(current => ({ ...current, additionalCt: event.target.value }))} />
              </label>
              <label>
                Additional PCS
                <input value={restockDraft.additionalPcs} onChange={event => setRestockDraft(current => ({ ...current, additionalPcs: event.target.value }))} />
              </label>
              <label>
                Buying Date
                <input type="date" value={restockDraft.buyingDate} onChange={event => setRestockDraft(current => ({ ...current, buyingDate: event.target.value }))} />
              </label>
              <label>
                Owner (optional override)
                <input value={restockDraft.ownerName} onChange={event => setRestockDraft(current => ({ ...current, ownerName: event.target.value }))} />
              </label>
              <label>
                Price Per CT (optional override)
                <input value={restockDraft.parsedPricePerCt} onChange={event => setRestockDraft(current => ({ ...current, parsedPricePerCt: event.target.value }))} />
              </label>
              <label>
                Price Per Piece (optional override)
                <input value={restockDraft.parsedPricePerPiece} onChange={event => setRestockDraft(current => ({ ...current, parsedPricePerPiece: event.target.value }))} />
              </label>
              <div className="crm-form-actions crm-form-span">
                <button type="button" className="secondary-btn" onClick={() => setRestockDraft(EMPTY_RESTOCK_DRAFT)} disabled={isSavingInventoryAction}>
                  Reset
                </button>
                <button type="button" className="primary-btn" onClick={() => void handleRestockGemstone()} disabled={isSavingInventoryAction}>
                  {isSavingInventoryAction ? 'Saving...' : 'Apply Restock'}
                </button>
              </div>
          </div>
        ) : null}

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
      </>
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
        ) : activeTab === 'history' ? (
          <HistoryPanel />
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
        ) : null}
      </section>
    </main>
  )
}
