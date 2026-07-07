# Prompt — Refonte complète du site de l'Association LEILA

Refonds entièrement le site https://nadem93.github.io/Site-LEILA/ (repo GitHub `nadem93/Site-LEILA`) avec le design ci-dessous. Conserve tout le contenu existant (textes, pages, système d'admin `admin.html` + `js/db.js`), mais réécris intégralement le HTML/CSS. Site statique, HTML/CSS/JS vanilla, hébergé sur GitHub Pages.

## Direction artistique : « Cinématique immersif »

**Ambiance** : sombre, élégante, chaleureuse. Le visiteur doit vivre une expérience cinématographique dès l'arrivée.

**Palette**
- Fond principal : `#0E0C09` (noir chaud)
- Fond secondaire / cartes au survol : `#1A1610`
- Texte principal : `#F5EFE3` (crème)
- Texte secondaire : `#CFC5B0` / `#9A8F79`
- Accent unique : or `#C8963E` (boutons, liens, numéros, filets, badge)
- Filets/bordures : `rgba(200,150,62,0.25–0.35)`

**Typographie** (Google Fonts)
- Titres : `Archivo` 800, majuscules pour les gros titres, letter-spacing large sur les petits labels (3–4px)
- Corps : `Public Sans` 400, 17–18px, line-height 1.6
- Logo : « LEILA » en Archivo 800, letter-spacing 4px

**Composants clés**
- **Hero plein écran** : photo plein cadre avec zoom lent infini (effet Ken Burns, `scale(1)→scale(1.14)` sur 18s, alternate), voile en dégradé sombre haut/bas, gros titre sur 2 lignes, sous-titre, 2 boutons pilule (or plein + contour crème)
- **Badge circulaire rotatif** « 60 ANS D'ACCUEIL » (rotation 360° en 22s, bordure or)
- **Bandeau défilant (marquee)** entre deux filets or : noms des établissements séparés par ✦, défilement infini
- **Grille des 4 établissements** : cartes numérotées 01–04 (numéro or, petit, letter-spacing 3px), séparées par filets or fins, fond qui s'éclaircit au survol
- **Boutons** : pilules, transition `translateY(-3px)` au survol
- **Navigation** : fixe, transparente sur le hero puis fond `#0E0C09` au scroll ; liens en majuscules 14px letter-spacing 1px ; bouton « CANDIDATER » contour or qui se remplit au survol

**Animations**
- Entrées en cascade au chargement : fadeUp (opacity 0 + translateY(28px) → 0), délais échelonnés de 0,2s
- **Animations au scroll** sur toutes les pages : chaque section apparaît en fadeUp quand elle entre dans le viewport (IntersectionObserver, `prefers-reduced-motion` respecté)
- Micro-interactions au survol partout (cartes, liens avec soulignement or animé)

## Pages à refondre (toutes)

index, presentation, equipe, activites, actualites, agenda, admission, candidater, contact, documents, accompagnement, vie-sociale, partenaires, accessibilite, mentions-legales, page.html, et les 4 pages établissements (foyer-accueil, savs-accueil, saj-accueil, emp-accueil).

- Chaque page établissement : hero photo cinématique + numéro or (01–04) + sections animées au scroll
- Formulaires (contact, candidater, admission) : champs sur fond `#1A1610`, bordure or au focus, labels crème
- Footer commun : fond noir, 4 colonnes, filet or supérieur, mentions légales

## Contraintes

- Un seul fichier `css/style.css` partagé + variables CSS (`--bg`, `--gold`, `--cream`…)
- Responsive complet (mobile : menu burger plein écran sombre, titres réduits)
- Accessibilité : contrastes AA sur fond sombre, focus visibles (contour or), `prefers-reduced-motion` désactive Ken Burns et marquee, alt sur toutes les images
- Ne casse pas `admin.html` ni les scripts `js/` existants (branding.js, db.js…) — adapte leurs styles injectés à la nouvelle palette
- Performance : lazy-loading des images, pas de librairie JS externe
