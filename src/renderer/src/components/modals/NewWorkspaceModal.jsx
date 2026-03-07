import { T } from "../../styles/theme";

export function NewWorkspaceModal({ nameDraft, onChangeName, onCreate, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 360, maxWidth: 420 }}>
        <div className="modal-title">New Workspace</div>
        <div className="modal-section">
          <div className="modal-label">NAME</div>
          <input type="text" className="inline-input" autoFocus value={nameDraft}
            onChange={e => onChangeName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && nameDraft.trim()) onCreate(nameDraft.trim()); }}
            placeholder="Workspace name…" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={() => { if (nameDraft.trim()) onCreate(nameDraft.trim()); }}>Create</button>
        </div>
      </div>
    </div>
  );
}