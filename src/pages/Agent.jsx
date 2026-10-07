import React, { useState } from "react";
import { ChevronRight, ChevronLeft, Send, Flag, Archive, ArrowLeftRight, CalendarDays, CalendarRange, Inbox } from "lucide-react";
import { SHIFTS, OFF, WD, MONTHS_ABBR, keyOf, parseDate, fmtH, shortDay, dayLabel, monthName, totalsFor, pkey, deM } from "../data.js";
import { Panel, Shift, RoleDot, Field } from "../ui.jsx";

const monday = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return keyOf(x); };

/**
 * Espace agent. Sur ordinateur, tout est visible sur une page ; sur téléphone, une barre de sections
 * (Planning, Événements, Demandes, Passés) n'affiche qu'une partie à la fois et le mois se choisit
 * dans la section Planning.
 */
export default function Agent({ me, team, plan, dates, mName, happenings, requests, submit, archives, monthTeams, today: TODAY, months, mk, setMonth, monthStatus }) {
  const [tab, setTab] = useState("planning");
  const [open, setOpen] = useState(null);
  const [swap, setSwap] = useState({ date: "", to: "", reason: "" });
  const [leave, setLeave] = useState({ date: "", reason: "" });

  const myKey = me ? pkey(me) : null;
  const myPlan = me && plan ? plan[me.id] : null;
  const myDays = myPlan ? dates.filter((d) => myPlan[keyOf(d)] && myPlan[keyOf(d)].type !== "R") : [];
  const weeks = []; const wm = new Map();
  myDays.forEach((d) => { const k = monday(d); if (!wm.has(k)) { wm.set(k, []); weeks.push(k); } wm.get(k).push(d); });
  const t = myPlan ? totalsFor(me, dates, plan) : { total: 0, ot: 0 };
  const upcoming = happenings.filter((e) => e.date >= TODAY && e.title).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const other = (h) => (h === "M" ? "AM" : "M");
  const swapDays = myPlan ? dates.filter((d) => { const c = myPlan[keyOf(d)]; return c && (c.type === "M" || c.type === "AM") && !c.tag; }) : [];
  const partners = swap.date && myPlan ? team.filter((a) => { if (a.id === me.id || a.role !== me.role) return false; const c = plan[a.id]?.[swap.date], mine = myPlan[swap.date]; return c && c.type === other(mine.type) && !c.tag; }) : [];
  const mine = myKey ? requests.filter((r) => r.from === myKey).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
  // Les archives sont classées par fiche du mois : on y retrouve la personne par son identité
  const idInMonth = (m) => (monthTeams[m] || []).find((a) => pkey(a) === myKey)?.id;
  const past = archives.map((a) => ({ ...a, myId: idInMonth(a.mk) })).filter((a) => a.myId && a.snapshot[a.myId] && a.mk < mk).sort((a, b) => b.mk.localeCompare(a.mk));
  const nameOf = (m, key) => (monthTeams[m] || []).find((a) => pkey(a) === key)?.first || "un·e collègue";
  const pendingMine = mine.filter((r) => r.status === "pending").length;
  const idx = months.indexOf(mk);

  const TABS = [
    ["planning", "Planning", CalendarRange, null],
    ["events", "Événements", Flag, upcoming.length || null],
    ["requests", "Demandes", Inbox, pendingMine || null],
    ["past", "Passés", Archive, null],
  ];
  const go = (k) => { setTab(k); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="agent-space" data-tab={tab}>
      <nav className="agent-tabs" aria-label="Sections">
        {TABS.map(([k, label, Icon, n]) => (
          <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>
            <Icon size={18} /><span>{label}</span>{n ? <i className="badge-n">{n}</i> : null}
          </button>
        ))}
      </nav>

      <div className="agent-hello sec sec-planning">
        <h1>Bonjour {me ? me.first : ""}</h1>
        <p className="sub">{me && myPlan ? <>{mName} 2026 · {myDays.length} jours travaillés · {fmtH(t.total)}{t.ot ? ` dont ${fmtH(t.ot)} d’heures sup` : ""}</> : `${mName} 2026`}</p>
      </div>

      <div className={`sec sec-events${upcoming.length ? "" : " mobile-only"}`}>
        <Panel title={<><Flag size={15} style={{ verticalAlign: -2 }} /> Événements à venir</>} flush>
          {upcoming.length === 0 && <p className="panel-body muted">Aucun événement à venir pour l’instant.</p>}
          {upcoming.map((e) => { const d = parseDate(e.date); return (
            <div key={e.id} className={`event ro${e.date === TODAY ? " today" : ""}`}>
              <div className="agenda-date"><span>{WD[d.getDay()]}</span><strong>{d.getDate()}</strong><span>{MONTHS_ABBR[d.getMonth()]}</span></div>
              <div><b>{e.title}</b> <span className="muted small num">{e.time.replace(":", "h")}</span>{e.date === TODAY && <span className="chip brand" style={{ marginLeft: 8 }}>aujourd’hui</span>}{e.instructions && <p className="muted small">{e.instructions}</p>}</div>
            </div>
          ); })}
        </Panel>
      </div>

      <div className="agent-grid">
        <div className="sec sec-planning">
          {/* Choix du mois (téléphone ; sur ordinateur il est dans la barre du haut) */}
          <div className="month-switch" role="group" aria-label="Mois">
            <button className="icon-btn" aria-label="Mois précédent" disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])}><ChevronLeft size={20} /></button>
            <select className="select" value={mk} onChange={(e) => setMonth(e.target.value)} aria-label="Choisir le mois">
              {months.map((m) => <option key={m} value={m}>{monthName(m)} {m.slice(0, 4)} · {monthStatus(m)}</option>)}
            </select>
            <button className="icon-btn" aria-label="Mois suivant" disabled={idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])}><ChevronRight size={20} /></button>
          </div>
          {!me ? (
            <Panel title={`Pas dans l’équipe ${deM(mName)}`}><p className="muted">Vous ne faites pas partie de l’équipe de ce mois. Choisissez un autre mois.</p></Panel>
          ) : !myPlan ? (
            <Panel title={`Planning ${deM(mName)}`}><p className="muted">Le planning {deM(mName)} n’est pas encore publié.</p></Panel>
          ) : (
            <Panel title={`Mon planning · ${mName.toLowerCase()}`} flush>
              <div className="agent-sum">
                <div><b className="num">{myDays.length}</b><span>jours</span></div>
                <div><b className="num">{fmtH(t.total)}</b><span>heures</span></div>
                <div><b className="num hs-sum">{t.ot ? `+${fmtH(t.ot)}` : "0h"}</b><span>heures sup</span></div>
              </div>
              {weeks.map((wk, i) => {
                const days = wm.get(wk), wh = days.reduce((s, d) => { const c = myPlan[keyOf(d)]; return s + SHIFTS[c.type].hours + (c.ot || 0); }, 0);
                return (
                  <div key={wk} className="week">
                    <div className="week-head"><span>Semaine {i + 1}</span><span className="num">{fmtH(wh)}</span></div>
                    {days.map((d) => {
                      const k = keyOf(d), c = myPlan[k], s = SHIFTS[c.type], isOpen = open === k;
                      const col = team.filter((a) => a.id !== me.id && plan[a.id]?.[k] && !OFF.includes(plan[a.id][k].type)).map((a) => {
                        const sh = SHIFTS[plan[a.id][k].type]; return { a, c: plan[a.id][k], with: sh.present.filter((h) => s.present.includes(h)).length >= 2 };
                      });
                      return (
                        <div key={k} className={`aday${isOpen ? " open" : ""}${k === TODAY ? " today" : ""}`}>
                          <button className="aday-btn" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
                            <span className="aday-date"><span>{WD[d.getDay()]}</span><b>{d.getDate()}</b></span>
                            <Shift c={c} />
                            <span className="aday-main"><b>{s.label}</b>{c.tag && <span className="aday-tag">{c.tag === "VR" ? "veille de repos" : "lendemain de repos"}</span>}<span className="block muted num small">{s.time}</span></span>
                            <span className="aday-h num">{s.hours ? fmtH(s.hours) : ""}{c.ot > 0 && <span className="block hs-txt">+{fmtH(c.ot)} sup</span>}</span>
                            <ChevronRight size={16} className="chev" />
                          </button>
                          {isOpen && (
                            <div className="aday-more">
                              {[["Avec moi", col.filter((x) => x.with)], ["Autre demi-journée", col.filter((x) => !x.with)]].map(([g, l]) => l.length > 0 && (
                                <div key={g}><span className="field-label">{g}</span>{l.map(({ a, c: cc }) => <div key={a.id} className="mate"><Shift c={cc} size="sm" /><RoleDot role={a.role} />{a.first} {a.last.toUpperCase()}<span className="muted small num">{SHIFTS[cc.type].time}</span></div>)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Panel>
          )}
        </div>

        <div className="stack sec sec-requests">
          {myPlan ? <>
            <Panel title={<><ArrowLeftRight size={15} style={{ verticalAlign: -2 }} /> Échanger une demi-journée</>}>
              <p className="hint" style={{ marginTop: 0 }}>Avec un·e collègue de même fonction présent·e sur l’autre demi-journée. Impossible la veille ou le lendemain d’un repos.</p>
              <Field label="Jour"><select className="select" value={swap.date} onChange={(e) => setSwap({ ...swap, date: e.target.value, to: "" })}><option value="">Choisir un jour…</option>{swapDays.map((d) => <option key={keyOf(d)} value={keyOf(d)}>{shortDay(d)} · {SHIFTS[myPlan[keyOf(d)].type].label}</option>)}</select></Field>
              {swap.date && <Field label="Avec" hint={partners.length ? undefined : "Personne de disponible ce jour-là."}><select className="select" value={swap.to} onChange={(e) => setSwap({ ...swap, to: e.target.value })}><option value="">Choisir un·e collègue…</option>{partners.map((a) => <option key={a.id} value={a.id}>{a.first} {a.last.toUpperCase()} · {SHIFTS[plan[a.id][swap.date].type].label}</option>)}</select></Field>}
              <Field label="Raison (facultatif)"><textarea className="input" rows={2} value={swap.reason} placeholder="ex. formation, rendez-vous…" onChange={(e) => setSwap({ ...swap, reason: e.target.value })} /></Field>
              <button className="btn btn-primary" disabled={!swap.date || !swap.to} onClick={() => { submit({ type: "swap", from: myKey, target: pkey(team.find((a) => a.id === swap.to)), date: swap.date, reason: swap.reason }); setSwap({ date: "", to: "", reason: "" }); }}><Send size={15} />Envoyer la demande</button>
            </Panel>
            <Panel title={<><CalendarDays size={15} style={{ verticalAlign: -2 }} /> Demander un congé</>}>
              <Field label="Jour"><select className="select" value={leave.date} onChange={(e) => setLeave({ ...leave, date: e.target.value })}><option value="">Choisir un jour…</option>{myDays.map((d) => <option key={keyOf(d)} value={keyOf(d)}>{shortDay(d)}</option>)}</select></Field>
              <Field label="Raison"><input className="input" value={leave.reason} placeholder="ex. rendez-vous médical" onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></Field>
              <button className="btn btn-primary" disabled={!leave.date || !leave.reason.trim()} onClick={() => { submit({ type: "leave", from: myKey, target: null, date: leave.date, reason: leave.reason }); setLeave({ date: "", reason: "" }); }}><Send size={15} />Envoyer la demande</button>
            </Panel>
          </> : <Panel title="Faire une demande"><p className="muted">Les échanges et congés se demandent sur un mois publié. Choisissez un mois dans la section Planning.</p></Panel>}
          <Panel title={`Mes demandes · ${mine.length}`} flush>
            {mine.length === 0 && <p className="panel-body muted">Aucune demande envoyée.</p>}
            {mine.map((r) => (
              <div key={r.id} className="myreq">
                <div><b>{r.type === "swap" ? "Échange" : "Congé"}</b> · {dayLabel(parseDate(r.date))}{r.type === "swap" && <> avec {nameOf(r.monthKey, r.target)}</>}{r.reason && <span className="block muted small">« {r.reason} »</span>}{r.reply && <span className="block small reply-txt">Réponse : {r.reply}</span>}</div>
                <span className={`chip ${r.status === "approved" ? "ok" : r.status === "rejected" ? "danger" : "warn"}`}>{r.status === "approved" ? "acceptée" : r.status === "rejected" ? "refusée" : "en attente"}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <div className={`sec sec-past${past.length ? "" : " mobile-only"}`}>
        <Panel title={<><Archive size={15} style={{ verticalAlign: -2 }} /> Plannings passés</>} flush>
          {past.length === 0 && <p className="panel-body muted">Aucun planning validé avant {mName.toLowerCase()}.</p>}
          {past.map((arc) => {
            const days = Object.keys(arc.snapshot[arc.myId]).sort().filter((k) => arc.snapshot[arc.myId][k].type !== "R");
            return (
              <details key={arc.mk} className="past">
                <summary><b>{monthName(arc.mk)} {arc.mk.slice(0, 4)}</b><span className="muted small">validé le {arc.validatedAt} · {days.length} jours</span><ChevronRight size={15} className="chev" /></summary>
                <div className="past-days">{days.map((k) => <span key={k} className="past-day"><span className="num small">{shortDay(parseDate(k))}</span><Shift c={arc.snapshot[arc.myId][k]} size="sm" /></span>)}</div>
              </details>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
