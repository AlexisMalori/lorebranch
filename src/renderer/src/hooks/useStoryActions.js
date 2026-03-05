import { useDispatch, useSelector } from "react-redux";
import {
  mkStory,
  workspacesActions, uiActions,
  selectActiveWsId, selectStories,
} from "../store";

/**
 * Story CRUD actions bound to the active workspace.
 * Also exposes `stories` and derived helpers so callers don't need extra selectors.
 */
export function useStoryActions() {
  const dispatch   = useDispatch();
  const activeWsId = useSelector(selectActiveWsId);
  const stories    = useSelector(selectStories);

  const saveStory = (data) =>
    dispatch(workspacesActions.saveStory({ wsId: activeWsId, story: data }));

  const createStory = (opts = {}) => {
    const s = mkStory({ ...opts, useTemplate: opts.useTemplate ?? true });
    dispatch(workspacesActions.createStory({ wsId: activeWsId, story: s }));
    return s;
  };

  const deleteStory = (storyId, scope = "all", fromCharId = null) => {
    dispatch(workspacesActions.deleteStory({ wsId: activeWsId, storyId, scope, fromCharId }));
    dispatch(uiActions.setDeleteStoryModal(null));
  };

  // ── Derived helpers ───────────────────────────────────────────────────────
  const storyList      = Object.values(stories);
  const storiesForChar = (charId) => storyList.filter(s => s.charIds.includes(charId));
  const storiesForNode = (nodeId) => storyList.filter(s => s.nodeId === nodeId);

  return {
    stories,
    saveStory, createStory, deleteStory,
    storiesForChar, storiesForNode,
  };
}