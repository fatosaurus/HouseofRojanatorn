import { env } from '../lib/env'
import { fetchJson } from '../lib/http'
import type { AppRole } from '../types/role'
import type {
  AnalyticsOverview,
  AuthResponse,
  Customer,
  CustomerActivity,
  CustomerUpsertRequest,
  InventoryItem,
  InventoryItemDetail,
  InventoryManufacturingActivity,
  InventorySummary,
  InventoryUsageActivity,
  MeProfile,
  ManufacturingActivityLog,
  ManufacturingGemstone,
  ManufacturingProjectDetail,
  ManufacturingProjectSummary,
  ManufacturingProjectUpsertRequest,
  PagedResponse,
  UsageBatch,
  UsageBatchDetail,
  UsageLine
} from './types'

type UnknownRecord = Record<string, unknown>

function pick<T>(record: UnknownRecord, camel: string, pascal: string): T | undefined {
  if (camel in record) {
    return record[camel] as T
  }
  if (pascal in record) {
    return record[pascal] as T
  }
  return undefined
}

function normalizeRole(value: unknown): AppRole {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === 'admin' ? 'admin' : 'member'
}

function mapAuthResponse(record: UnknownRecord): AuthResponse {
  const token = String(pick<string>(record, 'token', 'Token') ?? '')
  const expiresAtUtc = String(pick<string>(record, 'expiresAtUtc', 'ExpiresAtUtc') ?? '')
  const role = normalizeRole(pick<string>(record, 'role', 'Role'))

  if (!token || !expiresAtUtc) {
    throw new Error('Invalid auth response.')
  }

  return { token, expiresAtUtc, role }
}

function mapMeResponse(record: UnknownRecord): MeProfile {
  return {
    userId: String(pick<string>(record, 'userId', 'UserId') ?? ''),
    email: String(pick<string>(record, 'email', 'Email') ?? ''),
    role: normalizeRole(pick<string>(record, 'role', 'Role'))
  }
}

