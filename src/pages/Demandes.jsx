import React, { useState } from "react";
import { AlertTriangle, ArrowLeftRight, ArrowRight, CalendarDays, Check, CheckCircle2, X } from "lucide-react";
import { SHIFTS, parseDate, dayLabel, keyOf, pkey, since } from "../data.js";
import { PageHead, Shift } from "../ui.jsx";
import { halfCounts } from "./Planning.jsx";

export default function Demandes({ monthTeams, plans, archives, requests, decide, season }) {
  const [tab, setTab] = useState("pending");
  const [replies, setReplies] = useState({});
  const list = requests.filter((r) => (tab === "all" ? true : tab === "pending" ? r.status === "pending" : r.status !== "pending"));
  const n = (s) => requests.filter((r) => (s === "pending" ? r.status === "pending" : r.status !== "pending")).length;
  return (
    <>
      <PageHead title="Demandes des agents" sub="Échanges et congés demandés depuis l’espace agent. Accepter applique automatiquement le changement au planning, et l’agent voit votre réponse.">
        <div className="seg" role="group" aria-label="Filtrer"><button aria-pressed={tab === "pending"} onClick={() => setTab("pending")}>En attente · {n("pending")}</button><button aria-pressed={tab === "done"} onClick={() => setTab("done")}>Traitées · {n("done")}</button><button aria-pressed={tab === "all"} onClick={() => setTab("all")}>Toutes</button></div>
      </PageHead>
      <div className="req-list">
        {list.length === 0 && <div className="panel empty-state"><CheckCircle2 size={26} color="var(--ok)" /><h2>Rien en attente</h2><p className="muted">Les nouvelles demandes apparaissent ici et dans le menu.</p></div>}
        {list.map((r) => {
          const team = monthTeams[r.monthKey] || [];
          const plan = archives.find((x) => x.mk === r.monthKey)?.snapshot || plans[r.monthKey];
          const ghost = (key) => { const [f = "", l = ""] = (key || "").split("|"); return { id: null, first: f.replace(/^./, (c) => c.toUpperCase()), last: l }; };
          const a = team.find((x) => pkey(x) === r.from) || ghost(r.from), b = r.target ? team.find((x) => pkey(x) === r.target) || ghost(r.target) : null, d = parseDate(r.date);
          const ca = plan?.[a.id]?.[r.date], cb = b && plan?.[b.id]?.[r.date];
          const cnt = plan ? halfCounts(team, plan, d) : null;
          const after = r.type === "leave" && cnt && ca ? { m: cnt.m - (ca.type === "M" || ca.type === "CP" ? 1 : 0), am: cnt.am - (ca.type === "AM" || ca.type === "CP" ? 1 : 0) } : null;
          const low = after && Math.min(after.m, after.am) < season.minHalf;
          return (
            <article key={r.id} className="panel req">
              <span className={`req-ico ${r.type}`}>{r.type === "swap" ? <ArrowLeftRight size={20} /> : <CalendarDays size={20} />}</span>
              <div>
                <h3>{a.first} {a.last.toUpperCase()} · {r.type === "swap" ? "échange d’heures" : "congé"} · {dayLabel(d)}</h3>
                {r.type === "swap" && ca && cb && (
                  <div className="swap-viz">
                    <span><Shift c={ca} size="sm" /> {a.first}</span><ArrowRight size={14} /><span><Shift t={cb.type} size="sm" /> {a.first}</span>
                    <span className="sep" />
                    <span><Shift c={cb} size="sm" /> {b.first}</span><ArrowRight size={14} /><span><Shift t={ca.type} size="sm" /> {b.first}</span>
                  </div>
                )}
                {r.type === "leave" && ca && <div className="swap-viz"><span><Shift c={ca} size="sm" /> {SHIFTS[ca.type].label}</span><ArrowRight size={14} /><span><Shift t="IN" size="sm" /> Indisponible</span></div>}
                <p className="reason">{r.reason ? `« ${r.reason} »` : <span className="muted">Pas de raison donnée</span>}</p>
                <div className="meta"><span>Envoyée {since(r.createdAt)}</span>
                  {r.status === "approved" && <span className="chip ok">acceptée</span>}
                  {r.status === "rejected" && <span className="chip danger">refusée</span>}
                  {r.reply && <span>Votre réponse : « {r.reply} »</span>}
                </div>
                {r.status === "pending" && (
                  <div className="impact">
                    {r.type === "swap" && ca && cb && ca.type === cb.type ? <div className="note warn"><AlertTriangle size={16} /><span>{a.first} et {b.first} ont le même horaire ce jour-là : le planning a changé depuis la demande, l’échange ne servirait à rien. Refusez en expliquant, ou modifiez d’abord la grille.</span></div>
                      : r.type === "swap" ? <div className="note ok"><CheckCircle2 size={16} /><span>Effectif inchangé : {a.first} et {b.first} échangent leur demi-journée.</span></div>
                      : low ? <div className="note danger"><AlertTriangle size={16} /><span>Accepter laisserait {after.m} le matin et {after.am} l’après-midi (minimum {season.minHalf}). Prévoyez un renfort.</span></div>
                        : after && <div className="note ok"><CheckCircle2 size={16} /><span>Effectif suffisant après accord : {after.m} le matin, {after.am} l’après-midi.</span></div>}
                    <input className="input reply" placeholder="Réponse à l’agent (facultatif)" value={replies[r.id] || ""} onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })} />
                  </div>
                )}
              </div>
              {r.status === "pending" && (
                <div className="acts">
                  <button className="btn btn-ok btn-sm" onClick={() => decide(r, true, replies[r.id])}><Check size={15} />Accepter</button>
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => decide(r, false, replies[r.id])}><X size={15} />Refuser</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
