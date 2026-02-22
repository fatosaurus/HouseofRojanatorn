import { useEffect, useMemo, useState } from 'react'
import { Check, Expand, Pencil, Plus, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createManufacturingProject,
  getManufacturingProject,
  getManufacturingProjects,
  getManufacturingSettings,
  parseManufacturingNote,
  updateManufacturingProject
} from '../../api/client'
import type {
  ManufacturingCustomField,
  ManufacturingGemstoneUpsertRequest,
  ManufacturingProjectDetail,
  ManufacturingProjectSummary,
  ManufacturingSettings
} from '../../api/types'

const PIECE_TYPES = ['earrings', 'bracelet', 'choker', 'necklace', 'brooch', 'ring', 'pendant', 'other']

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

function parsePhotos(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
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
  status: string
  designerName: string
  craftsmanName: string
  sellingPrice: string
  totalCost: string
  metalPlating: string
  usageNotes: string
  photosText: string
  gemstones: ManufacturingGemstoneUpsertRequest[]
  customFields: Record<string, string>
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
    status: defaultStatus,
    designerName: '',
    craftsmanName: '',
    sellingPrice: '0',
    totalCost: '0',
    metalPlating: '',
    usageNotes: '',
    photosText: '',
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
    status: detail.status,
    designerName: detail.designerName ?? '',
    craftsmanName: detail.craftsmanName ?? '',
    sellingPrice: String(detail.sellingPrice),
    totalCost: String(detail.totalCost),
    metalPlating: detail.metalPlating.join(', '),
    usageNotes: detail.usageNotes ?? '',
    photosText: detail.photos.join('\n'),
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

function parseManufacturingRoute(pathname: string): {
  mode: 'list' | 'create' | 'detail' | 'edit'
  detailId: number | null
  isFull: boolean
  isInvalid: boolean
} {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'manufacturing') {
    return { mode: 'list', detailId: null, isFull: false, isInvalid: false }
  }

  const segment = parts[2]
  const fullSegment = parts[3]

  if (!segment) {
    return { mode: 'list', detailId: null, isFull: false, isInvalid: parts.length > 2 }
  }

  if (segment === 'new') {
    return {
      mode: 'create',
      detailId: null,
      isFull: false,
      isInvalid: parts.length > 3
    }
  }

  const detailId = Number(segment)
  if (!Number.isInteger(detailId) || detailId <= 0) {
    return { mode: 'list', detailId: null, isFull: false, isInvalid: true }
  }

  if (!fullSegment) {
    return {
      mode: 'detail',
      detailId,
      isFull: false,
      isInvalid: parts.length > 3
    }
  }

  if (fullSegment === 'full') {
    return {
      mode: 'detail',
      detailId,
      isFull: true,
      isInvalid: parts.length > 4
    }
  }

  if (fullSegment === 'edit') {
    return {
      mode: 'edit',
      detailId,
      isFull: false,
      isInvalid: parts.length > 4
    }
  }

  return { mode: 'detail', detailId, isFull: false, isInvalid: true }
}

interface DetailContentProps {
  selected: ManufacturingProjectDetail
  selectedStatus: string
  statusOptions: string[]
  customFieldLabels: Record<string, string>
  stepRequirementsByStatus: Record<string, { requirePhoto: boolean, requireComment: boolean }>
  isSaving: boolean
  onSelectedStatusChange: (value: string) => void
  onUpdateStatus: () => void
}