function readString(record: UnknownRecord, camel: string, pascal: string): string | null {
  const value = pick<unknown>(record, camel, pascal)
  if (value == null) {
    return null
  }
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function readNumber(record: UnknownRecord, camel: string, pascal: string): number | null {
  const value = pick<unknown>(record, camel, pascal)
  if (value == null) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapInventorySummary(record: UnknownRecord): InventorySummary {
  return {
    totalItems: readNumber(record, 'totalItems', 'TotalItems') ?? 0,
    lowStockItems: readNumber(record, 'lowStockItems', 'LowStockItems') ?? 0,
    totalBalanceCarats: readNumber(record, 'totalBalanceCarats', 'TotalBalanceCarats') ?? 0,
    totalBalancePieces: readNumber(record, 'totalBalancePieces', 'TotalBalancePieces') ?? 0,
    estimatedInventoryValue: readNumber(record, 'estimatedInventoryValue', 'EstimatedInventoryValue') ?? 0
  }
}

function mapInventoryItem(record: UnknownRecord): InventoryItem {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    gemstoneNumber: readNumber(record, 'gemstoneNumber', 'GemstoneNumber'),
    gemstoneNumberText: readString(record, 'gemstoneNumberText', 'GemstoneNumberText'),
    gemstoneType: readString(record, 'gemstoneType', 'GemstoneType'),
    shape: readString(record, 'shape', 'Shape'),
    weightPcsRaw: readString(record, 'weightPcsRaw', 'WeightPcsRaw'),
    pricePerCtRaw: readString(record, 'pricePerCtRaw', 'PricePerCtRaw'),
    pricePerPieceRaw: readString(record, 'pricePerPieceRaw', 'PricePerPieceRaw'),
    buyingDate: readString(record, 'buyingDate', 'BuyingDate'),
    ownerName: readString(record, 'ownerName', 'OwnerName'),
    balancePcs: readNumber(record, 'balancePcs', 'BalancePcs'),
    balanceCt: readNumber(record, 'balanceCt', 'BalanceCt'),
    parsedWeightCt: readNumber(record, 'parsedWeightCt', 'ParsedWeightCt'),
    parsedQuantityPcs: readNumber(record, 'parsedQuantityPcs', 'ParsedQuantityPcs'),
    parsedPricePerCt: readNumber(record, 'parsedPricePerCt', 'ParsedPricePerCt'),
    parsedPricePerPiece: readNumber(record, 'parsedPricePerPiece', 'ParsedPricePerPiece'),
    effectiveBalancePcs: readNumber(record, 'effectiveBalancePcs', 'EffectiveBalancePcs') ?? 0,
    effectiveBalanceCt: readNumber(record, 'effectiveBalanceCt', 'EffectiveBalanceCt') ?? 0
  }
}

function mapInventoryUsageActivity(record: UnknownRecord): InventoryUsageActivity {
  return {
    lineId: readNumber(record, 'lineId', 'LineId') ?? 0,
    batchId: readNumber(record, 'batchId', 'BatchId') ?? 0,
    transactionDate: readString(record, 'transactionDate', 'TransactionDate'),
    productCode: readString(record, 'productCode', 'ProductCode'),
    productCategory: readString(record, 'productCategory', 'ProductCategory') ?? '',
    requesterName: readString(record, 'requesterName', 'RequesterName'),
    usedPcs: readNumber(record, 'usedPcs', 'UsedPcs'),
    usedWeightCt: readNumber(record, 'usedWeightCt', 'UsedWeightCt'),
    lineAmount: readNumber(record, 'lineAmount', 'LineAmount'),
    balancePcsAfter: readNumber(record, 'balancePcsAfter', 'BalancePcsAfter'),
    balanceCtAfter: readNumber(record, 'balanceCtAfter', 'BalanceCtAfter')
  }
}

function mapInventoryManufacturingActivity(record: UnknownRecord): InventoryManufacturingActivity {
  return {
    projectId: readNumber(record, 'projectId', 'ProjectId') ?? 0,
    manufacturingCode: readString(record, 'manufacturingCode', 'ManufacturingCode') ?? '',
    pieceName: readString(record, 'pieceName', 'PieceName') ?? '',
    pieceType: readString(record, 'pieceType', 'PieceType'),
    status: readString(record, 'status', 'Status') ?? '',
    activityAtUtc: readString(record, 'activityAtUtc', 'ActivityAtUtc'),
    craftsmanName: readString(record, 'craftsmanName', 'CraftsmanName'),
    notes: readString(record, 'notes', 'Notes'),
    piecesUsed: readNumber(record, 'piecesUsed', 'PiecesUsed') ?? 0,
    weightUsedCt: readNumber(record, 'weightUsedCt', 'WeightUsedCt') ?? 0,
    lineCost: readNumber(record, 'lineCost', 'LineCost') ?? 0
  }
}

function mapInventoryItemDetail(record: UnknownRecord): InventoryItemDetail {
  const rawUsage = pick<unknown[]>(record, 'usageActivities', 'UsageActivities') ?? []
  const rawManufacturing = pick<unknown[]>(record, 'manufacturingActivities', 'ManufacturingActivities') ?? []

  return {
    ...mapInventoryItem(record),
    usageActivities: rawUsage
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapInventoryUsageActivity),
    manufacturingActivities: rawManufacturing
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapInventoryManufacturingActivity)
  }
}

function mapUsageBatch(record: UnknownRecord): UsageBatch {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    productCategory: readString(record, 'productCategory', 'ProductCategory') ?? 'unknown',
    transactionDate: readString(record, 'transactionDate', 'TransactionDate'),
    requesterName: readString(record, 'requesterName', 'RequesterName'),
    productCode: readString(record, 'productCode', 'ProductCode'),
    totalAmount: readNumber(record, 'totalAmount', 'TotalAmount'),
    lineCount: readNumber(record, 'lineCount', 'LineCount') ?? 0
  }
}

