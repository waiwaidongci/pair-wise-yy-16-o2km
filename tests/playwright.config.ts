import { defineConfig } from '@playwright/test'
import path from 'node:path'

// This suite runs against a locally pulled-back SOTA submission (../sota-submission),
// NOT against the annotator-only reference-solution. Run from within tests/:
//   npm install && npm test
const SUBMISSION_DIR = path.resolve(process.cwd(), '..', 'sota-submission')
const PORT = 5173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
    cwd: SUBMISSION_DIR,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
