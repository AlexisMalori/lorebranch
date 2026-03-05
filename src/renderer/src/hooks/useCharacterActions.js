import { useDispatch, useSelector } from "react-redux";
import {
  mkCharacter,
  workspacesActions, uiActions,
  selectActiveWsId, selectCharacters, selectUi,
} from "../store";

/**
 * Character CRUD actions bound to the active workspace.
 * Also exposes `characters` so callers don't need a second useSelector.
 */
export function useCharacterActions() {
  const dispatch   = useDispatch();
  const activeWsId = useSelector(selectActiveWsId);
  const characters = useSelector(selectCharacters);
  const { activeCharId } = useSelector(selectUi);

  const addCharacter = () => {
    const ch = mkCharacter();
    dispatch(workspacesActions.addCharacter({ wsId: activeWsId, character: ch }));
    dispatch(uiActions.openCharSheet(ch.id));
    return ch.id;
  };

  const updateCharacter = (id, fields) =>
    dispatch(workspacesActions.updateCharacter({ wsId: activeWsId, id, fields }));

  const deleteCharacter = (id) => {
    dispatch(workspacesActions.deleteCharacter({ wsId: activeWsId, id }));
    if (activeCharId === id) {
      dispatch(uiActions.setActiveCharId(null));
      dispatch(uiActions.setView("characters"));
    }
  };

  return {
    characters, activeCharId,
    addCharacter, updateCharacter, deleteCharacter,
  };
}