function mapUsageLine(record: UnknownRecord): UsageLine {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    gemstoneNumber: readNumber(record, 'gemstoneNumber', 'GemstoneNumber'),
    gemstoneName: readString(record, 'gemstoneName', 'GemstoneName'),
    usedPcs: readNumber(record, 'usedPcs', 'UsedPcs'),
    usedWeightCt: readNumber(record, 'usedWeightCt', 'UsedWeightCt'),
    unitPriceRaw: readString(record, 'unitPriceRaw', 'UnitPriceRaw'),
    lineAmount: readNumber(record, 'lineAmount', 'LineAmount'),
    balancePcsAfter: readNumber(record, 'balancePcsAfter', 'BalancePcsAfter'),
    balanceCtAfter: readNumber(record, 'balanceCtAfter', 'BalanceCtAfter'),
    requesterName: readString(record, 'requesterName', 'RequesterName')
  }
}

function mapPagedResponse<T>(record: UnknownRecord, itemMapper: (item: UnknownRecord) => T): PagedResponse<T> {
  const rawItems = pick<unknown[]>(record, 'items', 'Items') ?? []
  const items = rawItems
    .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
    .map(itemMapper)

  return {
    items,
    totalCount: readNumber(record, 'totalCount', 'TotalCount') ?? items.length,
    limit: readNumber(record, 'limit', 'Limit') ?? items.length,
    offset: readNumber(record, 'offset', 'Offset') ?? 0
  }
}

function mapUsageBatchDetail(record: UnknownRecord): UsageBatchDetail {
  const rawLines = pick<unknown[]>(record, 'lines', 'Lines') ?? []
  const lines = rawLines
    .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
    .map(mapUsageLine)

  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    productCategory: readString(record, 'productCategory', 'ProductCategory') ?? 'unknown',
    transactionDate: readString(record, 'transactionDate', 'TransactionDate'),
    requesterName: readString(record, 'requesterName', 'RequesterName'),
    productCode: readString(record, 'productCode', 'ProductCode'),
    totalAmount: readNumber(record, 'totalAmount', 'TotalAmount'),
    sourceSheet: readString(record, 'sourceSheet', 'SourceSheet') ?? '',
    sourceRow: readNumber(record, 'sourceRow', 'SourceRow'),
    lines
  }
}

function readStringArray(record: UnknownRecord, camel: string, pascal: string): string[] {
  const value = pick<unknown>(record, camel, pascal)
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => String(item ?? '').trim())
    .filter(item => item.length > 0)
}

function mapCustomer(record: UnknownRecord): Customer {
  return {
    id: String(pick<string>(record, 'id', 'Id') ?? ''),
    name: readString(record, 'name', 'Name') ?? '',
    nickname: readString(record, 'nickname', 'Nickname'),
    email: readString(record, 'email', 'Email'),
    phone: readString(record, 'phone', 'Phone'),
    address: readString(record, 'address', 'Address'),
    notes: readString(record, 'notes', 'Notes'),
    photoUrl: readString(record, 'photoUrl', 'PhotoUrl'),
    customerSince: readString(record, 'customerSince', 'CustomerSince'),
    createdAtUtc: readString(record, 'createdAtUtc', 'CreatedAtUtc') ?? '',
    updatedAtUtc: readString(record, 'updatedAtUtc', 'UpdatedAtUtc') ?? '',
    totalSpent: readNumber(record, 'totalSpent', 'TotalSpent') ?? 0,
    purchaseCount: readNumber(record, 'purchaseCount', 'PurchaseCount') ?? 0
  }
}

function mapCustomerActivity(record: UnknownRecord): CustomerActivity {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    projectId: readNumber(record, 'projectId', 'ProjectId') ?? 0,
    manufacturingCode: readString(record, 'manufacturingCode', 'ManufacturingCode') ?? '',
    pieceName: readString(record, 'pieceName', 'PieceName') ?? '',
    status: readString(record, 'status', 'Status') ?? '',
    activityAtUtc: readString(record, 'activityAtUtc', 'ActivityAtUtc') ?? '',
    craftsmanName: readString(record, 'craftsmanName', 'CraftsmanName'),
    notes: readString(record, 'notes', 'Notes')
  }
}

