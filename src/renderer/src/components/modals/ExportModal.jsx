import { T, getGlowColor } from "../../styles/theme";
import { collectSubtree, getParents } from "../../utils/treeUtils";

export function ExportModal({ nodes, exportLabel, exportMode, exportRoots, onChangeLabel, onChangeMode, onToggleRoot, onExport, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Export Nodes</div>
        <div className="modal-section">
          <div className="modal-label">EXPORT LABEL</div>
          <input type="text" className="inline-input" value={exportLabel} onChange={e => onChangeLabel(e.target.value)} placeholder="Label…" />
        </div>
        <div className="modal-section">
          <div className="modal-label">SCOPE</div>
          {[
            { id: "all",     text: "All nodes",                sub: `${Object.keys(nodes).length} nodes total` },
            { id: "subtree", text: "Selected roots + subtrees", sub: "Choose below" },
          ].map(o => (
            <div key={o.id} className="radio-row" onClick={() => onChangeMode(o.id)}>
              <div className={`radio-dot${exportMode === o.id ? " active" : ""}`} />
              <div>
                <div className="radio-label" style={{ color: T.textBody }}>{o.text}</div>
                <div className="radio-label" style={{ fontSize: 9, color: T.textGhost, marginTop: 1 }}>{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        {exportMode === "subtree" && (
          <div className="modal-section">
            <div className="modal-label" style={{ marginBottom: 6 }}>ROOT NODES</div>
            <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${T.borderMid}`, borderRadius: 5, padding: "4px 0" }}>
              {Object.values(nodes).map(n => {
                const isRoot  = getParents(nodes, n.id).length === 0;
                const checked = exportRoots.includes(n.id);
                const sz      = collectSubtree(nodes, [n.id]).size;
                const gc      = getGlowColor(n.color);
                return (
                  <div key={n.id} className="node-picker-row" onClick={() => onToggleRoot(n.id)}>
                    <div className={`node-picker-check${checked ? " checked" : ""}`}>{checked ? "✓" : ""}</div>
                    {gc.glow && <div style={{ width: 7, height: 7, borderRadius: "50%", background: gc.glow, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0, fontFamily: T.fontSerif, fontSize: 13, color: T.textBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, flexShrink: 0 }}>
                      {sz}n{isRoot ? <span style={{ color: "#c9a96e88", marginLeft: 4 }}>root</span> : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            {exportRoots.length > 0 && (
              <div style={{ fontFamily: T.fontMono, fontSize: 10, color: "#7a9060", marginTop: 6 }}>
                → {collectSubtree(nodes, exportRoots).size} nodes will export
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-green" onClick={onExport}>↓ Download .dtree.json</button>
        </div>
      </div>
    </div>
  );
}