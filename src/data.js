// Données et règles du prototype. Le moteur de génération reprend celui du site actuel
// (repos tous les 6 jours, veille/lendemain de repos, coupés, compensation), avec un hasard reproductible.

export const SHIFTS = {
  M:  { code: "M",  label: "Matin",          time: "7h20 – 13h10",  hours: 5.8333, present: [7, 8, 9, 10, 11, 12, 13] },
  AM: { code: "AM", label: "Après-midi",     time: "13h10 – 19h00", hours: 5.8333, present: [13, 14, 15, 16, 17, 18] },
  CP: { code: "CP", label: "Coupé",          time: "7h20 – 19h00",  hours: 9.9167, present: [7, 8, 9, 10, 11, 12, 15, 16, 17, 18] },
  AD: { code: "AD", label: "Administratif",  time: "8h30 – 17h00",  hours: 7,      present: [8, 9, 10, 11, 13, 14, 15, 16] },
  R:  { code: "R",  label: "Repos hebdo",    time: "",              hours: 0,      present: [] },
  RC: { code: "RC", label: "Récup heures",   time: "",              hours: 0,      present: [] },
  IN: { code: "IN", label: "Indisponible",   time: "",              hours: 0,      present: [] },
};
export const WORK = ["M", "AM", "CP", "AD"];
export const OFF = ["R", "RC", "IN"];
export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
export const OT_ADD = SHIFTS.CP.hours - SHIFTS.M.hours; // ~4h05 : une demi-journée complétée en coupé

export const ROLES = {
  chef: { label: "Chef·fe d’équipe", short: "Chef·fe" },
  adm: { label: "Administratif", short: "Adm." },
  agent: { label: "Handiplagiste", short: "Handi." },
};

