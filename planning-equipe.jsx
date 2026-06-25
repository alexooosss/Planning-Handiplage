import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Users, CalendarDays, LayoutGrid, BarChart3, Plus, Trash2, Wand2,
  Download, Upload, Printer, X, Clock, ChevronLeft, ChevronRight, Crown, FileText,
  ArrowLeftRight, Lock, LogOut, ShieldCheck, Inbox, Send, Check, KeyRound,
  Moon, Sun, Mail, UserCircle2, Flag, AlertCircle,
} from "lucide-react";

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/* ------------------------------------------------------------------ */
/*  Référentiel : types d'horaires et états                           */
/* ------------------------------------------------------------------ */

// `present` = blocs horaires (7..18) où l'agent est compté comme présent.
const SHIFTS = {
  M:  { code: "M",  label: "Matin",            time: "7h20 – 13h10",  hours: 5.8333, bg: "#FCE7A2", fg: "#7A4E08", present: [7, 8, 9, 10, 11, 12, 13] },
  AM: { code: "AM", label: "Après-midi",       time: "13h10 – 19h00", hours: 5.8333, bg: "#BFE3F5", fg: "#0C4A63", present: [13, 14, 15, 16, 17, 18] },
  CP: { code: "CP", label: "Coupé",            time: "7h20 – 19h00",  hours: 9.9167, bg: "#B6E7CD", fg: "#0B5138", present: [7, 8, 9, 10, 11, 12, 15, 16, 17, 18] },
  AD: { code: "AD", label: "Administratif",    time: "8h30 – 17h00",  hours: 7,      bg: "#F7D2A8", fg: "#7C3D0E", present: [8, 9, 10, 11, 13, 14, 15, 16] },
};


const STATES = {
  R:  { code: "R",  label: "Repos hebdo",  hours: 0, bg: "#E3E7EE", fg: "#5A6678", present: [] },
  RC: { code: "RC", label: "Récup heures", hours: 0, bg: "#CDD4DF", fg: "#3C4655", present: [] },
  IN: { code: "IN", label: "Indisponible", hours: 0, bg: "#9AA5B4", fg: "#1F2733", present: [] },
};

const ALL = { ...SHIFTS, ...STATES };
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const WD_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const WD_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const DEFAULT_NAMES = [
  "KOZIC Dimitri", "LEVET Marylou", "RUAUT Elise", "DALMASSO Alexis", "MARTINS Florian", "ELSAS MALLEM Timothy", "RIGAUT Pauline",
  "INGRASSIA Lana", "MANGIN Anna", "SORRENTINO Lalie",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 9);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (n) => Math.floor(Math.random() * n);
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function keyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function mondayKey(date) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - diff);
  return keyOf(d);
}
function formatH(h) {
  if (!h) return "—";
  const hh = Math.floor(h + 1e-6);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}
