// utils/treeUtils.js
// Pure functions for working with the node tree
// No store or React dependencies - safe to import anywhere

export const DTREE_VERSION = "1.0";

export function collectSubtree(nodes, rootIds) {
  const v = new Set(), q = [...rootIds];
  while (q.length) { const id = q.shift(); if (v.has(id) || !nodes[id]) continue; v.add(id); nodes[id].children.forEach(c => q.push(c)); }
  return v;
}

export function buildExport(nodes, nodeIds, label) {
  const list = [...nodeIds].map(id => nodes[id]).filter(Boolean);
  const edges = [];
  list.forEach(n => n.children.forEach(c => { if (nodeIds.has(c)) edges.push({ from: n.id, to: c }); }));
  return {
    dtree: DTREE_VERSION, exportedAt: new Date().toISOString(), label,
    nodeCount: list.length, edgeCount: edges.length,
    nodes: list.map(n => ({ id: n.id, title: n.title, body: n.body, type: n.type, editedAt: n.editedAt, x: Math.round(n.x), y: Math.round(n.y), color: n.color || "none", icon: n.icon || null, images: n.images || [] })),
    edges,
  };
}

export function validateImport(obj) {
  if (!obj || typeof obj !== "object") return "Not a valid JSON object.";
  if (obj.dtree !== DTREE_VERSION) return `Unknown version "${obj.dtree}". Expected "${DTREE_VERSION}".`;
  if (!Array.isArray(obj.nodes)) return "Missing 'nodes' array.";
  if (!Array.isArray(obj.edges)) return "Missing 'edges' array.";
  for (const n of obj.nodes) if (!n.id || !n.title) return "Node missing required fields.";
  return null;
}

// freshId is passed as a parameter to avoid a dependency on the store.
export function mergeImport(existing, payload, freshId, offX = 100, offY = 100) {
  const map = {};
  payload.nodes.forEach(n => { map[n.id] = freshId(); });
  const nw = {};
  payload.nodes.forEach(n => {
    const nid = map[n.id];
    nw[nid] = { id: nid, title: n.title, body: n.body || "", type: n.type || "Narrative", editedAt: n.editedAt || new Date().toISOString(), x: (n.x || 0) + offX, y: (n.y || 0) + offY, color: n.color || "none", icon: n.icon || null, images: n.images || [], children: [] };
  });
  payload.edges.forEach(e => { const f = map[e.from], t = map[e.to]; if (f && t && nw[f] && !nw[f].children.includes(t)) nw[f].children.push(t); });
  return { ...existing, ...nw };
}

export function getParents(nodes, id) {
  return Object.values(nodes).filter(n => n.children.includes(id));
}