export const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const WD = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
export const WD_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const MONTHS_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const fmtH = (h) => { const t = Math.round((h || 0) * 60), hh = Math.floor(t / 60), mm = t % 60; return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`; };
export const dayLabel = (d) => `${WD_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
export const shortDay = (d) => `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

export function monthsInSeason(open, close) {
  const o = parseDate(open), c = parseDate(close);
  const out = []; let y = o.getFullYear(), m = o.getMonth();
  while (y < c.getFullYear() || (y === c.getFullYear() && m <= c.getMonth())) { out.push(`${y}-${String(m + 1).padStart(2, "0")}`); m++; if (m > 11) { m = 0; y++; } }
  return out;
}
export function monthDates(mk, open, close) {
  const [y, m] = mk.split("-").map(Number);
  const first = new Date(y, m - 1, 1), last = new Date(y, m, 0), o = parseDate(open), c = parseDate(close);
  const out = [];
  for (let d = first < o ? o : first; d <= (last > c ? c : last); d = addDays(d, 1)) out.push(new Date(d));
  return out;
}
export const monthName = (mk) => cap(MONTHS_FR[Number(mk.split("-")[1]) - 1]);
// « de juillet », « d’août »
export const deM = (name) => { const m = name.toLowerCase(); return /^[aeiouyâàéèêîôûh]/.test(m) ? `d’${m}` : `de ${m}`; };

/* ---------- Personnes ---------- */
export const fullName = (a) => `${a.first} ${(a.last || "").toUpperCase()}`.trim();
export const uid = () => Math.random().toString(36).slice(2, 9);
// Identité stable d'une personne d'un mois à l'autre (les fiches de chaque mois ont leur propre id)
export const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const pkey = (a) => `${norm(a.first)}|${norm(a.last)}`;
export const newAgent = () => ({ id: uid(), first: "", last: "", role: "agent", restDay: 2 });

/* ---------- Moteur de génération (règles identiques à l'ancien site) ---------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * prior : heures déjà faites plus tôt dans la saison, par id de fiche du mois ({ id: heures }).
 * Sert à équilibrer : repos en plus, coupés et compensations vont en priorité là où il faut.
 */
export function buildPlanning(team, mDates, minHalf = 4, seed, prior = {}) {
  if (!mDates.length || !team.length) return {};
  const rand = seed == null ? Math.random : rng(seed);
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const chefList = team.filter((a) => a.role === "chef"), agentList = team.filter((a) => a.role === "agent");
  const byId = Object.fromEntries(team.map((a) => [a.id, a]));
  const startDate = mDates[0], offset = {};
  const P = (id) => prior[id] || 0;
  // Repos tous les 6 jours. Sur un mois incomplet certains ont un repos de plus :
  // il revient à ceux qui ont le plus d'heures cumulées (décalage 0 = le plus de repos)
  shuffle(agentList).sort((x, y) => P(y.id) - P(x.id)).forEach((a, i) => { offset[a.id] = i % 6; });
  const dayIndex = (date) => Math.round((date - startDate) / 86400000);
  const isRest = (a, date) => a.role === "chef" ? date.getDay() === a.restDay : a.role === "adm" ? date.getDay() === 3 || date.getDay() === 4 : (((dayIndex(date) - offset[a.id]) % 6) + 6) % 6 === 0;
  const prefAt = (a, date) => (isRest(a, addDays(date, 1)) ? "M" : isRest(a, addDays(date, -1)) ? "AM" : null);
  const other = (h) => (h === "M" ? "AM" : "M");
  const next = {}, morn = {};
  team.forEach((a) => { morn[a.id] = 0; next[a.id] = {}; });

  mDates.forEach((d, di) => {
    const dk = keyOf(d);
    const set = (id, type) => { next[id][dk] = { type, ot: 0 }; };
    const resting = new Set(team.filter((a) => isRest(a, d)).map((a) => a.id));
    team.filter((a) => a.role === "adm").forEach((a) => set(a.id, resting.has(a.id) ? "R" : "AD"));
    team.filter((a) => a.role !== "adm" && resting.has(a.id)).forEach((a) => set(a.id, "R"));
    const chefsIn = chefList.filter((c) => !resting.has(c.id)).sort((x, y) => morn[x.id] - morn[y.id]);
    const othersIn = agentList.filter((a) => !resting.has(a.id));
    const n = chefsIn.length + othersIn.length;
    const mSize = di % 2 === 0 ? Math.ceil(n / 2) : Math.floor(n / 2);
    let mLeft = mSize, amLeft = n - mSize;
    const toM = (id) => { set(id, "M"); morn[id]++; mLeft--; };
    const toAM = (id) => { set(id, "AM"); amLeft--; };
    if (chefsIn.length === 2) {
      const [c0, c1] = chefsIn, p0 = prefAt(c0, d), p1 = prefAt(c1, d);
      let s0 = p0 || (p1 ? other(p1) : di % 2 === 0 ? "M" : "AM");
      if (s0 === "M" && mLeft <= 0) s0 = "AM"; if (s0 === "AM" && amLeft <= 0) s0 = "M";
      if (s0 === "M") { toM(c0.id); toAM(c1.id); } else { toAM(c0.id); toM(c1.id); }
    } else if (chefsIn.length === 1) {
      let s = prefAt(chefsIn[0], d) || (di % 2 === 0 ? "M" : "AM");
      if (s === "M" && mLeft <= 0) s = "AM"; if (s === "AM" && amLeft <= 0) s = "M";
      if (s === "M") toM(chefsIn[0].id); else toAM(chefsIn[0].id);
    }
    const ord = (arr) => shuffle(arr).sort((x, y) => morn[x.id] - morn[y.id]);
    const leftover = [];
    ord(othersIn.filter((a) => prefAt(a, d) === "M")).forEach((a) => { if (mLeft > 0) toM(a.id); else leftover.push(a); });
    ord(othersIn.filter((a) => prefAt(a, d) === "AM")).forEach((a) => { if (amLeft > 0) toAM(a.id); else leftover.push(a); });
    ord(othersIn.filter((a) => prefAt(a, d) == null).concat(leftover)).forEach((a) => { if (mLeft > 0) toM(a.id); else toAM(a.id); });
    [...chefList, ...agentList].forEach((a) => {
      const c = next[a.id][dk]; if (!c) return;
      const p = prefAt(a, d);
      if (p === "M" && c.type === "M") c.tag = "VR"; else if (p === "AM" && c.type === "AM") c.tag = "LR";
    });
  });
  // Heures projetées de chacun : cumul de la saison + heures du mois après la répartition matin / après-midi
  const H = {};
  team.forEach((a) => { H[a.id] = P(a.id) + mDates.reduce((s, d) => s + (SHIFTS[next[a.id][keyOf(d)]?.type]?.hours || 0), 0); });
  // Coupés prévus : 2 à 3 par mois complet comme avant, mais les coupés « en plus » vont aux moins chargés
  const N = mDates.length, group = [...agentList, ...chefList];
  const minC = Math.round((2 * N) / 28), maxC = Math.max(minC, Math.round((3 * N) / 28));
  const extra = Math.round(((2.5 * N) / 28 - minC) * group.length);
  const target = Object.fromEntries(group.map((a) => [a.id, minC]));
  shuffle(group).sort((x, y) => H[x.id] - H[y.id]).slice(0, Math.max(0, extra)).forEach((a) => { target[a.id] = Math.min(maxC, target[a.id] + 1); });
  group.forEach((a) => {
    const neutral = mDates.filter((d) => { const c = next[a.id][keyOf(d)]; return c && (c.type === "M" || c.type === "AM") && prefAt(a, d) == null; });
    const picked = shuffle(neutral).slice(0, Math.min(neutral.length, target[a.id]));
    picked.forEach((d) => { const c = next[a.id][keyOf(d)]; c.half = c.type; c.type = "CP"; });
    H[a.id] += picked.length * (SHIFTS.CP.hours - SHIFTS.M.hours);
  });
  const coversH = (id, dk, h) => { const c = next[id][dk]; return c.type === h || c.type === "CP"; };
  // Compensation : à la personne la moins chargée ; les chef·fes comptent pour 95 % de leurs heures,
  // ils en prennent donc un peu plus (règle conservée de l'ancien site)
  const wkey = (id) => H[id] * (byId[id].role === "chef" ? 0.95 : 1);
  mDates.forEach((d) => {
    const dk = keyOf(d);
    ["M", "AM"].forEach((short) => {
      let guard = 0;
      while (team.filter((a) => coversH(a.id, dk, short)).length < minHalf && guard++ < 30) {
        const oth = other(short);
        let pool = team.filter((a) => next[a.id][dk].type === oth && !next[a.id][dk].tag);
        if (!pool.length) pool = team.filter((a) => next[a.id][dk].type === oth);
        const pick = shuffle(pool).sort((x, y) => wkey(x.id) - wkey(y.id))[0];
        if (!pick) break;
        next[pick.id][dk] = { ...next[pick.id][dk], type: "CP", tag: null, comp: true, compHalf: short, ot: (next[pick.id][dk].ot || 0) + OT_ADD };
        H[pick.id] += OT_ADD;
      }
    });
  });
  // Rééquilibrage : tant qu'un écart dépasse un coupé (4h05), on transfère un coupé, le même jour,
  // de la personne la plus chargée vers une moins chargée qui fait la même demi-journée.
  // L'effectif matin / après-midi ne bouge pas ; coupure de 48 h et règle des chef·fes respectées.
  const K = (id) => H[id] * (byId[id].role === "chef" ? 0.95 : 1);
  const people = team.filter((a) => a.role !== "adm");
  const coupesPrevus = (id) => mDates.filter((d) => { const c = next[id][keyOf(d)]; return c.type === "CP" && !c.comp; }).length;
  const chefsOk = (dk) => { const t = chefList.map((c) => next[c.id][dk]?.type).filter((x) => x === "M" || x === "AM"); return !(chefList.length === 2 && t.length === 2 && t[0] === t[1]); };
  const tryMove = (hi, lo) => {
    for (const d of shuffle(mDates)) {
      const dk = keyOf(d), ch = next[hi][dk], cl = next[lo][dk];
      if (ch.type !== "CP" || cl.tag || (cl.type !== "M" && cl.type !== "AM")) continue;
      const half = ch.comp ? other(ch.compHalf) : ch.half;
      if (half !== cl.type) continue;
      if (!ch.comp && coupesPrevus(lo) >= maxC) continue; // jamais plus de 2 à 3 coupés prévus par mois
      const before = [{ ...ch }, { ...cl }];
      if (ch.comp) {
        next[lo][dk] = { ...cl, type: "CP", tag: null, comp: true, compHalf: ch.compHalf, ot: (cl.ot || 0) + OT_ADD };
        next[hi][dk] = { ...ch, type: half, comp: false, compHalf: null, tag: null, ot: Math.max(0, (ch.ot || 0) - OT_ADD) };
      } else {
        next[lo][dk] = { ...cl, type: "CP", half: cl.type, tag: null };
        next[hi][dk] = { ...ch, type: half, half: undefined, tag: null };
      }
      if (!chefsOk(dk)) { next[hi][dk] = before[0]; next[lo][dk] = before[1]; continue; }
      H[hi] -= OT_ADD; H[lo] += OT_ADD;
      return true;
    }
    // Sinon, coupé prévu déplacé d'un jour à l'autre, si le jour d'origine garde au moins le minimum
    if (coupesPrevus(lo) >= maxC) return false;
    const covers = (dk, h) => team.filter((a) => { const t = next[a.id][dk]?.type; return t === h || t === "CP"; }).length;
    const fromDays = shuffle(mDates).filter((d) => { const c = next[hi][keyOf(d)]; return c.type === "CP" && !c.comp && covers(keyOf(d), other(c.half)) > minHalf; });
    const toDays = shuffle(mDates).filter((d) => { const c = next[lo][keyOf(d)]; return (c.type === "M" || c.type === "AM") && !c.tag && prefAt(byId[lo], d) == null; });
    for (const dh of fromDays) {
      for (const dl of toDays) {
        const kh = keyOf(dh), kl = keyOf(dl);
        if (kh === kl) continue;
        const ch = next[hi][kh], cl = next[lo][kl];
        next[hi][kh] = { ...ch, type: ch.half, half: undefined, tag: null };
        next[lo][kl] = { ...cl, type: "CP", half: cl.type, tag: null };
        if (chefsOk(kh) && chefsOk(kl)) { H[hi] -= OT_ADD; H[lo] += OT_ADD; return true; }
        next[hi][kh] = ch; next[lo][kl] = cl;
      }
    }
    return false;
  };
  for (let guard = 0; guard < 300; guard++) {
    const order = [...people].sort((x, y) => K(y.id) - K(x.id));
    let moved = false;
    for (let i = 0; i < order.length && !moved; i++) {
      for (let j = order.length - 1; j > i && !moved; j--) {
        if (K(order[i].id) - K(order[j].id) <= OT_ADD) break;
        moved = tryMove(order[i].id, order[j].id);
      }
    }
    if (!moved) break;
  }
  team.forEach((a) => mDates.forEach((d) => { const c = next[a.id][keyOf(d)]; if (c) delete c.half; }));
  return next;
}

/** Heures cumulées par personne (pkey) sur les mois donnés, versions validées en priorité. */
export function seasonHours(monthList, ctx) {
  const out = {};
  monthList.forEach((m) => {
    const plan = ctx.archives.find((a) => a.mk === m)?.snapshot || ctx.plans[m];
    if (!plan) return;
    const dates = monthDates(m, ctx.season.open, ctx.season.close);
    (ctx.monthTeams[m] || []).forEach((a) => { const k = pkey(a); out[k] = (out[k] || 0) + totalsFor(a, dates, plan).total; });
  });
  return out;
}

// Base / heures sup / total d'une personne sur un mois (même calcul que le site actuel)
export function totalsFor(a, dates, plan) {
  let base = 0, ot = 0, worked = 0, cp = 0;
  dates.forEach((d) => {
    const c = plan?.[a.id]?.[keyOf(d)]; if (!c) return;
    if (WORK.includes(c.type)) { base += c.comp ? SHIFTS.M.hours : SHIFTS[c.type].hours; worked++; }
    if (c.type === "CP") cp++;
    ot += Number(c.ot) || 0;
  });
  return { base, ot, worked, cp, total: base + ot };
}

/* ---------- Modèle de données (version 2) ---------- */
export const DATA_VERSION = 2;
export const DEFAULT_SEASON = { open: "2026-06-12", close: "2026-09-15", minHalf: 4, minEffectif: 5 };
export const todayKey = () => keyOf(new Date());
export const frDate = (k) => (k ? k.split("-").reverse().join("/") : "");

export function emptyState() {
  return {
    version: DATA_VERSION, season: { ...DEFAULT_SEASON }, monthTeams: {}, plans: {}, archives: [],
    requests: [], happenings: [], dayNotes: {}, accounts: [{ id: "admin", password: "admin", role: "admin", name: "Administrateur", pkey: null }],
    badges: { styles: null, prefs: {}, log: {}, print: null },
  };
}

// Ancien format « NOM Prénom » : les mots en capitales forment le nom de famille
export function splitName(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  const isUpper = (w) => w.length > 1 && /\p{L}/u.test(w) && w === w.toLocaleUpperCase("fr-FR");
  const last = words.filter(isUpper), first = words.filter((w) => !isUpper(w));
  if (!last.length || !first.length) return { first: words.join(" "), last: "" };
  const cap = (w) => w.toLocaleLowerCase("fr-FR").replace(/(^|[-'’])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("fr-FR"));
  return { first: first.join(" "), last: last.map(cap).join(" ") };
}

/** Convertit les données de l'ancien site (version 1) sans rien perdre. */
export function migrateV1(d) {
  const st = emptyState();
  st.season = { open: d.seasonOpen || DEFAULT_SEASON.open, close: d.seasonClose || DEFAULT_SEASON.close, minHalf: d.minHalf ?? 4, minEffectif: d.minEffectif ?? 5 };
  const assignments = d.assignments || {};
  const fixCell = (c) => ({ ...c, type: c.type === "JC" ? "CP" : c.type });
  for (const [mk, team] of Object.entries(d.monthTeams || {})) {
    st.monthTeams[mk] = (team || []).map((a) => ({ id: a.id, ...splitName(a.name), role: a.role || "agent", restDay: a.restDay ?? 2 }));
    const plan = {};
    for (const a of team || []) {
      const days = Object.entries(assignments[a.id] || {}).filter(([dk]) => dk.startsWith(mk));
      if (days.length) plan[a.id] = Object.fromEntries(days.map(([dk, c]) => [dk, fixCell(c)]));
    }
    if (Object.keys(plan).length) st.plans[mk] = plan;
  }
  st.archives = (d.archivedMonths || []).map((x) => ({ mk: x.monthKey, validatedAt: frDate(x.validatedAt), snapshot: x.assignments || {} }));
  st.dayNotes = { ...(d.events || {}) };
  st.happenings = (d.happenings || []).map((e) => ({ id: e.id || uid(), date: e.date, time: e.time || "09:00", title: e.title || "", instructions: e.instructions || "" }));
  const keyOfName = (name) => pkey(splitName(name));
  st.accounts = (d.accounts || st.accounts).map((c) => (c.role === "admin"
    ? { id: c.id, password: c.password, role: "admin", name: c.name || "Administrateur", pkey: null }
    : { id: c.id, password: c.password, role: "user", name: fullName(splitName(c.name)), pkey: c.name ? keyOfName(c.name) : null }));
  st.requests = (d.requests || []).map((r) => ({
    id: r.id || uid(), type: r.type, monthKey: r.monthKey || (r.dateKey || "").slice(0, 7), date: r.dateKey,
    from: keyOfName(r.fromName), target: r.targetName ? keyOfName(r.targetName) : null,
    reason: r.reason || r.swapReason || "", createdAt: r.createdAt || Date.now(), status: r.status || "pending", reply: r.adminReply || "",
  }));
  return st;
}

/**
 * Retire du planning d'un mois (non validé) les lignes des personnes qui ne sont plus dans son équipe :
 * une équipe vidée volontairement ne doit plus produire de planning ni d'alertes.
 */
export function pruneOrphans(st) {
  const plans = {};
  for (const [mk, plan] of Object.entries(st.plans || {})) {
    const ids = new Set((st.monthTeams[mk] || []).map((a) => a.id));
    const keep = Object.fromEntries(Object.entries(plan || {}).filter(([id]) => ids.has(id)));
    if (Object.keys(keep).length) plans[mk] = keep;
  }
  return { ...st, plans };
}

/** Lit ce qui est stocké dans Supabase, quelle que soit sa version. */
export function loadState(raw) {
  if (!raw) return emptyState();
  if (raw.version === DATA_VERSION) {
    const base = emptyState();
    const st = { ...base, ...raw, season: { ...base.season, ...raw.season }, badges: { ...base.badges, ...(raw.badges || {}) } };
    return pruneOrphans(st);
  }
  return migrateV1(raw);
}

// « il y a 2 h », « hier »… pour les demandes
export function since(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "à l’instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `il y a ${j} j`;
}
