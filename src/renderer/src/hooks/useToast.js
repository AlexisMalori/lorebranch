import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { uiActions, selectUi } from "../store";

const TOAST_DURATION_MS = 3200;

/**
 * Returns `showToast(msg, kind?)` and the current `toast` state.
 * kind: "ok" | "err"
 */
export function useToast() {
  const dispatch = useDispatch();
  const { toast } = useSelector(selectUi);

  const showToast = useCallback((msg, kind = "ok") => {
    dispatch(uiActions.showToast({ msg, kind }));
    setTimeout(() => dispatch(uiActions.clearToast()), TOAST_DURATION_MS);
  }, [dispatch]);

  return { toast, showToast };
}