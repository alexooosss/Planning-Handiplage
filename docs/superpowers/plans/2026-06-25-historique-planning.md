# Historique des plannings validés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de valider un mois de planning pour l'archiver, et aux utilisateurs de consulter les plannings passés complets.

**Architecture:** Nouvel état `archivedMonths` dans App, inclus dans export/import JSON. `applyRequest` met à jour l'archive en même temps que les assignments. Deux nouveaux composants : `HistoriqueTab` (admin) et `ArchivedMonthView` (user).

**Tech Stack:** React 18, JSX, hooks useState/useMemo, Tailwind CSS, lucide-react

---

### Task 1 : État `archivedMonths` + export/import + `validateMonth`

**Files:**
- Modify: `planning-equipe.jsx:1` (import Archive de lucide-react)
- Modify: `planning-equipe.jsx:159` (après `happenings`, ajouter état)
- Modify: `planning-equipe.jsx:375` (exportJSON)
- Modify: `planning-equipe.jsx:385` (importJSON)
- Modify: après `removeHappening` (ajouter `validateMonth`)

- [ ] **Ajouter `Archive` aux imports lucide-react (ligne 3)**

Trouver la ligne d'import lucide et ajouter `Archive` :
```jsx
import {
  Users, CalendarDays, LayoutGrid, BarChart3, Plus, Trash2, Wand2,
  Archive,
  // ... reste des imports existants
```

- [ ] **Ajouter l'état `archivedMonths` après la ligne `happenings` (~ligne 159)**

```jsx
const [archivedMonths, setArchivedMonths] = useState([]);
```

- [ ] **Ajouter `validateMonth` après `removeHappening` (~ligne 162)**

```jsx
const validateMonth = (monthKey, label) => {
  if (!window.confirm(`Valider ${label} ? Cette version sera archivée.`)) return;
  const mDates = monthDates(monthKey, seasonOpen, seasonClose);
  const snap = {};
  mDates.forEach((d) => {
    const dk = keyOf(d);
    agents.forEach((a) => {
      if (assignments[a.id]?.[dk]) {
        if (!snap[a.id]) snap[a.id] = {};
        snap[a.id][dk] = assignments[a.id][dk];
      }
    });
  });
  const entry = { monthKey, label, validatedAt: keyOf(new Date()), assignments: snap };
  setArchivedMonths((prev) => {
    const exists = prev.find((a) => a.monthKey === monthKey);
    return exists ? prev.map((a) => a.monthKey === monthKey ? entry : a) : [...prev, entry];
  });
};
```

- [ ] **Ajouter `archivedMonths` dans `exportJSON` (~ligne 377)**

Remplacer :
```jsx
[JSON.stringify({ seasonOpen, seasonClose, monthTeams, minEffectif, minHalf, events, assignments, accounts, requests, happenings }, null, 2)],
```
Par :
```jsx
[JSON.stringify({ seasonOpen, seasonClose, monthTeams, minEffectif, minHalf, events, assignments, accounts, requests, happenings, archivedMonths }, null, 2)],
```

- [ ] **Ajouter `archivedMonths` dans `importJSON` (~ligne 401)**

Après `if (d.happenings) setHappenings(d.happenings);` ajouter :
```jsx
if (d.archivedMonths) setArchivedMonths(d.archivedMonths);
```

- [ ] **Commit**
```bash
git add planning-equipe.jsx
git commit -m "feat(historique): état archivedMonths + export/import + validateMonth"
```

---

### Task 2 : Mise à jour automatique de l'archive lors d'une permutation

**Files:**
- Modify: `planning-equipe.jsx:466` (fonction `applyRequest`)

- [ ] **Remplacer `applyRequest` (~ligne 466) pour qu'elle synchronise aussi l'archive**

