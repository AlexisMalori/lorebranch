import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer to securely access main process features.
const api = {
  addItem: (note: {name:string; content:any}) => ipcRenderer.invoke('db:add-item', note),
  getItems: () => ipcRenderer.invoke('db:get-items'),
  addManyItems: (items: {name:string; content:any}[]) => ipcRenderer.invoke('db:add-many-items', items),
  deleteItem: (name: string) => ipcRenderer.invoke('db:delete-item', name),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
