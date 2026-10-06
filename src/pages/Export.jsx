import React, { useState } from "react";
import { Printer, Download, Upload, Info, AlertTriangle, LayoutGrid, CalendarRange, Database } from "lucide-react";
import { SHIFTS, WORK, OFF, HOURS, WD, WD_FULL, keyOf, fmtH, totalsFor } from "../data.js";
import { PageHead, Panel, NoPlan, Shift, RoleDot, Legend } from "../ui.jsx";
import { halfCounts } from "./Planning.jsx";

function weeksOf(dates) {
  const w = []; let cur = [];
  dates.forEach((d) => { if (cur.length && d.getDay() === 1) { w.push(cur); cur = []; } cur.push(d); });
  if (cur.length) w.push(cur);
  return w;
}

export function MonthSheet({ team, plan, dates, mName, dayNotes, season, draft }) {
  return (
    <div className="sheet-doc">
      <div className="sheet-title"><b>Planning Handiplage · {mName} 2026</b><span>{dates.length} jours · {team.length} personnes{draft ? " · PROVISOIRE" : ""}</span></div>
      <table className="sheet">
        {/* Largeurs fixes : la grille tient exactement sur une feuille A4 paysage */}
        <colgroup><col className="c-n" />{dates.map((_, i) => <col key={i} />)}<col className="c-t" /></colgroup>
        <thead>
          <tr><th className="n">Personne</th>{dates.map((d, i) => <th key={i} className={d.getDay() === 1 && i ? "wk" : ""}>{WD[d.getDay()]}<br /><b>{d.getDate()}</b></th>)}<th className="tot">Total</th></tr>
          <tr className="ev"><th className="n">Événement</th>{dates.map((d, i) => <th key={i} className={d.getDay() === 1 && i ? "wk" : ""}>{dayNotes[keyOf(d)] ? <span title={dayNotes[keyOf(d)]}>{dayNotes[keyOf(d)].slice(0, 5)}</span> : ""}</th>)}<th className="tot" /></tr>
        </thead>
        <tbody>
          {team.map((a) => (
            <tr key={a.id}>
              <th className="n"><RoleDot role={a.role} /> {a.first} {a.last.toUpperCase()}</th>
              {dates.map((d, i) => <td key={i} className={d.getDay() === 1 && i ? "wk" : ""}><Shift c={plan[a.id][keyOf(d)]} size="xs" /></td>)}
              <td className="tot num">{fmtH(totalsFor(a, dates, plan).total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[["Matin", "m"], ["Après-midi", "am"]].map(([l, k]) => (
            <tr key={k}><th className="n">{l}</th>{dates.map((d, i) => { const n = halfCounts(team, plan, d)[k]; return <td key={i} className={`${d.getDay() === 1 && i ? "wk " : ""}${n < season.minHalf ? "low" : ""}`}>{n}</td>; })}<td className="tot" /></tr>
          ))}
        </tfoot>
      </table>
      <Legend minHalf={season.minHalf} />
    </div>
  );
}

function WeekPoster({ team, plan, dates, mName, dayNotes }) {
  return (
    <div className="poster-doc">
      <div className="poster-title">PLANNING HANDIPLAGE · {mName.toUpperCase()} 2026</div>
      <div className="poster-legend">{[...WORK, ...OFF].map((k) => <span key={k}><Shift t={k} size="xs" />{SHIFTS[k].label}{SHIFTS[k].time ? ` ${SHIFTS[k].time}` : ""}</span>)}<span><span className="pc hs" data-t="CP">CP</span>heures sup</span><span><b>Prés.</b> personnes présentes à l’heure</span></div>
      {weeksOf(dates).map((week, wi) => (
        <div className="poster-week" key={wi} style={{ "--n": team.length }}>
          {/* Semaine calée du lundi au dimanche : cases vides avant le 1er et après le dernier jour */}
          {Array.from({ length: 7 }, (_, i) => week.find((d) => (d.getDay() + 6) % 7 === i) || null).map((d, i) => {
            if (!d) return <div className="poster-day empty" key={"e" + i} aria-hidden="true" />;
            const dk = keyOf(d);
            return (
              <div className="poster-day" key={dk}>
                <div className="pd-title">{WD_FULL[d.getDay()].toUpperCase()} {d.getDate()}</div>
                <div className="pd-row head"><span />{team.map((a) => <span key={a.id} className="vn">{a.first}</span>)}<span className="vn">Prés.</span></div>
                {HOURS.map((h) => {
                  const n = team.filter((a) => SHIFTS[plan[a.id][dk]?.type]?.present.includes(h)).length;
                  return (
                    <div className="pd-row" key={h}>
                      <span className="hh">{h}</span>
                      {team.map((a) => { const c = plan[a.id][dk], on = SHIFTS[c?.type]?.present.includes(h); return <span key={a.id} className={`pc${c?.ot > 0 && on ? " hs" : ""}`} data-t={on ? c.type : c?.type === "R" ? "R" : undefined}>{on ? c.type : ""}</span>; })}
                      <span className="pn">{n}</span>
                    </div>
                  );
                })}
                {dayNotes[dk] && <div className="pd-ev">{dayNotes[dk]}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Export({ team, plan, dates, mName, dayNotes, season, archived, generate, exportJSON, importJSON }) {
  const [doc, setDoc] = useState("month");
  if (!plan) return <><PageHead title={`Exporter ${mName.toLowerCase()}`} /><NoPlan month={mName} onGenerate={generate} /></>;
  const DOCS = [
    ["month", "Planning du mois", "A4 paysage · une ligne par personne, totaux d’heures, effectif matin / après-midi, événements.", LayoutGrid],
    ["poster", "Affiche hebdomadaire heure par heure", "A4 paysage · une page par semaine, présence de chacun de 7h à 19h, à afficher au poste.", CalendarRange],
  ];
  const print = () => { document.body.dataset.print = doc; window.print(); setTimeout(() => delete document.body.dataset.print, 500); };
  return (
    <>
      <PageHead title={`Exporter ${mName.toLowerCase()}`} sub="Choisissez le document, vérifiez l’aperçu, puis imprimez ou enregistrez en PDF." />
      <div className="export-layout">
        <div className="stack">
          {DOCS.map(([k, t, s, I]) => (
            <button key={k} className="doc-choice" aria-pressed={doc === k} onClick={() => setDoc(k)}>
              <span className="req-ico swap"><I size={20} /></span><span><b>{t}</b><span className="muted small block">{s}</span></span>
            </button>
          ))}
          <Panel title="Imprimer">
            {!archived && <div className="note warn"><AlertTriangle size={16} /><span>{mName} n’est pas encore validé : le document portera la mention « provisoire ».</span></div>}
            <div className="note"><Info size={16} /><span>Dans la fenêtre d’impression : <b>Enregistrer au format PDF</b>, orientation <b>Paysage</b>, marges par défaut. Les couleurs sont conservées.</span></div>
            <button className="btn btn-primary" onClick={print}><Printer size={17} />Imprimer ou enregistrer en PDF</button>
          </Panel>
          <Panel title="Sauvegarde de la saison" right={<Database size={15} className="muted" />}>
            <p className="hint" style={{ marginTop: 0 }}>Le site enregistre tout seul en ligne. Ce fichier sert de copie de sécurité ou à transférer la saison.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={exportJSON}><Download size={15} />Télécharger (.json)</button>
              <label className="btn btn-ghost btn-sm"><Upload size={15} />Importer…<input type="file" accept="application/json" hidden onChange={importJSON} /></label>
            </div>
          </Panel>
        </div>
        <div className="preview" aria-label="Aperçu du document">
          <div className={`print-doc${doc === "month" ? " active" : ""}`} data-doc="month" hidden={doc !== "month"}><MonthSheet {...{ team, plan, dates, mName, dayNotes, season }} draft={!archived} /></div>
          <div className={`print-doc${doc === "poster" ? " active" : ""}`} data-doc="poster" hidden={doc !== "poster"}><WeekPoster {...{ team, plan, dates, mName, dayNotes }} /></div>
        </div>
      </div>
    </>
  );
}