```jsx
const applyRequest = (req) => {
  const mKey = req.dateKey?.slice(0, 7);
  if (req.type === "leave") {
    const a = resolveAgent(req.monthKey, req.fromName);
    if (a) {
      setAssignments((p) => ({ ...p, [a.id]: { ...(p[a.id] || {}), [req.dateKey]: { type: "IN", ot: 0 } } }));
      setArchivedMonths((prev) => prev.map((arc) =>
        arc.monthKey !== mKey ? arc : {
          ...arc,
          assignments: { ...arc.assignments, [a.id]: { ...(arc.assignments[a.id] || {}), [req.dateKey]: { type: "IN", ot: 0 } } }
        }
      ));
    }
  } else if (req.type === "swap") {
    const a = resolveAgent(req.monthKey, req.fromName), b = resolveAgent(req.monthKey, req.targetName);
    if (a && b) {
      setAssignments((p) => {
        const ca = p[a.id]?.[req.dateKey], cb = p[b.id]?.[req.dateKey];
        if (!ca || !cb) return p;
        return { ...p, [a.id]: { ...p[a.id], [req.dateKey]: { ...ca, type: cb.type, tag: null } }, [b.id]: { ...p[b.id], [req.dateKey]: { ...cb, type: ca.type, tag: null } } };
      });
      setArchivedMonths((prev) => prev.map((arc) => {
        if (arc.monthKey !== mKey) return arc;
        const ca = arc.assignments[a.id]?.[req.dateKey];
        const cb = arc.assignments[b.id]?.[req.dateKey];
        if (!ca || !cb) return arc;
        return {
          ...arc,
          assignments: {
            ...arc.assignments,
            [a.id]: { ...arc.assignments[a.id], [req.dateKey]: { ...ca, type: cb.type, tag: null } },
            [b.id]: { ...arc.assignments[b.id], [req.dateKey]: { ...cb, type: ca.type, tag: null } },
          }
        };
      }));
    }
  }
};
```

- [ ] **Commit**
```bash
git add planning-equipe.jsx
git commit -m "feat(historique): sync archive automatique lors des permutations/congés"
```

---

### Task 3 : Bouton "Valider ce mois" dans PlanningTab

**Files:**
- Modify: `planning-equipe.jsx:1007` (signature PlanningTab)
- Modify: `planning-equipe.jsx:1022` (return de PlanningTab, ajouter bouton)
- Modify: `planning-equipe.jsx:851` (appel PlanningTab dans App, passer nouveaux props)

- [ ] **Mettre à jour la signature de `PlanningTab` (~ligne 1007)**

Remplacer :
```jsx
function PlanningTab({ agents, dates, assignments, setEditing, generate, hasPlan, minHalf, events, setEvents }) {
```
Par :
```jsx
function PlanningTab({ agents, dates, assignments, setEditing, generate, hasPlan, minHalf, events, setEvents, archivedMonths, currentMonth, monthLabel, validateMonth }) {
```

- [ ] **Ajouter le bouton "Valider ce mois" au début du return de PlanningTab (~ligne 1023)**

Juste avant `<Card title="Planning de l'équipe"`, ajouter :
```jsx
  {(() => {
    const archived = archivedMonths?.find((a) => a.monthKey === currentMonth);
    return (
      <div className="mb-4 flex items-center gap-3">
        {archived ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <Archive size={13} />
            Validé le {archived.validatedAt?.split("-").reverse().join("/")}
          </div>
        ) : (
          <button
            onClick={() => validateMonth(currentMonth, monthLabel)}
            className="flex items-center gap-2 rounded-md border border-brand/30 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/5"
          >
            <Archive size={13} /> Valider {monthLabel}
          </button>
        )}
      </div>
    );
  })()}
```

- [ ] **Passer les nouveaux props à PlanningTab dans l'App (~ligne 852)**

Remplacer :
```jsx
<PlanningTab {...{ agents, dates, assignments, setEditing, generate, hasPlan, minHalf, events, setEvents }} />
```
Par :
```jsx
<PlanningTab {...{ agents, dates, assignments, setEditing, generate, hasPlan, minHalf, events, setEvents, archivedMonths, currentMonth, monthLabel, validateMonth }} />
```

- [ ] **Commit**
```bash
git add planning-equipe.jsx
git commit -m "feat(historique): bouton Valider ce mois dans PlanningTab"
```

---

### Task 4 : Onglet "Historique" admin + composant `HistoriqueTab`

**Files:**
- Modify: `planning-equipe.jsx:804` (nav tabs, ajouter "historique")
- Modify: `planning-equipe.jsx:862` (render tab)
- Add: `HistoriqueTab` component (après `EvenementsTab`)

- [ ] **Ajouter le tab "historique" dans la nav admin (~ligne 804)**

Après `["evenements", "Événements", Flag],` ajouter :
```jsx
["historique", "Historique", Archive],
```

