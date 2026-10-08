// Detect the real image type from the file's first bytes. The browser-supplied MIME type and
// file name can be anything, so they are never trusted (architecture §7: only image types).
const signatures = [
  {
    type: 'image/jpeg',
    ext: 'jpg',
    matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/png',
    ext: 'png',
    matches: (b: Uint8Array) =>
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte),
  },
  {
    type: 'image/webp',
    ext: 'webp',
    matches: (b: Uint8Array) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  },
] as const

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end))
}

export type ImageType = { type: 'image/jpeg' | 'image/png' | 'image/webp'; ext: string }

/** JPEG, PNG, or WebP; null for anything else (including SVG, which can contain scripts). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const match = signatures.find((s) => s.matches(bytes))
  return match ? { type: match.type, ext: match.ext } : null
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
