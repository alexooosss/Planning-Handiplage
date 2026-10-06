import React from "react";
import { Minus, Plus, Wand2 } from "lucide-react";
import { SHIFTS, WORK, OFF, fmtH, deM } from "./data.js";

const AV = ["oklch(90% 0.06 262)", "oklch(91% 0.06 352)", "oklch(91% 0.07 158)", "oklch(92% 0.07 85)", "oklch(91% 0.05 30)"];
export const avatarBg = (a) => AV[(a.id || a.name || "x").charCodeAt(1) % AV.length];
export const initials = (a) => ((a.first?.[0] || "") + (a.last?.[0] || "")).toUpperCase() || (a.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** Case horaire : code + repères (v/l veille/lendemain de repos, heures sup, compensation). */
export function Shift({ c, t, size }) {
  const type = c ? c.type : t;
  const title = c ? [SHIFTS[type].label, c.tag === "VR" && "veille de repos", c.tag === "LR" && "lendemain de repos", c.comp && "coupé de compensation", c.ot > 0 && `+${fmtH(c.ot)} sup`].filter(Boolean).join(" · ") : SHIFTS[type].label;
  return (
    <span className={`shift${size ? " " + size : ""}${c?.comp ? " comp" : ""}`} data-t={type} title={title}>
      {type}
      {c?.tag && <span className={`tag ${c.tag}`} aria-hidden="true">{c.tag === "VR" ? "v" : "l"}</span>}
      {c?.ot > 0 && <span className="ot" aria-hidden="true">HS</span>}
    </span>
  );
}
export function Avatar({ a, size = 32, photo }) {
  if (photo) return <img src={photo} alt="" className="avatar" style={{ width: size, height: size, objectFit: "cover" }} />;
  return <span className="avatar" style={{ width: size, height: size, background: avatarBg(a), color: "oklch(24% 0.062 266)", fontSize: size * 0.38 }}>{initials(a)}</span>;
}
export function PersonName({ a }) { return <span className="who-name">{a.first} <b>{a.last.toUpperCase()}</b></span>; }
export function RoleDot({ role }) { return <span className={`role-dot ${role}`} title={{ chef: "Chef·fe d’équipe", adm: "Administratif", agent: "Handiplagiste" }[role]} />; }

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
export function Panel({ title, right, children, className = "", bodyClass = "panel-body", flush }) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && <div className="panel-head">{title && <h2>{title}</h2>}{right && <div className="right">{right}</div>}</div>}
      {flush ? children : <div className={bodyClass}>{children}</div>}
    </section>
  );
}
export function Stepper({ value, onChange, step = 1, min = 0, max = 99, format = (v) => v, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Diminuer" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} disabled={value <= min}><Minus size={15} /></button>
      <output className="num">{format(value)}</output>
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Augmenter" onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} disabled={value >= max}><Plus size={15} /></button>
    </div>
  );
}
export function Field({ label, hint, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
}
export function Legend({ minHalf, extra = true }) {
  return (
    <div className="legend" aria-label="Légende">
      {[...WORK, ...OFF].map((k) => <span key={k}><Shift t={k} size="sm" /><span>{SHIFTS[k].label}{SHIFTS[k].time && <span className="muted"> · {SHIFTS[k].time}</span>}</span></span>)}
      {extra && <>
        <span><span className="mark v">v</span>veille de repos (matin)</span>
        <span><span className="mark l">l</span>lendemain de repos (après-midi)</span>
        <span><span className="mark hs">HS</span>heures sup / coupé de compensation</span>
        {minHalf != null && <span><span className="cov low">3</span>sous le minimum ({minHalf})</span>}
      </>}
    </div>
  );
}
export function NoPlan({ month, onGenerate }) {
  return (
    <div className="panel empty-state">
      <Wand2 size={28} />
      <h2>Pas encore de planning pour {month.toLowerCase()}</h2>
      <p className="muted" style={{ maxWidth: 480 }}>L’équipe {deM(month)} reprend celle du mois précédent. Vérifiez-la dans Équipe, puis générez : tout reste modifiable ensuite.</p>
      {onGenerate && <button className="btn btn-primary" onClick={onGenerate}><Wand2 size={17} />Générer {month.toLowerCase()}</button>}
    </div>
  );
}
export function Cov({ n, min }) { return <span className={`cov ${n < min ? "low" : n === min ? "eq" : "good"}`}>{n}</span>; }