const capMonth = (mIdx) => MONTHS_FR[mIdx][0].toUpperCase() + MONTHS_FR[mIdx].slice(1);
const fmtFr = (s) => { const d = parseDate(s); return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`; };

function defaultRoster() {
  return DEFAULT_NAMES.map((name, i) => ({
    id: uid(),
    name,
    role: i === 1 || i === 3 ? "chef" : i === 2 ? "adm" : "agent",
    restDay: i === 1 ? 2 : i === 3 ? 5 : 2, // chef : mardi / vendredi
  }));
}

// liste des mois "YYYY-MM" couverts par la saison
function monthsInSeason(open, close) {
  const o = parseDate(open), c = parseDate(close);
  if (c < o) return [];
  const out = [];
  let y = o.getFullYear(), m = o.getMonth();
  while (y < c.getFullYear() || (y === c.getFullYear() && m <= c.getMonth())) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

// jours d'un mois donné, bornés par l'ouverture et la fermeture de la saison
function monthDates(monthKey, open, close) {
  if (!monthKey) return [];
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const o = parseDate(open), c = parseDate(close);
  const s = first < o ? o : first;
  const e = last > c ? c : last;
  const out = [];
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(new Date(d));
  return out;
}
function cleanAssignments(assignments) {
  const cleaned = {};

  Object.entries(assignments || {}).forEach(([agentId, days]) => {
    cleaned[agentId] = {};

    Object.entries(days || {}).forEach(([dateKey, cell]) => {
      cleaned[agentId][dateKey] = {
        ...cell,
        type: cell?.type === "JC" ? "CP" : cell?.type,
      };
    });
  });

  return cleaned;
}
function normalizeType(type) {
  return type === "JC" ? "CP" : type;
}


/* ------------------------------------------------------------------ */
/*  Application                                                        */
/* ------------------------------------------------------------------ */

export default function App() {
  const [seasonOpen, setSeasonOpen] = useState("2026-06-12");
  const [seasonClose, setSeasonClose] = useState("2026-09-15");
  const [monthTeams, setMonthTeams] = useState({});   // { "2026-06": [agents], ... }
  const [currentMonth, setCurrentMonth] = useState("");
  const [minEffectif, setMinEffectif] = useState(5);
  const [minHalf, setMinHalf] = useState(4);
  const [events, setEvents] = useState({});           // {dateKey: "FORMATION"...}
  const [assignments, setAssignments] = useState({}); // {agentId:{dateKey:{...}}}
  const [tab, setTab] = useState("equipe");
  const [editing, setEditing] = useState(null);
  const [covDay, setCovDay] = useState(0);
  const fileRef = useRef(null);
  const [accounts, setAccounts] = useState([{ id: "admin", password: "admin", role: "admin", name: "Administrateur" }]);
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [happenings, setHappenings] = useState([]);
  const addHappening = () => setHappenings((h) => [...h, { id: uid(), date: keyOf(new Date()), time: "09:00", title: "", instructions: "" }]);
  const updateHappening = (id, patch) => setHappenings((h) => h.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeHappening = (id) => setHappenings((h) => h.filter((e) => e.id !== id));
  const [userProfiles, setUserProfiles] = useState(() => { try { return JSON.parse(localStorage.getItem("hp-profiles") || "{}"); } catch { return {}; } });
  const [profileOpen, setProfileOpen] = useState(false);

  const myProfile = session ? (userProfiles[session.id] || {}) : {};
  const updateProfile = (patch) => {
    if (!session) return;
    const next = { ...userProfiles, [session.id]: { ...myProfile, ...patch } };
    setUserProfiles(next);
    try { localStorage.setItem("hp-profiles", JSON.stringify(next)); } catch {}
  };
  const changePassword = (currentPw, newPw) => {
    const idx = accounts.findIndex((a) => a.id === session?.id);
    if (idx === -1 || accounts[idx].password !== currentPw) return "Mot de passe actuel incorrect.";
    updateAccount(idx, { password: newPw });
    return null;
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", !!myProfile.darkMode);
  }, [myProfile.darkMode]);

  const months = useMemo(() => monthsInSeason(seasonOpen, seasonClose), [seasonOpen, seasonClose]);

  // une équipe par mois ; un nouveau mois reprend l'effectif du mois précédent (à renommer)
  useEffect(() => {
    setMonthTeams((prev) => {
      const nextT = { ...prev };
      let changed = false;
      months.forEach((mk, i) => {
        if (!nextT[mk]) {
          const src = i > 0 ? nextT[months[i - 1]] : null;
          nextT[mk] = src ? src.map((a) => ({ ...a, id: uid() })) : defaultRoster();
          changed = true;
        }
      });
      return changed ? nextT : prev;
    });
  }, [months]);

  useEffect(() => {
    if (months.length && !months.includes(currentMonth)) setCurrentMonth(months[0]);
  }, [months, currentMonth]);

  const agents = monthTeams[currentMonth] || [];
  const setAgents = (updater) =>
    setMonthTeams((prev) => ({ ...prev, [currentMonth]: typeof updater === "function" ? updater(prev[currentMonth] || []) : updater }));

  const dates = useMemo(() => monthDates(currentMonth, seasonOpen, seasonClose), [currentMonth, seasonOpen, seasonClose]);

  const copyPrevMonth = () => {
    const i = months.indexOf(currentMonth);
    if (i <= 0) return;
    setAgents((monthTeams[months[i - 1]] || []).map((a) => ({ ...a, id: uid() })));
  };

  /* ----- moteur : construit le planning d'une équipe sur ses jours ----- */
  function buildPlanning(team, mDates) {
    if (!mDates.length || !team.length) return {};
    const chefList = team.filter((a) => a.role === "chef");
    const agentList = team.filter((a) => a.role === "agent"); // handiplagistes
    const byId = Object.fromEntries(team.map((a) => [a.id, a]));

    // repos tous les 6 jours, ancrés au 1er jour du mois et décalés entre handiplagistes
    const startDate = mDates[0];
    const offset = {};
    shuffle(agentList).forEach((a, i) => { offset[a.id] = i % 6; });
    const dayIndex = (date) => Math.round((date - startDate) / 86400000);
    const isRest = (a, date) => {
      if (a.role === "chef") return date.getDay() === a.restDay;
      if (a.role === "adm") return date.getDay() === 3 || date.getDay() === 4;
      return (((dayIndex(date) - offset[a.id]) % 6) + 6) % 6 === 0;
    };
    const prefAt = (a, date) => (isRest(a, addDays(date, 1)) ? "M" : isRest(a, addDays(date, -1)) ? "AM" : null);
    const other = (h) => (h === "M" ? "AM" : "M");

    const next = {};
    const morn = {};
    team.forEach((a) => { morn[a.id] = 0; });

    // PHASE 1 : repos / administratif / matin-après-midi
    mDates.forEach((d, di) => {
      const dk = keyOf(d);
      const set = (id, type, extra = {}) => { next[id] = next[id] || {}; next[id][dk] = { type, ot: 0, ...extra }; };
      const resting = new Set();
      team.forEach((a) => { if (isRest(a, d)) resting.add(a.id); });
      team.filter((a) => a.role === "adm").forEach((a) => set(a.id, resting.has(a.id) ? "R" : "AD"));
      team.filter((a) => a.role !== "adm" && resting.has(a.id)).forEach((a) => set(a.id, "R"));

      const chefsIn = chefList.filter((c) => !resting.has(c.id)).sort((x, y) => morn[x.id] - morn[y.id]);
      const othersIn = agentList.filter((a) => !resting.has(a.id));
      const n = chefsIn.length + othersIn.length;
      const mSize = di % 2 === 0 ? Math.ceil(n / 2) : Math.floor(n / 2);
      let mLeft = mSize, amLeft = n - mSize;
      const toM = (id) => { set(id, "M"); morn[id] += 1; mLeft -= 1; };
      const toAM = (id) => { set(id, "AM"); amLeft -= 1; };

      if (chefsIn.length === 2) {
        const [c0, c1] = chefsIn;
        const p0 = prefAt(c0, d), p1 = prefAt(c1, d);
        let s0 = p0 || (p1 ? other(p1) : (di % 2 === 0 ? "M" : "AM"));
        if (s0 === "M" && mLeft <= 0) s0 = "AM";
        if (s0 === "AM" && amLeft <= 0) s0 = "M";
        if (s0 === "M") { toM(c0.id); toAM(c1.id); } else { toAM(c0.id); toM(c1.id); }
      } else if (chefsIn.length === 1) {
        const c = chefsIn[0];
        let s = prefAt(c, d) || (di % 2 === 0 ? "M" : "AM");
        if (s === "M" && mLeft <= 0) s = "AM";
        if (s === "AM" && amLeft <= 0) s = "M";
        if (s === "M") toM(c.id); else toAM(c.id);
      }

      const ord = (arr) => shuffle(arr).sort((x, y) => morn[x.id] - morn[y.id]);
      const leftover = [];
      ord(othersIn.filter((a) => prefAt(a, d) === "M")).forEach((a) => { if (mLeft > 0) toM(a.id); else leftover.push(a); });
      ord(othersIn.filter((a) => prefAt(a, d) === "AM")).forEach((a) => { if (amLeft > 0) toAM(a.id); else leftover.push(a); });
      ord(othersIn.filter((a) => prefAt(a, d) == null).concat(leftover)).forEach((a) => { if (mLeft > 0) toM(a.id); else toAM(a.id); });

      // marquage veille / lendemain de repos
      [...chefList, ...agentList].forEach((a) => {
        const c = next[a.id][dk];
        if (!c) return;
        const p = prefAt(a, d);
        if (p === "M" && c.type === "M") c.tag = "VR";
        else if (p === "AM" && c.type === "AM") c.tag = "LR";
      });
    });

    // PHASE 2 : coupés ~2-3 / mois pour handiplagistes ET chefs, sur des jours neutres
    [...agentList, ...chefList].forEach((a) => {
      const neutral = mDates.filter((d) => {
        const c = next[a.id][keyOf(d)];
        return c && (c.type === "M" || c.type === "AM") && prefAt(a, d) == null;
      });
      const target = Math.min(neutral.length, Math.max(0, Math.round((2 + Math.random()) * mDates.length / 28)));
      shuffle(neutral).slice(0, target).forEach((d) => { next[a.id][keyOf(d)].type = "CP"; });
    });

    // PHASE 3 : jamais 3 sur une plage -> un présent passe en coupé (heures sup), réparties
    const OTH = SHIFTS.CP.hours - SHIFTS.M.hours;
    const coversH = (id, dk, h) => { const c = next[id][dk]; return c.type === h || c.type === "CP"; };
    const otBy = {};
    team.forEach((a) => { otBy[a.id] = 0; });
    // un chef "pèse" 2, un handiplagiste 3 : les chefs en prennent ~1,5x plus, mais pas tout
    const wkey = (id) => otBy[id] * (byId[id].role === "chef" ? 2 : 3) - (byId[id].role === "chef" ? 0.001 : 0);
    mDates.forEach((d) => {
      const dk = keyOf(d);
      ["M", "AM"].forEach((short) => {
        let guard = 0;
        const count = () => team.filter((a) => coversH(a.id, dk, short)).length;
        while (count() < minHalf && guard++ < 30) {
          const oth = other(short);
          let pool = team.filter((a) => next[a.id][dk].type === oth && !next[a.id][dk].tag);
          if (!pool.length) pool = team.filter((a) => next[a.id][dk].type === oth);
          pool = shuffle(pool).sort((x, y) => wkey(x.id) - wkey(y.id));
          const pick = pool[0];
          if (!pick) break;
          next[pick.id][dk] = { ...next[pick.id][dk], type: "CP", tag: null, comp: true, compHalf: short, ot: (next[pick.id][dk].ot || 0) + OTH };
          otBy[pick.id] += OTH;
        }
      });
    });

    return next;
  }

  function generate() {
    setAssignments((prev) => ({ ...prev, ...buildPlanning(agents, dates) }));
    setTab("planning");
  }
  function generateAll() {
    setAssignments((prev) => {
      const merged = { ...prev };
      months.forEach((mk) => Object.assign(merged, buildPlanning(monthTeams[mk] || [], monthDates(mk, seasonOpen, seasonClose))));
      return merged;
    });
    setTab("planning");
  }

  /* ----- agents ----- */
  const addAgent = () =>
    setAgents((a) => [...a, { id: uid(), name: "Nouvel agent", role: "agent", restDay: 2 }]);
  const removeAgent = (id) => {
    setAgents((a) => a.filter((x) => x.id !== id));
    setAssignments((p) => { const c = { ...p }; delete c[id]; return c; });
  };
  const updateAgent = (id, patch) =>
    setAgents((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const setCell = (agentId, dateKey, patch) =>
  setAssignments((p) => {
    const normalizedPatch = {
      ...patch,
      type: patch?.type === "JC" ? "CP" : patch?.type,
    };

    return {
      ...p,
      [agentId]: {
        ...(p[agentId] || {}),
        [dateKey]: {
          type: "R",
          ot: 0,
          ...(p[agentId]?.[dateKey] || {}),
          ...normalizedPatch,
        },
      },
    };
  });



  /* ----- import / export ----- */
  function exportJSON() {
    const blob = new Blob(
      [JSON.stringify({ seasonOpen, seasonClose, monthTeams, minEffectif, minHalf, events, assignments, accounts, requests, happenings }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "planning-saison.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (d.seasonOpen) setSeasonOpen(d.seasonOpen);
        if (d.seasonClose) setSeasonClose(d.seasonClose);
        if (d.monthTeams) setMonthTeams(d.monthTeams);
        if (d.minEffectif) setMinEffectif(d.minEffectif);
        if (d.minHalf) setMinHalf(d.minHalf);
        if (d.events) setEvents(d.events);
if (d.assignments) setAssignments(cleanAssignments(d.assignments));
        if (d.accounts) setAccounts(d.accounts);
        if (d.requests) setRequests(d.requests);
        if (d.happenings) setHappenings(d.happenings);
      } catch { alert("Fichier illisible."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  /* ----- compteurs d'heures ----- */
  const totals = useMemo(() => {
    return agents.map((a) => {
      let base = 0, ot = 0, worked = 0;
      dates.forEach((d) => {
        const c = assignments[a.id]?.[keyOf(d)];
        if (!c) return;
const type = normalizeType(c.type);
const s = ALL[type];

if (s && SHIFTS[type]) {
  base += c.comp ? SHIFTS.M.hours : s.hours;
  worked += 1;
}

        ot += Number(c.ot) || 0;
      });
      return { agent: a, base, ot, worked, total: base + ot };
    });
  }, [agents, dates, assignments]);
  const maxOT = Math.max(1, ...totals.map((t) => t.ot));

  const hasPlan = agents.some((a) => assignments[a.id] && Object.keys(assignments[a.id]).length);

  const isAdmin = session?.role === "admin";
  const monthLabel = currentMonth ? capMonth(Number(currentMonth.split("-")[1]) - 1) : "";
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  /* ----- comptes ----- */
  const addAccount = () => setAccounts((a) => [...a, { id: "", password: "", role: "user", name: "" }]);
  const updateAccount = (i, patch) => setAccounts((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeAccount = (i) =>
    setAccounts((a) => {
      const target = a[i];
      if (target.role === "admin" && a.filter((x) => x.role === "admin").length <= 1) { alert("Il faut au moins un compte administrateur."); return a; }
      return a.filter((_, j) => j !== i);
    });
  const createTeamAccounts = () => {
    const names = [...new Set(Object.values(monthTeams).flat().map((a) => a.name))];
    setAccounts((acc) => {
      const have = new Set(acc.filter((x) => x.role === "user").map((x) => x.name));
      const taken = new Set(acc.map((x) => x.id));
      const add = [];
      names.forEach((name) => {
        if (have.has(name)) return;
        const base = (name.split(" ")[0] || "agent").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") || "agent";
        let login = base, k = 1;
        while (taken.has(login)) login = base + ++k;
        taken.add(login);
        add.push({ id: login, password: Math.random().toString(36).slice(2, 7), role: "user", name });
      });
      return add.length ? [...acc, ...add] : acc;
    });
  };

  /* ----- demandes de changement ----- */
  const resolveAgent = (mk, name) => (monthTeams[mk] || []).find((a) => a.name === name);
  const submitRequest = (req) => setRequests((r) => [{ id: uid(), status: "pending", createdAt: Date.now(), ...req }, ...r]);
  const applyRequest = (req) => {
    if (req.type === "leave") {
      const a = resolveAgent(req.monthKey, req.fromName);
      if (a) setAssignments((p) => ({ ...p, [a.id]: { ...(p[a.id] || {}), [req.dateKey]: { type: "IN", ot: 0 } } }));
    } else if (req.type === "swap") {
      const a = resolveAgent(req.monthKey, req.fromName), b = resolveAgent(req.monthKey, req.targetName);
      if (a && b) setAssignments((p) => {
        const ca = p[a.id]?.[req.dateKey], cb = p[b.id]?.[req.dateKey];
        if (!ca || !cb) return p;
        return { ...p, [a.id]: { ...p[a.id], [req.dateKey]: { ...ca, type: cb.type, tag: null } }, [b.id]: { ...p[b.id], [req.dateKey]: { ...cb, type: ca.type, tag: null } } };
      });
    }
  };
  const decideRequest = (req, approve, adminReply = "") => {
    if (approve) applyRequest(req);
    setRequests((list) => list.map((r) => (r.id === req.id ? { ...r, status: approve ? "approved" : "rejected", adminReply: adminReply.trim() } : r)));
  };

  /* ---------------------------------------------------------------- */
  
  if (!session) {
    return <PortalScreen accounts={accounts} onLogin={setSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <style>{`
  /* -------------------------------------------------- */
  /* Export compact type Excel                          */
  /* -------------------------------------------------- */

  .compact-export {
    width: 100%;
    color: #000;
    font-family: Arial, sans-serif;
  }

  .compact-title {
    border: 2px solid #000;
    background: #b8b8b8;
    text-align: center;
    font-weight: 800;
    font-size: 13px;
    padding: 3px;
    margin-bottom: 10px;
    letter-spacing: 0.5px;
  }

  .compact-week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0;
    margin-bottom: 12px;
    border-left: 2px solid #000;
    border-top: 2px solid #000;
  }

  .compact-day {
    min-width: 0;
    border-right: 2px solid #000;
    border-bottom: 2px solid #000;
    overflow: hidden;
  }

  .compact-day-title {
    height: 14px;
    background: #fff200;
    border-bottom: 2px solid #000;
    text-align: center;
    font-weight: 800;
    font-size: 6px;
    line-height: 14px;
    white-space: nowrap;
  }

  .compact-agent-row {
    display: grid;
    grid-template-columns: 14px repeat(var(--agent-count), minmax(7px, 1fr)) 12px;
    height: 72px;
    border-bottom: 1px solid #000;
  }

  .compact-hour-head {
    border-right: 1px solid #000;
    background: #f3f4f6;
  }

  .compact-agent-name {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: left;
    font-size: 5px;
    font-weight: 700;
    line-height: 1;
    overflow: hidden;
    white-space: nowrap;
    border-right: 1px solid #000;
    padding: 2px 0;
  }

  .compact-total-head {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: center;
    font-size: 5px;
    font-weight: 700;
  }

  .compact-hour-row {
    display: grid;
    grid-template-columns: 14px repeat(var(--agent-count), minmax(7px, 1fr)) 12px;
    height: 9px;
  }

  .compact-hour-label {
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    text-align: center;
    font-size: 5px;
    line-height: 9px;
    background: #f9fafb;
  }

  .compact-cell {
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    text-align: center;
    font-size: 5px;
    line-height: 9px;
    font-weight: 700;
    min-width: 0;
  }

  .compact-total-cell {
    border-bottom: 1px solid #000;
    text-align: center;
    font-size: 5px;
    line-height: 9px;
    font-weight: 700;
    background: #eef2ff;
  }

  .compact-ot {
    box-shadow: inset 0 0 0 1px #dc2626;
  }

  .compact-event {
    height: 11px;
    background: #ff0000;
    color: #000;
    text-align: center;
    font-size: 5px;
    font-weight: 800;
    line-height: 11px;
    border-top: 1px solid #000;
    text-transform: uppercase;
  }
    .compact-legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3px 8px;
  margin-top: 8px;
  padding: 5px;
  border: 1px solid #000;
  font-size: 6px;
  line-height: 1.2;
  background: #fff;
}

.compact-legend-title {
  grid-column: 1 / -1;
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
  margin-bottom: 2px;
}

