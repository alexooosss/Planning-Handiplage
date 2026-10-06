import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SHIFTS, HOURS, WD, keyOf, cap, WD_FULL } from "../data.js";
import { PageHead, Panel, NoPlan, Stepper, RoleDot, Shift, Cov } from "../ui.jsx";

// Une heure est « en heures sup » quand elle tombe dans la demi-journée ajoutée d'un coupé de compensation
const isOtHour = (c, h) => c?.comp && c.compHalf && ((c.compHalf === "M" && h <= 12) || (c.compHalf === "AM" && h > 12));

export default function Couverture({ team, plan, dates, mName, season, setSeason, generate, covDay, setCovDay }) {
  if (!plan) return <><PageHead title="Couverture" /><NoPlan month={mName} onGenerate={generate} /></>;
  const min = season.minEffectif;
  const di = Math.min(covDay, dates.length - 1), d = dates[di], dk = keyOf(d);
  const count = (k, h) => team.filter((a) => SHIFTS[plan[a.id][k]?.type]?.present.includes(h)).length;
  // Lecture « au feu » : bien en dessous = rouge, un de moins = rouge clair, au seuil = vert clair, +1 = émeraude, +2 et plus = vert foncé
  const lvl = (n) => (n < min - 1 ? "h0" : n === min - 1 ? "h1" : n === min ? "h2" : n === min + 1 ? "h3" : "h4");
  const lows = dates.reduce((s, x) => s + HOURS.filter((h) => count(keyOf(x), h) < min).length, 0);

  return (
    <>
      <PageHead title="Couverture horaire" sub={`Personnes présentes à chaque heure, de 7h à 19h. ${lows ? `${lows} créneaux sous le seuil de ${min} ce mois-ci.` : `Aucun créneau sous le seuil de ${min}.`}`}>
        <span className="field-label" style={{ margin: 0, alignSelf: "center" }}>Seuil horaire</span>
        <Stepper value={min} min={1} max={12} onChange={(v) => setSeason({ ...season, minEffectif: v })} label="Seuil horaire" />
      </PageHead>

      <div className="cov-layout">
        <Panel title={`${mName} heure par heure`} right={<span className="muted small">Cliquez un jour</span>} bodyClass="panel-body heat-wrap">
          <table className="heat">
            <thead><tr><th />{HOURS.map((h) => <th key={h}>{h}h</th>)}</tr></thead>
            <tbody>
              {dates.map((x, i) => (
                <tr key={i} className={i === di ? "sel" : undefined}>
                  <th className="day-h">{WD[x.getDay()]} {x.getDate()}</th>
                  {HOURS.map((h) => { const n = count(keyOf(x), h); return <td key={h}><button className={lvl(n)} onClick={() => setCovDay(i)} aria-label={`${x.getDate()} à ${h}h : ${n} personnes`}>{n}</button></td>; })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="heat-legend">
            <span><i className="h0" />{min - 2} ou moins</span><span><i className="h1" />{min - 1} · un peu juste</span><span><i className="h2" />{min} · correct</span><span><i className="h3" />{min + 1} · confortable</span><span><i className="h4" />{min + 2} et plus · large</span>
          </div>
        </Panel>

        <Panel title={`${cap(WD_FULL[d.getDay()])} ${d.getDate()} ${mName.toLowerCase()}`} right={<>
          <button className="btn btn-ghost btn-sm" disabled={di === 0} onClick={() => setCovDay(di - 1)}><ChevronLeft size={15} />Veille</button>
          <button className="btn btn-ghost btn-sm" disabled={di === dates.length - 1} onClick={() => setCovDay(di + 1)}>Lendemain<ChevronRight size={15} /></button>
        </>} flush>
          <div style={{ overflowX: "auto" }}>
            <table className="matrix">
              <thead>
                <tr><th className="hcol">Heure</th>{team.map((a) => <th key={a.id} title={`${a.first} ${a.last}`}><span className="vname"><RoleDot role={a.role} />{a.first}</span></th>)}<th className="tot">Présents</th></tr>
                <tr className="sub"><th />{team.map((a) => <th key={a.id}><Shift c={plan[a.id][dk]} size="sm" /></th>)}<th /></tr>
              </thead>
              <tbody>
                {HOURS.map((h) => {
                  const n = count(dk, h);
                  return (
                    <tr key={h}>
                      <th className="hcol num">{String(h).padStart(2, "0")}h</th>
                      {team.map((a) => {
                        const c = plan[a.id][dk], on = SHIFTS[c?.type]?.present.includes(h), ot = on && isOtHour(c, h);
                        return <td key={a.id}><span className={`mcell${on ? " on" : ""}${ot ? " ot" : ""}`} data-t={on ? c.type : undefined} title={ot ? "Heures sup (coupé de compensation)" : on ? SHIFTS[c.type].label : ""}>{on ? c.type : ""}</span></td>;
                      })}
                      <td className="tot"><Cov n={n} min={min} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="panel-foot legend">
            <span><span className="mcell on ot" style={{ width: 26 }}>CP</span>heures sup (coupé de compensation)</span>
            <span><span className="cov low">3</span>sous le seuil</span><span><span className="cov eq">{min}</span>pile au seuil</span><span><span className="cov good">7</span>au-dessus</span>
          </div>
        </Panel>
      </div>
    </>
  );
}
