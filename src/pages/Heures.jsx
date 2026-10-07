import React, { useState } from "react";
import { Download, Lock, Plus, X, Check } from "lucide-react";
import { SHIFTS, OT_ADD, ROLES, keyOf, fmtH, shortDay, totalsFor, deM, downloadHoursCsv } from "../data.js";
import { PageHead, Panel, NoPlan, Avatar, PersonName, Shift } from "../ui.jsx";

export default function Heures({ team, plan, dates, mk, mName, months, monthTeams, plans, archives, season, generate, setCell, say }) {
  const [sort, setSort] = useState("total");
  const [selId, setSelId] = useState(team.find((a) => a.role === "agent")?.id || "");
  if (!plan) return <><PageHead title="Heures" /><NoPlan month={mName} onGenerate={generate} /></>;
  const exportCsv = () => {
    downloadHoursCsv(team, dates, plan, mk);
    say("Décompte des heures téléchargé (.csv), à ouvrir dans Excel.");
  };
  const rows = team.map((a) => ({ a, ...totalsFor(a, dates, plan) })).sort((x, y) => (sort === "name" ? x.a.last.localeCompare(y.a.last) : sort === "ot" ? y.ot - x.ot : y.total - x.total));
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const avg = sum("total") / rows.length, maxT = Math.max(...rows.map((r) => r.total)), maxOT = Math.max(1, ...rows.map((r) => r.ot));

  const other = (h) => (h === "M" ? "AM" : "M");
  const dispo = (c) => {
    if (!c || c.type === "R") return { state: "rest" };
    if (c.manual && c.comp) return { state: "added", half: c.compHalf };
    if (c.type === "M" || c.type === "AM") return c.tag ? { state: "locked", reason: c.tag === "VR" ? "veille de repos" : "lendemain de repos" } : { state: "free", half: other(c.type) };
    if (c.type === "CP") return { state: "locked", reason: c.comp ? "coupé de compensation" : "déjà en coupé" };
    if (c.type === "AD") return { state: "locked", reason: "administratif" };
    return { state: "locked", reason: SHIFTS[c.type].label.toLowerCase() };
  };
  const sel = team.find((a) => a.id === selId);
  const selDays = sel ? dates.filter((d) => plan[sel.id][keyOf(d)]?.type !== "R") : [];
  const freeN = selDays.filter((d) => dispo(plan[sel.id][keyOf(d)]).state === "free").length;

  return (
    <>
      <PageHead title={`Heures ${deM(mName)}`} sub={`${team.length} personnes · ${fmtH(sum("total"))} au total dont ${fmtH(sum("ot"))} d’heures sup · moyenne ${fmtH(avg)} par personne`}>
        <div className="seg" role="group" aria-label="Trier"><button aria-pressed={sort === "total"} onClick={() => setSort("total")}>Total</button><button aria-pressed={sort === "ot"} onClick={() => setSort("ot")}>Heures sup</button><button aria-pressed={sort === "name"} onClick={() => setSort("name")}>Nom</button></div>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Download size={15} />Exporter pour la paie (.csv)</button>
      </PageHead>

      <div className="split" style={{ gridTemplateColumns: "minmax(0, 1fr) 360px" }}>
        <Panel title="Décompte par personne" right={<span className="muted small">Base = horaires affectés · Sup = compléments et ajouts</span>} flush>
          <div style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Personne</th><th className="r">Jours</th><th className="r">Coupés</th><th className="r">Base</th><th className="r">Sup.</th><th className="r">Total</th><th style={{ width: "20%" }}>Écart au mois</th></tr></thead>
              <tbody>
                {rows.map(({ a, base, ot, worked, cp, total }) => {
                  const delta = total - avg;
                  return (
                    <tr key={a.id} className={a.id === selId ? "is-sel" : undefined} onClick={() => setSelId(a.id)} style={{ cursor: "pointer" }}>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar a={a} size={28} /><PersonName a={a} /><span className="muted small">{ROLES[a.role].short}</span></div></td>
                      <td className="r num">{worked}</td>
                      <td className="r num">{cp}</td>
                      <td className="r num">{fmtH(base)}</td>
                      <td className="r num">{ot ? <span className="chip magenta">+{fmtH(ot)}</span> : <span className="muted">·</span>}</td>
                      <td className="r num"><b>{fmtH(total)}</b></td>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="bar" style={{ flex: 1 }}><i style={{ width: `${(total / maxT) * 100}%` }} /></div><span className="num small" style={{ minWidth: 50, textAlign: "right", color: Math.abs(delta) > 12 ? "var(--warn)" : "var(--ink-3)" }}>{delta >= 0 ? "+" : "−"}{fmtH(Math.abs(delta))}</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Ajouter des heures sup" flush>
          <div className="panel-body" style={{ gap: 10 }}>
            <p className="hint" style={{ marginTop: 0 }}>Complétez une demi-journée disponible : elle passe en coupé et l’allongement (+{fmtH(OT_ADD)}) compte en heures sup.</p>
            <select className="select" value={selId} onChange={(e) => setSelId(e.target.value)} aria-label="Personne">
              {team.map((a) => <option key={a.id} value={a.id}>{a.first} {a.last.toUpperCase()}</option>)}
            </select>
            {sel && <p className="small muted">{freeN} jour(s) disponible(s) en {mName.toLowerCase()}.</p>}
          </div>
          <div className="ot-list">
            {selDays.map((d) => {
              const dk = keyOf(d), c = plan[sel.id][dk], info = dispo(c);
              return (
                <div key={dk} className="ot-row">
                  <span className="num small" style={{ width: 74, whiteSpace: "nowrap" }}>{shortDay(d)}</span>
                  <Shift c={c} size="sm" />
                  <span className="ot-act">
                    {info.state === "free" && <button className="btn btn-ghost btn-sm" onClick={() => setCell(sel.id, dk, { type: "CP", comp: true, manual: true, compHalf: info.half, tag: null, ot: (c.ot || 0) + OT_ADD })}><Plus size={13} />{info.half === "AM" ? "après-midi" : "matin"} · +{fmtH(OT_ADD)}</button>}
                    {info.state === "added" && <><span className="chip ok"><Check size={12} />complété</span><button className="icon-btn" aria-label="Retirer" onClick={() => setCell(sel.id, dk, { type: info.half === "AM" ? "M" : "AM", comp: false, manual: false, compHalf: null, ot: 0 })}><X size={15} /></button></>}
                    {info.state === "locked" && <span className="muted small"><Lock size={11} /> {info.reason}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