.compact-legend-item {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.compact-legend-color {
  display: inline-flex;
  width: 18px;
  height: 10px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid #000;
  font-size: 5px;
  font-weight: 800;
  line-height: 1;
}

.compact-legend-hs {
  background: #fff;
  color: #dc2626;
  box-shadow: inset 0 0 0 1px #dc2626;
}


  /* -------------------------------------------------- */
  /* Impression PDF                                     */
  /* -------------------------------------------------- */

  @media print {
    .no-print {
      display: none !important;
    }

    @page {
      size: A4 landscape;
      margin: 4mm;
    }

    body,
    html {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    main {
      padding: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
    }

    .print-full {
      overflow: visible !important;
      width: 100% !important;
    }

    .export-wrapper > div {
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .export-sheet {
      font-size: 8px !important;
      width: 100% !important;
      border-collapse: collapse !important;
    }

    .export-sheet tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .export-sheet td,
    .export-sheet th {
      padding: 2px !important;
      border: 1px solid #e2e8f0 !important;
    }

    .compact-export {
      break-before: page;
      page-break-before: always;
    }

    .compact-week {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .compact-day {
      break-inside: avoid;
      page-break-inside: avoid;
    }
      .compact-legend {
  break-inside: avoid;
  page-break-inside: avoid;
}

  }
`}</style>


      {/* Header */}
      <header className="no-print sticky top-0 z-20" style={{ background: "#163F87" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:px-4">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }}>
            <CalendarDays size={18} color="#fff" />
          </div>
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-sm font-semibold leading-none tracking-tight text-white">Planning Équipe</h1>
            <p className="mt-0.5 hidden text-xs sm:block" style={{ color: "rgba(255,255,255,0.6)" }}>Couverture horaire &amp; suivi des heures</p>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => fileRef.current?.click()} title="Importer" className="flex flex-none items-center gap-1.5 rounded-md p-1.5 text-xs font-medium text-white/80 hover:bg-white/10 sm:px-2.5" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
                <Upload size={14} /> <span className="hidden sm:inline">Importer</span>
              </button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} className="hidden" />
              <button onClick={exportJSON} title="Sauvegarder" className="flex flex-none items-center gap-1.5 rounded-md p-1.5 text-xs font-medium text-white/80 hover:bg-white/10 sm:px-2.5" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
                <Download size={14} /> <span className="hidden sm:inline">Sauvegarder</span>
              </button>
              <button onClick={() => window.print()} title="Imprimer" className="flex flex-none items-center gap-1.5 rounded-md p-1.5 text-xs font-medium text-white/80 hover:bg-white/10 sm:px-2.5" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
                <Printer size={14} /> <span className="hidden sm:inline">Imprimer</span>
              </button>
            </>
          )}
          <button
            onClick={() => setProfileOpen(true)}
            title="Mon profil"
            className="flex flex-none items-center gap-1.5 rounded-full p-0.5 transition-opacity hover:opacity-90"
            style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)" }}
          >
            {myProfile.photoUrl ? (
              <img src={myProfile.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: avatarColor(session.name) }}>
                {initials(session.name)}
              </span>
            )}
          </button>
          <button onClick={() => { setSession(null); }} title="Se déconnecter" className="flex flex-none items-center gap-1.5 rounded-md p-1.5 text-xs font-medium text-white/80 hover:bg-white/10 sm:px-2.5" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
            <LogOut size={14} /> <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>

        {/* Tabs (admin) */}
        {isAdmin && (
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 sm:px-4">
          {[
            ["equipe", "Équipe", Users],
            ["planning", "Planning", LayoutGrid],
            ["permut", "Permuter", ArrowLeftRight],
            ["couverture", "Couverture", CalendarDays],
            ["heures", "Heures", BarChart3],
            ["export", "Export", FileText],
            ["evenements", "Événements", Flag],
            ["comptes", "Comptes", KeyRound],
            ["demandes", "Demandes", Inbox],
          ].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative flex flex-none items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === id ? "border-white text-white" : "border-transparent text-white/60 hover:text-white/90"}`}>
              <Icon size={15} /> {label}
              {id === "demandes" && pendingCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-bold text-white" style={{ background: "#DC2626", fontSize: "10px" }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        )}

        {/* Sélecteur de mois */}
        {months.length > 0 && (
          <div style={{ background: "rgba(0,0,0,0.15)" }}>
            <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4">
              <span className="flex-none text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Saison {fmtFr(seasonOpen)} → {fmtFr(seasonClose)}</span>
              <span className="flex-none" style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
              {months.map((mk) => {
                const mo = Number(mk.split("-")[1]) - 1;
                const active = mk === currentMonth;
                const nb = monthDates(mk, seasonOpen, seasonClose).length;
                return (
                  <button key={mk} onClick={() => { setCurrentMonth(mk); setCovDay(0); }}
                    className={`flex-none rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "text-brand font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                    style={active ? { background: "#ffffff" } : { border: "1px solid rgba(255,255,255,0.2)" }}>
                    {capMonth(mo)} <span className={active ? "text-brand/60" : ""}>· {nb}j</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
        {!isAdmin ? (
          <UserApp {...{ session, agents, dates, assignments, currentMonth, monthLabel, requests, submitRequest, happenings }} />
        ) : (
          <>
            {tab === "equipe" && (
              <EquipeTab {...{ agents, addAgent, removeAgent, updateAgent, minHalf, setMinHalf, generate, generateAll, hasPlan, seasonOpen, setSeasonOpen, seasonClose, setSeasonClose, currentMonth, months, copyPrevMonth, dates }} />
            )}
            {tab === "planning" && (
              <PlanningTab {...{ agents, dates, assignments, setEditing, generate, hasPlan, minHalf, events, setEvents }} />
            )}
            {tab === "permut" && (
              <SwapTab {...{ agents, dates, assignments, setAssignments, hasPlan }} />
            )}
            {tab === "couverture" && (
              <CouvertureTab {...{ agents, dates, assignments, covDay, setCovDay, minEffectif, setMinEffectif, hasPlan }} />
            )}
            {tab === "heures" && <HeuresTab {...{ totals, maxOT, hasPlan, agents, dates, assignments, setAssignments }} />}
            {tab === "export" && <ExportTab {...{ agents, dates, assignments, minHalf, totals, hasPlan, events }} />}
            {tab === "evenements" && <EvenementsTab {...{ happenings, addHappening, updateHappening, removeHappening }} />}
            {tab === "comptes" && <ComptesTab {...{ accounts, addAccount, updateAccount, removeAccount, createTeamAccounts }} />}
            {tab === "demandes" && <DemandesTab {...{ requests, decideRequest }} />}
          </>
        )}
      </main>

      {/* Éditeur de case */}
      {editing && (
        <CellEditor
          agent={agents.find((a) => a.id === editing.agentId)}
          date={parseDate(editing.dateKey)}
          value={assignments[editing.agentId]?.[editing.dateKey] || { type: "R", ot: 0 }}
          onChange={(patch) => setCell(editing.agentId, editing.dateKey, patch)}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Panneau profil */}
      {profileOpen && (
        <ProfileDrawer
          session={session}
          profile={myProfile}
          updateProfile={updateProfile}
          changePassword={changePassword}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Équipe                                                      */
/* ------------------------------------------------------------------ */
function EquipeTab({ agents, addAgent, removeAgent, updateAgent, minHalf, setMinHalf, generate, generateAll, hasPlan, seasonOpen, setSeasonOpen, seasonClose, setSeasonClose, currentMonth, months, copyPrevMonth, dates }) {
  const chiefs = agents.filter((a) => a.role === "chef").length;
  const adms = agents.filter((a) => a.role === "adm").length;
  const monthIdx = months.indexOf(currentMonth);
  const monthLabel = currentMonth ? capMonth(Number(currentMonth.split("-")[1]) - 1) : "";
  const range = dates.length ? `${dates[0].getDate()} → ${dates[dates.length - 1].getDate()} ${monthLabel.toLowerCase()} · ${dates.length} jours` : "";
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Réglages */}
      <section className="space-y-4 lg:col-span-1">
        <Card title="Saison">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500">Ouverture</label>
              <input type="date" value={seasonOpen} onChange={(e) => setSeasonOpen(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500">Fermeture</label>
              <input type="date" value={seasonClose} onChange={(e) => setSeasonClose(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Un onglet de mois est créé automatiquement pour chaque mois de la saison. Sélectionnez le mois en haut de l'écran.</p>
          <label className="mt-3 block text-xs font-medium text-slate-500">Minimum par demi-journée</label>
          <input type="number" min={0} value={minHalf} onChange={(e) => setMinHalf(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
        </Card>

        <Card title="Générer le planning">
          <p className="text-xs leading-relaxed text-slate-500">
            Chaque mois a sa propre équipe et son propre planning, généré sur ses jours d'ouverture
            ({range || "—"}). Comptes matin / après-midi équilibrés (≥ {minHalf} de chaque côté), repos
            des handiplagistes tous les 6 jours, 2-3 coupés par mois pour tous (handiplagistes comme
            chefs), coupure « 48 h » repérée
            <span className="font-semibold" style={{ color: "#7C3AED" }}> v</span> /
            <span className="font-semibold" style={{ color: "#0891B2" }}> l</span>. Deux chefs ne peuvent
            pas être seuls sur la même demi-journée (mais l'un en coupé et l'autre en demi-journée, ou les
            deux en coupé, c'est permis). Compensation en coupé si une plage tomberait à 3 (heures sup
            réparties, chefs un peu plus).
          </p>
          {chiefs !== 2 && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
              {chiefs} chef{chiefs > 1 ? "s" : ""} d'équipe — il en faut 2.
            </p>
          )}
          <button onClick={generate}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
            style={{ background: "#163F87" }}>
            <Wand2 size={16} /> {hasPlan ? "Régénérer" : "Générer"} {monthLabel}
          </button>
          <button onClick={generateAll}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Wand2 size={15} /> Générer toute la saison
          </button>
        </Card>

        <Legend />
      </section>

      {/* Agents */}
      <section className="lg:col-span-2">
        <Card title={`Équipe de ${monthLabel}`} subtitle={`${range} · ${chiefs} chef(s), ${adms} adm., ${agents.length - chiefs - adms} handiplagiste(s)`} action={
          <div className="flex gap-1.5">
            {monthIdx > 0 && (
              <button onClick={copyPrevMonth} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Copier mois précédent
              </button>
            )}
            <button onClick={addAgent} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        }>
          <div className="space-y-1.5">
            {agents.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                <input value={a.name} onChange={(e) => updateAgent(a.id, { name: e.target.value })}
                  className="w-full min-w-0 bg-transparent text-sm font-medium outline-none sm:flex-1" />
                <div className="flex flex-1 items-center gap-2 sm:flex-none">
                  <select value={a.role} onChange={(e) => updateAgent(a.id, { role: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs sm:flex-none">
                    <option value="agent">Handiplagiste</option>
                    <option value="chef">Chef d'équipe</option>
                    <option value="adm">Administratif</option>
                  </select>
                  {a.role === "chef" && (
                    <select value={a.restDay} onChange={(e) => updateAgent(a.id, { restDay: Number(e.target.value) })}
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs sm:flex-none">
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <option key={d} value={d}>Repos {WD_FULL[d].toLowerCase()}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => removeAgent(a.id)} className="ml-auto rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 sm:ml-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Planning (vue semaine)                                      */
/* ------------------------------------------------------------------ */
function PlanningTab({ agents, dates, assignments, setEditing, generate, hasPlan, minHalf, events, setEvents }) {
  if (!hasPlan) return <Empty onAction={generate} />;
  const counts = dates.map((d) => {
    let m = 0, am = 0;
    agents.forEach((a) => {
      const c = assignments[a.id]?.[keyOf(d)];
      if (!c) return;
      if (c.type === "M" || c.type === "CP") m += 1;
      if (c.type === "AM" || c.type === "CP") am += 1;
    });
    return { m, am };
  });
  const cell = (v) => (v < minHalf ? { background: "#FCA5A5", color: "#7F1D1D" } : { background: "#DCFCE7", color: "#14532D" });
  const breaches = dates.filter((d, i) => counts[i].m < minHalf || counts[i].am < minHalf)
    .map((d) => `${WD_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
  return (
    <Card title="Planning de l'équipe" subtitle="Cliquez une case pour modifier l'horaire ou ajouter des heures sup.">
      {breaches.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-semibold">Effectif insuffisant</span>
          <span>— moins de {minHalf} personnes sur une demi-journée : {breaches.join(", ")}. Ajoutez des handiplagistes ou réduisez les repos ce jour-là.</span>
        </div>
      )}
      <div className="print-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500">Agent</th>
              {dates.map((d) => (
                <th key={keyOf(d)} className="border-b border-slate-200 px-1 py-2 text-center text-xs font-medium text-slate-500">
                  <div>{WD_SHORT[d.getDay()]}</div>
                  <div className="text-slate-400">{String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-1 text-xs font-medium text-slate-400">Événement</td>
              {dates.map((d) => (
                <td key={keyOf(d)} className="border-b border-l border-slate-100 p-0.5">
                  <input value={events[keyOf(d)] || ""} onChange={(e) => setEvents((ev) => ({ ...ev, [keyOf(d)]: e.target.value }))}
                    placeholder="—"
                    className="w-full rounded bg-amber-50 px-1 py-1 text-center text-xs text-amber-800 outline-none placeholder:text-amber-300"
                    style={{ minWidth: "3rem" }} />
                </td>
              ))}
            </tr>
            {agents.map((a) => (
              <tr key={a.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-white px-3 py-1.5 text-xs font-medium">
                  <span className="flex items-center gap-1"><RoleMark role={a.role} /> {a.name}</span>
                </td>
                {dates.map((d) => {
                  const c = assignments[a.id]?.[keyOf(d)] || { type: "R", ot: 0 };
const s = ALL[normalizeType(c.type)];
                  return (
                    <td key={keyOf(d)} className="border-b border-l border-slate-100 p-0.5">
                      <button onClick={() => setEditing({ agentId: a.id, dateKey: keyOf(d) })}
                        className="relative flex h-9 w-full items-center justify-center rounded text-xs font-semibold transition-transform hover:scale-105"
                        style={{ background: s?.bg, color: s?.fg, minWidth: "3rem" }}
                        title={`${s?.label}${c.tag === "VR" ? " · veille de repos" : c.tag === "LR" ? " · lendemain de repos" : ""}${c.comp ? " · coupé de compensation" : ""}${c.ot ? ` · +${formatH(c.ot)} sup` : ""}`}>
{normalizeType(c.type)}
                        {c.tag && (
                          <span className="absolute -left-0.5 -top-0.5 font-bold" style={{ fontSize: "8px", color: c.tag === "VR" ? "#7C3AED" : "#0891B2" }}>
                            {c.tag === "VR" ? "v" : "l"}
                          </span>
                        )}
                        {c.ot > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 rounded-full px-1 font-bold text-white" style={{ background: "#DC2626", fontSize: "9px" }}>
                            HS
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 border-t border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">Matin</td>
              {counts.map((c, i) => (
                <td key={i} className="border-t border-l border-slate-100 p-0.5">
                  <div className="flex h-6 items-center justify-center rounded text-xs font-bold" style={cell(c.m)}>{c.m}</div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">Après-midi</td>
              {counts.map((c, i) => (
                <td key={i} className="border-l border-slate-100 p-0.5">
                  <div className="flex h-6 items-center justify-center rounded text-xs font-bold" style={cell(c.am)}>{c.am}</div>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <LegendRow />
        <p className="text-xs text-slate-400">Badge <span className="font-semibold text-red-600">HS</span> = heures sup · <span className="font-semibold" style={{ color: "#7C3AED" }}>v</span> veille de repos (matin), <span className="font-semibold" style={{ color: "#0891B2" }}>l</span> lendemain (après-midi). Lignes Matin / Après-midi en rouge sous {minHalf}.</p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Couverture (heatmap d'une journée)                         */
/* ------------------------------------------------------------------ */
function CouvertureTab({ agents, dates, assignments, covDay, setCovDay, minEffectif, setMinEffectif, hasPlan }) {
  if (!hasPlan) return <Empty />;
  const idx = Math.min(covDay, dates.length - 1);
  const day = dates[idx];
  const dk = keyOf(day);

  const present = (a, h) => {
  const c = assignments[a.id]?.[dk];
  const type = normalizeType(c?.type);
  return !!c && !!ALL[type]?.present.includes(h);
};

const shiftAt = (c, h) => {
  const type = normalizeType(c?.type);
  return ALL[type]?.present.includes(h) ? ALL[type] : null;
};
  const colFor = (count) =>
    count < minEffectif ? { bg: "#FCA5A5", fg: "#7F1D1D" }
      : count === minEffectif ? { bg: "#FDE68A", fg: "#78350F" }
        : { bg: "#86EFAC", fg: "#14532D" };

  return (
    <Card
  title={`Couverture — ${WD_FULL[day.getDay()]} ${String(day.getDate()).padStart(2, "0")}/${String(day.getMonth() + 1).padStart(2, "0")}`}
  subtitle="Effectif présent par tranche horaire. Le seuil minimum colore la dernière colonne."
  action={
    <label className="flex items-center gap-2 text-sm font-medium text-slate-500">
      Seuil mini
      <input
        type="number"
        min={0}
        value={minEffectif}
        onChange={(e) => setMinEffectif(Number(e.target.value))}
        className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
      />
    </label>
  }
>


<div className="flex flex-col gap-4 xl:flex-row xl:items-center">
  <div className="min-w-0 flex-1 overflow-x-auto">

    <table className="border-collapse text-sm">
      <thead>
        <tr>
          <th className="sticky left-0 bg-white px-4 py-2 text-left font-semibold text-slate-500">
            Heure
          </th>

          {agents.map((a) => (
            <th
              key={a.id}
              className="px-2 py-2 text-center font-medium text-slate-500"
              title={a.name}
            >
              {a.name.split(" ")[0].slice(0, 8)}
            </th>
          ))}

          <th className="px-4 py-2 text-center font-semibold text-slate-600">
            Effectif
          </th>
        </tr>
      </thead>

      <tbody>
        {HOURS.map((h) => {
          const count = agents.filter((a) => present(a, h)).length;
          const cc = colFor(count);

          return (
            <tr key={h}>
              <td className="sticky left-0 bg-white px-4 py-1.5 font-medium text-slate-600">
                {String(h).padStart(2, "0")}h
              </td>

              {agents.map((a) => {
                const c = assignments[a.id]?.[dk];
                const on = present(a, h);
                const s = on && c ? shiftAt(c, h) : null;
                const isOt =
                  s &&
                  c.comp &&
                  c.compHalf &&
                  ((c.compHalf === "M" && h <= 12) ||
                    (c.compHalf === "AM" && h > 12));

                return (
                  <td key={a.id} className="p-1">
                    <div
                      className="flex h-8 w-12 items-center justify-center rounded-md text-xs font-bold"
                      style={{
                        background: !s ? "#F1F5F9" : isOt ? "#F87171" : s.bg,
                        color: !s ? "#CBD5E1" : isOt ? "#7F1D1D" : s.fg,
                      }}
                      title={
                        !s
                          ? ""
                          : isOt
                            ? "Heures sup (coupé de compensation)"
                            : s.label
                      }
                    >
                      {s ? normalizeType(c.type) : ""}
                    </div>
                  </td>
                );
              })}

              <td className="p-1">
                <div
                  className="flex h-8 min-w-12 items-center justify-center rounded-md px-3 text-sm font-bold"
                  style={{ background: cc.bg, color: cc.fg }}
                >
                  {count}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>

<div className="flex flex-none flex-col items-stretch justify-center gap-3">
    <button
      onClick={() => setCovDay(Math.max(0, idx - 1))}
      disabled={idx === 0}
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ChevronLeft size={26} />
      Jour précédent
    </button>

    <button
      onClick={() => setCovDay(Math.min(dates.length - 1, idx + 1))}
      disabled={idx === dates.length - 1}
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Jour suivant
      <ChevronRight size={26} />
    </button>
  </div>
</div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#F87171" }} /> heures sup (coupé de compensation)</span>
        <span>Colonne Effectif : vert = au-dessus du seuil, jaune = pile au seuil, rouge = sous-effectif.</span>
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Heures                                                      */
/* ------------------------------------------------------------------ */
function HeuresTab({ totals, maxOT, hasPlan, agents, dates, assignments, setAssignments }) {
  const [selId, setSelId] = useState("");
  if (!hasPlan) return <Empty />;
  const grandOT = totals.reduce((s, t) => s + t.ot, 0);

  const other = (h) => (h === "M" ? "AM" : "M");
  const OT_ADD = SHIFTS.CP.hours - SHIFTS.M.hours; // ~4h05 : allongement d'une demi-journée en coupé
  const halfLabel = (h) => (h === "AM" ? "l'après-midi" : "le matin");

  // disponibilité d'ajout d'heures pour une personne un jour donné
  const dispo = (id, d) => {
    const c = assignments[id]?.[keyOf(d)];
    if (!c || c.type === "R") return { state: "rest" };
    if (c.manual && c.comp) return { state: "added", half: c.compHalf };
    if (c.type === "M" || c.type === "AM") {
      if (c.tag) return { state: "locked", reason: c.tag === "VR" ? "veille de repos" : "lendemain de repos" };
      return { state: "free", half: other(c.type) };
    }
    if (c.type === "CP") return { state: "locked", reason: c.comp ? "coupé (compensation)" : "déjà en coupé" };
    if (c.type === "AD") return { state: "locked", reason: "administratif" };
    return { state: "locked", reason: "—" };
  };

  const addHours = (id, d) => {
    const dk = keyOf(d);
    setAssignments((prev) => {
      const c = prev[id][dk];
      return { ...prev, [id]: { ...prev[id], [dk]: { ...c, type: "CP", comp: true, manual: true, compHalf: other(c.type), tag: null, ot: (c.ot || 0) + OT_ADD } } };
    });
  };
  const removeHours = (id, d) => {
    const dk = keyOf(d);
    setAssignments((prev) => {
      const c = prev[id][dk];
      const orig = other(c.compHalf);
      const cleaned = { ...c };
      delete cleaned.comp; delete cleaned.manual; delete cleaned.compHalf;
      return { ...prev, [id]: { ...prev[id], [dk]: { ...cleaned, type: orig, ot: 0 } } };
    });
  };

  const selDays = selId ? dates.filter((d) => { const c = assignments[selId]?.[keyOf(d)]; return c && c.type !== "R"; }) : [];
  const dispoCount = selDays.filter((d) => dispo(selId, d).state === "free").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Agents" value={totals.length} />
        <Stat label="Heures totales" value={formatH(totals.reduce((s, t) => s + t.total, 0))} />
        <Stat label="Heures sup cumulées" value={formatH(grandOT)} accent />
      </div>

      <Card title="Ajouter des heures supplémentaires" subtitle="Choisissez une personne, puis complétez une demi-journée disponible : elle passe en coupé et l'allongement compte en heures sup.">
        <select value={selId} onChange={(e) => setSelId(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm sm:w-72">
          <option value="">— Sélectionner une personne —</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        {selId && (
          <>
            <p className="mt-3 text-xs text-slate-400">{dispoCount} jour(s) disponible(s) ce mois-ci.</p>
            <div className="mt-1.5 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: "20rem" }}>
              {selDays.map((d) => {
                const dk = keyOf(d);
                const c = assignments[selId][dk];
const s = ALL[normalizeType(c.type)];
                const info = dispo(selId, d);
                return (
                  <div key={dk} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                    <span className="w-20 flex-none text-xs font-medium text-slate-500">{WD_SHORT[d.getDay()]} {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}</span>
                    <span className="flex h-5 w-7 flex-none items-center justify-center rounded text-xs font-semibold" style={{ background: s?.bg, color: s?.fg }}>{normalizeType(c.type)}
</span>
                    <div className="ml-auto flex items-center gap-2">
                      {info.state === "free" && (
                        <button onClick={() => addHours(selId, d)}
                          className="flex items-center gap-1 rounded-md border border-emerald-500 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                          <Plus size={12} /> {halfLabel(info.half)} · +{formatH(OT_ADD)}
                        </button>
                      )}
                      {info.state === "added" && (
                        <>
                          <span className="text-xs font-medium text-emerald-700">✓ complété · +{formatH(OT_ADD)}</span>
                          <button onClick={() => removeHours(selId, d)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Retirer"><X size={14} /></button>
                        </>
                      )}
                      {info.state === "locked" && (
                        <span className="flex items-center gap-1 text-xs text-slate-400"><Lock size={11} /> {info.reason}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {selDays.length === 0 && <p className="text-xs text-slate-400">Aucune journée travaillée ce mois-ci.</p>}
            </div>
          </>
        )}
      </Card>

      <Card title="Décompte par agent" subtitle="Heures de base selon les horaires affectés + heures supplémentaires.">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
              <th className="py-2">Agent</th>
              <th className="py-2 text-center">Jours</th>
              <th className="py-2 text-center">Base</th>
              <th className="py-2 text-center">Heures sup</th>
              <th className="py-2 text-center">Total</th>
              <th className="hidden py-2 pl-3 sm:table-cell">Répartition heures sup</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => (
              <tr key={t.agent.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">
                  <span className="flex items-center gap-1"><RoleMark role={t.agent.role} /> {t.agent.name}</span>
                </td>
                <td className="py-2 text-center text-slate-500">{t.worked}</td>
                <td className="py-2 text-center text-slate-500">{formatH(t.base)}</td>
                <td className="py-2 text-center font-semibold" style={{ color: t.ot ? "#DC2626" : "#94A3B8" }}>{formatH(t.ot)}</td>
                <td className="py-2 text-center font-semibold">{formatH(t.total)}</td>
                <td className="hidden py-2 pl-3 sm:table-cell">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full" style={{ width: `${(t.ot / maxOT) * 100}%`, background: "#DC2626" }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

function weeksFromDates(dates) {
  const weeks = [];
  let current = [];

  dates.forEach((d) => {
    if (current.length === 0) {
      current.push(d);
    } else {
      const prev = current[current.length - 1];

      if (d.getDay() === 1 && prev.getDay() !== 0) {
        weeks.push(current);
        current = [d];
      } else {
        current.push(d);
      }
    }
  });

  if (current.length) weeks.push(current);

  return weeks;
}
function CompactExcelExport({ agents, dates, assignments, events }) {
  const weeks = weeksFromDates(dates);

  const isPresentAt = (agentId, dk, h) => {
  const c = assignments[agentId]?.[dk];
  if (!c) return false;
  return ALL[normalizeType(c.type)]?.present?.includes(h);
};


  const cellStyle = (agentId, dk, h) => {
  const c = assignments[agentId]?.[dk];
  const type = normalizeType(c?.type);
  const s = c ? ALL[type] : null;


    if (!c || !s) {
      return { background: "#ffffff" };
    }

    if (s.present?.includes(h)) {
      return {
        background: s.bg,
        color: s.fg,
      };
    }

    if (c.type === "R") {
      return {
        background: "#D1D5DB",
        color: "#374151",
      };
    }

    return { background: "#ffffff" };
  };

  const codeAt = (agentId, dk, h) => {
  const c = assignments[agentId]?.[dk];
  if (!c) return "";

  const type = normalizeType(c.type);
  const s = ALL[type];

  if (!s?.present?.includes(h)) return "";

  return type;
};



  return (
    <div
  className="compact-export mt-6"
  style={{ "--agent-count": agents.length }}
>
      <div className="compact-title">
        PLANNING HANDIPLAGE 2026
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="compact-week">
          {week.map((d) => {
            const dk = keyOf(d);
            const dayLabel = `${WD_FULL[d.getDay()].toUpperCase()} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

            return (
              <div key={dk} className="compact-day">
                <div className="compact-day-title">
                  {dayLabel}
                </div>

                <div className="compact-agent-row">
                  <div className="compact-hour-head" />
                  {agents.map((a) => (
                    <div key={a.id} className="compact-agent-name" title={a.name}>
{a.name.split(" ")[0].slice(0, 8)}
                    </div>
                  ))}
                  <div className="compact-total-head">H</div>
                </div>

                {HOURS.map((h) => {
                  const count = agents.filter((a) => isPresentAt(a.id, dk, h)).length;

                  return (
                    <div key={h} className="compact-hour-row">
                      <div className="compact-hour-label">
                        {h}
                      </div>

                      {agents.map((a) => {
                        const c = assignments[a.id]?.[dk];
const isOT = c?.ot > 0 && ALL[normalizeType(c.type)]?.present?.includes(h);

                        return (
                          <div
                            key={a.id}
                            className={`compact-cell ${isOT ? "compact-ot" : ""}`}
                            style={cellStyle(a.id, dk, h)}
title={`${a.name} — ${c ? ALL[normalizeType(c.type)]?.label : "—"}`}
                          >
                            {codeAt(a.id, dk, h)}
                          </div>
                        );
                      })}

                      <div className="compact-total-cell">
                        {count}
                      </div>
                    </div>
                  );
                })}

                {events[dk] && (
                  <div className="compact-event">
                    {events[dk]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
            <div className="compact-legend">
        <div className="compact-legend-title">Légende</div>

        {Object.values(ALL).map((s) => (
          <div key={s.code} className="compact-legend-item">
            <span
              className="compact-legend-color"
              style={{ background: s.bg, color: s.fg }}
            >
              {s.code}
            </span>
            <span>
              {s.label}{s.time ? ` — ${s.time}` : ""}
            </span>
          </div>
        ))}

        <div className="compact-legend-item">
          <span className="compact-legend-color compact-legend-hs">HS</span>
          <span>Heures supplémentaires / coupé de compensation</span>
        </div>

        <div className="compact-legend-item">
          <span className="compact-legend-color" style={{ background: "#eef2ff" }}>H</span>
          <span>Nombre de personnes présentes par heure</span>
        </div>
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Export (mois complet imprimable)                            */
/* ------------------------------------------------------------------ */
function ExportTab({ agents, dates, assignments, minHalf, totals, hasPlan, events }) {
  if (!hasPlan || !dates.length) return <Empty />;
  const first = dates[0];
  const monthName = MONTHS_FR[first.getMonth()];
  const title = `${monthName[0].toUpperCase()}${monthName.slice(1)} ${first.getFullYear()}`;
  const totalById = Object.fromEntries(totals.map((t) => [t.agent.id, t]));
  const counts = dates.map((d) => {
    let m = 0, am = 0;
    agents.forEach((a) => {
      const c = assignments[a.id]?.[keyOf(d)];
      if (!c) return;
      if (c.type === "M" || c.type === "CP") m += 1;
      if (c.type === "AM" || c.type === "CP") am += 1;
    });
    return { m, am };
  });
  const wkBorder = (d) => (d.getDay() === 1 ? "2px solid #94A3B8" : "1px solid #E2E8F0");
  const totBorder = "2px solid #94A3B8";
  const halfStyle = (v) => (v < minHalf ? { background: "#FCA5A5", color: "#7F1D1D" } : { background: "#DCFCE7", color: "#14532D" });

 return (
    <div className="export-wrapper print-full">
      <Card title={`Planning — ${title}`} subtitle={`${dates.length} jours · ${agents.length} agents`} action={
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800" style={{ background: "#163F87" }}>
            <Printer size={14} /> Exporter en PDF
          </button>
        </div>
      }>
        <p className="no-print mb-3 text-xs text-slate-400">
          Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF » en orientation <b>Paysage</b>. Les couleurs et marges s'ajusteront automatiquement.
        </p>
        <div className="print-full overflow-x-auto">
          <table className="export-sheet border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold text-slate-500">Agent</th>
              {dates.map((d) => (
                <th key={keyOf(d)} className="px-1 py-1 text-center font-medium text-slate-500" style={{ borderLeft: wkBorder(d) }}>
                  <div>{WD_SHORT[d.getDay()]}</div>
                  <div className="text-slate-400">{String(d.getDate()).padStart(2, "0")}</div>
                </th>
              ))}
              <th className="px-2 py-1 text-center font-semibold text-slate-600" style={{ borderLeft: totBorder }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-2 py-0.5 font-medium text-slate-400">Événement</td>
              {dates.map((d) => {
                const ev = events[keyOf(d)];
                return (
                  <td key={keyOf(d)} className="px-0.5 text-center" style={{ borderLeft: wkBorder(d) }}>
                    {ev ? <div className="truncate rounded-sm bg-amber-100 font-medium text-amber-800" title={ev} style={{ fontSize: "7px" }}>{ev}</div> : null}
                  </td>
                );
              })}
              <td style={{ borderLeft: totBorder }} />
            </tr>
            {agents.map((a) => (
              <tr key={a.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-0.5 font-medium">
                  <span className="flex items-center gap-1"><RoleMark role={a.role} /> {a.name}</span>
                </td>
                {dates.map((d) => {
                  const c = assignments[a.id]?.[keyOf(d)] || { type: "R" };
const s = ALL[normalizeType(c.type)];
                  return (
                    <td key={keyOf(d)} className="p-px text-center" style={{ borderLeft: wkBorder(d) }}>
                      <div className="relative flex h-5 items-center justify-center rounded-sm font-semibold"
                        style={{ background: s?.bg, color: s?.fg }}
                        title={`${s?.label}${c.tag === "VR" ? " · veille de repos" : c.tag === "LR" ? " · lendemain de repos" : ""}${c.comp ? " · coupé de compensation" : ""}`}>
{normalizeType(c.type)}
                        {c.tag && <span className="absolute left-0 top-0 font-bold" style={{ fontSize: "6px", color: c.tag === "VR" ? "#7C3AED" : "#0891B2" }}>{c.tag === "VR" ? "v" : "l"}</span>}
                        {c.ot > 0 && <span className="absolute right-0 top-0 font-bold" style={{ color: "#DC2626", fontSize: "7px" }}>•</span>}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 text-center font-semibold" style={{ borderLeft: totBorder }}>{formatH(totalById[a.id]?.total || 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-2 py-0.5 font-semibold text-slate-500">Matin</td>
              {counts.map((c, i) => (
                <td key={i} className="p-px" style={{ borderLeft: wkBorder(dates[i]) }}>
                  <div className="flex h-5 items-center justify-center rounded-sm font-bold" style={halfStyle(c.m)}>{c.m}</div>
                </td>
              ))}
              <td style={{ borderLeft: totBorder }} />
            </tr>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-2 py-0.5 font-semibold text-slate-500">Après-midi</td>
              {counts.map((c, i) => (
                <td key={i} className="p-px" style={{ borderLeft: wkBorder(dates[i]) }}>
                  <div className="flex h-5 items-center justify-center rounded-sm font-bold" style={halfStyle(c.am)}>{c.am}</div>
                </td>
              ))}
              <td style={{ borderLeft: totBorder }} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3"><LegendRow /></div>
      <p className="mt-2 text-xs text-slate-400">Point rouge = heures sup. <span className="font-semibold" style={{ color: "#7C3AED" }}>v</span> = veille de repos, <span className="font-semibold" style={{ color: "#0891B2" }}>l</span> = lendemain. Colonne Total = heures cumulées par agent. Trait épais = début de semaine.</p>
    <CompactExcelExport
  agents={agents}
  dates={dates}
  assignments={assignments}
  events={events}
/>

    </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Permuter (échange matin / après-midi entre deux personnes)  */
/* ------------------------------------------------------------------ */
function SwapTab({ agents, dates, assignments, setAssignments, hasPlan }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [sel, setSel] = useState(null); // { id, half, role }
  if (!hasPlan) return <Empty />;

  const idx = Math.min(dayIdx, dates.length - 1);
  const d = dates[idx];
  const dk = keyOf(d);
  const roleOf = (id) => agents.find((a) => a.id === id)?.role;

  // disponibilité d'une permutation : doit travailler une demi-journée, sans repos la veille ni le lendemain
  const info = (id) => {
    const c = assignments[id]?.[dk];
    if (!c || (c.type !== "M" && c.type !== "AM")) return { half: null, ok: false, reason: null };
    if (assignments[id]?.[keyOf(addDays(d, -1))]?.type === "R") return { half: c.type, ok: false, reason: "lendemain de repos" };
    if (assignments[id]?.[keyOf(addDays(d, 1))]?.type === "R") return { half: c.type, ok: false, reason: "veille de repos" };
    return { half: c.type, ok: true, reason: null };
  };

  const onHalf = (half) => agents.filter((a) => assignments[a.id]?.[dk]?.type === half);
  const dispoM = onHalf("M").filter((a) => info(a.id).ok).length;
  const dispoAM = onHalf("AM").filter((a) => info(a.id).ok).length;

  const doSwap = (aId, bId) => {
    setAssignments((prev) => {
      const A = prev[aId][dk], B = prev[bId][dk];
      return {
        ...prev,
        [aId]: { ...prev[aId], [dk]: { ...A, type: B.type, tag: null } },
        [bId]: { ...prev[bId], [dk]: { ...B, type: A.type, tag: null } },
      };
    });
    setSel(null);
  };

  const clickChip = (a, half) => {
    const me = info(a.id);
    if (!me.ok) return;
    if (!sel) { setSel({ id: a.id, half, role: a.role }); return; }
    if (sel.id === a.id) { setSel(null); return; }
    const compatible = half !== sel.half && a.role === sel.role;
    if (compatible) doSwap(sel.id, a.id);
  };

  const Column = ({ half, label }) => (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-slate-400">{half === "M" ? dispoM : dispoAM} dispo.</span>
      </div>
      <div className="space-y-1.5">
        {onHalf(half).map((a) => {
          const me = info(a.id);
          const isSel = sel?.id === a.id;
          const candidate = sel && !isSel && half !== sel.half && a.role === sel.role && me.ok;
          const dimmed = sel && !isSel && !candidate;
          let cls = "border-slate-200 hover:bg-slate-50";
          if (!me.ok) cls = "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed";
          else if (isSel) cls = "border-cyan-600 bg-cyan-50 ring-1 ring-cyan-600";
          else if (candidate) cls = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500";
          else if (dimmed) cls = "border-slate-100 opacity-40";
          return (
            <button key={a.id} onClick={() => clickChip(a, half)} disabled={!me.ok}
              className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${cls}`}>
              <RoleMark role={a.role} />
              <span className="flex-1 truncate">{a.name}</span>
              {!me.ok && me.reason && (
                <span className="flex items-center gap-1 text-xs text-slate-400"><Lock size={11} /> {me.reason}</span>
              )}
              {candidate && <ArrowLeftRight size={13} className="text-emerald-600" />}
            </button>
          );
        })}
        {onHalf(half).length === 0 && <p className="text-xs text-slate-400">Personne sur ce créneau.</p>}
      </div>
    </div>
  );

  return (
    <Card
      title={`Permuter — ${WD_FULL[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`}
      subtitle="Échangez le matin et l'après-midi entre deux personnes du même type."
      action={
        <div className="flex gap-1">
          <button onClick={() => { setSel(null); setDayIdx(Math.max(0, idx - 1)); }} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <button onClick={() => { setSel(null); setDayIdx(Math.min(dates.length - 1, idx + 1)); }} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      }>
      <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {sel
          ? <span>Sélection : <span className="font-semibold text-brand">{agents.find((a) => a.id === sel.id)?.name}</span> ({sel.half === "M" ? "matin" : "après-midi"}). Choisissez un partenaire en surbrillance, ou <button onClick={() => setSel(null)} className="font-semibold text-brand underline">annulez</button>.</span>
          : <span>Cliquez une personne disponible pour démarrer une permutation. Les personnes en veille / lendemain de repos sont verrouillées.</span>}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Column half="M" label="Matin" />
        <Column half="AM" label="Après-midi" />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Règles : pas de permutation la veille, le jour ou le lendemain d'un repos (bloc de 48 h) ; un handiplagiste ne permute qu'avec un handiplagiste, un chef qu'avec un chef.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Éditeur de case (modale)                                           */
/* ------------------------------------------------------------------ */
function CellEditor({ agent, date, value, onChange, onClose }) {
  const [ot, setOt] = useState(value.ot || 0);
  if (!agent) return null;
  return (
    <div className="no-print fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.3)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">{agent.name}</h3>
            <p className="text-xs text-slate-400">{WD_FULL[date.getDay()]} {String(date.getDate()).padStart(2, "0")}/{String(date.getMonth() + 1).padStart(2, "0")}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <p className="mb-1.5 text-xs font-medium text-slate-500">Horaire</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(ALL).map((s) => (
            <button key={s.code} onClick={() => onChange({ type: s.code, comp: false, otHalf: null })}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
                value.type === s.code ? "border-cyan-600 ring-1 ring-cyan-600" : "border-slate-200 hover:bg-slate-50"}`}>
              <span className="flex h-5 w-7 flex-none items-center justify-center rounded font-bold" style={{ background: s.bg, color: s.fg, fontSize: "10px" }}>{s.code}</span>
              <span className="min-w-0 leading-tight">
                <span className="block font-medium">{s.label}</span>
                {s.time && <span className="block text-slate-400" style={{ fontSize: "10px" }}>{s.time}</span>}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Clock size={14} /> Heures sup</span>
          <div className="flex items-center gap-2">
            <input type="number" min={0} step={0.5} value={ot}
              onChange={(e) => { const v = Number(e.target.value); setOt(v); onChange({ ot: v }); }}
              className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm" />
            <span className="text-xs text-slate-400">h</span>
          </div>
        </div>

        <button onClick={onClose} className="mt-3 w-full rounded-md py-2 text-sm font-semibold text-white" style={{ background: "#163F87" }}>
          Terminer
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Petits composants                                                  */
/* ------------------------------------------------------------------ */
function Card({ title, subtitle, action, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: accent ? "#DC2626" : "#0F172A" }}>{value}</p>
    </div>
  );
}

function RoleMark({ role }) {
  if (role === "chef") return <Crown size={11} className="flex-none text-amber-500" />;
  if (role === "adm")
    return <span className="flex-none rounded bg-orange-100 px-1 font-semibold text-orange-700" style={{ fontSize: "9px" }}>ADM</span>;
  return null;
}

function Swatch({ s }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-5 w-7 flex-none items-center justify-center rounded font-bold" style={{ background: s.bg, color: s.fg, fontSize: "10px" }}>{s.code}</span>
      <span className="text-xs text-slate-600">{s.label}</span>
    </div>
  );
}
function Legend() {
  return (
    <Card title="Légende">
      <div className="grid grid-cols-2 gap-2">
        {Object.values(ALL).map((s) => <Swatch key={s.code} s={s} />)}
      </div>
    </Card>
  );
}
function LegendRow() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {Object.values(ALL).map((s) => <Swatch key={s.code} s={s} />)}
    </div>
  );
}

function Empty({ onAction }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <CalendarDays size={28} className="mx-auto text-slate-300" />
      <p className="mt-3 text-sm font-medium text-slate-600">Aucun planning pour l'instant</p>
      <p className="mt-1 text-xs text-slate-400">Configurez l'équipe puis lancez la génération.</p>
      {onAction && (
        <button onClick={onAction} className="mx-auto mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "#163F87" }}>
          <Wand2 size={16} /> Générer le planning
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Connexion & rôles                                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Helpers avatar                                                      */
/* ------------------------------------------------------------------ */
function initials(name = "") {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() || "").join("").slice(0, 2);
}
function avatarColor(name = "") {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 55%, 42%)`;
}

/* ------------------------------------------------------------------ */
/*  Panneau Profil                                                      */
/* ------------------------------------------------------------------ */
function ProfileDrawer({ session, profile, updateProfile, changePassword, onClose }) {
  const [email, setEmail] = useState(profile.email || "");
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || "");
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState(null); // { ok: bool, text: str }
  const [saved, setSaved] = useState(false);

  const save = () => {
    updateProfile({ email: email.trim(), photoUrl: photoUrl.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const submitPw = () => {
    if (!newPw || newPw !== confirmPw) { setPwMsg({ ok: false, text: "Les nouveaux mots de passe ne correspondent pas." }); return; }
    if (newPw.length < 4) { setPwMsg({ ok: false, text: "Minimum 4 caractères." }); return; }
    const err = changePassword(curPw, newPw);
    if (err) { setPwMsg({ ok: false, text: err }); return; }
    setPwMsg({ ok: true, text: "Mot de passe mis à jour." });
    setCurPw(""); setNewPw(""); setConfirmPw("");
    setTimeout(() => { setPwMsg(null); setPwOpen(false); }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4" style={{ background: "#163F87" }}>
          <div className="flex-1">
            <p className="text-xs font-medium text-white/60">Mon profil</p>
            <p className="text-sm font-semibold text-white">{session.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover shadow" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow" style={{ background: avatarColor(session.name) }}>
                  {initials(session.name)}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">URL de photo (optionnel)</label>
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Mail size={12} /> Adresse e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.fr"
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="mt-1 text-[10px] text-slate-400">Visible par l'administrateur.</p>
          </div>

          {/* Mode sombre */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {profile.darkMode ? <Moon size={12} /> : <Sun size={12} />} Mode d'affichage
            </label>
            <div className="flex rounded-lg border border-slate-200 p-1 gap-1">
              <button
                onClick={() => updateProfile({ darkMode: false })}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${!profile.darkMode ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <Sun size={15} /> Clair
              </button>
              <button
                onClick={() => updateProfile({ darkMode: true })}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${profile.darkMode ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <Moon size={15} /> Sombre
              </button>
            </div>
          </div>

          {/* Sauvegarder profil */}
          <button
            onClick={save}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold text-white transition-all"
            style={{ background: "#163F87" }}
          >
            {saved ? <><Check size={15} /> Enregistré</> : "Enregistrer le profil"}
          </button>

          {/* Changer le mot de passe */}
          <div className="rounded-xl border border-slate-100 bg-slate-50">
            <button
              onClick={() => setPwOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2"><Lock size={14} /> Changer le mot de passe</span>
              <ChevronRight size={14} className={`text-slate-400 transition-transform ${pwOpen ? "rotate-90" : ""}`} />
            </button>
            {pwOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Mot de passe actuel</label>
                  <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Nouveau mot de passe</label>
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Confirmer</label>
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitPw()} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                {pwMsg && (
                  <p className={`rounded-md px-3 py-2 text-xs font-medium ${pwMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{pwMsg.text}</p>
                )}
                <button onClick={submitPw} className="w-full rounded-md py-2 text-sm font-semibold text-white" style={{ background: "#163F87" }}>
                  Mettre à jour
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalScreen({ accounts, onLogin }) {
  const [flipped, setFlipped] = useState(null); // "admin", "user" ou null
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const handleFlip = (role) => {
    setFlipped(role);
    setId("");
    setPw("");
    setErr("");
  };

  const submit = (role) => {
    const acc = accounts.find(
      (a) => a.id === id.trim() && a.password === pw && a.role === role
    );
    if (acc) onLogin(acc);
    else setErr("Identifiants incorrects.");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {/* Photo de fond */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}handiplage.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Overlay principal */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: "rgba(19, 56, 119, 0.72)" }}
      />

      {/* Contenu */}
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-3 py-4 sm:px-4 sm:py-6 md:py-8">
        <style>{`
          .perspective-1000 { perspective: 1000px; }
          .transform-style-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          .rotate-y-180 { transform: rotateY(180deg); }
          .card-lift {
            transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), filter 0.35s ease;
            will-change: transform;
          }
          .card-lift:hover {
            transform: scale(1.05) translateY(-6px);
            filter: drop-shadow(0 20px 32px rgba(0,0,0,0.28));
          }
        `}</style>

        {/* En-tête compact */}
        <div
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg sm:mb-4 sm:h-14 sm:w-14 sm:rounded-2xl md:h-16 md:w-16"
          style={{
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          <CalendarDays size={24} color="#fff" className="sm:h-8 sm:w-8" />
        </div>

        <h1 className="mb-4 max-w-xs text-center text-xl font-bold tracking-tight text-white drop-shadow sm:mb-6 sm:max-w-none sm:text-2xl md:mb-8 md:text-3xl">
          Bienvenue sur le Planning
        </h1>

        {/* Cartes */}
        <div className="grid w-full max-w-sm gap-3 sm:max-w-xl sm:gap-4 md:max-w-4xl md:grid-cols-2 md:gap-6">
          {/* ADMIN */}
          <div
            className={`perspective-1000 h-[265px] w-full sm:h-[285px] md:h-[360px] ${flipped !== "admin" ? "card-lift" : ""}`}
          >
            <div
              className={`relative h-full w-full transition-transform duration-700 transform-style-3d ${
                flipped === "admin" ? "rotate-y-180" : ""
              }`}
            >
              {/* Recto admin */}
              <button
                onClick={() => handleFlip("admin")}
                className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-transparent bg-white/90 p-4 text-center shadow-md backdrop-blur-sm backface-hidden sm:rounded-2xl sm:p-6 md:p-8"
              >
                <div
                  className="mb-3 flex h-14 w-14 items-center justify-center rounded-full sm:mb-4 sm:h-16 sm:w-16 md:h-20 md:w-20"
                  style={{
                    background: "rgba(22,63,135,0.1)",
                    color: "#163F87",
                  }}
                >
                  <ShieldCheck size={28} className="sm:h-8 sm:w-8 md:h-10 md:w-10" />
                </div>

                <h2 className="text-base font-bold text-slate-700 sm:text-lg md:text-xl">
                  Espace Administrateur
                </h2>

                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 sm:mt-2 sm:text-sm">
                  Gestion du planning, de l'équipe et des paramètres.
                </p>
              </button>

              {/* Verso admin */}
<div className="absolute inset-0 flex h-full w-full flex-col rounded-xl border border-blue-200 bg-white/95 p-4 shadow-xl backdrop-blur-md backface-hidden rotate-y-180 sm:rounded-2xl sm:p-5 md:p-6">
  <button
    onClick={() => setFlipped(null)}
    className="absolute left-3 top-3 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 sm:left-4 sm:top-4"
  >
    <ChevronLeft size={15} /> Retour
  </button>

  <div className="mt-8 flex flex-1 items-center gap-4 sm:mt-9 sm:gap-5 md:flex-col md:justify-center md:gap-3">
    {/* Icône à gauche sur mobile, au-dessus sur desktop */}
    <div
      className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl shadow-sm sm:h-20 sm:w-20 md:h-12 md:w-12"
      style={{ background: "#163F87" }}
    >
      <ShieldCheck size={30} color="#fff" className="sm:h-9 sm:w-9 md:h-6 md:w-6" />
    </div>

    {/* Formulaire à droite sur mobile */}
    <div className="min-w-0 flex-1 md:w-full">
  <h2 className="mb-3 text-right text-lg font-bold text-slate-800 sm:text-xl md:text-center">
    Administrateur
  </h2>


      <div className="flex flex-col gap-2 sm:gap-3">
        <input
          value={flipped === "admin" ? id : ""}
          onChange={(e) => {
            setId(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit("admin")}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Identifiant"
        />

        <input
          type="password"
          value={flipped === "admin" ? pw : ""}
          onChange={(e) => {
            setPw(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit("admin")}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Mot de passe"
        />
      </div>

      {flipped === "admin" && err && (
        <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
          {err}
        </p>
      )}
    </div>
  </div>

  <button
    onClick={() => submit("admin")}
    className="mx-auto mt-4 mb-3 flex w-full max-w-xs items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow md:mt-3 md:mb-4"
    style={{ background: "#163F87" }}
    onMouseOver={(e) => (e.currentTarget.style.background = "#133877")}
    onMouseOut={(e) => (e.currentTarget.style.background = "#163F87")}
  >
    <KeyRound size={15} /> Se connecter
  </button>
</div>

            </div>
          </div>

          {/* HANDIPLAGISTE */}
          <div
            className={`perspective-1000 h-[265px] w-full sm:h-[285px] md:h-[360px] ${flipped !== "user" ? "card-lift" : ""}`}
          >
            <div
              className={`relative h-full w-full transition-transform duration-700 transform-style-3d ${
                flipped === "user" ? "rotate-y-180" : ""
              }`}
            >
              {/* Recto user */}
              <button
                onClick={() => handleFlip("user")}
                className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-transparent bg-white/90 p-4 text-center shadow-md backdrop-blur-sm backface-hidden sm:rounded-2xl sm:p-6 md:p-8"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-50 text-yellow-600 sm:mb-4 sm:h-16 sm:w-16 md:h-20 md:w-20">
                  <Users size={28} className="sm:h-8 sm:w-8 md:h-10 md:w-10" />
                </div>

                <h2 className="text-base font-bold text-slate-700 sm:text-lg md:text-xl">
                  Espace Handiplagiste
                </h2>

                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 sm:mt-2 sm:text-sm">
                  Consultation du planning, échanges et congés.
                </p>
              </button>

              {/* Verso user */}
<div className="absolute inset-0 flex h-full w-full flex-col rounded-xl border border-yellow-200 bg-white/95 p-4 shadow-xl backdrop-blur-md backface-hidden rotate-y-180 sm:rounded-2xl sm:p-5 md:p-6">
  <button
    onClick={() => setFlipped(null)}
    className="absolute left-3 top-3 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 sm:left-4 sm:top-4"
  >
    <ChevronLeft size={15} /> Retour
  </button>

  <div className="mt-8 flex flex-1 items-center gap-4 sm:mt-9 sm:gap-5 md:flex-col md:justify-center md:gap-3">
    {/* Icône à gauche sur mobile, au-dessus sur desktop */}
    <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-yellow-500 shadow-sm sm:h-20 sm:w-20 md:h-12 md:w-12">
      <Users size={30} color="#fff" className="sm:h-9 sm:w-9 md:h-6 md:w-6" />
    </div>

    {/* Formulaire à droite sur mobile */}
    <div className="min-w-0 flex-1 md:w-full">
  <h2 className="mb-3 text-right text-lg font-bold text-slate-800 sm:text-xl md:text-center">
    Handiplagiste
  </h2>


      <div className="flex flex-col gap-2 sm:gap-3">
        <input
          value={flipped === "user" ? id : ""}
          onChange={(e) => {
            setId(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit("user")}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-yellow-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
          placeholder="Identifiant"
        />

        <input
          type="password"
          value={flipped === "user" ? pw : ""}
          onChange={(e) => {
            setPw(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit("user")}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-yellow-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
          placeholder="Mot de passe"
        />
      </div>

      {flipped === "user" && err && (
        <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
          {err}
        </p>
      )}
    </div>
  </div>

  <button
    onClick={() => submit("user")}
    className="mx-auto mt-4 mb-3 flex w-full max-w-xs items-center justify-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm transition-all hover:bg-yellow-500 hover:shadow md:mt-3 md:mb-4"
  >
    <KeyRound size={15} /> Se connecter
  </button>
</div>

            </div>
          </div>
        </div>

        {/* Indication mobile */}
        <p className="mt-3 text-center text-[11px] text-white/60 sm:mt-4 sm:text-xs">
          Sélectionnez votre espace pour vous connecter.
        </p>
      </div>
    </div>
  );
}


function StatusBadge({ status }) {
  const m = { pending: ["En attente", "#B45309", "#FEF3C7"], approved: ["Acceptée", "#15803D", "#DCFCE7"], rejected: ["Refusée", "#B91C1C", "#FEE2E2"] };
  const [label, fg, bg] = m[status] || m.pending;
  return <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: bg, color: fg }}>{label}</span>;
}

function reqLabel(r) {
  const d = parseDate(r.dateKey);
  const ds = `${WD_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  if (r.type === "swap") return { icon: ArrowLeftRight, title: "Échange d'heures", detail: `${ds} · avec ${r.targetName}${r.swapReason ? ` · ${r.swapReason}` : ""}` };
  return { icon: CalendarDays, title: "Congé", detail: `${ds} · ${r.reason}` };
}

function RequestRow({ r, showWho }) {
  const { icon: Icon, title, detail } = reqLabel(r);
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Icon size={14} className="flex-none text-slate-400" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700">{showWho ? `${r.fromName} — ${title}` : title}</p>
          <p className="truncate text-xs text-slate-400">{detail}</p>
        </div>
        <span className="ml-auto flex-none"><StatusBadge status={r.status} /></span>
      </div>
      {r.adminReply && (
        <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-[11px] italic text-slate-500">
          <span className="not-italic font-medium text-slate-400">Admin : </span>{r.adminReply}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Espace utilisateur (personnel)                                     */
/* ------------------------------------------------------------------ */

function UserApp({ session, agents, dates, assignments, currentMonth, monthLabel, requests, submitRequest, happenings }) {
  const me = agents.find((a) => a.name === session.name);
  const [swapDay, setSwapDay] = useState("");
  const [swapTo, setSwapTo] = useState("");
  const [leaveDay, setLeaveDay] = useState("");
  const [reason, setReason] = useState("");
  const [expandedDay, setExpandedDay] = useState(null);
  const myReqs = requests.filter((r) => r.fromName === session.name).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const other = (h) => (h === "M" ? "AM" : "M");
  const dlabel = (k) => { const d = parseDate(k); return `${WD_FULL[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };

  if (!me) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title={`Bonjour ${session.name}`}>
          <p className="text-sm text-slate-500">Vous ne figurez pas dans l'équipe de {monthLabel}. Choisissez un autre mois en haut de l'écran pour voir votre planning.</p>
        </Card>
      </div>
    );
  }

  const myDays = dates.filter((d) => { const c = assignments[me.id]?.[keyOf(d)]; return c && c.type !== "R"; });

  // Regroupement par semaine (lundi → dimanche)
  const weekMap = new Map();
  myDays.forEach((d) => {
    const wk = mondayKey(d);
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk).push(d);
  });
  const weekGroups = [...weekMap.entries()].map(([wk, days], i) => {
    const totalH = days.reduce((s, d) => {
      const c = assignments[me.id]?.[keyOf(d)];
      const sh = ALL[normalizeType(c?.type)];
      return s + (sh?.hours || 0) + (c?.ot || 0);
    }, 0);
    return { weekKey: wk, days, totalH, weekLabel: `Semaine ${i + 1}` };
  });
  const totalHours = weekGroups.reduce((s, g) => s + g.totalH, 0);
  const totalOT = myDays.reduce((s, d) => s + (assignments[me.id]?.[keyOf(d)]?.ot || 0), 0);

  const [swapReason, setSwapReason] = useState("");
  const swapDays = dates.filter((d) => { const c = assignments[me.id]?.[keyOf(d)]; return c && (c.type === "M" || c.type === "AM") && !c.tag; });
  const partnersFor = (k) => {
    const mine = assignments[me.id]?.[k];
    if (!mine) return [];
    return agents.filter((a) => {
      if (a.id === me.id || a.role !== me.role) return false;
      const c = assignments[a.id]?.[k];
      return c && c.type === other(mine.type) && !c.tag;
    });
  };
  const partners = swapDay ? partnersFor(swapDay) : [];

  const submitSwap = () => {
    if (!swapDay || !swapTo) return;
    submitRequest({ type: "swap", fromName: session.name, monthKey: currentMonth, dateKey: swapDay, targetName: swapTo, swapReason: swapReason.trim() });
    setSwapDay(""); setSwapTo(""); setSwapReason("");
  };
  const submitLeave = () => { if (!leaveDay || !reason.trim()) return; submitRequest({ type: "leave", fromName: session.name, monthKey: currentMonth, dateKey: leaveDay, reason: reason.trim() }); setLeaveDay(""); setReason(""); };

  const today = keyOf(new Date());
  const upcomingEvents = [...(happenings || [])]
    .filter((ev) => ev.date >= today && ev.title)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Événements à venir */}
      {upcomingEvents.length > 0 && (
        <div className="rounded-xl border border-brand/20 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-brand/10 px-4 py-3" style={{ background: "#EBF0FA" }}>
            <Flag size={15} style={{ color: "#163F87" }} />
            <span className="text-sm font-semibold" style={{ color: "#163F87" }}>Événements à venir</span>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingEvents.map((ev) => {
              const d = parseDate(ev.date);
              const isToday = ev.date === today;
              return (
                <div key={ev.id} className={`flex gap-4 px-4 py-3 ${isToday ? "bg-amber-50" : ""}`}>
                  {/* Date block */}
                  <div className="flex w-12 flex-none flex-col items-center justify-center rounded-lg py-1.5" style={{ background: isToday ? "#163F87" : "#EBF0FA" }}>
                    <span className="text-[10px] font-semibold uppercase" style={{ color: isToday ? "rgba(255,255,255,0.7)" : "#163F87" }}>{WD_SHORT[d.getDay()]}</span>
                    <span className="text-xl font-bold leading-tight" style={{ color: isToday ? "#fff" : "#163F87" }}>{String(d.getDate()).padStart(2, "0")}</span>
                    <span className="text-[10px]" style={{ color: isToday ? "rgba(255,255,255,0.7)" : "#163F87" }}>{MONTHS_FR[d.getMonth()].slice(0, 3)}</span>
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-800">{ev.title}</span>
                      {ev.time && <span className="text-xs tabular-nums text-slate-400">{ev.time.replace(":", "h")}</span>}
                      {isToday && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "#163F87" }}>Aujourd'hui</span>}
                    </div>
                    {ev.instructions && <p className="mt-1 text-xs leading-relaxed text-slate-500">{ev.instructions}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={`Mon planning — ${monthLabel}`} subtitle={`${session.name} · ${myDays.length} jour(s) travaillé(s)`}>
        {/* Synthèse mensuelle */}
        {myDays.length > 0 && (
          <div className="mb-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3">
            <div className="px-3 text-center">
              <div className="text-lg font-bold text-slate-700">{myDays.length}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">jours</div>
            </div>
            <div className="px-3 text-center">
              <div className="text-lg font-bold text-slate-700">{formatH(totalHours)}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">heures totales</div>
            </div>
            <div className="px-3 text-center">
              <div className={`text-lg font-bold ${totalOT > 0 ? "text-red-500" : "text-slate-300"}`}>{totalOT > 0 ? `+${formatH(totalOT)}` : "—"}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">heures sup</div>
            </div>
          </div>
        )}

        {/* Planning par semaine */}
        <div className="space-y-4">
          {weekGroups.map(({ weekKey, weekLabel, days, totalH }) => (
            <div key={weekKey}>
              <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{weekLabel}</span>
                <span className="text-[11px] font-semibold text-slate-500">{formatH(totalH)}</span>
              </div>
              <div className="space-y-1">
                {days.map((d) => {
                  const k = keyOf(d);
                  const c = assignments[me.id][k];
                  const s = ALL[normalizeType(c.type)];
                  const isOpen = expandedDay === k;
                  const myPresent = s?.present || [];
                  const colleagues = agents
                    .filter((a) => {
                      if (a.id === me.id) return false;
                      const cc = assignments[a.id]?.[k];
                      return cc && !["R", "RC", "IN"].includes(normalizeType(cc.type));
                    })
                    .map((a) => {
                      const cc = assignments[a.id][k];
                      const sh = ALL[normalizeType(cc.type)];
                      const sharedHours = (sh?.present || []).filter((h) => myPresent.includes(h)).length;
                      const overlap = sharedHours >= 2;
                      return { agent: a, shift: sh, overlap };
                    })
                    .sort((a, b) => (a.shift?.code || "").localeCompare(b.shift?.code || ""));
                  const withMe = colleagues.filter((c) => c.overlap);
                  const others = colleagues.filter((c) => !c.overlap);
                  return (
                    <div key={k} className={`overflow-hidden rounded-lg border shadow-sm transition-all ${isOpen ? "border-slate-200" : "border-slate-100"}`}>
                      <button
                        onClick={() => setExpandedDay(isOpen ? null : k)}
                        className="flex w-full items-center gap-3 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        {/* Date */}
                        <div className="w-10 flex-none text-center">
                          <div className="text-[10px] font-medium uppercase text-slate-400">{WD_SHORT[d.getDay()]}</div>
                          <div className="text-xl font-bold leading-tight text-slate-700">{String(d.getDate()).padStart(2, "0")}</div>
                        </div>
                        {/* Badge type */}
                        <span className="flex h-7 w-9 flex-none items-center justify-center rounded-md text-xs font-bold" style={{ background: s?.bg, color: s?.fg }}>{s?.code || normalizeType(c.type)}</span>
                        {/* Label + plage horaire */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-sm font-semibold text-slate-700">{s?.label}</span>
                            {c.tag && <span className="text-[10px] italic text-slate-400">{c.tag === "VR" ? "· veille de repos" : "· lendemain de repos"}</span>}
                          </div>
                          {s?.time && <div className="mt-0.5 text-sm tabular-nums text-slate-500">{s.time}</div>}
                        </div>
                        {/* Heures + chevron */}
                        <div className="flex flex-none items-center gap-2">
                          <div className="text-right">
                            {(s?.hours ?? 0) > 0 && (
                              <span className="rounded-md px-2 py-1 text-sm font-bold tabular-nums" style={{ background: s?.bg, color: s?.fg }}>{formatH(s.hours)}</span>
                            )}
                            {c.ot > 0 && <div className="mt-1 text-[11px] font-semibold text-red-500">+{formatH(c.ot)}</div>}
                          </div>
                          <ChevronRight size={14} className={`flex-none text-slate-300 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-slate-100 bg-slate-50 px-3 py-3">
                          {colleagues.length === 0 ? (
                            <p className="text-xs text-slate-400">Aucun collègue planifié.</p>
                          ) : (
                            <div className="space-y-3">
                              {withMe.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Avec moi</p>
                                  <div className="space-y-1.5">
                                    {withMe.map(({ agent, shift }) => (
                                      <div key={agent.id} className="flex items-center gap-2.5 rounded-md bg-white px-2 py-1.5">
                                        <span className="flex h-5 w-8 flex-none items-center justify-center rounded text-[11px] font-bold" style={{ background: shift?.bg, color: shift?.fg }}>{shift?.code}</span>
                                        <span className="flex items-center gap-1 flex-1 text-sm font-medium text-slate-700"><RoleMark role={agent.role} />{agent.name}</span>
                                        {shift?.time && <span className="text-[11px] tabular-nums text-slate-400">{shift.time}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {others.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Autre demi-journée</p>
                                  <div className="space-y-1.5">
                                    {others.map(({ agent, shift }) => (
                                      <div key={agent.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 opacity-60">
                                        <span className="flex h-5 w-8 flex-none items-center justify-center rounded text-[11px] font-bold" style={{ background: shift?.bg, color: shift?.fg }}>{shift?.code}</span>
                                        <span className="flex items-center gap-1 flex-1 text-sm text-slate-500"><RoleMark role={agent.role} />{agent.name}</span>
                                        {shift?.time && <span className="text-[11px] tabular-nums text-slate-400">{shift.time}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {myDays.length === 0 && <p className="text-xs text-slate-400">Aucun planning publié pour ce mois.</p>}
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Échanger des heures" subtitle="Proposez d'échanger votre demi-journée avec un collègue présent sur l'autre demi-journée.">
          <label className="block text-xs font-medium text-slate-500">Jour</label>
          <select value={swapDay} onChange={(e) => { setSwapDay(e.target.value); setSwapTo(""); }} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm">
            <option value="">— Choisir un jour —</option>
            {swapDays.map((d) => { const c = assignments[me.id][keyOf(d)]; return <option key={keyOf(d)} value={keyOf(d)}>{dlabel(keyOf(d))} ({ALL[normalizeType(c.type)]?.label})
</option>; })}
          </select>
          {swapDay && (
            <>
              <label className="mt-3 block text-xs font-medium text-slate-500">Avec</label>
              <select value={swapTo} onChange={(e) => setSwapTo(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm">
                <option value="">— Choisir un collègue —</option>
                {partners.map((a) => <option key={a.id} value={a.name}><RoleMark role={a.role} />{a.name}</option>)}
              </select>
              {partners.length === 0 && <p className="mt-1 text-xs text-amber-600">Aucun collègue du même groupe disponible sur l'autre demi-journée ce jour-là.</p>}
            </>
          )}
          <label className="mt-3 block text-xs font-medium text-slate-500">Raison <span className="font-normal text-slate-400">(optionnel)</span></label>
          <textarea
            value={swapReason}
            onChange={(e) => setSwapReason(e.target.value)}
            placeholder="ex. formation, rendez-vous personnel..."
            rows={2}
            className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm"
          />
          <button onClick={submitSwap} disabled={!swapDay || !swapTo} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#163F87" }}>
            <Send size={15} /> Envoyer la demande
          </button>
        </Card>

        <Card title="Demander un congé" subtitle="Indiquez le jour et la raison. Un administrateur validera la demande.">
          <label className="block text-xs font-medium text-slate-500">Jour</label>
          <select value={leaveDay} onChange={(e) => setLeaveDay(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm">
            <option value="">— Choisir un jour —</option>
            {myDays.map((d) => <option key={keyOf(d)} value={keyOf(d)}>{dlabel(keyOf(d))}</option>)}
          </select>
          <label className="mt-3 block text-xs font-medium text-slate-500">Raison</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. rendez-vous médical" className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm" />
          <button onClick={submitLeave} disabled={!leaveDay || !reason.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#163F87" }}>
            <Send size={15} /> Envoyer la demande
          </button>
        </Card>

        <Card title="Mes demandes" subtitle="Suivi de vos demandes de changement.">
          <div className="space-y-1.5">
            {myReqs.length === 0 && <p className="text-xs text-slate-400">Aucune demande envoyée.</p>}
            {myReqs.map((r) => <RequestRow key={r.id} r={r} />)}
          </div>
        </Card>
      </div>
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglets administrateur : Comptes & Demandes                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Onglet Événements (admin)                                          */
/* ------------------------------------------------------------------ */
function EvenementsTab({ happenings, addHappening, updateHappening, removeHappening }) {
  const sorted = [...happenings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const today = keyOf(new Date());
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card
        title="Événements Handiplage"
        subtitle="Ces informations seront visibles par tous les membres de l'équipe."
        action={
          <button onClick={addHappening} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Plus size={13} /> Ajouter
          </button>
        }
      >
        {happenings.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">Aucun événement. Cliquez sur « Ajouter » pour créer le premier.</p>
        )}
        <div className="space-y-3">
          {sorted.map((ev) => {
            const past = ev.date < today;
            return (
              <div key={ev.id} className={`rounded-xl border p-4 ${past ? "border-slate-100 bg-slate-50 opacity-60" : "border-brand/20 bg-white shadow-sm"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ background: past ? "#e2e8f0" : "#EBF0FA", color: past ? "#94a3b8" : "#163F87" }}>
                    <Flag size={18} />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Titre</label>
                      <input
                        value={ev.title}
                        onChange={(e) => updateHappening(ev.id, { title: e.target.value })}
                        placeholder="Titre de l'événement"
                        className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date</label>
                        <input
                          type="date"
                          value={ev.date}
                          onChange={(e) => updateHappening(ev.id, { date: e.target.value })}
                          className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                      <div className="w-24 flex-none">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Heure</label>
                        <input
                          type="time"
                          value={ev.time}
                          onChange={(e) => updateHappening(ev.id, { time: e.target.value })}
                          className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Consignes</label>
                      <textarea
                        value={ev.instructions}
                        onChange={(e) => updateHappening(ev.id, { instructions: e.target.value })}
                        placeholder="Instructions, informations pratiques..."
                        rows={2}
                        className="mt-0.5 w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeHappening(ev.id)} className="flex-none rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ComptesTab({ accounts, addAccount, updateAccount, removeAccount, createTeamAccounts }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card title="Comptes" subtitle="Administrateurs (accès complet) et utilisateurs (consultation de leur planning + demandes)." action={
        <div className="flex flex-wrap gap-1.5">
          <button onClick={createTeamAccounts} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Créer les comptes des équipes</button>
          <button onClick={addAccount} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={13} /> Ajouter</button>
        </div>
      }>
        <div className="space-y-1.5">
          {accounts.map((acc, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
              <input value={acc.id} onChange={(e) => updateAccount(i, { id: e.target.value })} placeholder="identifiant" className="w-28 min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs" />
              <input value={acc.password} onChange={(e) => updateAccount(i, { password: e.target.value })} placeholder="mot de passe" className="w-28 min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs" />
              <select value={acc.role} onChange={(e) => updateAccount(i, { role: e.target.value })} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs">
                <option value="admin">Administrateur</option>
                <option value="user">Utilisateur</option>
              </select>
              <input value={acc.name} onChange={(e) => updateAccount(i, { name: e.target.value })} placeholder={acc.role === "user" ? "nom exact de l'agent" : "nom affiché"} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs" />
              <button onClick={() => removeAccount(i)} className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Pour un compte <b>utilisateur</b>, le « nom » doit correspondre exactement au nom de l'agent dans l'équipe afin de relier la personne à son planning. « Créer les comptes des équipes » génère automatiquement un identifiant et un mot de passe pour chaque agent de la saison.</p>
      </Card>
    </div>
  );
}

function DemandesTab({ requests, decideRequest }) {
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const [replies, setReplies] = useState({});
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card title="Demandes en attente" subtitle="Validez ou refusez les demandes du personnel. Une validation applique automatiquement le changement au planning.">
        <div className="space-y-2">
          {pending.length === 0 && <p className="text-xs text-slate-400">Aucune demande en attente.</p>}
          {pending.map((r) => {
            const { icon: Icon, title, detail } = reqLabel(r);
            return (
              <div key={r.id} className="rounded-md border border-slate-100 bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-start gap-2">
                  <Icon size={15} className="mt-0.5 flex-none text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">{r.fromName} — {title}</p>
                    <p className="text-xs text-slate-400">{detail}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={replies[r.id] || ""}
                    onChange={(e) => setReplies((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="Message de réponse (optionnel)..."
                    rows={1}
                    className="min-h-[32px] w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand/30"
                  />
                  <div className="flex flex-none gap-1.5">
                    <button onClick={() => decideRequest(r, true, replies[r.id])} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: "#15803D" }}><Check size={13} /> Accepter</button>
                    <button onClick={() => decideRequest(r, false, replies[r.id])} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><X size={13} /> Refuser</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {done.length > 0 && (
        <Card title="Historique">
          <div className="space-y-1.5">{done.map((r) => <RequestRow key={r.id} r={r} showWho />)}</div>
        </Card>
      )}
    </div>
  );
}
