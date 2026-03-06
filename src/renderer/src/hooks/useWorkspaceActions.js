import { useDispatch, useSelector } from "react-redux";
import {
  freshId, mkWorkspace,
  workspacesActions, uiActions,
  selectAllWorkspaces, selectActiveWsId, selectActiveWorkspace,
  selectNodes, selectUi,
} from "../store";
import { useToast } from "./useToast";

// ── Pure helpers (duplicated from App.jsx until a shared utils module exists) ──
function readFileAsText(f) {
  return new Promise((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.onerror = j; rd.readAsText(f); });
}
function downloadJSON(obj, name) {
  const b = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}
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

// ─────────────────────────────────────────────────────────────────────────────
export function useWorkspaceActions() {
  const dispatch      = useDispatch();
  const { showToast } = useToast();
  const workspaces    = useSelector(selectAllWorkspaces);
  const activeWsId    = useSelector(selectActiveWsId);
  const ws            = useSelector(selectActiveWorkspace);
  const nodes         = useSelector(selectNodes);
  const { exportMode, exportRoots, exportLabel, importPayload } = useSelector(selectUi);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const createWorkspace = (title) => {
    const newWs = mkWorkspace(title);
    dispatch(workspacesActions.importWorkspace(newWs));
    dispatch(uiActions.activateWorkspace(newWs.id));
  };
  const updateWs = (id, patch) => dispatch(workspacesActions.updateWorkspace({ id, patch }));
  const deleteWs = (id) => {
    const remaining = Object.keys(workspaces).filter(k => k !== id);
    dispatch(workspacesActions.deleteWorkspace(id));
    dispatch(uiActions.workspaceDeleted(remaining[0]));
  };

  // ── Export ────────────────────────────────────────────────────────────────
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
  const exportWorkspace = (wsId) => {
    const w = workspaces[wsId]; if (!w) return;
    const payload = buildExport(w.nodes, new Set(Object.keys(w.nodes)), w.title);
    const fname = (w.title || "workspace").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".dtree.json";
    downloadJSON(payload, fname);
    showToast(`Workspace saved → ${fname}`);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImportFile = async (file) => {
    try {
      const obj = JSON.parse(await readFileAsText(file));
      const err = validateImport(obj);
      if (err) { dispatch(uiActions.setImportError(err)); dispatch(uiActions.setImportPayload(null)); return; }
      dispatch(uiActions.setImportPayload(obj));
      dispatch(uiActions.setImportError(null));
    } catch (e) {
      dispatch(uiActions.setImportError("Parse error: " + e.message));
      dispatch(uiActions.setImportPayload(null));
    }
  };
  const doImport = () => {
    if (!importPayload) return;
    const merged = mergeImport(nodes, importPayload);
    dispatch(workspacesActions.setNodes({ wsId: activeWsId, nodes: merged }));
    // setNodes is Redux-only and skipped by the middleware, so explicitly
    // persist only the newly-imported nodes (not the whole canvas).
    const existingIds = new Set(Object.keys(nodes));
    const newNodes = Object.values(merged).filter(n => !existingIds.has(n.id));
    if (newNodes.length) window.api?.upsertManyNodes({ wsId: activeWsId, nodes: newNodes });
    dispatch(uiActions.setModal(null));
    showToast(`Imported ${importPayload.nodeCount} nodes, ${importPayload.edgeCount} edges.`);
  };
  const handleWsImport = async (file) => {
    try {
      const obj = JSON.parse(await readFileAsText(file));
      const err = validateImport(obj); if (err) { showToast(err, "err"); return; }
      const newWs = mkWorkspace(obj.label || "Imported", mergeImport({}, obj, 0, 0));
      dispatch(workspacesActions.importWorkspace(newWs));
      dispatch(uiActions.activateWorkspace(newWs.id));
      showToast(`Workspace "${newWs.title}" imported.`);
    } catch (e) { showToast("Import failed: " + e.message, "err"); }
  };

  return {
    workspaces, activeWsId, ws,
    createWorkspace, updateWs, deleteWs,
    openExport, doExport, exportWorkspace,
    handleImportFile, doImport, handleWsImport,
  };
}