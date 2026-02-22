import type { AppRole } from '../types/role'

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  role: AppRole
}

export interface UserSummary {
  id: string
  email: string
  role: AppRole
  status: 'active' | 'invited'
  createdAtUtc: string
  activatedAtUtc: string | null
  lastLoginAtUtc: string | null
  inviteExpiresAtUtc: string | null
}

export interface UserListResponse {
  items: UserSummary[]
  continuationToken: string | null
}

export interface InviteResponse {
  email: string
  role: AppRole
  token: string
  expiresAtUtc: string
}

export interface InviteDetails {
  email: string
  role: AppRole
  expiresAtUtc: string
}

export interface MeProfile {
  userId: string
  email: string
  role: AppRole
}

export interface InventorySummary {
  totalItems: number
  lowStockItems: number
  totalBalanceCarats: number
  totalBalancePieces: number
  estimatedInventoryValue: number
}

export interface InventoryItem {
  id: number
  gemstoneNumber: number | null
  gemstoneNumberText: string | null
  gemstoneType: string | null
  shape: string | null
  weightPcsRaw: string | null
  pricePerCtRaw: string | null
  pricePerPieceRaw: string | null
  buyingDate: string | null
  ownerName: string | null
  balancePcs: number | null
  balanceCt: number | null
  parsedWeightCt: number | null
  parsedQuantityPcs: number | null
  parsedPricePerCt: number | null
  parsedPricePerPiece: number | null
  effectiveBalancePcs: number
  effectiveBalanceCt: number
}

export interface InventoryUsageActivity {
  lineId: number
  batchId: number
  transactionDate: string | null
  productCode: string | null
  productCategory: string
  requesterName: string | null
  usedPcs: number | null
  usedWeightCt: number | null
  lineAmount: number | null
  balancePcsAfter: number | null
  balanceCtAfter: number | null
}

export interface InventoryManufacturingActivity {
  projectId: number
  manufacturingCode: string
  pieceName: string
  pieceType: string | null
  status: string
  activityAtUtc: string | null
  craftsmanName: string | null
  notes: string | null
  piecesUsed: number
  weightUsedCt: number
  lineCost: number
}

export interface InventoryItemDetail extends InventoryItem {
  usageActivities: InventoryUsageActivity[]
  manufacturingActivities: InventoryManufacturingActivity[]
}

export interface UsageBatch {
  id: number
  productCategory: string
  transactionDate: string | null
  requesterName: string | null
  productCode: string | null
  totalAmount: number | null
  lineCount: number
}

export interface UsageLine {
  id: number
  gemstoneNumber: number | null
  gemstoneName: string | null
  usedPcs: number | null
  usedWeightCt: number | null
  unitPriceRaw: string | null
  lineAmount: number | null
  balancePcsAfter: number | null
  balanceCtAfter: number | null
  requesterName: string | null
}

export interface UsageBatchDetail {
  id: number
  productCategory: string
  transactionDate: string | null
  requesterName: string | null
  productCode: string | null
  totalAmount: number | null
  sourceSheet: string
  sourceRow: number | null
  lines: UsageLine[]
}

export interface PagedResponse<T> {
  items: T[]
  totalCount: number
  limit: number
  offset: number
}

export interface Customer {
  id: string
  name: string
  nickname: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  photoUrl: string | null
  customerSince: string | null
  createdAtUtc: string
  updatedAtUtc: string
  totalSpent: number
  purchaseCount: number
}

export interface CustomerActivity {
  id: number
  projectId: number
  manufacturingCode: string
  pieceName: string
  status: string
  activityAtUtc: string
  craftsmanName: string | null
  notes: string | null
}

export interface CustomerUpsertRequest {
  name: string
  nickname?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  photoUrl?: string | null
  customerSince?: string | null
}

export interface ManufacturingGemstone {
  id: number
  inventoryItemId: number | null
  gemstoneCode: string | null
  gemstoneType: string | null
  piecesUsed: number
  weightUsedCt: number
  lineCost: number
  notes: string | null
}

export interface ManufacturingActivityLog {
  id: number
  status: string
  activityAtUtc: string
  craftsmanName: string | null
  notes: string | null
  photos: string[]
}

export interface ManufacturingProjectSummary {
  id: number
  manufacturingCode: string
  pieceName: string
  pieceType: string | null
  designDate: string | null
  designerName: string | null
  status: string
  craftsmanName: string | null
  metalPlating: string[]
  settingCost: number
  diamondCost: number
  gemstoneCost: number
  totalCost: number
  sellingPrice: number
  completionDate: string | null
  customerId: string | null
  customerName: string | null
  soldAt: string | null
  createdAtUtc: string
  updatedAtUtc: string
  gemstoneCount: number
  customFields: Record<string, string | null>
}

