import { useDispatch, useSelector } from "react-redux";
import {
  mkRelationship,
  workspacesActions,
  selectActiveWsId, selectRelationships,
} from "../store";

/**
 * Relationship CRUD actions bound to the active workspace.
 * Also exposes `relationships` and a per-character filter helper.
 */
export function useRelationshipActions() {
  const dispatch      = useDispatch();
  const activeWsId    = useSelector(selectActiveWsId);
  const relationships = useSelector(selectRelationships);

  const addRelationship = (charAId, charBId) => {
    const r = mkRelationship(charAId, charBId);
    dispatch(workspacesActions.addRelationship({ wsId: activeWsId, relationship: r }));
    return r;
  };

  const updateRelationship = (id, fields) =>
    dispatch(workspacesActions.updateRelationship({ wsId: activeWsId, id, fields }));

  const deleteRelationship = (id) =>
    dispatch(workspacesActions.deleteRelationship({ wsId: activeWsId, id }));

  // ── Derived helper ────────────────────────────────────────────────────────
  const relsForChar = (charId) =>
    Object.values(relationships).filter(r => r.charAId === charId || r.charBId === charId);

  return {
    relationships,
    addRelationship, updateRelationship, deleteRelationship,
    relsForChar,
  };
}