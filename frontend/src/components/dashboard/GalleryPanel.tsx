import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, MoreVertical, Search, Trash2, UserRound, Wrench } from 'lucide-react'
import {
  attachGalleryAsset,
  createGalleryAsset,
  deleteGalleryAsset,
  getCustomers,
  getGalleryAssets,
  getInventoryItems,
  getManufacturingProjects
} from '../../api/client'
import type { Customer, GalleryAsset, InventoryItem, ManufacturingProjectSummary } from '../../api/types'
import { useSession } from '../../app/useSession'

type AttachmentType = 'customer' | 'manufacturing' | 'gemstone'

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read image.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('Unable to read image.'))
    reader.readAsDataURL(file)
  })
}

function attachmentLabel(item: GalleryAsset): string {
  if (item.attachedCustomerId) {
    return `Customer: ${item.attachedCustomerName ?? item.attachedCustomerId}`
  }
  if (item.attachedProjectId) {
    return `Manufacturing: ${item.attachedManufacturingCode ?? `#${item.attachedProjectId}`}`
  }
  if (item.attachedInventoryItemId) {
    return `Gemstone: ${item.attachedGemstoneCode ?? `#${item.attachedInventoryItemId}`}`
  }
  return 'Unattached'
}

export function GalleryPanel() {
  const { email } = useSession()
  const [search, setSearch] = useState('')
  const [attachmentFilter, setAttachmentFilter] = useState('all')
  const [assets, setAssets] = useState<GalleryAsset[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [activeAsset, setActiveAsset] = useState<GalleryAsset | null>(null)
  const [attachType, setAttachType] = useState<AttachmentType>('customer')
  const [attachSearch, setAttachSearch] = useState('')
  const [isAttaching, setIsAttaching] = useState(false)
  const [isLoadingAttachOptions, setIsLoadingAttachOptions] = useState(false)
  const [attachCustomers, setAttachCustomers] = useState<Customer[]>([])
  const [attachManufacturing, setAttachManufacturing] = useState<ManufacturingProjectSummary[]>([])
  const [attachGemstones, setAttachGemstones] = useState<InventoryItem[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function loadAssets(currentSearch: string, currentAttachment: string) {
    setIsLoading(true)
    setError(null)
    try {
      const page = await getGalleryAssets({
        search: currentSearch,
        attachment: currentAttachment,
        limit: 400,
        offset: 0
      })
      setAssets(page.items)
      setTotalCount(page.totalCount)
    } catch {
      setError('Unable to load gallery assets.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAssets(search, attachmentFilter)
  }, [search, attachmentFilter])

  useEffect(() => {
    if (!activeAsset) {
      return
    }

    let cancelled = false
    setIsLoadingAttachOptions(true)
    setError(null)

    const lookup = attachSearch.trim()
    let task: Promise<void>
    if (attachType === 'customer') {
      task = getCustomers({ search: lookup, limit: 30, offset: 0 }).then(page => {
        if (!cancelled) {
          setAttachCustomers(page.items)
        }
      })
    } else if (attachType === 'manufacturing') {
      task = getManufacturingProjects({ search: lookup, limit: 30, offset: 0 }).then(page => {
        if (!cancelled) {
          setAttachManufacturing(page.items)
        }
      })
    } else {
      task = getInventoryItems({ search: lookup, limit: 30, offset: 0 }).then(page => {
        if (!cancelled) {
          setAttachGemstones(page.items)
        }
      })
    }

    void task
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load attachment options.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAttachOptions(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeAsset, attachSearch, attachType])

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      const selected = Array.from(files)
      for (const file of selected) {
        const photoUrl = await readFileAsDataUrl(file)
        await createGalleryAsset({
          photoUrl,
          createdBy: email
        })
      }
      await loadAssets(search, attachmentFilter)
    } catch {
      setError('Unable to upload gallery image.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteAsset(id: string) {
    if (!window.confirm('Delete this gallery image?')) {
      return
    }
    setError(null)
    try {
      await deleteGalleryAsset(id)
      setAssets(current => current.filter(item => item.id !== id))
      setTotalCount(current => Math.max(0, current - 1))
      setOpenMenuId(null)
    } catch {
      setError('Unable to delete gallery image.')
    }
  }

  async function handleClearAttachment(asset: GalleryAsset) {
    setIsAttaching(true)
    setError(null)
    try {
      const updated = await attachGalleryAsset(asset.id, {
        customerId: null,
        manufacturingProjectId: null,
        inventoryItemId: null
      })
      setAssets(current => current.map(item => (item.id === updated.id ? updated : item)))
      setOpenMenuId(null)
    } catch {
      setError('Unable to clear attachment.')
    } finally {
      setIsAttaching(false)
    }
  }

  async function attachToSelection(payload: { customerId?: string | null, manufacturingProjectId?: number | null, inventoryItemId?: number | null }) {
    if (!activeAsset) {
      return
    }

    setIsAttaching(true)
    setError(null)
    try {
      const updated = await attachGalleryAsset(activeAsset.id, payload)
      setAssets(current => current.map(item => (item.id === updated.id ? updated : item)))
      setActiveAsset(null)
      setAttachSearch('')
    } catch {
      setError('Unable to attach image.')
    } finally {
      setIsAttaching(false)
    }
  }

  const attachTitle = useMemo(() => {
    if (!activeAsset) {
      return ''
    }
    if (attachType === 'customer') {
      return 'Attach to customer'
    }
    if (attachType === 'manufacturing') {
      return 'Attach to manufacturing record'
    }
    return 'Attach to gemstone'
  }, [activeAsset, attachType])

  return (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Gallery</h3>
          <p>{totalCount.toLocaleString()} uploaded photos</p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="filter-grid">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by attachment or uploader" />
        <select value={attachmentFilter} onChange={event => setAttachmentFilter(event.target.value)}>
          <option value="all">All attachments</option>
          <option value="unattached">Unattached</option>
          <option value="customer">Customer</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="gemstone">Gemstone</option>
        </select>
      </div>

      <div className="gallery-bento">
        <article
          className={`gallery-upload-tile ${isUploading ? 'is-uploading' : ''}`}
          onDragOver={event => {
            event.preventDefault()
          }}
          onDrop={event => {
            event.preventDefault()
            void handleUploadFiles(event.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={event => {
              void handleUploadFiles(event.target.files)
              event.currentTarget.value = ''
            }}
          />
          <h4>Quick Upload</h4>
          <p>Drop photos anywhere in this tile</p>
          <button type="button" className="primary-btn" onClick={() => inputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
            {isUploading ? 'Uploading...' : 'Select Images'}
          </button>
        </article>

        {isLoading ? (
          <p className="panel-placeholder">Loading gallery...</p>
        ) : assets.length === 0 ? (
          <p className="panel-placeholder">No gallery photos found for this filter.</p>
        ) : (
          assets.map(asset => (
            <article key={asset.id} className="gallery-asset-tile">
              <img src={asset.photoUrl} alt={`Gallery ${asset.id}`} />
              <div className="gallery-asset-overlay">
                <span className="metric-badge">{attachmentLabel(asset)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setOpenMenuId(current => (current === asset.id ? null : asset.id))}
                  aria-label="Open image menu"
                >
                  <MoreVertical size={16} />
                </button>
              </div>

              {openMenuId === asset.id ? (
                <div className="gallery-asset-menu">
                  <button type="button" onClick={() => {
                    setActiveAsset(asset)
                    setAttachType('customer')
                    setAttachSearch('')
                    setOpenMenuId(null)
                  }}>
                    <UserRound size={14} />
                    Attach to customer
                  </button>
                  <button type="button" onClick={() => {
                    setActiveAsset(asset)
                    setAttachType('manufacturing')
                    setAttachSearch('')
                    setOpenMenuId(null)
                  }}>
                    <Wrench size={14} />
                    Attach to manufacturing
                  </button>
                  <button type="button" onClick={() => {
                    setActiveAsset(asset)
                    setAttachType('gemstone')
                    setAttachSearch('')
                    setOpenMenuId(null)
                  }}>
                    <Link2 size={14} />
                    Attach to gemstone
                  </button>
                  <button type="button" onClick={() => void handleClearAttachment(asset)} disabled={isAttaching}>
                    <Link2 size={14} />
                    Clear attachment
                  </button>
                  <button type="button" className="danger" onClick={() => void handleDeleteAsset(asset.id)}>
                    <Trash2 size={14} />
                    Delete photo
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {activeAsset ? (
        <div className="detail-modal-backdrop" onClick={() => setActiveAsset(null)}>
          <div className="detail-modal-panel gallery-attach-modal" onClick={event => event.stopPropagation()}>
            <div className="drawer-head">
              <h3>{attachTitle}</h3>
              <button type="button" className="icon-btn" onClick={() => setActiveAsset(null)} aria-label="Close">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="filter-grid single-row-filter">
              <label className="gallery-attach-search">
                <Search size={14} />
                <input value={attachSearch} onChange={event => setAttachSearch(event.target.value)} placeholder="Search target" />
              </label>
            </div>

            {isLoadingAttachOptions ? (
              <p className="panel-placeholder">Loading options...</p>
            ) : attachType === 'customer' ? (
              <div className="gallery-attach-results">
                {attachCustomers.map(customer => (
                  <button key={customer.id} type="button" onClick={() => void attachToSelection({ customerId: customer.id })} disabled={isAttaching}>
                    <strong>{customer.name}</strong>
                    <span>{customer.nickname ?? customer.email ?? '-'}</span>
                  </button>
                ))}
              </div>
            ) : attachType === 'manufacturing' ? (
              <div className="gallery-attach-results">
                {attachManufacturing.map(project => (
                  <button key={project.id} type="button" onClick={() => void attachToSelection({ manufacturingProjectId: project.id })} disabled={isAttaching}>
                    <strong>{project.manufacturingCode}</strong>
                    <span>{project.pieceName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="gallery-attach-results">
                {attachGemstones.map(gem => (
                  <button key={gem.id} type="button" onClick={() => void attachToSelection({ inventoryItemId: gem.id })} disabled={isAttaching}>
                    <strong>{gem.gemstoneNumber ?? gem.gemstoneNumberText ?? gem.id}</strong>
                    <span>{gem.gemstoneType ?? '-'} / {gem.shape ?? '-'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
