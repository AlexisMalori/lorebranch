import { configureStore, createSlice } from "@reduxjs/toolkit";

// ── ID factory ────────────────────────────────────────────────────────────────
let _nc = 200;
export function freshId() { return String(_nc++); }

// ── Makers (pure, no side-effects) ───────────────────────────────────────────
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

// ── Initial data ──────────────────────────────────────────────────────────────
const INITIAL_NODES = {
  "1": { id: "1", title: "The Beginning", body: "# Chapter One\n\nEvery story starts with a **choice**. This is yours.\n\nWhat path will you take?", type: "Narrative", editedAt: new Date("2025-01-10T09:00:00").toISOString(), x: 400, y: 80, children: ["2", "3"], color: "none", icon: null, images: [] },
  "2": { id: "2", title: "The Forest Path", body: "## Into the Woods\n\nYou step into a _dense forest_, the canopy blocking most of the sun.\n\n> The air smells of pine and something else...\n\nAhead the path splits again.", type: "Narrative", editedAt: new Date("2025-01-11T14:22:00").toISOString(), x: 180, y: 280, children: ["4", "5"], color: "sage", icon: null, images: [] },
  "3": { id: "3", title: "The Mountain Road", body: "## Upward Bound\n\nThe road winds steeply. Your legs burn but the view is **breathtaking**.", type: "Narrative", editedAt: new Date("2025-01-12T10:05:00").toISOString(), x: 630, y: 280, children: ["6"], color: "sky", icon: null, images: [] },
  "4": { id: "4", title: "The Clearing", body: "### A Hidden Place\n\nYou find a sun-drenched clearing. In its center: a well.", type: "Narrative", editedAt: new Date("2025-01-13T16:40:00").toISOString(), x: 60, y: 480, children: [], color: "sage", icon: null, images: [] },
  "5": { id: "5", title: "The Dark Grove", body: "### Shadows and Whispers\n\nThe trees grow close here. Something watches you.", type: "Narrative", editedAt: new Date("2025-01-14T11:15:00").toISOString(), x: 310, y: 480, children: [], color: "violet", icon: null, images: [] },
  "6": { id: "6", title: "The Tower", body: "### At the Summit\n\nThe tower door is unlocked. Inside: a spiral stair and a **book** with your name.", type: "Narrative", editedAt: new Date("2025-01-15T09:30:00").toISOString(), x: 630, y: 480, children: [], color: "sky", icon: null, images: [] },
};

function makeInitialWorkspaces() {
  const ws = mkWorkspace("Default", JSON.parse(JSON.stringify(INITIAL_NODES)));
  return { workspaces: { [ws.id]: ws }, activeWsId: ws.id };
}
const { workspaces: INITIAL_WORKSPACES, activeWsId: INITIAL_WS_ID } = makeInitialWorkspaces();

