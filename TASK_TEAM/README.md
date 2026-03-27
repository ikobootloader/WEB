# NEXUS MDA (TaskMDA Team)

Application web locale de pilotage projets/taches, utilisable en mode solo et collaboratif, sans serveur.
Nom d interface par defaut: `NEXUS MDA`.

## Acces rapide

1. Ouvrir [`taskmda-team.html`](./taskmda-team.html) dans Chrome ou Edge.
2. Deverrouiller (ou creer) le mot de passe local.
3. Optionnel: lier un dossier partage pour la synchronisation collaborative.

## Etat actuel

- Architecture front locale, multi fichiers:
  - `taskmda-team.html`
  - `taskmda-team.css`
  - `taskmda-team.js`
  - `taskmda-editor.js` (module editeur projet: Quill, media, emoji, formatage)
  - `taskmda-crypto.js`
  - `taskmda-ui.js`
  - `taskmda-theme.js`
  - `taskmda-notifications.js`
  - `taskmda-tasks.js`
  - `taskmda-social.js` (templates UI messagerie/fil d info)
- Persistance: IndexedDB (event sourcing + etat local projete).
- Synchronisation: dossier partage (File System Access API), sans backend.
  - Le dossier lie est memorise (IndexedDB) et tente une reconnexion automatique au demarrage si permission valide.
  - Au rechargement collaboratif, l application ne conserve que les projets accessibles (membre assigne ou lecture publique).
- Chiffrement local + verrouillage via `taskmda-crypto.js`.

## Fonctionnalites principales

### Projets
- Creation solo/collaboratif.
- Edition/suppression.
- Vues: liste, kanban, timeline/calendrier, documents, discussion, activite.
- Editeur de description riche:
  - styles de titres `H1/H2/H3`,
  - insertion d images,
  - redimensionnement visuel direct sur image (icone en surcouche + slider).

### Taches
- CRUD complet en projet.
- Sous taches avec progression.
- Taches hors projet (solo ou collaboratif).
- Pagination projets et taches.
- Rubrique transverse `Taches`: vues cartes/liste/kanban/timeline + onglet `Calendrier`.

### Vues transverses
- `Taches`: consolidation tous projets + hors projet.
- `Calendrier`: vue liste + vue calendrier mensuelle.
- `Documents`: consolidation et ajout hors projet par thematique.
- `Fil d info`: micro-posts transverses type fil social interne.
  - mentions d agents (`@handle` ou `@[Nom Prenom]`),
  - notifications automatiques des agents mentionnes,
  - references cliquables vers projet, tache ou info calendrier.
- `Referentiels`: administration globale des thematiques, groupes et registre versions logicielles.
- Correctif UX/CSS: isolation stricte des sections transverses (plus de melange visuel Taches/Calendrier).

### Ergonomie documents
- Versement documents projet:
  - zone de depot visuelle (drag & drop),
  - selection de fichiers centralisee,
  - resume des fichiers selectionnes,
  - action principale `Ajouter document(s)` clairement separee.
- Association document -> taches projet:
  - liste multi selection avec clic pour selection/deselection,
  - boutons `Tout selectionner` / `Tout deselectionner`,
  - texte d aide explicite sur la zone.
- Drag & drop de fichiers active sur toutes les zones de versement:
  - documents projet,
  - documents hors projet,
  - pieces jointes de message,
  - pieces jointes de tache.

### Collaboration
- Membres, invitations utilisateurs/agents.
- Groupes metier et groupes utilisateurs.
- Thematiques reutilisables.
- Groupes globaux reutilisables avec association de membres.
- Association de groupes globaux lors de la creation/modification de projet.
- RBAC local owner/manager/member.
- Rôle global `Admin application` pour le parametrage d identite (nom + descriptif dans le header).

### Communication
- Notifications internes (centre cloche).
- Messagerie directe hors projet entre agents connus.
- Emails preformates via `mailto:` (projet, tache, invitation, cloture).

## Base de donnees

- DB: `taskmda-team-standalone`
- Version schema: `DB_VERSION = 11`
- Stores:
  - `events`
  - `processedEvents`
  - `snapshots`
  - `localState`
  - `users`
  - `sharedKeys`
  - `globalTasks`
  - `globalDocs`
  - `globalCalendarItems`
  - `globalMessages`
  - `globalPosts`
  - `globalThemes`
  - `globalGroups`
  - `softwareVersions`
  - `directoryUsers`
  - `appSettings`

## Synchronisation collaborative

- Donnees synchronisees via dossier partage (`projects/<projectId>/events/*.json`).
- Cle partagee projet:
  - stockee localement dans `sharedKeys` (IndexedDB),
  - ecrite aussi dans `projects/<projectId>/shared-key.json` pour faciliter la restauration locale.
- Ecriture collaborative non bloquante:
  - enregistrement local immediat (IndexedDB),
  - replication dossier partage en arriere-plan via file asynchrone + retries.
- Indicateur discret de synchro de fond dans le header (`bg-sync-indicator`):
  - en attente,
  - en cours,
  - erreur de synchro.

## Hardening recent

- Reduction des logs runtime: `console.log` passe par debug gate.
  - Activer: `localStorage.setItem('taskmda_debug','1')`
- Decoupage modulaire progressif:
  - Editeur projet (Quill): `taskmda-editor.js`
  - Orchestration app/synchronisation: `taskmda-team.js`
  - UI: `taskmda-ui.js`
  - Theme: `taskmda-theme.js`
  - Notifications: `taskmda-notifications.js`
  - Taches: `taskmda-tasks.js`
- Checklist de non regression: `QA_REGRESSION_CHECKLIST.md`.

## QA recommandee

- Navigation: dashboard, projets, taches, calendrier, documents.
- Navigation: dashboard, projets, taches, calendrier, documents, referentiels.
- CRUD: projet, tache projet/hors projet, document hors projet, info calendrier.
- Collaboration: membres, invitations, groupes projet/globaux, thematiques, permissions.
- Communication: notifications + generation des mails.
- Responsive: mobile/tablette/desktop.
- Persistance: refresh, fermeture/reouverture, coherence IndexedDB.

## Limites connues

- Pas de SMTP natif (emails via client local avec `mailto:`).
- Pas d authentification centralisee (application locale).
- Fonctionnement collaboratif lie au dossier partage et aux permissions du poste.

## Fichiers utiles

- `QUICKSTART.md`: prise en main rapide.
- `CHANGELOG.md`: historique des evolutions.
- `QA_REGRESSION_CHECKLIST.md`: controle fonctionnel minimal.
