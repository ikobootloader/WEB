# NEXUS MDA (TaskMDA Team)

Application web locale de pilotage projets/taches, utilisable en mode solo et collaboratif, sans serveur.
Nom d interface par defaut: `NEXUS MDA`.

## Acces rapide

1. Ouvrir [`taskmda-team.html`](./taskmda-team.html) dans Chrome ou Edge.
2. Deverrouiller (ou creer) le mot de passe local.
3. Optionnel: lier un dossier partage pour la synchronisation collaborative.

## Mises a jour recentes (Avril 2026)

- Nouvelle rubrique `Notes` (transverse + privee):
  - ajout d une section dediee `Notes` dans la navigation globale,
  - creation/edition en modale confortable (editeur riche Quill/fallback),
  - filtres combines (portee, onglets rapides, tri, recherche, dont `Favoris d'abord`),
  - onglet `Favoris`, export direct d une note (HTML), pagination de la liste,
  - selection multiple + suppression en masse des notes,
  - export multi-notes en `ZIP HTML` et `ZIP TXT` (local, sans serveur/npm),
  - notes privees (auteur) vs notes transverses (visibles equipe),
  - publication optionnelle d une note dans le `Fil d info` (reference cliquable retour vers la note).
- Documents (lot technique 1):
  - ajout du module `js/taskmda-document-storage.js` (stockage fichier decouple de l orchestrateur principal),
  - stockage par defaut sur disque partage quand le dossier est connecte (avec fallback local `data:`),
  - structure de chemin horodatee et classee par rubrique/scope/projet/thematique,
  - apercu/telechargement/edition compatibles avec chargement a la demande depuis `storagePath`.
- Rubrique `Projets` harmonisee en panneaux:
  - panneau `project-overview-panel` (resume + actions + filtres),
  - panneau `project-work-panel` (cartes projets / pagination),
  - gestion robuste du mode `Archives` (ouverture/fermeture sans artefacts d affichage au retour depuis le dashboard).
- Barre latérale et en tete:
  - integration visuelle du bloc marque (`NEXUS MDA`) dans la sidebar,
  - sidebar etendue sur toute la verticale de la page.
- Rubrique `Fil d info`:
  - bloc `Nouveau post d information` place au-dessus du flux et replie par defaut.
- Rubrique `Messagerie`:
  - panneau `Agents connus` reductible (toggle),
  - barre de composition ajustee (emoji + envoi), bouton `Envoyer` au style rectangulaire arrondi.
- Rubrique `Workflow`:
  - onglet `KPI` ajoute dans `Pilotage` (cards de synthese + repartitions statut/priorite + charge par agent).
  - vue `Carte`: alignement de la barre `Rechercher une liaison...` + `Tri` sur une meme ligne en desktop, avec repli responsive en mobile.
- Onglet `Plus (x)`:
  - menu complementaire epingle au clic (toggle), plus d ouverture au simple survol.

## Etat actuel

- Architecture front locale, multi fichiers:
  - `taskmda-team.html`
  - `taskmda-team.css`
  - `taskmda-workflow.css`
  - `taskmda-team.js`
  - `taskmda-app-init.js`
  - `taskmda-projects-ui.js`
  - `taskmda-comms-ui.js`
  - `taskmda-admin-ui.js`
  - `taskmda-editor.js` (module editeur projet: Quill, media, emoji, formatage)
  - `taskmda-crypto.js`
  - `taskmda-ui.js`
  - `taskmda-theme.js`
  - `taskmda-notifications.js`
  - `taskmda-recurrence.js` + `taskmda-recurrence-ui.js`
  - `taskmda-tasks.js`
  - `taskmda-social.js` (templates UI messagerie/fil d info)
  - `taskmda-workflow.js` + `taskmda-workflow-store.js` + `taskmda-workflow-graph.js` + `taskmda-workflow-ui.js`
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
- Taches recurrentes:
  - types `hebdomadaire` / `mensuelle` / `annuelle`,
  - intervalle configurable (`tous les N`),
  - fin `infinie` / `nombre d occurrences` / `jusqu a une date`.
