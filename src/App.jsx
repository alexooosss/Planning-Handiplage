import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Users, LayoutGrid, Activity, Clock, Inbox, CalendarDays, FileDown, IdCard, Archive, KeyRound,
  Wand2, CheckCircle2, Check, LogOut, Download, Upload, Printer, Loader2, AlertTriangle, X,
} from "lucide-react";
import { supabase, PLANNING_ID } from "./supabase.js";
import {
  monthsInSeason, monthDates, monthName, buildPlanning, keyOf, pkey, uid, todayKey, frDate, loadState, emptyState, DATA_VERSION, seasonHours, deM } from "./data.js";
import { Avatar } from "./ui.jsx";
import Planning from "./pages/Planning.jsx";
import Equipe from "./pages/Equipe.jsx";
import Couverture from "./pages/Couverture.jsx";
import Heures from "./pages/Heures.jsx";
import Demandes from "./pages/Demandes.jsx";
import Evenements from "./pages/Evenements.jsx";
import Export from "./pages/Export.jsx";
import Badges, { badgeStatus } from "./pages/Badges.jsx";
import Historique from "./pages/Historique.jsx";
import Comptes from "./pages/Comptes.jsx";
import Agent from "./pages/Agent.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";

const BASE = import.meta.env.BASE_URL;
const clone = (x) => JSON.parse(JSON.stringify(x));
const PROFILES_KEY = "hp-profiles";

