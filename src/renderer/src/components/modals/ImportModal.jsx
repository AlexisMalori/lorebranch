import { T } from "../../styles/theme";

export function ImportModal({ importPayload, importError, importDragOver, importFileRef, onFile, onDragOver, onDragLeave, onDrop, onImport, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Import Nodes</div>
        <div className="modal-section">
          <div className="modal-label">DROP OR SELECT A .DTREE.JSON FILE</div>
          <div className={`drop-zone${importDragOver ? " drag-over" : ""}`}
            onClick={() => importFileRef.current.click()}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
            <div style={{ fontSize: 26, marginBottom: 6, opacity: 0.35 }}>↑</div>
            <div style={{ fontFamily: T.fontSerif, fontSize: 14, color: "#7a7060" }}>Drop file or click to browse</div>
          </div>
          <input ref={importFileRef} type="file" accept=".json,.dtree.json" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {importError && <div className="import-error">⚠ {importError}</div>}
        {importPayload && !importError && (
          <div className="import-preview">
            <div style={{ fontFamily: T.fontSerif, fontSize: 15, color: T.gold, marginBottom: 8 }}>{importPayload.label || "Untitled"}</div>
            <div className="import-meta">
              <div className="import-meta-item"><span className="import-meta-label">Nodes: </span><span className="import-meta-val">{importPayload.nodeCount}</span></div>
              <div className="import-meta-item"><span className="import-meta-label">Edges: </span><span className="import-meta-val">{importPayload.edgeCount}</span></div>
            </div>
            <div className="import-node-list">
              {importPayload.nodes.map(n => (
                <div key={n.id} className="import-node-item">{n.title}<span style={{ color: T.textDeep, fontSize: 11 }}> — {n.type}</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-green"
            disabled={!importPayload || !!importError}
            style={{ opacity: (!importPayload || importError) ? 0.4 : 1 }}
            onClick={onImport}>↑ Import to Canvas</button>
        </div>
      </div>
    </div>
  );
}