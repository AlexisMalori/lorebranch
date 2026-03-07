import { useDispatch, useSelector } from "react-redux";
import {
  freshId, mkWorkspace,
  workspacesActions, uiActions,
  selectAllWorkspaces, selectActiveWsId, selectActiveWorkspace,
} from "../store";
import { useToast } from "./useToast";

import { buildExport, validateImport, mergeImport } from "../utils/treeUtils";
import { readFileAsText, downloadJSON } from "../utils/fileUtils";

// ─────────────────────────────────────────────────────────────────────────────
export function useWorkspaceActions() {
  const dispatch      = useDispatch();
  const { showToast } = useToast();
  const workspaces    = useSelector(selectAllWorkspaces);
  const activeWsId    = useSelector(selectActiveWsId);
  const ws            = useSelector(selectActiveWorkspace);

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
  const exportWorkspace = (wsId) => {
    const w = workspaces[wsId]; if (!w) return;
    const payload = buildExport(w.nodes, new Set(Object.keys(w.nodes)), w.title);
    const fname = (w.title || "workspace").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".dtree.json";
    downloadJSON(payload, fname);
    showToast(`Workspace exported → ${fname}`);
  };

  // ── Import ────────────────────────────────────────────────────────────────
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
    exportWorkspace, handleWsImport,
  };
}