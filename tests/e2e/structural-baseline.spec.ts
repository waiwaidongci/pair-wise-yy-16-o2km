import { test, expect } from '@playwright/test'
import { expectLightboxOpen, expectLightboxClosed, closeLightbox } from '../helpers/lightbox'

// rubric.json#structural_baseline (15pt)
const ROUTES = ['/', '/work', '/work/highland-pastoral', '/about', '/contact']

test.describe('结构基线', () => {
  test('routes-render: 5 个路由均正常渲染出核心内容，控制台无 error', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', err => errors.push(String(err)))

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' })
      await expect(page.locator('main')).toBeVisible()
    }
    expect(errors, `控制台记录了 error：${errors.join(' | ')}`).toHaveLength(0)
  })

  test('lightbox-shared-component: /work 网格、系列详情页、首页精选预览图打开的是同一个 Lightbox', async ({ page }) => {
    // 入口 1：/work 网格
    await page.goto('/work', { waitUntil: 'networkidle' })
    await page.locator('.photo-button').first().click()
    await expectLightboxOpen(page)
    await closeLightbox(page)
    await expectLightboxClosed(page)

    // 入口 2：系列详情页
    await page.goto('/work/highland-pastoral', { waitUntil: 'networkidle' })
    await page.locator('.story .photo-button').first().click()
    await expectLightboxOpen(page)
    await closeLightbox(page)
    await expectLightboxClosed(page)

    // 入口 3：首页精选预览图（见 sota-run.md §4.1 — 该入口在本次运行中未接入共享 Lightbox）
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('.series-card').first().click()
    await expectLightboxOpen(page)
  })

  test('filter-ui-exists: /work 提供 全部/肖像/风光/牧野 四个筛选项', async ({ page }) => {
    await page.goto('/work', { waitUntil: 'networkidle' })
    const labels = await page.locator('.filters button').allTextContents()
    expect(labels).toEqual(['全部', '肖像', '风光', '牧野'])
  })
})
