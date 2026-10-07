import React, { useState } from "react";
import { Archive, ArrowLeft, CheckCircle2 } from "lucide-react";
import { SHIFTS, WD, parseDate, monthName, fmtH, totalsFor, monthDates } from "../data.js";
import { PageHead, Panel, Shift, PersonName, RoleDot, Legend } from "../ui.jsx";

export default function Historique({ archives, months, plans, monthTeams, season, openMonth }) {
  const [viewing, setViewing] = useState(null);
  // Jours d'un planning enregistré (sert aussi pour les mois d'une saison précédente)
  const daysOf = (snap) => [...new Set(Object.values(snap || {}).flatMap((byDay) => Object.keys(byDay || {})))].sort();
  const found = archives.find((a) => a.mk === viewing);
  const arc = found || (viewing && plans[viewing] ? { mk: viewing, snapshot: plans[viewing], draft: true } : null);
  if (arc) {
    const team = (monthTeams[arc.mk] || []).filter((a) => arc.snapshot[a.id]);
    const days = daysOf(arc.snapshot);
    return (
      <>
        <PageHead title={`${monthName(arc.mk)} ${arc.mk.slice(0, 4)}`} sub={`${arc.draft ? "Brouillon, jamais validé" : `Version validée le ${arc.validatedAt}`} · ${team.length} personnes · lecture seule`}>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewing(null)}><ArrowLeft size={15} />Tous les mois</button>
        </PageHead>
        <div className="grid-scroll" style={{ maxHeight: "none" }}>
          <table className="plan">
            <thead><tr><th className="who">Équipe · total</th>{days.map((dk) => { const d = parseDate(dk); return <th key={dk} className={d.getDay() === 0 || d.getDay() === 6 ? "we" : undefined}><span className="w">{WD[d.getDay()]}</span><span className="d">{d.getDate()}</span></th>; })}</tr></thead>
            <tbody>
              {team.map((a) => (
                <tr key={a.id}>
                  <th className="who"><div className="who-cell"><RoleDot role={a.role} /><PersonName a={a} /><span className="who-meta">{fmtH(totalsFor(a, days.map(parseDate), arc.snapshot).total)}</span></div></th>
                  {days.map((dk) => <td key={dk} className="cell"><span className="cell-static">{arc.snapshot[a.id]?.[dk] && <Shift c={arc.snapshot[a.id][dk]} />}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </>
    );
  }
  // Tous les mois connus : la saison en cours et ceux des saisons précédentes qui ont un planning ou une équipe
  const has = (mk) => archives.some((a) => a.mk === mk) || (plans[mk] && Object.keys(plans[mk]).length) || (monthTeams[mk] || []).length;
  const all = [...new Set([...months, ...archives.map((a) => a.mk), ...Object.keys(plans), ...Object.keys(monthTeams)])].filter((mk) => months.includes(mk) || has(mk))
    .sort((x, y) => (x.slice(0, 4) === y.slice(0, 4) ? x.localeCompare(y) : y.localeCompare(x)));
  return (
    <>
      <PageHead title="Historique" sub="Un mois validé est figé et archivé : c’est la version publiée aux agents et utilisée pour la paie. Un congé ou un échange accepté ensuite met aussi l’archive à jour." />
      <Panel flush>
        <table className="data">
          <thead><tr><th>Mois</th><th>État</th><th className="r">Personnes</th><th className="r">Services</th><th className="r">Heures</th><th className="r">Heures sup</th><th className="r"><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {all.map((mk, i) => {
              const a = archives.find((x) => x.mk === mk);
              const team = monthTeams[mk] || [], plan = a ? a.snapshot : plans[mk];
              const inSeason = months.includes(mk);
              const dates = inSeason ? monthDates(mk, season.open, season.close) : daysOf(plan).map(parseDate);
              const year = mk.slice(0, 4), newYear = i === 0 || all[i - 1].slice(0, 4) !== year;
              const tot = plan ? team.map((p) => totalsFor(p, dates, plan)) : [];
              const shifts = plan ? Object.values(plan).reduce((s, byDay) => s + Object.values(byDay).filter((c) => c.type !== "R").length, 0) : 0;
              return (
                <React.Fragment key={mk}>
                {newYear && <tr className="year-row"><th colSpan={7}>Saison {year}{year === season.open.slice(0, 4) ? " · en cours" : ""}</th></tr>}
                <tr>
                  <td><b>{monthName(mk)} {mk.slice(0, 4)}</b></td>
                  <td>{a ? <span className="chip ok"><CheckCircle2 size={12} />validé le {a.validatedAt}</span> : plan ? <span className="chip warn">brouillon</span> : <span className="chip neutral">à générer</span>}</td>
                  <td className="r num">{team.length}</td>
                  <td className="r num">{plan ? shifts : "·"}</td>
                  <td className="r num">{plan ? fmtH(tot.reduce((s, t) => s + t.total, 0)) : "·"}</td>
                  <td className="r num">{plan ? fmtH(tot.reduce((s, t) => s + t.ot, 0)) : "·"}</td>
                  <td className="r">{a ? <button className="btn btn-primary btn-sm" onClick={() => setViewing(mk)}><Archive size={14} />Voir l’archive</button> : inSeason ? <button className="btn btn-ghost btn-sm" onClick={() => openMonth(mk)}>Ouvrir</button> : plan ? <button className="btn btn-ghost btn-sm" onClick={() => setViewing(mk)}>Voir</button> : null}</td>
                </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
