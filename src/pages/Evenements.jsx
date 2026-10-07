import React from "react";
import { Flag, Plus, Trash2, Eye } from "lucide-react";
import { parseDate, WD, MONTHS_ABBR } from "../data.js";
import { PageHead, Panel } from "../ui.jsx";

// Fiche d'un événement. Définie hors de la page : recréée à chaque rendu, elle ferait perdre
// le curseur à chaque lettre tapée.
function EventItem({ e, isPast, today, upd, onDelete }) {
  const d = parseDate(e.date);
  return (
    <div className={`event${isPast ? " past" : ""}${e.date === today ? " today" : ""}`}>
      <div className="agenda-date"><span>{WD[d.getDay()]}</span><strong>{d.getDate()}</strong><span>{MONTHS_ABBR[d.getMonth()]}</span></div>
      <div className="event-fields">
        <input className="inline-input title" value={e.title} placeholder="Titre de l’événement" aria-label="Titre" onChange={(x) => upd(e.id, { title: x.target.value })} />
        <div className="event-when">
          <input className="input" type="date" value={e.date} aria-label="Date" onChange={(x) => x.target.value && upd(e.id, { date: x.target.value })} />
          <input className="input" type="time" value={e.time} aria-label="Heure" onChange={(x) => upd(e.id, { time: x.target.value })} />
          {e.date === today && <span className="chip brand">aujourd’hui</span>}
        </div>
        <textarea className="input" rows={2} value={e.instructions} placeholder="Consignes, informations pratiques…" aria-label="Consignes" onChange={(x) => upd(e.id, { instructions: x.target.value })} />
      </div>
      <button className="icon-btn" aria-label="Supprimer" onClick={() => onDelete(e.id)}><Trash2 size={16} /></button>
    </div>
  );
}

export default function Evenements({ happenings, setHappenings, dayNotes, setDayNotes, say, today }) {
  const upd = (id, patch) => setHappenings((h) => h.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const onDelete = (id) => { const before = happenings; setHappenings((h) => h.filter((x) => x.id !== id)); say("Événement supprimé.", () => setHappenings(before)); };
  const sorted = [...happenings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const upcoming = sorted.filter((e) => e.date >= today), past = sorted.filter((e) => e.date < today);
  const notes = Object.entries(dayNotes).filter(([, v]) => v != null).sort();
  const add = () => setHappenings((h) => [...h, { id: "e" + Date.now(), date: today, time: "09:00", title: "", instructions: "" }]);
  const item = (e, isPast) => <EventItem key={e.id} e={e} isPast={isPast} today={today} upd={upd} onDelete={onDelete} />;

  return (
    <>
      <PageHead title="Événements" sub="Visibles par toute l’équipe dans l’espace agent, et signalés d’un point dans la grille du planning.">
        <button className="btn btn-primary btn-sm" onClick={add}><Plus size={15} />Ajouter un événement</button>
      </PageHead>
      <div className="split" style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
        <div className="stack">
          <Panel title={`À venir · ${upcoming.length}`} right={<span className="muted small"><Eye size={13} style={{ verticalAlign: -2 }} /> visibles par les agents</span>} flush>
            {upcoming.length === 0 ? <div className="empty-state"><Flag size={24} /><p>Aucun événement à venir. Ajoutez une formation, une fermeture, une visite…</p></div> : upcoming.map((e) => item(e, false))}
          </Panel>
          {past.length > 0 && <Panel title={`Passés · ${past.length}`} flush>{past.map((e) => item(e, true))}</Panel>}
        </div>
        <Panel title="Mentions dans la grille">
          <p className="hint" style={{ marginTop: 0 }}>Mot court affiché au-dessus du jour dans le planning et sur l’affiche imprimée (ex. FORMATION). Se modifie aussi directement dans la grille.</p>
          <div className="swap-list">
            {notes.map(([dk, v]) => (
              <div key={dk} className="swap-row" style={{ cursor: "default" }}>
                <span className="num small" style={{ width: 54 }}>{parseDate(dk).getDate()}/{parseDate(dk).getMonth() + 1}</span>
                <input className="inline-input" value={v} aria-label="Mention" onChange={(x) => setDayNotes({ ...dayNotes, [dk]: x.target.value.toUpperCase() })} />
                <button className="icon-btn" aria-label="Supprimer" onClick={() => { const { [dk]: _, ...rest } = dayNotes; setDayNotes(rest); }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
