import React, { useState, useEffect } from "react";
import { AlertTriangle, ArrowRight, ArrowLeftRight, CalendarDays, CheckCircle2, Inbox, Lock, Plus, Wand2, X, Archive, Flag } from "lucide-react";
import { SHIFTS, WORK, OFF, OT_ADD, ROLES, WD, WD_FULL, keyOf, addDays, fmtH, cap, dayLabel, totalsFor, deM } from "../data.js";
import { Shift, Avatar, PersonName, RoleDot, PageHead, Legend, NoPlan, Stepper, Cov } from "../ui.jsx";

export const halfCounts = (team, plan, d) => {
  const dk = keyOf(d); let m = 0, am = 0;
  team.forEach((a) => { const t = plan[a.id]?.[dk]?.type; if (t === "M" || t === "CP") m++; if (t === "AM" || t === "CP") am++; });
  return { m, am };
};
// Règles de permutation du site actuel : demi-journée simple, pas de repos la veille ni le lendemain, même fonction
export function swapInfo(plan, id, d) {
  const c = plan[id]?.[keyOf(d)];
  if (!c || (c.type !== "M" && c.type !== "AM")) return { ok: false, reason: c ? (c.type === "CP" ? "en coupé" : SHIFTS[c.type].label.toLowerCase()) : "—" };
  if (plan[id]?.[keyOf(addDays(d, -1))]?.type === "R") return { ok: false, half: c.type, reason: "lendemain de repos" };
  if (plan[id]?.[keyOf(addDays(d, 1))]?.type === "R") return { ok: false, half: c.type, reason: "veille de repos" };
  return { ok: true, half: c.type };
}

