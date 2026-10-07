import React, { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Copy, KeyRound, Trash2, UserPlus, Wand2 } from "lucide-react";
import { WD_FULL, monthDates, pkey, newAgent, deM, monthName, validDay, fixSeason } from "../data.js";
import { badgeStatus } from "./Badges.jsx";
import { PageHead, Panel, Stepper, Field, RoleDot } from "../ui.jsx";

export default function Equipe({ team, setTeam, mk, mName, months, season, setSeason, plan, generate, generateAll, copyPrev, accounts, badges, setPage, say }) {
  // Dates de saison : saisies librement, appliquées seulement quand elles sont complètes et valides
  const [draft, setDraft] = useState({ open: season.open, close: season.close });
  useEffect(() => setDraft({ open: season.open, close: season.close }), [season.open, season.close]);
  const editDate = (k, v) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    if (!validDay(next.open) || !validDay(next.close)) return;
    if (k === "close" && next.close < next.open) return;
    setSeason(fixSeason({ ...season, ...next }));
  };
  const draftBad = !validDay(draft.open) || !validDay(draft.close) || draft.close < draft.open;
  const upd = (id, patch) => setTeam((t) => t.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const chefs = team.filter((a) => a.role === "chef");
  const dates = monthDates(mk, season.open, season.close);
  const noAccount = team.filter((a) => !accounts.some((c) => c.pkey === pkey(a)));
  const sameRest = chefs.length === 2 && chefs[0].restDay === chefs[1].restDay;
  const checks = [
    [chefs.length === 2 ? "ok" : "danger", chefs.length === 2 ? "2 chef·fes d’équipe" : `${chefs.length} chef·fe(s) d’équipe : il en faut 2`],
    [sameRest ? "warn" : "ok", sameRest ? "Les 2 chef·fes ont le même jour de repos" : `Repos des chef·fes : ${chefs.map((c) => `${c.first} le ${WD_FULL[c.restDay]}`).join(", ")}`],
    [team.filter((a) => a.role === "agent").length >= 6 ? "ok" : "warn", `${team.filter((a) => a.role === "agent").length} handiplagistes, ${team.filter((a) => a.role === "adm").length} administratif`],
    [team.some((a) => !a.first || !a.last) ? "danger" : "ok", team.some((a) => !a.first || !a.last) ? "Une personne n’a pas de prénom ou de nom" : "Tous les noms sont renseignés (planning, comptes et badges)"],
    [noAccount.length ? "warn" : "ok", noAccount.length ? `${noAccount.length} personne(s) sans compte agent : ne verront pas leur planning` : "Chaque personne a son compte agent"],
  ];
  const Ico = { ok: CheckCircle2, warn: AlertTriangle, danger: AlertCircle };
  const idx = months.indexOf(mk);

  return (
    <>
      <PageHead title={`Équipe ${deM(mName)}`} sub={`Chaque mois a sa propre équipe. Les noms saisis ici alimentent le planning, les comptes agents et les badges.`}>
        {idx > 0 && <button className="btn btn-ghost btn-sm" onClick={copyPrev}><Copy size={15} />Copier l’équipe {months[idx - 1] && deM(monthName(months[idx - 1]))}</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setTeam((t) => [...t, newAgent()])}><UserPlus size={15} />Ajouter une personne</button>
      </PageHead>

      <div className="split">
        <div className="stack">
          <Panel title="Saison">
            <div className="form-row">
              <Field label="Ouverture"><input className="input" type="date" value={draft.open} onChange={(e) => editDate("open", e.target.value)} onBlur={() => setDraft({ open: season.open, close: season.close })} /></Field>
              <Field label="Fermeture"><input className="input" type="date" value={draft.close} onChange={(e) => editDate("close", e.target.value)} onBlur={() => setDraft({ open: season.open, close: season.close })} /></Field>
            </div>
            {draftBad && <p className="hint" style={{ color: "var(--danger)" }}>Date incomplète ou fermeture avant l’ouverture : la saison reste du {season.open.split("-").reverse().join("/")} au {season.close.split("-").reverse().join("/")}.</p>}
            <p className="hint">Un mois est créé pour chaque mois de la saison : {months.length} mois, {dates.length} jours d’ouverture en {mName.toLowerCase()}.</p>
            <div className="stack" style={{ gap: 12 }}>
              <Field label="Minimum par demi-journée" hint="Planning, alertes rouges"><Stepper value={season.minHalf} min={1} max={12} onChange={(v) => setSeason({ ...season, minHalf: v })} format={(v) => `${v} pers.`} label="Minimum par demi-journée" /></Field>
              <Field label="Seuil horaire" hint="Écran Couverture"><Stepper value={season.minEffectif} min={1} max={12} onChange={(v) => setSeason({ ...season, minEffectif: v })} format={(v) => `${v} pers.`} label="Seuil horaire" /></Field>
            </div>
          </Panel>

          <Panel title="Avant de générer" flush>
            <div className="panel-body" style={{ paddingTop: 10, paddingBottom: 10, gap: 0 }}>
              {checks.map(([k, t], i) => { const I = Ico[k]; return <div key={i} className={`check ${k}`}><I size={17} />{t}</div>; })}
            </div>
            <div className="panel-body" style={{ borderTop: "1px solid var(--line)", gap: 8 }}>
              <button className="btn btn-primary" onClick={generate}><Wand2 size={17} />{plan ? "Régénérer" : "Générer"} {mName.toLowerCase()}</button>
              <button className="btn btn-ghost" onClick={generateAll}>Générer toute la saison</button>
              {plan && <p className="hint">Régénérer remplace les modifications manuelles {deM(mName)}. Les mois validés ne sont pas touchés.</p>}
            </div>
          </Panel>

          <Panel title="Règles de génération">
            <ul className="rules">
              <li>Matin et après-midi équilibrés, au moins <b>{season.minHalf}</b> personnes de chaque côté.</li>
              <li>Handiplagistes : un repos tous les 6 jours, décalé entre personnes. Chef·fes : repos fixe. Administratif : repos mercredi et jeudi.</li>
              <li>Coupure de 48 h : <span className="mark v">v</span> matin la veille d’un repos, <span className="mark l">l</span> après-midi le lendemain.</li>
              <li>2 à 3 coupés par mois et par personne (handiplagistes et chef·fes), sur des jours neutres.</li>
              <li>Les 2 chef·fes ne sont jamais seul·es sur la même demi-journée (coupé + demi-journée possible).</li>
              <li>Si une plage tombe sous le minimum, une personne passe en <b>coupé de compensation</b> (heures sup réparties, un peu plus pour les chef·fes).</li>
            </ul>
          </Panel>
        </div>

        <Panel title={`${team.length} personnes`} right={<span className="muted small">Les modifications s’appliquent à {mName.toLowerCase()} uniquement</span>} flush>
          <div style={{ overflowX: "auto" }}>
            <table className="data">
              <thead><tr><th>Prénom · Nom</th><th>Fonction</th><th>Repos</th><th>Compte</th><th>Badge</th><th className="r"><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {team.map((a) => {
                  const acc = accounts.find((c) => c.pkey === pkey(a)); const bs = badgeStatus(a, badges);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <RoleDot role={a.role} />
                          <input className="inline-input" value={a.first} placeholder="Prénom" aria-label="Prénom" onChange={(e) => upd(a.id, { first: e.target.value })} style={{ width: 94, flex: "none" }} />
                          <input className="inline-input" value={a.last.toUpperCase()} placeholder="NOM" aria-label="Nom" onChange={(e) => upd(a.id, { last: e.target.value })} style={{ width: 132, flex: "none" }} />
                        </div>
                      </td>
                      <td>
                        <select className="select" value={a.role} onChange={(e) => upd(a.id, { role: e.target.value })} aria-label="Fonction">
                          <option value="agent">Handiplagiste</option><option value="chef">Chef·fe d’équipe</option><option value="adm">Administratif</option>
                        </select>
                      </td>
                      <td>
                        {a.role === "chef" ? (
                          <select className="select" value={a.restDay} onChange={(e) => upd(a.id, { restDay: +e.target.value })} aria-label="Jour de repos">
                            {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{WD_FULL[d]}</option>)}
                          </select>
                        ) : <span className="muted small">{a.role === "adm" ? "mer. et jeu." : "tous les 6 j"}</span>}
                      </td>
                      <td>{acc ? <span className="chip ok" title={`Identifiant : ${acc.id}`}><KeyRound size={12} />{acc.id}</span> : <button className="btn btn-quiet btn-sm" style={{ padding: 0 }} onClick={() => setPage("comptes")}><span className="chip warn">aucun</span></button>}</td>
                      <td><button className="btn btn-quiet btn-sm" style={{ padding: 0 }} onClick={() => setPage("badges")}>{bs === "ok" ? <span className="chip ok">à jour</span> : bs === "outdated" ? <span className="chip warn">à réimprimer</span> : <span className="chip magenta">à créer</span>}</button></td>
                      <td className="r"><button className="icon-btn" aria-label={`Retirer ${a.first}`} onClick={() => { const before = team; setTeam((t) => t.filter((x) => x.id !== a.id)); say(`${a.first} ${a.last.toUpperCase()} retiré·e de l’équipe ${deM(mName)}.`, () => setTeam(before)); }}><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
