// main/preload.ts
// preload script: securely exposes APIs to the renderer process using IPC calls.

import { ipcRenderer } from 'electron'

// Custom APIs for renderer to securely access main process features.
export const api = {
  // ── Images ─────────────────────────────────────────────────────────────────
  saveImage:        (dataUrl: string)    => ipcRenderer.invoke('img:save', dataUrl),
  loadImage:        (appUrl: string)     => ipcRenderer.invoke('img:load', appUrl),
  deleteImage:      (appUrl: string)     => ipcRenderer.invoke('img:delete', appUrl),
  deleteManyImages: (appUrls: string[])  => ipcRenderer.invoke('img:delete-many', appUrls),

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  loadAll: () => ipcRenderer.invoke('db:load-all'),

  // ── Workspaces ─────────────────────────────────────────────────────────────
  upsertWorkspace: (ws: { id: string; name: string; settings?: any }) =>
    ipcRenderer.invoke('db:upsert-workspace', ws),
  deleteWorkspace: (id: string) =>
    ipcRenderer.invoke('db:delete-workspace', id),

  // ── Nodes ──────────────────────────────────────────────────────────────────
  upsertNode:         (args: { wsId: string; node: any })    => ipcRenderer.invoke('db:upsert-node', args),
  upsertManyNodes:    (args: { wsId: string; nodes: any[] }) => ipcRenderer.invoke('db:upsert-many-nodes', args),
  deleteNode:         (id: string)                           => ipcRenderer.invoke('db:delete-node', id),
  deleteManyNodes:    (ids: string[])                        => ipcRenderer.invoke('db:delete-many-nodes', ids),
  updateNodeChildren: (args: { nodeId: string; children: string[] }) =>
    ipcRenderer.invoke('db:update-node-children', args),

  // ── Characters ─────────────────────────────────────────────────────────────
  upsertCharacter: (args: { wsId: string; character: any }) => ipcRenderer.invoke('db:upsert-character', args),
  deleteCharacter: (id: string)                             => ipcRenderer.invoke('db:delete-character', id),

  // ── Stories ────────────────────────────────────────────────────────────────
  upsertStory:         (args: { wsId: string; story: any })       => ipcRenderer.invoke('db:upsert-story', args),
  deleteStory:         (id: string)                               => ipcRenderer.invoke('db:delete-story', id),
  detachCharFromStory: (args: { charId: string; storyId: string }) => ipcRenderer.invoke('db:detach-char-from-story', args),

  // ── Relationships ──────────────────────────────────────────────────────────
  upsertRelationship: (args: { wsId: string; relationship: any }) => ipcRenderer.invoke('db:upsert-relationship', args),
  deleteRelationship: (id: string)                                => ipcRenderer.invoke('db:delete-relationship', id),
}