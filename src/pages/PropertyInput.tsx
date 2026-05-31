import { useNavigate } from 'react-router-dom'
import { ImagePlus, Loader2, Upload } from 'lucide-react'
import { Card } from '../components/Card'
import { useApp } from '../hooks/useApp'
import { uploadImage } from '../lib/api'

export function PropertyInput() {
  const { property, setProperty, loadSampleProperty } = useApp()
  const navigate = useNavigate()

  const handleFile = async (file: File) => {
    setProperty((p) => ({ ...p, imageFileName: file.name, imagePath: null }))
    try {
      const path = await uploadImage(file)
      setProperty((p) => ({ ...p, imagePath: path }))
    } catch {
      // Upload failed — keep filename for display, path stays null
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Property input</h1>
        <p className="page-lead">
          Enter structured listing data. This feeds every generated channel.
        </p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={loadSampleProperty}>
          Load sample property
        </button>
      </div>

      <Card>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            navigate('/settings')
          }}
        >
          <label className="field">
            <span className="field__label">Title</span>
            <input
              className="input"
              value={property.title}
              onChange={(e) => setProperty((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Contemporary 4-bed family home"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Price</span>
            <input
              className="input"
              value={property.price}
              onChange={(e) => setProperty((p) => ({ ...p, price: e.target.value }))}
              placeholder="e.g. $895,000"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Location</span>
            <input
              className="input"
              value={property.location}
              onChange={(e) => setProperty((p) => ({ ...p, location: e.target.value }))}
              placeholder="Suburb, State"
              required
            />
          </label>
          <label className="field field--span-2">
            <span className="field__label">Address</span>
            <input
              className="input"
              value={property.address}
              onChange={(e) => setProperty((p) => ({ ...p, address: e.target.value }))}
              placeholder="Full street address"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Bedrooms</span>
            <input
              className="input"
              inputMode="numeric"
              value={property.bedrooms}
              onChange={(e) => setProperty((p) => ({ ...p, bedrooms: e.target.value }))}
              placeholder="3"
            />
          </label>
          <label className="field">
            <span className="field__label">Bathrooms</span>
            <input
              className="input"
              inputMode="numeric"
              value={property.bathrooms}
              onChange={(e) => setProperty((p) => ({ ...p, bathrooms: e.target.value }))}
              placeholder="2"
            />
          </label>
          <label className="field">
            <span className="field__label">Parking</span>
            <input
              className="input"
              value={property.parking}
              onChange={(e) => setProperty((p) => ({ ...p, parking: e.target.value }))}
              placeholder="2 spaces"
            />
          </label>
          <label className="field">
            <span className="field__label">Land size</span>
            <input
              className="input"
              value={property.landSize}
              onChange={(e) => setProperty((p) => ({ ...p, landSize: e.target.value }))}
              placeholder="e.g. 450 m²"
            />
          </label>
          <label className="field">
            <span className="field__label">Interior size</span>
            <input
              className="input"
              value={property.interiorSize}
              onChange={(e) => setProperty((p) => ({ ...p, interiorSize: e.target.value }))}
              placeholder="e.g. 168 m²"
            />
          </label>
          <label className="field field--span-2">
            <span className="field__label">Features</span>
            <textarea
              className="textarea"
              rows={4}
              value={property.features}
              onChange={(e) => setProperty((p) => ({ ...p, features: e.target.value }))}
              placeholder="Outdoor flow, renovation highlights, aspect, storage…"
            />
          </label>
          <label className="field field--span-2">
            <span className="field__label">Amenities</span>
            <textarea
              className="textarea"
              rows={3}
              value={property.amenities}
              onChange={(e) => setProperty((p) => ({ ...p, amenities: e.target.value }))}
              placeholder="Heating/cooling, NBN, intercom, strata facilities…"
            />
          </label>
          <label className="field field--span-2">
            <span className="field__label">Agent notes</span>
            <textarea
              className="textarea"
              rows={3}
              value={property.agentNotes}
              onChange={(e) => setProperty((p) => ({ ...p, agentNotes: e.target.value }))}
              placeholder="Settlement flexibility, rental history, staging notes…"
            />
          </label>

          <div className="field field--span-2 upload-placeholder">
            <span className="field__label">Imagery</span>
            <div
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
            >
              <ImagePlus size={28} strokeWidth={1.5} aria-hidden />
              <p>
                <strong>Image upload</strong> — drag & drop or choose a file.
              </p>
              <p className="upload-zone__hint">
                File is uploaded to the backend and the path is stored with the generation record.
              </p>
              <label className="btn btn--secondary upload-zone__btn">
                <Upload size={16} aria-hidden />
                Choose file
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFile(f)
                  }}
                />
              </label>
              {property.imageFileName ? (
                <p className="upload-zone__file">
                  {property.imagePath
                    ? `Uploaded: ${property.imageFileName}`
                    : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Loader2 size={13} className="spin" aria-hidden />
                        Uploading {property.imageFileName}…
                      </span>
                    )}
                </p>
              ) : null}
            </div>
          </div>

          <div className="form-actions field--span-2">
            <button type="submit" className="btn btn--primary">
              Continue
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
