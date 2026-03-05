import { useDispatch, useSelector } from "react-redux";
import {
  freshId,
  workspacesActions, uiActions,
  selectActiveWsId, selectNodes, selectUi,
} from "../store";

/**
 * Node CRUD actions bound to the active workspace.
 * Also exposes `nodes` so callers don't need a second useSelector.
 */
export function useNodeActions() {
  const dispatch   = useDispatch();
  const activeWsId = useSelector(selectActiveWsId);
  const nodes      = useSelector(selectNodes);
  const { selectedNodeId } = useSelector(selectUi);

  const setNodes = (patch) => {
    const resolved = typeof patch === "function" ? patch(nodes) : patch;
    dispatch(workspacesActions.setNodes({ wsId: activeWsId, nodes: resolved }));
  };

  const updateNode = (id, fields) =>
    dispatch(workspacesActions.updateNode({ wsId: activeWsId, id, fields }));

  const addNode = (parentId = null) => {
    const id     = freshId();
    const parent = parentId ? nodes[parentId] : null;
    const node   = {
      id,
      title:    "New Node",
      body:     "Write something here...",
      type:     "Narrative",
      editedAt: new Date().toISOString(),
      x:        parent ? parent.x + (Math.random() * 220 - 110) : 400,
      y:        parent ? parent.y + 180 : 200,
      children: [],
      color:    "none",
      icon:     null,
      images:   [],
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

  const toggleConnect   = (fromId, toId) =>
    dispatch(workspacesActions.toggleConnect({ wsId: activeWsId, fromId, toId }));

  const disconnectNodes = (fromId, toId) =>
    dispatch(workspacesActions.disconnectNodes({ wsId: activeWsId, fromId, toId }));

  return {
    nodes,
    setNodes, updateNode, addNode,
    deleteNode, deleteNodes,
    toggleConnect, disconnectNodes,
  };
}