import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Uploaded test images go to a temp folder, never into apps/api/uploads
    env: { NODE_ENV: 'test', UPLOAD_DIR: path.join(tmpdir(), 'shopkh-test-uploads') },
    // Migrates shopkh_test once before all test files
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/close-db.ts'],
    // All files share the one test database and empty it before running, so they must not run in parallel
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
