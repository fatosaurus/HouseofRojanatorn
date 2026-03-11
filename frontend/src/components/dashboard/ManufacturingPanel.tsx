import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Expand, Pencil, Plus, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createCustomer,
  createManufacturingProject,
  getCustomers,
  getManufacturingProject,
  getManufacturingProjects,
  getManufacturingSettings,
  parseManufacturingNote,
  updateManufacturingProject
} from '../../api/client'
import type {
  ManufacturingCustomField,
  ManufacturingGemstoneUpsertRequest,
  Customer,
  ManufacturingProjectDetail,
  ManufacturingProjectSummary,
  ManufacturingSettings
} from '../../api/types'
import { ImageDropzone } from '../common/ImageDropzone'
import { usePagedSelection } from '../common/usePagedSelection'

const DEFAULT_PIECE_TYPE_OPTIONS = ['earrings', 'bracelet', 'choker', 'necklace', 'brooch', 'ring', 'pendant', 'other']
const DEFAULT_STATUS_OPTIONS = ['approved', 'sent_to_craftsman', 'internal_setting_qc', 'diamond_sorting', 'stone_setting', 'plating', 'final_piece_qc', 'complete_piece', 'ready_for_sale', 'sold']
const DEFAULT_MATERIAL_OPTIONS = ['Silver', '10K Gold', '18K Gold']
const DEFAULT_METAL_PLATING_OPTIONS = ['White Gold', 'Gold', 'Rose Gold']
const READY_FOR_SALE_STATUS = 'ready_for_sale'
const SOLD_STATUS = 'sold'

function labelize(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getInitial(value: string): string {
  const normalized = value.trim()
  return normalized ? normalized.charAt(0).toUpperCase() : '?'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string' || result.length === 0) {
        reject(new Error('Unable to read selected image.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Unable to read selected image.'))
    reader.readAsDataURL(file)
  })
}

interface OcrWorkerResult {
  data?: {
    text?: string
  }
}

interface OcrWorker {
  recognize(source: File): Promise<OcrWorkerResult>
  terminate(): Promise<void>
}

interface OcrRuntime {
  createWorker(language: string): Promise<OcrWorker>
}

declare global {
  interface Window {
    Tesseract?: OcrRuntime
  }
}

async function ensureOcrRuntime(): Promise<OcrRuntime> {
  if (window.Tesseract) {
    return window.Tesseract
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ocr-runtime="tesseract"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Unable to load OCR runtime.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
    script.dataset.ocrRuntime = 'tesseract'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Unable to load OCR runtime.')), { once: true })
    document.head.appendChild(script)
  })

  if (!window.Tesseract) {
    throw new Error('OCR runtime unavailable.')
  }

  return window.Tesseract
}

interface ProjectDraft {
  manufacturingCode: string
  pieceName: string
  pieceType: string
  material: string
  status: string
  designerName: string
  craftsmanName: string
  customOrder: boolean
  customerId: string | null
  customerLookup: string
  settingCost: string
  diamondCost: string
  budget: string
  sellingPrice: string
  maximumDiscountedPrice: string
  metalPlating: string
  usageNotes: string
  photos: string[]
  gemstones: ManufacturingGemstoneUpsertRequest[]
  customFields: Record<string, string>
}

interface CustomerFormDraft {
  name: string
  nickname: string
  email: string
  phone: string
  address: string
  notes: string
}

const EMPTY_CUSTOMER_FORM: CustomerFormDraft = {
  name: '',
  nickname: '',
  email: '',
  phone: '',
  address: '',
  notes: ''
}

interface InventorySaleDraft {
  projectId: number
  manufacturingCode: string
  pieceName: string
  customerLookup: string
  customerId: string | null
  soldPrice: string
}

function buildDraft(defaultStatus: string, fields: ManufacturingCustomField[]): ProjectDraft {
  const customFields: Record<string, string> = {}
  for (const field of fields) {
    if (!field.isSystem && field.isActive) {
      customFields[field.fieldKey] = ''
    }
  }

  return {
    manufacturingCode: '',
    pieceName: '',
    pieceType: 'necklace',
    material: '',
    status: defaultStatus,
    designerName: '',
    craftsmanName: '',
    customOrder: false,
    customerId: null,
    customerLookup: '',
    settingCost: '0',
    diamondCost: '0',
    budget: '',
    sellingPrice: '0',
    maximumDiscountedPrice: '0',
    metalPlating: '',
    usageNotes: '',
    photos: [],
    gemstones: [],
    customFields
  }
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}

function calculateGemstoneCost(gemstones: ManufacturingGemstoneUpsertRequest[]): number {
  const total = gemstones.reduce((sum, gemstone) => sum + (gemstone.lineCost ?? 0), 0)
  return roundCurrency(total)
}

function parseAmount(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function parseNullableAmount(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function hasReachedStatus(
  currentStatus: string,
  targetStatus: string,
  stepOrderLookup: Record<string, number>
): boolean {
  const currentOrder = stepOrderLookup[currentStatus] ?? -1
  const targetOrder = stepOrderLookup[targetStatus] ?? -1

  if (targetOrder < 0) {
    return true
  }

  return currentOrder >= targetOrder
}

function normalizeSelection(value: string): string {
  return value.trim()
}

function areSamePhotos(first: string[], second: string[]): boolean {
  if (first.length !== second.length) {
    return false
  }

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false
    }
  }

  return true
}

function withSelectedOption(options: string[], selected: string): string[] {
  if (!selected.trim()) {
    return options
  }

  if (options.some(option => option === selected)) {
    return options
  }

  return [selected, ...options]
}

function customerPreviewImage(customer: Customer): string | null {
  if (customer.photos.length > 0) {
    return customer.photos[0]
  }

  return customer.photoUrl
}

function customerSearchText(customer: Customer): string {
  return `${customer.name} ${customer.nickname ?? ''} ${customer.email ?? ''} ${customer.phone ?? ''}`
    .trim()
    .toLowerCase()
}

function mapDetailToDraft(detail: ManufacturingProjectDetail, fields: ManufacturingCustomField[]): ProjectDraft {
  const customFields: Record<string, string> = {}
  for (const field of fields) {
    if (!field.isSystem && field.isActive) {
      customFields[field.fieldKey] = detail.customFields[field.fieldKey] ?? ''
    }
  }

  return {
    manufacturingCode: detail.manufacturingCode,
    pieceName: detail.pieceName,
    pieceType: detail.pieceType ?? 'other',
    material: detail.material ?? '',
    status: detail.status,
    designerName: detail.designerName ?? '',
    craftsmanName: detail.craftsmanName ?? '',
    customOrder: detail.customOrder,
    customerId: detail.customerId,
    customerLookup: detail.customerName ?? '',
    settingCost: String(detail.settingCost),
    diamondCost: String(detail.diamondCost),
    budget: detail.budget != null ? String(detail.budget) : '',
    sellingPrice: String(detail.sellingPrice),
    maximumDiscountedPrice: String(detail.maximumDiscountedPrice),
    metalPlating: detail.metalPlating[0] ?? '',
    usageNotes: detail.usageNotes ?? '',
    photos: detail.photos,
    gemstones: detail.gemstones.map(gem => ({
      inventoryItemId: gem.inventoryItemId,
      gemstoneCode: gem.gemstoneCode,
      gemstoneType: gem.gemstoneType,
      piecesUsed: gem.piecesUsed,
      weightUsedCt: gem.weightUsedCt,
      lineCost: gem.lineCost,
      notes: gem.notes
    })),
    customFields
  }
}

interface ManufacturingRoute {
  view: 'records' | 'inventory'
  mode: 'list' | 'create' | 'detail' | 'edit'
  detailId: number | null
  isFull: boolean
  isInvalid: boolean
}

function buildManufacturingBasePath(view: ManufacturingRoute['view']): string {
  return view === 'inventory'
    ? '/dashboard/manufacturing/inventory'
    : '/dashboard/manufacturing'
}

function buildManufacturingDetailPath(
  view: ManufacturingRoute['view'],
  detailId: number,
  suffix?: 'full' | 'edit'
): string {
  const base = view === 'inventory'
    ? `/dashboard/manufacturing/inventory/${detailId}`
    : `/dashboard/manufacturing/${detailId}`

  if (!suffix) {
    return base
  }

  return `${base}/${suffix}`
}

function parseManufacturingRoute(pathname: string): ManufacturingRoute {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'manufacturing') {
    return { view: 'records', mode: 'list', detailId: null, isFull: false, isInvalid: false }
  }

  const segment = parts[2]

  if (!segment) {
    return { view: 'records', mode: 'list', detailId: null, isFull: false, isInvalid: parts.length > 2 }
  }

  if (segment === 'new') {
    return {
      view: 'records',
      mode: 'create',
      detailId: null,
      isFull: false,
      isInvalid: parts.length > 3
    }
  }

  if (segment === 'inventory') {
    const detailSegment = parts[3]
    const fullSegment = parts[4]

    if (!detailSegment) {
      return {
        view: 'inventory',
        mode: 'list',
        detailId: null,
        isFull: false,
        isInvalid: parts.length > 3
      }
    }

    const detailId = Number(detailSegment)
    if (!Number.isInteger(detailId) || detailId <= 0) {
      return { view: 'inventory', mode: 'list', detailId: null, isFull: false, isInvalid: true }
    }

    if (!fullSegment) {
      return {
        view: 'inventory',
        mode: 'detail',
        detailId,
        isFull: false,
        isInvalid: parts.length > 4
      }
    }

    if (fullSegment === 'full') {
      return {
        view: 'inventory',
        mode: 'detail',
        detailId,
        isFull: true,
        isInvalid: parts.length > 5
      }
    }

    return { view: 'inventory', mode: 'detail', detailId, isFull: false, isInvalid: true }
  }

  const fullSegment = parts[3]

  const detailId = Number(segment)
  if (!Number.isInteger(detailId) || detailId <= 0) {
    return { view: 'records', mode: 'list', detailId: null, isFull: false, isInvalid: true }
  }

  if (!fullSegment) {
    return {
      view: 'records',
      mode: 'detail',
      detailId,
      isFull: false,
      isInvalid: parts.length > 3
    }
  }

  if (fullSegment === 'full') {
    return {
      view: 'records',
      mode: 'detail',
      detailId,
      isFull: true,
      isInvalid: parts.length > 4
    }
  }

  if (fullSegment === 'edit') {
    return {
      view: 'records',
      mode: 'edit',
      detailId,
      isFull: false,
      isInvalid: parts.length > 4
    }
  }

  return { view: 'records', mode: 'detail', detailId, isFull: false, isInvalid: true }
}

interface DetailContentProps {
  selected: ManufacturingProjectDetail
  selectedStatus: string
  customFieldLabels: Record<string, string>
  stepRequirementsByStatus: Record<string, { requirePhoto: boolean, requireComment: boolean }>
  statusNote: string
  pendingStepPhotos: string[]
  hasExistingStepPhotoEvidence: boolean
  isSaving: boolean
  canSubmitStatusUpdate: boolean
  projectGalleryPhotos: string[]
  canSaveProjectGallery: boolean
  onStatusNoteChange: (value: string) => void
  onPendingStepPhotosChange: (photos: string[]) => void
  onProjectGalleryPhotosChange: (photos: string[]) => void
  onSaveStep: () => void
  onSaveProjectGallery: () => void
}

