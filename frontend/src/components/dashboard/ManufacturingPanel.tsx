import { useEffect, useState } from 'react'
import {
  createManufacturingProject,
  getManufacturingProject,
  getManufacturingProjects,
  updateManufacturingProject
} from '../../api/client'
import type { ManufacturingProjectDetail, ManufacturingProjectSummary } from '../../api/types'

const STATUS_OPTIONS = [
  'approved',
  'sent_to_craftsman',
  'internal_setting_qc',
  'diamond_sorting',
  'stone_setting',
  'plating',
  'final_piece_qc',
  'complete_piece',
  'ready_for_sale',
  'sold'
]

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
}

const EMPTY_DRAFT: ProjectDraft = {
  manufacturingCode: '',
  pieceName: '',
  pieceType: 'necklace',
  status: 'approved',
  designerName: '',
  craftsmanName: '',
  sellingPrice: '0',
  totalCost: '0',
  metalPlating: '',
  usageNotes: ''
}

export function ManufacturingPanel() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [records, setRecords] = useState<ManufacturingProjectSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<ManufacturingProjectDetail | null>(null)
  const [selectedStatus, setSelectedStatus] = useState('')

  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT)
  const [isSaving, setIsSaving] = useState(false)

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

  useEffect(() => {
    void loadRecords(search, statusFilter)
  }, [search, statusFilter])

  async function openDetail(projectId: number) {
    setError(null)
    try {
      const detail = await getManufacturingProject(projectId)
      setSelected(detail)
      setSelectedStatus(detail.status)
    } catch {
      setError('Unable to load selected manufacturing project.')
    }
  }

  async function handleCreate() {
    if (!draft.manufacturingCode.trim() || !draft.pieceName.trim()) {
      setError('Manufacturing code and piece name are required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
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
        gemstones: []
      })

      setDraft(EMPTY_DRAFT)
      setIsCreating(false)
      await loadRecords(search, statusFilter)
      setSelected(created)
      setSelectedStatus(created.status)
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

  return (
    <>
      <section className="content-card">
        <div className="card-head">
          <div>
            <h3>Manufacturing Records</h3>
            <p>{totalCount.toLocaleString()} projects across production workflow stages</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => setIsCreating(current => !current)}>
            {isCreating ? 'Cancel' : 'New Project'}
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

        <div className="filter-grid">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search code, piece, designer, craftsman" />
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="in_production">In production</option>
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>
                {labelize(status)}
              </option>
            ))}
          </select>
          <div />
        </div>

        {isCreating ? (
          <div className="crm-form-grid">
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
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
            </label>
            <label>
              Designer
              <input value={draft.designerName} onChange={event => setDraft(current => ({ ...current, designerName: event.target.value }))} />
            </label>
            <label>
              Craftsman
              <input value={draft.craftsmanName} onChange={event => setDraft(current => ({ ...current, craftsmanName: event.target.value }))} />
            </label>
            <label>
              Selling Price (THB)
              <input type="number" value={draft.sellingPrice} onChange={event => setDraft(current => ({ ...current, sellingPrice: event.target.value }))} />
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
              Notes
              <textarea rows={3} value={draft.usageNotes} onChange={event => setDraft(current => ({ ...current, usageNotes: event.target.value }))} />
            </label>
            <div className="crm-form-actions crm-form-span">
              <button type="button" className="secondary-btn" onClick={() => setDraft(EMPTY_DRAFT)} disabled={isSaving}>Reset</button>
              <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </div>
        ) : null}

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
                  <tr key={record.id} onClick={() => void openDetail(record.id)}>
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

      {selected ? (
        <div className="detail-modal-backdrop" onClick={() => setSelected(null)}>
          <section className="detail-modal-panel" onClick={event => event.stopPropagation()}>
            <div className="drawer-head">
              <h3>{selected.manufacturingCode} · {selected.pieceName}</h3>
              <button type="button" className="secondary-btn" onClick={() => setSelected(null)}>Close</button>
            </div>

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

            <div className="status-update-row">
              <select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)}>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{labelize(status)}</option>
                ))}
              </select>
              <button type="button" className="primary-btn" onClick={() => void handleUpdateStatus()} disabled={isSaving || selectedStatus === selected.status}>
                {isSaving ? 'Updating...' : 'Update Status'}
              </button>
            </div>

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
              <h4>Gemstones</h4>
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
              <h4>Activity Log</h4>
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
          </section>
        </div>
      ) : null}
    </>
  )
}
