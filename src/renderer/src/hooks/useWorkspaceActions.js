import { useDispatch, useSelector } from "react-redux";
import {
  freshId, mkWorkspace,
  workspacesActions, uiActions,
  selectAllWorkspaces, selectActiveWsId, selectActiveWorkspace,
  selectNodes, selectUi,
} from "../store";
import { useToast } from "./useToast";

import { collectSubtree, buildExport, validateImport, mergeImport, getParents } from "../utils/treeUtils";
import { readFileAsText, downloadJSON } from "../utils/fileUtils";

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
    dispatch(workspacesActions.setNodes({ wsId: activeWsId, nodes: mergeImport(nodes, importPayload, freshId) }));
    dispatch(uiActions.setModal(null));
    showToast(`Imported ${importPayload.nodeCount} nodes, ${importPayload.edgeCount} edges.`);
  };
  const handleWsImport = async (file) => {
    try {
      const obj = JSON.parse(await readFileAsText(file));
      const err = validateImport(obj); if (err) { showToast(err, "err"); return; }
      const newWs = mkWorkspace(obj.label || "Imported", mergeImport({}, obj, freshId, 0, 0));
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