function ManufacturingDetailContent({
  selected,
  selectedStatus,
  customFieldLabels,
  stepRequirementsByStatus,
  statusNote,
  pendingStepPhotos,
  hasExistingStepPhotoEvidence,
  isSaving,
  canSubmitStatusUpdate,
  projectGalleryPhotos,
  canSaveProjectGallery,
  onStatusNoteChange,
  onPendingStepPhotosChange,
  onProjectGalleryPhotosChange,
  onSaveStep,
  onSaveProjectGallery
}: DetailContentProps) {
  const selectedRequirements = stepRequirementsByStatus[selectedStatus]

  return (
    <>
      <div className="drawer-grid">
        <p><strong>Type:</strong> {labelize(selected.pieceType)}</p>
        <p><strong>Material:</strong> {selected.material ?? '-'}</p>
        <p><strong>Status:</strong> {labelize(selected.status)}</p>
        <p><strong>Custom Order:</strong> {selected.customOrder ? 'Yes' : 'No'}</p>
        <p><strong>Design Date:</strong> {formatDate(selected.designDate)}</p>
        <p><strong>Completion Date:</strong> {formatDate(selected.completionDate)}</p>
        <p><strong>Designer:</strong> {selected.designerName ?? '-'}</p>
        <p><strong>Craftsman:</strong> {selected.craftsmanName ?? '-'}</p>
        <p><strong>Metal Plating:</strong> {selected.metalPlating.length > 0 ? selected.metalPlating.map(value => labelize(value)).join(', ') : '-'}</p>
        <p><strong>Plating Notes:</strong> {selected.metalPlatingNotes ?? '-'}</p>
        <p><strong>Setting Cost:</strong> {formatCurrency(selected.settingCost)}</p>
        <p><strong>Diamond Cost:</strong> {formatCurrency(selected.diamondCost)}</p>
        <p><strong>Gemstone Cost:</strong> {formatCurrency(selected.gemstoneCost)}</p>
        <p><strong>Budget:</strong> {selected.budget != null ? formatCurrency(selected.budget) : '-'}</p>
        <p><strong>Selling Price:</strong> {formatCurrency(selected.sellingPrice)}</p>
        <p><strong>Maximum Discounted:</strong> {formatCurrency(selected.maximumDiscountedPrice)}</p>
        <p><strong>Total Cost:</strong> {formatCurrency(selected.totalCost)}</p>
        <p><strong>Customer:</strong> {selected.customerName ?? '-'}</p>
        <p><strong>Sold At:</strong> {formatDate(selected.soldAt)}</p>
        <p><strong>Created:</strong> {formatDate(selected.createdAtUtc)}</p>
        <p><strong>Updated:</strong> {formatDate(selected.updatedAtUtc)}</p>
      </div>

      {Object.keys(selected.customFields).length > 0 ? (
        <div className="usage-lines">
          <h4>Custom Fields</h4>
          <div className="activity-list">
            {Object.entries(selected.customFields).map(([key, value]) => (
              <article key={key}>
                <p><strong>{customFieldLabels[key] ?? labelize(key)}</strong></p>
                <p>{value ?? '-'}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="usage-lines">
        <h4>Step Evidence</h4>
        {(selectedRequirements?.requirePhoto || selectedRequirements?.requireComment) ? (
          <p className="panel-placeholder">
            {labelize(selectedStatus)} requires:
            {' '}
            {selectedRequirements?.requirePhoto ? 'photo' : 'no photo'}
            {' / '}
            {selectedRequirements?.requireComment ? 'comment' : 'no comment'}
            {selectedRequirements?.requirePhoto && hasExistingStepPhotoEvidence ? ' (existing photo evidence found)' : ''}
          </p>
        ) : null}
        <label className="step-evidence-label">
          Step Comment
          <textarea
            rows={2}
            value={statusNote}
            onChange={event => onStatusNoteChange(event.target.value)}
            placeholder="Describe what was completed at this step..."
          />
        </label>
        <ImageDropzone
          title="Step Photos"
          images={pendingStepPhotos}
          onChange={onPendingStepPhotosChange}
          maxFiles={8}
          helperText="Upload proof for this step. Photos are attached to the activity log after you save."
          onSave={onSaveStep}
          saveLabel="Save Step"
          isSaving={isSaving}
          saveDisabled={!canSubmitStatusUpdate}
        />
      </div>

      {selected.usageNotes ? (
        <div className="usage-lines">
          <h4>Notes</h4>
          <p>{selected.usageNotes}</p>
        </div>
      ) : null}

      <div className="usage-lines">
        <h4>Project Gallery ({projectGalleryPhotos.length})</h4>
        <ImageDropzone
          title="Upload Project Gallery Photos"
          images={projectGalleryPhotos}
          onChange={onProjectGalleryPhotosChange}
          maxFiles={24}
          helperText="Drag/drop or add multiple images. Use Save Gallery to persist in this manufacturing record."
          onSave={onSaveProjectGallery}
          saveLabel="Save Gallery"
          isSaving={isSaving}
          saveDisabled={!canSaveProjectGallery}
        />
      </div>

      <div className="usage-lines">
        <h4>Gemstones ({selected.gemstones.length})</h4>
        {selected.gemstones.length === 0 ? (
          <p className="panel-placeholder">No gemstones linked yet.</p>
        ) : (
          <div className="activity-list">
            {selected.gemstones.map(gem => (
              <article key={gem.id}>
                <p>
                  <strong>{gem.gemstoneCode ?? `#${gem.inventoryItemId ?? '?'}`}</strong>
                  {' • '}
                  {gem.gemstoneType ?? 'Unknown'}
                </p>
                <p>{gem.weightUsedCt} ct / {gem.piecesUsed} pcs</p>
                <p>
                  Price:
                  {' '}
                  {gem.pricePerCt != null && gem.pricePerCt > 0 ? `${formatCurrency(gem.pricePerCt)} / ct` : '-'}
                  {' • '}
                  {gem.pricePerPiece != null && gem.pricePerPiece > 0 ? `${formatCurrency(gem.pricePerPiece)} / pc` : '-'}
                </p>
                <p>{formatCurrency(gem.lineCost)}</p>
                {gem.notes ? <p>{gem.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="usage-lines">
        <h4>Activity Log ({selected.activityLog.length})</h4>
        {selected.activityLog.length === 0 ? (
          <p className="panel-placeholder">No activity entries yet.</p>
        ) : (
          <div className="activity-list">
            {selected.activityLog.map(entry => (
              <article key={entry.id}>
                <p>
                  <strong>{labelize(entry.status)}</strong>
                  {' • '}
                  {formatDate(entry.activityAtUtc)}
                </p>
                {entry.notes ? <p>{entry.notes}</p> : null}
                {entry.photos.length > 0 ? (
                  <div className="activity-photo-grid">
                    {entry.photos.map((photo, index) => (
                      <a key={`${entry.id}-${index}`} href={photo} target="_blank" rel="noreferrer" className="activity-photo-item">
                        <img src={photo} alt={`Step evidence ${index + 1}`} />
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function ManufacturingPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parseManufacturingRoute(location.pathname), [location.pathname])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [records, setRecords] = useState<ManufacturingProjectSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState<ManufacturingSettings | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  const [selected, setSelected] = useState<ManufacturingProjectDetail | null>(null)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [pendingStepPhotos, setPendingStepPhotos] = useState<string[]>([])
  const [projectGalleryPhotos, setProjectGalleryPhotos] = useState<string[]>([])

  const [createMode, setCreateMode] = useState<'upload' | 'manual'>('upload')
  const [draft, setDraft] = useState<ProjectDraft>(() => buildDraft('approved', []))
  const [editDraft, setEditDraft] = useState<ProjectDraft>(() => buildDraft('approved', []))
  const [isSaving, setIsSaving] = useState(false)

  const [noteFile, setNoteFile] = useState<File | null>(null)
  const [isDraggingNote, setIsDraggingNote] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerModalTarget, setCustomerModalTarget] = useState<'draft' | 'edit'>('draft')
  const [customerDraft, setCustomerDraft] = useState<CustomerFormDraft>(EMPTY_CUSTOMER_FORM)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [inventorySaleDraft, setInventorySaleDraft] = useState<InventorySaleDraft | null>(null)
  const recordsCollection = usePagedSelection({
    items: records,
    getId: item => item.id,
    initialPageSize: 10
  })

  useEffect(() => {
    if (route.isInvalid) {
      navigate(buildManufacturingBasePath(route.view), { replace: true })
    }
  }, [navigate, route.isInvalid, route.view])

  const statusOptions = useMemo(() => {
    const options = settings?.statusOptions.length ? settings.statusOptions : DEFAULT_STATUS_OPTIONS
    return options.filter(option => option.trim().length > 0)
  }, [settings?.statusOptions])

  const pieceTypeOptions = useMemo(
    () => (settings?.pieceTypeOptions.length ? settings.pieceTypeOptions : DEFAULT_PIECE_TYPE_OPTIONS),
    [settings?.pieceTypeOptions]
  )

  const activeFields = useMemo(() => {
    if (!settings) {
      return [
        {
          fieldKey: 'designerName',
          label: 'Designer',
          fieldType: 'text',
          sortOrder: 1,
          isRequired: false,
          isActive: true,
          isSystem: true,
          options: []
        },
        {
          fieldKey: 'craftsmanName',
          label: 'Craftsman',
          fieldType: 'text',
          sortOrder: 2,
          isRequired: false,
          isActive: true,
          isSystem: true,
          options: []
        }
      ] satisfies ManufacturingCustomField[]
    }

    return settings.fields
      .filter(field => field.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [settings])

  const defaultStatus = statusOptions[0] ?? 'approved'

  const stepRequirementsByStatus = useMemo(() => {
    const requirements: Record<string, { requirePhoto: boolean, requireComment: boolean }> = {}
    if (!settings) {
      return requirements
    }

    for (const step of settings.steps) {
      requirements[step.stepKey] = {
        requirePhoto: step.requirePhoto,
        requireComment: step.requireComment
      }
    }

    return requirements
  }, [settings])

  const customFieldLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const field of activeFields) {
      labels[field.fieldKey] = field.label
    }
    return labels
  }, [activeFields])

  const draftGemstoneCost = useMemo(() => calculateGemstoneCost(draft.gemstones), [draft.gemstones])
  const editGemstoneCost = useMemo(() => calculateGemstoneCost(editDraft.gemstones), [editDraft.gemstones])
  const draftTotalCost = useMemo(
    () => roundCurrency(parseAmount(draft.settingCost) + parseAmount(draft.diamondCost) + draftGemstoneCost),
    [draft.diamondCost, draft.settingCost, draftGemstoneCost]
  )
  const editTotalCost = useMemo(
    () => roundCurrency(parseAmount(editDraft.settingCost) + parseAmount(editDraft.diamondCost) + editGemstoneCost),
    [editDraft.diamondCost, editDraft.settingCost, editGemstoneCost]
  )
  const draftSuggestedSellingPrice = useMemo(() => roundCurrency(draftTotalCost * 3.5), [draftTotalCost])
  const editSuggestedSellingPrice = useMemo(() => roundCurrency(editTotalCost * 3.5), [editTotalCost])
  const draftBudget = useMemo(() => parseNullableAmount(draft.budget), [draft.budget])
  const editBudget = useMemo(() => parseNullableAmount(editDraft.budget), [editDraft.budget])
  const draftBudgetWarning = useMemo(
    () => draftBudget != null && draftSuggestedSellingPrice > draftBudget,
    [draftBudget, draftSuggestedSellingPrice]
  )
  const editBudgetWarning = useMemo(
    () => editBudget != null && editSuggestedSellingPrice > editBudget,
    [editBudget, editSuggestedSellingPrice]
  )

  const designerOptions = useMemo(() => (settings?.designers ?? []).map(item => item.name), [settings?.designers])
  const craftsmanOptions = useMemo(() => (settings?.craftsmen ?? []).map(item => item.name), [settings?.craftsmen])
  const materialOptions = useMemo(
    () => (settings?.materialOptions.length ? settings.materialOptions : DEFAULT_MATERIAL_OPTIONS),
    [settings?.materialOptions]
  )
  const metalPlatingOptions = useMemo(
    () => (settings?.metalPlatingOptions.length ? settings.metalPlatingOptions : DEFAULT_METAL_PLATING_OPTIONS),
    [settings?.metalPlatingOptions]
  )
  const draftPieceTypeOptions = useMemo(
    () => withSelectedOption(pieceTypeOptions, draft.pieceType),
    [pieceTypeOptions, draft.pieceType]
  )
  const editPieceTypeOptions = useMemo(
    () => withSelectedOption(pieceTypeOptions, editDraft.pieceType),
    [pieceTypeOptions, editDraft.pieceType]
  )
  const draftMaterialOptions = useMemo(
    () => withSelectedOption(materialOptions, draft.material),
    [materialOptions, draft.material]
  )
  const editMaterialOptions = useMemo(
    () => withSelectedOption(materialOptions, editDraft.material),
    [materialOptions, editDraft.material]
  )
  const draftStatusOptions = useMemo(
    () => withSelectedOption(statusOptions, draft.status),
    [statusOptions, draft.status]
  )
  const editStatusOptions = useMemo(
    () => withSelectedOption(statusOptions, editDraft.status),
    [statusOptions, editDraft.status]
  )
  const customerLookupByName = useMemo(() => {
    const lookup = new Map<string, Customer>()
    for (const customer of customers) {
      lookup.set(customer.name.trim().toLowerCase(), customer)
    }
    return lookup
  }, [customers])
  const draftCustomerCandidates = useMemo(() => {
    const lookup = draft.customerLookup.trim().toLowerCase()
    if (!lookup) {
      return customers.slice(0, 8)
    }

    return customers
      .filter(customer => customerSearchText(customer).includes(lookup))
      .slice(0, 8)
  }, [customers, draft.customerLookup])
  const editCustomerCandidates = useMemo(() => {
    const lookup = editDraft.customerLookup.trim().toLowerCase()
    if (!lookup) {
      return customers.slice(0, 8)
    }

    return customers
      .filter(customer => customerSearchText(customer).includes(lookup))
      .slice(0, 8)
  }, [customers, editDraft.customerLookup])
  const inventoryCustomerCandidates = useMemo(() => {
    const lookup = inventorySaleDraft?.customerLookup.trim().toLowerCase() ?? ''
    if (!lookup) {
      return customers.slice(0, 8)
    }

    return customers
      .filter(customer => customerSearchText(customer).includes(lookup))
      .slice(0, 8)
  }, [customers, inventorySaleDraft?.customerLookup])
  const stepOrderLookup = useMemo(() => {
    const lookup: Record<string, number> = {}
    statusOptions.forEach((status, index) => {
      lookup[status] = index
    })
    return lookup
  }, [statusOptions])
  const draftCanSetSettingCost = useMemo(
    () => hasReachedStatus(draft.status, 'sent_to_craftsman', stepOrderLookup),
    [draft.status, stepOrderLookup]
  )
  const draftCanSetDiamondCost = useMemo(
    () => hasReachedStatus(draft.status, 'diamond_sorting', stepOrderLookup),
    [draft.status, stepOrderLookup]
  )
  const editCanSetSettingCost = useMemo(
    () => hasReachedStatus(editDraft.status, 'sent_to_craftsman', stepOrderLookup),
    [editDraft.status, stepOrderLookup]
  )
  const editCanSetDiamondCost = useMemo(
    () => hasReachedStatus(editDraft.status, 'diamond_sorting', stepOrderLookup),
    [editDraft.status, stepOrderLookup]
  )

  const hasExistingStepPhotoEvidence = useMemo(() => {
    if (!selected || !selectedStatus) {
      return false
    }

    if (selected.photos.length > 0) {
      return true
    }

    return selected.activityLog.some(entry => entry.status === selectedStatus && entry.photos.length > 0)
  }, [selected, selectedStatus])

  const hasCurrentStepPhotoEvidence = useMemo(() => {
    if (!selected) {
      return false
    }

    if (selected.photos.length > 0) {
      return true
    }

    return selected.activityLog.some(entry => entry.status === selected.status && entry.photos.length > 0)
  }, [selected])

  const hasCurrentStepCommentEvidence = useMemo(() => {
    if (!selected) {
      return false
    }

    if (selected.usageNotes?.trim()) {
      return true
    }

    return selected.activityLog.some(entry => entry.status === selected.status && Boolean(entry.notes?.trim()))
  }, [selected])

  const hasPendingStepPhotoEvidence = pendingStepPhotos.length > 0
  const hasPendingStepCommentEvidence = statusNote.trim().length > 0

  const stepAdvanceWarning = useMemo(() => {
    if (!selected || !selectedStatus || selectedStatus === selected.status) {
      return null
    }

    const currentOrder = stepOrderLookup[selected.status]
    const nextOrder = stepOrderLookup[selectedStatus]
    if (typeof currentOrder === 'number' && typeof nextOrder === 'number' && nextOrder <= currentOrder) {
      return null
    }

    const currentRequirements = stepRequirementsByStatus[selected.status]
    if (!currentRequirements) {
      return null
    }

    const hasPhotoEvidence = hasCurrentStepPhotoEvidence || hasPendingStepPhotoEvidence
    const hasCommentEvidence = hasCurrentStepCommentEvidence || hasPendingStepCommentEvidence

    if (currentRequirements.requirePhoto && !hasPhotoEvidence) {
      return `Complete the required photo evidence for ${labelize(selected.status)} before moving to ${labelize(selectedStatus)}.`
    }

    if (currentRequirements.requireComment && !hasCommentEvidence) {
      return `Complete the required comment for ${labelize(selected.status)} before moving to ${labelize(selectedStatus)}.`
    }

    return null
  }, [
    hasCurrentStepCommentEvidence,
    hasCurrentStepPhotoEvidence,
    hasPendingStepCommentEvidence,
    hasPendingStepPhotoEvidence,
    selected,
    selectedStatus,
    stepOrderLookup,
    stepRequirementsByStatus
  ])

  const canSubmitStatusUpdate = useMemo(() => {
    if (!selected || !selectedStatus) {
      return false
    }

    if (stepAdvanceWarning) {
      return false
    }

    if (selectedStatus !== selected.status) {
      return true
    }

    return hasPendingStepCommentEvidence || hasPendingStepPhotoEvidence
  }, [hasPendingStepCommentEvidence, hasPendingStepPhotoEvidence, selected, selectedStatus, stepAdvanceWarning])

  const canSaveProjectGallery = useMemo(() => {
    if (!selected) {
      return false
    }

    return !areSamePhotos(projectGalleryPhotos, selected.photos)
  }, [projectGalleryPhotos, selected])

  async function loadRecords(currentSearch: string, currentStatus: string) {
    setIsLoading(true)
    setError(null)

    try {
      const page = await getManufacturingProjects({
        search: currentSearch,
        status: currentStatus,
        limit: 5000,
        offset: 0
      })
      setRecords(page.items)
      setTotalCount(page.totalCount)
    } catch {
      setError('Unable to load manufacturing records.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSettings() {
    setIsLoadingSettings(true)
    try {
      const loaded = await getManufacturingSettings()
      setSettings(loaded)
    } catch {
      setError('Unable to load manufacturing settings.')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  async function loadCustomers() {
    setIsLoadingCustomers(true)
    try {
      const page = await getCustomers({
        limit: 300,
        offset: 0
      })
      setCustomers(page.items)
    } catch {
      setError('Unable to load customers for custom order selection.')
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  useEffect(() => {
    const effectiveStatusFilter = route.view === 'inventory'
      ? READY_FOR_SALE_STATUS
      : statusFilter
    void loadRecords(search, effectiveStatusFilter)
  }, [route.view, search, statusFilter])

  useEffect(() => {
    void loadSettings()
    void loadCustomers()
  }, [])

  useEffect(() => {
    if (route.mode === 'create') {
      setCreateMode('upload')
      setNoteFile(null)
      setDraft(buildDraft(defaultStatus, activeFields))
    }
  }, [activeFields, defaultStatus, route.mode])

  useEffect(() => {
    if ((route.mode !== 'detail' && route.mode !== 'edit') || !route.detailId) {
      setSelected(null)
      setSelectedStatus('')
      setStatusNote('')
      setPendingStepPhotos([])
      setProjectGalleryPhotos([])
      setIsLoadingDetail(false)
      return
    }

    let cancelled = false
    setIsLoadingDetail(true)
    setError(null)

    void getManufacturingProject(route.detailId)
      .then(detail => {
        if (!cancelled) {
          setSelected(detail)
          setSelectedStatus(detail.status)
          setProjectGalleryPhotos(detail.photos)
          if (route.mode === 'edit') {
            setEditDraft(mapDetailToDraft(detail, activeFields))
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load selected manufacturing project.')
          setSelected(null)
          setSelectedStatus('')
          setProjectGalleryPhotos([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeFields, route.detailId, route.mode])

  useEffect(() => {
    setStatusNote('')
    setPendingStepPhotos([])
  }, [selectedStatus, route.detailId])

  async function analyzeNote() {
    if (!noteFile) {
      setError('Choose a note photo before analysis.')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const ocrRuntime = await ensureOcrRuntime()
      let worker: OcrWorker
      try {
        worker = await ocrRuntime.createWorker('eng+tha')
      } catch {
        worker = await ocrRuntime.createWorker('eng')
      }
      const result = await worker.recognize(noteFile)
      await worker.terminate()

      const noteText = result.data?.text ?? ''
      const parsed = await parseManufacturingNote(noteText)
      const notePhoto = await readFileAsDataUrl(noteFile)
      setDraft(current => ({
        ...current,
        manufacturingCode: parsed.manufacturingCode ?? current.manufacturingCode,
        pieceName: parsed.pieceName ?? current.pieceName,
        pieceType: parsed.pieceType ?? current.pieceType,
        status: statusOptions.includes(parsed.status) ? parsed.status : current.status,
        designerName: parsed.designerName ?? current.designerName,
        craftsmanName: parsed.craftsmanName ?? current.craftsmanName,
        usageNotes: parsed.usageNotes ?? current.usageNotes,
        sellingPrice: parsed.sellingPrice != null ? String(parsed.sellingPrice) : current.sellingPrice,
        photos: [notePhoto, ...current.photos],
        gemstones: parsed.gemstones,
        customFields: {
          ...current.customFields,
          ...Object.fromEntries(Object.entries(parsed.customFields).map(([key, value]) => [key, value ?? '']))
        }
      }))
      setCreateMode('manual')
    } catch {
      setError('Unable to analyze note photo. You can continue with manual entry.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleNoteFileInput(files: FileList | null) {
    setNoteFile(files?.[0] ?? null)
  }

  function selectCustomer(target: 'draft' | 'edit', customer: Customer) {
    if (target === 'draft') {
      setDraft(current => ({
        ...current,
        customerLookup: customer.name,
        customerId: customer.id
      }))
      return
    }

    setEditDraft(current => ({
      ...current,
      customerLookup: customer.name,
      customerId: customer.id
    }))
  }

  function addGemstoneRow(setter: (updater: (current: ProjectDraft) => ProjectDraft) => void) {
    setter(current => ({
      ...current,
      gemstones: [
        ...current.gemstones,
        {
          inventoryItemId: null,
          gemstoneCode: null,
          gemstoneType: null,
          piecesUsed: null,
          weightUsedCt: null,
          lineCost: null,
          notes: null
        }
      ]
    }))
  }

  function removeGemstoneRow(setter: (updater: (current: ProjectDraft) => ProjectDraft) => void, index: number) {
    setter(current => ({
      ...current,
      gemstones: current.gemstones.filter((_, currentIndex) => currentIndex !== index)
    }))
  }

  function updateGemstoneRow(
    setter: (updater: (current: ProjectDraft) => ProjectDraft) => void,
    index: number,
    patch: Partial<ManufacturingGemstoneUpsertRequest>
  ) {
    setter(current => ({
      ...current,
      gemstones: current.gemstones.map((gemstone, currentIndex) => {
        if (currentIndex !== index) {
          return gemstone
        }

        return {
          ...gemstone,
          ...patch
        }
      })
    }))
  }

  function openCustomerCreateModal(target: 'draft' | 'edit', initialName?: string) {
    setCustomerModalTarget(target)
    setCustomerDraft({
      ...EMPTY_CUSTOMER_FORM,
      name: initialName?.trim() ?? ''
    })
    setIsCustomerModalOpen(true)
  }

  function applyCustomerLookup(target: 'draft' | 'edit', lookupValue: string) {
    const normalized = lookupValue.trim().toLowerCase()
    const matched = normalized ? customerLookupByName.get(normalized) : null

    if (target === 'draft') {
      setDraft(current => ({
        ...current,
        customerLookup: lookupValue,
        customerId: matched?.id ?? null
      }))
      return
    }

    setEditDraft(current => ({
      ...current,
      customerLookup: lookupValue,
      customerId: matched?.id ?? null
    }))
  }

  function resolveCustomerFromLookup(lookupValue: string, candidates: Customer[]): Customer | null {
    const normalized = lookupValue.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    const exact = candidates.find(customer => customer.name.trim().toLowerCase() === normalized)
    if (exact) {
      return exact
    }

    if (candidates.length === 1) {
      return candidates[0]
    }

    return null
  }

  async function handleCreateCustomerFromModal() {
    if (!customerDraft.name.trim()) {
      setError('Customer name is required.')
      return
    }

    setIsSavingCustomer(true)
    setError(null)

    try {
      const created = await createCustomer({
        name: customerDraft.name.trim(),
        nickname: customerDraft.nickname.trim() || null,
        email: customerDraft.email.trim() || null,
        phone: customerDraft.phone.trim() || null,
        address: customerDraft.address.trim() || null,
        notes: customerDraft.notes.trim() || null
      })

      await loadCustomers()
      if (customerModalTarget === 'draft') {
        setDraft(current => ({
          ...current,
          customOrder: true,
          customerId: created.id,
          customerLookup: created.name
        }))
      } else {
        setEditDraft(current => ({
          ...current,
          customOrder: true,
          customerId: created.id,
          customerLookup: created.name
        }))
      }

      setIsCustomerModalOpen(false)
      setCustomerDraft(EMPTY_CUSTOMER_FORM)
    } catch {
      setError('Unable to create customer profile.')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  async function handleCreate() {
    if (!draft.manufacturingCode.trim() || !draft.pieceName.trim()) {
      setError('Manufacturing code and piece name are required.')
      return
    }

    if (!draft.material.trim()) {
      setError('Material is required.')
      return
    }

    for (const field of activeFields) {
      if (!field.isRequired) {
        continue
      }

      if (field.fieldKey === 'designerName' && !draft.designerName.trim()) {
        setError('Designer is required by current settings.')
        return
      }

      if (field.fieldKey === 'craftsmanName' && !draft.craftsmanName.trim()) {
        setError('Craftsman is required by current settings.')
        return
      }

      if (!field.isSystem && !draft.customFields[field.fieldKey]?.trim()) {
        setError(`${field.label} is required.`)
        return
      }
    }

    let resolvedDraftCustomerId = draft.customerId
    if (draft.customOrder && !resolvedDraftCustomerId) {
      const resolved = resolveCustomerFromLookup(draft.customerLookup, draftCustomerCandidates)
      if (resolved) {
        resolvedDraftCustomerId = resolved.id
        setDraft(current => ({
          ...current,
          customerId: resolved.id,
          customerLookup: resolved.name
        }))
      }
    }

    if (draft.customOrder && !resolvedDraftCustomerId) {
      setError('Select a customer from results, or click Add New Customer before saving.')
      return
    }

    if (!draftCanSetSettingCost && parseAmount(draft.settingCost) > 0) {
      setError('Setting cost can be entered only after Sent To Craftsman.')
      return
    }

    if (!draftCanSetDiamondCost && parseAmount(draft.diamondCost) > 0) {
      setError('Diamond cost can be entered only after Diamond Sorting.')
      return
    }

    const photos = draft.photos
    const selectedStepRequirements = stepRequirementsByStatus[draft.status]
    if (selectedStepRequirements?.requirePhoto && photos.length === 0) {
      setError(`Photo upload is required for ${labelize(draft.status)}.`)
      return
    }

    if (selectedStepRequirements?.requireComment && !draft.usageNotes.trim()) {
      setError(`A comment is required for ${labelize(draft.status)}.`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const payloadCustomFields: Record<string, string | null> = {}
      for (const [key, value] of Object.entries(draft.customFields)) {
        payloadCustomFields[key] = value.trim() || null
      }

      const created = await createManufacturingProject({
        manufacturingCode: draft.manufacturingCode.trim(),
        pieceName: draft.pieceName.trim(),
        pieceType: draft.pieceType,
        material: draft.material.trim() || null,
        status: draft.status,
        designerName: draft.designerName.trim() || null,
        craftsmanName: draft.craftsmanName.trim() || null,
        customOrder: draft.customOrder,
        customerId: draft.customOrder ? resolvedDraftCustomerId : null,
        settingCost: parseAmount(draft.settingCost),
        diamondCost: parseAmount(draft.diamondCost),
        budget: parseNullableAmount(draft.budget),
        sellingPrice: parseAmount(draft.sellingPrice),
        maximumDiscountedPrice: parseAmount(draft.maximumDiscountedPrice),
        metalPlating: normalizeSelection(draft.metalPlating) ? [normalizeSelection(draft.metalPlating)] : [],
        usageNotes: draft.usageNotes.trim() || null,
        photos,
        gemstones: draft.gemstones,
        customFields: payloadCustomFields
      })

      setCreateMode('upload')
      setNoteFile(null)
      setDraft(buildDraft(defaultStatus, activeFields))
      await loadRecords(search, route.view === 'inventory' ? READY_FOR_SALE_STATUS : statusFilter)
      navigate(`/dashboard/manufacturing/${created.id}`)
    } catch {
      setError('Unable to create manufacturing project.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateStatus() {
    if (!selected || !selectedStatus) {
      return
    }

    if (stepAdvanceWarning) {
      setError(stepAdvanceWarning)
      return
    }

    const statusChanged = selectedStatus !== selected.status
    const currentStepRequirements = stepRequirementsByStatus[selected.status]
    const normalizedNote = statusNote.trim()
    const hasPendingPhotos = hasPendingStepPhotoEvidence

    if (!statusChanged) {
      if (currentStepRequirements?.requirePhoto && !hasPendingPhotos && !hasExistingStepPhotoEvidence) {
        setError(`Photo upload is required for ${labelize(selectedStatus)}.`)
        return
      }

      if (currentStepRequirements?.requireComment && !normalizedNote && !hasCurrentStepCommentEvidence) {
        setError(`A step comment is required for ${labelize(selectedStatus)}.`)
        return
      }
    }

    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateManufacturingProject(selected.id, {
        status: selectedStatus,
        activityNote: normalizedNote || (statusChanged
          ? `Status updated from dashboard to ${selectedStatus}`
          : `Step evidence added for ${selectedStatus}`),
        activityPhotos: hasPendingPhotos ? pendingStepPhotos : null
      })

      setSelected(updated)
      setSelectedStatus(updated.status)
      setProjectGalleryPhotos(updated.photos)
      setStatusNote('')
      setPendingStepPhotos([])
      await loadRecords(search, route.view === 'inventory' ? READY_FOR_SALE_STATUS : statusFilter)
    } catch {
      setError('Unable to update project status.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveProjectGallery() {
    if (!selected || !canSaveProjectGallery) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateManufacturingProject(selected.id, {
        photos: projectGalleryPhotos,
        activityNote: 'Project gallery updated from detail view'
      })
      setSelected(updated)
      setProjectGalleryPhotos(updated.photos)
      await loadRecords(search, route.view === 'inventory' ? READY_FOR_SALE_STATUS : statusFilter)
    } catch {
      setError('Unable to save project gallery.')
    } finally {
      setIsSaving(false)
    }
  }

  function openInventorySaleModal(record: ManufacturingProjectSummary) {
    setInventorySaleDraft({
      projectId: record.id,
      manufacturingCode: record.manufacturingCode,
      pieceName: record.pieceName,
      customerLookup: '',
      customerId: null,
      soldPrice: String(record.sellingPrice)
    })
  }

  function selectInventorySaleCustomer(customer: Customer) {
    setInventorySaleDraft(current => {
      if (!current) {
        return current
      }

      return {
        ...current,
        customerLookup: customer.name,
        customerId: customer.id
      }
    })
  }

  async function handleConfirmInventorySale() {
    if (!inventorySaleDraft) {
      return
    }

    let resolvedCustomerId = inventorySaleDraft.customerId
    if (!resolvedCustomerId) {
      const resolved = resolveCustomerFromLookup(inventorySaleDraft.customerLookup, inventoryCustomerCandidates)
      if (resolved) {
        resolvedCustomerId = resolved.id
      }
    }

    if (!resolvedCustomerId) {
      setError('Select a customer before marking this piece as sold.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updateManufacturingProject(inventorySaleDraft.projectId, {
        status: SOLD_STATUS,
        customOrder: true,
        customerId: resolvedCustomerId,
        soldAt: new Date().toISOString(),
        sellingPrice: parseAmount(inventorySaleDraft.soldPrice),
        activityNote: `Marked sold from inventory for customer ${inventorySaleDraft.customerLookup.trim() || 'selected customer'}`
      })

      setInventorySaleDraft(null)
      await loadRecords(search, READY_FOR_SALE_STATUS)
    } catch {
      setError('Unable to mark item as sold.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!selected) {
      return
    }

    if (!editDraft.manufacturingCode.trim() || !editDraft.pieceName.trim()) {
      setError('Manufacturing code and piece name are required.')
      return
    }

    if (!editDraft.material.trim()) {
      setError('Material is required.')
      return
    }

    let resolvedEditCustomerId = editDraft.customerId
    if (editDraft.customOrder && !resolvedEditCustomerId) {
      const resolved = resolveCustomerFromLookup(editDraft.customerLookup, editCustomerCandidates)
      if (resolved) {
        resolvedEditCustomerId = resolved.id
        setEditDraft(current => ({
          ...current,
          customerId: resolved.id,
          customerLookup: resolved.name
        }))
      }
    }

    if (editDraft.customOrder && !resolvedEditCustomerId) {
      setError('Select a customer from results, or click Add New Customer before saving.')
      return
    }

    if (!editCanSetSettingCost && parseAmount(editDraft.settingCost) > 0) {
      setError('Setting cost can be entered only after Sent To Craftsman.')
      return
    }

    if (!editCanSetDiamondCost && parseAmount(editDraft.diamondCost) > 0) {
      setError('Diamond cost can be entered only after Diamond Sorting.')
      return
    }

    const photos = editDraft.photos
    const selectedStepRequirements = stepRequirementsByStatus[editDraft.status]
    if (selectedStepRequirements?.requirePhoto && photos.length === 0) {
      setError(`Photo upload is required for ${labelize(editDraft.status)}.`)
      return
    }

    if (selectedStepRequirements?.requireComment && !editDraft.usageNotes.trim()) {
      setError(`A comment is required for ${labelize(editDraft.status)}.`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const payloadCustomFields: Record<string, string | null> = {}
      for (const [key, value] of Object.entries(editDraft.customFields)) {
        payloadCustomFields[key] = value.trim() || null
      }

      const payloadGemstones = editDraft.gemstones
        .map(gem => ({
          inventoryItemId: gem.inventoryItemId ?? null,
          gemstoneCode: gem.gemstoneCode?.trim() || null,
          gemstoneType: gem.gemstoneType?.trim() || null,
          piecesUsed: typeof gem.piecesUsed === 'number' && Number.isFinite(gem.piecesUsed) ? gem.piecesUsed : null,
          weightUsedCt: typeof gem.weightUsedCt === 'number' && Number.isFinite(gem.weightUsedCt) ? gem.weightUsedCt : null,
          lineCost: typeof gem.lineCost === 'number' && Number.isFinite(gem.lineCost) ? gem.lineCost : null,
          notes: gem.notes?.trim() || null
        }))
        .filter(gem =>
          gem.inventoryItemId != null ||
          gem.gemstoneCode != null ||
          gem.gemstoneType != null ||
          (gem.piecesUsed ?? 0) > 0 ||
          (gem.weightUsedCt ?? 0) > 0)

      const updated = await updateManufacturingProject(selected.id, {
        manufacturingCode: editDraft.manufacturingCode.trim(),
        pieceName: editDraft.pieceName.trim(),
        pieceType: editDraft.pieceType,
        material: editDraft.material.trim() || null,
        status: editDraft.status,
        designerName: editDraft.designerName.trim() || null,
        craftsmanName: editDraft.craftsmanName.trim() || null,
        customOrder: editDraft.customOrder,
        customerId: editDraft.customOrder ? resolvedEditCustomerId : null,
        settingCost: parseAmount(editDraft.settingCost),
        diamondCost: parseAmount(editDraft.diamondCost),
        budget: parseNullableAmount(editDraft.budget),
        sellingPrice: parseAmount(editDraft.sellingPrice),
        maximumDiscountedPrice: parseAmount(editDraft.maximumDiscountedPrice),
        metalPlating: normalizeSelection(editDraft.metalPlating) ? [normalizeSelection(editDraft.metalPlating)] : [],
        usageNotes: editDraft.usageNotes.trim() || null,
        photos,
        gemstones: payloadGemstones,
        customFields: payloadCustomFields,
        activityNote: 'Project details updated from edit panel'
      })

      setSelected(updated)
      setSelectedStatus(updated.status)
      setProjectGalleryPhotos(updated.photos)
      setEditDraft(mapDetailToDraft(updated, activeFields))
      await loadRecords(search, route.view === 'inventory' ? READY_FOR_SALE_STATUS : statusFilter)
      navigate(`/dashboard/manufacturing/${updated.id}`)
    } catch {
      setError('Unable to save manufacturing project changes.')
    } finally {
      setIsSaving(false)
    }
  }

  function openDetail(projectId: number) {
    navigate(buildManufacturingDetailPath(route.view, projectId))
  }

  function closeDetail() {
    setInventorySaleDraft(null)
    navigate(buildManufacturingBasePath(route.view))
  }

  function openEdit() {
    if (!route.detailId) {
      return
    }

    navigate(buildManufacturingDetailPath('records', route.detailId, 'edit'))
  }

  function closeEdit() {
    if (!route.detailId) {
      navigate('/dashboard/manufacturing')
      return
    }

    navigate(buildManufacturingDetailPath('records', route.detailId))
  }

  function openFullDetail() {
    if (!route.detailId) {
      return
    }

    navigate(buildManufacturingDetailPath(route.view, route.detailId, 'full'))
  }

  function closeFullDetail() {
    if (!route.detailId) {
      navigate(buildManufacturingBasePath(route.view))
      return
    }

    navigate(buildManufacturingDetailPath(route.view, route.detailId))
  }

  const customerModal = isCustomerModalOpen ? (
    <div className="detail-modal-backdrop">
      <section className="detail-modal-panel">
        <div className="drawer-head">
          <h3>New Customer Profile</h3>
          <button type="button" className="icon-btn" onClick={() => setIsCustomerModalOpen(false)} aria-label="Close modal" title="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="crm-form-grid">
          <label>
            Name
            <input value={customerDraft.name} onChange={event => setCustomerDraft(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Nickname
            <input value={customerDraft.nickname} onChange={event => setCustomerDraft(current => ({ ...current, nickname: event.target.value }))} />
          </label>
          <label>
            Email
            <input value={customerDraft.email} onChange={event => setCustomerDraft(current => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Phone
            <input value={customerDraft.phone} onChange={event => setCustomerDraft(current => ({ ...current, phone: event.target.value }))} />
          </label>
          <label className="crm-form-span">
            Address
            <input value={customerDraft.address} onChange={event => setCustomerDraft(current => ({ ...current, address: event.target.value }))} />
          </label>
          <label className="crm-form-span">
            Notes
            <textarea rows={3} value={customerDraft.notes} onChange={event => setCustomerDraft(current => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="crm-form-actions crm-form-span">
            <button type="button" className="secondary-btn" onClick={() => setIsCustomerModalOpen(false)} disabled={isSavingCustomer}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={() => void handleCreateCustomerFromModal()} disabled={isSavingCustomer}>
              {isSavingCustomer ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </div>
      </section>
    </div>
  ) : null

  const inventorySaleModal = inventorySaleDraft ? (
    <div className="detail-modal-backdrop">
      <section className="detail-modal-panel">
        <div className="drawer-head">
          <h3>Mark Sold</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setInventorySaleDraft(null)}
            aria-label="Close sold modal"
            title="Close sold modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="crm-form-grid">
          <label>
            Manufacturing Code
            <input value={inventorySaleDraft.manufacturingCode} readOnly />
          </label>
          <label>
            Piece Name
            <input value={inventorySaleDraft.pieceName} readOnly />
          </label>
          <label>
            Sold Price
            <input
              type="number"
              value={inventorySaleDraft.soldPrice}
              onChange={event => setInventorySaleDraft(current => current ? { ...current, soldPrice: event.target.value } : current)}
            />
          </label>
          <label>
            Customer Search
            <input
              value={inventorySaleDraft.customerLookup}
              onChange={event => setInventorySaleDraft(current => current ? {
                ...current,
                customerLookup: event.target.value,
                customerId: null
              } : current)}
              placeholder={isLoadingCustomers ? 'Loading customers...' : 'Search existing customer by name'}
            />
          </label>

          <div className="crm-form-span customer-search-results">
            {inventoryCustomerCandidates.map(customer => (
              <button
                type="button"
                key={customer.id}
                className={`customer-search-item ${inventorySaleDraft.customerId === customer.id ? 'selected' : ''}`}
                onClick={() => selectInventorySaleCustomer(customer)}
              >
                <span className="customer-search-avatar">
                  {customerPreviewImage(customer) ? <img src={customerPreviewImage(customer) ?? ''} alt={customer.name} /> : getInitial(customer.name)}
                </span>
                <span>
                  <strong>{customer.name}</strong>
                  <small>{customer.nickname ?? '-'}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="crm-form-actions crm-form-span">
            <button type="button" className="secondary-btn" onClick={() => setInventorySaleDraft(null)} disabled={isSaving}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={() => void handleConfirmInventorySale()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Confirm Sold'}
            </button>
          </div>
        </div>
      </section>
    </div>
  ) : null

  if (route.mode === 'create') {
    return (
      <>
        <section className="content-card content-card-full">
          <div className="card-head">
          <div>
            <h3>New Manufacturing Project</h3>
            <p>Upload a handwritten note first, or switch to manual entry.</p>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              navigate('/dashboard/manufacturing')
              setCreateMode('upload')
              setNoteFile(null)
            }}
          >
            Back To Records
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

        <div className="auth-mode-row" style={{ maxWidth: 420 }}>
          <button type="button" className={createMode === 'upload' ? 'active' : ''} onClick={() => setCreateMode('upload')}>
            Upload Note
          </button>
          <button type="button" className={createMode === 'manual' ? 'active' : ''} onClick={() => setCreateMode('manual')}>
            Fill In Manually
          </button>
        </div>

        {createMode === 'upload' ? (
          <div className="crm-form-grid" style={{ marginTop: '0.8rem' }}>
            <label className="crm-form-span">
              Upload Note Photo
              <div
                className={`image-dropzone ${isDraggingNote ? 'dragging' : ''}`}
                onDragOver={event => {
                  event.preventDefault()
                  setIsDraggingNote(true)
                }}
                onDragLeave={event => {
                  event.preventDefault()
                  setIsDraggingNote(false)
                }}
                onDrop={event => {
                  event.preventDefault()
                  setIsDraggingNote(false)
                  handleNoteFileInput(event.dataTransfer.files)
                }}
              >
                <button type="button" className="secondary-btn" onClick={() => document.getElementById('manufacturing-note-upload')?.click()}>
                  Select Note Photo
                </button>
                <p>{noteFile ? `Selected: ${noteFile.name}` : 'Drag and drop a note image here, or select a file.'}</p>
                {noteFile ? <p className="inline-subtext">Run analysis to prefill form fields and gemstone lines.</p> : null}
              </div>
              <input
                id="manufacturing-note-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={event => handleNoteFileInput(event.target.files)}
              />
            </label>
            <div className="crm-form-actions crm-form-span">
              <button type="button" className="primary-btn" onClick={() => void analyzeNote()} disabled={isAnalyzing || !noteFile}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze And Fill Form'}
              </button>
              <button type="button" className="secondary-btn" onClick={() => setCreateMode('manual')}>
                Fill In Manually
              </button>
            </div>
            <p className="panel-placeholder crm-form-span">
              The AI intake agent reads your uploaded note and prefills the project form for review.
            </p>
          </div>
        ) : null}

          {createMode === 'manual' ? (
          <div className="crm-form-grid" style={{ marginTop: '0.8rem' }}>
            <datalist id="designer-options">
              {designerOptions.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id="craftsman-options">
              {craftsmanOptions.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <label>
              Manufacturing Code
              <input value={draft.manufacturingCode} onChange={event => setDraft(current => ({ ...current, manufacturingCode: event.target.value }))} />
            </label>
            <label>
              Piece Name
              <input value={draft.pieceName} onChange={event => setDraft(current => ({ ...current, pieceName: event.target.value }))} />
            </label>
            <label>
              Piece Type
              <select value={draft.pieceType} onChange={event => setDraft(current => ({ ...current, pieceType: event.target.value }))}>
                {draftPieceTypeOptions.map(type => (
                  <option key={type} value={type}>{labelize(type)}</option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select value={draft.material} onChange={event => setDraft(current => ({ ...current, material: event.target.value }))}>
                <option value="">Select material</option>
                {draftMaterialOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}>
                {draftStatusOptions.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
            </label>
            <label>
              Metal Plating
              <select value={draft.metalPlating} onChange={event => setDraft(current => ({ ...current, metalPlating: event.target.value }))}>
                <option value="">Select plating</option>
                {metalPlatingOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            {(stepRequirementsByStatus[draft.status]?.requirePhoto || stepRequirementsByStatus[draft.status]?.requireComment) ? (
              <p className="panel-placeholder crm-form-span">
                Step requirements:
                {' '}
                {stepRequirementsByStatus[draft.status]?.requirePhoto ? 'photo required' : 'photo optional'}
                {' • '}
                {stepRequirementsByStatus[draft.status]?.requireComment ? 'comment required' : 'comment optional'}
              </p>
            ) : null}

            <label className="crm-form-span">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={draft.customOrder}
                  onChange={event => setDraft(current => ({
                    ...current,
                    customOrder: event.target.checked,
                    customerId: event.target.checked ? current.customerId : null,
                    customerLookup: event.target.checked ? current.customerLookup : ''
                  }))}
                />
                Custom Order
              </span>
            </label>

            {draft.customOrder ? (
              <>
                <label>
                  Customer Search
                  <input
                    value={draft.customerLookup}
                    onChange={event => applyCustomerLookup('draft', event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        const lookupValue = draft.customerLookup.trim()
                        if (lookupValue && !customerLookupByName.has(lookupValue.toLowerCase())) {
                          openCustomerCreateModal('draft', lookupValue)
                        }
                      }
                    }}
                    placeholder={isLoadingCustomers ? 'Loading customers...' : 'Search existing customer by name'}
                  />
                </label>
                <div className="crm-form-span customer-search-results">
                  {draftCustomerCandidates.map(customer => (
                    <button
                      type="button"
                      key={customer.id}
                      className={`customer-search-item ${draft.customerId === customer.id ? 'selected' : ''}`}
                      onClick={() => selectCustomer('draft', customer)}
                    >
                      <span className="customer-search-avatar">
                        {customerPreviewImage(customer) ? <img src={customerPreviewImage(customer) ?? ''} alt={customer.name} /> : getInitial(customer.name)}
                      </span>
                      <span>
                        <strong>{customer.name}</strong>
                        <small>{customer.nickname ?? '-'}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="crm-form-actions">
                  <button type="button" className="secondary-btn" onClick={() => openCustomerCreateModal('draft', draft.customerLookup)}>
                    Add New Customer
                  </button>
                </div>
              </>
            ) : null}

            {activeFields.map(field => {
              if (field.fieldKey === 'designerName') {
                return (
                  <label key={field.fieldKey}>
                    {field.label}
                    <input
                      list="designer-options"
                      value={draft.designerName}
                      placeholder={designerOptions.length > 0 ? 'Select or type designer' : 'Designer name'}
                      onChange={event => setDraft(current => ({ ...current, designerName: event.target.value }))}
                      required={field.isRequired}
                    />
                  </label>
                )
              }

              if (field.fieldKey === 'craftsmanName') {
                return (
                  <label key={field.fieldKey}>
                    {field.label}
                    <input
                      list="craftsman-options"
                      value={draft.craftsmanName}
                      placeholder={craftsmanOptions.length > 0 ? 'Select or type craftsman' : 'Craftsman name'}
                      onChange={event => setDraft(current => ({ ...current, craftsmanName: event.target.value }))}
                      required={field.isRequired}
                    />
                  </label>
                )
              }

              const fieldValue = draft.customFields[field.fieldKey] ?? ''
              return (
                <label key={field.fieldKey}>
                  {field.label}
                  {field.fieldType === 'textarea' ? (
                    <textarea
                      rows={2}
                      value={fieldValue}
                      onChange={event => {
                        const value = event.target.value
                        setDraft(current => ({
                          ...current,
                          customFields: {
                            ...current.customFields,
                            [field.fieldKey]: value
                          }
                        }))
                      }}
                    />
                  ) : field.fieldType === 'select' ? (
                    <select
                      value={fieldValue}
                      onChange={event => {
                        const value = event.target.value
                        setDraft(current => ({
                          ...current,
                          customFields: {
                            ...current.customFields,
                            [field.fieldKey]: value
                          }
                        }))
                      }}
                    >
                      <option value="">Select</option>
                      {field.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                      value={fieldValue}
                      onChange={event => {
                        const value = event.target.value
                        setDraft(current => ({
                          ...current,
                          customFields: {
                            ...current.customFields,
                            [field.fieldKey]: value
                          }
                        }))
                      }}
                    />
                  )}
                </label>
              )
            })}

            <div className="crm-form-span usage-lines">
              <h4>Costs</h4>
              <div className="gemstone-row-grid">
                <label>
                  Gemstone Cost (Calculated)
                  <input value={formatCurrency(draftGemstoneCost)} readOnly />
                </label>
                <label>
                  Setting Cost (THB)
                  <input
                    type="number"
                    value={draft.settingCost}
                    disabled={!draftCanSetSettingCost}
                    onChange={event => setDraft(current => ({ ...current, settingCost: event.target.value }))}
                  />
                </label>
                <label>
                  Diamond Cost (THB)
                  <input
                    type="number"
                    value={draft.diamondCost}
                    disabled={!draftCanSetDiamondCost}
                    onChange={event => setDraft(current => ({ ...current, diamondCost: event.target.value }))}
                  />
                </label>
                <label>
                  Total Cost (View Only)
                  <input value={formatCurrency(draftTotalCost)} readOnly />
                </label>
              </div>
              {(!draftCanSetSettingCost || !draftCanSetDiamondCost) ? (
                <p className="panel-placeholder">
                  Setting cost unlocks after Sent To Craftsman. Diamond cost unlocks after Diamond Sorting.
                </p>
              ) : null}
            </div>
            <div className="crm-form-span usage-lines">
              <h4>Pricing</h4>
              <div className="gemstone-row-grid">
                <label>
                  Budget
                  <input
                    type="number"
                    value={draft.budget}
                    onChange={event => setDraft(current => ({ ...current, budget: event.target.value }))}
                    placeholder="Optional budget"
                  />
                </label>
                <label>
                  Final Price (Selling Price)
                  <input type="number" value={draft.sellingPrice} onChange={event => setDraft(current => ({ ...current, sellingPrice: event.target.value }))} />
                </label>
                <label>
                  Suggested Final Price
                  <input value={formatCurrency(draftSuggestedSellingPrice)} readOnly />
                </label>
                <label>
                  Maximum Discounted Price
                  <input
                    type="number"
                    value={draft.maximumDiscountedPrice}
                    onChange={event => setDraft(current => ({ ...current, maximumDiscountedPrice: event.target.value }))}
                  />
                </label>
              </div>
              {draftBudgetWarning ? (
                <p className="warning-banner">
                  Suggested final price ({formatCurrency(draftSuggestedSellingPrice)}) is above budget ({formatCurrency(draftBudget ?? 0)}).
                </p>
              ) : null}
            </div>
            <div className="crm-form-span">
              <ImageDropzone
                title="Project Gallery"
                images={draft.photos}
                onChange={images => setDraft(current => ({ ...current, photos: images }))}
              />
            </div>
            <label className="crm-form-span">
              Notes
              <textarea rows={4} value={draft.usageNotes} onChange={event => setDraft(current => ({ ...current, usageNotes: event.target.value }))} />
            </label>

            <div className="crm-form-span usage-lines">
              <div className="card-head">
                <h4>Gemstones ({draft.gemstones.length})</h4>
                <button type="button" className="secondary-btn" onClick={() => addGemstoneRow(setDraft)}>
                  <Plus size={14} />
                  Add Gemstone
                </button>
              </div>
              <p className="panel-placeholder">Line costs and gemstone cost are calculated from inventory pricing when you save.</p>
              {draft.gemstones.length === 0 ? (
                <p className="panel-placeholder">
                  Add gemstone rows manually or parse from uploaded note.
                </p>
              ) : (
                <div className="activity-list">
                  {draft.gemstones.map((gem, index) => (
                    <article key={`${gem.gemstoneCode ?? 'gem'}-${index}`}>
                      <div className="gemstone-row-grid">
                        <label>
                          Code
                          <input
                            value={gem.gemstoneCode ?? ''}
                            onChange={event => updateGemstoneRow(setDraft, index, { gemstoneCode: event.target.value || null })}
                          />
                        </label>
                        <label>
                          Type
                          <input
                            value={gem.gemstoneType ?? ''}
                            onChange={event => updateGemstoneRow(setDraft, index, { gemstoneType: event.target.value || null })}
                          />
                        </label>
                        <label>
                          Pieces
                          <input
                            type="number"
                            value={gem.piecesUsed ?? ''}
                            onChange={event => updateGemstoneRow(setDraft, index, {
                              piecesUsed: event.target.value === '' ? null : Number(event.target.value)
                            })}
                          />
                        </label>
                        <label>
                          Weight (CT)
                          <input
                            type="number"
                            value={gem.weightUsedCt ?? ''}
                            onChange={event => updateGemstoneRow(setDraft, index, {
                              weightUsedCt: event.target.value === '' ? null : Number(event.target.value)
                            })}
                          />
                        </label>
                        <label>
                          Line Cost (Calculated)
                          <input value={formatCurrency(gem.lineCost ?? 0)} readOnly />
                        </label>
                        <label>
                          Notes
                          <input
                            value={gem.notes ?? ''}
                            onChange={event => updateGemstoneRow(setDraft, index, { notes: event.target.value || null })}
                          />
                        </label>
                      </div>
                      <div className="crm-form-actions">
                        <button type="button" className="secondary-btn" onClick={() => removeGemstoneRow(setDraft, index)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="crm-form-actions crm-form-span">
              {error ? <p className="error-banner" style={{ marginRight: 'auto' }}>{error}</p> : null}
              <button type="button" className="secondary-btn" onClick={() => setCreateMode('upload')}>
                Upload Note
              </button>
              <button type="button" className="secondary-btn" onClick={() => setDraft(buildDraft(defaultStatus, activeFields))} disabled={isSaving}>
                Reset
              </button>
              <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={isSaving || isLoadingSettings}>
                <Check size={14} />
                {isSaving ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </div>
          ) : null}
        </section>
        {customerModal}
        {inventorySaleModal}
      </>
    )
  }

  if (route.mode === 'edit') {
    return (
      <>
        <section className="content-card content-card-full">
          <div className="card-head">
          <div>
            <h3>Edit Manufacturing Project</h3>
            <p>Update project metadata, gemstones, and workflow details.</p>
          </div>
          <div className="detail-actions-row">
            <button type="button" className="icon-btn" onClick={closeEdit} aria-label="Close edit mode" title="Close edit mode">
              <X size={18} />
            </button>
          </div>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

          {isLoadingDetail ? (
          <p className="panel-placeholder">Loading manufacturing detail...</p>
        ) : selected ? (
          <div className="crm-form-grid">
            <datalist id="designer-options-edit">
              {designerOptions.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id="craftsman-options-edit">
              {craftsmanOptions.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <label>
              Manufacturing Code
              <input value={editDraft.manufacturingCode} onChange={event => setEditDraft(current => ({ ...current, manufacturingCode: event.target.value }))} />
            </label>
            <label>
              Piece Name
              <input value={editDraft.pieceName} onChange={event => setEditDraft(current => ({ ...current, pieceName: event.target.value }))} />
            </label>
            <label>
              Piece Type
              <select value={editDraft.pieceType} onChange={event => setEditDraft(current => ({ ...current, pieceType: event.target.value }))}>
                {editPieceTypeOptions.map(type => (
                  <option key={type} value={type}>{labelize(type)}</option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select value={editDraft.material} onChange={event => setEditDraft(current => ({ ...current, material: event.target.value }))}>
                <option value="">Select material</option>
                {editMaterialOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={editDraft.status} onChange={event => setEditDraft(current => ({ ...current, status: event.target.value }))}>
                {editStatusOptions.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
            </label>
            <label>
              Metal Plating
              <select value={editDraft.metalPlating} onChange={event => setEditDraft(current => ({ ...current, metalPlating: event.target.value }))}>
                <option value="">Select plating</option>
                {metalPlatingOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              Designer
              <input
                list="designer-options-edit"
                value={editDraft.designerName}
                placeholder={designerOptions.length > 0 ? 'Select or type designer' : 'Designer name'}
                onChange={event => setEditDraft(current => ({ ...current, designerName: event.target.value }))}
              />
            </label>
            <label>
              Craftsman
              <input
                list="craftsman-options-edit"
                value={editDraft.craftsmanName}
                placeholder={craftsmanOptions.length > 0 ? 'Select or type craftsman' : 'Craftsman name'}
                onChange={event => setEditDraft(current => ({ ...current, craftsmanName: event.target.value }))}
              />
            </label>

            <label className="crm-form-span">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={editDraft.customOrder}
                  onChange={event => setEditDraft(current => ({
                    ...current,
                    customOrder: event.target.checked,
                    customerId: event.target.checked ? current.customerId : null,
                    customerLookup: event.target.checked ? current.customerLookup : ''
                  }))}
                />
                Custom Order
              </span>
            </label>

            {editDraft.customOrder ? (
              <>
                <label>
                  Customer Search
                  <input
                    value={editDraft.customerLookup}
                    onChange={event => applyCustomerLookup('edit', event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        const lookupValue = editDraft.customerLookup.trim()
                        if (lookupValue && !customerLookupByName.has(lookupValue.toLowerCase())) {
                          openCustomerCreateModal('edit', lookupValue)
                        }
                      }
                    }}
                    placeholder={isLoadingCustomers ? 'Loading customers...' : 'Search existing customer by name'}
                  />
                </label>
                <div className="crm-form-span customer-search-results">
                  {editCustomerCandidates.map(customer => (
                    <button
                      type="button"
                      key={customer.id}
                      className={`customer-search-item ${editDraft.customerId === customer.id ? 'selected' : ''}`}
                      onClick={() => selectCustomer('edit', customer)}
                    >
                      <span className="customer-search-avatar">
                        {customerPreviewImage(customer) ? <img src={customerPreviewImage(customer) ?? ''} alt={customer.name} /> : getInitial(customer.name)}
                      </span>
                      <span>
                        <strong>{customer.name}</strong>
                        <small>{customer.nickname ?? '-'}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="crm-form-actions">
                  <button type="button" className="secondary-btn" onClick={() => openCustomerCreateModal('edit', editDraft.customerLookup)}>
                    Add New Customer
                  </button>
                </div>
              </>
            ) : null}

            {Object.entries(editDraft.customFields).map(([fieldKey, value]) => (
              <label key={fieldKey}>
                {customFieldLabels[fieldKey] ?? labelize(fieldKey)}
                <input
                  value={value}
                  onChange={event => {
                    const nextValue = event.target.value
                    setEditDraft(current => ({
                      ...current,
                      customFields: {
                        ...current.customFields,
                        [fieldKey]: nextValue
                      }
                    }))
                  }}
                />
              </label>
            ))}

            <div className="crm-form-span usage-lines">
              <h4>Costs</h4>
              <div className="gemstone-row-grid">
                <label>
                  Gemstone Cost (Calculated)
                  <input value={formatCurrency(editGemstoneCost)} readOnly />
                </label>
                <label>
                  Setting Cost (THB)
                  <input
                    type="number"
                    value={editDraft.settingCost}
                    disabled={!editCanSetSettingCost}
                    onChange={event => setEditDraft(current => ({ ...current, settingCost: event.target.value }))}
                  />
                </label>
                <label>
                  Diamond Cost (THB)
                  <input
                    type="number"
                    value={editDraft.diamondCost}
                    disabled={!editCanSetDiamondCost}
                    onChange={event => setEditDraft(current => ({ ...current, diamondCost: event.target.value }))}
                  />
                </label>
                <label>
                  Total Cost (View Only)
                  <input value={formatCurrency(editTotalCost)} readOnly />
                </label>
              </div>
              {(!editCanSetSettingCost || !editCanSetDiamondCost) ? (
                <p className="panel-placeholder">
                  Setting cost unlocks after Sent To Craftsman. Diamond cost unlocks after Diamond Sorting.
                </p>
              ) : null}
            </div>
            <div className="crm-form-span usage-lines">
              <h4>Pricing</h4>
              <div className="gemstone-row-grid">
                <label>
                  Budget
                  <input
                    type="number"
                    value={editDraft.budget}
                    onChange={event => setEditDraft(current => ({ ...current, budget: event.target.value }))}
                    placeholder="Optional budget"
                  />
                </label>
                <label>
                  Final Price (Selling Price)
                  <input type="number" value={editDraft.sellingPrice} onChange={event => setEditDraft(current => ({ ...current, sellingPrice: event.target.value }))} />
                </label>
                <label>
                  Suggested Final Price
                  <input value={formatCurrency(editSuggestedSellingPrice)} readOnly />
                </label>
                <label>
                  Maximum Discounted Price
                  <input
                    type="number"
                    value={editDraft.maximumDiscountedPrice}
                    onChange={event => setEditDraft(current => ({ ...current, maximumDiscountedPrice: event.target.value }))}
                  />
                </label>
              </div>
              {editBudgetWarning ? (
                <p className="warning-banner">
                  Suggested final price ({formatCurrency(editSuggestedSellingPrice)}) is above budget ({formatCurrency(editBudget ?? 0)}).
                </p>
              ) : null}
            </div>
            <div className="crm-form-span">
              <ImageDropzone
                title="Project Gallery"
                images={editDraft.photos}
                onChange={images => setEditDraft(current => ({ ...current, photos: images }))}
              />
            </div>
            <label className="crm-form-span">
              Notes
              <textarea rows={4} value={editDraft.usageNotes} onChange={event => setEditDraft(current => ({ ...current, usageNotes: event.target.value }))} />
            </label>

            <div className="crm-form-span usage-lines">
              <div className="card-head">
                <h4>Gemstones ({editDraft.gemstones.length})</h4>
                <button type="button" className="secondary-btn" onClick={() => addGemstoneRow(setEditDraft)}>
                  <Plus size={14} />
                  Add Gemstone
                </button>
              </div>
              <p className="panel-placeholder">Line costs and gemstone cost are calculated from inventory pricing when you save.</p>
              {editDraft.gemstones.length === 0 ? (
                <p className="panel-placeholder">No gemstone rows. Add one to calculate gemstone cost from inventory pricing.</p>
              ) : (
                <div className="activity-list">
                  {editDraft.gemstones.map((gem, index) => (
                    <article key={`${gem.gemstoneCode ?? 'gem'}-${index}`}>
                      <div className="gemstone-row-grid">
                        <label>
                          Code
                          <input
                            value={gem.gemstoneCode ?? ''}
                            onChange={event => updateGemstoneRow(setEditDraft, index, { gemstoneCode: event.target.value || null })}
                          />
                        </label>
                        <label>
                          Type
                          <input
                            value={gem.gemstoneType ?? ''}
                            onChange={event => updateGemstoneRow(setEditDraft, index, { gemstoneType: event.target.value || null })}
                          />
                        </label>
                        <label>
                          Pieces
                          <input
                            type="number"
                            value={gem.piecesUsed ?? ''}
                            onChange={event => updateGemstoneRow(setEditDraft, index, {
                              piecesUsed: event.target.value === '' ? null : Number(event.target.value)
                            })}
                          />
                        </label>
                        <label>
                          Weight (CT)
                          <input
                            type="number"
                            value={gem.weightUsedCt ?? ''}
                            onChange={event => updateGemstoneRow(setEditDraft, index, {
                              weightUsedCt: event.target.value === '' ? null : Number(event.target.value)
                            })}
                          />
                        </label>
                        <label>
                          Line Cost (Calculated)
                          <input value={formatCurrency(gem.lineCost ?? 0)} readOnly />
                        </label>
                        <label>
                          Notes
                          <input
                            value={gem.notes ?? ''}
                            onChange={event => updateGemstoneRow(setEditDraft, index, { notes: event.target.value || null })}
                          />
                        </label>
                      </div>
                      <div className="crm-form-actions">
                        <button type="button" className="secondary-btn" onClick={() => removeGemstoneRow(setEditDraft, index)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="crm-form-actions crm-form-span">
              {error ? <p className="error-banner" style={{ marginRight: 'auto' }}>{error}</p> : null}
              <button type="button" className="secondary-btn" onClick={closeEdit} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={() => void handleSaveEdit()} disabled={isSaving || isLoadingSettings}>
                <Check size={14} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
          ) : (
          <p className="panel-placeholder">No manufacturing detail found for edit mode.</p>
          )}
        </section>
        {customerModal}
        {inventorySaleModal}
      </>
    )
  }

  const listCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>{route.view === 'inventory' ? 'Inventory (Ready For Sale)' : 'Manufacturing Records'}</h3>
          <p>
            {route.view === 'inventory'
              ? `${totalCount.toLocaleString()} pieces currently in stock and ready to be sold`
              : `${totalCount.toLocaleString()} projects across production workflow stages`}
          </p>
        </div>
        <div className="detail-actions-row">
          {route.view === 'records' ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                navigate('/dashboard/manufacturing/new')
                setCreateMode('upload')
                setNoteFile(null)
              }}
            >
              <Plus size={14} />
              New Project
            </button>
          ) : (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                navigate('/dashboard/manufacturing')
                setInventorySaleDraft(null)
              }}
            >
              View Records
            </button>
          )}
        </div>
      </div>

      <div className="auth-mode-row manufacturing-view-switch">
        <button
          type="button"
          className={route.view === 'records' ? 'active' : ''}
          onClick={() => {
            navigate('/dashboard/manufacturing')
            setInventorySaleDraft(null)
          }}
        >
          Records
        </button>
        <button
          type="button"
          className={route.view === 'inventory' ? 'active' : ''}
          onClick={() => {
            navigate('/dashboard/manufacturing/inventory')
            setInventorySaleDraft(null)
          }}
        >
          Inventory
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {route.view === 'records' ? (
        <div className="filter-grid">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search code, piece, designer, craftsman" />
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {labelize(status)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="filter-grid single-row-filter">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search code, piece, designer, craftsman" />
        </div>
      )}

      <div className="table-controls-row">
        <div className="auth-mode-row table-view-switch">
          <button type="button" className={recordsCollection.viewMode === 'table' ? 'active' : ''} onClick={() => recordsCollection.setViewMode('table')}>Table</button>
          <button type="button" className={recordsCollection.viewMode === 'grid' ? 'active' : ''} onClick={() => recordsCollection.setViewMode('grid')}>Grid</button>
        </div>
        <div className="table-pagination-inline">
          <span>{recordsCollection.selectedCount} selected</span>
          <select value={recordsCollection.pageSize} onChange={event => recordsCollection.setPageSize(Number(event.target.value))}>
            <option value={10}>10 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <button type="button" className="icon-btn" onClick={() => recordsCollection.setPage(current => Math.max(1, current - 1))} disabled={recordsCollection.page <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span>{recordsCollection.page}/{recordsCollection.totalPages}</span>
          <button type="button" className="icon-btn" onClick={() => recordsCollection.setPage(current => Math.min(recordsCollection.totalPages, current + 1))} disabled={recordsCollection.page >= recordsCollection.totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading manufacturing projects...</p>
      ) : recordsCollection.pageItems.length === 0 ? (
        <p className="panel-placeholder">No manufacturing records found for this filter.</p>
      ) : recordsCollection.viewMode === 'grid' ? (
        <div className="table-card-grid">
          {recordsCollection.pageItems.map(record => (
            <article key={record.id} className="table-card" onClick={() => openDetail(record.id)}>
              <label className="table-row-checkbox" onClick={event => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={recordsCollection.selectedIds.has(String(record.id))}
                  onChange={() => recordsCollection.toggleRowSelection(record.id)}
                />
              </label>
              <h4>{record.manufacturingCode}</h4>
              <p>{record.pieceName}</p>
              <p>{labelize(record.status)}</p>
              <p>{record.designerName ?? '-'}</p>
              <p className="accent-value">{formatCurrency(record.sellingPrice)}</p>
              {route.view === 'inventory' ? (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={event => {
                    event.stopPropagation()
                    openInventorySaleModal(record)
                  }}
                >
                  Mark Sold
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={recordsCollection.isPageSelected}
                    ref={element => {
                      if (element) {
                        element.indeterminate = recordsCollection.isPagePartiallySelected
                      }
                    }}
                    onChange={() => recordsCollection.togglePageSelection()}
                  />
                </th>
                <th>Code</th>
                <th>Piece</th>
                <th>Status</th>
                <th>Designer</th>
                <th>Selling Price</th>
                <th>Customer</th>
                {route.view === 'inventory' ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {recordsCollection.pageItems.map(record => (
                <tr key={record.id} onClick={() => openDetail(record.id)}>
                  <td onClick={event => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={recordsCollection.selectedIds.has(String(record.id))}
                      onChange={() => recordsCollection.toggleRowSelection(record.id)}
                    />
                  </td>
                  <td>{record.manufacturingCode}</td>
                  <td>
                    <strong>{record.pieceName}</strong>
                    <p className="inline-subtext">{labelize(record.pieceType)}</p>
                  </td>
                  <td>{labelize(record.status)}</td>
                  <td>{record.designerName ?? '-'}</td>
                  <td>{formatCurrency(record.sellingPrice)}</td>
                  <td>{record.customerName ?? '-'}</td>
                  {route.view === 'inventory' ? (
                    <td>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={event => {
                          event.stopPropagation()
                          openInventorySaleModal(record)
                        }}
                      >
                        Mark Sold
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  if (route.isFull) {
    return (
      <>
        <section className="content-card detail-page-card">
          <div className="card-head">
          <div>
            <h3>Manufacturing Project Detail</h3>
            <p>Full page view for one project record.</p>
          </div>
          <div className="detail-header-tools">
            <div className="status-update-row">
              <select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)} disabled={!selected}>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
              <button type="button" className="primary-btn" onClick={() => void handleUpdateStatus()} disabled={isSaving || !canSubmitStatusUpdate || !selected}>
                {isSaving ? 'Updating...' : 'Save Step'}
              </button>
            </div>
            <div className="detail-actions-row">
              <button type="button" className="icon-btn" onClick={openEdit} aria-label="Edit project" title="Edit project">
                <Pencil size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={closeFullDetail} aria-label="Back to split view" title="Back to split view">
                <Expand size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={closeDetail} aria-label="Close detail view" title="Close detail view">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {stepAdvanceWarning ? <p className="error-banner">{stepAdvanceWarning}</p> : null}

          {isLoadingDetail ? (
          <p className="panel-placeholder">Loading manufacturing detail...</p>
        ) : selected ? (
          <ManufacturingDetailContent
            selected={selected}
            selectedStatus={selectedStatus}
            customFieldLabels={customFieldLabels}
            stepRequirementsByStatus={stepRequirementsByStatus}
            statusNote={statusNote}
            pendingStepPhotos={pendingStepPhotos}
            hasExistingStepPhotoEvidence={hasExistingStepPhotoEvidence}
            isSaving={isSaving}
            canSubmitStatusUpdate={canSubmitStatusUpdate}
            projectGalleryPhotos={projectGalleryPhotos}
            canSaveProjectGallery={canSaveProjectGallery}
            onStatusNoteChange={setStatusNote}
            onPendingStepPhotosChange={setPendingStepPhotos}
            onProjectGalleryPhotosChange={setProjectGalleryPhotos}
            onSaveStep={() => void handleUpdateStatus()}
            onSaveProjectGallery={() => void handleSaveProjectGallery()}
          />
          ) : (
          <p className="panel-placeholder">No manufacturing detail found for this route.</p>
          )}
        </section>
        {customerModal}
        {inventorySaleModal}
      </>
    )
  }

  return (
    <>
      <div className={`content-split ${route.mode === 'detail' ? 'has-detail' : ''}`}>
      <div className="content-split-main">
        {listCard}
      </div>

      {route.mode === 'detail' ? (
        <aside className="detail-side-panel">
          <div className="drawer-head">
            <h3>Manufacturing Detail</h3>
            <div className="detail-header-tools">
              <div className="status-update-row">
                <select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)} disabled={!selected}>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{labelize(status)}</option>
                  ))}
                </select>
                <button type="button" className="primary-btn" onClick={() => void handleUpdateStatus()} disabled={isSaving || !canSubmitStatusUpdate || !selected}>
                  {isSaving ? 'Updating...' : 'Save Step'}
                </button>
              </div>
              <div className="detail-actions-row">
                <button type="button" className="icon-btn" onClick={openEdit} aria-label="Edit project" title="Edit project">
                  <Pencil size={18} />
                </button>
                <button type="button" className="icon-btn" onClick={openFullDetail} aria-label="Open full screen" title="Open full screen">
                  <Expand size={18} />
                </button>
                <button type="button" className="icon-btn" onClick={closeDetail} aria-label="Close detail panel" title="Close detail panel">
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {stepAdvanceWarning ? <p className="error-banner">{stepAdvanceWarning}</p> : null}

          {isLoadingDetail ? (
            <p className="panel-placeholder">Loading manufacturing detail...</p>
          ) : selected ? (
            <ManufacturingDetailContent
              selected={selected}
              selectedStatus={selectedStatus}
              customFieldLabels={customFieldLabels}
              stepRequirementsByStatus={stepRequirementsByStatus}
              statusNote={statusNote}
              pendingStepPhotos={pendingStepPhotos}
              hasExistingStepPhotoEvidence={hasExistingStepPhotoEvidence}
              isSaving={isSaving}
              canSubmitStatusUpdate={canSubmitStatusUpdate}
              projectGalleryPhotos={projectGalleryPhotos}
              canSaveProjectGallery={canSaveProjectGallery}
              onStatusNoteChange={setStatusNote}
              onPendingStepPhotosChange={setPendingStepPhotos}
              onProjectGalleryPhotosChange={setProjectGalleryPhotos}
              onSaveStep={() => void handleUpdateStatus()}
              onSaveProjectGallery={() => void handleSaveProjectGallery()}
            />
          ) : (
            <p className="panel-placeholder">No manufacturing detail found for this record.</p>
          )}
        </aside>
      ) : null}
      </div>
      {customerModal}
      {inventorySaleModal}
    </>
  )
}
