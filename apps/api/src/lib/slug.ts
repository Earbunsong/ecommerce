/** "Angkor Graphic Tee!" -> "angkor-graphic-tee". Non-Latin text falls back to "item". */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
  return slug || 'item'
}

export const slugSchemaPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * First free slug: base, base-2, base-3, ... `isTaken` checks the database.
 * The unique index still decides if two requests pick the same slug at the same moment.
 */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>) {
  let slug = base
  for (let n = 2; await isTaken(slug); n++) slug = `${base}-${n}`
  return slug
}
