// Writes the placeholder product images in seed-assets/products (committed to the repo).
// Re-run only when seed-data.ts products change: `pnpm --filter api db:seed-images`
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { placeholderSvg, seedImages, seedProducts } from './seed-data.js'

const dir = fileURLToPath(new URL('../../seed-assets/products', import.meta.url))
await rm(dir, { recursive: true, force: true })
await mkdir(dir, { recursive: true })

let total = 0
for (const [index, p] of seedProducts.entries()) {
  for (const image of seedImages(p, index)) {
    await writeFile(`${dir}/${image.file}`, placeholderSvg(p.name, image.color, image.view))
    total++
  }
}
console.log(`Wrote ${total} images for ${seedProducts.length} products to ${dir}`)