export interface ManufacturingProjectDetail {
  id: number
  manufacturingCode: string
  pieceName: string
  pieceType: string | null
  designDate: string | null
  designerName: string | null
  status: string
  craftsmanName: string | null
  metalPlating: string[]
  metalPlatingNotes: string | null
  settingCost: number
  diamondCost: number
  gemstoneCost: number
  totalCost: number
  sellingPrice: number
  completionDate: string | null
  usageNotes: string | null
  photos: string[]
  customerId: string | null
  customerName: string | null
  soldAt: string | null
  createdAtUtc: string
  updatedAtUtc: string
  gemstones: ManufacturingGemstone[]
  activityLog: ManufacturingActivityLog[]
  customFields: Record<string, string | null>
}

export interface ManufacturingGemstoneUpsertRequest {
  inventoryItemId?: number | null
  gemstoneCode?: string | null
  gemstoneType?: string | null
  piecesUsed?: number | null
  weightUsedCt?: number | null
  lineCost?: number | null
  notes?: string | null
}

export interface ManufacturingProjectUpsertRequest {
  manufacturingCode?: string | null
  pieceName?: string | null
  pieceType?: string | null
  designDate?: string | null
  designerName?: string | null
  status?: string | null
  craftsmanName?: string | null
  metalPlating?: string[] | null
  metalPlatingNotes?: string | null
  settingCost?: number | null
  diamondCost?: number | null
  gemstoneCost?: number | null
  totalCost?: number | null
  sellingPrice?: number | null
  completionDate?: string | null
  usageNotes?: string | null
  photos?: string[] | null
  customerId?: string | null
  soldAt?: string | null
  gemstones?: ManufacturingGemstoneUpsertRequest[] | null
  activityNote?: string | null
  activityPhotos?: string[] | null
  customFields?: Record<string, string | null> | null
}

export interface ManufacturingPerson {
  id: number
  role: 'designer' | 'craftsman'
  name: string
  email: string | null
  phone: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export interface ManufacturingPersonUpsertRequest {
  role: 'designer' | 'craftsman'
  name: string
  email?: string | null
  phone?: string | null
  isActive?: boolean
}

export interface ManufacturingPersonProfile {
  person: ManufacturingPerson
  projects: ManufacturingProjectSummary[]
}

export interface ManufacturingProcessStep {
  stepKey: string
  label: string
  sortOrder: number
  requirePhoto: boolean
  requireComment: boolean
  isActive: boolean
}

export interface ManufacturingCustomField {
  fieldKey: string
  label: string
  fieldType: 'text' | 'textarea' | 'number' | 'date' | 'select'
  sortOrder: number
  isRequired: boolean
  isActive: boolean
  isSystem: boolean
  options: string[]
}

export interface ManufacturingSettings {
  steps: ManufacturingProcessStep[]
  fields: ManufacturingCustomField[]
  designers: ManufacturingPerson[]
  craftsmen: ManufacturingPerson[]
}

export interface ManufacturingProcessStepUpsertRequest {
  stepKey?: string | null
  label?: string | null
  sortOrder?: number | null
  requirePhoto?: boolean
  requireComment?: boolean
  isActive?: boolean
}

export interface ManufacturingCustomFieldUpsertRequest {
  fieldKey?: string | null
  label?: string | null
  fieldType?: string | null
  sortOrder?: number | null
  isRequired?: boolean
  isActive?: boolean
  options?: string[] | null
}

export interface ManufacturingSettingsUpdateRequest {
  steps?: ManufacturingProcessStepUpsertRequest[] | null
  fields?: ManufacturingCustomFieldUpsertRequest[] | null
}

export interface ManufacturingNoteParseResponse {
  manufacturingCode: string | null
  pieceName: string | null
  pieceType: string | null
  status: string
  designerName: string | null
  craftsmanName: string | null
  usageNotes: string | null
  totalCost: number | null
  sellingPrice: number | null
  customFields: Record<string, string | null>
  gemstones: ManufacturingGemstoneUpsertRequest[]
}

export interface AnalyticsCurrentMonth {
  revenue: number
  transactions: number
  startDateUtc: string
}

export interface AnalyticsTotals {
  revenue: number
  orders: number
  avgOrderValue: number
  customers: number
  customersWithPurchases: number
}

export interface AnalyticsMonthlyRevenuePoint {
  month: string
  revenue: number
  customers: number
  orders: number
}

export interface AnalyticsTopCustomerPoint {
  customerId: string
  customerName: string
  totalSpent: number
  purchases: number
  lastPurchaseUtc: string
}

export interface AnalyticsOverview {
  currentMonth: AnalyticsCurrentMonth
  totals: AnalyticsTotals
  monthlyRevenue: AnalyticsMonthlyRevenuePoint[]
  topCustomers: AnalyticsTopCustomerPoint[]
}
