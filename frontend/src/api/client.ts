import { env } from '../lib/env'
import { fetchJson } from '../lib/http'
import type { AppRole } from '../types/role'
import type {
  AuthResponse,
  InventoryItem,
  InventorySummary,
  MeProfile,
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

export async function getInventoryItem(id: number): Promise<InventoryItem> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/inventory/gemstones/${id}`)
  return mapInventoryItem(response)
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
