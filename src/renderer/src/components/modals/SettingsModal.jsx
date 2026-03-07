import { T } from "../../styles/theme";

export function SettingsModal({ wsTitle, settings, workspaceCount, onRename, onToggleAutosave, onImport, onExport, onSaveWorkspace, onDelete, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 480 }}>
        <div className="modal-title">Workspace Settings</div>
        <div className="modal-section">
          <div className="modal-label">WORKSPACE NAME</div>
          <input type="text" className="inline-input" defaultValue={wsTitle}
            onBlur={e => { const v = e.target.value.trim(); if (v) onRename(v); }}
            onKeyDown={e => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) onRename(v); } }} />
        </div>
        <div className="modal-section">
          <div className="modal-label">AUTOSAVE</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="toggle-wrap" onClick={onToggleAutosave}>
              <div className={`toggle${settings.autosave ? " on" : ""}`}><div className="toggle-knob" /></div>
            </div>
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: settings.autosave ? T.greenBright : T.textFaint }}>
              {settings.autosave ? "Enabled — saves 1.5s after changes" : "Disabled — use ↓ Save in toolbar"}
            </span>
          </div>
        </div>
        <div className="modal-section">
          <div className="modal-label">DATA</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onImport}>↑ Import nodes</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onExport}>↓ Export nodes</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onSaveWorkspace}>↓ Save workspace</button>
          </div>
        </div>
        <div className="modal-section">
          <div className="modal-label" style={{ color: T.redBorder }}>DANGER ZONE</div>
          {workspaceCount > 1 && (
            <button className="btn btn-danger" style={{ fontSize: 11 }} onClick={onDelete}>Delete this workspace</button>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-gold" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}