import { env } from '../lib/env'
import { fetchJson } from '../lib/http'
import type { AppRole } from '../types/role'
import type {
  AnalyticsOverview,
  AuthResponse,
  Customer,
  CustomerActivity,
  CustomerUpsertRequest,
  InviteDetails,
  InviteResponse,
  InventoryItem,
  InventoryItemDetail,
  InventoryManufacturingActivity,
  InventorySummary,
  InventoryUsageActivity,
  MeProfile,
  ManufacturingCustomField,
  ManufacturingActivityLog,
  ManufacturingGemstone,
  ManufacturingNoteParseResponse,
  ManufacturingPerson,
  ManufacturingPersonProfile,
  ManufacturingPersonUpsertRequest,
  ManufacturingProjectDetail,
  ManufacturingProjectSummary,
  ManufacturingProcessStep,
  ManufacturingProjectUpsertRequest,
  ManufacturingSettings,
  ManufacturingSettingsUpdateRequest,
  PagedResponse,
  UserListResponse,
  UserSummary,
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

function mapUserSummary(record: UnknownRecord): UserSummary {
  const statusRaw = readString(record, 'status', 'Status')
  return {
    id: String(pick<string>(record, 'id', 'Id') ?? ''),
    email: readString(record, 'email', 'Email') ?? '',
    role: normalizeRole(readString(record, 'role', 'Role')),
    status: statusRaw === 'invited' ? 'invited' : 'active',
    createdAtUtc: readString(record, 'createdAtUtc', 'CreatedAtUtc') ?? '',
    activatedAtUtc: readString(record, 'activatedAtUtc', 'ActivatedAtUtc'),
    lastLoginAtUtc: readString(record, 'lastLoginAtUtc', 'LastLoginAtUtc'),
    inviteExpiresAtUtc: readString(record, 'inviteExpiresAtUtc', 'InviteExpiresAtUtc')
  }
}

function mapUserListResponse(record: UnknownRecord): UserListResponse {
  const rawItems = pick<unknown[]>(record, 'items', 'Items') ?? []
  const items = rawItems
    .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
    .map(mapUserSummary)

  return {
    items,
    continuationToken: readString(record, 'continuationToken', 'ContinuationToken')
  }
}

function mapInviteResponse(record: UnknownRecord): InviteResponse {
  return {
    email: readString(record, 'email', 'Email') ?? '',
    role: normalizeRole(readString(record, 'role', 'Role')),
    token: readString(record, 'token', 'Token') ?? '',
    expiresAtUtc: readString(record, 'expiresAtUtc', 'ExpiresAtUtc') ?? ''
  }
}

function mapInviteDetails(record: UnknownRecord): InviteDetails {
  return {
    email: readString(record, 'email', 'Email') ?? '',
    role: normalizeRole(readString(record, 'role', 'Role')),
    expiresAtUtc: readString(record, 'expiresAtUtc', 'ExpiresAtUtc') ?? ''
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

function readStringRecord(record: UnknownRecord, camel: string, pascal: string): Record<string, string | null> {
  const value = pick<unknown>(record, camel, pascal)
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return {}
  }

  const output: Record<string, string | null> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.trim()
    if (!normalizedKey) {
      continue
    }

    if (item == null) {
      output[normalizedKey] = null
      continue
    }

    const text = String(item).trim()
    output[normalizedKey] = text.length > 0 ? text : null
  }

  return output
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
    notes: readString(record, 'notes', 'Notes'),
    photos: readStringArray(record, 'photos', 'Photos')
  }
}

