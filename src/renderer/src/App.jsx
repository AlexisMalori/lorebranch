// DISCLAIMER: A lot of the front-facing code is Claude-assisted at the moment. I want to work away from that over time, but for now it's a big help in automating some of the more tedious bits of UI design.

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useDispatch, useSelector } from "react-redux";
import {
  freshId, mkCharacter, mkStory, mkRelationship, mkWorkspace, STORY_TEMPLATE_BODY,
  workspacesActions, uiActions,
  selectAllWorkspaces, selectUi, selectActiveWsId, selectActiveWorkspace,
  selectNodes, selectCharacters, selectStories, selectRelationships, selectSettings,
} from "./store";

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  fontSerif:   "'Crimson Pro', serif",
  fontMono:    "'JetBrains Mono', monospace",
  bgApp:       "#1a1814",
  bgPanel:     "#16140f",
  bgSidebar:   "#131110",
  bgCard:      "#1e1c18",
  bgSurface:   "#181613",
  bgInput:     "#141210",
  bgDeep:      "#252220",
  borderStrong:"#3a3530",
  borderMid:   "#2a2520",
  borderSub:   "#2e2c26",
  borderFaint: "#242220",
  borderDeep:  "#222018",
  borderDark:  "#1e1c18",
  textPrimary: "#e8e0d0",
  textBody:    "#d0c8b8",
  textMuted:   "#a09080",
  textDim:     "#8a8070",
  textFaint:   "#6a6058",
  textGhost:   "#5a5448",
  textDeep:    "#4a4540",
  textInvis:   "#3a3530",
  textTiny:    "#333028",
  gold:        "#c9a96e",
  goldHover:   "#d4b87a",
  goldDim:     "#c9a96e18",
  goldBorder:  "#c9a96e40",
  goldActive:  "#c9a96e80",
  green:       "#507840",
  greenHover:  "#608850",
  greenText:   "#d0e8c8",
  greenBright: "#90c870",
  greenToggle: "#70a860",
  red:         "#c06060",
  redBorder:   "#6a3030",
  redBg:       "#3a1818",
  redText:     "#e08080",
  redDim:      "#6a303020",
  redImg:      "#c06060dd",
  statPos:     "#90c870",
  statNeg:     "#c06868",
  edgeDefault: "#4a4030",
  gridLine:    "#252220",
  selectRect:  "#c9a96e0a",
  scrollThumb: "#4a4540",
};

const inputStyle = { background: T.bgInput, border: `1px solid ${T.borderStrong}`, color: T.textBody, borderRadius: 4, outline: "none" };

const GLOW_COLORS = [
  { id: "none",   label: "None",   glow: null },
  { id: "amber",  label: "Amber",  glow: T.gold },
  { id: "rose",   label: "Rose",   glow: "#d06080" },
  { id: "sky",    label: "Sky",    glow: "#60a8d0" },
  { id: "sage",   label: "Sage",   glow: "#70b090" },
  { id: "violet", label: "Violet", glow: "#9070c0" },
  { id: "peach",  label: "Peach",  glow: "#d08860" },
];
function getGlowColor(id) { return GLOW_COLORS.find(c => c.id === id) || GLOW_COLORS[0]; }
const DEFAULT_EDGE = "#4a4030";

const DND_STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const STAT_LABELS = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
function statMod(v) { return Math.floor((v - 10) / 2); }

