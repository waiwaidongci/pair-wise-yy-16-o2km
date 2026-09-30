import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { loadPhotoData } from '../helpers/photoData'

// rubric.json#content_integrity (10pt)
test.describe('内容与数据完整性', () => {
  test('photo-data-fidelity: /work 渲染的照片标题/替代文字与 mock-data/photos.json 完全一致', async ({ page }) => {
    const data = loadPhotoData()
    await page.goto('/work', { waitUntil: 'networkidle' })

    const renderedTitles = await page.locator('.photo-button .photo-meta strong').allTextContents()
    expect(new Set(renderedTitles)).toEqual(new Set(data.photos.map(p => p.title)))

    const renderedAlts = await page.locator('.photo-button img').evaluateAll(
      imgs => imgs.map(img => img.getAttribute('alt')),
    )
    expect(new Set(renderedAlts)).toEqual(new Set(data.photos.map(p => p.altText)))
  })

  test('no-cross-contamination: 页面不加载 assets/ 参考图，mock-data/photos/ 未混入参考图', async ({ page }) => {
    const requestedUrls: string[] = []
    page.on('request', req => requestedUrls.push(req.url()))
    for (const route of ['/', '/work', '/work/highland-pastoral', '/about']) {
      await page.goto(route, { waitUntil: 'networkidle' })
    }
    const referenceHits = requestedUrls.filter(u => /reference_/.test(u))
    expect(referenceHits, `发现引用了参考图：${referenceHits.join(', ')}`).toHaveLength(0)

    const mockPhotosDir = path.resolve(process.cwd(), '..', 'mock-data', 'photos')
    const stray = walk(mockPhotosDir).filter(f => /reference_/.test(f))
    expect(stray, `mock-data/photos/ 下混入了参考图：${stray.join(', ')}`).toHaveLength(0)
  })
})

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}