function mapManufacturingGemstone(record: UnknownRecord): ManufacturingGemstone {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    inventoryItemId: readNumber(record, 'inventoryItemId', 'InventoryItemId'),
    gemstoneCode: readString(record, 'gemstoneCode', 'GemstoneCode'),
    gemstoneType: readString(record, 'gemstoneType', 'GemstoneType'),
    piecesUsed: readNumber(record, 'piecesUsed', 'PiecesUsed') ?? 0,
    weightUsedCt: readNumber(record, 'weightUsedCt', 'WeightUsedCt') ?? 0,
    lineCost: readNumber(record, 'lineCost', 'LineCost') ?? 0,
    notes: readString(record, 'notes', 'Notes')
  }
}

function mapManufacturingActivity(record: UnknownRecord): ManufacturingActivityLog {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    status: readString(record, 'status', 'Status') ?? '',
    activityAtUtc: readString(record, 'activityAtUtc', 'ActivityAtUtc') ?? '',
    craftsmanName: readString(record, 'craftsmanName', 'CraftsmanName'),
    notes: readString(record, 'notes', 'Notes')
  }
}

function mapManufacturingSummary(record: UnknownRecord): ManufacturingProjectSummary {
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    manufacturingCode: readString(record, 'manufacturingCode', 'ManufacturingCode') ?? '',
    pieceName: readString(record, 'pieceName', 'PieceName') ?? '',
    pieceType: readString(record, 'pieceType', 'PieceType'),
    designDate: readString(record, 'designDate', 'DesignDate'),
    designerName: readString(record, 'designerName', 'DesignerName'),
    status: readString(record, 'status', 'Status') ?? '',
    craftsmanName: readString(record, 'craftsmanName', 'CraftsmanName'),
    metalPlating: readStringArray(record, 'metalPlating', 'MetalPlating'),
    settingCost: readNumber(record, 'settingCost', 'SettingCost') ?? 0,
    diamondCost: readNumber(record, 'diamondCost', 'DiamondCost') ?? 0,
    gemstoneCost: readNumber(record, 'gemstoneCost', 'GemstoneCost') ?? 0,
    totalCost: readNumber(record, 'totalCost', 'TotalCost') ?? 0,
    sellingPrice: readNumber(record, 'sellingPrice', 'SellingPrice') ?? 0,
    completionDate: readString(record, 'completionDate', 'CompletionDate'),
    customerId: readString(record, 'customerId', 'CustomerId'),
    customerName: readString(record, 'customerName', 'CustomerName'),
    soldAt: readString(record, 'soldAt', 'SoldAt'),
    createdAtUtc: readString(record, 'createdAtUtc', 'CreatedAtUtc') ?? '',
    updatedAtUtc: readString(record, 'updatedAtUtc', 'UpdatedAtUtc') ?? '',
    gemstoneCount: readNumber(record, 'gemstoneCount', 'GemstoneCount') ?? 0
  }
}

function mapManufacturingDetail(record: UnknownRecord): ManufacturingProjectDetail {
  const rawGemstones = pick<unknown[]>(record, 'gemstones', 'Gemstones') ?? []
  const rawActivity = pick<unknown[]>(record, 'activityLog', 'ActivityLog') ?? []

  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    manufacturingCode: readString(record, 'manufacturingCode', 'ManufacturingCode') ?? '',
    pieceName: readString(record, 'pieceName', 'PieceName') ?? '',
    pieceType: readString(record, 'pieceType', 'PieceType'),
    designDate: readString(record, 'designDate', 'DesignDate'),
    designerName: readString(record, 'designerName', 'DesignerName'),
    status: readString(record, 'status', 'Status') ?? '',
    craftsmanName: readString(record, 'craftsmanName', 'CraftsmanName'),
    metalPlating: readStringArray(record, 'metalPlating', 'MetalPlating'),
    metalPlatingNotes: readString(record, 'metalPlatingNotes', 'MetalPlatingNotes'),
    settingCost: readNumber(record, 'settingCost', 'SettingCost') ?? 0,
    diamondCost: readNumber(record, 'diamondCost', 'DiamondCost') ?? 0,
    gemstoneCost: readNumber(record, 'gemstoneCost', 'GemstoneCost') ?? 0,
    totalCost: readNumber(record, 'totalCost', 'TotalCost') ?? 0,
    sellingPrice: readNumber(record, 'sellingPrice', 'SellingPrice') ?? 0,
    completionDate: readString(record, 'completionDate', 'CompletionDate'),
    usageNotes: readString(record, 'usageNotes', 'UsageNotes'),
    photos: readStringArray(record, 'photos', 'Photos'),
    customerId: readString(record, 'customerId', 'CustomerId'),
    customerName: readString(record, 'customerName', 'CustomerName'),
    soldAt: readString(record, 'soldAt', 'SoldAt'),
    createdAtUtc: readString(record, 'createdAtUtc', 'CreatedAtUtc') ?? '',
    updatedAtUtc: readString(record, 'updatedAtUtc', 'UpdatedAtUtc') ?? '',
    gemstones: rawGemstones
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingGemstone),
    activityLog: rawActivity
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingActivity)
  }
}

