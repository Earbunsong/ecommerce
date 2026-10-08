import { env } from '../../config/env.js'
import { LocalStorage } from './local.js'

/**
 * Where uploaded files live. Product images are never stored in the database (proposal §8);
 * the database keeps only the public URL. Local disk in development; S3 or Cloudinary drivers
 * can be added later without touching the product code.
 */
export interface FileStorage {
  /** Saves the file and returns its public URL. */
  save(key: string, data: Uint8Array, contentType: string): Promise<string>
  /** Deletes the file behind a URL returned by save(). Missing files are ignored. */
  delete(url: string): Promise<void>
}

let storage: FileStorage | undefined

export function getStorage(): FileStorage {
  if (!storage) {
    if (env.STORAGE_DRIVER !== 'local') {
      throw new Error(`STORAGE_DRIVER=${env.STORAGE_DRIVER} is not implemented yet.`)
    }
    storage = new LocalStorage(env.UPLOAD_DIR)
  }
  return storage
}
