import React, { useState } from "react";
import { ChevronRight, Send, Flag, Archive, ArrowLeftRight, CalendarDays } from "lucide-react";
import { SHIFTS, OFF, WD, WD_FULL, MONTHS_FR, MONTHS_ABBR, keyOf, parseDate, fmtH, shortDay, dayLabel, monthName, totalsFor, pkey, deM } from "../data.js";
import { Panel, Shift, RoleDot, Field } from "../ui.jsx";

const monday = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return keyOf(x); };

export default function Agent({ me, team, plan, dates, mName, happenings, requests, submit, archives, monthTeams, today: TODAY }) {
  const [open, setOpen] = useState(null);
  const [swap, setSwap] = useState({ date: "", to: "", reason: "" });
  const [leave, setLeave] = useState({ date: "", reason: "" });
  if (!me) return <Panel title={`Pas dans l’équipe ${deM(mName)}`}><p className="muted">Choisissez un autre mois en haut de l’écran pour voir votre planning.</p></Panel>;
  if (!plan) return <Panel title={`Planning ${deM(mName)}`}><p className="muted">Le planning {deM(mName)} n’est pas encore publié.</p></Panel>;

  const myKey = pkey(me);
  const myDays = dates.filter((d) => plan[me.id]?.[keyOf(d)] && plan[me.id][keyOf(d)].type !== "R");
  const weeks = []; const wm = new Map();
  myDays.forEach((d) => { const k = monday(d); if (!wm.has(k)) { wm.set(k, []); weeks.push(k); } wm.get(k).push(d); });
  const t = totalsFor(me, dates, plan);
  const upcoming = happenings.filter((e) => e.date >= TODAY && e.title).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const other = (h) => (h === "M" ? "AM" : "M");
  const swapDays = dates.filter((d) => { const c = plan[me.id]?.[keyOf(d)]; return c && (c.type === "M" || c.type === "AM") && !c.tag; });
  const partners = swap.date ? team.filter((a) => { if (a.id === me.id || a.role !== me.role) return false; const c = plan[a.id]?.[swap.date], mine = plan[me.id][swap.date]; return c && c.type === other(mine.type) && !c.tag; }) : [];
  const mine = requests.filter((r) => r.from === myKey).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Les archives sont classées par fiche du mois : on y retrouve la personne par son identité
  const idInMonth = (mk) => (monthTeams[mk] || []).find((a) => pkey(a) === myKey)?.id;
  const past = archives.map((a) => ({ ...a, myId: idInMonth(a.mk) })).filter((a) => a.myId && a.snapshot[a.myId] && dates[0] && a.mk < keyOf(dates[0]).slice(0, 7)).sort((a, b) => b.mk.localeCompare(a.mk));
  const nameOf = (mk, key) => (monthTeams[mk] || []).find((a) => pkey(a) === key)?.first || "un·e collègue";

  return (
    <div className="agent-space">
      <div className="agent-hello">
        <h1>Bonjour {me.first}</h1>
        <p className="sub">{mName} 2026 · {myDays.length} jours travaillés · {fmtH(t.total)}{t.ot ? ` dont ${fmtH(t.ot)} d’heures sup` : ""}</p>
      </div>

      {upcoming.length > 0 && (
        <Panel title={<><Flag size={15} style={{ verticalAlign: -2 }} /> Événements à venir</>} flush>
          {upcoming.map((e) => { const d = parseDate(e.date); return (
            <div key={e.id} className={`event ro${e.date === TODAY ? " today" : ""}`}>
              <div className="agenda-date"><span>{WD[d.getDay()]}</span><strong>{d.getDate()}</strong><span>{MONTHS_ABBR[d.getMonth()]}</span></div>
              <div><b>{e.title}</b> <span className="muted small num">{e.time.replace(":", "h")}</span>{e.date === TODAY && <span className="chip brand" style={{ marginLeft: 8 }}>aujourd’hui</span>}{e.instructions && <p className="muted small">{e.instructions}</p>}</div>
            </div>
          ); })}
        </Panel>
      )}

      <div className="agent-grid">
        <Panel title={`Mon planning · ${mName.toLowerCase()}`} flush>
          <div className="agent-sum">
            <div><b className="num">{myDays.length}</b><span>jours</span></div>
            <div><b className="num">{fmtH(t.total)}</b><span>heures</span></div>
            <div><b className="num" style={{ color: t.ot ? "oklch(45% 0.2 352)" : undefined }}>{t.ot ? `+${fmtH(t.ot)}` : "0h"}</b><span>heures sup</span></div>
          </div>
          {weeks.map((wk, i) => {
            const days = wm.get(wk), wh = days.reduce((s, d) => { const c = plan[me.id][keyOf(d)]; return s + SHIFTS[c.type].hours + (c.ot || 0); }, 0);
            return (
              <div key={wk} className="week">
                <div className="week-head"><span>Semaine {i + 1}</span><span className="num">{fmtH(wh)}</span></div>
                {days.map((d) => {
                  const k = keyOf(d), c = plan[me.id][k], s = SHIFTS[c.type], isOpen = open === k;
                  const col = team.filter((a) => a.id !== me.id && plan[a.id]?.[k] && !OFF.includes(plan[a.id][k].type)).map((a) => {
                    const sh = SHIFTS[plan[a.id][k].type]; return { a, c: plan[a.id][k], with: sh.present.filter((h) => s.present.includes(h)).length >= 2 };
                  });
                  return (
                    <div key={k} className={`aday${isOpen ? " open" : ""}${k === TODAY ? " today" : ""}`}>
                      <button className="aday-btn" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
                        <span className="aday-date"><span>{WD[d.getDay()]}</span><b>{d.getDate()}</b></span>
                        <Shift c={c} />
                        <span className="aday-main"><b>{s.label}</b>{c.tag && <span className="aday-tag">{c.tag === "VR" ? "veille de repos" : "lendemain de repos"}</span>}<span className="block muted num small">{s.time}</span></span>
                        <span className="aday-h num">{s.hours ? fmtH(s.hours) : ""}{c.ot > 0 && <span className="block hs-txt">+{fmtH(c.ot)}</span>}</span>
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

        <div className="stack">
          <Panel title={<><ArrowLeftRight size={15} style={{ verticalAlign: -2 }} /> Échanger une demi-journée</>}>
            <p className="hint" style={{ marginTop: 0 }}>Avec un·e collègue de même fonction présent·e sur l’autre demi-journée. Impossible la veille ou le lendemain d’un repos.</p>
            <Field label="Jour"><select className="select" value={swap.date} onChange={(e) => setSwap({ ...swap, date: e.target.value, to: "" })}><option value="">Choisir un jour…</option>{swapDays.map((d) => <option key={keyOf(d)} value={keyOf(d)}>{shortDay(d)} · {SHIFTS[plan[me.id][keyOf(d)].type].label}</option>)}</select></Field>
            {swap.date && <Field label="Avec" hint={partners.length ? undefined : "Personne de disponible ce jour-là."}><select className="select" value={swap.to} onChange={(e) => setSwap({ ...swap, to: e.target.value })}><option value="">Choisir un·e collègue…</option>{partners.map((a) => <option key={a.id} value={a.id}>{a.first} {a.last.toUpperCase()} · {SHIFTS[plan[a.id][swap.date].type].label}</option>)}</select></Field>}
            <Field label="Raison (facultatif)"><textarea className="input" rows={2} value={swap.reason} placeholder="ex. formation, rendez-vous…" onChange={(e) => setSwap({ ...swap, reason: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={!swap.date || !swap.to} onClick={() => { submit({ type: "swap", from: myKey, target: pkey(team.find((a) => a.id === swap.to)), date: swap.date, reason: swap.reason }); setSwap({ date: "", to: "", reason: "" }); }}><Send size={15} />Envoyer la demande</button>
          </Panel>
          <Panel title={<><CalendarDays size={15} style={{ verticalAlign: -2 }} /> Demander un congé</>}>
            <Field label="Jour"><select className="select" value={leave.date} onChange={(e) => setLeave({ ...leave, date: e.target.value })}><option value="">Choisir un jour…</option>{myDays.map((d) => <option key={keyOf(d)} value={keyOf(d)}>{shortDay(d)}</option>)}</select></Field>
            <Field label="Raison"><input className="input" value={leave.reason} placeholder="ex. rendez-vous médical" onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={!leave.date || !leave.reason.trim()} onClick={() => { submit({ type: "leave", from: myKey, target: null, date: leave.date, reason: leave.reason }); setLeave({ date: "", reason: "" }); }}><Send size={15} />Envoyer la demande</button>
          </Panel>
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

      {past.length > 0 && (
        <Panel title={<><Archive size={15} style={{ verticalAlign: -2 }} /> Plannings passés</>} flush>
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
      )}
    </div>
  );
}
