// main/images.ts
// Handles loading & saving of images.
// Paths are resolved via configService — do NOT import `app` here.

import fs   from 'fs'
import path from 'path'
import { createLogger }  from './services/logging'
import { configService } from './services/configService'

const log = createLogger('ImageHandler')

// ── Helpers ───────────────────────────────────────────────────────────────────

function imagesDir(): string {
  const dir = configService.paths.images
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function extFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/)
  if (!match) return '.png'
  const mime = match[1].toLowerCase()
  if (mime === 'jpeg')    return '.jpg'
  if (mime === 'svg+xml') return '.svg'
  return `.${mime}`
}

const MIME_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
}

function isSafeFilename(filename: string): boolean {
  return Boolean(filename) && !filename.includes('/') && !filename.includes('..')
}

function appUrlToFilename(appUrl: string): string | null {
  if (!appUrl?.startsWith('app://images/')) return null
  const filename = appUrl.replace('app://images/', '')
  return isSafeFilename(filename) ? filename : null
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Write a data-URL to disk; returns the stored `app://images/<name>` reference. */
export function saveImage(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('Invalid data URL')
  const filename = `${crypto.randomUUID()}${extFromDataUrl(dataUrl)}`
  const filepath  = path.join(imagesDir(), filename)
  fs.writeFileSync(filepath, Buffer.from(base64, 'base64'))
  log.info('Saved image to file', { filepath, filename })
  return `app://images/${filename}`
}

/** Return a stored image as a base64 data-URL for use in the renderer. */
export function loadImageAsDataUrl(appUrl: string): string | null {
  const filename = appUrlToFilename(appUrl)
  if (!filename) return null
  const filepath = path.join(imagesDir(), filename)
  if (!fs.existsSync(filepath)) return null
  const ext  = path.extname(filename).toLowerCase()
  const mime = MIME_TYPES[ext] ?? 'image/png'
  const data = fs.readFileSync(filepath).toString('base64')
  return `data:${mime};base64,${data}`
}

export function deleteImage(appUrl: string): void {
  const filename = appUrlToFilename(appUrl)
  if (!filename) return
  const filepath = path.join(imagesDir(), filename)
  try { fs.unlinkSync(filepath) } catch { /* already gone */ }
}

export function deleteImages(appUrls: (string | null | undefined)[]): void {
  appUrls.forEach(url => { if (url) deleteImage(url) })
}