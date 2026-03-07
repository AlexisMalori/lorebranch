// renderer/src/store.js
// handles Redux store setup, including slices, actions, and SQLite persistence middleware.

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

// ── Default data (only used when DB is empty on first launch) ─────────────────
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
  initialState: {},
  reducers: {

    // Replaces entire slice on mount — excluded from all DB writes
    hydrateWorkspaces(state, { payload: workspacesMap }) {
      return workspacesMap;
    },

    // ── Workspaces ──────────────────────────────────────────────────────────
    importWorkspace(state, { payload: ws }) {
      state[ws.id] = ws;
    },
    updateWorkspace(state, { payload: { id, patch } }) {
      if (state[id]) Object.assign(state[id], patch);
    },
    deleteWorkspace(state, { payload: id }) {
      delete state[id];
    },

    // ── Nodes ───────────────────────────────────────────────────────────────
    // setNodes: transient drag update — Redux only, never hits the DB
    setNodes(state, { payload: { wsId, nodes } }) {
      if (state[wsId]) state[wsId].nodes = nodes;
    },
    // commitNodePositions: fired on mouseup — DB write via upsertManyNodes
    commitNodePositions(state, { payload: { wsId, positions } }) {
      if (!state[wsId]) return;
      positions.forEach(({ id, x, y }) => {
        if (state[wsId].nodes[id]) {
          state[wsId].nodes[id].x = x;
          state[wsId].nodes[id].y = y;
        }
      });
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
      state[wsId].nodes[fromId].children =
        state[wsId].nodes[fromId].children.filter(c => c !== toId);
    },

    // ── Characters ──────────────────────────────────────────────────────────
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
      Object.values(state[wsId].stories).forEach(s => {
        s.charIds = s.charIds.filter(c => c !== id);
      });
      const rels = state[wsId].relationships;
      Object.keys(rels).forEach(rid => {
        if (rels[rid].charAId === id || rels[rid].charBId === id) delete rels[rid];
      });
    },

    // ── Stories ─────────────────────────────────────────────────────────────
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
      if (scope === "all") {
        delete state[wsId].stories[storyId];
      } else {
        const s = state[wsId].stories[storyId];
        if (s) s.charIds = s.charIds.filter(c => c !== fromCharId);
      }
    },

    // ── Relationships ────────────────────────────────────────────────────────
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
const uiSlice = createSlice({
  name: "ui",
  initialState: {
    activeWsId: null,
    dbReady: false,
    view: "overview",
    selectedNodeId: null,
    editingNodeId: null,
    activeCharId: null,
    sidebarOpen: true,
    modal: null,
    toast: null,
    storyModal: null,
    deleteStoryModal: null,
    wsNameDraft: "",
  },
  reducers: {
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
    setWsNameDraft(state, { payload }) { state.wsNameDraft = payload; },
    activateWorkspace(state, { payload: id }) {
      state.activeWsId = id; state.view = "overview";
      state.selectedNodeId = null; state.modal = null;
    },
    workspaceDeleted(state, { payload: fallbackId }) {
      state.activeWsId = fallbackId; state.view = "overview";
      state.selectedNodeId = null; state.modal = null;
    },
    nodeClosed(state) { state.selectedNodeId = null; state.view = "overview"; },
  },
});

// ── SQLite persistence middleware ─────────────────────────────────────────────
// Fires after each workspaces/* reducer, calling the narrowest possible
// IPC channel for the data that actually changed:
//
//  workspaces     → db:upsert-workspace / db:delete-workspace
//  nodes          → db:upsert-node / db:upsert-many-nodes /
//                   db:delete-node / db:delete-many-nodes /
//                   db:update-node-children
//  characters     → db:upsert-character / db:delete-character
//  stories        → db:upsert-story / db:delete-story /
//                   db:detach-char-from-story
//  relationships  → db:upsert-relationship / db:delete-relationship
//
// hydrateWorkspaces and setNodes are skipped (pure Redux, never touch the DB).