function ManufacturingDetailContent({
  selected,
  selectedStatus,
  statusOptions,
  customFieldLabels,
  stepRequirementsByStatus,
  isSaving,
  onSelectedStatusChange,
  onUpdateStatus
}: DetailContentProps) {
  return (
    <>
      <div className="drawer-grid">
        <p><strong>Type:</strong> {labelize(selected.pieceType)}</p>
        <p><strong>Status:</strong> {labelize(selected.status)}</p>
        <p><strong>Design Date:</strong> {formatDate(selected.designDate)}</p>
        <p><strong>Completion Date:</strong> {formatDate(selected.completionDate)}</p>
        <p><strong>Designer:</strong> {selected.designerName ?? '-'}</p>
        <p><strong>Craftsman:</strong> {selected.craftsmanName ?? '-'}</p>
        <p><strong>Metal Plating:</strong> {selected.metalPlating.length > 0 ? selected.metalPlating.map(value => labelize(value)).join(', ') : '-'}</p>
        <p><strong>Plating Notes:</strong> {selected.metalPlatingNotes ?? '-'}</p>
        <p><strong>Setting Cost:</strong> {formatCurrency(selected.settingCost)}</p>
        <p><strong>Diamond Cost:</strong> {formatCurrency(selected.diamondCost)}</p>
        <p><strong>Gemstone Cost:</strong> {formatCurrency(selected.gemstoneCost)}</p>
        <p><strong>Selling Price:</strong> {formatCurrency(selected.sellingPrice)}</p>
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

      <div className="status-update-row">
        <select value={selectedStatus} onChange={event => onSelectedStatusChange(event.target.value)}>
          {statusOptions.map(status => (
            <option key={status} value={status}>{labelize(status)}</option>
          ))}
        </select>
        <button type="button" className="primary-btn" onClick={onUpdateStatus} disabled={isSaving || selectedStatus === selected.status}>
          {isSaving ? 'Updating...' : 'Update Status'}
        </button>
      </div>
      {(stepRequirementsByStatus[selectedStatus]?.requirePhoto || stepRequirementsByStatus[selectedStatus]?.requireComment) ? (
        <p className="panel-placeholder">
          {labelize(selectedStatus)} requires:
          {' '}
          {stepRequirementsByStatus[selectedStatus]?.requirePhoto ? 'photo' : 'no photo'}
          {' / '}
          {stepRequirementsByStatus[selectedStatus]?.requireComment ? 'comment' : 'no comment'}
        </p>
      ) : null}

      {selected.usageNotes ? (
        <div className="usage-lines">
          <h4>Notes</h4>
          <p>{selected.usageNotes}</p>
        </div>
      ) : null}

      {selected.photos.length > 0 ? (
        <div className="usage-lines">
          <h4>Photos</h4>
          <div className="activity-list">
            {selected.photos.map((photo, index) => (
              <article key={`${photo}-${index}`}>
                <a href={photo} target="_blank" rel="noreferrer">{photo}</a>
              </article>
            ))}
          </div>
        </div>
      ) : null}

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

  const [createMode, setCreateMode] = useState<'upload' | 'manual'>('upload')
  const [draft, setDraft] = useState<ProjectDraft>(() => buildDraft('approved', []))
  const [editDraft, setEditDraft] = useState<ProjectDraft>(() => buildDraft('approved', []))
  const [isSaving, setIsSaving] = useState(false)

  const [noteFile, setNoteFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (route.isInvalid) {
      navigate('/dashboard/manufacturing', { replace: true })
    }
  }, [navigate, route.isInvalid])

  const statusOptions = useMemo(() => {
    if (!settings) {
      return ['approved', 'sent_to_craftsman', 'internal_setting_qc', 'diamond_sorting', 'stone_setting', 'plating', 'final_piece_qc', 'complete_piece', 'ready_for_sale', 'sold']
    }

    return settings.steps
      .filter(step => step.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(step => step.stepKey)
  }, [settings])

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

  async function loadRecords(currentSearch: string, currentStatus: string) {
    setIsLoading(true)
    setError(null)

    try {
      const page = await getManufacturingProjects({
        search: currentSearch,
        status: currentStatus,
        limit: 150,
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

  useEffect(() => {
    void loadRecords(search, statusFilter)
  }, [search, statusFilter])

  useEffect(() => {
    void loadSettings()
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
      setDraft(current => ({
        ...current,
        manufacturingCode: parsed.manufacturingCode ?? current.manufacturingCode,
        pieceName: parsed.pieceName ?? current.pieceName,
        pieceType: parsed.pieceType ?? current.pieceType,
        status: statusOptions.includes(parsed.status) ? parsed.status : current.status,
        designerName: parsed.designerName ?? current.designerName,
        craftsmanName: parsed.craftsmanName ?? current.craftsmanName,
        usageNotes: parsed.usageNotes ?? current.usageNotes,
        totalCost: parsed.totalCost != null ? String(parsed.totalCost) : current.totalCost,
        sellingPrice: parsed.sellingPrice != null ? String(parsed.sellingPrice) : current.sellingPrice,
        photosText: current.photosText || `uploaded-note:${noteFile.name}`,
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

  async function handleCreate() {
    if (!draft.manufacturingCode.trim() || !draft.pieceName.trim()) {
      setError('Manufacturing code and piece name are required.')
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

    const photos = parsePhotos(draft.photosText)
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
        status: draft.status,
        designerName: draft.designerName.trim() || null,
        craftsmanName: draft.craftsmanName.trim() || null,
        sellingPrice: Number(draft.sellingPrice) || 0,
        totalCost: Number(draft.totalCost) || 0,
        metalPlating: draft.metalPlating
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0),
        usageNotes: draft.usageNotes.trim() || null,
        photos,
        gemstones: draft.gemstones,
        customFields: payloadCustomFields
      })

      setCreateMode('upload')
      setNoteFile(null)
      setDraft(buildDraft(defaultStatus, activeFields))
      await loadRecords(search, statusFilter)
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

    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateManufacturingProject(selected.id, {
        status: selectedStatus,
        activityNote: `Status updated from dashboard to ${selectedStatus}`
      })

      setSelected(updated)
      await loadRecords(search, statusFilter)
    } catch {
      setError('Unable to update project status.')
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

    const photos = parsePhotos(editDraft.photosText)
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
        status: editDraft.status,
        designerName: editDraft.designerName.trim() || null,
        craftsmanName: editDraft.craftsmanName.trim() || null,
        sellingPrice: Number(editDraft.sellingPrice) || 0,
        totalCost: Number(editDraft.totalCost) || 0,
        metalPlating: editDraft.metalPlating
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0),
        usageNotes: editDraft.usageNotes.trim() || null,
        photos,
        gemstones: payloadGemstones,
        customFields: payloadCustomFields,
        activityNote: 'Project details updated from edit panel'
      })

      setSelected(updated)
      setSelectedStatus(updated.status)
      setEditDraft(mapDetailToDraft(updated, activeFields))
      await loadRecords(search, statusFilter)
      navigate(`/dashboard/manufacturing/${updated.id}`)
    } catch {
      setError('Unable to save manufacturing project changes.')
    } finally {
      setIsSaving(false)
    }
  }

  function openDetail(projectId: number) {
    navigate(`/dashboard/manufacturing/${projectId}`)
  }

  function closeDetail() {
    navigate('/dashboard/manufacturing')
  }

  function openEdit() {
    if (!route.detailId) {
      return
    }

    navigate(`/dashboard/manufacturing/${route.detailId}/edit`)
  }

  function closeEdit() {
    if (!route.detailId) {
      navigate('/dashboard/manufacturing')
      return
    }

    navigate(`/dashboard/manufacturing/${route.detailId}`)
  }

  function openFullDetail() {
    if (!route.detailId) {
      return
    }

    navigate(`/dashboard/manufacturing/${route.detailId}/full`)
  }

  function closeFullDetail() {
    if (!route.detailId) {
      navigate('/dashboard/manufacturing')
      return
    }

    navigate(`/dashboard/manufacturing/${route.detailId}`)
  }

  if (route.mode === 'create') {
    return (
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
              <input
                type="file"
                accept="image/*"
                onChange={event => setNoteFile(event.target.files?.[0] ?? null)}
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
                {PIECE_TYPES.map(type => (
                  <option key={type} value={type}>{labelize(type)}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
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

            {activeFields.map(field => {
              if (field.fieldKey === 'designerName') {
                return (
                  <label key={field.fieldKey}>
                    {field.label}
                    <input
                      value={draft.designerName}
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
                      value={draft.craftsmanName}
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

            <label>
              Selling Price (THB)
              <input type="number" value={draft.sellingPrice} onChange={event => setDraft(current => ({ ...current, sellingPrice: event.target.value }))} />
            </label>
            <label>
              Gemstone Cost (Calculated)
              <input value={formatCurrency(draftGemstoneCost)} readOnly />
            </label>
            <label>
              Total Cost (THB)
              <input type="number" value={draft.totalCost} onChange={event => setDraft(current => ({ ...current, totalCost: event.target.value }))} />
            </label>
            <label className="crm-form-span">
              Metal Plating (comma separated)
              <input value={draft.metalPlating} onChange={event => setDraft(current => ({ ...current, metalPlating: event.target.value }))} placeholder="white_gold, rose_gold" />
            </label>
            <label className="crm-form-span">
              Photos (URL or identifier, comma/new line separated)
              <textarea rows={2} value={draft.photosText} onChange={event => setDraft(current => ({ ...current, photosText: event.target.value }))} />
            </label>
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
    )
  }

  if (route.mode === 'edit') {
    return (
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
                {PIECE_TYPES.map(type => (
                  <option key={type} value={type}>{labelize(type)}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={editDraft.status} onChange={event => setEditDraft(current => ({ ...current, status: event.target.value }))}>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
            </label>

            <label>
              Designer
              <input value={editDraft.designerName} onChange={event => setEditDraft(current => ({ ...current, designerName: event.target.value }))} />
            </label>
            <label>
              Craftsman
              <input value={editDraft.craftsmanName} onChange={event => setEditDraft(current => ({ ...current, craftsmanName: event.target.value }))} />
            </label>

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

            <label>
              Selling Price (THB)
              <input type="number" value={editDraft.sellingPrice} onChange={event => setEditDraft(current => ({ ...current, sellingPrice: event.target.value }))} />
            </label>
            <label>
              Gemstone Cost (Calculated)
              <input value={formatCurrency(editGemstoneCost)} readOnly />
            </label>
            <label>
              Total Cost (THB)
              <input type="number" value={editDraft.totalCost} onChange={event => setEditDraft(current => ({ ...current, totalCost: event.target.value }))} />
            </label>
            <label className="crm-form-span">
              Metal Plating (comma separated)
              <input value={editDraft.metalPlating} onChange={event => setEditDraft(current => ({ ...current, metalPlating: event.target.value }))} />
            </label>
            <label className="crm-form-span">
              Photos (URL or identifier, comma/new line separated)
              <textarea rows={2} value={editDraft.photosText} onChange={event => setEditDraft(current => ({ ...current, photosText: event.target.value }))} />
            </label>
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
    )
  }

  const listCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Manufacturing Records</h3>
          <p>{totalCount.toLocaleString()} projects across production workflow stages</p>
        </div>
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
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

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
        <div />
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading manufacturing projects...</p>
      ) : (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Piece</th>
                <th>Status</th>
                <th>Designer</th>
                <th>Selling Price</th>
                <th>Customer</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} onClick={() => openDetail(record.id)}>
                  <td>{record.manufacturingCode}</td>
                  <td>
                    <strong>{record.pieceName}</strong>
                    <p className="inline-subtext">{labelize(record.pieceType)}</p>
                  </td>
                  <td>{labelize(record.status)}</td>
                  <td>{record.designerName ?? '-'}</td>
                  <td>{formatCurrency(record.sellingPrice)}</td>
                  <td>{record.customerName ?? '-'}</td>
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
      <section className="content-card detail-page-card">
        <div className="card-head">
          <div>
            <h3>Manufacturing Project Detail</h3>
            <p>Full page view for one project record.</p>
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

        {isLoadingDetail ? (
          <p className="panel-placeholder">Loading manufacturing detail...</p>
        ) : selected ? (
          <ManufacturingDetailContent
            selected={selected}
            selectedStatus={selectedStatus}
            statusOptions={statusOptions}
            customFieldLabels={customFieldLabels}
            stepRequirementsByStatus={stepRequirementsByStatus}
            isSaving={isSaving}
            onSelectedStatusChange={setSelectedStatus}
            onUpdateStatus={() => {
              void handleUpdateStatus()
            }}
          />
        ) : (
          <p className="panel-placeholder">No manufacturing detail found for this route.</p>
        )}
      </section>
    )
  }

  return (
    <div className={`content-split ${route.mode === 'detail' ? 'has-detail' : ''}`}>
      <div className="content-split-main">
        {listCard}
      </div>

      {route.mode === 'detail' ? (
        <aside className="detail-side-panel">
          <div className="drawer-head">
            <h3>Manufacturing Detail</h3>
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

          {isLoadingDetail ? (
            <p className="panel-placeholder">Loading manufacturing detail...</p>
          ) : selected ? (
            <ManufacturingDetailContent
              selected={selected}
              selectedStatus={selectedStatus}
              statusOptions={statusOptions}
              customFieldLabels={customFieldLabels}
              stepRequirementsByStatus={stepRequirementsByStatus}
              isSaving={isSaving}
              onSelectedStatusChange={setSelectedStatus}
              onUpdateStatus={() => {
                void handleUpdateStatus()
              }}
            />
          ) : (
            <p className="panel-placeholder">No manufacturing detail found for this record.</p>
          )}
        </aside>
      ) : null}
    </div>
  )
}
