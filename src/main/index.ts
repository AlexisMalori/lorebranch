import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import {
  initDatabase, closeDatabase,
  upsertWorkspace, deleteWorkspace,
  upsertNode, upsertManyNodes, deleteNode, deleteManyNodes, updateNodeChildren,
  upsertCharacter, deleteCharacter,
  upsertStory, deleteStory, detachCharFromStory,
  upsertRelationship, deleteRelationship,
  loadAllWorkspaces,
} from './database'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => { mainWindow.show() })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const instLock = app.requestSingleInstanceLock()
if (!instLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus() }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  initDatabase()

  // ── Validation helpers ─────────────────────────────────────────────────────
  function assertString(v: any, label = 'value') {
    if (typeof v !== 'string' || v.length === 0)
      throw new Error(`Invalid ${label}: expected non-empty string`)
  }
  function assertObject(v: any, label = 'value') {
    if (typeof v !== 'object' || v === null)
      throw new Error(`Invalid ${label}: expected object`)
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  ipcMain.handle('db:load-all', () => loadAllWorkspaces())

  // ── Workspaces ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:upsert-workspace', (_, ws) => {
    assertObject(ws, 'workspace'); assertString(ws.id, 'workspace.id'); assertString(ws.name, 'workspace.name')
    return upsertWorkspace(ws)
  })

  ipcMain.handle('db:delete-workspace', (_, id: string) => {
    assertString(id, 'workspace id')
    return deleteWorkspace(id)
  })

  // ── Nodes ──────────────────────────────────────────────────────────────────
  ipcMain.handle('db:upsert-node', (_, { wsId, node }) => {
    assertString(wsId, 'wsId'); assertObject(node, 'node')
    return upsertNode(wsId, node)
  })

  ipcMain.handle('db:upsert-many-nodes', (_, { wsId, nodes }) => {
    assertString(wsId, 'wsId')
    if (!Array.isArray(nodes)) throw new Error('nodes must be an array')
    return upsertManyNodes(wsId, nodes)
  })

  ipcMain.handle('db:delete-node', (_, id: string) => {
    assertString(id, 'node id')
    return deleteNode(id)
  })

  ipcMain.handle('db:delete-many-nodes', (_, ids: string[]) => {
    if (!Array.isArray(ids)) throw new Error('ids must be an array')
    return deleteManyNodes(ids)
  })

  // Edge connect/disconnect: only the parent's children array changes
  ipcMain.handle('db:update-node-children', (_, { nodeId, children }) => {
    assertString(nodeId, 'nodeId')
    if (!Array.isArray(children)) throw new Error('children must be an array')
    return updateNodeChildren(nodeId, children)
  })

  // ── Characters ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:upsert-character', (_, { wsId, character }) => {
    assertString(wsId, 'wsId'); assertObject(character, 'character')
    return upsertCharacter(wsId, character)
  })

  ipcMain.handle('db:delete-character', (_, id: string) => {
    assertString(id, 'character id')
    return deleteCharacter(id)
  })

  // ── Stories ────────────────────────────────────────────────────────────────
  ipcMain.handle('db:upsert-story', (_, { wsId, story }) => {
    assertString(wsId, 'wsId'); assertObject(story, 'story')
    return upsertStory(wsId, story)
  })

  ipcMain.handle('db:delete-story', (_, id: string) => {
    assertString(id, 'story id')
    return deleteStory(id)
  })

  ipcMain.handle('db:detach-char-from-story', (_, { charId, storyId }) => {
    assertString(charId, 'charId'); assertString(storyId, 'storyId')
    return detachCharFromStory(charId, storyId)
  })

  // ── Relationships ──────────────────────────────────────────────────────────
  ipcMain.handle('db:upsert-relationship', (_, { wsId, relationship }) => {
    assertString(wsId, 'wsId'); assertObject(relationship, 'relationship')
    return upsertRelationship(wsId, relationship)
  })

  ipcMain.handle('db:delete-relationship', (_, id: string) => {
    assertString(id, 'relationship id')
    return deleteRelationship(id)
  })

  // ── Misc ───────────────────────────────────────────────────────────────────
  app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { closeDatabase() })