- [ ] **Ajouter le render du tab dans l'App (~ligne 862)**

Après `{tab === "evenements" && ...}` ajouter :
```jsx
{tab === "historique" && <HistoriqueTab {...{ archivedMonths, agents }} />}
```

- [ ] **Créer le composant `HistoriqueTab` (avant `EvenementsTab` ~ligne 2734)**

```jsx
function HistoriqueTab({ archivedMonths, agents }) {
  const [viewing, setViewing] = useState(null);
  const sorted = [...archivedMonths].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const arc = viewing ? archivedMonths.find((a) => a.monthKey === viewing) : null;

  if (arc) {
    const mDates = Object.values(arc.assignments)
      .flatMap((byDay) => Object.keys(byDay))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort();
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            ← Retour
          </button>
          <h2 className="text-base font-semibold text-slate-800">{arc.label} — validé le {arc.validatedAt?.split("-").reverse().join("/")}</h2>
        </div>
        <Card title={`Planning archivé — ${arc.label}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Agent</th>
                  {mDates.map((dk) => {
                    const d = parseDate(dk);
                    return (
                      <th key={dk} className="border-b border-slate-200 px-1 py-2 text-center font-medium text-slate-500">
                        <div>{WD_SHORT[d.getDay()]}</div>
                        <div className="text-slate-400">{String(d.getDate()).padStart(2,"0")}/{String(d.getMonth()+1).padStart(2,"0")}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white border-b border-slate-100 px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">{a.name}</td>
                    {mDates.map((dk) => {
                      const c = arc.assignments[a.id]?.[dk];
                      const sh = c ? ALL[normalizeType(c.type)] : null;
                      return (
                        <td key={dk} className="border-b border-slate-100 px-0.5 py-1 text-center">
                          {sh ? (
                            <span className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: sh.color }}>
                              {c.type}
                            </span>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card title="Historique des plannings" subtitle="Plannings validés mois par mois.">
        {sorted.length === 0 && (
          <p className="text-sm text-slate-400">Aucun planning validé. Allez dans l'onglet Planning et cliquez « Valider [mois] ».</p>
        )}
        <div className="space-y-2">
          {sorted.map((arc) => (
            <div key={arc.monthKey} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Archive size={15} className="text-brand" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{arc.label}</p>
                  <p className="text-xs text-slate-400">Validé le {arc.validatedAt?.split("-").reverse().join("/")}</p>
                </div>
              </div>
              <button onClick={() => setViewing(arc.monthKey)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Voir
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Commit**
```bash
git add planning-equipe.jsx
git commit -m "feat(historique): onglet Historique admin avec vue planning archivé"
```

---

### Task 5 : Section "Plannings passés" dans UserApp

**Files:**
- Modify: `planning-equipe.jsx:2437` (signature UserApp, ajouter `archivedMonths`)
- Modify: `planning-equipe.jsx:845` (appel UserApp dans App, passer `archivedMonths`)
- Modify: `planning-equipe.jsx:2503` (return UserApp, ajouter section en bas)

- [ ] **Mettre à jour la signature de `UserApp` (~ligne 2437)**

Remplacer :
```jsx
function UserApp({ session, agents, dates, assignments, currentMonth, monthLabel, requests, submitRequest, happenings }) {
```
Par :
```jsx
function UserApp({ session, agents, dates, assignments, currentMonth, monthLabel, requests, submitRequest, happenings, archivedMonths }) {
```

- [ ] **Passer `archivedMonths` dans l'appel UserApp (~ligne 845)**

Remplacer :
```jsx
<UserApp {...{ session, agents, dates, assignments, currentMonth, monthLabel, requests, submitRequest, happenings }} />
```
Par :
```jsx
<UserApp {...{ session, agents, dates, assignments, currentMonth, monthLabel, requests, submitRequest, happenings, archivedMonths }} />
```

- [ ] **Ajouter l'état local `expandedArcDay` et la section "Plannings passés" dans UserApp**

Ajouter après `const [expandedDay, setExpandedDay] = useState(null);` (~ligne 2443) :
```jsx
const [expandedArcDay, setExpandedArcDay] = useState(null);
```

Puis ajouter juste avant `</div>` final du return de UserApp (~ligne 2722) :

```jsx
{/* Plannings passés */}
{(() => {
  const pastArcs = (archivedMonths || [])
    .filter((a) => a.monthKey < currentMonth)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  if (pastArcs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-700">Plannings passés</h2>
      {pastArcs.map((arc) => {
        const arcAgents = agents.filter((a) => arc.assignments[a.id]);
        const allDayKeys = [...new Set(
          arcAgents.flatMap((a) => Object.keys(arc.assignments[a.id] || {}))
        )].sort();

        // Regroupement par semaine
        const wkMap = new Map();
        allDayKeys.forEach((dk) => {
          const d = parseDate(dk);
          const wk = mondayKey(d);
          if (!wkMap.has(wk)) wkMap.set(wk, []);
          wkMap.get(wk).push(dk);
        });
        const weeks = [...wkMap.entries()].map(([wk, days], i) => ({ wk, days, label: `Semaine ${i + 1}` }));

        return (
          <details key={arc.monthKey} className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50 list-none">
              <Archive size={15} className="text-brand flex-none" />
              <span className="flex-1 text-sm font-semibold text-slate-800">{arc.label}</span>
              <span className="text-xs text-slate-400">Validé le {arc.validatedAt?.split("-").reverse().join("/")}</span>
              <ChevronRight size={15} className="text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {weeks.map(({ wk, days, label }) => (
                <div key={wk} className="px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <div className="space-y-1">
                    {days.map((dk) => {
                      const d = parseDate(dk);
                      const myCell = me ? arc.assignments[me.id]?.[dk] : null;
                      const mySh = myCell ? ALL[normalizeType(myCell.type)] : null;
                      const isExpanded = expandedArcDay === (arc.monthKey + dk);

                      const allOnDay = arcAgents.map((a) => {
                        const c = arc.assignments[a.id]?.[dk];
                        const sh = c ? ALL[normalizeType(c.type)] : null;
                        return { agent: a, cell: c, sh };
                      }).filter((x) => x.cell && x.cell.type !== "R");

                      return (
                        <div key={dk}>
                          <button
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 ${isExpanded ? "bg-slate-50" : ""}`}
                            onClick={() => setExpandedArcDay(isExpanded ? null : arc.monthKey + dk)}
                          >
                            <div className="w-24 flex-none">
                              <span className="text-sm font-medium text-slate-800">{WD_FULL[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}</span>
                            </div>
                            {mySh ? (
                              <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: mySh.color }}>
                                {myCell.type}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                            <span className="ml-auto text-xs text-slate-400">{allOnDay.length} pers. <ChevronRight size={12} className={`inline transition-transform ${isExpanded ? "rotate-90" : ""}`} /></span>
                          </button>
                          {isExpanded && (
                            <div className="mx-2 mb-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                              <div className="flex flex-wrap gap-2">
                                {allOnDay.map(({ agent, cell, sh }) => (
                                  <div key={agent.id} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${me && agent.id === me.id ? "ring-2 ring-brand/40 bg-brand/5" : "bg-white border border-slate-100"}`}>
                                    <span className="font-medium text-slate-700">{agent.name}</span>
                                    {sh && <span className="rounded px-1 py-0.5 text-[10px] font-bold text-white" style={{ background: sh.color }}>{cell.type}</span>}
                                    <RoleMark role={agent.role} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
})()}
```

- [ ] **Commit**
```bash
git add planning-equipe.jsx
git commit -m "feat(historique): section Plannings passés dans UserApp"
```

---

### Task 6 : Build + déploiement GitHub

- [ ] **Build de production**
```bash
npx vite build
```
Attendu : build OK sans erreurs

- [ ] **Commit du dist + push main**
```bash
git add dist/ && git commit -m "build: historique plannings validés"
git push origin main
```

- [ ] **Déploiement gh-pages** (via répertoire temporaire)
```bash
SCRATCH="C:/Users/alexi/AppData/Local/Temp/claude/gh-pages-staging"
rm -rf "$SCRATCH" && mkdir -p "$SCRATCH" && cd "$SCRATCH"
git init
cp ".../dist/index.html" .
cp -r ".../dist/assets" .
cp ".../dist/handiplage.jpg" .
git add -A && git commit -m "Deploy: historique plannings"
git remote add origin "https://github.com/alexooosss/Planning-Handiplage.git"
git push origin HEAD:gh-pages --force
cd / && rm -rf "$SCRATCH"
```