// ── IO helpers ────────────────────────────────────────────────────────────────
function readFileAsText(f) { return new Promise((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.onerror = j; rd.readAsText(f); }); }
function readFileAsDataURL(f) { return new Promise((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.onerror = j; rd.readAsDataURL(f); }); }
function downloadJSON(obj, name) {
  const b = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ── Export/import helpers (pure functions, no store deps) ─────────────────────
const DTREE_VERSION = "1.0";
function collectSubtree(nodes, rootIds) {
  const v = new Set(), q = [...rootIds];
  while (q.length) { const id = q.shift(); if (v.has(id) || !nodes[id]) continue; v.add(id); nodes[id].children.forEach(c => q.push(c)); }
  return v;
}
function buildExport(nodes, nodeIds, label) {
  const list = [...nodeIds].map(id => nodes[id]).filter(Boolean);
  const edges = []; list.forEach(n => n.children.forEach(c => { if (nodeIds.has(c)) edges.push({ from: n.id, to: c }); }));
  return {
    dtree: DTREE_VERSION, exportedAt: new Date().toISOString(), label,
    nodeCount: list.length, edgeCount: edges.length,
    nodes: list.map(n => ({ id: n.id, title: n.title, body: n.body, type: n.type, editedAt: n.editedAt, x: Math.round(n.x), y: Math.round(n.y), color: n.color || "none", icon: n.icon || null, images: n.images || [] })),
    edges,
  };
}
function validateImport(obj) {
  if (!obj || typeof obj !== "object") return "Not a valid JSON object.";
  if (obj.dtree !== DTREE_VERSION) return `Unknown version "${obj.dtree}". Expected "${DTREE_VERSION}".`;
  if (!Array.isArray(obj.nodes)) return "Missing 'nodes' array.";
  if (!Array.isArray(obj.edges)) return "Missing 'edges' array.";
  for (const n of obj.nodes) if (!n.id || !n.title) return "Node missing required fields.";
  return null;
}
function mergeImport(existing, payload, offX = 100, offY = 100) {
  const map = {}; payload.nodes.forEach(n => { map[n.id] = freshId(); });
  const nw = {};
  payload.nodes.forEach(n => {
    const nid = map[n.id];
    nw[nid] = { id: nid, title: n.title, body: n.body || "", type: n.type || "Narrative", editedAt: n.editedAt || new Date().toISOString(), x: (n.x || 0) + offX, y: (n.y || 0) + offY, color: n.color || "none", icon: n.icon || null, images: n.images || [], children: [] };
  });
  payload.edges.forEach(e => { const f = map[e.from], t = map[e.to]; if (f && t && nw[f] && !nw[f].children.includes(t)) nw[f].children.push(t); });
  return { ...existing, ...nw };
}
function getParents(nodes, id) { return Object.values(nodes).filter(n => n.children.includes(id)); }

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const dispatch = useDispatch();

  // ── Selectors ────────────────────────────────────────────────────────────
  const workspaces  = useSelector(selectAllWorkspaces);
  const ui          = useSelector(selectUi);
  const activeWsId  = useSelector(selectActiveWsId);
  const ws          = useSelector(selectActiveWorkspace);
  const nodes       = useSelector(selectNodes);
  const characters  = useSelector(selectCharacters);
  const stories     = useSelector(selectStories);
  const relationships = useSelector(selectRelationships);
  const settings    = useSelector(selectSettings);

  const { view, selectedNodeId, editingNodeId, activeCharId, sidebarOpen, modal,
          toast, storyModal, deleteStoryModal,
          importPayload, importError, importDragOver,
          exportRoots, exportMode, exportLabel, wsNameDraft } = ui;

  const importFileRef = useRef(null);
  const wsImportRef   = useRef(null);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((msg, kind = "ok") => {
    dispatch(uiActions.showToast({ msg, kind }));
    setTimeout(() => dispatch(uiActions.clearToast()), 3200);
  }, [dispatch]);

  // ── Workspace actions ─────────────────────────────────────────────────────
  const createWorkspace = (title) => {
    const ws = mkWorkspace(title);
    dispatch(workspacesActions.importWorkspace(ws));
    dispatch(uiActions.activateWorkspace(ws.id));
  };
  const updateWs = (id, patch) => dispatch(workspacesActions.updateWorkspace({ id, patch }));
  const deleteWs = (id) => {
    const remaining = Object.keys(workspaces).filter(k => k !== id);
    dispatch(workspacesActions.deleteWorkspace(id));
    dispatch(uiActions.workspaceDeleted(remaining[0]));
  };

  // ── Node actions ──────────────────────────────────────────────────────────
  const setNodes = (patch) => {
    const resolved = typeof patch === "function" ? patch(nodes) : patch;
    dispatch(workspacesActions.setNodes({ wsId: activeWsId, nodes: resolved }));
  };
  const updateNode = (id, fields) => dispatch(workspacesActions.updateNode({ wsId: activeWsId, id, fields }));
  const addNode = (parentId = null) => {
    const id = freshId();
    const parent = parentId ? nodes[parentId] : null;
    const node = {
      id, title: "New Node", body: "Write something here...", type: "Narrative",
      editedAt: new Date().toISOString(),
      x: parent ? parent.x + (Math.random() * 220 - 110) : 400,
      y: parent ? parent.y + 180 : 200,
      children: [], color: "none", icon: null, images: [],
    };
    dispatch(workspacesActions.addNode({ wsId: activeWsId, node, parentId }));
    return id;
  };
  const deleteNode = (id) => {
    dispatch(workspacesActions.deleteNode({ wsId: activeWsId, id }));
    if (selectedNodeId === id) dispatch(uiActions.nodeClosed());
  };
  const deleteNodes = (ids) => {
    dispatch(workspacesActions.deleteNodes({ wsId: activeWsId, ids }));
    if (ids.includes(selectedNodeId)) dispatch(uiActions.nodeClosed());
  };
  const toggleConnect = (fromId, toId) => dispatch(workspacesActions.toggleConnect({ wsId: activeWsId, fromId, toId }));
  const disconnectNodes = (fromId, toId) => dispatch(workspacesActions.disconnectNodes({ wsId: activeWsId, fromId, toId }));

  // ── Character actions ─────────────────────────────────────────────────────
  const addCharacter = () => {
    const ch = mkCharacter();
    dispatch(workspacesActions.addCharacter({ wsId: activeWsId, character: ch }));
    dispatch(uiActions.openCharSheet(ch.id));
    return ch.id;
  };
  const updateCharacter = (id, fields) => dispatch(workspacesActions.updateCharacter({ wsId: activeWsId, id, fields }));
  const deleteCharacter = (id) => {
    dispatch(workspacesActions.deleteCharacter({ wsId: activeWsId, id }));
    if (activeCharId === id) { dispatch(uiActions.setActiveCharId(null)); dispatch(uiActions.setView("characters")); }
  };

  // ── Story actions ─────────────────────────────────────────────────────────
  const saveStory = (storyData) => dispatch(workspacesActions.saveStory({ wsId: activeWsId, story: storyData }));
  const createStory = (opts = {}) => {
    const s = mkStory({ ...opts, useTemplate: opts.useTemplate ?? true });
    dispatch(workspacesActions.createStory({ wsId: activeWsId, story: s }));
    return s;
  };
  const deleteStory = (storyId, scope = "all", fromCharId = null) => {
    dispatch(workspacesActions.deleteStory({ wsId: activeWsId, storyId, scope, fromCharId }));
    dispatch(uiActions.setDeleteStoryModal(null));
  };

  // ── Relationship actions ──────────────────────────────────────────────────
  const addRelationship = (charAId, charBId) => {
    const r = mkRelationship(charAId, charBId);
    dispatch(workspacesActions.addRelationship({ wsId: activeWsId, relationship: r }));
    return r;
  };
  const updateRelationship = (id, fields) => dispatch(workspacesActions.updateRelationship({ wsId: activeWsId, id, fields }));
  const deleteRelationship = (id) => dispatch(workspacesActions.deleteRelationship({ wsId: activeWsId, id }));

  // ── Navigation helpers ────────────────────────────────────────────────────
  const openBubble = (id) => dispatch(uiActions.openBubble(id));
  const goOverview = () => dispatch(uiActions.goOverview());

  // ── Derived ───────────────────────────────────────────────────────────────
  const storyList = Object.values(stories);
  const storiesForChar = (charId) => storyList.filter(s => s.charIds.includes(charId));
  const storiesForNode = (nodeId) => storyList.filter(s => s.nodeId === nodeId);
  const relsForChar = (charId) => Object.values(relationships).filter(r => r.charAId === charId || r.charBId === charId);

  const activeChar = characters[activeCharId];

  // ── Export/Import ─────────────────────────────────────────────────────────
  const openExport = () => {
    const roots = Object.keys(nodes).filter(id => getParents(nodes, id).length === 0);
    dispatch(uiActions.setExportRoots(roots));
    dispatch(uiActions.setExportMode("subtree"));
    dispatch(uiActions.setExportLabel(ws.title || "Exported Tree"));
    dispatch(uiActions.setModal("export"));
  };
  const doExport = () => {
    const nodeIds = exportMode === "all" ? new Set(Object.keys(nodes)) : collectSubtree(nodes, exportRoots);
    if (!nodeIds.size) { showToast("Nothing selected.", "err"); return; }
    const payload = buildExport(nodes, nodeIds, exportLabel || ws.title);
    const fname = (exportLabel || "tree").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".dtree.json";
    downloadJSON(payload, fname);
    dispatch(uiActions.setModal(null));
    showToast(`Exported ${payload.nodeCount} nodes → ${fname}`);
  };
  const handleImportFile = async (file) => {
    try {
      const text = await readFileAsText(file);
      const obj = JSON.parse(text);
      const err = validateImport(obj);
      if (err) { dispatch(uiActions.setImportError(err)); dispatch(uiActions.setImportPayload(null)); return; }
      dispatch(uiActions.setImportPayload(obj)); dispatch(uiActions.setImportError(null));
    } catch (e) { dispatch(uiActions.setImportError("Parse error: " + e.message)); dispatch(uiActions.setImportPayload(null)); }
  };
  const doImport = () => {
    if (!importPayload) return;
    const merged = mergeImport(nodes, importPayload);
    dispatch(workspacesActions.setNodes({ wsId: activeWsId, nodes: merged }));
    dispatch(uiActions.setModal(null));
    showToast(`Imported ${importPayload.nodeCount} nodes, ${importPayload.edgeCount} edges.`);
  };
  const handleWsImport = async (file) => {
    try {
      const text = await readFileAsText(file);
      const obj = JSON.parse(text);
      const err = validateImport(obj); if (err) { showToast(err, "err"); return; }
      const newWs = mkWorkspace(obj.label || "Imported", mergeImport({}, obj, 0, 0));
      dispatch(workspacesActions.importWorkspace(newWs));
      dispatch(uiActions.activateWorkspace(newWs.id));
      showToast(`Workspace "${newWs.title}" imported.`);
    } catch (e) { showToast("Import failed: " + e.message, "err"); }
  };
  const exportWorkspace = (wsId) => {
    const w = workspaces[wsId]; if (!w) return;
    const payload = buildExport(w.nodes, new Set(Object.keys(w.nodes)), w.title);
    const fname = (w.title || "workspace").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".dtree.json";
    downloadJSON(payload, fname); showToast(`Workspace saved → ${fname}`);
  };

  if (!ws) return <div style={{ color: T.textPrimary, padding: 40 }}>No workspace found.</div>;

  return (
    <div style={{ width: "100%", height: "100vh", background: T.bgApp, fontFamily: T.fontSerif, color: T.textPrimary, overflow: "hidden", display: "flex", position: "relative" }}>
      <style>{CSS}</style>

      {/* ── Sidebar ── */}
      <div style={{ width: sidebarOpen ? 230 : 0, flexShrink: 0, overflow: "hidden", transition: "width 0.2s", background: T.bgSidebar, borderRight: `1px solid ${T.borderMid}`, display: "flex", flexDirection: "column", zIndex: 10 }}>
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #222018", flexShrink: 0 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 8 }}>WORKSPACES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <button className="btn btn-gold" style={{ width: "100%", fontSize: 10, padding: "5px 0" }} onClick={() => { dispatch(uiActions.setWsNameDraft("")); dispatch(uiActions.setModal("newws")); }}>+ New Workspace</button>
            <button className="btn btn-ghost" style={{ width: "100%", fontSize: 10, padding: "5px 0" }} onClick={() => wsImportRef.current.click()}>↑ Load File</button>
            <input ref={wsImportRef} type="file" accept=".json,.dtree.json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleWsImport(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {Object.values(workspaces).map(w => {
            const lastEdit = Object.values(w.nodes || {}).reduce((latest, n) => n.editedAt > latest ? n.editedAt : latest, "");
            return (
              <div key={w.id} style={{ padding: "9px 12px", cursor: "pointer", background: w.id === activeWsId ? "#24201a" : "transparent", borderLeft: w.id === activeWsId ? `2px solid ${T.gold}` : "2px solid transparent", transition: "background 0.1s" }}
                onClick={() => dispatch(uiActions.setActiveWsId(w.id))}>
                <div style={{ fontFamily: T.fontSerif, fontSize: 13, color: w.id === activeWsId ? T.textPrimary : T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDeep, marginTop: 2 }}>
                  {Object.keys(w.nodes).length}n · {Object.keys(w.characters || {}).length}c · {Object.keys(w.stories || {}).length}s{w.settings?.autosave ? " · auto" : ""}
                </div>
                {lastEdit && <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textInvis, marginTop: 2 }}>{formatDate(lastEdit)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: `1px solid ${T.borderMid}`, background: T.bgPanel, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: "5px 8px", fontSize: 14, lineHeight: 1 }} onClick={() => dispatch(uiActions.setSidebarOpen(!sidebarOpen))}>☰</button>
          <span style={{ fontFamily: T.fontSerif, fontSize: 18, fontWeight: 600, color: T.gold, letterSpacing: "0.02em" }}>◈ {ws.title}</span>
          <div style={{ flex: 1 }} />
          <button className="tab-btn" style={view === "overview" ? { color: T.gold, borderBottom: `2px solid ${T.gold}` } : {}} onClick={goOverview}>OVERVIEW</button>
          {selectedNodeId && nodes[selectedNodeId] && (
            <button className="tab-btn" style={view === "bubble" ? { color: T.gold, borderBottom: `2px solid ${T.gold}` } : {}} onClick={() => dispatch(uiActions.setView("bubble"))}>↳ {nodes[selectedNodeId].title.slice(0, 20)}</button>
          )}
          <button className="tab-btn" style={(view === "characters" || view === "charsheet") ? { color: T.gold, borderBottom: `2px solid ${T.gold}` } : {}} onClick={() => dispatch(uiActions.setView("characters"))}>CHARACTERS</button>
          <div style={{ width: 1, height: 18, background: T.borderStrong, margin: "0 2px" }} />
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => dispatch(uiActions.setModal("settings"))}>⚙ Settings</button>
          {(view === "overview" || view === "bubble") && <button className="btn btn-gold" style={{ fontSize: 11 }} onClick={() => { addNode(); }}>+ Node</button>}
          {(view === "characters" || view === "charsheet") && <button className="btn btn-gold" style={{ fontSize: 11 }} onClick={addCharacter}>+ Character</button>}
        </div>

        {/* Content router */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {view === "overview" && (
            <OverviewCanvas nodes={nodes} setNodes={setNodes}
              onOpenBubble={openBubble} onToggleConnect={toggleConnect}
              onDisconnect={disconnectNodes} onDeleteNodes={deleteNodes}
              onUpdateNode={updateNode} showToast={showToast} />
          )}
          {view === "bubble" && selectedNodeId && nodes[selectedNodeId] && (
            <BubbleView
              node={nodes[selectedNodeId]} nodes={nodes}
              stories={storiesForNode(selectedNodeId)} allStories={stories} characters={characters}
              editingId={editingNodeId} setEditingId={(id) => dispatch(uiActions.setEditingNodeId(id))}
              onUpdate={updateNode} onDelete={deleteNode}
              onOpenBubble={openBubble}
              onAddChild={(pid) => { const id = addNode(pid); openBubble(id); dispatch(uiActions.setEditingNodeId(id)); }}
              onDisconnect={disconnectNodes}
              onOpenStory={(s) => dispatch(uiActions.setStoryModal({ mode: "edit", storyId: s.id }))}
              onNewStory={() => dispatch(uiActions.setStoryModal({ mode: "new", defaults: { nodeId: selectedNodeId } }))}
              onOpenChar={(id) => { dispatch(uiActions.setActiveCharId(id)); dispatch(uiActions.setView("charsheet")); }}
            />
          )}
          {view === "bubble" && (!selectedNodeId || !nodes[selectedNodeId]) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.textDeep }}>Node not found</div>
          )}
          {view === "characters" && (
            <CharactersGallery characters={characters} stories={stories}
              onSelect={(id) => { dispatch(uiActions.setActiveCharId(id)); dispatch(uiActions.setView("charsheet")); }}
              onAdd={addCharacter} onDelete={deleteCharacter} />
          )}
          {view === "charsheet" && activeChar && (
            <CharacterSheet
              character={activeChar}
              stories={storiesForChar(activeChar.id)} allStories={stories}
              nodes={nodes} characters={characters}
              relationships={relsForChar(activeChar.id)} allRelationships={relationships}
              onUpdate={(fields) => updateCharacter(activeChar.id, fields)}
              onDelete={() => deleteCharacter(activeChar.id)}
              onBack={() => dispatch(uiActions.setView("characters"))}
              onNewStory={(defaults) => dispatch(uiActions.setStoryModal({ mode: "new", defaults: { charIds: [activeChar.id], ...defaults } }))}
              onEditStory={(s) => dispatch(uiActions.setStoryModal({ mode: "edit", storyId: s.id }))}
              onDeleteStory={(storyId) => dispatch(uiActions.setDeleteStoryModal({ storyId, fromCharId: activeChar.id }))}
              onOpenNode={(nid) => openBubble(nid)}
              onOpenChar={(id) => dispatch(uiActions.setActiveCharId(id))}
              onAddRelationship={(targetId) => addRelationship(activeChar.id, targetId)}
              onUpdateRelationship={updateRelationship}
              onDeleteRelationship={deleteRelationship}
            />
          )}
        </div>
      </div>

      {/* ── Story Editor Modal ── */}
      {storyModal && (
        <StoryEditorModal
          mode={storyModal.mode}
          story={storyModal.storyId ? stories[storyModal.storyId] : null}
          defaults={storyModal.defaults || {}}
          characters={characters} nodes={nodes}
          onSave={(data) => { saveStory(data); dispatch(uiActions.setStoryModal(null)); showToast(storyModal.mode === "new" ? "Story created." : "Story saved."); }}
          onCreate={(opts) => { const s = createStory(opts); dispatch(uiActions.setStoryModal({ mode: "edit", storyId: s.id })); }}
          onClose={() => dispatch(uiActions.setStoryModal(null))}
        />
      )}

      {/* ── Delete Story Modal ── */}
      {deleteStoryModal && (
        <div className="modal-backdrop" onClick={() => dispatch(uiActions.setDeleteStoryModal(null))}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 380, maxWidth: 440 }}>
            <div className="modal-title">Remove Story Event</div>
            <p style={{ fontFamily: T.fontSerif, fontSize: 15, color: T.textMuted, marginBottom: 20 }}>
              How would you like to remove <strong style={{ color: T.textPrimary }}>{stories[deleteStoryModal.storyId]?.title || "this story"}</strong>?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn btn-ghost" style={{ textAlign: "left", padding: "10px 14px" }} onClick={() => deleteStory(deleteStoryModal.storyId, "this", deleteStoryModal.fromCharId)}>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textBody }}>Remove from this character only</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, marginTop: 2 }}>Other characters and the node link are preserved</div>
              </button>
              <button className="btn btn-danger" style={{ textAlign: "left", padding: "10px 14px" }} onClick={() => deleteStory(deleteStoryModal.storyId, "all")}>
                <div style={{ fontFamily: T.fontMono, fontSize: 11 }}>Delete story everywhere</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.redBorder, marginTop: 2 }}>Removes from all characters and unlinks from any node</div>
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => dispatch(uiActions.setDeleteStoryModal(null))}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {modal === "settings" && (
        <div className="modal-backdrop" onClick={() => dispatch(uiActions.setModal(null))}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 480 }}>
            <div className="modal-title">Workspace Settings</div>
            <div className="modal-section">
              <div className="modal-label">WORKSPACE NAME</div>
              <input type="text" className="inline-input" defaultValue={ws.title}
                onBlur={e => { const v = e.target.value.trim(); if (v) updateWs(activeWsId, { title: v }); }}
                onKeyDown={e => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) updateWs(activeWsId, { title: v }); } }} />
            </div>
            <div className="modal-section">
              <div className="modal-label">AUTOSAVE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="toggle-wrap" onClick={() => updateWs(activeWsId, { settings: { ...settings, autosave: !settings.autosave } })}>
                  <div className={`toggle${settings.autosave ? " on" : ""}`}><div className="toggle-knob" /></div>
                </div>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: settings.autosave ? T.greenBright : T.textFaint }}>
                  {settings.autosave ? "Enabled — saves on every change" : "Disabled"}
                </span>
              </div>
            </div>
            <div className="modal-section">
              <div className="modal-label">DATA</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => dispatch(uiActions.setModal("import"))}>↑ Import nodes</button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { dispatch(uiActions.setModal(null)); setTimeout(openExport, 50); }}>↓ Export nodes</button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => exportWorkspace(activeWsId)}>↓ Save workspace</button>
              </div>
            </div>
            <div className="modal-section">
              <div className="modal-label" style={{ color: T.redBorder }}>DANGER ZONE</div>
              {Object.keys(workspaces).length > 1 && (
                <button className="btn btn-danger" style={{ fontSize: 11 }} onClick={() => {
                  if (confirm(`Delete workspace "${ws.title}"? This cannot be undone.`)) deleteWs(activeWsId);
                }}>Delete this workspace</button>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-gold" onClick={() => dispatch(uiActions.setModal(null))}>Done</button></div>
          </div>
        </div>
      )}

      {/* ── New Workspace Modal ── */}
      {modal === "newws" && (
        <div className="modal-backdrop" onClick={() => dispatch(uiActions.setModal(null))}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 360, maxWidth: 420 }}>
            <div className="modal-title">New Workspace</div>
            <div className="modal-section">
              <div className="modal-label">NAME</div>
              <input type="text" className="inline-input" autoFocus value={wsNameDraft}
                onChange={e => dispatch(uiActions.setWsNameDraft(e.target.value))}
                onKeyDown={e => { if (e.key === "Enter" && wsNameDraft.trim()) createWorkspace(wsNameDraft.trim()); }}
                placeholder="Workspace name…" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => dispatch(uiActions.setModal(null))}>Cancel</button>
              <button className="btn btn-gold" onClick={() => { if (!wsNameDraft.trim()) return; createWorkspace(wsNameDraft.trim()); }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {modal === "export" && (
        <div className="modal-backdrop" onClick={() => dispatch(uiActions.setModal(null))}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Export Nodes</div>
            <div className="modal-section">
              <div className="modal-label">EXPORT LABEL</div>
              <input type="text" className="inline-input" value={exportLabel} onChange={e => dispatch(uiActions.setExportLabel(e.target.value))} placeholder="Label…" />
            </div>
            <div className="modal-section">
              <div className="modal-label">SCOPE</div>
              {[{ id: "all", text: "All nodes", sub: `${Object.keys(nodes).length} nodes total` }, { id: "subtree", text: "Selected roots + subtrees", sub: "Choose below" }].map(o => (
                <div key={o.id} className="radio-row" onClick={() => dispatch(uiActions.setExportMode(o.id))}>
                  <div className={`radio-dot${exportMode === o.id ? " active" : ""}`} />
                  <div><div className="radio-label" style={{ color: T.textBody }}>{o.text}</div><div className="radio-label" style={{ fontSize: 9, color: T.textGhost, marginTop: 1 }}>{o.sub}</div></div>
                </div>
              ))}
            </div>
            {exportMode === "subtree" && (
              <div className="modal-section">
                <div className="modal-label" style={{ marginBottom: 6 }}>ROOT NODES</div>
                <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${T.borderMid}`, borderRadius: 5, padding: "4px 0" }}>
                  {Object.values(nodes).map(n => {
                    const isRoot = getParents(nodes, n.id).length === 0;
                    const checked = exportRoots.includes(n.id);
                    const sz = collectSubtree(nodes, [n.id]).size;
                    const gc = getGlowColor(n.color);
                    return (
                      <div key={n.id} className="node-picker-row" onClick={() => {
                        const next = checked ? exportRoots.filter(r => r !== n.id) : [...exportRoots, n.id];
                        dispatch(uiActions.setExportRoots(next));
                      }}>
                        <div className={`node-picker-check${checked ? " checked" : ""}`}>{checked ? "✓" : ""}</div>
                        {gc.glow && <div style={{ width: 7, height: 7, borderRadius: "50%", background: gc.glow, flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0, fontFamily: T.fontSerif, fontSize: 13, color: T.textBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, flexShrink: 0 }}>{sz}n{isRoot ? <span style={{ color: "#c9a96e88", marginLeft: 4 }}>root</span> : ""}</div>
                      </div>
                    );
                  })}
                </div>
                {exportRoots.length > 0 && <div style={{ fontFamily: T.fontMono, fontSize: 10, color: "#7a9060", marginTop: 6 }}>→ {collectSubtree(nodes, exportRoots).size} nodes will export</div>}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => dispatch(uiActions.setModal(null))}>Cancel</button>
              <button className="btn btn-green" onClick={doExport}>↓ Download .dtree.json</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {modal === "import" && (
        <div className="modal-backdrop" onClick={() => dispatch(uiActions.setModal(null))}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Import Nodes</div>
            <div className="modal-section">
              <div className="modal-label">DROP OR SELECT A .DTREE.JSON FILE</div>
              <div className={`drop-zone${importDragOver ? " drag-over" : ""}`} onClick={() => importFileRef.current.click()}
                onDragOver={e => { e.preventDefault(); dispatch(uiActions.setImportDragOver(true)); }}
                onDragLeave={() => dispatch(uiActions.setImportDragOver(false))}
                onDrop={e => { e.preventDefault(); dispatch(uiActions.setImportDragOver(false)); if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]); }}>
                <div style={{ fontSize: 26, marginBottom: 6, opacity: 0.35 }}>↑</div>
                <div style={{ fontFamily: T.fontSerif, fontSize: 14, color: "#7a7060" }}>Drop file or click to browse</div>
              </div>
              <input ref={importFileRef} type="file" accept=".json,.dtree.json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleImportFile(e.target.files[0]); e.target.value = ""; }} />
            </div>
            {importError && <div className="import-error">⚠ {importError}</div>}
            {importPayload && !importError && (
              <div className="import-preview">
                <div style={{ fontFamily: T.fontSerif, fontSize: 15, color: T.gold, marginBottom: 8 }}>{importPayload.label || "Untitled"}</div>
                <div className="import-meta">
                  <div className="import-meta-item"><span className="import-meta-label">Nodes: </span><span className="import-meta-val">{importPayload.nodeCount}</span></div>
                  <div className="import-meta-item"><span className="import-meta-label">Edges: </span><span className="import-meta-val">{importPayload.edgeCount}</span></div>
                </div>
                <div className="import-node-list">{importPayload.nodes.map(n => <div key={n.id} className="import-node-item">{n.title}<span style={{ color: T.textDeep, fontSize: 11 }}> — {n.type}</span></div>)}</div>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => dispatch(uiActions.setModal(null))}>Cancel</button>
              <button className="btn btn-green" disabled={!importPayload || !!importError} style={{ opacity: (!importPayload || importError) ? 0.4 : 1 }} onClick={doImport}>↑ Import to Canvas</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORY EDITOR MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function StoryEditorModal({ mode, story, defaults, characters, nodes, onSave, onCreate, onClose }) {
  const isNew = mode === "new" && !story;
  const [step, setStep] = useState(isNew ? "pick" : "edit");
  const [draft, setDraft] = useState(() => {
    if (story) return { ...story };
    return mkStory({ ...defaults, useTemplate: false });
  });
  const [bodyTab, setBodyTab] = useState("edit");

  const handleStartWithTemplate = (tmpl) => {
    const s = { ...draft, body: tmpl ? STORY_TEMPLATE_BODY : "", id: draft.id };
    setDraft(s); setStep("edit");
  };
  const setF = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const toggleChar = (cid) => setDraft(d => ({ ...d, charIds: d.charIds.includes(cid) ? d.charIds.filter(x => x !== cid) : [...d.charIds, cid] }));

  const charList = Object.values(characters);
  const nodeList = Object.values(nodes);

  if (step === "pick") {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 500 }}>
          <div className="modal-title">New Story Event</div>
          <p style={{ fontFamily: T.fontSerif, fontSize: 15, color: T.textMuted, marginBottom: 20 }}>Start with a template or a blank page?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ border: `1px solid ${T.borderStrong}`, borderRadius: 8, padding: "16px", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a96e60"} onMouseLeave={e => e.currentTarget.style.borderColor = T.borderStrong}
              onClick={() => handleStartWithTemplate(true)}>
              <div style={{ fontFamily: T.fontSerif, fontSize: 16, color: "#e0d8c8", marginBottom: 4 }}>Use Template</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost }}>Pre-fills sections: What Happened, Impact, Consequences, Reflections</div>
            </div>
            <div style={{ border: `1px solid ${T.borderStrong}`, borderRadius: 8, padding: "16px", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a96e60"} onMouseLeave={e => e.currentTarget.style.borderColor = T.borderStrong}
              onClick={() => handleStartWithTemplate(false)}>
              <div style={{ fontFamily: T.fontSerif, fontSize: 16, color: "#e0d8c8", marginBottom: 4 }}>Blank Page</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost }}>Start with an empty body</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 620, maxWidth: 760, maxHeight: "88vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div className="modal-title" style={{ margin: 0, flex: 1 }}>{isNew ? "New Story Event" : "Edit Story Event"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-gold" onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}>Save</button>
          </div>
        </div>
        <div className="modal-section">
          <div className="modal-label">TITLE</div>
          <input type="text" className="inline-input" value={draft.title} onChange={e => setF("title", e.target.value)} placeholder="Name this story event…" style={{ fontSize: 18, fontFamily: T.fontSerif }} />
        </div>
        <div className="modal-section">
          <div className="modal-label">CHARACTERS INVOLVED</div>
          {charList.length === 0
            ? <div style={{ fontFamily: T.fontSerif, fontSize: 13, color: T.textDeep, fontStyle: "italic" }}>No characters in this workspace yet.</div>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {charList.map(ch => {
                const sel = draft.charIds.includes(ch.id);
                return (
                  <div key={ch.id} onClick={() => toggleChar(ch.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, border: `1px solid ${sel ? T.gold : T.borderStrong}`, background: sel ? "#c9a96e18" : "transparent", cursor: "pointer", transition: "all 0.13s" }}>
                    {ch.portrait && <img src={ch.portrait} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />}
                    <span style={{ fontFamily: T.fontSerif, fontSize: 13, color: sel ? T.gold : T.textDim }}>{ch.name || "Unnamed"}</span>
                  </div>
                );
              })}
            </div>
          }
        </div>
        <div className="modal-section">
          <div className="modal-label">LINKED STORY NODE <span style={{ color: T.textDeep }}>(optional)</span></div>
          <select value={draft.nodeId || ""} onChange={e => setF("nodeId", e.target.value || null)}
            style={{ background: T.bgInput, border: `1px solid ${T.borderStrong}`, color: T.textBody, fontFamily: T.fontSerif, fontSize: 14, padding: "7px 10px", borderRadius: 4, outline: "none", width: "100%" }}>
            <option value="">— No linked node —</option>
            {nodeList.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
        <div className="modal-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="modal-label" style={{ margin: 0 }}>NARRATIVE</div>
            <div style={{ display: "flex", gap: 0 }}>
              {["edit", "preview"].map(t => (
                <button key={t} className={`tab-btn${bodyTab === t ? " active" : ""}`} style={{ padding: "4px 12px", fontSize: 9 }} onClick={() => setBodyTab(t)}>{t.toUpperCase()}</button>
              ))}
            </div>
          </div>
          {bodyTab === "edit"
            ? <textarea className="md-editor" value={draft.body} rows={14} onChange={e => setF("body", e.target.value)} placeholder="Describe what happened…" />
            : <div style={{ background: T.bgInput, border: `1px solid ${T.borderMid}`, borderRadius: 4, padding: "14px 16px", minHeight: 200, maxHeight: 300, overflowY: "auto" }}>
              <div className="md-content"><ReactMarkdown>{draft.body}</ReactMarkdown></div>
            </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Compact story card ────────────────────────────────────────────────────────
function StoryCard({ story, characters, nodes, onEdit, onDelete, onOpenChar, onOpenNode, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const involvedChars = story.charIds.map(id => characters[id]).filter(Boolean);
  const linkedNode = story.nodeId ? nodes[story.nodeId] : null;
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.borderSub}`, borderRadius: 7, overflow: "hidden", marginBottom: 10, transition: "border-color 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#4a4030"} onMouseLeave={e => e.currentTarget.style.borderColor = T.borderSub}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ fontFamily: T.fontSerif, fontSize: 15, fontWeight: 600, color: "#d4ccbc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{story.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {involvedChars.slice(0, 4).map((ch, i) => (
            <div key={ch.id} style={{ width: 20, height: 20, borderRadius: "50%", overflow: "hidden", background: T.bgDeep, border: `1px solid ${T.borderStrong}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i === 0 ? 0 : -6 }} title={ch.name}>
              {ch.portrait ? <img src={ch.portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 9, opacity: 0.4 }}>⚔</span>}
            </div>
          ))}
          {involvedChars.length > 4 && <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost }}>+{involvedChars.length - 4}</span>}
          {linkedNode && <span style={{ fontFamily: T.fontMono, fontSize: 8, color: "#c9a96e80", border: "1px solid #c9a96e40", borderRadius: 3, padding: "1px 5px" }} title={linkedNode.title}>◈</span>}
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost, marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.borderMid}` }}>
          {story.body && (
            <div style={{ padding: "12px 14px", maxHeight: 260, overflowY: "auto" }}>
              <div className="md-content"><ReactMarkdown>{story.body}</ReactMarkdown></div>
            </div>
          )}
          <div style={{ padding: "8px 12px", borderTop: "1px solid #1e1c18", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {involvedChars.map(ch => (
              <button key={ch.id} className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }} onClick={() => onOpenChar && onOpenChar(ch.id)}>
                {ch.portrait && <img src={ch.portrait} alt="" style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />}
                {ch.name}
              </button>
            ))}
            {linkedNode && (
              <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 8px", color: "#c9a96e80" }} onClick={() => onOpenNode && onOpenNode(linkedNode.id)}>
                ◈ {linkedNode.title.slice(0, 24)}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textDeep }}>{formatDate(story.updatedAt)}</span>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 8px" }} onClick={() => onEdit && onEdit(story)}>Edit</button>
            <button className="btn btn-danger" style={{ fontSize: 9, padding: "2px 8px" }} onClick={() => onDelete && onDelete(story.id)}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW CANVAS  (canvas-local state stays as useState — pan, zoom, drag etc.)
// ═══════════════════════════════════════════════════════════════════════════════
const NODE_W = 230, NODE_H = 90;

function OverviewCanvas({ nodes, setNodes, onOpenBubble, onToggleConnect, onDisconnect, onDeleteNodes, onUpdateNode, showToast }) {
  const canvasRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [connectHoverTarget, setConnectHoverTarget] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [dragSelect, setDragSelect] = useState(null);

  const toCanvas = useCallback((cx, cy) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  }, [pan, zoom]);

  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { e.preventDefault(); setPanning({ startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y }); return; }
    if (e.button === 0 && !e.altKey) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const hit = Object.values(nodes).find(n => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H);
      if (!hit) { if (!e.shiftKey) setSelection(new Set()); setDragSelect({ startX: x, startY: y, curX: x, curY: y }); }
    }
  }, [pan, zoom, nodes, toCanvas]);

  const onMouseMove = useCallback((e) => {
    if (panning) { setPan({ x: panning.startPanX + e.clientX - panning.startX, y: panning.startPanY + e.clientY - panning.startY }); return; }
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom, dy = (e.clientY - dragging.startY) / zoom;
      setNodes(prev => { const u = { ...prev }; dragging.ids.forEach(id => { if (!u[id]) return; u[id] = { ...u[id], x: dragging.startPositions[id].x + dx, y: dragging.startPositions[id].y + dy }; }); return u; }); return;
    }
    if (connecting) {
      const r = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const target = Object.values(nodes).find(n => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H && n.id !== connecting.fromId);
      setConnecting(prev => ({ ...prev, mouseX: mx, mouseY: my })); setConnectHoverTarget(target ? target.id : null); return;
    }
    if (dragSelect) { const { x, y } = toCanvas(e.clientX, e.clientY); setDragSelect(prev => ({ ...prev, curX: x, curY: y })); }
  }, [panning, dragging, connecting, dragSelect, zoom, nodes, toCanvas]);

  const onMouseUp = useCallback((e) => {
    if (panning) { setPanning(null); return; }
    if (dragging) { setDragging(null); return; }
    if (connecting) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const target = Object.values(nodes).find(n => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H && n.id !== connecting.fromId);
      if (target) onToggleConnect(connecting.fromId, target.id);
      setConnecting(null); setConnectHoverTarget(null); return;
    }
    if (dragSelect) {
      const { startX, startY, curX, curY } = dragSelect;
      const rx = Math.min(startX, curX), ry = Math.min(startY, curY), rw = Math.abs(curX - startX), rh = Math.abs(curY - startY);
      if (rw > 4 || rh > 4) {
        const inRect = Object.values(nodes).filter(n => n.x + NODE_W > rx && n.x < rx + rw && n.y + NODE_H > ry && n.y < ry + rh);
        if (e.shiftKey) { setSelection(prev => { const s = new Set(prev); inRect.forEach(n => s.add(n.id)); return s; }); }
        else setSelection(new Set(inRect.map(n => n.id)));
      }
      setDragSelect(null);
    }
  }, [panning, dragging, connecting, dragSelect, nodes, toCanvas, onToggleConnect]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove); window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const onWheel = useCallback((e) => {
    e.preventDefault(); const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const r = canvasRef.current.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    setZoom(z => { const nz = Math.min(Math.max(z * factor, 0.2), 3); setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) })); return nz; });
  }, []);

  const startNodeDrag = (e, id) => {
    if (e.button !== 0 || e.altKey) return; e.stopPropagation();
    const ids = selection.has(id) ? [...selection] : [id];
    if (!selection.has(id)) setSelection(new Set([id]));
    const sp = {}; ids.forEach(i => { if (nodes[i]) sp[i] = { x: nodes[i].x, y: nodes[i].y }; });
    setDragging({ ids, startX: e.clientX, startY: e.clientY, startPositions: sp });
  };
  const startConnect = (e, fromId) => {
    e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect();
    setConnecting({ fromId, mouseX: e.clientX - r.left, mouseY: e.clientY - r.top });
  };
  const handleDeleteSelected = () => {
    if (!selection.size) return;
    if (confirm(`Delete ${selection.size} node${selection.size > 1 ? "s" : ""}? Cannot be undone.`)) { onDeleteNodes([...selection]); setSelection(new Set()); }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selection.size > 0) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        handleDeleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, handleDeleteSelected]);

  const edges = [];
  Object.values(nodes).forEach(n => {
    n.children.forEach(cid => {
      if (!nodes[cid]) return; const c = nodes[cid];
      const fromGlow = getGlowColor(n.color).glow || DEFAULT_EDGE; const toGlow = getGlowColor(c.color).glow || DEFAULT_EDGE;
      edges.push({ from: n.id, to: cid, x1: n.x + NODE_W / 2, y1: n.y + NODE_H, x2: c.x + NODE_W / 2, y2: c.y, gradId: `grad-${n.id}-${cid}`, fromGlow, toGlow });
    });
  });
  const highlightedEdgeKeys = new Set();
  if (hoveredNode) { edges.forEach(e => { if (e.from === hoveredNode || e.to === hoveredNode) highlightedEdgeKeys.add(e.gradId); }); }

  let dsRect = null;
  if (dragSelect) {
    const { startX, startY, curX, curY } = dragSelect;
    dsRect = { x: Math.min(startX, curX) * zoom + pan.x, y: Math.min(startY, curY) * zoom + pan.y, w: Math.abs(curX - startX) * zoom, h: Math.abs(curY - startY) * zoom };
  }

  return (
    <div ref={canvasRef} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", cursor: panning ? "grabbing" : connecting ? "crosshair" : dragSelect ? "crosshair" : "default" }}
      onMouseDown={onMouseDown} onWheel={onWheel}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs><pattern id="grid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (40 * zoom)} y={pan.y % (40 * zoom)}>
          <path d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`} fill="none" stroke="#252220" strokeWidth="0.5" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>{edges.map(e => (
          <linearGradient key={e.gradId} id={e.gradId} gradientUnits="userSpaceOnUse" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}>
            <stop offset="0%" stopColor={e.fromGlow} /><stop offset="100%" stopColor={e.toGlow} />
          </linearGradient>
        ))}</defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {edges.map(e => {
            const mx1 = e.x1, my1 = e.y1 + 30, mx2 = e.x2, my2 = e.y2 - 30;
            const isHovEdge = hoveredEdge && hoveredEdge.from === e.from && hoveredEdge.to === e.to;
            const isHighlit = highlightedEdgeKeys.has(e.gradId);
            const opacity = isHovEdge ? 1 : isHighlit ? 0.9 : 0.45; const sw = isHovEdge ? 2.5 : isHighlit ? 2 : 1.5;
            return (
              <g key={`${e.from}-${e.to}`}>
                <path d={`M${e.x1},${e.y1} C${mx1},${my1} ${mx2},${my2} ${e.x2},${e.y2}`} stroke="transparent" strokeWidth={14} fill="none" style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredEdge({ from: e.from, to: e.to })} onMouseLeave={() => setHoveredEdge(null)} onClick={() => onDisconnect(e.from, e.to)} />
                <path d={`M${e.x1},${e.y1} C${mx1},${my1} ${mx2},${my2} ${e.x2},${e.y2}`} stroke={isHovEdge ? T.red : `url(#${e.gradId})`} strokeWidth={sw} strokeDasharray={isHovEdge ? "5,4" : "none"} fill="none" strokeOpacity={opacity} style={{ pointerEvents: "none" }} />
                <circle cx={e.x2} cy={e.y2} r={3.5} fill={isHovEdge ? T.red : e.toGlow} opacity={opacity} style={{ pointerEvents: "none" }} />
              </g>
            );
          })}
          {connecting && (() => {
            const fn = nodes[connecting.fromId]; if (!fn) return null;
            const sx = fn.x + NODE_W / 2, sy = fn.y + NODE_H;
            const ex = (connecting.mouseX - pan.x) / zoom, ey = (connecting.mouseY - pan.y) / zoom;
            const wouldDisc = connectHoverTarget && nodes[connecting.fromId]?.children.includes(connectHoverTarget);
            return (<path d={`M${sx},${sy} C${sx},${sy + 50} ${ex},${ey - 50} ${ex},${ey}`} stroke={wouldDisc ? T.red : T.gold} strokeWidth={1.5} strokeDasharray="6,4" fill="none" opacity={0.85} style={{ pointerEvents: "none" }} />);
          })()}
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
        {Object.values(nodes).map(node => {
          const gc = getGlowColor(node.color); const isSelected = selection.has(node.id);
          const gBorder = gc.glow ? `${gc.glow}70` : T.borderStrong;
          const gShadow = gc.glow ? `0 0 18px ${gc.glow}40,0 0 36px ${gc.glow}18,0 4px 20px #00000070` : "0 4px 16px #00000060";
          const isTarget = connectHoverTarget === node.id;
          const wouldDisc = connecting && isTarget && nodes[connecting.fromId]?.children.includes(node.id);
          const title32 = node.title.length > 32 ? node.title.slice(0, 31) + "…" : node.title;
          return (
            <div key={node.id} className="node-card" style={{ position: "absolute", left: node.x, top: node.y, width: NODE_W, userSelect: "none" }}
              onMouseDown={e => startNodeDrag(e, node.id)} onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)}>
              <div className="node-inner" style={{ background: T.bgCard, border: `1.5px solid ${isTarget ? (wouldDisc ? T.red : T.gold) : isSelected ? T.gold : gBorder}`, borderRadius: 8, boxShadow: isTarget ? `0 0 20px #c9a96e60` : isSelected ? `0 0 0 2px #c9a96e80,0 4px 20px #00000070` : gShadow, overflow: "hidden", transition: "box-shadow 0.15s,border-color 0.12s" }}>
                {gc.glow && <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${gc.glow}80,transparent)` }} />}
                <div style={{ display: "flex" }}>
                  <div style={{ width: 60, flexShrink: 0, background: T.bgSurface, borderRight: `1px solid ${isSelected ? T.gold : gBorder}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
                    {node.icon ? <img src={node.icon} alt="" style={{ width: 42, height: 42, borderRadius: 5, objectFit: "cover" }} />
                      : <div style={{ width: 42, height: 42, borderRadius: 5, background: T.bgDeep, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {gc.glow ? <div style={{ width: 14, height: 14, borderRadius: "50%", background: gc.glow, opacity: 0.45 }} /> : <span style={{ fontSize: 16, opacity: 0.15, color: T.gold }}>◈</span>}
                      </div>}
                  </div>
                  <div style={{ flex: 1, padding: "7px 9px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, gap: 2 }}>
                    <div style={{ fontFamily: T.fontSerif, fontSize: 13, fontWeight: 600, color: "#d4ccbc", lineHeight: 1.25, wordBreak: "break-word", maxHeight: 36, overflow: "hidden" }}>{title32}</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 8.5, color: "#524a40" }}>{node.type}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px", flex: 1 }} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onOpenBubble(node.id); }}>Open</button>
                      <button className="connect-btn btn btn-ghost" style={{ fontSize: 9, padding: "2px 6px" }} onMouseDown={e => { e.stopPropagation(); startConnect(e, node.id); }}>⇝</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {dsRect && <div style={{ position: "absolute", left: dsRect.x, top: dsRect.y, width: dsRect.w, height: dsRect.h, border: `1px solid ${T.goldActive}`, background: T.selectRect, pointerEvents: "none", borderRadius: 2 }} />}
      {selection.size > 0 && !dragging && (
        <div onMouseDown={e => e.stopPropagation()} style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, background: T.bgCard, border: `1px solid #4a4030`, borderRadius: 6, padding: "6px 14px", boxShadow: "0 4px 20px #00000080", zIndex: 20 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textDim }}>{selection.size} selected</span>
          <div style={{ width: 1, height: 14, background: T.borderStrong }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {GLOW_COLORS.map(col => {
              const allMatch = [...selection].every(id => nodes[id]?.color === (col.id));
              return (
                <div key={col.id} title={col.label}
                  style={{ width: 14, height: 14, borderRadius: "50%", background: col.glow || T.bgDeep, border: `2px solid ${allMatch ? "#fff" : col.glow ? col.glow + "55" : T.borderStrong}`, cursor: "pointer", flexShrink: 0, transition: "transform 0.12s,border-color 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  onClick={() => { setNodes(prev => { const u = { ...prev }; [...selection].forEach(id => { if (u[id]) u[id] = { ...u[id], color: col.id, editedAt: new Date().toISOString() }; }); return u; }); }} />
              );
            })}
          </div>
          <div style={{ width: 1, height: 14, background: T.borderStrong }} />
          <button className="btn btn-danger" style={{ fontSize: 10, padding: "3px 8px" }} onClick={handleDeleteSelected}>Delete {selection.size}</button>
        </div>
      )}
      <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        <button className="btn btn-ghost" onClick={() => setZoom(z => Math.min(z * 1.2, 3))} style={{ padding: "6px 10px" }}>+</button>
        <button className="btn btn-ghost" onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))} style={{ padding: "6px 10px" }}>−</button>
        <button className="btn btn-ghost" onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }} style={{ padding: "6px 10px" }}>⊙</button>
      </div>
      <div style={{ position: "absolute", bottom: 16, left: 16, fontFamily: T.fontMono, fontSize: 10, color: T.textTiny }}>scroll zoom · alt+drag pan · drag-select · ⇝ connect</div>
      {hoveredEdge && <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", fontFamily: T.fontMono, fontSize: 10, color: T.red, background: T.bgApp, border: "1px solid #6a3030", padding: "4px 14px", borderRadius: 3, pointerEvents: "none" }}>click edge to disconnect</div>}
      {connecting && connectHoverTarget && (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", fontFamily: T.fontMono, fontSize: 10, background: T.bgApp, border: `1px solid ${nodes[connecting.fromId]?.children.includes(connectHoverTarget) ? T.redBorder : "#4a6030"}`, color: nodes[connecting.fromId]?.children.includes(connectHoverTarget) ? T.red : "#90c060", padding: "4px 14px", borderRadius: 3, pointerEvents: "none" }}>
          {nodes[connecting.fromId]?.children.includes(connectHoverTarget) ? "release to disconnect" : "release to connect"}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUBBLE VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function BubbleView({ node, nodes, stories, allStories, characters, editingId, setEditingId, onUpdate, onDelete, onOpenBubble, onAddChild, onDisconnect, onOpenStory, onNewStory, onOpenChar }) {
  const isEditing = editingId === node.id;
  const [draft, setDraft] = useState({ title: node.title, body: node.body, type: node.type });
  const [activeTab, setActiveTab] = useState("content");
  const iconRef = useRef(null), imgRef = useRef(null);
  const gc = getGlowColor(node.color);
  const parents = getParents(nodes, node.id);
  const children = node.children.map(c => nodes[c]).filter(Boolean);

  useEffect(() => { setDraft({ title: node.title, body: node.body, type: node.type }); }, [node.id]);
  useEffect(() => { if (!isEditing && activeTab === "stories") { } else if (!isEditing) { setActiveTab("content"); } }, [isEditing]);

  const save = () => { onUpdate(node.id, draft); setEditingId(null); };
  const cancel = () => { setDraft({ title: node.title, body: node.body, type: node.type }); setEditingId(null); };
  const handleIconUpload = async (e) => { const f = e.target.files[0]; if (!f) return; onUpdate(node.id, { icon: await readFileAsDataURL(f) }); e.target.value = ""; };
  const handleImgsUpload = async (e) => { const fs = Array.from(e.target.files); if (!fs.length) return; const urls = await Promise.all(fs.map(readFileAsDataURL)); onUpdate(node.id, { images: [...(node.images || []), ...urls] }); e.target.value = ""; };
  const removeImg = (i) => { const a = [...(node.images || [])]; a.splice(i, 1); onUpdate(node.id, { images: a }); };
  const imgCount = (node.images || []).length;
  const storyCount = stories.length;

  const tabs = [
    { id: "content", label: "CONTENT" },
    { id: "images", label: `IMAGES${imgCount ? ` (${imgCount})` : ""}` },
    { id: "stories", label: `STORIES${storyCount ? ` (${storyCount})` : ""}` },
  ];

  return (
    <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 32px 0", borderBottom: `1px solid ${T.borderMid}`, flexShrink: 0, background: T.bgPanel, borderTop: gc.glow ? `2px solid ${gc.glow}50` : "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
          <div className="icon-wrap" style={{ flexShrink: 0, position: "relative", cursor: "pointer", width: 56, height: 56 }} onClick={() => iconRef.current.click()}>
            <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: `1px solid ${gc.glow ? gc.glow + "55" : T.borderStrong}`, background: T.bgApp, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: gc.glow ? `0 0 12px ${gc.glow}30` : "none" }}>
              {node.icon ? <img src={node.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24, opacity: 0.2, color: T.gold }}>◈</span>}
            </div>
            <div className="icon-hover-overlay">ICON</div>
            <input ref={iconRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIconUpload} />
          </div>
          {isEditing
            ? <input className="field-input" value={draft.title} maxLength={32} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={{ fontSize: 22, fontWeight: 600, flex: 1, borderColor: gc.glow ? gc.glow + "50" : undefined }} />
            : <h1 style={{ margin: 0, fontFamily: T.fontSerif, fontSize: 26, fontWeight: 600, color: T.textPrimary, flex: 1, lineHeight: 1.2, paddingTop: 4 }}>{node.title}</h1>
          }
          <div style={{ display: "flex", gap: 6, flexShrink: 0, paddingTop: 2 }}>
            {isEditing
              ? <><button className="btn btn-gold" onClick={save}>Save</button><button className="btn btn-ghost" onClick={cancel}>Cancel</button></>
              : <><button className="btn btn-ghost" onClick={() => { setActiveTab("content"); setEditingId(node.id); }}>Edit</button><button className="btn btn-danger" onClick={() => { if (confirm("Delete this node?")) onDelete(node.id); }}>Delete</button></>
            }
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
          {isEditing
            ? <><span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textFaint }}>Type:</span>
              <input className="field-input" value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} style={{ width: 160, padding: "4px 8px", fontSize: 12 }} /></>
            : <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textDim }}>{node.type}</span>
          }
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textDeep }}>edited {formatDate(node.editedAt)}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto" }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDeep, letterSpacing: "0.1em" }}>GLOW</span>
            {GLOW_COLORS.map(col => (
              <div key={col.id} className={`color-swatch${node.color === col.id ? " selected" : ""}`}
                style={{ background: col.glow || "#2c2820", borderColor: node.color === col.id ? "#fff" : (col.glow ? col.glow + "55" : T.borderStrong), width: 17, height: 17 }}
                title={col.label} onClick={() => onUpdate(node.id, { color: col.id })} />
            ))}
            {node.icon && <button className="btn btn-danger" style={{ padding: "2px 8px", fontSize: 9, marginLeft: 2 }} onClick={() => onUpdate(node.id, { icon: null })}>✕ icon</button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`}
              onClick={() => { if (!isEditing || t.id !== "content") setEditingId(null); setActiveTab(t.id); }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 32px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {activeTab === "stories" && (
            <div style={{ padding: "24px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost, letterSpacing: "0.1em" }}>CHARACTER STORIES</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textInvis, marginTop: 2 }}>Development events linked to this node</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={onNewStory}>+ Link Story Event</button>
              </div>
              {storyCount === 0
                ? <div style={{ border: "1px dashed #2a2520", borderRadius: 8, padding: "40px 0", textAlign: "center", cursor: "pointer" }} onClick={onNewStory}>
                  <div style={{ fontFamily: T.fontSerif, fontSize: 16, color: T.textInvis, marginBottom: 4 }}>No character stories linked</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: "#2e2c28" }}>Click to create one</div>
                </div>
                : stories.map(s => (
                  <StoryCard key={s.id} story={s} characters={characters} nodes={nodes}
                    onEdit={onOpenStory} onDelete={(id) => onOpenStory({ id, _deleteFromNode: true })}
                    onOpenChar={onOpenChar} onOpenNode={null} />
                ))
              }
            </div>
          )}
          {activeTab === "images" && (
            <div style={{ padding: "24px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textGhost, letterSpacing: "0.1em" }}>EMBEDDED IMAGES</span>
                <button className="btn btn-ghost" onClick={() => imgRef.current.click()}>+ Upload</button>
                <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImgsUpload} />
              </div>
              {imgCount === 0
                ? <div style={{ border: "1px dashed #3a3530", borderRadius: 8, padding: "60px 0", textAlign: "center", color: T.textDeep, cursor: "pointer", fontFamily: T.fontSerif, fontSize: 15 }} onClick={() => imgRef.current.click()}>Click to upload images</div>
                : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                  {(node.images || []).map((src, i) => (
                    <div key={i} className="image-thumb">
                      <img src={src} alt="" style={{ width: "100%", display: "block", borderRadius: 6, border: `1px solid ${T.borderStrong}`, objectFit: "cover", maxHeight: 180 }} />
                      <button className="img-remove" onClick={() => removeImg(i)}>✕</button>
                    </div>
                  ))}
                  <div style={{ border: "1px dashed #3a3530", borderRadius: 6, minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textDeep, fontSize: 28 }} onClick={() => imgRef.current.click()}>+</div>
                </div>
              }
            </div>
          )}
          {activeTab === "content" && (
            <div style={{ padding: "24px 0" }}>
              {isEditing
                ? <textarea className="md-editor" value={draft.body} rows={18} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                : <>
                  <div className="md-content"><ReactMarkdown>{node.body}</ReactMarkdown></div>
                  {imgCount > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDeep, letterSpacing: "0.1em", marginBottom: 10 }}>IMAGES</div>
                      {(node.images || []).map((src, i) => <img key={i} src={src} alt="" style={{ maxWidth: "100%", display: "block", borderRadius: 6, marginBottom: 12, border: `1px solid ${T.borderStrong}` }} />)}
                    </div>
                  )}
                </>
              }
            </div>
          )}
          {activeTab !== "stories" && (<>
            <div style={{ height: 1, background: T.borderMid, margin: "0 0 24px" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 10 }}>↑ PARENT NODES</div>
                {parents.length === 0
                  ? <div style={{ color: T.textDeep, fontSize: 13, fontStyle: "italic" }}>No parents — root node</div>
                  : parents.map(p => <NavCard key={p.id} node={p} onClick={() => onOpenBubble(p.id)} action={<button className="btn btn-danger" style={{ padding: "2px 8px", fontSize: 9 }} onClick={e => { e.stopPropagation(); onDisconnect(p.id, node.id); }}>✕</button>} />)
                }
              </div>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 10 }}>↓ CHILD NODES</div>
                {children.map(c => <NavCard key={c.id} node={c} onClick={() => onOpenBubble(c.id)} action={<button className="btn btn-danger" style={{ padding: "2px 8px", fontSize: 9 }} onClick={e => { e.stopPropagation(); onDisconnect(node.id, c.id); }}>✕</button>} />)}
                <button className="btn btn-ghost" style={{ width: "100%", marginTop: 6, padding: "7px 0" }} onClick={() => onAddChild(node.id)}>+ Add child node</button>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

function NavCard({ node, onClick, action }) {
  const gc = getGlowColor(node.color);
  return (
    <div onClick={onClick}
      style={{ background: "#201e19", border: `1px solid ${gc.glow ? gc.glow + "35" : T.borderMid}`, borderRadius: 5, padding: "8px 10px", marginBottom: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.15s,box-shadow 0.15s", boxShadow: gc.glow ? `0 0 8px ${gc.glow}15` : "none" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = gc.glow ? gc.glow + "70" : "#4a4040"; e.currentTarget.style.boxShadow = gc.glow ? `0 0 14px ${gc.glow}30` : "none"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = gc.glow ? gc.glow + "35" : T.borderMid; e.currentTarget.style.boxShadow = gc.glow ? `0 0 8px ${gc.glow}15` : "none"; }}>
      {node.icon ? <img src={node.icon} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
        : gc.glow ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: gc.glow, flexShrink: 0, opacity: 0.6 }} /> : null}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontFamily: T.fontSerif, fontSize: 14, color: T.textBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.title}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: "#524840", marginTop: 1 }}>{node.type}</div>
      </div>
      <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>{action}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTERS GALLERY
// ═══════════════════════════════════════════════════════════════════════════════
function CharactersGallery({ characters, stories, onSelect, onAdd, onDelete }) {
  const list = Object.values(characters);
  const storiesForChar = (id) => Object.values(stories).filter(s => s.charIds.includes(id));
  return (
    <div style={{ height: "100%", overflow: "auto", padding: "28px 32px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: T.fontSerif, fontSize: 26, fontWeight: 600, color: T.textPrimary }}>Characters</h2>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost, marginTop: 4 }}>{list.length} character{list.length !== 1 ? "s" : ""} in this workspace</div>
          </div>
          <button className="btn btn-gold" onClick={onAdd}>+ New Character</button>
        </div>
        {list.length === 0 ? (
          <div style={{ border: "1px dashed #3a3530", borderRadius: 10, padding: "80px 0", textAlign: "center", cursor: "pointer" }} onClick={onAdd}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.2 }}>⚔</div>
            <div style={{ fontFamily: T.fontSerif, fontSize: 18, color: "#5a5048" }}>No characters yet</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textDeep, marginTop: 6 }}>Click to create your first character</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
            {list.map(ch => {
              const nStories = storiesForChar(ch.id).length;
              return (
                <div key={ch.id} onClick={() => onSelect(ch.id)}
                  style={{ background: T.bgCard, border: `1px solid ${T.borderSub}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s,box-shadow 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a96e60"; e.currentTarget.style.boxShadow = "0 6px 24px #00000060"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderSub; e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ height: 180, background: T.bgSurface, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                    {ch.portrait ? <img src={ch.portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
                      : <div style={{ opacity: 0.2, textAlign: "center" }}><div style={{ fontSize: 40 }}>⚔</div></div>}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 8px", background: "linear-gradient(transparent,#000000b0)", display: "flex", gap: 4, justifyContent: "center" }}>
                      {DND_STATS.map(s => (
                        <div key={s} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: T.fontMono, fontSize: 7, color: "#c9a96e80" }}>{STAT_LABELS[s]}</div>
                          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textBody, fontWeight: 600 }}>{ch.stats?.[s] || 10}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "12px 12px 10px" }}>
                    <div style={{ fontFamily: T.fontSerif, fontSize: 16, fontWeight: 600, color: "#e0d8c8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name || "Unnamed"}</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[ch.race, ch.occupation].filter(Boolean).join(" · ") || "—"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textDeep }}>{nStories > 0 ? `${nStories} stor${nStories === 1 ? "y" : "ies"}` : (ch.alignment || "")}</div>
                      <button className="btn btn-danger" style={{ fontSize: 8, padding: "2px 6px" }} onClick={e => { e.stopPropagation(); if (confirm(`Delete "${ch.name || "this character"}"?`)) onDelete(ch.id); }}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER SHEET
// ═══════════════════════════════════════════════════════════════════════════════
function CharacterSheet({ character, stories, allStories, nodes, characters, relationships, allRelationships, onUpdate, onDelete, onBack, onNewStory, onEditStory, onDeleteStory, onOpenNode, onOpenChar, onAddRelationship, onUpdateRelationship, onDeleteRelationship }) {
  const [sheetTab, setSheetTab] = useState("sheet");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(character)));
  const [bioTab, setBioTab] = useState("preview");
  const portraitRef = useRef(null);
  const fullbodyRef = useRef(null);

  useEffect(() => { setDraft(JSON.parse(JSON.stringify(character))); setEditing(false); }, [character.id]);

  const save = () => { onUpdate(draft); setEditing(false); };
  const cancel = () => { setDraft(JSON.parse(JSON.stringify(character))); setEditing(false); };

  const setDF = (path, val) => setDraft(prev => {
    const next = JSON.parse(JSON.stringify(prev));
    const keys = path.split("."); let obj = next;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = val; return next;
  });

  const handlePortraitUpload = async (e) => { const f = e.target.files[0]; if (!f) return; const url = await readFileAsDataURL(f); if (editing) setDF("portrait", url); else onUpdate({ portrait: url }); e.target.value = ""; };
  const handleFullbodyUpload = async (e) => { const f = e.target.files[0]; if (!f) return; const url = await readFileAsDataURL(f); if (editing) setDF("fullbody", url); else onUpdate({ fullbody: url }); e.target.value = ""; };

  const d = editing ? draft : character;
  const relCount = relationships.length;

  const tabs = [
    { id: "sheet", label: "SHEET" },
    { id: "stories", label: `STORIES${stories.length ? ` (${stories.length})` : ""}` },
    { id: "relationships", label: `RELATIONSHIPS${relCount ? ` (${relCount})` : ""}` },
  ];

  return (
    <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", background: T.bgApp }}>
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${T.borderMid}`, background: T.bgPanel, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={onBack}>← All Characters</button>
        <div style={{ width: 1, height: 16, background: T.borderStrong }} />
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn${sheetTab === t.id ? " active" : ""}`} style={{ padding: "5px 14px", fontSize: 10 }} onClick={() => setSheetTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 16, background: T.borderStrong }} />
        {sheetTab === "sheet" && (
          editing
            ? <><button className="btn btn-gold" onClick={save}>Save Changes</button><button className="btn btn-ghost" onClick={cancel}>Cancel</button></>
            : <><button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit Sheet</button><button className="btn btn-danger" onClick={() => { if (confirm(`Delete "${character.name}"?`)) onDelete(); }}>Delete</button></>
        )}
        {sheetTab === "stories" && (
          <button className="btn btn-gold" style={{ fontSize: 11 }} onClick={() => onNewStory()}>+ New Story Event</button>
        )}
        {sheetTab === "relationships" && (
          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDeep }}>Add relationships below ↓</span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textDeep }}>updated {formatDate(character.updatedAt)}</span>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {sheetTab === "stories" && (
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                {character.portrait && <img src={character.portrait} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", border: `1px solid ${T.borderStrong}` }} />}
                <div>
                  <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 600, color: T.textPrimary }}>{character.name}</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost }}>{[character.race, character.occupation].filter(Boolean).join(" · ") || "—"}</div>
                </div>
              </div>
            </div>
            {stories.length === 0 ? (
              <div style={{ border: "1px dashed #2a2520", borderRadius: 8, padding: "50px 0", textAlign: "center", cursor: "pointer" }} onClick={() => onNewStory()}>
                <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.2 }}>📖</div>
                <div style={{ fontFamily: T.fontSerif, fontSize: 17, color: T.textInvis, marginBottom: 4 }}>No story events yet</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: "#2e2c28" }}>Click to record the first development event for {character.name}</div>
              </div>
            ) : stories.map(s => (
              <StoryCard key={s.id} story={s} characters={characters} nodes={nodes}
                onEdit={onEditStory} onDelete={(id) => onDeleteStory(id)}
                onOpenChar={(cid) => { if (cid !== character.id) onOpenChar(cid); }}
                onOpenNode={onOpenNode} />
            ))}
          </div>
        )}

        {sheetTab === "relationships" && (
          <RelationshipsPanel
            character={character} relationships={relationships} characters={characters}
            onOpenChar={onOpenChar} onAddRelationship={onAddRelationship}
            onUpdateRelationship={onUpdateRelationship} onDeleteRelationship={onDeleteRelationship}
          />
        )}

        {sheetTab === "sheet" && (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px 48px", display: "flex", gap: 24 }}>
            <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <ImageSlot label="PORTRAIT" aspect="1/1" src={d.portrait} onUpload={handlePortraitUpload} onClear={() => { if (editing) setDF("portrait", null); else onUpdate({ portrait: null }); }} inputRef={portraitRef} placeholder="⚔" />
              <ImageSlot label="FULL BODY" aspect="1/2" src={d.fullbody} onUpload={handleFullbodyUpload} onClear={() => { if (editing) setDF("fullbody", null); else onUpdate({ fullbody: null }); }} inputRef={fullbodyRef} placeholder="↕" />
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 7 }}>COMBAT STATS</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {[["hp", "HP"], ["ac", "AC"], ["speed", "Speed"], ["level", "Level"], ["proficiency", "Prof. Bonus"]].map(([k, label]) => (
                    <div key={k} style={{ background: T.bgSurface, border: `1px solid ${T.borderMid}`, borderRadius: 7, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: "#7a7060", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
                      {editing
                        ? <input type="text" value={draft.extras?.[k] || ""} onChange={e => setDF(`extras.${k}`, e.target.value)} style={{ width: "100%", background: "none", border: "none", textAlign: "center", fontFamily: T.fontSerif, fontSize: 16, color: T.textBody, outline: "none", padding: 0 }} />
                        : <div style={{ fontFamily: T.fontSerif, fontSize: 16, color: T.textBody }}>{d.extras?.[k] || <span style={{ opacity: 0.2 }}>—</span>}</div>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 18 }}>
                {editing
                  ? <input type="text" value={draft.name || ""} onChange={e => setDF("name", e.target.value)} placeholder="Character Name"
                    style={{ background: "none", border: "none", borderBottom: `1px solid ${T.textDeep}`, color: T.textPrimary, fontFamily: T.fontSerif, fontSize: 32, fontWeight: 600, outline: "none", width: "100%", padding: "0 0 4px" }} />
                  : <h1 style={{ margin: "0 0 2px", fontFamily: T.fontSerif, fontSize: 32, fontWeight: 600, color: T.textPrimary, lineHeight: 1 }}>{d.name || <span style={{ opacity: 0.25 }}>Unnamed</span>}</h1>
                }
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost }}>{[d.race, d.occupation, d.alignment].filter(Boolean).join(" · ") || <span style={{ opacity: 0.3 }}>No details yet</span>}</div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 8 }}>ABILITY SCORES</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                  {DND_STATS.map(stat => {
                    const val = d.stats?.[stat] ?? 10;
                    const mod = statMod(val);
                    const modStr = (mod >= 0 ? "+" : "") + mod;
                    return (
                      <div key={stat} style={{ background: T.bgSurface, border: `1px solid ${T.borderMid}`, borderRadius: 7, padding: "7px 4px", textAlign: "center" }}>
                        <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.gold, letterSpacing: "0.12em", marginBottom: 3 }}>{STAT_LABELS[stat]}</div>
                        <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 600, color: "#e0d8c8", lineHeight: 1 }}>
                          {editing
                            ? <input type="number"
                              value={draft.stats?.[stat] ?? 10}
                              onChange={e => setDF(`stats.${stat}`, e.target.value === '' ? '' : Number(e.target.value))}
                              onBlur={e => { const raw = parseInt(e.target.value); setDF(`stats.${stat}`, isNaN(raw) ? 10 : Math.max(1, Math.min(30, raw))); }}
                              style={{ width: "100%", background: "none", border: "none", textAlign: "center", fontFamily: T.fontSerif, fontSize: 20, fontWeight: 600, color: "#e0d8c8", outline: "none", padding: 0 }} />
                            : val}
                        </div>
                        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: mod >= 0 ? T.statPos : T.statNeg, marginTop: 2 }}>{modStr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 18, padding: "14px", background: T.bgSurface, border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 8, gridColumn: "1/-1" }}>IDENTITY</div>
                {[["name", "Full Name", "—"], ["occupation", "Occupation", "—"], ["race", "Race / Species", "—"], ["gender", "Gender", "—"], ["age", "Age", "—"], ["alignment", "Alignment", "Neutral"]].map(([path, label, ph]) => (
                  <div key={path} style={{ marginBottom: 9 }}>
                    <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.08em", marginBottom: 2 }}>{label.toUpperCase()}</div>
                    {editing
                      ? <input type="text" value={draft[path] || ""} onChange={e => setDF(path, e.target.value)} placeholder={ph}
                        style={{ ...inputStyle, fontFamily: T.fontSerif, fontSize: 14, padding: "5px 8px", width: "100%" }} />
                      : <div style={{ fontFamily: T.fontSerif, fontSize: 15, color: d[path] ? T.textBody : T.textInvis }}>{d[path] || ph}</div>
                    }
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.1em" }}>BIOGRAPHY</div>
                  {editing && (
                    <div style={{ display: "flex", gap: 0 }}>
                      {["preview", "edit"].map(t => (
                        <button key={t} className={`tab-btn${bioTab === t ? " active" : ""}`} style={{ padding: "3px 10px", fontSize: 9 }} onClick={() => setBioTab(t)}>{t.toUpperCase()}</button>
                      ))}
                    </div>
                  )}
                </div>
                {editing && bioTab === "edit"
                  ? <textarea className="md-editor" value={draft.bio || ""} rows={12} onChange={e => setDF("bio", e.target.value)} placeholder="Write a biography…" />
                  : <div style={{ background: T.bgSurface, border: `1px solid ${T.borderFaint}`, borderRadius: 8, padding: "14px 16px", minHeight: 110 }}>
                    {d.bio
                      ? <div className="md-content"><ReactMarkdown>{d.bio}</ReactMarkdown></div>
                      : <div style={{ fontFamily: T.fontSerif, fontSize: 14, color: T.textInvis, fontStyle: "italic" }}>No biography written yet.</div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELATIONSHIPS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const REL_LABELS = ["Family", "Partner", "Lover", "Friend", "Close Friend", "Ally", "Mentor", "Student", "Acquaintance", "Rival", "Enemy", "Nemesis", "Complicated", "Other"];

function RelationshipsPanel({ character, relationships, characters, onOpenChar, onAddRelationship, onUpdateRelationship, onDeleteRelationship }) {
  const [order, setOrder] = useState(() => relationships.map(r => r.id));
  const [addingTargetId, setAddingTargetId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    setOrder(prev => {
      const ids = relationships.map(r => r.id);
      const kept = prev.filter(id => ids.includes(id));
      const added = ids.filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [relationships.map(r => r.id).join(",")]);

  const orderedRels = order.map(id => relationships.find(r => r.id === id)).filter(Boolean);
  const existingTargetIds = new Set(relationships.map(r => r.charAId === character.id ? r.charBId : r.charAId));
  const availableChars = Object.values(characters).filter(c => c.id !== character.id && !existingTargetIds.has(c.id));

  const handleAdd = () => { if (!addingTargetId) return; onAddRelationship(addingTargetId); setAddingTargetId(""); };

  const onDragStart = (e, relId, idx) => { dragRef.current = { relId, startIdx: idx, curIdx: idx }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", relId); };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (!dragRef.current || dragRef.current.curIdx === idx) return;
    dragRef.current.curIdx = idx;
    setOrder(prev => { const arr = [...prev]; const from = arr.indexOf(dragRef.current.relId); if (from === -1) return prev; arr.splice(from, 1); arr.splice(idx, 0, dragRef.current.relId); return arr; });
  };
  const onDragEnd = () => { dragRef.current = null; };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 600, color: T.textPrimary }}>{character.name}'s Relationships</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, marginTop: 3 }}>{orderedRels.length} relationship{orderedRels.length !== 1 ? "s" : ""} · drag cards to reorder</div>
        </div>
      </div>
      {availableChars.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24, padding: "12px 14px", background: T.bgSurface, border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>ADD RELATIONSHIP</div>
          <select value={addingTargetId} onChange={e => setAddingTargetId(e.target.value)}
            style={{ flex: 1, background: T.bgInput, border: `1px solid ${T.borderStrong}`, color: addingTargetId ? T.textBody : T.textGhost, fontFamily: T.fontSerif, fontSize: 14, padding: "6px 10px", borderRadius: 4, outline: "none" }}>
            <option value="">Select a character…</option>
            {availableChars.map(c => <option key={c.id} value={c.id}>{c.name || "Unnamed"}{c.race ? ` · ${c.race}` : ""}</option>)}
          </select>
          <button className="btn btn-gold" style={{ fontSize: 11, whiteSpace: "nowrap" }} onClick={handleAdd} disabled={!addingTargetId}>+ Add</button>
        </div>
      )}
      {availableChars.length === 0 && orderedRels.length === 0 && (
        <div style={{ border: "1px dashed #2a2520", borderRadius: 8, padding: "50px 0", textAlign: "center" }}>
          <div style={{ fontFamily: T.fontSerif, fontSize: 16, color: T.textInvis, marginBottom: 4 }}>No other characters in this workspace</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: "#2e2c28" }}>Create more characters to define relationships between them</div>
        </div>
      )}
      {availableChars.length === 0 && orderedRels.length > 0 && (
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textInvis, marginBottom: 16, textAlign: "center" }}>All available characters are already linked</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 12 }}>
        {orderedRels.map((rel, idx) => {
          const isA = rel.charAId === character.id;
          const otherId = isA ? rel.charBId : rel.charAId;
          const other = characters[otherId];
          const myLabel = isA ? rel.labelA : rel.labelB;
          const theirLabel = isA ? rel.labelB : rel.labelA;
          if (!other) return null;
          return (
            <RelationshipCard key={rel.id} rel={rel} other={other} myLabel={myLabel} theirLabel={theirLabel}
              isEditing={editingId === rel.id} isA={isA}
              onEdit={() => setEditingId(rel.id)} onDoneEdit={() => setEditingId(null)}
              onNavigate={() => onOpenChar(other.id)}
              onDelete={() => { if (confirm(`Remove relationship with ${other.name}?`)) onDeleteRelationship(rel.id); }}
              onUpdate={(patch) => onUpdateRelationship(rel.id, patch)}
              draggable onDragStart={e => onDragStart(e, rel.id, idx)} onDragOver={e => onDragOver(e, idx)} onDragEnd={onDragEnd}
            />
          );
        })}
      </div>
    </div>
  );
}

