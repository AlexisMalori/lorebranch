// ── THEME ─────────────────────────────────────────────────────────────────────
export const T = {
  fontSerif:   "'Crimson Pro', serif",
  fontMono:    "'JetBrains Mono', monospace",
  bgApp:       "#1a1814",
  bgPanel:     "#16140f",
  bgSidebar:   "#131110",
  bgCard:      "#1e1c18",
  bgSurface:   "#181613",
  bgInput:     "#141210",
  bgDeep:      "#252220",
  borderStrong:"#3a3530",
  borderMid:   "#2a2520",
  borderSub:   "#2e2c26",
  borderFaint: "#242220",
  borderDeep:  "#222018",
  borderDark:  "#1e1c18",
  textPrimary: "#e8e0d0",
  textBody:    "#d0c8b8",
  textMuted:   "#a09080",
  textDim:     "#8a8070",
  textFaint:   "#6a6058",
  textGhost:   "#5a5448",
  textDeep:    "#4a4540",
  textInvis:   "#3a3530",
  textTiny:    "#333028",
  gold:        "#c9a96e",
  goldHover:   "#d4b87a",
  goldDim:     "#c9a96e18",
  goldBorder:  "#c9a96e40",
  goldActive:  "#c9a96e80",
  green:       "#507840",
  greenHover:  "#608850",
  greenText:   "#d0e8c8",
  greenBright: "#90c870",
  greenToggle: "#70a860",
  red:         "#c06060",
  redBorder:   "#6a3030",
  redBg:       "#3a1818",
  redText:     "#e08080",
  redDim:      "#6a303020",
  redImg:      "#c06060dd",
  statPos:     "#90c870",
  statNeg:     "#c06868",
  edgeDefault: "#4a4030",
  gridLine:    "#252220",
  selectRect:  "#c9a96e0a",
  scrollThumb: "#4a4540",
};

export const DEFAULT_EDGE = "#4a4030";

export const GLOW_COLORS = [
  { id: "none",   label: "None",   glow: null },
  { id: "amber",  label: "Amber",  glow: T.gold },
  { id: "rose",   label: "Rose",   glow: "#d06080" },
  { id: "sky",    label: "Sky",    glow: "#60a8d0" },
  { id: "sage",   label: "Sage",   glow: "#70b090" },
  { id: "violet", label: "Violet", glow: "#9070c0" },
  { id: "peach",  label: "Peach",  glow: "#d08860" },
];

export function getGlowColor(id) { return GLOW_COLORS.find(c => c.id === id) || GLOW_COLORS[0]; }

