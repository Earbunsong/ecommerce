import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FileStorage } from './storage.js'

/** Files under `rootDir`, served by the API at /uploads/* (see server.ts). */
export class LocalStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async save(key: string, data: Uint8Array): Promise<string> {
    const file = this.resolve(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, data)
    return `/uploads/${key}`
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return
    await rm(this.resolve(url.slice('/uploads/'.length)), { force: true })
  }

  // Never write or delete outside the upload folder, whatever the key contains
  private resolve(key: string): string {
    const root = path.resolve(this.rootDir)
    const file = path.resolve(root, key)
    if (!file.startsWith(root + path.sep)) throw new Error(`Invalid storage key: ${key}`)
    return file
  }
}