- Taches hors projet (solo ou collaboratif).
- Archivage/restauration des taches (projet et hors projet) avec vues `Archives`.
- Conversion d une tache (projet ou hors projet) en nouveau projet.
- Pagination projets et taches.
- Rubrique transverse `Taches`: vues cartes/liste/kanban/timeline + onglet `Calendrier`.
- Effet visuel de completion: au passage d une tache a `termine`, un emoji `pouce leve` s anime sur la carte (envol + estompe), avec declenchement centralise sur les transitions de statut.

### Vues transverses
- `Taches`: consolidation tous projets + hors projet.
- `Calendrier`: vue liste + vue calendrier mensuelle.
- `Documents`: consolidation et ajout hors projet par thematique.
- `Fil d info`: micro-posts transverses type fil social interne.
  - mentions d agents (`@handle` ou `@[Nom Prenom]`),
  - notifications automatiques des agents mentionnes,
  - references cliquables vers projet, tache ou info calendrier,
  - digestion documentaire locale (`.eml/.txt/.md/.html/.pdf/.doc/.docx/.odt/.rtf`) vers post resume.
- Recherche globale dans le header (navigation directe vers projet/tache/document/message/canal).
- `Referentiels`: administration globale des thematiques, groupes et registre versions logicielles.
  - onglet `Annuaire ESMS` dedie a la recherche live PA/PH (lecture seule) via FINESS public, avec ouverture fiche ViaTrajectoire.
  - enrichissement optionnel via endpoint FHIR Annuaire Sante (endpoint + cle API configurables).
  - normalisation endpoint gateway (`/fhir` -> `/fhir/v2`) et garde-fous anti-spam en cas d erreurs HTTP `400/401/403`.
  - bloc de configuration API repliable/depliable (toggle) avec memoire locale de l etat.
  - mode `Audit divergences` FINESS vs FHIR avec badge par ligne, detail au clic et statuts `OK`, `Proche`, `Incomplet`, `Different`.
  - heuristique de proximite semantique pour limiter les faux positifs (casse, accents, complements d adresse).
  - recommandation d adresse enrichie dans l audit avec action `Utiliser l adresse enrichie` quand pertinent.
- `RGPD`: registre de traitements et pilotage conformite:
  - vues `Registre`, `Activites`, `Brouillons detectes`, `Controles`, `Journal`,
  - creation/edition/validation/archivage de fiches,
  - detection semi-automatique depuis les contenus metier,
  - exports JSON/CSV,
  - liaison contextuelle `Impact RGPD` depuis Workflow / Projet / Tache (generer, lier, ouvrir fiche).