// ── CSS ───────────────────────────────────────────────────────────────────────
export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  html,body,#root{margin:0;padding:0;width:100%;height:100%;}
  *{box-sizing:border-box;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:${T.bgApp};}
  ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:3px;}
  .btn{cursor:pointer;border:none;font-family:${T.fontMono};font-size:11px;letter-spacing:0.05em;padding:6px 14px;border-radius:3px;transition:all 0.15s;}
  .btn-gold{background:${T.gold};color:${T.bgApp};}.btn-gold:hover{background:${T.goldHover};}
  .btn-ghost{background:transparent;color:${T.textDim};border:1px solid ${T.borderStrong};}.btn-ghost:hover{border-color:${T.textFaint};color:${T.textBody};}
  .btn-danger{background:transparent;color:${T.red};border:1px solid ${T.redBorder};}.btn-danger:hover{background:${T.redDim};}
  .btn-green{background:${T.green};color:${T.greenText};border:none;}.btn-green:hover{background:${T.greenHover};}
  .md-content h1{font-size:1.6em;font-weight:600;color:${T.textPrimary};margin:0 0 0.5em;border-bottom:1px solid ${T.borderStrong};padding-bottom:0.3em;}
  .md-content h2{font-size:1.3em;font-weight:600;color:#d8d0c0;margin:1em 0 0.4em;}
  .md-content h3{font-size:1.1em;font-weight:600;color:${T.gold};margin:0.8em 0 0.3em;letter-spacing:0.05em;}
  .md-content p{line-height:1.75;margin:0 0 0.8em;color:#ccc4b4;}
  .md-content strong{color:${T.textPrimary};font-weight:600;}
  .md-content em{color:${T.gold};font-style:italic;}
  .md-content code{font-family:${T.fontMono};font-size:0.85em;background:${T.borderMid};padding:1px 5px;border-radius:3px;color:#90c080;}
  .md-content blockquote{border-left:3px solid ${T.gold};margin:0.8em 0;padding:0.3em 1em;color:${T.textMuted};font-style:italic;background:#22201c;}
  .md-content ul,.md-content ol{padding-left:1.5em;margin:0.5em 0;}
  .md-content li{line-height:1.7;color:#ccc4b4;}
  .md-content hr{border:none;border-top:1px solid ${T.borderStrong};margin:1.5em 0;}
  .tab-btn{background:none;border:none;cursor:pointer;font-family:${T.fontMono};font-size:11px;letter-spacing:0.08em;padding:8px 18px;color:${T.textGhost};border-bottom:2px solid transparent;transition:all 0.15s;}
  .tab-btn.active{color:${T.gold};border-bottom-color:${T.gold};}
  textarea.md-editor{width:100%;background:${T.bgInput};border:1px solid ${T.borderStrong};color:${T.textBody};font-family:${T.fontMono};font-size:13px;line-height:1.7;padding:16px;resize:vertical;border-radius:4px;outline:none;}
  textarea.md-editor:focus{border-color:${T.goldBorder};}
  input.field-input{background:${T.bgInput};border:1px solid ${T.borderStrong};color:${T.textBody};font-family:${T.fontSerif};font-size:15px;padding:8px 12px;border-radius:4px;outline:none;width:100%;}
  input.field-input:focus{border-color:${T.goldBorder};}
  input[type=text].inline-input{background:${T.bgInput};border:1px solid ${T.borderStrong};color:${T.textBody};font-family:${T.fontSerif};font-size:14px;padding:7px 10px;border-radius:4px;outline:none;width:100%;}
  input[type=text].inline-input:focus{border-color:${T.goldBorder};}
  input[type=number]{-moz-appearance:textfield;}
  input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
  .node-card{transition:all 0.15s;}
  .node-card:hover .node-inner{filter:brightness(1.1);}
  .connect-btn{opacity:0;transition:opacity 0.15s;}
  .node-card:hover .connect-btn{opacity:1;}
  .color-swatch{width:16px;height:16px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform 0.15s,border-color 0.15s;flex-shrink:0;}
  .color-swatch:hover{transform:scale(1.25);}
  .image-thumb{position:relative;border-radius:6px;overflow:hidden;}
  .image-thumb:hover .img-remove{opacity:1;}
  .img-remove{position:absolute;top:4px;right:4px;opacity:0;background:${T.redImg};border:none;border-radius:50%;width:22px;height:22px;color:white;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:opacity 0.15s;padding:0;}
  .icon-hover-overlay{opacity:0;transition:opacity 0.15s;position:absolute;inset:0;border-radius:7px;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;font-family:${T.fontMono};font-size:9px;color:#fff;letter-spacing:0.1em;}
  .icon-wrap:hover .icon-hover-overlay{opacity:1;}
  .modal-backdrop{position:fixed;inset:0;background:rgba(10,9,8,0.88);z-index:100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);}
  .modal-box{background:${T.bgCard};border:1px solid ${T.borderStrong};border-radius:10px;padding:24px 26px;min-width:440px;max-width:580px;width:100%;box-shadow:0 24px 80px #00000090;max-height:90vh;overflow-y:auto;}
  .modal-title{font-family:${T.fontSerif};font-size:20px;font-weight:600;color:${T.textPrimary};margin:0 0 18px;}
  .modal-section{margin-bottom:16px;}
  .modal-label{font-family:${T.fontMono};font-size:10px;color:${T.textFaint};letter-spacing:0.1em;margin-bottom:7px;}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:22px;padding-top:16px;border-top:1px solid ${T.borderMid};}
  .node-picker-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:4px;cursor:pointer;transition:background 0.1s;}
  .node-picker-row:hover{background:${T.borderMid};}
  .node-picker-check{width:14px;height:14px;border-radius:3px;border:1px solid ${T.textGhost};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;transition:all 0.1s;}
  .node-picker-check.checked{background:${T.gold};border-color:${T.gold};color:${T.bgApp};}
  .drop-zone{border:2px dashed ${T.borderStrong};border-radius:8px;padding:32px 0;text-align:center;cursor:pointer;transition:border-color 0.15s,background 0.15s;}
  .drop-zone.drag-over{border-color:${T.gold};background:${T.goldDim};}
  .import-preview{background:${T.bgInput};border:1px solid ${T.borderMid};border-radius:6px;padding:14px 16px;margin-top:12px;}
  .import-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;}
  .import-meta-item{font-family:${T.fontMono};font-size:10px;}
  .import-meta-label{color:${T.textGhost};}.import-meta-val{color:${T.textBody};}
  .import-node-list{margin-top:8px;max-height:120px;overflow-y:auto;}
  .import-node-item{font-family:${T.fontSerif};font-size:13px;color:${T.textMuted};padding:2px 0;border-bottom:1px solid #252220;}
  .import-node-item:last-child{border-bottom:none;}
  .import-error{background:${T.redBg};border:1px solid ${T.redBorder};border-radius:6px;padding:10px 14px;margin-top:10px;font-family:${T.fontMono};font-size:11px;color:${T.redText};}
  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);font-family:${T.fontMono};font-size:11px;padding:8px 18px;border-radius:4px;z-index:200;pointer-events:none;animation:toastIn 0.2s ease;white-space:nowrap;}
  .toast.ok{background:#2a3820;border:1px solid ${T.green};color:${T.greenBright};}
  .toast.err{background:${T.redBg};border:1px solid ${T.redBorder};color:${T.redText};}
  .toast.saving{background:#252018;border:1px solid ${T.goldBorder};color:${T.gold};}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
  .radio-row{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;}
  .radio-dot{width:14px;height:14px;border-radius:50%;border:1px solid ${T.textGhost};flex-shrink:0;display:flex;align-items:center;justify-content:center;}
  .radio-dot.active{border-color:${T.gold};}
  .radio-dot.active::after{content:'';width:7px;height:7px;border-radius:50%;background:${T.gold};display:block;}
  .radio-label{font-family:${T.fontMono};font-size:11px;color:${T.textMuted};}
  .toggle-wrap{cursor:pointer;}
  .toggle{width:36px;height:20px;border-radius:10px;background:${T.borderMid};border:1px solid ${T.scrollThumb};position:relative;transition:background 0.2s,border-color 0.2s;}
  .toggle.on{background:${T.green};border-color:${T.greenToggle};}
  .toggle-knob{width:14px;height:14px;border-radius:50%;background:${T.textDim};position:absolute;top:2px;left:2px;transition:left 0.2s,background 0.2s;}
  .toggle.on .toggle-knob{left:18px;background:${T.greenText};}
  select option{background:${T.bgCard};color:${T.textBody};}
`;