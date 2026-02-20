import type { AppRole } from '../types/role'

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  role: AppRole
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
