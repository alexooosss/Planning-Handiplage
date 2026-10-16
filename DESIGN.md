# Design

Système visuel du site Planning Handiplage. Les valeurs de référence vivent dans `src/theme-palette.css` (palette et surcharges) au-dessus de `src/styles.css` et `src/styles-v2.css`.

## Visual Theme

Clair par défaut : « papier craie » chaud, encre marine nuit, un seul bleu électrique pour l'action. Utilisé dehors, sous forte lumière, et au bureau. Un thème sombre marine existe dans le profil. Stratégie de couleur **restreinte** pour l'interface (neutres teintés + bleu ≤ 10 %), **palette complète** uniquement pour coder les horaires et les états.

## Color Palette

Palette de marque (Adobe Color) :

| Rôle | Nom | Valeur | Usage |
|---|---|---|---|
| Papier | Craie | `#F3F2F1` | fond de page (`--paper`) |
| Encre | Marine nuit | `#051433` | texte (`--ink`), menu latéral, en-tête agent |
| Action | Bleu électrique | `#181CEF` | boutons principaux, sélection, onglet actif (`--brand`, `--electric`) |
| Repère | Sable | `#BCB08A` | « à traiter », heures sup (`--magenta`, texte `--sand-ink` `#5E5434`) |

Neutres : `--surface #FBFAF9`, `--sunk #E9E7E4`, `--line #DEDBD6`, `--line-strong #C3BFB8`, `--ink-2 #2E3A57`, `--ink-3 #5D6680`.

États (réservés, jamais décoratifs) : danger `#C2311F` / `#F8E1DC`, alerte `#8A5A00` / `#F5EAD0`, OK `#1E7A5C` / `#DCEFE7`.

Horaires (cases du planning) :

| Code | Sens | Fond | Texte |
|---|---|---|---|
| M | Matin 7h20–13h10 | `#F4B740` ambre | `#2B1D00` |
| AM | Après-midi 13h10–19h00 | `#3438F2` bleu | `#FFFFFF` |
| CP | Coupé 7h20–19h00 | `#17967A` vert du logo | `#FFFFFF` |
| AD | Administratif 8h30–17h00 | `#051433` marine | `#E2D7B0` |
| R | Repos hebdo | `#E4E2DE` | `#6B7285` |
| RC | Récup heures | `#C3C7D4` | `#1E2A4A` |
| IN | Indisponible | `#6B7285` | `#FFFFFF` |

Marques sur les cases : `v` veille de repos et `l` lendemain de repos (petites étiquettes), pastille `HS` ambre pour les heures sup, cadre marine pour un coupé de compensation.

Couverture (personnes présentes) : 4 rouge clair, 5 vert clair, 6 émeraude, 7 et plus vert foncé ; sous le seuil en rouge plein.

## Typography

- Texte : **Atkinson Hyperlegible Next** (400–800), repli Segoe UI / system-ui.
- Chiffres, heures, identifiants : **Atkinson Hyperlegible Mono** (400, 600).
- Titres de page 28–32 px gras serré (25 px sur téléphone) ; corps 14–15 px ; étiquettes de colonnes 11–12 px en capitales espacées.
- Champs en 16 px sur téléphone.

## Layout

- Ordinateur : menu latéral marine (logo, groupes Préparer / Contrôler / Communiquer / Gérer / Données), barre du haut avec les mois de la saison et l'action du mois, contenu en panneaux.
- Téléphone (≤ 860 px) : en-tête compact (logo, état, action, mois défilants), barre d'onglets en bas (Planning, Équipe, Demandes, Heures, Plus), panneau « Plus » en feuille du bas, tableaux transformés en fiches empilées, une seule colonne.
- Rayons : 6 / 10 / 14 px (cases, champs, panneaux) ; feuilles du bas 22 px.
- Ombre de pop-up : `0 2px 4px rgb(5 20 51 / .06), 0 18px 44px -14px rgb(5 20 51 / .32)`.

## Components

- **Boutons** : principal bleu électrique plein ; fantôme bordé ; discret sans fond ; `btn-sm` 40 px min. sur téléphone.
- **Pastilles d'état** (`chip ok / warn / danger / magenta / neutral`) : fond doux + texte foncé de la même famille.
- **Case d'horaire** (`Shift`) : rectangle arrondi avec le code en gras, toujours lisible sans la couleur.
- **Bandeau « À traiter »** (`todo-item`) : pastilles cliquables en tête du planning, vert si tout va bien, rouge si sous-effectif.
- **Inspecteur** : panneau superposé à droite (ordinateur) ou feuille du bas (téléphone), fermeture par croix ou Échap.
- **Toast** marine en bas avec « Annuler » ; bandeau de conflit rouge si les données ont changé ailleurs.

## Motion

Discrète : apparitions 160–240 ms, courbe ease-out exponentielle (`cubic-bezier(0.22, 1, 0.36, 1)`), feuilles qui montent du bas. Aucun rebond. Tout est coupé avec `prefers-reduced-motion`.

## Print

Feuille du mois A4 paysage, affiche hebdomadaire heure par heure (3 semaines), planches de badges A4 avec fond perdu et traits de coupe, fiches d'identifiants (logo à gauche, informations à droite).
