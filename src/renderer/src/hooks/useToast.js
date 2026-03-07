// useToast.js
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { uiActions, selectUi } from "../store";

const TOAST_DURATION_MS = 3200;

/**
 * Returns `showToast(msg, kind?)` and the current `toast` state.
 * kind: "ok" | "err" | "saving"
 *
 * "saving" toasts are not auto-dismissed — they stay until replaced by
 * the follow-up "ok" or "err" toast from the save pipeline.
 */
export function useToast() {
  const dispatch = useDispatch();
  const { toast } = useSelector(selectUi);

  const showToast = useCallback((msg, kind = "ok") => {
    dispatch(uiActions.showToast({ msg, kind }));
    if (kind !== "saving") {
      setTimeout(() => dispatch(uiActions.clearToast()), TOAST_DURATION_MS);
    }
  }, [dispatch]);

  return { toast, showToast };
}