export const countWords = (text: string) => {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export const countChars = (text: string) => [...text].length

const numberFmt = new Intl.NumberFormat()
export const formatNumber = (n: number) => numberFmt.format(n)

export const pluralize = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

/** Backend timestamps are SQLite UTC strings: "YYYY-MM-DD HH:MM:SS". */
export function parseServerDate(value: string): Date | null {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function formatServerDate(value: string) {
  const d = parseServerDate(value)
  if (!d) return value
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`
}

export function formatDuration(ms: number) {
  if (ms < 100) return 'under 0.1 s'
  if (ms < 1000) return `${(ms / 1000).toFixed(1)} s`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`
  const m = Math.floor(s / 60)
  return `${m} min ${Math.round(s % 60)} s`
}
