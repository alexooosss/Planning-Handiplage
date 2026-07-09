# Persistance Supabase — Design

**Date :** 2026-07-09
**Scope :** `planning-equipe.jsx`, `vite.config.js`, `.env.local`, nouveau fichier `src/supabase.js`

---

## Objectif

Remplacer l'état éphémère (perdu au rechargement) par une persistance cross-device via Supabase. L'état complet de l'app est stocké dans une colonne JSONB unique. Aucune logique métier n'est modifiée.

---

## Schéma Supabase

```sql
create table planning_state (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- RLS : lecture/écriture publique (auth gérée côté app)
alter table planning_state enable row level security;
create policy "allow all" on planning_state for all using (true) with check (true);
```

`id` = `"handiplage-antibes"` pour cette instance. Futur multi-tenant : une ligne par plage.

---

## Variables d'environnement

Fichier `.env.local` (non commité) :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PLANNING_ID=handiplage-antibes
```

`.env.local` ajouté au `.gitignore`.

---

## Client Supabase

Nouveau fichier `src/supabase.js` :
```js
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
export const PLANNING_ID = import.meta.env.VITE_PLANNING_ID || "handiplage-antibes";
```

---

## Chargement au démarrage

Dans `App`, remplacer l'état vide par un `useEffect` qui charge la ligne Supabase au montage :

```js
const [dbReady, setDbReady] = useState(false);

useEffect(() => {
  supabase.from("planning_state").select("data").eq("id", PLANNING_ID).single()
    .then(({ data }) => {
      if (data?.data) restoreState(data.data);
      setDbReady(true);
    })
    .catch(() => setDbReady(true)); // fallback : état vide
}, []);
```

`restoreState(d)` applique tous les setters existants (même logique que `importJSON`).

Tant que `dbReady === false` → afficher un écran de chargement (spinner + "Chargement du planning…").

---

## Auto-save debouncé

```js
const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"

const stateSnapshot = useMemo(() => ({
  seasonOpen, seasonClose, monthTeams, minEffectif, minHalf,
  events, assignments, accounts, requests, happenings, archivedMonths
}), [seasonOpen, seasonClose, monthTeams, minEffectif, minHalf,
     events, assignments, accounts, requests, happenings, archivedMonths]);

useEffect(() => {
  if (!dbReady) return;
  setSaveStatus("saving");
  const t = setTimeout(async () => {
    const { error } = await supabase.from("planning_state").upsert({
      id: PLANNING_ID,
      data: stateSnapshot,
      updated_at: new Date().toISOString()
    });
    setSaveStatus(error ? "error" : "saved");
  }, 2500);
  return () => clearTimeout(t);
}, [stateSnapshot, dbReady]);
```

---

## Indicateur dans le header

Dans le header, à gauche des boutons Importer/Sauvegarder :

- ⟳ "Sauvegarde…" (gris, animé) quand `saveStatus === "saving"`
- ✓ "Sauvegardé" (vert) quand `saveStatus === "saved"`
- ⚠ "Erreur sync" (orange) quand `saveStatus === "error"`

Disparaît après 3s pour `"saved"`.

---

## Export JSON conservé

Le bouton "Sauvegarder" existant reste en place comme **export local de secours**. Il ne change pas.

---

## Déploiement

GitHub Pages ne supporte pas les variables d'env serveur. Les variables `VITE_*` sont injectées au moment du build par Vite.

Pour le déploiement :
- En local : `.env.local`
- Sur GitHub Pages : utiliser **GitHub Actions** avec des secrets pour injecter les variables au build, OU builder localement et pousser le `dist/` manuellement (méthode actuelle).

La méthode actuelle (build local + push dist) est conservée — les variables sont dans `.env.local` et injectées au build.

---

## Contraintes

- La clé `anon` Supabase sera visible dans le bundle JS — acceptable pour cet usage (outil interne, données non sensibles, RLS en place)
- Si Supabase est indisponible au chargement → l'app démarre avec un état vide (comportement actuel) — prévoir un message d'avertissement
- `.env.local` ne doit jamais être commité
