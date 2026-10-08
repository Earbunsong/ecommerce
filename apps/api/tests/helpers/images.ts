// Minimal files for upload tests: only the first bytes matter for type detection.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0]

export function pngFile(name = 'photo.png', size = 64): File {
  const bytes = new Uint8Array(size)
  bytes.set(PNG_SIGNATURE)
  return new File([bytes], name, { type: 'image/png' })
}

export function jpegFile(name = 'photo.jpg', size = 64): File {
  const bytes = new Uint8Array(size)
  bytes.set(JPEG_SIGNATURE)
  return new File([bytes], name, { type: 'image/jpeg' })
}

export function imageForm(file: File, altText?: string): FormData {
  const form = new FormData()
  form.append('file', file)
  if (altText) form.append('altText', altText)
  return form
}