- `Workflow`: rubrique transverse dediee a l organisation metier:
  - vues `Carte`, `Organisation`, `Organigramme`, `Agents`, `Processus`, `Modeles de processus`, `Taches`, `Kanban`, `Timeline`, `KPI`, `Procedures`, `Logiciels metiers`, `Contingence`, `Analyse`, `Gouvernance`, `Journal`
  - carte metier: zoom/pan, auto-layout, mini-carte interactive, export PNG et export PDF
  - concepteur de processus: edition par blocs d etapes (ajout rapide, duplication, reordonnancement, reliage automatique des flux)
  - concepteur de flux: mode graphe non-lineaire (branches decision/parallele/exception, branche oui/non, bascule lineaire)
  - visualisation SVG des liaisons et edition inline des flux (source, cible, type, condition, libelle)
  - interaction graphe: clic noeud (source/cible) et clic arete (chargement edition)
  - mode drag-link: creation d un flux par glisser source -> cible sur le graphe
  - multi-selection des flux: mode multi-select, selection Ctrl/Shift/Cmd, suppression groupee, application groupee du type de flux
  - CRUD complet: communautes, services, groupes, agents, roles, processus, etapes, flux, templates, taches, procedures, logiciels
  - liens avances: dependances inter-taches, liaisons inter-services, hierarchie manager/agents
  - modeles de processus: creation depuis processus, instanciation, publication/archivage, versioning, variantes
  - gouvernance processus: validation multi-niveaux, mode sequentiel optionnel, quorum par niveau, exports JSON/CSV
  - echange de donnees workflow: export modele complet JSON + export synthese processus CSV
  - integration referentielle: logiciels metiers relies au suivi global des versions logicielles (lecture, ouverture du registre, synchronisation version)
  - separation des droits: edition/soumission distinctes de la validation, controles d approbation par roles requis
  - alertes proactives de gouvernance (responsable manquant, quorum incomplet, etapes non affectees)
  - analyse avancee: matrices processus x services / processus x logiciels / agents x responsabilites, dependances critiques, listes d anomalies (etapes non affectees, logiciels sans procedure, processus incomplets)
  - injection d un jeu d exemple complet de modelisation organisationnelle (bouton dedie dans la barre Workflow)
  - gestion des plans de contingence: creation, actions, activation avec generation automatique de taches, exercices de test, revues periodiques, dashboard avec alertes, exports PDF/CSV
  - journal/audit + historique des modifications avec restauration de versions
  - export PDF des vues `Organisation` et `Organigramme` + fiches `Processus`, `Service`, `Agent`, `Logiciel`, `Plan de contingence`
  - detail editable + ponts transverses vers taches/documents/themes/groupes globaux
- Correctif UX/CSS: isolation stricte des sections transverses (plus de melange visuel Taches/Calendrier).
- Harmonisation UX globale:
  - mode d affichage parametrable des boutons d action (`icone`, `texte`, `icone + texte`) applique a Workflow / Projets / Taches / Documents / RGPD,
  - infobulles custom harmonisees en mode `icone` sur les boutons d action (sans tooltip natif du navigateur), avec exclusion explicite du sidebar,
  - harmonisation des boutons `Fermer` sur les modales (meme regle de rendu que les boutons d action),
  - fermeture des modales au clic hors fenetre,
  - terminologie metier uniformisee (ex: `Date limite`, `Responsable`, `Visibilite`),
  - edition inline en consultation sur les champs metier (projet, tache, documents, calendrier) avec autosauvegarde asynchrone (debounce + finalisation).
- Personnalisation visuelle:
  - couleur du chrome applicatif (header + sidebar) configurable utilisateur,
  - prise en charge complete des variables de theme en mode clair/sombre (y compris hovers metier).

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
- Editeur documentaire integre:
  - mode texte/HTML/Markdown,
  - mode tableur (`CSV/XLSX`) avec Tabulator + SheetJS,
  - apercu/lecture des formats courants (images, PDF, Office, texte).

### Collaboration
- Membres, invitations utilisateurs/agents.
- Groupes metier et groupes utilisateurs.
- Thematiques reutilisables.
- Groupes globaux reutilisables avec association de membres.
- Association de groupes globaux lors de la creation/modification de projet.
- RBAC local owner/manager/member.
- Role global `Admin application` pour le parametrage d identite (nom + descriptif dans le header).
- Role `manager workflow` (mapping agent -> utilisateur) pour edition Workflow sans droits admin complets.

### Communication
- Notifications internes (centre cloche).
- Messagerie directe hors projet entre agents connus.
- Panneau `Agents connus` reductible (toggle) dans la messagerie.
- Emails preformates via `mailto:` (projet, tache, invitation, cloture).

### Profil, sauvegarde et securite
- Profil utilisateur: nom affiche, email professionnel, photo de profil.
- Export/import des donnees utilisateur en JSON.
- Export `projets + taches` en CSV (compatible tableur).
- Changement de mot de passe local.
- Cle de recuperation: affichage, regeneration et restauration d acces.

