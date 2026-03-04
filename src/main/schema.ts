// ── Workspaces ────────────────────────────────────────────────────────────────
export const workspaceSchema = `CREATE TABLE IF NOT EXISTS workspaces (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    settings  TEXT,
    createdAt TEXT,
    updatedAt TEXT
);`

// ── Nodes ─────────────────────────────────────────────────────────────────────
// children and images are JSON arrays stored as text.
// x, y are canvas positions stored as REAL.
export const nodeSchema = `CREATE TABLE IF NOT EXISTS nodes (
    id          TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    type        TEXT,
    color       TEXT,
    icon        TEXT,
    images      TEXT,
    children    TEXT,
    x           REAL,
    y           REAL,
    editedAt    TEXT,
    createdAt   TEXT,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
);`

// ── Characters ────────────────────────────────────────────────────────────────
// stats and extras are JSON objects stored as text.
// portrait and fullbody are data-URLs stored as text.
export const characterSchema = `CREATE TABLE IF NOT EXISTS characters (
    id          TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name        TEXT NOT NULL,
    occupation  TEXT,
    age         TEXT,
    gender      TEXT,
    race        TEXT,
    alignment   TEXT,
    bio         TEXT,
    portrait    TEXT,
    fullbody    TEXT,
    stats       TEXT,
    extras      TEXT,
    createdAt   TEXT,
    updatedAt   TEXT,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
);`

// ── Stories ───────────────────────────────────────────────────────────────────
export const storySchema = `CREATE TABLE IF NOT EXISTS stories (
    id          TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    createdAt   TEXT,
    updatedAt   TEXT,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
);`

// ── Relationships (character <-> character) ───────────────────────────────────
export const relationshipSchema = `CREATE TABLE IF NOT EXISTS relationships (
    id          TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    charAId     TEXT NOT NULL,
    charBId     TEXT NOT NULL,
    labelA      TEXT,
    labelB      TEXT,
    description TEXT,
    createdAt   TEXT,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (charAId)     REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (charBId)     REFERENCES characters(id) ON DELETE CASCADE
);`

// ── Junction: characters <-> stories ─────────────────────────────────────────
export const charStorySchema = `CREATE TABLE IF NOT EXISTS char_stories (
    charId  TEXT NOT NULL,
    storyId TEXT NOT NULL,
    PRIMARY KEY (charId, storyId),
    FOREIGN KEY (charId)  REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (storyId) REFERENCES stories(id)    ON DELETE CASCADE
);`

// ── Junction: nodes <-> stories ───────────────────────────────────────────────
// A story links to at most one node, but a junction table keeps
// the pattern consistent and lets CASCADE handle cleanup automatically.
export const nodeStorySchema = `CREATE TABLE IF NOT EXISTS node_stories (
    nodeId  TEXT NOT NULL,
    storyId TEXT NOT NULL,
    PRIMARY KEY (nodeId, storyId),
    FOREIGN KEY (nodeId)  REFERENCES nodes(id)   ON DELETE CASCADE,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE
);`