function RelationshipCard({ rel, other, myLabel, theirLabel, isEditing, isA, onEdit, onDoneEdit, onNavigate, onDelete, onUpdate, draggable, onDragStart, onDragOver, onDragEnd }) {
  const [draftMyLabel, setDraftMyLabel] = useState(myLabel || "");
  const [draftTheirLabel, setDraftTheirLabel] = useState(theirLabel || "");
  const [draftDesc, setDraftDesc] = useState(rel.description || "");
  const [hovered, setHovered] = useState(false);

  useEffect(() => { setDraftMyLabel(myLabel || ""); setDraftTheirLabel(theirLabel || ""); setDraftDesc(rel.description || ""); }, [rel.id, myLabel, theirLabel, rel.description]);

  const save = () => { onUpdate({ labelA: isA ? draftMyLabel : draftTheirLabel, labelB: isA ? draftTheirLabel : draftMyLabel, description: draftDesc }); onDoneEdit(); };
  const cancel = () => { setDraftMyLabel(myLabel || ""); setDraftTheirLabel(theirLabel || ""); setDraftDesc(rel.description || ""); onDoneEdit(); };
  const iStyle = { background: T.bgInput, border: `1px solid ${T.borderStrong}`, color: T.textBody, fontFamily: T.fontSerif, fontSize: 13, padding: "4px 8px", borderRadius: 3, outline: "none", width: "100%" };

  return (
    <div draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: T.bgCard, border: `1px solid ${hovered || isEditing ? "#4a4030" : T.borderSub}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.15s,box-shadow 0.15s", boxShadow: hovered || isEditing ? "0 4px 20px #00000060" : "none", cursor: "grab", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div onClick={onNavigate} style={{ width: 80, height: 80, flexShrink: 0, cursor: "pointer", position: "relative", overflow: "hidden", background: T.bgSurface, alignSelf: "stretch" }} title={`Go to ${other.name}'s sheet`}>
          {other.portrait
            ? <img src={other.portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.18, fontSize: 24 }}>⚔</div>
          }
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0)"; }} />
        </div>
        <div style={{ flex: 1, padding: "11px 12px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
            <div onClick={onNavigate} style={{ cursor: "pointer" }}>
              <div style={{ fontFamily: T.fontSerif, fontSize: 16, fontWeight: 600, color: "#e0d8c8", lineHeight: 1.2 }}>{other.name || "Unnamed"}</div>
              {other.race && <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textGhost, marginTop: 1 }}>{other.race}{other.occupation ? ` · ${other.occupation}` : ""}</div>}
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textInvis, cursor: "grab", padding: "2px 4px", lineHeight: 1 }}>⠿</span>
              {!isEditing && <button className="btn btn-ghost" style={{ fontSize: 8, padding: "2px 7px" }} onClick={onEdit}>Edit</button>}
              <button className="btn btn-danger" style={{ fontSize: 8, padding: "2px 7px" }} onClick={onDelete}>✕</button>
            </div>
          </div>
          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textGhost, marginBottom: 2 }}>MY LABEL</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <select value={draftMyLabel} onChange={e => setDraftMyLabel(e.target.value)} style={{ ...iStyle, flex: 1, padding: "4px 6px" }}>
                    <option value="">— Select —</option>
                    {REL_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input type="text" value={draftMyLabel} onChange={e => setDraftMyLabel(e.target.value)} placeholder="or type custom…" style={{ ...iStyle, flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textGhost, marginBottom: 2 }}>THEIR LABEL <span style={{ color: T.textInvis }}>({other.name} → you)</span></div>
                <div style={{ display: "flex", gap: 4 }}>
                  <select value={draftTheirLabel} onChange={e => setDraftTheirLabel(e.target.value)} style={{ ...iStyle, flex: 1, padding: "4px 6px" }}>
                    <option value="">— Select —</option>
                    {REL_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input type="text" value={draftTheirLabel} onChange={e => setDraftTheirLabel(e.target.value)} placeholder="or type custom…" style={{ ...iStyle, flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textGhost, marginBottom: 2 }}>DESCRIPTION</div>
                <textarea value={draftDesc} onChange={e => setDraftDesc(e.target.value)} rows={2} placeholder="Describe the nature of this relationship…"
                  style={{ ...iStyle, resize: "vertical", fontFamily: T.fontSerif, fontSize: 13, lineHeight: 1.5 }} />
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" style={{ fontSize: 9, padding: "3px 10px" }} onClick={cancel}>Cancel</button>
                <button className="btn btn-gold" style={{ fontSize: 9, padding: "3px 10px" }} onClick={save}>Save</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: myLabel || theirLabel ? 5 : 0 }}>
                {myLabel && <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, background: "#c9a96e18", border: "1px solid #c9a96e40", borderRadius: 20, padding: "2px 9px" }}>{myLabel}</span>}
                {theirLabel && theirLabel !== myLabel && <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDim, background: T.borderStrong, border: "1px solid #4a4540", borderRadius: 20, padding: "2px 9px" }}>{theirLabel} →</span>}
                {!myLabel && !theirLabel && <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textInvis, fontStyle: "italic", cursor: "pointer" }} onClick={onEdit}>click Edit to set relationship type</span>}
              </div>
              {rel.description && <div style={{ fontFamily: T.fontSerif, fontSize: 13, color: T.textDim, lineHeight: 1.5, marginTop: 4, borderTop: "1px solid #252220", paddingTop: 6 }}>{rel.description}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageSlot({ label, subLabel, aspect, src, onUpload, onClear, inputRef, placeholder }) {
  const isSquare = aspect === "1/1";
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, letterSpacing: "0.1em", marginBottom: 5 }}>
        {label}{subLabel && <span style={{ color: T.textInvis }}> {subLabel}</span>}
      </div>
      <div style={{ width: "100%", maxWidth: isSquare ? 256 : "100%", aspectRatio: aspect, background: T.bgSurface, borderRadius: 7, border: `1px solid ${T.borderSub}`, overflow: "hidden", position: "relative", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={() => inputRef.current.click()}
        onMouseEnter={e => e.currentTarget.querySelector(".img-ov").style.opacity = "1"}
        onMouseLeave={e => e.currentTarget.querySelector(".img-ov").style.opacity = "0"}>
        {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          : <div style={{ opacity: 0.15, fontFamily: T.fontMono, fontSize: 11, textAlign: "center" }}>{placeholder}</div>}
        <div className="img-ov" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", opacity: 0, transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: "#fff" }}>UPLOAD</div>
        </div>
        {src && <button className="img-remove" style={{ opacity: 1, top: 6, right: 6 }} onClick={e => { e.stopPropagation(); onClear(); }}>✕</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  html,body,#root{margin:0;padding:0;width:100%;height:100%;}
  *{box-sizing:border-box;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:${T.bgApp};}
  ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:3px;}
  .btn{cursor:pointer;border:none;font-family:${T.fontMono};font-size:11px;letter-spacing:0.05em;padding:6px 14px;border-radius:3px;transition:all 0.15s;}
  .btn-gold{background:${T.gold};color:${T.bgApp};}.btn-gold:hover{background:${T.goldHover};}
  .btn-ghost{background:transparent;color:${T.textDim};border:1px solid ${T.borderStrong};}.btn-ghost:hover{border-color:${T.textFaint};color:${T.textBody};}
  .btn-danger{background:transparent;color:${T.red};border:1px solid ${T.redBorder};}.btn-danger:hover{background:${T.redDim};}
  .btn-green{background:${T.green};color:${T.greenText};border:none;}.btn-green:hover{background:${T.greenHover};}
  .md-content h1{font-size:1.6em;font-weight:600;color:${T.textPrimary};margin:0 0 0.5em;border-bottom:1px solid ${T.borderStrong};padding-bottom:0.3em;}
  .md-content h2{font-size:1.3em;font-weight:600;color:#d8d0c0;margin:1em 0 0.4em;}
  .md-content h3{font-size:1.1em;font-weight:600;color:${T.gold};margin:0.8em 0 0.3em;letter-spacing:0.05em;}
  .md-content p{line-height:1.75;margin:0 0 0.8em;color:#ccc4b4;}
  .md-content strong{color:${T.textPrimary};font-weight:600;}
  .md-content em{color:${T.gold};font-style:italic;}
  .md-content code{font-family:${T.fontMono};font-size:0.85em;background:${T.borderMid};padding:1px 5px;border-radius:3px;color:#90c080;}
  .md-content blockquote{border-left:3px solid ${T.gold};margin:0.8em 0;padding:0.3em 1em;color:${T.textMuted};font-style:italic;background:#22201c;}
  .md-content ul,.md-content ol{padding-left:1.5em;margin:0.5em 0;}
  .md-content li{line-height:1.7;color:#ccc4b4;}
  .md-content hr{border:none;border-top:1px solid ${T.borderStrong};margin:1.5em 0;}
  .tab-btn{background:none;border:none;cursor:pointer;font-family:${T.fontMono};font-size:11px;letter-spacing:0.08em;padding:8px 18px;color:${T.textGhost};border-bottom:2px solid transparent;transition:all 0.15s;}
  .tab-btn.active{color:${T.gold};border-bottom-color:${T.gold};}
  textarea.md-editor{width:100%;background:${T.bgInput};border:1px solid ${T.borderStrong};color:${T.textBody};font-family:${T.fontMono};font-size:13px;line-height:1.7;padding:16px;resize:vertical;border-radius:4px;outline:none;}
  textarea.md-editor:focus{border-color:${T.goldBorder};}
  input.field-input{background:${T.bgInput};border:1px solid ${T.borderStrong};color:${T.textBody};font-family:${T.fontSerif};font-size:15px;padding:8px 12px;border-radius:4px;outline:none;width:100%;}
  input.field-input:focus{border-color:${T.goldBorder};}
  input[type=text].inline-input{background:${T.bgInput};border:1px solid ${T.borderStrong};color:${T.textBody};font-family:${T.fontSerif};font-size:14px;padding:7px 10px;border-radius:4px;outline:none;width:100%;}
  input[type=text].inline-input:focus{border-color:${T.goldBorder};}
  input[type=number]{-moz-appearance:textfield;}
  input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
  .node-card{transition:all 0.15s;}
  .node-card:hover .node-inner{filter:brightness(1.1);}
  .connect-btn{opacity:0;transition:opacity 0.15s;}
  .node-card:hover .connect-btn{opacity:1;}
  .color-swatch{width:16px;height:16px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform 0.15s,border-color 0.15s;flex-shrink:0;}
  .color-swatch:hover{transform:scale(1.25);}
  .image-thumb{position:relative;border-radius:6px;overflow:hidden;}
  .image-thumb:hover .img-remove{opacity:1;}
  .img-remove{position:absolute;top:4px;right:4px;opacity:0;background:${T.redImg};border:none;border-radius:50%;width:22px;height:22px;color:white;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:opacity 0.15s;padding:0;}
  .icon-hover-overlay{opacity:0;transition:opacity 0.15s;position:absolute;inset:0;border-radius:7px;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;font-family:${T.fontMono};font-size:9px;color:#fff;letter-spacing:0.1em;}
  .icon-wrap:hover .icon-hover-overlay{opacity:1;}
  .modal-backdrop{position:fixed;inset:0;background:rgba(10,9,8,0.88);z-index:100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);}
  .modal-box{background:${T.bgCard};border:1px solid ${T.borderStrong};border-radius:10px;padding:24px 26px;min-width:440px;max-width:580px;width:100%;box-shadow:0 24px 80px #00000090;max-height:90vh;overflow-y:auto;}
  .modal-title{font-family:${T.fontSerif};font-size:20px;font-weight:600;color:${T.textPrimary};margin:0 0 18px;}
  .modal-section{margin-bottom:16px;}
  .modal-label{font-family:${T.fontMono};font-size:10px;color:${T.textFaint};letter-spacing:0.1em;margin-bottom:7px;}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:22px;padding-top:16px;border-top:1px solid ${T.borderMid};}
  .node-picker-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:4px;cursor:pointer;transition:background 0.1s;}
  .node-picker-row:hover{background:${T.borderMid};}
  .node-picker-check{width:14px;height:14px;border-radius:3px;border:1px solid ${T.textGhost};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;transition:all 0.1s;}
  .node-picker-check.checked{background:${T.gold};border-color:${T.gold};color:${T.bgApp};}
  .drop-zone{border:2px dashed ${T.borderStrong};border-radius:8px;padding:32px 0;text-align:center;cursor:pointer;transition:border-color 0.15s,background 0.15s;}
  .drop-zone.drag-over{border-color:${T.gold};background:${T.goldDim};}
  .import-preview{background:${T.bgInput};border:1px solid ${T.borderMid};border-radius:6px;padding:14px 16px;margin-top:12px;}
  .import-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;}
  .import-meta-item{font-family:${T.fontMono};font-size:10px;}
  .import-meta-label{color:${T.textGhost};}.import-meta-val{color:${T.textBody};}
  .import-node-list{margin-top:8px;max-height:120px;overflow-y:auto;}
  .import-node-item{font-family:${T.fontSerif};font-size:13px;color:${T.textMuted};padding:2px 0;border-bottom:1px solid #252220;}
  .import-node-item:last-child{border-bottom:none;}
  .import-error{background:${T.redBg};border:1px solid ${T.redBorder};border-radius:6px;padding:10px 14px;margin-top:10px;font-family:${T.fontMono};font-size:11px;color:${T.redText};}
  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);font-family:${T.fontMono};font-size:11px;padding:8px 18px;border-radius:4px;z-index:200;pointer-events:none;animation:toastIn 0.2s ease;white-space:nowrap;}
  .toast.ok{background:#2a3820;border:1px solid ${T.green};color:${T.greenBright};}
  .toast.err{background:${T.redBg};border:1px solid ${T.redBorder};color:${T.redText};}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
  .radio-row{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;}
  .radio-dot{width:14px;height:14px;border-radius:50%;border:1px solid ${T.textGhost};flex-shrink:0;display:flex;align-items:center;justify-content:center;}
  .radio-dot.active{border-color:${T.gold};}
  .radio-dot.active::after{content:'';width:7px;height:7px;border-radius:50%;background:${T.gold};display:block;}
  .radio-label{font-family:${T.fontMono};font-size:11px;color:${T.textMuted};}
  .toggle-wrap{cursor:pointer;}
  .toggle{width:36px;height:20px;border-radius:10px;background:${T.borderMid};border:1px solid ${T.scrollThumb};position:relative;transition:background 0.2s,border-color 0.2s;}
  .toggle.on{background:${T.green};border-color:${T.greenToggle};}
  .toggle-knob{width:14px;height:14px;border-radius:50%;background:${T.textDim};position:absolute;top:2px;left:2px;transition:left 0.2s,background 0.2s;}
  .toggle.on .toggle-knob{left:18px;background:${T.greenText};}
  select option{background:${T.bgCard};color:${T.textBody};}
`;
