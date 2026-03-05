import { useDispatch, useSelector } from "react-redux";
import { uiActions, selectUi } from "../store";

/**
 * View-level navigation actions and the current UI route state.
 * Keeps all `uiActions` dispatch calls for routing in one place.
 */
export function useNavigation() {
  const dispatch = useDispatch();
  const { view, selectedNodeId, editingNodeId, activeCharId, sidebarOpen, modal,
          storyModal, deleteStoryModal } = useSelector(selectUi);

  const openBubble  = (id) => dispatch(uiActions.openBubble(id));
  const goOverview  = ()   => dispatch(uiActions.goOverview());
  const setView     = (v)  => dispatch(uiActions.setView(v));
  const setModal    = (m)  => dispatch(uiActions.setModal(m));
  const setSidebar  = (v)  => dispatch(uiActions.setSidebarOpen(v));

  const openCharSheet = (id) => {
    dispatch(uiActions.setActiveCharId(id));
    dispatch(uiActions.setView("charsheet"));
  };

  const openStoryModal  = (config) => dispatch(uiActions.setStoryModal(config));
  const closeStoryModal = ()       => dispatch(uiActions.setStoryModal(null));

  const openDeleteStoryModal  = (config) => dispatch(uiActions.setDeleteStoryModal(config));
  const closeDeleteStoryModal = ()       => dispatch(uiActions.setDeleteStoryModal(null));

  const setEditingNodeId = (id) => dispatch(uiActions.setEditingNodeId(id));
  const setActiveCharId  = (id) => dispatch(uiActions.setActiveCharId(id));

  return {
    // Current state
    view, selectedNodeId, editingNodeId, activeCharId, sidebarOpen, modal,
    storyModal, deleteStoryModal,
    // Actions
    openBubble, goOverview, setView, setModal, setSidebar,
    openCharSheet,
    openStoryModal, closeStoryModal,
    openDeleteStoryModal, closeDeleteStoryModal,
    setEditingNodeId, setActiveCharId,
  };
}