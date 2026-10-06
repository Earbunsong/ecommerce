// Writes the placeholder product images in seed-assets/products (committed to the repo).
// Re-run only when seed-data.ts products change: `pnpm --filter api db:seed-images`
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { placeholderSvg, seedProducts } from './seed-data.js'

const dir = fileURLToPath(new URL('../../seed-assets/products', import.meta.url))
await mkdir(dir, { recursive: true })

for (const p of seedProducts) {
  await writeFile(`${dir}/${p.slug}.svg`, placeholderSvg(p.name, p.color))
}
console.log(`Wrote ${seedProducts.length} images to ${dir}`)
