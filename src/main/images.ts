// main/images.ts
// Handles loading & saving of images

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { createLogger } from './services/logging'
const log = createLogger('ImageHandler')

function imagesDir(): string {
  const dir = path.join(app.getPath('userData'), 'images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function extFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/)
  if (!match) return '.png'
  const mime = match[1].toLowerCase()
  if (mime === 'jpeg') return '.jpg'
  if (mime === 'svg+xml') return '.svg'
  return `.${mime}`
}

// Write a data-URL to disk, return the stored filename (not a URL).
// The renderer requests the file back via img:load when it needs to display it.
export function saveImage(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('Invalid data URL')
  const filename = `${crypto.randomUUID()}${extFromDataUrl(dataUrl)}`
  const filepath = path.join(imagesDir(), filename)
  fs.writeFileSync(filepath, Buffer.from(base64, 'base64'))
  // Still return app://images/ pr{efix so existing DB values are consistent
  log.info("Saved image to file", {filepath, filename})
  return `app://images/${filename}`
}

// Return a file as a base64 data-URL so the renderer can use it directly in <img src>.
// Called via img:load IPC — this replaces the custom protocol handler entirely.
export function loadImageAsDataUrl(appUrl: string): string | null {
  if (!appUrl?.startsWith('app://images/')) return null
  const filename = appUrl.replace('app://images/', '')
  if (!filename || filename.includes('/') || filename.includes('..')) return null
  const filepath = path.join(imagesDir(), filename)
  if (!fs.existsSync(filepath)) return null
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',  '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml',
  }
  const mime = mimeTypes[ext] ?? 'image/png'
  const data = fs.readFileSync(filepath).toString('base64')
  return `data:${mime};base64,${data}`
}

export function deleteImage(appUrl: string): void {
  if (!appUrl?.startsWith('app://images/')) return
  const filename = appUrl.replace('app://images/', '')
  if (!filename || filename.includes('/') || filename.includes('..')) return
  const filepath = path.join(imagesDir(), filename)
  try { fs.unlinkSync(filepath) } catch { /* already gone */ }
}

export function deleteImages(appUrls: (string | null | undefined)[]): void {
  appUrls.forEach(url => { if (url) deleteImage(url) })
}