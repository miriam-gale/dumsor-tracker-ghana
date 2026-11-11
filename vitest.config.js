import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    pool: 'vmThreads',
    testTimeout: 15000,
  },
})
