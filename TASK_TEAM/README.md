# TaskMDA Team

Application web locale de pilotage projets/taches, utilisable en mode solo et collaboratif, sans serveur.

## Acces rapide

1. Ouvrir [`taskmda-team.html`](./taskmda-team.html) dans Chrome ou Edge.
2. Deverrouiller (ou creer) le mot de passe local.
3. Optionnel: lier un dossier partage pour la synchronisation collaborative.

## Etat actuel

- Architecture front locale, multi fichiers:
  - `taskmda-team.html`
  - `taskmda-team.css`
  - `taskmda-team.js`
  - `taskmda-crypto.js`
  - `taskmda-ui.js`
  - `taskmda-theme.js`
  - `taskmda-notifications.js`
  - `taskmda-tasks.js`
- Persistance: IndexedDB (event sourcing + etat local projete).
- Synchronisation: dossier partage (File System Access API), sans backend.
  - Le dossier lie est memorise (IndexedDB) et tente une reconnexion automatique au demarrage si permission valide.
- Chiffrement local + verrouillage via `taskmda-crypto.js`.

## Fonctionnalites principales

### Projets
- Creation solo/collaboratif.
- Edition/suppression.
- Vues: liste, kanban, timeline/calendrier, documents, discussion, activite.

### Taches
- CRUD complet en projet.
- Sous taches avec progression.
- Taches hors projet (solo ou collaboratif).
- Pagination projets et taches.

### Vues transverses
- `Taches`: consolidation tous projets + hors projet.
- `Calendrier`: vue liste + vue calendrier mensuelle.
- `Documents`: consolidation et ajout hors projet par thematique.
- `Referentiels`: administration globale des thematiques et groupes.

### Collaboration
- Membres, invitations utilisateurs/agents.
- Groupes metier et groupes utilisateurs.
- Thematiques reutilisables.
- Groupes globaux reutilisables avec association de membres.
- Association de groupes globaux lors de la creation/modification de projet.
- RBAC local owner/manager/member.

### Communication
- Notifications internes (centre cloche).
- Emails preformates via `mailto:` (projet, tache, invitation, cloture).

## Base de donnees

- DB: `taskmda-team-standalone`
- Version schema: `DB_VERSION = 7`
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
  - `globalThemes`
  - `globalGroups`
  - `directoryUsers`

## Hardening recent

- Reduction des logs runtime: `console.log` passe par debug gate.
  - Activer: `localStorage.setItem('taskmda_debug','1')`
- Decoupage modulaire progressif:
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