const sqlitePersistenceMiddleware = storeApi => next => action => {
  const result = next(action);  // reducer runs first
  const { type, payload: p } = action;

  if (!type.startsWith("workspaces/")) return result;

  const api = window?.api;
  if (!api) return result;  // no Electron context

  const state = storeApi.getState().workspaces;

  // Helper — fire and log
  const call = (channel, args) =>
    api[channel]?.(args)?.catch(err => console.error(`[db] ${channel} failed:`, err));

  switch (type) {

    // ── Skip — these are load-time or transient ──────────────────────────────
    case "workspaces/hydrateWorkspaces":
    case "workspaces/setNodes":
      break;

    // ── Workspace-level ──────────────────────────────────────────────────────
    case "workspaces/importWorkspace": {
      const ws = p;
      call("upsertWorkspace", { id: ws.id, name: ws.title, settings: ws.settings });
      // Also write all child entities for a newly imported workspace
      const nodes = Object.values(ws.nodes || {});
      if (nodes.length) call("upsertManyNodes", { wsId: ws.id, nodes });
      Object.values(ws.characters || {}).forEach(c => call("upsertCharacter", { wsId: ws.id, character: c }));
      Object.values(ws.stories    || {}).forEach(s => call("upsertStory",     { wsId: ws.id, story: s }));
      Object.values(ws.relationships || {}).forEach(r => call("upsertRelationship", { wsId: ws.id, relationship: r }));
      break;
    }

    case "workspaces/updateWorkspace": {
      const ws = state[p.id];
      if (ws) call("upsertWorkspace", { id: ws.id, name: ws.title, settings: ws.settings });
      break;
    }

    case "workspaces/deleteWorkspace":
      // CASCADE in SQLite removes all child rows automatically
      call("deleteWorkspace", p);
      break;

    // ── Node writes ──────────────────────────────────────────────────────────
    case "workspaces/addNode": {
      const { wsId, node, parentId } = p;
      call("upsertNode", { wsId, node });
      // Parent's children array also changed — write only that column
      if (parentId && state[wsId]?.nodes[parentId]) {
        call("updateNodeChildren", {
          nodeId:   parentId,
          children: state[wsId].nodes[parentId].children,
        });
      }
      break;
    }

    case "workspaces/updateNode": {
      const { wsId, id } = p;
      const node = state[wsId]?.nodes[id];
      if (node) call("upsertNode", { wsId, node });
      break;
    }

    case "workspaces/commitNodePositions": {
      // Batch — one transaction for all dragged nodes
      const { wsId, positions } = p;
      const nodes = positions
        .map(({ id }) => state[wsId]?.nodes[id])
        .filter(Boolean);
      if (nodes.length) call("upsertManyNodes", { wsId, nodes });
      break;
    }

    case "workspaces/deleteNode": {
      const { wsId, id } = p;
      // Read image URLs BEFORE next(action) removed the node from state
      const preState = storeApi.getState().workspaces[wsId]?.nodes[id];
      if (preState) {
        const imgs = [...(preState.images || [])];
        if (preState.icon) imgs.push(preState.icon);
        if (imgs.length) call("deleteManyImages", imgs);
      }
      call("deleteNode", id);
      Object.values(state[wsId]?.nodes || {}).forEach(n => {
        if (!n.children.includes(id)) return;
        call("updateNodeChildren", { nodeId: n.id, children: n.children });
      });
      break;
    }

    case "workspaces/deleteNodes": {
      const { wsId, ids } = p;
      // Collect image URLs from pre-action state (nodes still exist at this point)
      const preNodes = storeApi.getState().workspaces[wsId]?.nodes || {};
      const allImgs = ids.flatMap(id => {
        const n = preNodes[id];
        if (!n) return [];
        return [...(n.images || []), ...(n.icon ? [n.icon] : [])];
      });
      if (allImgs.length) call("deleteManyImages", allImgs);
      call("deleteManyNodes", ids);
      Object.values(state[wsId]?.nodes || {}).forEach(n => {
        call("updateNodeChildren", { nodeId: n.id, children: n.children });
      });
      break;
    }

    case "workspaces/toggleConnect":
    case "workspaces/disconnectNodes": {
      const { wsId, fromId } = p;
      const node = state[wsId]?.nodes[fromId];
      if (node) call("updateNodeChildren", { nodeId: fromId, children: node.children });
      break;
    }

    // ── Character writes ─────────────────────────────────────────────────────
    case "workspaces/addCharacter":
    case "workspaces/updateCharacter": {
      const { wsId, character, id } = p;
      const charId = character?.id ?? id;
      const char = state[wsId]?.characters[charId];
      if (char) call("upsertCharacter", { wsId, character: char });
      break;
    }

    case "workspaces/deleteCharacter": {
      const { wsId, id } = p;
      // Clean up portrait and fullbody files before the DB row is removed
      const dying = storeApi.getState().workspaces[wsId]?.characters[id];
      if (dying) {
        const imgs = [dying.portrait, dying.fullbody].filter(Boolean);
        if (imgs.length) call("deleteManyImages", imgs);
      }
      call("deleteCharacter", id);
      break;
    }

    // ── Story writes ─────────────────────────────────────────────────────────
    case "workspaces/saveStory":
    case "workspaces/createStory": {
      const { wsId, story } = p;
      const saved = state[wsId]?.stories[story.id];
      if (saved) call("upsertStory", { wsId, story: saved });
      break;
    }

    case "workspaces/deleteStory": {
      const { wsId, storyId, scope, fromCharId } = p;
      if (scope === "all") {
        call("deleteStory", storyId);
      } else {
        // Only detach one character — story itself survives
        call("detachCharFromStory", { charId: fromCharId, storyId });
      }
      break;
    }

    // ── Relationship writes ──────────────────────────────────────────────────
    case "workspaces/addRelationship":
    case "workspaces/updateRelationship": {
      const { wsId, relationship, id } = p;
      const relId = relationship?.id ?? id;
      const rel = state[wsId]?.relationships[relId];
      if (rel) call("upsertRelationship", { wsId, relationship: rel });
      break;
    }

    case "workspaces/deleteRelationship":
      call("deleteRelationship", p.id);
      break;

    default:
      break;
  }

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
// Called once from main.jsx. Loads all workspaces via db:load-all,
// hydrates Redux, then sets the first workspace active.
export async function bootstrapFromDB(dispatch) {
  try {
    const api = window?.api;

    if (!api) {
      // Browser dev mode — seed with default workspace, skip DB
      const ws = makeDefaultWorkspace();
      dispatch(workspacesActions.hydrateWorkspaces({ [ws.id]: ws }));
      dispatch(uiActions.dbLoaded({ firstWsId: ws.id }));
      return;
    }

    const workspacesMap = await api.loadAll();  // calls db:load-all → loadAllWorkspaces()

    if (Object.keys(workspacesMap).length === 0) {
      // Fresh install — create default workspace and persist it
      const ws = makeDefaultWorkspace();
      await api.upsertWorkspace({ id: ws.id, name: ws.title, settings: ws.settings });
      await api.upsertManyNodes({ wsId: ws.id, nodes: Object.values(ws.nodes) });
      workspacesMap[ws.id] = ws;
    }

    dispatch(workspacesActions.hydrateWorkspaces(workspacesMap));
    dispatch(uiActions.dbLoaded({ firstWsId: Object.keys(workspacesMap)[0] }));

  } catch (err) {
    console.error("[db] bootstrap failed:", err);
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