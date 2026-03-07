import { useAppImage } from "../../hooks/useAppImage";

/**
 * Drop-in <img> that accepts app://images/ URLs in addition to regular
 * URLs and data-URLs. Renders nothing while the image is resolving.
 */
export function AppImage({ src, alt = "", style, ...rest }) {
  const resolved = useAppImage(src);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} style={style} {...rest} />;
}