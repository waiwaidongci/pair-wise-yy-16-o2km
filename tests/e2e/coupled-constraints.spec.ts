import { test, expect } from '@playwright/test'
import { loadPhotoData, photosForSeries } from '../helpers/photoData'
import { expectLightboxOpen, lightboxCounter, lightboxTitle, clickNext } from '../helpers/lightbox'

// rubric.json#coupled_constraints (55pt) — task.md 约束 #1-7。
// 约束 #2/#3/#5/#6 是 metadata.json.deliberate_traps 标记的陷阱项。
test.describe('耦合约束', () => {
  test('filter-state-persistence（约束1）: 筛选后进入系列页再返回，筛选状态保留', async ({ page }) => {
    await page.goto('/work', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '牧野' }).click()
    await expect(page.locator('.photo-button')).toHaveCount(4)

    await page.getByRole('link', { name: /高原牧歌/ }).click()
    await page.waitForURL(/highland-pastoral/)
    await page.goBack()
    await page.waitForURL(/\/work$/)

    await expect(page.getByRole('button', { name: '牧野' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.photo-button')).toHaveCount(4)
  })

  test('lightbox-scoped-navigation（约束2，陷阱）: 灯箱导航只在筛选出的子集内循环', async ({ page }) => {
    await page.goto('/work', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '牧野' }).click()
    await expect(page.locator('.photo-button')).toHaveCount(4)

    await page.locator('.photo-button').first().click()
    await expectLightboxOpen(page)
    expect(await lightboxCounter(page)).toEqual({ index: 1, total: 4 })

    const seenTitles = [await lightboxTitle(page)]
    for (let i = 0; i < 4; i++) {
      await clickNext(page)
      seenTitles.push(await lightboxTitle(page))
    }
    // 4 张循环：第 5 次（连续点击 4 次「下一张」后）应回到第 1 张
    expect(seenTitles[4]).toEqual(seenTitles[0])
    expect(new Set(seenTitles.slice(0, 4)).size).toBe(4)
    expect((await lightboxCounter(page)).total).toBe(4)
  })

  test('cls-safe-image-loading（约束3，陷阱）: 图片加载前容器已按数据宽高预留比例，加载完成后位置不变', async ({ page }) => {
    const data = loadPhotoData()
    await page.route('**/*.jpg', async route => {
      await new Promise(resolve => setTimeout(resolve, 900))
      await route.continue()
    })
    await page.goto('/work', { waitUntil: 'domcontentloaded' })

    const firstPhoto = data.photos[0]
    const firstBox = await page.locator('.photo-button .ratio-box').first().boundingBox()
    expect(firstBox).not.toBeNull()
    const expectedRatio = firstPhoto.width / firstPhoto.height
    const actualRatio = firstBox!.width / firstBox!.height
    expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.01)

    const before = await page.locator('.photo-button').nth(1).boundingBox()
    await page.waitForLoadState('networkidle')
    const after = await page.locator('.photo-button').nth(1).boundingBox()
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(before!.y - after!.y)).toBeLessThan(1)
  })

  test('series-page-shared-data-model（约束4）: 系列详情页渲染顺序与按 order 派生结果一致', async ({ page }) => {
    const data = loadPhotoData()
    const expected = photosForSeries(data, 'highland-pastoral')

    await page.goto('/work/highland-pastoral', { waitUntil: 'networkidle' })
    const renderedTitles = await page.locator('.story article h2').allTextContents()
    expect(renderedTitles).toEqual(expected.map(p => p.title))
  })

  test('mobile-responsive-switch（约束5，陷阱）: 移动端单列网格 + 灯箱说明底部条', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/work', { waitUntil: 'networkidle' })

    const first = await page.locator('.photo-button').first().boundingBox()
    const second = await page.locator('.photo-button').nth(1).boundingBox()
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(second!.y).toBeGreaterThan(first!.y + first!.height - 2)
    await expect(page.locator('.menu')).toBeVisible()

    await page.locator('.photo-button').first().click()
    await expectLightboxOpen(page)
    const imgBox = await page.locator('.lightbox-image').boundingBox()
    const infoBox = await page.locator('.lightbox-info').boundingBox()
    expect(imgBox).not.toBeNull()
    expect(infoBox).not.toBeNull()
    expect(infoBox!.y).toBeGreaterThanOrEqual(imgBox!.y + imgBox!.height - 2)
  })

  test('offline-fonts-no-cdn-requests（约束6，陷阱）: 无 Google Fonts 请求，字体来自本地 woff2', async ({ page }) => {
    const requestedUrls: string[] = []
    page.on('request', req => requestedUrls.push(req.url()))
    for (const route of ['/', '/work', '/about', '/contact']) {
      await page.goto(route, { waitUntil: 'networkidle' })
    }
    const external = requestedUrls.filter(u => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u))
    expect(external, `发现外部字体请求：${external.join(', ')}`).toHaveLength(0)

    const localFonts = new Set(requestedUrls.filter(u => u.includes('/fonts/') && u.endsWith('.woff2')))
    expect(localFonts.size).toBeGreaterThanOrEqual(2)
  })

  test('contact-form-states（约束7）: 校验失败禁用提交，成功提交后展示成功态', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'networkidle' })
    const submit = page.getByRole('button', { name: '发送消息' })
    await expect(submit).toBeDisabled()

    await page.getByLabel('邮箱').fill('bad')
    await page.getByLabel('邮箱').blur()
    await expect(page.getByText('请输入有效的邮箱地址')).toBeVisible()

    await page.getByLabel('姓名').fill('访客')
    await page.getByLabel('邮箱').fill('hello@example.com')
    await page.getByLabel('留言').fill('想了解一项完整的摄影合作计划，谢谢。')
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(page.getByText('谢谢你的来信')).toBeVisible()
  })
})
