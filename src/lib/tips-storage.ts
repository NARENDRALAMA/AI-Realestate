/** Per-browser preferences for tips and the guided tour. Storage can be unavailable. */
const TIPS_KEY = 'rem.tips.hidden'
const TOUR_KEY = 'rem.tour.done.v1'

export function readHiddenTips(): string[] {
  try {
    return JSON.parse(localStorage.getItem(TIPS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function writeHiddenTips(steps: string[]) {
  try {
    localStorage.setItem(TIPS_KEY, JSON.stringify([...new Set(steps)]))
  } catch {
    /* storage unavailable — tips just reappear next time */
  }
}

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return true // don't auto-open a tour we can't remember closing
  }
}

export function markTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Ask the app shell to (re)start the guided tour. */
export const TOUR_EVENT = 'rem:start-tour'
export const startTour = () => window.dispatchEvent(new Event(TOUR_EVENT))