function mapAnalyticsOverview(record: UnknownRecord): AnalyticsOverview {
  const rawCurrentMonth = pick<UnknownRecord>(record, 'currentMonth', 'CurrentMonth') ?? {}
  const rawTotals = pick<UnknownRecord>(record, 'totals', 'Totals') ?? {}
  const rawMonthly = pick<unknown[]>(record, 'monthlyRevenue', 'MonthlyRevenue') ?? []
  const rawTopCustomers = pick<unknown[]>(record, 'topCustomers', 'TopCustomers') ?? []

  return {
    currentMonth: {
      revenue: readNumber(rawCurrentMonth, 'revenue', 'Revenue') ?? 0,
      transactions: readNumber(rawCurrentMonth, 'transactions', 'Transactions') ?? 0,
      startDateUtc: readString(rawCurrentMonth, 'startDateUtc', 'StartDateUtc') ?? ''
    },
    totals: {
      revenue: readNumber(rawTotals, 'revenue', 'Revenue') ?? 0,
      orders: readNumber(rawTotals, 'orders', 'Orders') ?? 0,
      avgOrderValue: readNumber(rawTotals, 'avgOrderValue', 'AvgOrderValue') ?? 0,
      customers: readNumber(rawTotals, 'customers', 'Customers') ?? 0,
      customersWithPurchases: readNumber(rawTotals, 'customersWithPurchases', 'CustomersWithPurchases') ?? 0
    },
    monthlyRevenue: rawMonthly
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(point => ({
        month: readString(point, 'month', 'Month') ?? '',
        revenue: readNumber(point, 'revenue', 'Revenue') ?? 0,
        customers: readNumber(point, 'customers', 'Customers') ?? 0,
        orders: readNumber(point, 'orders', 'Orders') ?? 0
      })),
    topCustomers: rawTopCustomers
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(point => ({
        customerId: readString(point, 'customerId', 'CustomerId') ?? '',
        customerName: readString(point, 'customerName', 'CustomerName') ?? '',
        totalSpent: readNumber(point, 'totalSpent', 'TotalSpent') ?? 0,
        purchases: readNumber(point, 'purchases', 'Purchases') ?? 0,
        lastPurchaseUtc: readString(point, 'lastPurchaseUtc', 'LastPurchaseUtc') ?? ''
      }))
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true
  })
  return mapAuthResponse(response)
}

export async function createUser(email: string, password: string, role: AppRole = 'member'): Promise<AuthResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users`, {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
    skipAuth: true
  })
  return mapAuthResponse(response)
}

export async function getMeProfile(): Promise<MeProfile> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/me/profile`)
  return mapMeResponse(response)
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/inventory/summary`)
  return mapInventorySummary(response)
}

interface InventoryQuery {
  search?: string
  type?: string
  status?: string
  limit?: number
  offset?: number
}

export async function getInventoryItems(query: InventoryQuery): Promise<PagedResponse<InventoryItem>> {
  const params = new URLSearchParams()
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.type?.trim() && query.type !== 'all') params.set('type', query.type.trim())
  if (query.status?.trim() && query.status !== 'all') params.set('status', query.status.trim())
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  if (typeof query.offset === 'number') params.set('offset', String(query.offset))

  const suffix = params.toString() ? `?${params}` : ''
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/inventory/gemstones${suffix}`)
  return mapPagedResponse(response, mapInventoryItem)
}

