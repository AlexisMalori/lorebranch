import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { initDatabase, getAllItems, addItem, closeDatabase, addManyItems, deleteItem } from './database'

function createWindow(): void {

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Prevent issues from having multiple program instances open simultaneously.
const instLock = app.requestSingleInstanceLock()
if (!instLock) {
  app.quit()
} else {
  app.on('second-instance', () => { // If an instance exists, focus it instead of loading a duplicate.
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  initDatabase()

  // Secure IPC handlers

  ipcMain.handle('db:add-item', (_, note: {name: string, content: any}) => {
    if (typeof note !== 'object' || typeof note.name !== 'string')
      throw new Error('Invalid database content')
    if (note.name.length > 200)
      throw new Error('Invalid database content')
    return addItem(note.name, note.content)
  })

  ipcMain.handle('db:delete-item', (_, name: string) => {
    if (typeof name !== 'string')
      throw new Error('Invalid name')
    return deleteItem(name)
  })

  ipcMain.handle('db:get-items', () => {
    return getAllItems()
  })

  ipcMain.handle('db:add-many-items', (_, items) => {
    if (!Array.isArray(items) || items.some(item => typeof item.name !== 'string' || item.name.length > 200))
      throw new Error('Invalid database content')

    addManyItems(items)
    return { success: true }
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Safely deloads database to prevent data loss or corruption.
app.on('before-quit', () => {
  closeDatabase()
})
