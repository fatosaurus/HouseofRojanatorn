import { useRef, useState } from 'react'
import { ImagePlus, UploadCloud, X } from 'lucide-react'

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
  saveDisabled = false
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

  return (
    <div className="image-dropzone-wrap">
      <p className="image-dropzone-title">{title}</p>
      {helperText ? <p className="inline-subtext">{helperText}</p> : null}
      <div
        className={`image-dropzone ${isDragging ? 'dragging' : ''}`}
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
        <button type="button" className="secondary-btn" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={14} />
          Select Images
        </button>
        <p>{isLoading ? 'Loading images...' : 'Drag and drop photos here, or choose files.'}</p>
        <p className="image-dropzone-count">{images.length}/{maxFiles} uploaded</p>
        <UploadCloud size={22} />
      </div>

      {images.length > 0 ? (
        <div className="image-grid">
          {images.map((image, index) => (
            <article key={`${image.slice(0, 32)}-${index}`} className="image-card">
              <img src={image} alt={`Uploaded ${index + 1}`} />
              <button
                type="button"
                className="icon-btn image-remove-btn"
                onClick={() => onChange(images.filter((_, currentIndex) => currentIndex !== index))}
                aria-label="Remove image"
                title="Remove image"
              >
                <X size={14} />
              </button>
            </article>
          ))}
        </div>
      ) : null}

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