export default function Planning(p) {
  const { team, plan, dates, mk, mName, season, sel, setSel, dayNotes, setDayNotes, happenings, pending, setPage, generate, archived, validate, today } = p;
  const [filter, setFilter] = useState("all");
  const [noteEdit, setNoteEdit] = useState(null);
  // Échap ferme le panneau de détail
  useEffect(() => {
    if (!p.sel) return;
    const onKey = (e) => e.key === "Escape" && e.target.tagName !== "INPUT" && p.setSel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.sel]);
  if (!plan) return <><PageHead title={`Planning ${deM(mName)}`} /><NoPlan month={mName} onGenerate={generate} /></>;
  const counts = dates.map((d) => ({ d, ...halfCounts(team, plan, d) }));
  const lows = counts.flatMap((c) => [c.m < season.minHalf && { ...c, half: "matin", n: c.m }, c.am < season.minHalf && { ...c, half: "après-midi", n: c.am }].filter(Boolean));
  const rows = team.filter((a) => filter === "all" || a.role === filter);
  const evByDay = Object.fromEntries(happenings.map((e) => [e.date, e]));
  const chefsAlone = counts.filter((c) => { const ch = team.filter((a) => a.role === "chef").map((a) => plan[a.id][keyOf(c.d)]?.type); return ch.length === 2 && ch[0] === ch[1] && (ch[0] === "M" || ch[0] === "AM"); }).length;

  return (
    <>
      <PageHead title={`Planning ${deM(mName)}`} sub={`${dates[0].getDate()} → ${dates[dates.length - 1].getDate()} ${mName.toLowerCase()} · ${dates.length} jours d’ouverture · ${team.length} personnes · ${archived ? `validé le ${archived.validatedAt}` : "brouillon, non validé"}`}>
        <div className="seg" role="group" aria-label="Filtrer l’équipe">
          {[["all", "Tous"], ["chef", "Chef·fes"], ["agent", "Handiplagistes"], ["adm", "Administratif"]].map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={generate}><Wand2 size={15} />Régénérer</button>
      </PageHead>

      <div className="todo" aria-label="À traiter">
        {lows.length > 0
          ? <button className="todo-item danger" onClick={() => setSel({ day: keyOf(lows[0].d) })}><AlertTriangle size={16} />Effectif insuffisant : {lows.length} demi-journée{lows.length > 1 ? "s" : ""} sous {season.minHalf} ({lows.slice(0, 3).map((l) => `${WD[l.d.getDay()]} ${l.d.getDate()} ${l.half}`).join(", ")}{lows.length > 3 ? "…" : ""})<ArrowRight size={15} className="arrow" /></button>
          : <span className="todo-item ok"><CheckCircle2 size={16} />Toutes les demi-journées ont au moins {season.minHalf} personnes</span>}
        {pending.length > 0 && <button className="todo-item magenta" onClick={() => setPage("demandes")}><Inbox size={16} />{pending.length} demande{pending.length > 1 ? "s" : ""} d’agents en attente<ArrowRight size={15} className="arrow" /></button>}
        <span className={`todo-item ${chefsAlone ? "warn" : "ok"}`}>{chefsAlone ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{chefsAlone ? `${chefsAlone} jour(s) avec les 2 chef·fes sur la même demi-journée` : "Les 2 chef·fes ne sont jamais seul·es sur la même demi-journée"}</span>
        {!archived && <button className="todo-item neutral" onClick={validate}><Archive size={16} />Valider {mName.toLowerCase()} pour l’archiver et le publier<ArrowRight size={15} className="arrow" /></button>}
      </div>

      <div className={`plan-wrap${sel ? " open" : ""}`}>
        <div className="grid-scroll" role="region" aria-label="Grille du planning" tabIndex={0}>
          <table className="plan" style={{ minWidth: 200 + dates.length * 28 }}>
            <thead>
              <tr>
                <th className="who">Équipe · total du mois</th>
                {dates.map((d, i) => {
                  const dk = keyOf(d), we = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th key={i} className={[we && "we", d.getDay() === 1 && i > 0 && "wk", dk === today && "today", sel?.day === dk && "sel"].filter(Boolean).join(" ")}>
                      <button className="day-btn" onClick={() => setSel(sel?.day === dk && !sel.id ? null : { day: dk })} aria-label={`Voir le ${dayLabel(d)}`}>
                        <span className="w">{WD[d.getDay()]}</span><span className="d">{d.getDate()}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
              <tr className="notes-row">
                <th className="who"><Flag size={13} /> Événement du jour</th>
                {dates.map((d, i) => {
                  const dk = keyOf(d), ev = evByDay[dk], note = dayNotes[dk];
                  return (
                    <th key={i} className={d.getDay() === 1 && i > 0 ? "wk" : undefined}>
                      {noteEdit === dk ? (
                        <input autoFocus className="note-input" defaultValue={note || ""} aria-label={`Mention du ${d.getDate()}`}
                          onBlur={(e) => { setDayNotes({ ...dayNotes, [dk]: e.target.value.toUpperCase() }); setNoteEdit(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
                      ) : (
                        <button className={`note-chip${note ? " on" : ""}${ev ? " ev" : ""}`} title={[note, ev && `${ev.time.replace(":", "h")} · ${ev.title}`].filter(Boolean).join(" — ") || "Ajouter une mention"} onClick={() => setNoteEdit(dk)}>
                          {note ? note.slice(0, 6) : ev ? "•" : "+"}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const t = totalsFor(a, dates, plan);
                return (
                  <tr key={a.id}>
                    <th className="who" scope="row">
                      <div className="who-cell"><RoleDot role={a.role} /><PersonName a={a} /><span className="who-meta" title={`Base ${fmtH(t.base)} + sup ${fmtH(t.ot)}`}>{fmtH(t.total)}</span></div>
                    </th>
                    {dates.map((d, i) => {
                      const dk = keyOf(d), c = plan[a.id][dk] || { type: "R", ot: 0 };
                      const we = d.getDay() === 0 || d.getDay() === 6, on = sel?.id === a.id && sel?.day === dk;
                      return (
                        <td key={i} className={["cell", we && "we", d.getDay() === 1 && i > 0 && "wk", sel?.day === dk && "selcol"].filter(Boolean).join(" ")}>
                          <button className="cell-btn" aria-pressed={on} aria-label={`${a.first} ${a.last}, ${dayLabel(d)} : ${SHIFTS[c.type].label}`} onClick={() => setSel(on ? null : { id: a.id, day: dk })}>
                            <Shift c={c} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {[["Matin", "m"], ["Après-midi", "am"]].map(([label, k]) => (
                <tr key={k}>
                  <th className="who" scope="row">{label} <span className="muted" style={{ fontWeight: 500 }}>· min {season.minHalf}</span></th>
                  {counts.map((c, i) => <td key={i} className={c.d.getDay() === 1 && i > 0 ? "wk" : undefined}><Cov n={c[k]} min={season.minHalf} /></td>)}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        {sel && <Inspector {...p} counts={counts} lows={lows} />}
      </div>
      <Legend minHalf={season.minHalf} />
    </>
  );
}

function Inspector({ team, plan, dates, sel, setSel, setCell, swapCells, counts, lows, season, happenings, dayNotes }) {
  if (!sel) {
    return (
      <aside className="panel inspector" aria-label="Détail">
        <div className="panel-head"><h2>Détail</h2></div>
        <div className="panel-body">
          <p className="muted">Cliquez une case pour changer l’horaire, ajouter des heures sup ou permuter. Cliquez une date pour voir la journée.</p>
          {lows.length > 0 && (
            <div>
              <span className="field-label">Demi-journées à renforcer</span>
              <div className="swap-list">
                {lows.map((l, i) => (
                  <button key={i} className="swap-row" onClick={() => setSel({ day: keyOf(l.d) })}>
                    <span className="cov low">{l.n}</span>{WD_FULL[l.d.getDay()]} {l.d.getDate()} · {l.half}<span className="go">Voir</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }
  const d = dates.find((x) => keyOf(x) === sel.day);
  if (!d) return null;
  const cnt = counts.find((c) => keyOf(c.d) === sel.day);
  const ev = happenings.find((e) => e.date === sel.day);
  const head = (
    <div className="panel-head">
      <h2>{cap(WD_FULL[d.getDay()])} {d.getDate()}</h2>
      <div className="right"><button className="icon-btn" aria-label="Fermer" onClick={() => setSel(null)}><X size={18} /></button></div>
    </div>
  );
  const dayInfo = (
    <>
      {(ev || dayNotes[sel.day]) && <div className="note brand"><CalendarDays size={16} /><span>{dayNotes[sel.day] && <b>{dayNotes[sel.day]} </b>}{ev && <>{ev.time.replace(":", "h")} · {ev.title}{ev.instructions && <span className="block muted">{ev.instructions}</span>}</>}</span></div>}
      <dl className="kv">
        <dt>Matin (min {season.minHalf})</dt><dd><Cov n={cnt.m} min={season.minHalf} /></dd>
        <dt>Après-midi (min {season.minHalf})</dt><dd><Cov n={cnt.am} min={season.minHalf} /></dd>
      </dl>
    </>
  );

  // Vue journée : qui est où
  if (!sel.id) {
    const groups = [["Matin", (t) => t === "M"], ["Après-midi", (t) => t === "AM"], ["Coupé (journée)", (t) => t === "CP"], ["Administratif", (t) => t === "AD"], ["Absents", (t) => OFF.includes(t)]];
    return (
      <aside className="panel inspector" aria-label="Détail de la journée">
        {head}
        <div className="panel-body">
          {dayInfo}
          {groups.map(([g, f]) => {
            const ppl = team.filter((a) => f(plan[a.id][sel.day]?.type));
            if (!ppl.length) return null;
            return (
              <div key={g}>
                <span className="field-label">{g} · {ppl.length}</span>
                <div className="swap-list">
                  {ppl.map((a) => <button key={a.id} className="swap-row" onClick={() => setSel({ id: a.id, day: sel.day })}><Shift c={plan[a.id][sel.day]} size="sm" /><RoleDot role={a.role} /><span>{a.first} {a.last.toUpperCase()}</span><span className="go">Modifier</span></button>)}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    );
  }

  const a = team.find((x) => x.id === sel.id);
  const c = plan[a.id][sel.day];
  const me = swapInfo(plan, a.id, d);
  const mates = team.filter((b) => b.id !== a.id && b.role === a.role && (plan[b.id][sel.day]?.type === "M" || plan[b.id][sel.day]?.type === "AM") && plan[b.id][sel.day]?.type !== c.type)
    .map((b) => ({ b, info: swapInfo(plan, b.id, d) }));
  const removesMin = (c.type === "M" || c.type === "CP") && cnt.m <= season.minHalf || (c.type === "AM" || c.type === "CP") && cnt.am <= season.minHalf;
  const canComplete = (c.type === "M" || c.type === "AM") && !c.tag;
  const other = c.type === "M" ? "AM" : "M";

  return (
    <aside className="panel inspector" aria-label="Détail de la case">
      {head}
      <div className="panel-body">
        <div className="insp-who">
          <Avatar a={a} size={40} />
          <div><h3>{a.first} {a.last.toUpperCase()}</h3><p>{ROLES[a.role].label}{a.role === "chef" ? ` · repos le ${WD_FULL[a.restDay]}` : a.role === "adm" ? " · repos mer. et jeu." : " · repos tous les 6 jours"}</p></div>
        </div>
        {(c.tag || c.comp) && <div className="note"><Lock size={15} /><span>{c.tag === "VR" ? "Veille de repos : matin imposé (coupure de 48 h)." : c.tag === "LR" ? "Lendemain de repos : après-midi imposé (coupure de 48 h)." : `Coupé de compensation : ${c.compHalf === "M" ? "matin" : "après-midi"} ajouté pour tenir le minimum.`}</span></div>}

        <div>
          <span className="field-label">Horaire</span>
          <div className="shift-pick" role="group" aria-label="Horaire">
            {[...WORK, ...OFF].map((k) => (
              <button key={k} className="shift-opt" aria-pressed={c.type === k} onClick={() => k !== c.type && setCell(a.id, sel.day, { type: k, comp: false, compHalf: null, manual: false, tag: null, ot: OFF.includes(k) ? 0 : c.comp ? Math.max(0, +((c.ot || 0) - OT_ADD).toFixed(4)) : c.ot || 0 })}>
                <Shift t={k} size="sm" /><span>{SHIFTS[k].label}</span>
              </button>
            ))}
          </div>
          {SHIFTS[c.type].time && <p className="muted small" style={{ marginTop: 8 }}>{SHIFTS[c.type].time} · {fmtH(SHIFTS[c.type].hours)}{c.ot ? ` + ${fmtH(c.ot)} sup` : ""}</p>}
        </div>

        {WORK.includes(c.type) && (
          <div>
            <span className="field-label">Heures supplémentaires</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Stepper value={c.ot || 0} step={0.5} max={12} onChange={(v) => setCell(a.id, sel.day, { ot: v })} format={(v) => fmtH(v)} label="Heures sup" />
              {canComplete && <button className="btn btn-ghost btn-sm" onClick={() => setCell(a.id, sel.day, { type: "CP", comp: true, manual: true, compHalf: other, tag: null, ot: (c.ot || 0) + OT_ADD })}><Plus size={14} />Compléter {other === "AM" ? "l’après-midi" : "le matin"} · +{fmtH(OT_ADD)}</button>}
              {c.manual && c.comp && <button className="btn btn-quiet btn-sm" onClick={() => setCell(a.id, sel.day, { type: c.compHalf === "AM" ? "M" : "AM", comp: false, manual: false, compHalf: null, ot: 0 })}><X size={14} />Retirer le complément</button>}
            </div>
          </div>
        )}

        {dayInfo}
        {removesMin && WORK.includes(c.type) && <div className="note warn"><AlertTriangle size={16} /><span>Retirer {a.first} ce jour-là ferait passer une demi-journée sous le minimum.</span></div>}

        {a.role !== "adm" && (
          <div>
            <span className="field-label"><ArrowLeftRight size={14} style={{ verticalAlign: -2 }} /> Permuter matin ↔ après-midi</span>
            {!me.ok ? <p className="muted small"><Lock size={12} /> Impossible pour {a.first} ce jour-là : {me.reason}.</p> : (
              <div className="swap-list">
                {mates.length === 0 && <p className="muted small">Aucun·e {ROLES[a.role].label.toLowerCase()} sur l’autre demi-journée.</p>}
                {mates.map(({ b, info }) => info.ok ? (
                  <button key={b.id} className="swap-row" onClick={() => swapCells(a.id, b.id, sel.day)}>
                    <Shift c={plan[b.id][sel.day]} size="sm" /><span>{b.first} {b.last.toUpperCase()}</span><span className="go">Échanger</span>
                  </button>
                ) : (
                  <div key={b.id} className="swap-row locked"><Shift c={plan[b.id][sel.day]} size="sm" /><span>{b.first} {b.last.toUpperCase()}</span><span className="why"><Lock size={11} /> {info.reason}</span></div>
                ))}
              </div>
            )}
            <p className="muted small" style={{ marginTop: 6 }}>Même fonction uniquement, jamais la veille, le jour ou le lendemain d’un repos.</p>
          </div>
        )}
        <button className="btn btn-quiet btn-sm" onClick={() => setSel({ day: sel.day })}>Voir toute la journée</button>
      </div>
    </aside>
  );
}