export async function getInventoryItem(id: number): Promise<InventoryItemDetail> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/inventory/gemstones/${id}`)
  return mapInventoryItemDetail(response)
}

interface UsageQuery {
  search?: string
  category?: string
  limit?: number
  offset?: number
}

export async function getUsageBatches(query: UsageQuery): Promise<PagedResponse<UsageBatch>> {
  const params = new URLSearchParams()
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.category?.trim() && query.category !== 'all') params.set('category', query.category.trim())
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  if (typeof query.offset === 'number') params.set('offset', String(query.offset))

  const suffix = params.toString() ? `?${params}` : ''
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/inventory/usage${suffix}`)
  return mapPagedResponse(response, mapUsageBatch)
}

export async function getUsageBatch(id: number): Promise<UsageBatchDetail> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/inventory/usage/${id}`)
  return mapUsageBatchDetail(response)
}

export interface CustomersQuery {
  search?: string
  limit?: number
  offset?: number
}

export async function getCustomers(query: CustomersQuery): Promise<PagedResponse<Customer>> {
  const params = new URLSearchParams()
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  if (typeof query.offset === 'number') params.set('offset', String(query.offset))
  const suffix = params.toString() ? `?${params}` : ''
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/customers${suffix}`)
  return mapPagedResponse(response, mapCustomer)
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/customers/${encodeURIComponent(id)}`)
  return mapCustomer(response)
}

export async function createCustomer(payload: CustomerUpsertRequest): Promise<Customer> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/customers`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return mapCustomer(response)
}

export async function updateCustomer(id: string, payload: CustomerUpsertRequest): Promise<Customer> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/customers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
  return mapCustomer(response)
}

export async function deleteCustomer(id: string): Promise<void> {
  await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/customers/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

export async function addCustomerNote(id: string, note: string): Promise<Customer | null> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/customers/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note })
  })

  const rawCustomer = pick<UnknownRecord>(response, 'customer', 'Customer')
  if (!rawCustomer) {
    return null
  }
  return mapCustomer(rawCustomer)
}

export async function getCustomerActivity(id: string, limit = 100): Promise<CustomerActivity[]> {
  const response = await fetchJson<unknown[]>(`${env.apiBaseUrl}/customers/${encodeURIComponent(id)}/activity?limit=${limit}`)
  return response
    .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
    .map(mapCustomerActivity)
}

export interface ManufacturingQuery {
  search?: string
  status?: string
  customerId?: string
  limit?: number
  offset?: number
}

export async function getManufacturingProjects(query: ManufacturingQuery): Promise<PagedResponse<ManufacturingProjectSummary>> {
  const params = new URLSearchParams()
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.status?.trim() && query.status !== 'all') params.set('status', query.status.trim())
  if (query.customerId?.trim()) params.set('customer_id', query.customerId.trim())
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  if (typeof query.offset === 'number') params.set('offset', String(query.offset))

  const suffix = params.toString() ? `?${params}` : ''
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing${suffix}`)
  return mapPagedResponse(response, mapManufacturingSummary)
}

export async function getManufacturingProject(id: number): Promise<ManufacturingProjectDetail> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/${id}`)
  return mapManufacturingDetail(response)
}

export async function createManufacturingProject(payload: ManufacturingProjectUpsertRequest): Promise<ManufacturingProjectDetail> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return mapManufacturingDetail(response)
}

export async function updateManufacturingProject(id: number, payload: ManufacturingProjectUpsertRequest): Promise<ManufacturingProjectDetail> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
  return mapManufacturingDetail(response)
}

export async function deleteManufacturingProject(id: number): Promise<void> {
  await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/${id}`, {
    method: 'DELETE'
  })
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/analytics`)
  return mapAnalyticsOverview(response)
}
