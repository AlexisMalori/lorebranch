// main/database.ts
// All database interactions & CRUD operations.
// Paths are resolved via configService — do NOT import `app` here.

import Database from 'better-sqlite3'
import {
  workspaceSchema, nodeSchema, characterSchema, storySchema,
  relationshipSchema, charStorySchema, nodeStorySchema,
} from './schema'
import { createLogger }   from './services/logging'
import { configService }  from './services/configService'

const log = createLogger('Database')

let db: Database.Database | null = null

// ── Init / teardown ───────────────────────────────────────────────────────────

export function initDatabase() {
  const dbPath = configService.paths.database
  db = new Database(dbPath)
  if (!db) throw new Error('Failed to initialize database')

  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')

  const schemas = [
    workspaceSchema, nodeSchema, characterSchema, storySchema,
    relationshipSchema, charStorySchema, nodeStorySchema,
  ]
  schemas.forEach(s => db!.exec(s))

  log.debug('Database initialized', dbPath)
}

export function closeDatabase() {
  if (db) { db.close(); db = null; log.debug('Database closed') }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function safeJson(text: string | null | undefined, fallback: any): any {
  if (!text) return fallback
  try { return JSON.parse(text) } catch { return fallback }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACES
// ─────────────────────────────────────────────────────────────────────────────

export function upsertWorkspace(ws: {
  id: string; name: string; settings?: any; createdAt?: string; updatedAt?: string
}) {
  requireDb().prepare(`
    INSERT INTO workspaces (id, name, settings, createdAt, updatedAt)
    VALUES (@id, @name, @settings, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name,
      settings  = excluded.settings,
      updatedAt = excluded.updatedAt
  `).run({
    id:        ws.id,
    name:      ws.name,
    settings:  ws.settings != null ? JSON.stringify(ws.settings) : null,
    createdAt: ws.createdAt ?? new Date().toISOString(),
    updatedAt: ws.updatedAt ?? new Date().toISOString(),
  })
  log.info('Upserted workspace', { id: ws.id, name: ws.name })
}

export function deleteWorkspace(id: string) {
  requireDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  log.info('Deleted workspace', { id })
}

// ─────────────────────────────────────────────────────────────────────────────
// NODES
// ─────────────────────────────────────────────────────────────────────────────

// Shared row mapper — keeps upsertNode and upsertManyNodes in sync
function mapNodeRow(wsId: string, node: any) {
  return {
    id:          node.id,
    workspaceId: wsId,
    title:       node.title,
    body:        node.body ?? '',
    type:        node.type ?? 'Narrative',
    color:       node.color ?? 'none',
    icon:        node.icon ?? null,
    images:      JSON.stringify(node.images ?? []),
    children:    JSON.stringify(node.children ?? []),
    x:           node.x ?? 0,
    y:           node.y ?? 0,
    editedAt:    node.editedAt ?? new Date().toISOString(),
    createdAt:   node.createdAt ?? new Date().toISOString(),
  }
}

const NODE_UPSERT_SQL = `
  INSERT INTO nodes
    (id, workspaceId, title, body, type, color, icon, images, children, x, y, editedAt, createdAt)
  VALUES
    (@id, @workspaceId, @title, @body, @type, @color, @icon, @images, @children, @x, @y, @editedAt, @createdAt)
  ON CONFLICT(id) DO UPDATE SET
    title    = excluded.title,
    body     = excluded.body,
    type     = excluded.type,
    color    = excluded.color,
    icon     = excluded.icon,
    images   = excluded.images,
    children = excluded.children,
    x        = excluded.x,
    y        = excluded.y,
    editedAt = excluded.editedAt
`

export function upsertNode(wsId: string, node: any) {
  requireDb().prepare(NODE_UPSERT_SQL).run(mapNodeRow(wsId, node))
  log.info('Upserted node', { id: node.id, title: node.title })
}

export function upsertManyNodes(wsId: string, nodes: any[]) {
  const stmt = requireDb().prepare(NODE_UPSERT_SQL)
  requireDb().transaction(() => {
    for (const node of nodes) stmt.run(mapNodeRow(wsId, node))
  })()
  log.info('Upserted many nodes', { count: nodes.length })
}

export function deleteNode(id: string) {
  requireDb().prepare('DELETE FROM nodes WHERE id = ?').run(id)
  log.info('Deleted node', { id })
}

export function deleteManyNodes(ids: string[]) {
  const stmt = requireDb().prepare('DELETE FROM nodes WHERE id = ?')
  requireDb().transaction(() => { ids.forEach(id => stmt.run(id)) })()
  log.info('Deleted many nodes', { count: ids.length })
}

export function updateNodeChildren(nodeId: string, children: string[]) {
  requireDb()
    .prepare('UPDATE nodes SET children = ? WHERE id = ?')
    .run(JSON.stringify(children), nodeId)
  log.info('Updated node children', { nodeId, childCount: children.length })
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTERS
// ─────────────────────────────────────────────────────────────────────────────

export function upsertCharacter(wsId: string, char: any) {
  requireDb().prepare(`
    INSERT INTO characters
      (id, workspaceId, name, occupation, age, gender, race, alignment,
       bio, portrait, fullbody, stats, extras, createdAt, updatedAt)
    VALUES
      (@id, @workspaceId, @name, @occupation, @age, @gender, @race, @alignment,
       @bio, @portrait, @fullbody, @stats, @extras, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name       = excluded.name,
      occupation = excluded.occupation,
      age        = excluded.age,
      gender     = excluded.gender,
      race       = excluded.race,
      alignment  = excluded.alignment,
      bio        = excluded.bio,
      portrait   = excluded.portrait,
      fullbody   = excluded.fullbody,
      stats      = excluded.stats,
      extras     = excluded.extras,
      updatedAt  = excluded.updatedAt
  `).run({
    id:          char.id,
    workspaceId: wsId,
    name:        char.name,
    occupation:  char.occupation ?? null,
    age:         char.age != null ? String(char.age) : null,
    gender:      char.gender ?? null,
    race:        char.race ?? null,
    alignment:   char.alignment ?? null,
    bio:         char.bio ?? null,
    portrait:    char.portrait ?? null,
    fullbody:    char.fullbody ?? null,
    stats:       JSON.stringify(char.stats ?? {}),
    extras:      JSON.stringify(char.extras ?? {}),
    createdAt:   char.createdAt ?? new Date().toISOString(),
    updatedAt:   char.updatedAt ?? new Date().toISOString(),
  })
  log.info('Upserted character', { id: char.id, name: char.name })
}

export function deleteCharacter(id: string) {
  requireDb().prepare('DELETE FROM characters WHERE id = ?').run(id)
  log.info('Deleted character', { id })
}

// ─────────────────────────────────────────────────────────────────────────────
// STORIES  +  junction tables
// ─────────────────────────────────────────────────────────────────────────────

export function upsertStory(wsId: string, story: any) {
  const d = requireDb()

  d.prepare(`
    INSERT INTO stories (id, workspaceId, title, body, createdAt, updatedAt)
    VALUES (@id, @workspaceId, @title, @body, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title     = excluded.title,
      body      = excluded.body,
      updatedAt = excluded.updatedAt
  `).run({
    id:          story.id,
    workspaceId: wsId,
    title:       story.title,
    body:        story.body ?? '',
    createdAt:   story.createdAt ?? new Date().toISOString(),
    updatedAt:   story.updatedAt ?? new Date().toISOString(),
  })
  log.info('Upserted story', { id: story.id, title: story.title })

  d.prepare('DELETE FROM char_stories WHERE storyId = ?').run(story.id)
  if (story.charIds?.length) {
    const ins = d.prepare('INSERT OR IGNORE INTO char_stories (charId, storyId) VALUES (?, ?)')
    d.transaction(() => { story.charIds.forEach((cid: string) => ins.run(cid, story.id)) })()
  }

  d.prepare('DELETE FROM node_stories WHERE storyId = ?').run(story.id)
  if (story.nodeId) {
    d.prepare('INSERT OR IGNORE INTO node_stories (nodeId, storyId) VALUES (?, ?)').run(story.nodeId, story.id)
  }
}

export function deleteStory(id: string) {
  requireDb().prepare('DELETE FROM stories WHERE id = ?').run(id)
  log.info('Deleted story', { id })
}

export function detachCharFromStory(charId: string, storyId: string) {
  requireDb()
    .prepare('DELETE FROM char_stories WHERE charId = ? AND storyId = ?')
    .run(charId, storyId)
  log.info('Detached character from story', { charId, storyId })
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────────

export function upsertRelationship(wsId: string, rel: any) {
  requireDb().prepare(`
    INSERT INTO relationships
      (id, workspaceId, charAId, charBId, labelA, labelB, description, createdAt)
    VALUES
      (@id, @workspaceId, @charAId, @charBId, @labelA, @labelB, @description, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      labelA      = excluded.labelA,
      labelB      = excluded.labelB,
      description = excluded.description
  `).run({
    id:          rel.id,
    workspaceId: wsId,
    charAId:     rel.charAId,
    charBId:     rel.charBId,
    labelA:      rel.labelA ?? null,
    labelB:      rel.labelB ?? null,
    description: rel.description ?? null,
    createdAt:   rel.createdAt ?? new Date().toISOString(),
  })
  log.info('Upserted relationship', { id: rel.id, charAId: rel.charAId, charBId: rel.charBId })
}

export function deleteRelationship(id: string) {
  requireDb().prepare('DELETE FROM relationships WHERE id = ?').run(id)
  log.info('Deleted relationship', { id })
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — reassemble full workspace map for Redux hydration
// ─────────────────────────────────────────────────────────────────────────────

export function loadAllWorkspaces(): Record<string, any> {
  const d = requireDb()
  const wsRows = d.prepare('SELECT * FROM workspaces').all() as any[]
  if (wsRows.length === 0) return {}

  const result: Record<string, any> = {}

  for (const row of wsRows) {
    const wsId = row.id

    // Nodes
    const nodeRows = d.prepare('SELECT * FROM nodes WHERE workspaceId = ?').all(wsId) as any[]
    const nodes: Record<string, any> = {}
    for (const n of nodeRows) {
      nodes[n.id] = {
        id:       n.id,
        title:    n.title,
        body:     n.body ?? '',
        type:     n.type ?? 'Narrative',
        color:    n.color ?? 'none',
        icon:     n.icon ?? null,
        images:   safeJson(n.images, []),
        children: safeJson(n.children, []),
        x:        n.x ?? 0,
        y:        n.y ?? 0,
        editedAt: n.editedAt,
      }
    }

    // Characters
    const charRows = d.prepare('SELECT * FROM characters WHERE workspaceId = ?').all(wsId) as any[]
    const characters: Record<string, any> = {}
    for (const c of charRows) {
      characters[c.id] = {
        id:         c.id,
        name:       c.name,
        occupation: c.occupation ?? '',
        age:        c.age ?? '',
        gender:     c.gender ?? '',
        race:       c.race ?? '',
        alignment:  c.alignment ?? '',
        bio:        c.bio ?? '',
        portrait:   c.portrait ?? null,
        fullbody:   c.fullbody ?? null,
        stats:      safeJson(c.stats, { strength:10, dexterity:10, constitution:10, intelligence:10, wisdom:10, charisma:10 }),
        extras:     safeJson(c.extras, { hp:'', ac:'', speed:'', level:'', proficiency:'' }),
        createdAt:  c.createdAt,
        updatedAt:  c.updatedAt,
      }
    }

    const storyRows = d.prepare('SELECT * FROM stories WHERE workspaceId = ?').all(wsId) as any[]
    const charLinks = d.prepare('SELECT charId, storyId FROM char_stories WHERE storyId IN (SELECT id FROM stories WHERE workspaceId = ?)').all(wsId) as any[]
    const nodeLinks = d.prepare('SELECT nodeId, storyId FROM node_stories WHERE storyId IN (SELECT id FROM stories WHERE workspaceId = ?)').all(wsId) as any[]

    const charMap: Record<string, string[]> = {}
    charLinks.forEach(({ charId, storyId }) => {
      if (!charMap[storyId]) charMap[storyId] = []
      charMap[storyId].push(charId)
    })
    const nodeMap: Record<string, string> = {}
    nodeLinks.forEach(({ nodeId, storyId }) => { nodeMap[storyId] = nodeId })

    const stories: Record<string, any> = {}
    for (const s of storyRows) {
      stories[s.id] = {
        id:        s.id,
        title:     s.title,
        body:      s.body ?? '',
        charIds:   charMap[s.id] ?? [],
        nodeId:    nodeMap[s.id] ?? null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }
    }

    // Relationships
    const relRows = d.prepare('SELECT * FROM relationships WHERE workspaceId = ?').all(wsId) as any[]
    const relationships: Record<string, any> = {}
    for (const r of relRows) {
      relationships[r.id] = {
        id:          r.id,
        charAId:     r.charAId,
        charBId:     r.charBId,
        labelA:      r.labelA ?? '',
        labelB:      r.labelB ?? '',
        description: r.description ?? '',
        createdAt:   r.createdAt,
      }
    }

    result[wsId] = {
      id:            row.id,
      title:         row.name,
      settings:      safeJson(row.settings, { autosave: false }),
      nodes,
      characters,
      stories,
      relationships,
    }
  }

  log.info('Loaded all workspaces', { count: Object.keys(result).length })
  return result
}