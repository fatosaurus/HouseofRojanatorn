import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, Pencil, Plus, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { addCustomerNote, createCustomer, getCustomer, getCustomerActivity, getCustomerPurchasedPhotos, getCustomers, updateCustomer } from '../../api/client'
import type { Customer, CustomerActivity, CustomerPurchasedPhoto } from '../../api/types'
import { useSession } from '../../app/useSession'
import { ImageDropzone } from '../common/ImageDropzone'

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

function getInitial(value: string): string {
  const normalized = value.trim()
  return normalized ? normalized.charAt(0).toUpperCase() : '?'
}

function customerAvatarUrl(customer: Customer): string | null {
  if (customer.photoUrl?.trim()) {
    return customer.photoUrl
  }

  if (customer.photos.length > 0) {
    return customer.photos[0]
  }

  return null
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read image file.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('Unable to read image file.'))
    reader.readAsDataURL(file)
  })
}

function getDisplayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? ''
  if (!local) {
    return 'User'
  }

  return local
    .split(/[._-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

interface CustomerNoteEntry {
  id: string
  body: string
  createdAtUtc: string | null
  author: string
}

function parseCustomerNotes(rawNotes: string | null | undefined): CustomerNoteEntry[] {
  if (!rawNotes?.trim()) {
    return []
  }

  const blocks = rawNotes
    .split(/\n\s*\n/g)
    .map(block => block.trim())
    .filter(Boolean)

  const entries = blocks.map((block, index) => {
    const match = block.match(/^\[(?<timestamp>[^\]]+)\]\s*(?<text>[\s\S]*)$/)
    const timestamp = match?.groups?.timestamp?.trim() ?? null
    const fullBody = match?.groups?.text?.trim() ?? block
    const authorMatch = fullBody.match(/^by\s+(?<author>[^|:]+?)\s*(?:\||:)\s*(?<body>[\s\S]*)$/i)
    const createdByMatch = fullBody.match(/^created by\s+(?<author>[^[]+?)\s*(?<body>\[[\s\S]*)$/i)
    const author = authorMatch?.groups?.author?.trim()
      ?? createdByMatch?.groups?.author?.trim()
      ?? 'System'
    const body = authorMatch?.groups?.body?.trim()
      ?? createdByMatch?.groups?.body?.trim()
      ?? fullBody
    const parsedTimestamp = timestamp ? new Date(timestamp) : null
    const createdAtUtc = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
      ? parsedTimestamp.toISOString()
      : null

    return {
      id: `${createdAtUtc ?? 'note'}-${index}`,
      body,
      createdAtUtc,
      author
    } satisfies CustomerNoteEntry
  })

  return entries.reverse()
}

function formatCustomerNoteMeta(note: CustomerNoteEntry): string {
  if (!note.createdAtUtc) {
    return `by ${note.author}`
  }

  const parsed = new Date(note.createdAtUtc)
  if (Number.isNaN(parsed.getTime())) {
    return `by ${note.author}`
  }

  const elapsedMs = Date.now() - parsed.getTime()
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (elapsedMs < dayMs) {
    if (elapsedMs < minuteMs) {
      return `by ${note.author} just now`
    }

    if (elapsedMs < hourMs) {
      const minutes = Math.max(1, Math.floor(elapsedMs / minuteMs))
      return `by ${note.author} ${minutes} min${minutes === 1 ? '' : 's'} ago`
    }

    const hours = Math.max(1, Math.floor(elapsedMs / hourMs))
    return `by ${note.author} ${hours} hr${hours === 1 ? '' : 's'} ago`
  }

  const datePart = parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
  const timePart = parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return `by ${note.author} ${datePart} at ${timePart}`
}

interface CustomerDraft {
  name: string
  nickname: string
  email: string
  phone: string
  address: string
  customerSince: string
  notes: string
  photoUrl: string
}

const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
  name: '',
  nickname: '',
  email: '',
  phone: '',
  address: '',
  customerSince: '',
  notes: '',
  photoUrl: ''
}

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseCustomersRoute(pathname: string): { detailId: string | null, isFull: boolean, isInvalid: boolean } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard' || parts[1] !== 'customers') {
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

  if (!GUID_REGEX.test(detailSegment)) {
    return { detailId: null, isFull: false, isInvalid: true }
  }

  if (fullSegment && fullSegment !== 'full') {
    return { detailId: detailSegment, isFull: false, isInvalid: true }
  }

  return {
    detailId: detailSegment,
    isFull: fullSegment === 'full',
    isInvalid: parts.length > 4
  }
}

interface CustomerDetailProps {
  customer: Customer
  activity: CustomerActivity[]
  purchasedPhotos: CustomerPurchasedPhoto[]
  isLoadingPurchasedPhotos: boolean
  noteDraft: string
  isSaving: boolean
  isEditing: boolean
  isAddingNote: boolean
  isShowingAllNotes: boolean
  editDraft: CustomerDraft
  onNoteChange: (value: string) => void
  onAddNote: () => void
  onStartAddNote: () => void
  onCancelAddNote: () => void
  onToggleShowAllNotes: () => void
  onProfilePhotoChange: (photoUrl: string | null) => void
  onPhotosChange: (photos: string[]) => void
  onOpenImageViewer: (images: string[], index: number) => void
  onEditDraftChange: (patch: Partial<CustomerDraft>) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
}

function CustomerDetailContent({
  customer,
  activity,
  purchasedPhotos,
  isLoadingPurchasedPhotos,
  noteDraft,
  isSaving,
  isEditing,
  isAddingNote,
  isShowingAllNotes,
  editDraft,
  onNoteChange,
  onAddNote,
  onStartAddNote,
  onCancelAddNote,
  onToggleShowAllNotes,
  onProfilePhotoChange,
  onPhotosChange,
  onOpenImageViewer,
  onEditDraftChange,
  onCancelEdit,
  onSaveEdit
}: CustomerDetailProps) {
  const avatarUrl = customerAvatarUrl(customer)
  const parsedNotes = useMemo(() => parseCustomerNotes(customer.notes), [customer.notes])
  const visibleNotes = isShowingAllNotes ? parsedNotes : parsedNotes.slice(0, 3)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <section className="customer-detail-hero">
        <div className="customer-avatar-upload-wrap">
          {avatarUrl ? (
            <span className="customer-avatar customer-avatar-large customer-avatar-photo">
              <img src={avatarUrl} alt={customer.name} />
            </span>
          ) : (
            <span className="customer-avatar customer-avatar-large">{getInitial(customer.name)}</span>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="customer-avatar-input"
            onChange={event => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              if (!file) {
                return
              }
              void readFileAsDataUrl(file)
                .then(photoUrl => {
                  onProfilePhotoChange(photoUrl)
                })
                .catch(() => {
                  // Ignore local file parse failures; parent handles update errors.
                })
            }}
          />
          <button
            type="button"
            className="icon-btn customer-avatar-upload-btn"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Upload profile photo"
            title="Upload profile photo"
          >
            <Pencil size={14} />
          </button>
        </div>
        <h4>{customer.name}</h4>
        <p>
          Customer since
          {' '}
          {formatDate(customer.customerSince)}
        </p>
      </section>

      {isEditing ? (
        <section className="customer-detail-section customer-edit-section">
          <div className="customer-edit-form">
            <label>
              Name
              <input value={editDraft.name} onChange={event => onEditDraftChange({ name: event.target.value })} />
            </label>
            <label>
              Nickname
              <input value={editDraft.nickname} onChange={event => onEditDraftChange({ nickname: event.target.value })} />
            </label>
            <label>
              Email
              <input value={editDraft.email} onChange={event => onEditDraftChange({ email: event.target.value })} />
            </label>
            <label>
              Phone
              <input value={editDraft.phone} onChange={event => onEditDraftChange({ phone: event.target.value })} />
            </label>
            <label>
              Customer Since
              <input type="date" value={editDraft.customerSince} onChange={event => onEditDraftChange({ customerSince: event.target.value })} />
            </label>
            <label className="customer-edit-full">
              Address
              <input value={editDraft.address} onChange={event => onEditDraftChange({ address: event.target.value })} />
            </label>
            <label className="customer-edit-full">
              Notes
              <textarea rows={3} value={editDraft.notes} onChange={event => onEditDraftChange({ notes: event.target.value })} />
            </label>
            <div className="crm-form-actions customer-edit-full">
              <button type="button" className="secondary-btn" onClick={onCancelEdit} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={onSaveEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="customer-detail-section">
        <h4>Contact Information</h4>
        <div className="customer-contact-grid">
          <article>
            <span>Email</span>
            <p>{customer.email ?? '-'}</p>
          </article>
          <article>
            <span>Phone</span>
            <p>{customer.phone ?? '-'}</p>
          </article>
          <article className="customer-contact-span">
            <span>Address</span>
            <p>{customer.address ?? '-'}</p>
          </article>
          <article>
            <span>Nickname</span>
            <p>{customer.nickname ?? '-'}</p>
          </article>
        </div>
      </section>

      <section className="customer-detail-section">
        <h4>Purchase Summary</h4>
        <div className="customer-summary-grid">
          <article>
            <span>Total Spent</span>
            <strong>{formatCurrency(customer.totalSpent)}</strong>
          </article>
          <article>
            <span>Purchases</span>
            <strong>{customer.purchaseCount}</strong>
          </article>
        </div>
      </section>

      <section className="customer-detail-section">
        <div className="customer-notes-head">
          <h4>Notes</h4>
          {!isAddingNote ? (
            <button type="button" className="secondary-btn" onClick={onStartAddNote}>
              <Plus size={14} />
              Add Note
            </button>
          ) : null}
        </div>

        {isAddingNote ? (
          <div className="crm-note-editor customer-note-editor">
            <textarea rows={3} value={noteDraft} onChange={event => onNoteChange(event.target.value)} placeholder="Add relationship or order notes..." />
            <div className="crm-form-actions">
              <button type="button" className="secondary-btn" onClick={onCancelAddNote} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={onAddNote} disabled={isSaving || !noteDraft.trim()}>
                {isSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        ) : null}

        {parsedNotes.length === 0 ? (
          <p className="panel-placeholder">No notes yet.</p>
        ) : (
          <>
            <div className="customer-note-bubbles">
              {visibleNotes.map(note => (
                <article key={note.id} className="customer-note-bubble">
                  <p>{note.body}</p>
                  <small>{formatCustomerNoteMeta(note)}</small>
                </article>
              ))}
            </div>
            {parsedNotes.length > 3 ? (
              <button type="button" className="secondary-btn customer-notes-toggle" onClick={onToggleShowAllNotes}>
                {isShowingAllNotes ? 'Show Less' : `See More (${parsedNotes.length - 3})`}
              </button>
            ) : null}
          </>
        )}
      </section>

      <section className="customer-detail-section">
        <h4>Customer Gallery</h4>
        <div className="customer-gallery-stack">
          <div className="customer-gallery-subsection">
            <ImageDropzone
              title={`Profile Uploads (${customer.photos.length})`}
              helperText="Upload customer images"
              images={customer.photos}
              onChange={onPhotosChange}
              compact
              confirmDelete
              onPreviewOpen={index => onOpenImageViewer(customer.photos, index)}
            />
          </div>

          <div className="customer-gallery-subsection">
            <div className="customer-gallery-head">
              <h5>Purchased Product Photos ({purchasedPhotos.length})</h5>
            </div>
            {isLoadingPurchasedPhotos ? (
              <p className="panel-placeholder">Loading purchased product gallery...</p>
            ) : purchasedPhotos.length === 0 ? (
              <p className="panel-placeholder">No purchased product photos yet.</p>
            ) : (
              <div className="image-grid customer-product-gallery-grid">
                {purchasedPhotos.map((photo, index) => (
                  <article
                    key={`${photo.projectId}-${index}`}
                    className="image-card customer-product-gallery-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenImageViewer(purchasedPhotos.map(item => item.photoUrl), index)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenImageViewer(purchasedPhotos.map(item => item.photoUrl), index)
                      }
                    }}
                  >
                    <img src={photo.photoUrl} alt={`${photo.pieceName} ${index + 1}`} />
                    <div className="customer-product-gallery-meta">
                      <strong>{photo.pieceName}</strong>
                      <p>{photo.manufacturingCode}</p>
                      <small>{formatDate(photo.soldAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="usage-lines customer-detail-section">
        <h4>Customer Activity ({activity.length})</h4>
        {activity.length === 0 ? (
          <p className="panel-placeholder">No activity logged yet.</p>
        ) : (
          <div className="activity-list">
            {activity.map(item => (
              <article key={item.id}>
                <p>
                  <strong>{item.status.replace(/_/g, ' ')}</strong>
                  {' • '}
                  {formatDate(item.activityAtUtc)}
                </p>
                <p>{item.manufacturingCode} / {item.pieceName}</p>
                {item.notes ? <p>{item.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export function CustomersPanel() {
  const session = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parseCustomersRoute(location.pathname), [location.pathname])

  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<CustomerActivity[]>([])
  const [selectedPurchasedPhotos, setSelectedPurchasedPhotos] = useState<CustomerPurchasedPhoto[]>([])
  const [isLoadingPurchasedPhotos, setIsLoadingPurchasedPhotos] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [isShowingAllNotes, setIsShowingAllNotes] = useState(false)
  const [isEditingDetail, setIsEditingDetail] = useState(false)
  const [editDraft, setEditDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT)

  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT)
  const [isSaving, setIsSaving] = useState(false)
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const isViewerOpen = viewerImages.length > 0
  const viewerImage = isViewerOpen ? viewerImages[viewerIndex] : null

  useEffect(() => {
    if (route.isInvalid) {
      navigate('/dashboard/customers', { replace: true })
    }
  }, [navigate, route.isInvalid])

  async function loadCustomers(currentSearch: string) {
    setIsLoading(true)
    setError(null)

    try {
      const page = await getCustomers({
        search: currentSearch,
        limit: 120,
        offset: 0
      })

      setCustomers(page.items)
      setTotalCount(page.totalCount)
    } catch {
      setError('Unable to load customers.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCustomers(search)
  }, [search])

  useEffect(() => {
    if (!route.detailId) {
      setSelectedCustomer(null)
      setSelectedActivity([])
      setSelectedPurchasedPhotos([])
      setIsLoadingPurchasedPhotos(false)
      setIsLoadingDetail(false)
      setNoteDraft('')
      setIsAddingNote(false)
      setIsShowingAllNotes(false)
      setIsEditingDetail(false)
      setEditDraft(EMPTY_CUSTOMER_DRAFT)
      setViewerImages([])
      setViewerIndex(0)
      return
    }

    let cancelled = false
    setIsLoadingDetail(true)
    setIsLoadingPurchasedPhotos(true)
    setError(null)

    void Promise.all([
      getCustomer(route.detailId),
      getCustomerActivity(route.detailId, 100),
      getCustomerPurchasedPhotos(route.detailId, 220)
    ])
      .then(([customer, activity, purchasedPhotos]) => {
        if (!cancelled) {
          setSelectedCustomer(customer)
          setSelectedActivity(activity)
          setSelectedPurchasedPhotos(purchasedPhotos)
          setViewerImages([])
          setViewerIndex(0)
          setIsAddingNote(false)
          setIsShowingAllNotes(false)
          setIsEditingDetail(false)
          setEditDraft({
            name: customer.name,
            nickname: customer.nickname ?? '',
            email: customer.email ?? '',
            phone: customer.phone ?? '',
            address: customer.address ?? '',
            customerSince: customer.customerSince ? customer.customerSince.slice(0, 10) : '',
            notes: customer.notes ?? '',
            photoUrl: customer.photoUrl ?? ''
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load selected customer profile.')
          setSelectedCustomer(null)
          setSelectedActivity([])
          setSelectedPurchasedPhotos([])
          setIsAddingNote(false)
          setIsShowingAllNotes(false)
          setIsEditingDetail(false)
          setEditDraft(EMPTY_CUSTOMER_DRAFT)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false)
          setIsLoadingPurchasedPhotos(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [route.detailId])

  function openCustomer(id: string) {
    navigate(`/dashboard/customers/${id}`)
  }

  async function handleCreate() {
    if (!draft.name.trim()) {
      setError('Customer name is required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const created = await createCustomer({
        name: draft.name.trim(),
        nickname: draft.nickname.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
        notes: draft.notes.trim() || null
      })

      setDraft(EMPTY_CUSTOMER_DRAFT)
      setIsCreating(false)
      await loadCustomers(search)
      navigate(`/dashboard/customers/${created.id}`)
    } catch {
      setError('Unable to create customer.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddNote() {
    if (!selectedCustomer || !noteDraft.trim()) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const normalized = noteDraft.trim()
      const authorName = getDisplayNameFromEmail(session.email)
      const preparedNote = /^by\s+[^|:]+(?:\||:)/i.test(normalized)
        ? normalized
        : `by ${authorName} | ${normalized}`
      const maybeUpdated = await addCustomerNote(selectedCustomer.id, preparedNote)
      const [activity] = await Promise.all([
        getCustomerActivity(selectedCustomer.id, 100),
        loadCustomers(search)
      ])

      if (maybeUpdated) {
        setSelectedCustomer(maybeUpdated)
      } else {
        const refreshed = await getCustomer(selectedCustomer.id)
        setSelectedCustomer(refreshed)
      }

      setSelectedActivity(activity)
      setNoteDraft('')
      setIsAddingNote(false)
      setIsShowingAllNotes(false)
    } catch {
      setError('Unable to append customer note.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCustomerPhotosChange(photos: string[]) {
    if (!selectedCustomer) {
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const updated = await updateCustomer(selectedCustomer.id, {
        name: selectedCustomer.name,
        nickname: selectedCustomer.nickname,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address,
        notes: selectedCustomer.notes,
        photoUrl: selectedCustomer.photoUrl,
        customerSince: selectedCustomer.customerSince,
        photos
      })
      setSelectedCustomer(updated)
    } catch {
      setError('Unable to update customer gallery.')
    } finally {
      setIsSaving(false)
    }
  }

  function resetEditDraftFromCustomer(customer: Customer) {
    setEditDraft({
      name: customer.name,
      nickname: customer.nickname ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      customerSince: customer.customerSince ? customer.customerSince.slice(0, 10) : '',
      notes: customer.notes ?? '',
      photoUrl: customer.photoUrl ?? ''
    })
  }

  async function handleCustomerProfilePhotoChange(photoUrl: string | null) {
    if (!selectedCustomer) {
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const updated = await updateCustomer(selectedCustomer.id, {
        name: selectedCustomer.name,
        nickname: selectedCustomer.nickname,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address,
        notes: selectedCustomer.notes,
        customerSince: selectedCustomer.customerSince,
        photoUrl,
        photos: selectedCustomer.photos
      })
      setSelectedCustomer(updated)
      resetEditDraftFromCustomer(updated)
    } catch {
      setError('Unable to update customer profile picture.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveCustomerProfile() {
    if (!selectedCustomer) {
      return
    }

    if (!editDraft.name.trim()) {
      setError('Customer name is required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateCustomer(selectedCustomer.id, {
        name: editDraft.name.trim(),
        nickname: editDraft.nickname.trim() || null,
        email: editDraft.email.trim() || null,
        phone: editDraft.phone.trim() || null,
        address: editDraft.address.trim() || null,
        notes: editDraft.notes.trim() || null,
        customerSince: editDraft.customerSince || null,
        photoUrl: editDraft.photoUrl.trim() || null,
        photos: selectedCustomer.photos
      })
      setSelectedCustomer(updated)
      resetEditDraftFromCustomer(updated)
      setIsEditingDetail(false)
      await loadCustomers(search)
    } catch {
      setError('Unable to save customer profile.')
    } finally {
      setIsSaving(false)
    }
  }

  function closeDetail() {
    setIsEditingDetail(false)
    navigate('/dashboard/customers')
  }

  function openImageViewer(images: string[], index: number) {
    if (images.length === 0) {
      return
    }

    const boundedIndex = Math.max(0, Math.min(index, images.length - 1))
    setViewerImages(images)
    setViewerIndex(boundedIndex)
  }

  function closeImageViewer() {
    setViewerImages([])
    setViewerIndex(0)
  }

  function goToPreviousImage() {
    setViewerIndex(current => (current - 1 + viewerImages.length) % viewerImages.length)
  }

  function goToNextImage() {
    setViewerIndex(current => (current + 1) % viewerImages.length)
  }

  useEffect(() => {
    if (!isViewerOpen) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setViewerImages([])
        setViewerIndex(0)
      } else if (event.key === 'ArrowLeft') {
        setViewerIndex(current => (current - 1 + viewerImages.length) % viewerImages.length)
      } else if (event.key === 'ArrowRight') {
        setViewerIndex(current => (current + 1) % viewerImages.length)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isViewerOpen, viewerImages.length])

  function openFullDetail() {
    if (!route.detailId) {
      return
    }

    navigate(`/dashboard/customers/${route.detailId}/full`)
  }

  function closeFullDetail() {
    if (!route.detailId) {
      navigate('/dashboard/customers')
      return
    }

    navigate(`/dashboard/customers/${route.detailId}`)
  }

  const viewerOverlay = isViewerOpen && viewerImage ? (
    <div className="image-lightbox-backdrop" onClick={closeImageViewer}>
      <div className="image-lightbox-dialog" onClick={event => event.stopPropagation()}>
        <div className="image-lightbox-head">
          <p>{viewerIndex + 1} / {viewerImages.length}</p>
          <button type="button" className="icon-btn" onClick={closeImageViewer} aria-label="Close image viewer">
            <X size={18} />
          </button>
        </div>
        <div className="image-lightbox-body">
          {viewerImages.length > 1 ? (
            <button type="button" className="icon-btn image-lightbox-nav prev" onClick={goToPreviousImage} aria-label="Previous image">
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <img src={viewerImage} alt={`Customer image ${viewerIndex + 1}`} />
          {viewerImages.length > 1 ? (
            <button type="button" className="icon-btn image-lightbox-nav next" onClick={goToNextImage} aria-label="Next image">
              <ChevronRight size={20} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null

  const listCard = (
    <section className="content-card">
      <div className="card-head">
        <div>
          <h3>Customer Information</h3>
          <p>{totalCount.toLocaleString()} customer profiles with spend history</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setIsCreating(current => !current)}>
          {isCreating ? 'Cancel' : (
            <>
              <Plus size={14} />
              New Customer
            </>
          )}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {isCreating ? (
        <div className="crm-form-grid">
          <label>
            Name
            <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Nickname
            <input value={draft.nickname} onChange={event => setDraft(current => ({ ...current, nickname: event.target.value }))} />
          </label>
          <label>
            Email
            <input value={draft.email} onChange={event => setDraft(current => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Phone
            <input value={draft.phone} onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))} />
          </label>
          <label className="crm-form-span">
            Address
            <input value={draft.address} onChange={event => setDraft(current => ({ ...current, address: event.target.value }))} />
          </label>
          <label className="crm-form-span">
            Notes
            <textarea rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="crm-form-actions crm-form-span">
            <button type="button" className="secondary-btn" onClick={() => setDraft(EMPTY_CUSTOMER_DRAFT)} disabled={isSaving}>
              Reset
            </button>
            <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="filter-grid single-row-filter">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, nickname, email, or phone" />
      </div>

      {isLoading ? (
        <p className="panel-placeholder">Loading customer list...</p>
      ) : (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Total Spent</th>
                <th>Purchases</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr
                  key={customer.id}
                  className={route.detailId === customer.id ? 'is-selected' : ''}
                  onClick={() => openCustomer(customer.id)}
                >
                  <td>
                    <div className="customer-name-cell">
                      {customerAvatarUrl(customer) ? (
                        <span className="customer-avatar customer-avatar-photo">
                          <img src={customerAvatarUrl(customer) ?? ''} alt={customer.name} />
                        </span>
                      ) : (
                        <span className="customer-avatar">{getInitial(customer.name)}</span>
                      )}
                      <div>
                        <strong>{customer.name}</strong>
                        {customer.nickname ? <p className="inline-subtext">{customer.nickname}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td>{customer.email ?? '-'}</td>
                  <td>{customer.phone ?? '-'}</td>
                  <td className="accent-value">{formatCurrency(customer.totalSpent)}</td>
                  <td>
                    <span className="metric-badge">{customer.purchaseCount}</span>
                  </td>
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
              <h3>Customer Details</h3>
              <p>Full page profile view with notes and activity.</p>
            </div>
            <div className="detail-actions-row detail-actions-row-compact">
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={() => setIsEditingDetail(true)}
                aria-label="Edit customer profile"
                title="Edit customer profile"
              >
                <Pencil size={16} />
              </button>
              <button type="button" className="icon-btn" onClick={closeFullDetail} aria-label="Back to split view" title="Back to split view">
                <ArrowLeft size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={closeDetail} aria-label="Close detail view" title="Close detail view">
                <X size={18} />
              </button>
            </div>
          </div>
  
          {isLoadingDetail ? (
            <p className="panel-placeholder">Loading customer details...</p>
          ) : selectedCustomer ? (
            <CustomerDetailContent
              customer={selectedCustomer}
              activity={selectedActivity}
              purchasedPhotos={selectedPurchasedPhotos}
              isLoadingPurchasedPhotos={isLoadingPurchasedPhotos}
              noteDraft={noteDraft}
              isSaving={isSaving}
              isEditing={isEditingDetail}
              isAddingNote={isAddingNote}
              isShowingAllNotes={isShowingAllNotes}
              editDraft={editDraft}
              onNoteChange={setNoteDraft}
              onAddNote={() => {
                void handleAddNote()
              }}
              onStartAddNote={() => setIsAddingNote(true)}
              onCancelAddNote={() => {
                setIsAddingNote(false)
                setNoteDraft('')
              }}
              onToggleShowAllNotes={() => setIsShowingAllNotes(current => !current)}
              onProfilePhotoChange={photoUrl => {
                void handleCustomerProfilePhotoChange(photoUrl)
              }}
              onPhotosChange={photos => {
                void handleCustomerPhotosChange(photos)
              }}
              onOpenImageViewer={openImageViewer}
              onEditDraftChange={patch => setEditDraft(current => ({ ...current, ...patch }))}
              onCancelEdit={() => {
                if (selectedCustomer) {
                  resetEditDraftFromCustomer(selectedCustomer)
                }
                setIsEditingDetail(false)
              }}
              onSaveEdit={() => {
                void handleSaveCustomerProfile()
              }}
            />
          ) : (
            <p className="panel-placeholder">No customer detail found for this route.</p>
          )}
        </section>
        {viewerOverlay}
      </>
    )
  }

  return (
    <>
      <div className={`content-split ${route.detailId ? 'has-detail' : ''}`}>
        <div className="content-split-main">
          {listCard}
        </div>

        {route.detailId ? (
          <aside className="detail-side-panel">
            <div className="drawer-head">
              <h3>Customer Detail</h3>
              <div className="detail-actions-row detail-actions-row-compact">
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => setIsEditingDetail(true)}
                  aria-label="Edit customer profile"
                  title="Edit customer profile"
                >
                  <Pencil size={16} />
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
              <p className="panel-placeholder">Loading customer details...</p>
            ) : selectedCustomer ? (
              <CustomerDetailContent
                customer={selectedCustomer}
                activity={selectedActivity}
                purchasedPhotos={selectedPurchasedPhotos}
                isLoadingPurchasedPhotos={isLoadingPurchasedPhotos}
                noteDraft={noteDraft}
                isSaving={isSaving}
                isEditing={isEditingDetail}
                isAddingNote={isAddingNote}
                isShowingAllNotes={isShowingAllNotes}
                editDraft={editDraft}
                onNoteChange={setNoteDraft}
                onAddNote={() => {
                  void handleAddNote()
                }}
                onStartAddNote={() => setIsAddingNote(true)}
                onCancelAddNote={() => {
                  setIsAddingNote(false)
                  setNoteDraft('')
                }}
                onToggleShowAllNotes={() => setIsShowingAllNotes(current => !current)}
                onProfilePhotoChange={photoUrl => {
                  void handleCustomerProfilePhotoChange(photoUrl)
                }}
                onPhotosChange={photos => {
                  void handleCustomerPhotosChange(photos)
                }}
                onOpenImageViewer={openImageViewer}
                onEditDraftChange={patch => setEditDraft(current => ({ ...current, ...patch }))}
                onCancelEdit={() => {
                  if (selectedCustomer) {
                    resetEditDraftFromCustomer(selectedCustomer)
                  }
                  setIsEditingDetail(false)
                }}
                onSaveEdit={() => {
                  void handleSaveCustomerProfile()
                }}
              />
            ) : (
              <p className="panel-placeholder">No customer detail found for this record.</p>
            )}
          </aside>
        ) : null}
      </div>
      {viewerOverlay}
    </>
  )
}
