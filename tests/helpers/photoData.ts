import fs from 'node:fs'
import path from 'node:path'

// mock-data/photos.json is the authoritative content source (see task.md#data_sources
// / rubric.json#photo-data-fidelity). Tests must derive expectations from here, never
// hardcode photo titles/captions, so the suite keeps working if mock-data content changes.
export type Photo = {
  id: string
  category: 'portrait' | 'landscape' | 'pastoral'
  seriesId: string
  file: string
  title: string
  altText: string
  caption: string
  width: number
  height: number
  order: number
}

export type Series = {
  id: string
  title: string
  category: string
  summary: string
  photoIds: string[]
}

export type PhotoData = {
  categories: { id: string; label: string }[]
  series: Series[]
  photos: Photo[]
}

const DATA_PATH = path.resolve(process.cwd(), '..', 'mock-data', 'photos.json')

export function loadPhotoData(): PhotoData {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
}

export function photosForCategory(data: PhotoData, category: string): Photo[] {
  return category === 'all' ? data.photos : data.photos.filter(p => p.category === category)
}

export function photosForSeries(data: PhotoData, seriesId: string): Photo[] {
  return data.photos.filter(p => p.seriesId === seriesId).sort((a, b) => a.order - b.order)
}

export function seriesById(data: PhotoData, seriesId: string): Series | undefined {
  return data.series.find(s => s.id === seriesId)
}

export function categoryLabel(data: PhotoData, categoryId: string): string {
  return data.categories.find(c => c.id === categoryId)?.label ?? categoryId
}