export default function App() {
  /* ---------- Données (une seule ligne Supabase, comme l'ancien site) ---------- */
  const [db, setDb] = useState(null);       // état complet de la saison
  const [legacy, setLegacy] = useState(null); // données de l'ancien site, conservées telles quelles
  const [loadError, setLoadError] = useState(false);
  const [save, setSave] = useState({ s: "idle", at: null });

  useEffect(() => {
    supabase.from("planning_state").select("data").eq("id", PLANNING_ID).maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        const raw = data?.data || null;
        if (raw && raw.version !== DATA_VERSION) setLegacy(raw);
        else if (raw?.legacyV1) setLegacy(raw.legacyV1);
        setDb(loadState(raw));
      })
      .catch(() => { setLoadError(true); setDb(emptyState()); });
  }, []);

  // Enregistrement automatique 2,5 s après la dernière modification
  const firstSave = useRef(true);
  useEffect(() => {
    if (!db || loadError) return;
    if (firstSave.current) { firstSave.current = false; return; }
    setSave({ s: "saving" });
    const t = setTimeout(async () => {
      const payload = { ...db, version: DATA_VERSION, ...(legacy ? { legacyV1: legacy } : {}) };
      const { error } = await supabase.from("planning_state").upsert({ id: PLANNING_ID, data: payload, updated_at: new Date().toISOString() });
      setSave(error ? { s: "error" } : { s: "saved", at: new Date() });
    }, 2500);
    return () => clearTimeout(t);
  }, [db, legacy, loadError]);

  // Modifie une partie de l'état (valeur ou fonction)
  const upd = useCallback((key) => (v) => setDb((d) => ({ ...d, [key]: typeof v === "function" ? v(d[key]) : v })), []);
  const setSeason = upd("season"), setMonthTeams = upd("monthTeams"), setPlans = upd("plans"), setArchives = upd("archives");
  const setRequests = upd("requests"), setHappenings = upd("happenings"), setDayNotes = upd("dayNotes"), setAccounts = upd("accounts"), setBadges = upd("badges");

  /* ---------- Interface ---------- */
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("planning");
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [profiles, setProfiles] = useState(() => { try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}"); } catch { return {}; } });
  const [profileOpen, setProfileOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [covDay, setCovDay] = useState(0);
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [toast, setToast] = useState(null);

  const season = db?.season;
  const months = useMemo(() => (season ? monthsInSeason(season.open, season.close) : []), [season?.open, season?.close]);

  // Chaque nouveau mois de la saison reprend l'équipe du mois précédent (comme l'ancien site)
  useEffect(() => {
    if (!db || !months.length) return;
    const missing = months.filter((m) => !db.monthTeams[m]);
    if (!missing.length) return;
    setMonthTeams((mt) => {
      const next = { ...mt };
      months.forEach((m, i) => { if (!next[m]) next[m] = i > 0 && next[months[i - 1]] ? next[months[i - 1]].map((a) => ({ ...a, id: uid() })) : []; });
      return next;
    });
  }, [db, months, setMonthTeams]);

  // Profil : reprend aussi les champs de l'ancien site (photoUrl, darkMode)
  const rawProfile = (session && profiles[session.id]) || {};
  const profile = { ...rawProfile, photo: rawProfile.photo ?? rawProfile.photoUrl ?? "", dark: rawProfile.dark ?? rawProfile.darkMode ?? false };
  useEffect(() => { document.documentElement.dataset.theme = profile.dark ? "dark" : "light"; }, [profile.dark]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* stockage indisponible */ } }, [profiles]);

  if (!db) return <div className="loading"><Loader2 size={26} className="spin" /><p>Chargement du planning…</p></div>;

  // Mois ouvert par défaut : le mois en cours ; hors saison, le dernier mois planifié (ou le premier avant la saison)
  const cur = todayKey().slice(0, 7);
  const fallback = cur > months[months.length - 1] ? [...months].reverse().find((m) => db.plans[m] || db.archives.some((a) => a.mk === m)) || months[months.length - 1] : months[0];
  const mk = months.includes(month) ? month : months.includes(cur) ? cur : fallback;
  const mName = monthName(mk);
  const dates = monthDates(mk, season.open, season.close);
  const team = db.monthTeams[mk] || [];
  const archived = db.archives.find((a) => a.mk === mk);
  const rawPlan = archived ? archived.snapshot : db.plans[mk] || null;
  // Grille complète pour l'affichage : une personne ajoutée après la génération apparaît au repos
  const plan = rawPlan && team.some((a) => rawPlan[a.id]) ? Object.fromEntries(team.map((a) => [a.id, Object.fromEntries(dates.map((d) => { const k = keyOf(d); return [k, rawPlan[a.id]?.[k] || { type: "R", ot: 0 }]; }))])) : null;
  const pending = db.requests.filter((r) => r.status === "pending");
  const say = (msg, undo) => setToast({ msg, undo });

  const setTeam = (u) => setMonthTeams((p) => ({ ...p, [mk]: typeof u === "function" ? u(p[mk] || []) : u }));
  const updPlan = (fn) => {
    if (archived) setArchives((as) => as.map((a) => (a.mk === mk ? { ...a, snapshot: fn(a.snapshot) } : a)));
    else setPlans((p) => ({ ...p, [mk]: fn(p[mk] || {}) }));
  };
  const setCell = (id, dk, patch) => updPlan((pl) => ({ ...pl, [id]: { ...(pl[id] || {}), [dk]: { type: "R", ot: 0, ...(pl[id]?.[dk] || {}), ...patch } } }));
  const swapCells = (aId, bId, dk) => {
    const A = plan[aId][dk], B = plan[bId][dk];
    const n = (id) => team.find((x) => x.id === id).first;
    updPlan((pl) => ({ ...pl, [aId]: { ...pl[aId], [dk]: { ...A, type: B.type, tag: null } }, [bId]: { ...pl[bId], [dk]: { ...B, type: A.type, tag: null } } }));
    say(`${n(aId)} et ${n(bId)} permutés le ${Number(dk.slice(8))}.`, () => updPlan((pl) => ({ ...pl, [aId]: { ...pl[aId], [dk]: A }, [bId]: { ...pl[bId], [dk]: B } })));
  };
  // Heures déjà faites avant le mois m, par fiche de l'équipe du mois (pour équilibrer la génération)
  const priorFor = (m, t, plansNow) => {
    const cum = seasonHours(months.slice(0, months.indexOf(m)), { archives: db.archives, plans: plansNow, monthTeams: db.monthTeams, season });
    return Object.fromEntries(t.map((a) => [a.id, cum[pkey(a)] || 0]));
  };
  const generate = () => {
    if (archived) { say(`${mName} est validé : il n’est plus régénérable.`); return; }
    if (!team.length) { say(`L’équipe ${deM(mName)} est vide : ajoutez des personnes dans Équipe.`); setPage("equipe"); return; }
    const before = db.plans[mk];
    setPlans((p) => ({ ...p, [mk]: buildPlanning(team, dates, season.minHalf, null, priorFor(mk, team, db.plans)) }));
    setSel(null); setPage("planning");
    say(`Planning ${deM(mName)} généré : ${dates.length} jours, ${team.length} personnes.`, before ? () => setPlans((p) => ({ ...p, [mk]: before })) : null);
  };
  const generateAll = () => {
    const before = db.plans;
    const next = { ...db.plans };
    // Mois après mois : chaque mois tient compte des heures des mois précédents tout juste générés
    months.forEach((m) => { const t = db.monthTeams[m] || []; if (!db.archives.some((a) => a.mk === m) && t.length) next[m] = buildPlanning(t, monthDates(m, season.open, season.close), season.minHalf, null, priorFor(m, t, next)); });
    setPlans(next); setPage("planning");
    say("Toute la saison a été générée. Les mois validés sont conservés.", () => setPlans(before));
  };
  const validate = () => {
    setArchives((as) => [...as.filter((a) => a.mk !== mk), { mk, validatedAt: frDate(todayKey()), snapshot: clone(db.plans[mk]) }]);
    setConfirmValidate(false);
    say(`${mName} validé : archivé et publié dans l’espace des agents.`);
  };
  // Une demande désigne des personnes (identité stable) : on retrouve leur fiche dans l'équipe du mois concerné
  const idIn = (m, key) => (db.monthTeams[m] || []).find((a) => pkey(a) === key)?.id;
  const decide = (r, ok, reply = "") => {
    if (ok) {
      const aId = idIn(r.monthKey, r.from), bId = r.target ? idIn(r.monthKey, r.target) : null;
      const apply = (pl) => {
        if (!pl || !aId || !pl[aId]) return pl;
        if (r.type === "leave") return { ...pl, [aId]: { ...pl[aId], [r.date]: { type: "IN", ot: 0 } } };
        const A = pl[aId][r.date], B = bId && pl[bId]?.[r.date];
        if (!A || !B) return pl;
        return { ...pl, [aId]: { ...pl[aId], [r.date]: { ...A, type: B.type, tag: null } }, [bId]: { ...pl[bId], [r.date]: { ...B, type: A.type, tag: null } } };
      };
      setPlans((p) => (p[r.monthKey] ? { ...p, [r.monthKey]: apply(p[r.monthKey]) } : p));
      setArchives((as) => as.map((a) => (a.mk === r.monthKey ? { ...a, snapshot: apply(a.snapshot) } : a)));
    }
    setRequests((l) => l.map((x) => (x.id === r.id ? { ...x, status: ok ? "approved" : "rejected", reply } : x)));
    say(`Demande ${ok ? "acceptée et appliquée au planning" : "refusée"}. L’agent voit la réponse dans son espace.`);
  };
  const submit = (req) => {
    setRequests((l) => [{ id: uid(), status: "pending", createdAt: Date.now(), monthKey: req.date.slice(0, 7), reply: "", ...req }, ...l]);
    say("Demande envoyée. La réponse apparaîtra dans « Mes demandes ».");
  };
  const copyPrev = () => {
    const i = months.indexOf(mk);
    if (i <= 0) return;
    const before = team;
    setTeam((db.monthTeams[months[i - 1]] || []).map((a) => ({ ...a, id: uid() })));
    say("Équipe du mois précédent reprise.", () => setTeam(before));
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ ...db, version: DATA_VERSION, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `planning-saison_${todayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say("Sauvegarde téléchargée.");
  };
  const importJSON = (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    f.text().then((t) => {
      try {
        const raw = JSON.parse(t);
        if (!raw || typeof raw !== "object" || !(raw.monthTeams || raw.season || raw.seasonOpen)) throw new Error("format");
        const before = db;
        setDb(loadState(raw)); // accepte aussi les sauvegardes de l'ancien site
        say("Saison importée.", () => setDb(before));
      } catch { say("Fichier illisible : ce n’est pas une sauvegarde de planning."); }
    });
  };
  const changePassword = (cur, next) => {
    const i = db.accounts.findIndex((a) => a.id === session.id);
    if (i < 0 || db.accounts[i].password !== cur) return "Mot de passe actuel incorrect.";
    setAccounts((a) => a.map((x, j) => (j === i ? { ...x, password: next } : x)));
    return null;
  };
  // Toutes les personnes de la saison, une fois chacune (la plus récente fiche fait foi)
  const allPeople = (() => { const m = new Map(); months.forEach((mm) => (db.monthTeams[mm] || []).forEach((p) => p.first && m.set(pkey(p), p))); return [...m.values()]; })();

  if (!session) return <Login accounts={db.accounts} loadError={loadError} onLogin={(a) => { setSession(a); setPage("planning"); }} />;

  const isAdmin = session.role === "admin";
  const status = (m) => (db.archives.some((a) => a.mk === m) ? "ok" : db.plans[m] && (db.monthTeams[m] || []).some((a) => db.plans[m][a.id]) ? "draft" : "empty");
  const lowCount = plan ? dates.reduce((s, d) => { const k = keyOf(d); let m = 0, am = 0; team.forEach((a) => { const t = plan[a.id]?.[k]?.type; if (t === "M" || t === "CP") m++; if (t === "AM" || t === "CP") am++; }); return s + (m < season.minHalf) + (am < season.minHalf); }, 0) : 0;
  const badgeTodo = team.filter((a) => badgeStatus(a, db.badges) !== "ok").length;
  const noAcc = allPeople.filter((p) => !db.accounts.some((c) => c.pkey === pkey(p))).length;

  const NAV = [
    ["Préparer", [["equipe", "Équipe", Users, team.length], ["planning", "Planning", LayoutGrid, lowCount ? { warn: `${lowCount} alerte${lowCount > 1 ? "s" : ""}` } : null]]],
    ["Contrôler", [["couverture", "Couverture", Activity], ["heures", "Heures", Clock]]],
    ["Communiquer", [["demandes", "Demandes", Inbox, pending.length ? { count: pending.length } : null], ["evenements", "Événements", CalendarDays], ["export", "Export", FileDown], ["badges", "Badges", IdCard, badgeTodo ? `${badgeTodo} à faire` : null]]],
    ["Gérer", [["historique", "Historique", Archive], ["comptes", "Comptes", KeyRound, noAcc ? `${noAcc} sans compte` : null]]],
  ];
  const ctx = {
    team, setTeam, plan, plans: db.plans, dates, mk, mName, months, season, setSeason, sel, setSel, setCell, swapCells,
    dayNotes: db.dayNotes, setDayNotes, happenings: db.happenings, setHappenings, requests: db.requests, pending, decide, setPage,
    generate, generateAll, archived, archives: db.archives, validate: () => setConfirmValidate(true), copyPrev,
    accounts: db.accounts, setAccounts, allPeople, monthTeams: db.monthTeams, badges: db.badges, setBadges,
    covDay, setCovDay, exportJSON, importJSON, say, today: todayKey(), openMonth: (m) => { setMonth(m); setPage("planning"); },
  };
  const Page = { equipe: Equipe, planning: Planning, couverture: Couverture, heures: Heures, demandes: Demandes, evenements: Evenements, export: Export, badges: Badges, historique: Historique, comptes: Comptes }[page];
  const me = { id: session.id, name: session.name, first: session.name.split(" ")[0], last: session.name.split(" ").slice(1).join(" ") };
  const saveLabel = save.s === "saving" ? <><Loader2 size={15} className="spin" />Enregistrement…</>
    : save.s === "error" ? <><AlertTriangle size={15} />Erreur d’enregistrement</>
      : loadError ? <><AlertTriangle size={15} />Hors ligne : rien n’est enregistré</>
        : <><CheckCircle2 size={15} className="i" />{save.at ? `Enregistré à ${save.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Tout est enregistré"}</>;

  return (
    <div className={`shell${isAdmin ? "" : " agent-shell"}`}>
      {isAdmin && (
        <aside className="side" aria-label="Navigation">
          <div className="side-brand">
            <img className="logo" src={`${BASE}logo.svg`} alt="Handiplage Planning" />
            <div className="side-sub">CCAS Antibes · saison {season.open.slice(0, 4)}</div>
          </div>
          <nav className="nav">
            {NAV.map(([g, items]) => (
              <div className="nav-group" key={g}>
                <p>{g}</p>
                {items.map(([id, label, Icon, extra]) => (
                  <button key={id} className="nav-item" aria-current={page === id ? "page" : undefined} onClick={() => { setPage(id); setSel(null); }}>
                    <Icon size={18} strokeWidth={1.9} />{label}
                    {extra != null && (typeof extra === "object" ? (extra.count ? <span className="nav-count">{extra.count}</span> : <span className="nav-hint warn">{extra.warn}</span>) : <span className="nav-hint">{extra}</span>)}
                  </button>
                ))}
              </div>
            ))}
            <div className="nav-group">
              <p>Données</p>
              <button className="nav-item" onClick={exportJSON}><Download size={18} strokeWidth={1.9} />Sauvegarder (.json)</button>
              <label className="nav-item"><Upload size={18} strokeWidth={1.9} />Importer…<input type="file" accept="application/json" hidden onChange={importJSON} /></label>
              <button className="nav-item" onClick={() => setPage("export")}><Printer size={18} strokeWidth={1.9} />Imprimer</button>
            </div>
          </nav>
          <div className="side-foot">
            <button className="profile-btn" onClick={() => setProfileOpen(true)} aria-label="Mon profil">
              <Avatar a={me} size={32} photo={profile.photo} /><span className="who">{session.name}<span>Mon profil</span></span>
            </button>
            <button className="icon-btn" title="Se déconnecter" aria-label="Se déconnecter" onClick={() => setSession(null)}><LogOut size={17} /></button>
          </div>
        </aside>
      )}

      <div className="main">
        {isAdmin && (
          <nav className="mobile-nav" aria-label="Navigation">
            {NAV.flatMap(([, items]) => items).map(([id, label, Icon]) => <button key={id} className="nav-item" aria-current={page === id ? "page" : undefined} onClick={() => setPage(id)}><Icon size={16} />{label}</button>)}
          </nav>
        )}
        <header className="topbar">
          {!isAdmin && <div className="side-brand compact"><img className="logo" src={`${BASE}logo.svg`} alt="Handiplage Planning" /></div>}
          <div className="months" role="group" aria-label="Mois de la saison">
            {months.map((m) => (
              <button key={m} className="month" aria-pressed={m === mk} onClick={() => { setMonth(m); setSel(null); setConfirmValidate(false); setCovDay(0); }}>
                <strong>{monthName(m)}</strong>
                <span><i className={`mdot ${status(m)}`} />{isAdmin ? (status(m) === "ok" ? "validé" : status(m) === "draft" ? "brouillon" : "à générer") : status(m) === "ok" ? "publié" : status(m) === "draft" ? "provisoire" : "à venir"} · {monthDates(m, season.open, season.close).length} j</span>
              </button>
            ))}
          </div>
          <div className="top-spacer" />
          <span className={`save ${save.s}${loadError ? " error" : ""}`} role="status">{saveLabel}</span>
          {isAdmin && (archived
            ? <span className="chip ok lg"><CheckCircle2 size={15} />Validé le {archived.validatedAt}</span>
            : !plan ? <button className="btn btn-primary" onClick={generate}><Wand2 size={17} />Générer {mName.toLowerCase()}</button>
              : confirmValidate ? (
                <span className="confirm" role="group" aria-label="Confirmer la validation">
                  <span>Archiver et publier {mName.toLowerCase()} ?</span>
                  <button className="btn btn-primary btn-sm" onClick={validate}><Check size={15} />Valider</button>
                  <button className="icon-btn" aria-label="Annuler" onClick={() => setConfirmValidate(false)}><X size={16} /></button>
                </span>
              ) : <button className="btn btn-primary" onClick={() => setConfirmValidate(true)}><CheckCircle2 size={17} />Valider {mName.toLowerCase()}</button>)}
          {!isAdmin && <>
            <button className="profile-btn light" onClick={() => setProfileOpen(true)} aria-label="Mon profil"><Avatar a={me} size={32} photo={profile.photo} /><span className="who">{session.name}<span>Mon profil</span></span></button>
            <button className="btn btn-ghost btn-sm quit" onClick={() => setSession(null)} aria-label="Quitter"><LogOut size={15} /><span>Quitter</span></button>
          </>}
        </header>

        <main className="page">
          {isAdmin ? <Page {...ctx} /> : <Agent me={team.find((a) => pkey(a) === session.pkey)} {...{ team, plan, dates, mName, happenings: db.happenings, requests: db.requests, submit, archives: db.archives, monthTeams: db.monthTeams, today: todayKey(), months, mk, setMonth, monthStatus: (m) => (status(m) === "ok" ? "publié" : status(m) === "draft" ? "provisoire" : "à venir") }} />}
        </main>
      </div>

      {profileOpen && <Profile session={session} profile={profile} setProfile={(p) => setProfiles({ ...profiles, [session.id]: p })} changePassword={changePassword} onClose={() => setProfileOpen(false)} />}
      {toast && <div className="toast" role="status"><Check size={17} />{toast.msg}{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Annuler</button>}</div>}
    </div>
  );
}

