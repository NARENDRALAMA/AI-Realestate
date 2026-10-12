import { useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  FileText,
  ImagePlus,
  MapPin,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Input, Textarea } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { StepTips } from '../components/StepTips'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import { uploadImage } from '../lib/api'
import { validateProperty } from '../lib/validation'
import type { PropertyData } from '../types'

type TextField = Exclude<keyof PropertyData, 'imageFileName' | 'imagePath'>
type UploadState = 'idle' | 'uploading' | 'done' | 'error'

const fieldLabels: Partial<Record<TextField, string>> = {
  title: 'Listing title',
  location: 'Location',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
}

const fieldId = (k: TextField) => `property-${k}`

export function PropertyInput() {
  const {
    property,
    setProperty,
    loadSampleProperty,
    generationFieldErrors,
    imagePreview,
    setImagePreview,
  } = useApp()
  const navigate = useNavigate()
  const toast = useToast()

  const [touched, setTouched] = useState<Partial<Record<TextField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  const errors = validateProperty(property)
  const errorFor = (k: TextField) =>
    touched[k] || submitted ? errors[k] : generationFieldErrors[k]
  const errorKeys = Object.keys(errors) as TextField[]

  const bind = (k: TextField) => ({
    id: fieldId(k),
    value: property[k],
    error: errorFor(k),
    onChange: (e: { target: { value: string } }) =>
      setProperty((p) => ({ ...p, [k]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (errorKeys.length) {
      document.getElementById(fieldId(errorKeys[0]))?.focus()
      return
    }
    navigate('/app/settings')
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<UploadState>(() =>
    property.imagePath ? 'done' : property.imageFileName ? 'error' : 'idle',
  )
  const [uploadError, setUploadError] = useState<string | null>(() =>
    property.imageFileName && !property.imagePath
      ? "The last upload didn't finish. Choose the photo again."
      : null,
  )
  const [dragging, setDragging] = useState(false)
  const [lastFile, setLastFile] = useState<File | null>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadState('error')
      setUploadError('That file isn’t an image. Choose a JPG, PNG or WebP photo.')
      return
    }
    setLastFile(file)
    setImagePreview(URL.createObjectURL(file))
    setUploadState('uploading')
    setUploadError(null)
    setProperty((p) => ({ ...p, imageFileName: file.name, imagePath: null }))
    try {
      const path = await uploadImage(file)
      setProperty((p) => ({ ...p, imagePath: path }))
      setUploadState('done')
      toast.show('Photo uploaded')
    } catch (err) {
      setUploadState('error')
      setUploadError(err instanceof Error ? err.message : "Couldn't upload the photo.")
    }
  }

  const removePhoto = () => {
    setLastFile(null)
    setImagePreview(null)
    setUploadState('idle')
    setUploadError(null)
    setProperty((p) => ({ ...p, imageFileName: null, imagePath: null }))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 1"
        title="Property details"
        description="These details feed every piece of copy. The more specific you are, the better the result."
        actions={
          <Button
            variant="secondary"
            icon={<Wand2 aria-hidden />}
            onClick={() => {
              loadSampleProperty()
              setTouched({})
              setSubmitted(false)
              toast.show('Sample property filled in', 'info')
            }}
          >
            Fill with sample
          </Button>
        }
      />

      <StepTips step="property" />

      <form className="stack stack--lg" onSubmit={handleSubmit} noValidate>
        {submitted && errorKeys.length > 0 ? (
          <Alert
            tone="danger"
            title={errorKeys.length === 1 ? '1 field needs attention' : `${errorKeys.length} fields need attention`}
          >
            <ul>
              {errorKeys.map((k) => (
                <li key={k}>
                  <a href={`#${fieldId(k)}`}>
                    {fieldLabels[k] ?? k}: {errors[k]}
                  </a>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <Card as="section" padding="lg" aria-labelledby="sec-basics">
          <CardHeader
            titleId="sec-basics"
            icon={<MapPin />}
            title="Basics"
            description="What it's called and where it is. Fields marked * are required."
          />
          <div className="form-grid form-grid--2">
            <Input
              {...bind('title')}
              className="form-grid__full"
              label="Listing title"
              required
              placeholder="e.g. Sunlit 3-bed terrace with city views"
              hint="Used as the headline across every channel."
              autoComplete="off"
            />
            <Input
              {...bind('location')}
              label="Location"
              required
              placeholder="e.g. Richmond, VIC"
              hint="Suburb and state."
            />
            <Input
              {...bind('price')}
              label="Price"
              placeholder="e.g. $1,250,000 or Offers over $1.2m"
              hint="Any format. Leave blank if not disclosed."
            />
            <Input
              {...bind('address')}
              className="form-grid__full"
              label="Street address"
              placeholder="e.g. 42 Hawthorn Grove, Richmond VIC 3121"
              autoComplete="street-address"
            />
          </div>
        </Card>

        <Card as="section" padding="lg" aria-labelledby="sec-specs">
          <CardHeader
            titleId="sec-specs"
            icon={<BedDouble />}
            title="Specs"
            description="Optional, but buyers look for these first."
          />
          <div className="form-grid form-grid--3">
            <Input {...bind('bedrooms')} label="Bedrooms" inputMode="decimal" placeholder="e.g. 3" />
            <Input {...bind('bathrooms')} label="Bathrooms" inputMode="decimal" placeholder="e.g. 2" />
            <Input {...bind('parking')} label="Parking" placeholder="e.g. 2 car garage" />
            <Input {...bind('landSize')} label="Land size" placeholder="e.g. 450 m²" />
            <Input {...bind('interiorSize')} label="Interior size" placeholder="e.g. 168 m²" />
          </div>
        </Card>

        <Card as="section" padding="lg" aria-labelledby="sec-desc">
          <CardHeader
            titleId="sec-desc"
            icon={<FileText />}
            title="Description"
            description="Your selling points in plain words. We'll turn them into polished copy."
          />
          <div className="form-grid">
            <Textarea
              {...bind('features')}
              label="Key features"
              rows={4}
              placeholder="e.g. North-facing living, engineered oak floors, SMEG kitchen, private courtyard"
              hint="Separate with commas. Put the strongest selling points first."
            />
            <Textarea
              {...bind('amenities')}
              label="Amenities"
              rows={3}
              placeholder="e.g. Split system AC, NBN, security intercom, storage cage"
            />
            <Textarea
              {...bind('agentNotes')}
              label="Agent notes"
              rows={3}
              placeholder="e.g. Vendor motivated, flexible settlement, open by appointment"
              hint="Anything buyers should know: settlement terms, inspection times, rental history."
            />
          </div>
        </Card>

        <Card as="section" padding="lg" aria-labelledby="sec-photo">
          <CardHeader
            titleId="sec-photo"
            icon={<ImagePlus />}
            title="Photo"
            description="Optional. Saved with this content in your library."
          />
          {property.imageFileName && uploadState !== 'error' ? (
            <div className="photo-row">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="photo-row__thumb" />
              ) : (
                <span className="photo-row__thumb photo-row__thumb--empty" aria-hidden>
                  <ImagePlus />
                </span>
              )}
              <div className="photo-row__info">
                <p className="photo-row__name">{property.imageFileName}</p>
                <p className="photo-row__status" role="status">
                  {uploadState === 'uploading' ? (
                    'Uploading…'
                  ) : (
                    <>
                      <CheckCircle2 aria-hidden /> Uploaded
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 aria-hidden />}
                onClick={removePhoto}
                disabled={uploadState === 'uploading'}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div
              className={`dropzone ${dragging ? 'dropzone--active' : ''}`.trim()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <ImagePlus className="dropzone__icon" aria-hidden />
              <p className="dropzone__text">Drag a photo here, or</p>
              <label className="btn btn--secondary btn--md file-trigger">
                <Upload aria-hidden />
                Choose a photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
              <p className="dropzone__hint">JPG, PNG or WebP.</p>
            </div>
          )}
          {uploadState === 'error' && uploadError ? (
            <Alert
              tone="danger"
              className="photo-alert"
              title="Photo not uploaded"
              actions={
                lastFile ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw aria-hidden />}
                    onClick={() => void handleFile(lastFile)}
                  >
                    Try again
                  </Button>
                ) : null
              }
            >
              {uploadError}
            </Alert>
          ) : null}
        </Card>

        <div className="form-footer">
          <p className="form-footer__note">
            Your details are kept while you move between steps.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            iconAfter={<ArrowRight aria-hidden />}
          >
            Continue to content settings
          </Button>
        </div>
      </form>
    </>
  )
}
