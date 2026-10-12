import { emptyProperty, type PropertyData } from '../types'

/** Minimal RFC 4180 parser: commas, quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',' || c === '\t') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim()))
}

const HEADER_MAP: Record<string, keyof PropertyData> = {
  title: 'title',
  'listing title': 'title',
  price: 'price',
  location: 'location',
  suburb: 'location',
  address: 'address',
  bedrooms: 'bedrooms',
  beds: 'bedrooms',
  bathrooms: 'bathrooms',
  baths: 'bathrooms',
  parking: 'parking',
  cars: 'parking',
  land_size: 'landSize',
  'land size': 'landSize',
  landsize: 'landSize',
  interior_size: 'interiorSize',
  'interior size': 'interiorSize',
  interiorsize: 'interiorSize',
  features: 'features',
  amenities: 'amenities',
  agent_notes: 'agentNotes',
  'agent notes': 'agentNotes',
  notes: 'agentNotes',
}

export const CSV_COLUMNS = 'title, location, price, address, bedrooms, bathrooms, parking, land_size, interior_size, features, amenities, agent_notes'

/**
 * Turns pasted CSV (first row = headers) into property records. Unknown columns are
 * ignored and reported, so a spreadsheet export works without editing.
 */
export function propertiesFromCsv(text: string): { properties: PropertyData[]; ignored: string[] } {
  const [header, ...rows] = parseCsv(text.trim())
  if (!header) return { properties: [], ignored: [] }
  const keys = header.map((h) => HEADER_MAP[h.trim().toLowerCase()])
  const ignored = header.filter((_, i) => !keys[i]).map((h) => h.trim()).filter(Boolean)
  const properties = rows.map((cells) => {
    const p = emptyProperty()
    cells.forEach((value, i) => {
      const key = keys[i]
      if (key && key !== 'imageFileName' && key !== 'imagePath') p[key] = value.trim()
    })
    return p
  })
  return { properties, ignored }
}