// ── workspacesSlice ───────────────────────────────────────────────────────────
// Owns all persistent data: workspaces, nodes, characters, stories, relationships.
const workspacesSlice = createSlice({
  name: "workspaces",
  initialState: INITIAL_WORKSPACES,
  reducers: {
    // ── Workspace management ──────────────────────────────────────────────
    addWorkspace(state, { payload: { title } }) {
      const ws = mkWorkspace(title);
      state[ws.id] = ws;
    },
    updateWorkspace(state, { payload: { id, patch } }) {
      if (state[id]) Object.assign(state[id], patch);
    },
    deleteWorkspace(state, { payload: id }) {
      delete state[id];
    },
    importWorkspace(state, { payload: ws }) {
      state[ws.id] = ws;
    },

    // ── Node CRUD ──────────────────────────────────────────────────────────
    setNodes(state, { payload: { wsId, nodes } }) {
      if (state[wsId]) state[wsId].nodes = nodes;
    },
    addNode(state, { payload: { wsId, node, parentId } }) {
      if (!state[wsId]) return;
      state[wsId].nodes[node.id] = node;
      if (parentId && state[wsId].nodes[parentId]) {
        state[wsId].nodes[parentId].children.push(node.id);
      }
    },
    updateNode(state, { payload: { wsId, id, fields } }) {
      if (!state[wsId]?.nodes[id]) return;
      Object.assign(state[wsId].nodes[id], fields, { editedAt: new Date().toISOString() });
    },
    deleteNode(state, { payload: { wsId, id } }) {
      if (!state[wsId]) return;
      const nodes = state[wsId].nodes;
      delete nodes[id];
      Object.values(nodes).forEach(n => { n.children = n.children.filter(c => c !== id); });
      // Unlink stories
      Object.values(state[wsId].stories).forEach(s => { if (s.nodeId === id) s.nodeId = null; });
    },
    deleteNodes(state, { payload: { wsId, ids } }) {
      if (!state[wsId]) return;
      const set = new Set(ids);
      const nodes = state[wsId].nodes;
      ids.forEach(id => delete nodes[id]);
      Object.values(nodes).forEach(n => { n.children = n.children.filter(c => !set.has(c)); });
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
      const node = state[wsId].nodes[fromId];
      node.children = node.children.filter(c => c !== toId);
    },

    // ── Character CRUD ────────────────────────────────────────────────────
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
      // Remove from all stories
      Object.values(state[wsId].stories).forEach(s => {
        s.charIds = s.charIds.filter(c => c !== id);
      });
      // Remove all relationships
      const rels = state[wsId].relationships;
      Object.keys(rels).forEach(rid => {
        if (rels[rid].charAId === id || rels[rid].charBId === id) delete rels[rid];
      });
    },

    // ── Story CRUD ────────────────────────────────────────────────────────
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

    // ── Relationship CRUD ─────────────────────────────────────────────────
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
// Owns all ephemeral UI state: active workspace, current view, modals, toast, etc.
const uiSlice = createSlice({
  name: "ui",
  initialState: {
    activeWsId: INITIAL_WS_ID,
    view: "overview",            // "overview" | "bubble" | "characters" | "charsheet"
    selectedNodeId: null,        // node currently open in bubble view
    editingNodeId: null,         // node currently being edited inline
    activeCharId: null,
    sidebarOpen: true,
    modal: null,                 // "settings" | "newws" | "export" | "import" | null
    toast: null,                 // { msg, kind } | null
    storyModal: null,            // { mode, storyId?, defaults? } | null
    deleteStoryModal: null,      // { storyId, fromCharId? } | null
    // Import/export ephemeral state
    importPayload: null,
    importError: null,
    importDragOver: false,
    exportRoots: [],             // array of node IDs (Set serialised as array)
    exportMode: "subtree",
    exportLabel: "",
    wsNameDraft: "",
  },
  reducers: {
    setActiveWsId(state, { payload: id }) {
      state.activeWsId = id;
      state.view = "overview";
      state.selectedNodeId = null;
    },
    setView(state, { payload: view }) {
      state.view = view;
    },
    openBubble(state, { payload: id }) {
      state.selectedNodeId = id;
      state.view = "bubble";
      state.editingNodeId = null;
    },
    goOverview(state) {
      state.view = "overview";
      state.editingNodeId = null;
    },
    setEditingNodeId(state, { payload: id }) {
      state.editingNodeId = id;
    },
    setActiveCharId(state, { payload: id }) {
      state.activeCharId = id;
    },
    openCharSheet(state, { payload: id }) {
      state.activeCharId = id;
      state.view = "charsheet";
    },
    setSidebarOpen(state, { payload: open }) {
      state.sidebarOpen = open;
    },
    setModal(state, { payload: modal }) {
      state.modal = modal;
    },
    showToast(state, { payload: { msg, kind = "ok" } }) {
      state.toast = { msg, kind };
    },
    clearToast(state) {
      state.toast = null;
    },
    setStoryModal(state, { payload: storyModal }) {
      state.storyModal = storyModal;
    },
    setDeleteStoryModal(state, { payload: modal }) {
      state.deleteStoryModal = modal;
    },
    // Import/export
    setImportPayload(state, { payload }) { state.importPayload = payload; },
    setImportError(state, { payload }) { state.importError = payload; },
    setImportDragOver(state, { payload }) { state.importDragOver = payload; },
    setExportRoots(state, { payload }) { state.exportRoots = payload; },
    setExportMode(state, { payload }) { state.exportMode = payload; },
    setExportLabel(state, { payload }) { state.exportLabel = payload; },
    setWsNameDraft(state, { payload }) { state.wsNameDraft = payload; },
    // Called when a new workspace is created/imported — switches to it
    activateWorkspace(state, { payload: id }) {
      state.activeWsId = id;
      state.view = "overview";
      state.selectedNodeId = null;
      state.modal = null;
    },
    // Called when a workspace is deleted — switch to a fallback id
    workspaceDeleted(state, { payload: fallbackId }) {
      state.activeWsId = fallbackId;
      state.view = "overview";
      state.selectedNodeId = null;
      state.modal = null;
    },
    // Called when a node is deleted and it was selected
    nodeClosed(state) {
      state.selectedNodeId = null;
      state.view = "overview";
    },
  },
});

// ── Store ─────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    workspaces: workspacesSlice.reducer,
    ui: uiSlice.reducer,
  },
});

// ── Exports ───────────────────────────────────────────────────────────────────
export const workspacesActions = workspacesSlice.actions;
export const uiActions = uiSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectAllWorkspaces = s => s.workspaces;
export const selectUi = s => s.ui;
export const selectActiveWsId = s => s.ui.activeWsId;
export const selectActiveWorkspace = s =>
  s.workspaces[s.ui.activeWsId] || Object.values(s.workspaces)[0];
export const selectNodes = s => selectActiveWorkspace(s)?.nodes || {};
export const selectCharacters = s => selectActiveWorkspace(s)?.characters || {};
export const selectStories = s => selectActiveWorkspace(s)?.stories || {};
export const selectRelationships = s => selectActiveWorkspace(s)?.relationships || {};
export const selectSettings = s => selectActiveWorkspace(s)?.settings || { autosave: false };
