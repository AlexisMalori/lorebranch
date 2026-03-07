import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { T } from "../../styles/theme";
import { mkStory, STORY_TEMPLATE_BODY } from "../../store";
import { AppImage } from "../../utils/imageUtils";

export default function StoryEditorModal({ mode, story, defaults, characters, nodes, onSave, onCreate, onClose }) {
  const isNew = mode === "new" && !story;
  const [step, setStep] = useState(isNew ? "pick" : "edit");
  const [draft, setDraft] = useState(() => story ? { ...story } : mkStory({ ...defaults, useTemplate: false }));
  const [bodyTab, setBodyTab] = useState("edit");

  const setF = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const toggleChar = (cid) => setDraft(d => ({
    ...d,
    charIds: d.charIds.includes(cid) ? d.charIds.filter(x => x !== cid) : [...d.charIds, cid],
  }));

  const handleStartWithTemplate = (useTemplate) => {
    setDraft(d => ({ ...d, body: useTemplate ? STORY_TEMPLATE_BODY : "" }));
    setStep("edit");
  };

  const charList = Object.values(characters);
  const nodeList = Object.values(nodes);

  if (step === "pick") {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 500 }}>
          <div className="modal-title">New Story Event</div>
          <p style={{ fontFamily: T.fontSerif, fontSize: 15, color: T.textMuted, marginBottom: 20 }}>Start with a template or a blank page?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { useTemplate: true,  label: "Use Template",  sub: "Pre-fills sections: What Happened, Impact, Consequences, Reflections" },
              { useTemplate: false, label: "Blank Page",    sub: "Start with an empty body" },
            ].map(({ useTemplate, label, sub }) => (
              <div
                key={label}
                style={{ border: `1px solid ${T.borderStrong}`, borderRadius: 8, padding: 16, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a96e60"}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.borderStrong}
                onClick={() => handleStartWithTemplate(useTemplate)}
              >
                <div style={{ fontFamily: T.fontSerif, fontSize: 16, color: "#e0d8c8", marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textGhost }}>{sub}</div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 620, maxWidth: 760, maxHeight: "88vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div className="modal-title" style={{ margin: 0, flex: 1 }}>{isNew ? "New Story Event" : "Edit Story Event"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-gold" onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}>Save</button>
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-label">TITLE</div>
          <input type="text" className="inline-input" value={draft.title} onChange={e => setF("title", e.target.value)} placeholder="Name this story event…" style={{ fontSize: 18, fontFamily: T.fontSerif }} />
        </div>

        <div className="modal-section">
          <div className="modal-label">CHARACTERS INVOLVED</div>
          {charList.length === 0
            ? <div style={{ fontFamily: T.fontSerif, fontSize: 13, color: T.textDeep, fontStyle: "italic" }}>No characters in this workspace yet.</div>
            : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {charList.map(ch => {
                  const sel = draft.charIds.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      onClick={() => toggleChar(ch.id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, border: `1px solid ${sel ? T.gold : T.borderStrong}`, background: sel ? "#c9a96e18" : "transparent", cursor: "pointer", transition: "all 0.13s" }}
                    >
                      {ch.portrait && <AppImage src={ch.portrait} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />}
                      <span style={{ fontFamily: T.fontSerif, fontSize: 13, color: sel ? T.gold : T.textDim }}>{ch.name || "Unnamed"}</span>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        <div className="modal-section">
          <div className="modal-label">LINKED STORY NODE <span style={{ color: T.textDeep }}>(optional)</span></div>
          <select
            value={draft.nodeId || ""}
            onChange={e => setF("nodeId", e.target.value || null)}
            style={{ background: T.bgInput, border: `1px solid ${T.borderStrong}`, color: T.textBody, fontFamily: T.fontSerif, fontSize: 14, padding: "7px 10px", borderRadius: 4, outline: "none", width: "100%" }}
          >
            <option value="">— No linked node —</option>
            {nodeList.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>

        <div className="modal-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="modal-label" style={{ margin: 0 }}>NARRATIVE</div>
            <div style={{ display: "flex" }}>
              {["edit", "preview"].map(t => (
                <button key={t} className={`tab-btn${bodyTab === t ? " active" : ""}`} style={{ padding: "4px 12px", fontSize: 9 }} onClick={() => setBodyTab(t)}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {bodyTab === "edit"
            ? <textarea className="md-editor" value={draft.body} rows={14} onChange={e => setF("body", e.target.value)} placeholder="Describe what happened…" />
            : (
              <div style={{ background: T.bgInput, border: `1px solid ${T.borderMid}`, borderRadius: 4, padding: "14px 16px", minHeight: 200, maxHeight: 300, overflowY: "auto" }}>
                <div className="md-content"><ReactMarkdown>{draft.body}</ReactMarkdown></div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}