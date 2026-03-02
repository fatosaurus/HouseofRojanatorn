import { useRef, useState } from 'react'
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'

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

interface ImageDropzoneProps {
  title: string
  images: string[]
  onChange: (images: string[]) => void
  maxFiles?: number
  helperText?: string
  onSave?: () => void
  saveLabel?: string
  isSaving?: boolean
  saveDisabled?: boolean
  compact?: boolean
  confirmDelete?: boolean
  onPreviewOpen?: (index: number) => void
}

export function ImageDropzone({
  title,
  images,
  onChange,
  maxFiles = 20,
  helperText,
  onSave,
  saveLabel = 'Save',
  isSaving = false,
  saveDisabled = false,
  compact = false,
  confirmDelete = false,
  onPreviewOpen
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    setIsLoading(true)
    try {
      const available = Math.max(0, maxFiles - images.length)
      const selected = Array.from(files).slice(0, available)
      const next = await Promise.all(selected.map(file => readFileAsDataUrl(file)))
      onChange([...images, ...next])
    } finally {
      setIsLoading(false)
    }
  }

  function removeImage(index: number) {
    if (confirmDelete && !window.confirm('Delete this image?')) {
      return
    }
    onChange(images.filter((_, currentIndex) => currentIndex !== index))
  }

  const imageGrid = images.length > 0 ? (
    <div className="image-grid">
      {images.map((image, index) => (
        <article
          key={`${image.slice(0, 32)}-${index}`}
          className={`image-card ${onPreviewOpen ? 'is-clickable' : ''}`}
          role={onPreviewOpen ? 'button' : undefined}
          tabIndex={onPreviewOpen ? 0 : undefined}
          onClick={() => onPreviewOpen?.(index)}
          onKeyDown={event => {
            if (!onPreviewOpen) {
              return
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onPreviewOpen(index)
            }
          }}
        >
          <img src={image} alt={`Uploaded ${index + 1}`} />
          <button
            type="button"
            className="icon-btn image-remove-btn"
            onClick={event => {
              event.stopPropagation()
              removeImage(index)
            }}
            aria-label="Delete image"
            title="Delete image"
          >
            <Trash2 size={12} />
          </button>
        </article>
      ))}
    </div>
  ) : null

  return (
    <div className={`image-dropzone-wrap ${compact ? 'image-dropzone-wrap-compact' : ''}`}>
      <div className="image-dropzone-head">
        <p className="image-dropzone-title">{title}</p>
        <button type="button" className="secondary-btn" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={14} />
          Select Images
        </button>
      </div>
      {helperText ? <p className="inline-subtext">{helperText}</p> : null}
      <div
        className={compact
          ? `image-dropzone-compact-surface ${isDragging ? 'dragging' : ''}`
          : `image-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={event => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={event => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={event => {
          event.preventDefault()
          setIsDragging(false)
          void addFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={event => {
            void addFiles(event.target.files)
            event.currentTarget.value = ''
          }}
        />

        {compact ? (
          <>
            {images.length === 0 ? (
              <div className="image-dropzone-compact-empty">
                <UploadCloud size={20} />
                <p>{isLoading ? 'Loading images...' : 'Drop photos anywhere in this area.'}</p>
              </div>
            ) : null}
            {imageGrid}
          </>
        ) : (
          <>
            <p>{isLoading ? 'Loading images...' : 'Drag and drop photos here, or choose files.'}</p>
            <p className="image-dropzone-count">{images.length}/{maxFiles} uploaded</p>
            <UploadCloud size={22} />
          </>
        )}
      </div>

      {!compact ? imageGrid : null}

      {onSave ? (
        <div className="crm-form-actions">
          <button type="button" className="primary-btn" onClick={onSave} disabled={isSaving || saveDisabled}>
            {isSaving ? 'Saving...' : saveLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