function mapManufacturingPerson(record: UnknownRecord): ManufacturingPerson {
  const rawRole = (readString(record, 'role', 'Role') ?? '').toLowerCase()
  return {
    id: readNumber(record, 'id', 'Id') ?? 0,
    role: rawRole === 'craftsman' ? 'craftsman' : 'designer',
    name: readString(record, 'name', 'Name') ?? '',
    email: readString(record, 'email', 'Email'),
    phone: readString(record, 'phone', 'Phone'),
    isActive: Boolean(pick<unknown>(record, 'isActive', 'IsActive')),
    createdAtUtc: readString(record, 'createdAtUtc', 'CreatedAtUtc') ?? '',
    updatedAtUtc: readString(record, 'updatedAtUtc', 'UpdatedAtUtc') ?? ''
  }
}

function mapManufacturingPersonProfile(record: UnknownRecord): ManufacturingPersonProfile {
  const rawPerson = pick<UnknownRecord>(record, 'person', 'Person') ?? {}
  const rawProjects = pick<unknown[]>(record, 'projects', 'Projects') ?? []
  return {
    person: mapManufacturingPerson(rawPerson),
    projects: rawProjects
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingSummary)
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
    gemstoneCount: readNumber(record, 'gemstoneCount', 'GemstoneCount') ?? 0,
    customFields: readStringRecord(record, 'customFields', 'CustomFields')
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
    customFields: readStringRecord(record, 'customFields', 'CustomFields'),
    gemstones: rawGemstones
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingGemstone),
    activityLog: rawActivity
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingActivity)
  }
}

function mapManufacturingStep(record: UnknownRecord): ManufacturingProcessStep {
  return {
    stepKey: readString(record, 'stepKey', 'StepKey') ?? '',
    label: readString(record, 'label', 'Label') ?? '',
    sortOrder: readNumber(record, 'sortOrder', 'SortOrder') ?? 0,
    requirePhoto: Boolean(pick<unknown>(record, 'requirePhoto', 'RequirePhoto')),
    requireComment: Boolean(pick<unknown>(record, 'requireComment', 'RequireComment')),
    isActive: Boolean(pick<unknown>(record, 'isActive', 'IsActive'))
  }
}

function mapManufacturingField(record: UnknownRecord): ManufacturingCustomField {
  return {
    fieldKey: readString(record, 'fieldKey', 'FieldKey') ?? '',
    label: readString(record, 'label', 'Label') ?? '',
    fieldType: (readString(record, 'fieldType', 'FieldType') as ManufacturingCustomField['fieldType']) ?? 'text',
    sortOrder: readNumber(record, 'sortOrder', 'SortOrder') ?? 0,
    isRequired: Boolean(pick<unknown>(record, 'isRequired', 'IsRequired')),
    isActive: Boolean(pick<unknown>(record, 'isActive', 'IsActive')),
    isSystem: Boolean(pick<unknown>(record, 'isSystem', 'IsSystem')),
    options: readStringArray(record, 'options', 'Options')
  }
}

function mapManufacturingSettings(record: UnknownRecord): ManufacturingSettings {
  const rawSteps = pick<unknown[]>(record, 'steps', 'Steps') ?? []
  const rawFields = pick<unknown[]>(record, 'fields', 'Fields') ?? []
  const rawDesigners = pick<unknown[]>(record, 'designers', 'Designers') ?? []
  const rawCraftsmen = pick<unknown[]>(record, 'craftsmen', 'Craftsmen') ?? []

  return {
    steps: rawSteps
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingStep),
    fields: rawFields
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingField),
    designers: rawDesigners
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingPerson),
    craftsmen: rawCraftsmen
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(mapManufacturingPerson)
  }
}

