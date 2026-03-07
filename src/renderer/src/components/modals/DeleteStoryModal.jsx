import { T } from "../../styles/theme";

export function DeleteStoryModal({ storyTitle, onDeleteThis, onDeleteAll, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 380, maxWidth: 440 }}>
        <div className="modal-title">Remove Story Event</div>
        <p style={{ fontFamily: T.fontSerif, fontSize: 15, color: T.textMuted, marginBottom: 20 }}>
          How would you like to remove <strong style={{ color: T.textPrimary }}>{storyTitle || "this story"}</strong>?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-ghost" style={{ textAlign: "left", padding: "10px 14px" }} onClick={onDeleteThis}>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textBody }}>Remove from this character only</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textGhost, marginTop: 2 }}>Other characters and the node link are preserved</div>
          </button>
          <button className="btn btn-danger" style={{ textAlign: "left", padding: "10px 14px" }} onClick={onDeleteAll}>
            <div style={{ fontFamily: T.fontMono, fontSize: 11 }}>Delete story everywhere</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.redBorder, marginTop: 2 }}>Removes from all characters and unlinks from any node</div>
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}