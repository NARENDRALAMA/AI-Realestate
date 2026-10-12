/**
 * Local, pre-sized WebP photography (see public/images/CREDITS.md).
 * `w`/`h` are the intrinsic size of the largest file, used to reserve space (no layout shift).
 */
export const photos = {
  hero: {
    widths: [640, 960, 1280, 1920],
    w: 1920,
    h: 1084,
    alt: 'A modern two-storey home at dusk, its tall windows glowing warmly above a lawn of ornamental grasses',
  },
  living: {
    widths: [640, 1280],
    w: 1280,
    h: 854,
    alt: 'Looking down into a bright open-plan living room with timber floors, a wood stove and mid-century furniture',
  },
  kitchen: {
    widths: [640, 1280],
    w: 1280,
    h: 854,
    alt: 'A light-filled kitchen with walnut cabinetry, a marble island and pendant lights',
  },
  kitchen2: {
    widths: [640, 1080],
    w: 1080,
    h: 1620,
    alt: 'Evening sun falling across a white kitchen island with two bar stools',
  },
  apartments: {
    widths: [640, 1280],
    w: 1280,
    h: 1280,
    alt: 'Colourful apartment facades in Lisbon with plant-filled balconies',
  },
  keys: {
    widths: [640, 1280],
    w: 1280,
    h: 854,
    alt: 'A hand holding a set of house keys in a softly lit hallway',
  },
  aerial: {
    widths: [640, 1280],
    w: 1280,
    h: 853,
    alt: 'Aerial view of a leafy suburb with homes tucked among the trees',
  },
  porch: {
    widths: [640, 1280],
    w: 1280,
    h: 854,
    alt: 'A weatherboard home with a front porch and stone steps, framed by flowering shrubs',
  },
} as const

export type PhotoName = keyof typeof photos

export const screens = {
  listing: { alt: 'REM Content Studio results screen showing a generated listing description' },
  social: { alt: 'REM Content Studio results screen showing a generated social media post' },
  email: { alt: 'REM Content Studio results screen showing a generated email campaign' },
  video: { alt: 'REM Content Studio results screen showing a generated video script' },
  export: { alt: 'REM Content Studio export screen with PDF, Word and plain-text download options' },
} as const

export type ScreenName = keyof typeof screens

/** App screenshots are captured at 1280×800 and saved at 1280 and 640 wide. */
export const SCREEN_SIZE = { w: 1280, h: 800, widths: [640, 1280] }
