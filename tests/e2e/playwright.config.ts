import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  snapshotDir: 'snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{testName}-{arg}{ext}',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.05 } },
})
