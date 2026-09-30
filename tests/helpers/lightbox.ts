import { expect, type Page, type Locator } from '@playwright/test'

// Selectors here mirror the shared <Lightbox/> component's actual DOM (role="dialog",
// .lightbox-info .eyebrow holding "category · index / total"). Kept in one place so a
// legitimate future markup change only needs updating here, not in every spec file.
export const lightboxRoot = (page: Page): Locator => page.locator('.lightbox[role="dialog"]')

export async function expectLightboxOpen(page: Page) {
  await expect(lightboxRoot(page)).toBeVisible()
}

export async function expectLightboxClosed(page: Page) {
  await expect(lightboxRoot(page)).toHaveCount(0)
}

export async function lightboxCounter(page: Page): Promise<{ index: number; total: number }> {
  const text = (await page.locator('.lightbox-info .eyebrow').textContent()) ?? ''
  const match = text.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) throw new Error(`无法从灯箱计数器文本中解析出 "x / y"：「${text}」`)
  return { index: Number(match[1]), total: Number(match[2]) }
}

export async function lightboxTitle(page: Page): Promise<string> {
  return ((await page.locator('.lightbox-info h2').textContent()) ?? '').trim()
}

export async function clickNext(page: Page) {
  await page.getByRole('button', { name: '下一张' }).click()
}

export async function clickPrev(page: Page) {
  await page.getByRole('button', { name: '上一张' }).click()
}

export async function closeLightbox(page: Page) {
  await page.getByRole('button', { name: '关闭' }).click()
}
