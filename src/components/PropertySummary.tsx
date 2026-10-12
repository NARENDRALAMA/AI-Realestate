import { Link } from 'react-router-dom'
import { Building2, ImageIcon, MapPin, Pencil } from 'lucide-react'
import { useApp } from '../hooks/useApp'
import { propertyTypeLabel } from '../lib/content-options'
import type { PropertyData } from '../types'
import { Card, CardHeader } from './ui/Card'

const orDash = (v: string) => v.trim() || '—'

/** Read-only recap of the property, with a link back to edit it. */
export function PropertySummary({
  property,
  editable = true,
}: {
  property: PropertyData
  editable?: boolean
}) {
  const { imagePreview } = useApp()
  const specs = [
    property.bedrooms && `${property.bedrooms} bed`,
    property.bathrooms && `${property.bathrooms} bath`,
    property.parking && `${property.parking} parking`,
  ].filter(Boolean)
  const sizes = [
    property.landSize && `Land ${property.landSize}`,
    property.interiorSize && `Interior ${property.interiorSize}`,
  ].filter(Boolean)

  return (
    <Card as="section" aria-labelledby="property-summary-title">
      <CardHeader
        level={3}
        titleId="property-summary-title"
        icon={<Building2 />}
        title="Property"
        actions={
          editable ? (
            <Link to="/app/property" className="inline-link">
              <Pencil aria-hidden />
              Edit
            </Link>
          ) : null
        }
      />
      {imagePreview ? (
        <img
          src={imagePreview}
          alt={`Photo of ${property.title.trim() || 'the property'}`}
          className="summary-photo"
        />
      ) : null}
      <dl className="summary-list">
        <div>
          <dt>Title</dt>
          <dd>{orDash(property.title)}</dd>
        </div>
        {property.propertyType ? (
          <div>
            <dt>Type</dt>
            <dd>{propertyTypeLabel(property.propertyType)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Price</dt>
          <dd>{orDash(property.price)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd className="summary-list__icon">
            <MapPin aria-hidden />
            {orDash(property.location)}
          </dd>
        </div>
        {property.address.trim() ? (
          <div>
            <dt>Address</dt>
            <dd>{property.address}</dd>
          </div>
        ) : null}
        <div>
          <dt>Specs</dt>
          <dd>{specs.length ? specs.join(' · ') : '—'}</dd>
        </div>
        {sizes.length ? (
          <div>
            <dt>Size</dt>
            <dd>{sizes.join(' · ')}</dd>
          </div>
        ) : null}
        {property.features.trim() ? (
          <div>
            <dt>Features</dt>
            <dd className="summary-list__clamp">{property.features}</dd>
          </div>
        ) : null}
        {property.imageFileName ? (
          <div>
            <dt>Photo</dt>
            <dd className="summary-list__icon">
              <ImageIcon aria-hidden />
              {property.imageFileName}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  )
}
