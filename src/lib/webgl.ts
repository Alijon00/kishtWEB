/**
 * Best-effort WebGL support check, used to decide whether to mount the MapLibre
 * globe or fall back to the flat Leaflet map. Safe to call outside the browser
 * (returns false when there's no document).
 */
export function hasWebGL(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}
