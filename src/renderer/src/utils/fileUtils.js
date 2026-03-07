// utils/fileUtils.js
// Browser IO helpers — no store or React dependencies.

export function readFileAsText(f) {
  return new Promise((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.onerror = j; rd.readAsText(f); });
}

export function readFileAsDataURL(f) {
  return new Promise((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.onerror = j; rd.readAsDataURL(f); });
}

export function downloadJSON(obj, name) {
  const b = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}