## Base de donnees

- DB: `taskmda-team-standalone`
- Version schema: `DB_VERSION = 18`
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
  - `workflowCommunities`
  - `workflowServices`
  - `workflowGroups`
  - `workflowAgents`
  - `workflowTasks`
  - `workflowProcedures`
  - `workflowSoftware`
  - `workflowRoles`
  - `workflowProcesses`
  - `workflowProcessSteps`
  - `workflowFlows`
  - `workflowProcessTemplates`
  - `workflowMetrics`
  - `workflowLayout`
  - `workflowAudit`
  - `workflowHistory`
  - `rgpdActivities`
  - `rgpdAssessments`
  - `rgpdTemplates`
  - `rgpdLinks`
  - `rgpdAudit`
  - `rgpdExports`

## Synchronisation collaborative

- Donnees synchronisees via dossier partage (`projects/<projectId>/events/*.json`).
- Cle partagee projet:
  - stockee localement dans `sharedKeys` (IndexedDB),
  - ecrite aussi dans `projects/<projectId>/shared-key.json` pour faciliter la restauration locale.
- Ecriture collaborative non bloquante:
  - enregistrement local immediat (IndexedDB),
  - replication dossier partage en arriere-plan via file asynchrone + retries.
- Indicateur discret de synchro de fond dans le header (`bg-sync-indicator`):
  - format icone seule pour eviter les sauts de layout,
  - rotation pendant la synchro (etat en cours),
  - etats en attente / en cours / erreur.

## Hardening recent

- Reduction des logs runtime: `console.log` passe par debug gate.
  - Activer: `localStorage.setItem('taskmda_debug','1')`
- Decoupage modulaire progressif:
  - Initialisation applicative: `taskmda-app-init.js`
  - UI Projets: `taskmda-projects-ui.js`
  - UI Communication: `taskmda-comms-ui.js`
  - UI Administration: `taskmda-admin-ui.js`
  - Editeur projet (Quill): `taskmda-editor.js`
  - Orchestration app/synchronisation: `taskmda-team.js`
  - UI: `taskmda-ui.js`
  - Theme: `taskmda-theme.js`
  - Notifications: `taskmda-notifications.js`
  - Taches: `taskmda-tasks.js`
  - Recurrence: `taskmda-recurrence.js` + `taskmda-recurrence-ui.js`
  - Workflow: `taskmda-workflow.js` + `taskmda-workflow-store.js` + `taskmda-workflow-graph.js` + `taskmda-workflow-ui.js`
- Checklist de non regression: `docs/QA_REGRESSION_CHECKLIST.md`.

## QA recommandee

- Navigation: dashboard, projets, taches, calendrier, documents.
- Navigation: dashboard, projets, taches, calendrier, documents, referentiels, workflow.
- CRUD: projet, tache projet/hors projet, document hors projet, info calendrier.
- Recurrence: creation/edition des taches recurrentes et affichage des libelles.
- Workflow: CRUD entites, modeles/variantes, gouvernance/validation, kanban, timeline, journal, historique/restauration.
- Collaboration: membres, invitations, groupes projet/globaux, thematiques, permissions.
- Communication: notifications + generation des mails + fil d info.
- Responsive: mobile/tablette/desktop.
- Persistance: refresh, fermeture/reouverture, coherence IndexedDB.

## Limites connues

- Pas de SMTP natif (emails via client local avec `mailto:`).
- Pas d authentification centralisee (application locale).
- Fonctionnement collaboratif lie au dossier partage et aux permissions du poste.

## Fichiers utiles

- `docs/QUICKSTART.md`: prise en main rapide.
- `CHANGELOG.md`: historique des evolutions.
- `docs/QA_REGRESSION_CHECKLIST.md`: controle fonctionnel minimal.
- `docs/RECURRENCE.md`: details fonctionnels et techniques des taches recurrentes.
