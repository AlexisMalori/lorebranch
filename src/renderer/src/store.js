import { configureStore, createSlice } from "@reduxjs/toolkit";

// ── ID factory ────────────────────────────────────────────────────────────────
let _nc = 200;
export function freshId() { return String(_nc++); }

// ── Makers ────────────────────────────────────────────────────────────────────
export function mkCharacter(name = "New Character") {
  return {
    id: freshId(), name, occupation: "", age: "", gender: "", race: "", alignment: "",
    bio: "", portrait: null, fullbody: null,
    stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    extras: { hp: "", ac: "", speed: "", level: "", proficiency: "" },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export const STORY_TEMPLATE_BODY = `## What Happened\n\n*Describe the event, encounter, or moment in detail.*\n\n## Impact\n\n*How did this change the character(s) involved? What shifted internally or externally?*\n\n## Consequences\n\n- *Immediate effect:*\n- *Long-term ripple:*\n\n## Character Reflections\n\n> *What does the character think or feel in the aftermath?*`;

export function mkStory(opts = {}) {
  return {
    id: freshId(),
    title: opts.title || "New Story Event",
    body: opts.useTemplate ? STORY_TEMPLATE_BODY : "",
    charIds: opts.charIds || [],
    nodeId: opts.nodeId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function mkRelationship(charAId, charBId, labelA = "", labelB = "", description = "") {
  return { id: freshId(), charAId, charBId, labelA, labelB, description, createdAt: new Date().toISOString() };
}

export function mkWorkspace(title, nodes) {
  return {
    id: freshId(), title,
    nodes: nodes || {},
    characters: {}, stories: {}, relationships: {},
    settings: { autosave: false },
  };
}

// ── Default data (only used when DB is empty) ─────────────────────────────────
const INITIAL_NODES = {
  "1": { id: "1", title: "The Beginning", body: "# Chapter One\n\nEvery story starts with a **choice**. This is yours.\n\nWhat path will you take?", type: "Narrative", editedAt: new Date("2025-01-10T09:00:00").toISOString(), x: 400, y: 80, children: ["2", "3"], color: "none", icon: null, images: [] },
  "2": { id: "2", title: "The Forest Path", body: "## Into the Woods\n\nYou step into a _dense forest_, the canopy blocking most of the sun.\n\n> The air smells of pine and something else...\n\nAhead the path splits again.", type: "Narrative", editedAt: new Date("2025-01-11T14:22:00").toISOString(), x: 180, y: 280, children: ["4", "5"], color: "sage", icon: null, images: [] },
  "3": { id: "3", title: "The Mountain Road", body: "## Upward Bound\n\nThe road winds steeply. Your legs burn but the view is **breathtaking**.", type: "Narrative", editedAt: new Date("2025-01-12T10:05:00").toISOString(), x: 630, y: 280, children: ["6"], color: "sky", icon: null, images: [] },
  "4": { id: "4", title: "The Clearing", body: "### A Hidden Place\n\nYou find a sun-drenched clearing. In its center: a well.", type: "Narrative", editedAt: new Date("2025-01-13T16:40:00").toISOString(), x: 60, y: 480, children: [], color: "sage", icon: null, images: [] },
  "5": { id: "5", title: "The Dark Grove", body: "### Shadows and Whispers\n\nThe trees grow close here. Something watches you.", type: "Narrative", editedAt: new Date("2025-01-14T11:15:00").toISOString(), x: 310, y: 480, children: [], color: "violet", icon: null, images: [] },
  "6": { id: "6", title: "The Tower", body: "### At the Summit\n\nThe tower door is unlocked. Inside: a spiral stair and a **book** with your name.", type: "Narrative", editedAt: new Date("2025-01-15T09:30:00").toISOString(), x: 630, y: 480, children: [], color: "sky", icon: null, images: [] },
};

function makeDefaultWorkspace() {
  return mkWorkspace("Default", JSON.parse(JSON.stringify(INITIAL_NODES)));
}

// ── workspacesSlice ───────────────────────────────────────────────────────────
const workspacesSlice = createSlice({
  name: "workspaces",
  initialState: {},   // always starts empty — bootstrapFromDB() hydrates it
  reducers: {

    // Replaces entire slice from DB on mount. Not a mutation — excluded from persistence.
    hydrateWorkspaces(state, { payload: workspacesMap }) {
      return workspacesMap;
    },

    importWorkspace(state, { payload: ws }) {
      state[ws.id] = ws;
    },
    updateWorkspace(state, { payload: { id, patch } }) {
      if (state[id]) Object.assign(state[id], patch);
    },
    deleteWorkspace(state, { payload: id }) {
      delete state[id];
    },

    commitNodePositions(state, { payload: { wsId, positions } }) {
    // positions = [{ id, x, y }, ...]
    if (!state[wsId]) return;
    positions.forEach(({ id, x, y }) => {
        if (state[wsId].nodes[id]) {
            state[wsId].nodes[id].x = x;
            state[wsId].nodes[id].y = y;
        }
      });
    },

    setNodes(state, { payload: { wsId, nodes } }) {
      if (state[wsId]) state[wsId].nodes = nodes;
    },
    addNode(state, { payload: { wsId, node, parentId } }) {
      if (!state[wsId]) return;
      state[wsId].nodes[node.id] = node;
      if (parentId && state[wsId].nodes[parentId])
        state[wsId].nodes[parentId].children.push(node.id);
    },
    updateNode(state, { payload: { wsId, id, fields } }) {
      if (!state[wsId]?.nodes[id]) return;
      Object.assign(state[wsId].nodes[id], fields, { editedAt: new Date().toISOString() });
    },
    deleteNode(state, { payload: { wsId, id } }) {
      if (!state[wsId]) return;
      delete state[wsId].nodes[id];
      Object.values(state[wsId].nodes).forEach(n => { n.children = n.children.filter(c => c !== id); });
      Object.values(state[wsId].stories).forEach(s => { if (s.nodeId === id) s.nodeId = null; });
    },
    deleteNodes(state, { payload: { wsId, ids } }) {
      if (!state[wsId]) return;
      const set = new Set(ids);
      ids.forEach(id => delete state[wsId].nodes[id]);
      Object.values(state[wsId].nodes).forEach(n => { n.children = n.children.filter(c => !set.has(c)); });
      Object.values(state[wsId].stories).forEach(s => { if (set.has(s.nodeId)) s.nodeId = null; });
    },
    toggleConnect(state, { payload: { wsId, fromId, toId } }) {
      if (!state[wsId]?.nodes[fromId] || fromId === toId) return;
      const node = state[wsId].nodes[fromId];
      const idx = node.children.indexOf(toId);
      if (idx >= 0) node.children.splice(idx, 1);
      else node.children.push(toId);
    },
    disconnectNodes(state, { payload: { wsId, fromId, toId } }) {
      if (!state[wsId]?.nodes[fromId]) return;
      state[wsId].nodes[fromId].children = state[wsId].nodes[fromId].children.filter(c => c !== toId);
    },

    addCharacter(state, { payload: { wsId, character } }) {
      if (!state[wsId]) return;
      state[wsId].characters[character.id] = character;
    },
    updateCharacter(state, { payload: { wsId, id, fields } }) {
      if (!state[wsId]?.characters[id]) return;
      Object.assign(state[wsId].characters[id], fields, { updatedAt: new Date().toISOString() });
    },
    deleteCharacter(state, { payload: { wsId, id } }) {
      if (!state[wsId]) return;
      delete state[wsId].characters[id];
      Object.values(state[wsId].stories).forEach(s => { s.charIds = s.charIds.filter(c => c !== id); });
      const rels = state[wsId].relationships;
      Object.keys(rels).forEach(rid => { if (rels[rid].charAId === id || rels[rid].charBId === id) delete rels[rid]; });
    },

    saveStory(state, { payload: { wsId, story } }) {
      if (!state[wsId]) return;
      state[wsId].stories[story.id] = { ...story, updatedAt: new Date().toISOString() };
    },
    createStory(state, { payload: { wsId, story } }) {
      if (!state[wsId]) return;
      state[wsId].stories[story.id] = story;
    },
    deleteStory(state, { payload: { wsId, storyId, scope, fromCharId } }) {
      if (!state[wsId]) return;
      if (scope === "all") delete state[wsId].stories[storyId];
      else { const s = state[wsId].stories[storyId]; if (s) s.charIds = s.charIds.filter(c => c !== fromCharId); }
    },

    addRelationship(state, { payload: { wsId, relationship } }) {
      if (!state[wsId]) return;
      state[wsId].relationships[relationship.id] = relationship;
    },
    updateRelationship(state, { payload: { wsId, id, fields } }) {
      if (!state[wsId]?.relationships[id]) return;
      Object.assign(state[wsId].relationships[id], fields);
    },
    deleteRelationship(state, { payload: { wsId, id } }) {
      if (!state[wsId]) return;
      delete state[wsId].relationships[id];
    },
  },
});

// ── uiSlice ───────────────────────────────────────────────────────────────────
// Never touches the DB. Purely in-memory between sessions.
const uiSlice = createSlice({
  name: "ui",
  initialState: {
    activeWsId: null,
    dbReady: false,              // false until bootstrapFromDB() resolves
    view: "overview",
    selectedNodeId: null,
    editingNodeId: null,
    activeCharId: null,
    sidebarOpen: true,
    modal: null,
    toast: null,
    storyModal: null,
    deleteStoryModal: null,
    importPayload: null,
    importError: null,
    importDragOver: false,
    exportRoots: [],
    exportMode: "subtree",
    exportLabel: "",
    wsNameDraft: "",
  },
  reducers: {
    // Fired once after hydrateWorkspaces — sets the starting active workspace
    dbLoaded(state, { payload: { firstWsId } }) {
      state.activeWsId = firstWsId;
      state.dbReady = true;
    },
    setActiveWsId(state, { payload: id }) {
      state.activeWsId = id; state.view = "overview"; state.selectedNodeId = null;
    },
    setView(state, { payload }) { state.view = payload; },
    openBubble(state, { payload: id }) {
      state.selectedNodeId = id; state.view = "bubble"; state.editingNodeId = null;
    },
    goOverview(state) { state.view = "overview"; state.editingNodeId = null; },
    setEditingNodeId(state, { payload }) { state.editingNodeId = payload; },
    setActiveCharId(state, { payload }) { state.activeCharId = payload; },
    openCharSheet(state, { payload: id }) { state.activeCharId = id; state.view = "charsheet"; },
    setSidebarOpen(state, { payload }) { state.sidebarOpen = payload; },
    setModal(state, { payload }) { state.modal = payload; },
    showToast(state, { payload: { msg, kind = "ok" } }) { state.toast = { msg, kind }; },
    clearToast(state) { state.toast = null; },
    setStoryModal(state, { payload }) { state.storyModal = payload; },
    setDeleteStoryModal(state, { payload }) { state.deleteStoryModal = payload; },
    setImportPayload(state, { payload }) { state.importPayload = payload; },
    setImportError(state, { payload }) { state.importError = payload; },
    setImportDragOver(state, { payload }) { state.importDragOver = payload; },
    setExportRoots(state, { payload }) { state.exportRoots = payload; },
    setExportMode(state, { payload }) { state.exportMode = payload; },
    setExportLabel(state, { payload }) { state.exportLabel = payload; },
    setWsNameDraft(state, { payload }) { state.wsNameDraft = payload; },
    activateWorkspace(state, { payload: id }) {
      state.activeWsId = id; state.view = "overview"; state.selectedNodeId = null; state.modal = null;
    },
    workspaceDeleted(state, { payload: fallbackId }) {
      state.activeWsId = fallbackId; state.view = "overview"; state.selectedNodeId = null; state.modal = null;
    },
    nodeClosed(state) { state.selectedNodeId = null; state.view = "overview"; },
  },
});

// ── SQLite persistence middleware ─────────────────────────────────────────────
// After every workspaces/* action (except hydration), reads the updated
// workspace from state and upserts it to SQLite via window.api.addItem().
// Uses wsId as the row key — addItem is treated as insert-or-replace.
//
// deleteWorkspace writes a { _deleted: true } tombstone so the row is
// recognised as gone on next load. If your Electron backend adds a proper
// deleteItem(name) method, replace the tombstone write with that call.

function resolveAffectedWsId(action) {
  const p = action.payload;
  if (!p) return null;
  if (action.type === "workspaces/deleteWorkspace")  return p;          // payload = wsId string
  if (action.type === "workspaces/importWorkspace")  return p.id;       // payload = full ws object
  if (action.type === "workspaces/updateWorkspace")  return p.id;       // payload = { id, patch }
  if (typeof p === "object" && p.wsId)               return p.wsId;     // all other actions
  return null;
}

const sqlitePersistenceMiddleware = storeApi => next => action => {
  const result = next(action);  // reducer runs first
  const SKIP_ACTIONS = new Set([
    "workspaces/hydrateWorkspaces",
    "workspaces/setNodes",          
  ]);

  if (!action.type.startsWith("workspaces/"))        return result;
  if (SKIP_ACTIONS.has(action.type)) return result;  // skip — transient actions

  const api = window?.api;
  if (!api) return result;  // no Electron context — dev browser fallback

  const wsId = resolveAffectedWsId(action);
  if (!wsId) return result;

  if (action.type === "workspaces/deleteWorkspace") {
    api.deleteItem(wsId)
  .catch(err => console.error("[db] delete failed:", wsId, err));
    return result;
  }

  const ws = storeApi.getState().workspaces[wsId];
  if (!ws) return result;

  api.addItem({ name: wsId, content: JSON.stringify(ws) })
  .catch(err => console.error("[db] persist failed:", wsId, err));

  return result;
};

// ── Store ─────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    workspaces: workspacesSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(sqlitePersistenceMiddleware),
});

// ── bootstrapFromDB ───────────────────────────────────────────────────────────
// Called once from main.jsx after the store is created.
// Loads all rows from SQLite, parses them, skips tombstones/corrupt rows,
// hydrates workspacesSlice, then tells uiSlice which workspace to show first.
// Falls back gracefully if window.api is absent (browser dev mode).
export async function bootstrapFromDB(dispatch) {
  try {
    const api = window?.api;

    if (!api) {
      const ws = makeDefaultWorkspace();
      dispatch(workspacesActions.hydrateWorkspaces({ [ws.id]: ws }));
      dispatch(uiActions.dbLoaded({ firstWsId: ws.id }));
      return;
    }

    const items = await api.getItems();  // [{ name: wsId, content: jsonString }, ...]

    const workspacesMap = {};
    for (const item of items) {
      try {
        const ws = JSON.parse(item.content);
        if (ws._deleted) continue;
        if (!ws.id || !ws.title) continue;  // guard against corrupt rows
        workspacesMap[ws.id] = ws;
      } catch {
        console.warn("[db] skipping unparseable row:", item.name);
      }
    }

    if (Object.keys(workspacesMap).length === 0) {
      // Fresh install — seed with default workspace
      const ws = makeDefaultWorkspace();
      workspacesMap[ws.id] = ws;
      await api.addItem({ name: ws.id, content: JSON.stringify(ws) });
    }

    dispatch(workspacesActions.hydrateWorkspaces(workspacesMap));
    dispatch(uiActions.dbLoaded({ firstWsId: Object.keys(workspacesMap)[0] }));

  } catch (err) {
    console.error("[db] bootstrap failed:", err);
    // Hard fallback — app is never stuck on a blank screen
    const ws = makeDefaultWorkspace();
    dispatch(workspacesActions.hydrateWorkspaces({ [ws.id]: ws }));
    dispatch(uiActions.dbLoaded({ firstWsId: ws.id }));
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
export const workspacesActions  = workspacesSlice.actions;
export const uiActions          = uiSlice.actions;

export const selectAllWorkspaces   = s => s.workspaces;
export const selectUi              = s => s.ui;
export const selectDbReady         = s => s.ui.dbReady;
export const selectActiveWsId      = s => s.ui.activeWsId;
export const selectActiveWorkspace = s => s.workspaces[s.ui.activeWsId] || Object.values(s.workspaces)[0];
export const selectNodes           = s => selectActiveWorkspace(s)?.nodes         || {};
export const selectCharacters      = s => selectActiveWorkspace(s)?.characters    || {};
export const selectStories         = s => selectActiveWorkspace(s)?.stories       || {};
export const selectRelationships   = s => selectActiveWorkspace(s)?.relationships || {};
export const selectSettings        = s => selectActiveWorkspace(s)?.settings      || { autosave: false };