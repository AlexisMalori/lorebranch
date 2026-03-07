import { useState, useEffect } from "react";

/**
 * Resolves an app://images/ URL to a data-URL via the Electron IPC bridge.
 * Returns null while loading, then the resolved data-URL.
 * Passes through data: and http(s): URLs unchanged.
 */
export function useAppImage(src) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    if (!src) { setDataUrl(null); return; }
    if (src.startsWith("data:")) { setDataUrl(src); return; }
    if (src.startsWith("app://")) {
      let cancelled = false;
      window.api.loadImage(src).then(url => { if (!cancelled) setDataUrl(url); });
      return () => { cancelled = true; };
    }
    setDataUrl(src);
  }, [src]);
  return dataUrl;
}