function mapManufacturingNoteParseResponse(record: UnknownRecord): ManufacturingNoteParseResponse {
  const rawGemstones = pick<unknown[]>(record, 'gemstones', 'Gemstones') ?? []
  return {
    manufacturingCode: readString(record, 'manufacturingCode', 'ManufacturingCode'),
    pieceName: readString(record, 'pieceName', 'PieceName'),
    pieceType: readString(record, 'pieceType', 'PieceType'),
    status: readString(record, 'status', 'Status') ?? 'approved',
    designerName: readString(record, 'designerName', 'DesignerName'),
    craftsmanName: readString(record, 'craftsmanName', 'CraftsmanName'),
    usageNotes: readString(record, 'usageNotes', 'UsageNotes'),
    totalCost: readNumber(record, 'totalCost', 'TotalCost'),
    sellingPrice: readNumber(record, 'sellingPrice', 'SellingPrice'),
    customFields: readStringRecord(record, 'customFields', 'CustomFields'),
    gemstones: rawGemstones
      .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
      .map(item => ({
        inventoryItemId: readNumber(item, 'inventoryItemId', 'InventoryItemId'),
        gemstoneCode: readString(item, 'gemstoneCode', 'GemstoneCode'),
        gemstoneType: readString(item, 'gemstoneType', 'GemstoneType'),
        piecesUsed: readNumber(item, 'piecesUsed', 'PiecesUsed'),
        weightUsedCt: readNumber(item, 'weightUsedCt', 'WeightUsedCt'),
        lineCost: readNumber(item, 'lineCost', 'LineCost'),
        notes: readString(item, 'notes', 'Notes')
      }))
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

export async function listUsers(limit = 120, continuationToken?: string | null): Promise<UserListResponse> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (continuationToken?.trim()) {
    params.set('continuationToken', continuationToken.trim())
  }

  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users?${params.toString()}`)
  return mapUserListResponse(response)
}

export async function deleteUser(userId: string): Promise<void> {
  await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  })
}

export async function inviteUser(email: string, role: AppRole = 'member', expiresInDays = 7): Promise<InviteResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users/invite`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      role,
      expiresInDays
    })
  })
  return mapInviteResponse(response)
}

export async function getInviteDetails(token: string): Promise<InviteDetails> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users/invite/${encodeURIComponent(token)}`, {
    skipAuth: true
  })
  return mapInviteDetails(response)
}

export async function acceptInvite(token: string, password: string): Promise<AuthResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users/invite/accept`, {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      token,
      password
    })
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

export async function getManufacturingSettings(): Promise<ManufacturingSettings> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/settings`)
  return mapManufacturingSettings(response)
}

export async function updateManufacturingSettings(payload: ManufacturingSettingsUpdateRequest): Promise<ManufacturingSettings> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/settings`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
  return mapManufacturingSettings(response)
}

export async function getManufacturingPeople(role?: 'designer' | 'craftsman' | 'all', activeOnly = true): Promise<ManufacturingPerson[]> {
  const params = new URLSearchParams()
  if (role && role !== 'all') {
    params.set('role', role)
  }
  params.set('activeOnly', activeOnly ? 'true' : 'false')

  const suffix = params.toString() ? `?${params}` : ''
  const response = await fetchJson<unknown[]>(`${env.apiBaseUrl}/manufacturing/people${suffix}`)
  return response
    .filter((value): value is UnknownRecord => typeof value === 'object' && value != null)
    .map(mapManufacturingPerson)
}

export async function createManufacturingPerson(payload: ManufacturingPersonUpsertRequest): Promise<ManufacturingPerson> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/people`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return mapManufacturingPerson(response)
}

export async function updateManufacturingPerson(id: number, payload: ManufacturingPersonUpsertRequest): Promise<ManufacturingPerson> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/people/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
  return mapManufacturingPerson(response)
}

export async function deleteManufacturingPerson(id: number): Promise<void> {
  await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/people/${id}`, {
    method: 'DELETE'
  })
}

export async function getManufacturingPersonProfile(id: number, limit = 200): Promise<ManufacturingPersonProfile> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/people/${id}?limit=${limit}`)
  return mapManufacturingPersonProfile(response)
}

export async function parseManufacturingNote(noteText: string): Promise<ManufacturingNoteParseResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/manufacturing/ai/parse-note`, {
    method: 'POST',
    body: JSON.stringify({ noteText })
  })
  return mapManufacturingNoteParseResponse(response)
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/analytics`)
  return mapAnalyticsOverview(response)
}
