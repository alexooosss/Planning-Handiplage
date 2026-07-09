# Historique des plannings validés

**Date :** 2026-06-25
**Scope :** `planning-equipe.jsx` — feature autonome, aucun fichier externe créé

---

## Objectif

Permettre à l'admin de valider un planning mois par mois pour créer un historique officiel. L'archive se met à jour automatiquement quand une permutation est approuvée. Les utilisateurs peuvent consulter les plannings passés dans leur intégralité.

---

## Structure des données

Nouvel état `archivedMonths` — tableau d'objets :

```js
{
  monthKey: "2026-06",       // YYYY-MM
  label: "Juin 2026",
  validatedAt: "2026-06-15", // date ISO du snapshot
  assignments: { ... }       // copie des assignments filtrés à ce mois
}
```

- Initialisé à `[]`
- Inclus dans `exportJSON` et `importJSON` (même logique que `happenings`)
- Un mois = une entrée max. Valider un mois déjà archivé remplace le snapshot (avec confirmation)
- Quand `decideRequest` approuve une permutation sur un jour J, si le mois de J est dans `archivedMonths`, le snapshot est mis à jour avec le même changement

---

## Interface Admin

### Bouton "Valider ce mois" — onglet Planning

- Affiché en haut du mois actif, à côté du bouton "Générer"
- Si le mois est déjà archivé : badge vert "✓ Validé le JJ/MM" à la place du bouton
- Clic → `window.confirm("Valider [label] ? Cette version sera archivée.")` → crée le snapshot

### Onglet "Historique"

- Nouvel onglet dans le panneau admin, après "Événements"
- Icône : `Archive` (lucide-react)
- Liste des mois validés, triée du plus récent au plus ancien
- Chaque entrée : label du mois + date de validation + bouton "Voir"
- "Voir" ouvre le planning archivé de ce mois en lecture seule — même rendu que l'onglet Planning courant (grille par agent, shifts colorés) mais non éditable

---

## Interface Utilisateur

Section **"Plannings passés"** ajoutée dans `UserApp`, sous le planning en cours.

- Visible uniquement si `archivedMonths` contient au moins un mois antérieur au mois courant
- Liste des mois validés passés, du plus récent au plus ancien
- Chaque mois : accordéon cliquable "Juin 2026 — validé le 15/06"
- Déplié : planning complet de l'équipe pour ce mois
  - Même format que le planning actif (semaines groupées, badges horaires par shift)
  - Les shifts de l'utilisateur connecté sont mis en évidence (fond légèrement coloré)
  - Clic sur un jour → liste de toute l'équipe : "Avec moi" / "Autre demi-journée"

---

## Logique de mise à jour automatique (permutations)

Dans `decideRequest`, quand `approve === true` et que le type est un échange de shifts :

```js
const dayKey = req.date; // YYYY-MM-DD
const mKey = dayKey.slice(0, 7); // YYYY-MM
const archived = archivedMonths.find(a => a.monthKey === mKey);
if (archived) {
  // appliquer le même swap dans archived.assignments
  setArchivedMonths(prev => prev.map(a =>
    a.monthKey === mKey
      ? { ...a, assignments: updatedAssignmentsForMonth }
      : a
  ));
}
```

---

## Contraintes

- Pas de backend — tout en mémoire React, persisté via export/import JSON
- L'archive est perdue si l'admin oublie d'exporter (comportement identique au reste de l'app)
- Lecture seule dans l'historique — aucune édition directe de l'archive
