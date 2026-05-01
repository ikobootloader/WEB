# Changelog - TaskMDA Team

## Mise a jour incrementale - Mai 2026 (Scission module calendrier)

- Refactor sans impact fonctionnel:
  - extraction du module `TaskMDAGlobalCalendar` hors du bundle `js/taskmda-global.js`,
  - ajout du fichier dedie `js/taskmda-calendar.js` (domaine calendrier transverse),
  - mise a jour du chargement runtime dans `taskmda-team.html` (script calendrier dedie),
  - `js/taskmda-global.js` conserve les domaines transverses hors calendrier (notes/docs/feed/messages).

## Mise a jour incrementale - Mai 2026 (Amincissement orchestrateur calendrier)

- Refactor sans impact fonctionnel:
  - suppression des wrappers `renderGlobalCalendarThemePins` et `initGlobalCalendarPinnedThemesState` dans `js/taskmda-team.js`,
  - suppression des wrappers `setGlobalCalendarControlsExpanded` et `toggleGlobalCalendarThemeActionsMenu` dans `js/taskmda-team.js`,
  - appels directs au runtime `globalCalendarRuntime` aux points d usage.

## Mise a jour incrementale - Mai 2026 (Passe d amaigrissement rapide orchestrateur)

- Refactor sans impact fonctionnel:
  - suppression des wrappers `renderGlobalCalendarDelegated` et `renderGlobalNotesDelegated` dans `js/taskmda-team.js`,
  - remplacement des appels par execution directe runtime avec fallback (`globalCalendarRuntime` / `globalNotesRuntime`),
  - suppression des wrappers sidebar legacy (ouverture/fermeture mobile + collapse) dans `js/taskmda-team.js`,
  - remplacement des appels locaux par appels directs `shellUiRuntime`.

## Mise a jour incrementale - Mai 2026 (Amincissement wrappers calendrier modale)

- Refactor sans impact fonctionnel:
  - suppression des wrappers orchestrateur `setGlobalCalendarItemFormEditing`, `openGlobalCalendarItemModal`, `closeGlobalCalendarItemModal`, `resetStandaloneCalendarForm`,
  - remplacement des appels internes par appels directs runtime `globalCalendarRuntime` (avec garde optionnelle),
  - conservation de l API `window.openGlobalCalendarItemModal` pour compatibilite des actions HTML existantes.

## Mise a jour incrementale - Mai 2026 (Simplification bindings communication)

- Refactor sans impact fonctionnel:
  - simplification du binding `TaskMDACommsUI` dans `js/taskmda-team.js`,
  - suppression des lambdas de relais `runtime ?? local` pour feed/messages au profit de callbacks directs nommes,
  - reduction du bruit orchestration sur le bloc communication transverse.

## Mise a jour incrementale - Mai 2026 (Vague global-notes: onglets thematiques delegues module)

- Refactor sans impact fonctionnel:
  - extraction du rendu des onglets thematiques des notes globales vers `js/taskmda-global.js` (`TaskMDAGlobalNotesFiltersUI.renderGlobalNotesThemeTabs`),
  - `js/taskmda-team.js` conserve une facade delegante avec fallback local minimal,
  - suppression du helper local dedie `updateGlobalNotesThemesToggleMeta` dans l orchestrateur (logique de badge migree cote module),
  - injection explicite de `normalizeCatalogKey` et `escapeHtml` dans le runtime `globalNotesFiltersUiRuntime`.

## Mise a jour incrementale - Mai 2026 (Vague global-calendar: theme pins delegues module)

- Refactor sans impact fonctionnel:
  - extraction du rendu des thématiques epinglees calendrier vers `js/taskmda-global.js` (`TaskMDAGlobalCalendar.renderGlobalCalendarThemePins`),
  - `js/taskmda-team.js` passe en facade delegante stricte (suppression du fallback local de rendu),
  - injection explicite de `escapeHtml` dans le runtime `globalCalendarRuntime` pour le rendu des options/chips.

## Mise a jour incrementale - Mai 2026 (Vague globale: suppression fallbacks orchestrateur)

- Refactor sans impact fonctionnel:
  - suppression du fallback local de `renderGlobalNotesThemeTabs` dans `js/taskmda-team.js`,
  - suppression du fallback local de `renderGlobalCalendarThemePins` dans `js/taskmda-team.js`,
  - l orchestrateur conserve uniquement des facades minces delegant vers les modules globaux.

## Mise a jour incrementale - Mai 2026 (Vague global-calendar: etat pins internalise module)

- Refactor sans impact fonctionnel:
  - migration de l initialisation des pins calendrier vers `TaskMDAGlobalCalendar.initGlobalCalendarPinnedThemesState`,
  - migration de la normalisation + persistance des pins calendrier vers `TaskMDAGlobalCalendar.syncPinnedCalendarThemeState`,
  - suppression dans `js/taskmda-team.js` de la logique locale associee (cles pinned + read/write array + state init/sync),
  - conservation d une facade orchestrateur minimale pour `initGlobalCalendarPinnedThemesState`.

## Mise a jour incrementale - Mai 2026 (Vague global-calendar: controles UI internalises module)

- Refactor sans impact fonctionnel:
  - migration de `setGlobalCalendarControlsExpanded` vers `TaskMDAGlobalCalendar`,
  - migration de `toggleGlobalCalendarThemeActionsMenu` vers `TaskMDAGlobalCalendar`,
  - suppression dans l orchestrateur de la persistance locale associee (`GLOBAL_CALENDAR_CONTROLS_EXPANDED_KEY`),
  - `js/taskmda-team.js` conserve des facades minces delegant vers le runtime calendrier.

## Mise a jour incrementale - Mai 2026 (Vague annuaire: etat internalise module + orchestrateur aminci)

- Refactor sans impact fonctionnel:
  - suppression complete des wrappers legacy ROR dans `js/taskmda-team.js` (delegation module uniquement).
  - suppression d un bloc supplementaire de facades annuaire mortes dans `js/taskmda-team.js` (audit/live-search wrappers non utilises hors module).
  - internalisation de l etat annuaire (live search, cache departements, flags/settings ROR, caches ROR) dans `js/taskmda-via-annuaire.js` via `initialState` + fallback state API.
  - extraction du rendu panneau settings annuaire et du wiring evenements dans `js/taskmda-via-annuaire.js`.
  - simplification de `syncViaAnnuaireDepartmentsFromApi` cote orchestrateur en fallback minimal.
  - reduction des injections `state/actions` annuaire dans l orchestrateur pour limiter le couplage.

## Mise a jour incrementale - Mai 2026 (Vague feed: rendu carte module, orchestrateur allege)

- Architecture:
  - extension du module metier `js/taskmda-global.js` (namespace `TaskMDAGlobalFeed`).
- Refactor sans impact fonctionnel:
  - extraction de la passe A du rendu feed (chargement/recherche/filtres/tri/scope) vers `TaskMDAGlobalFeed.prepareGlobalFeedRenderScope`.
  - extraction de la resolution des documents lies vers `TaskMDAGlobalFeed.resolveLinkedDocsForFeedPost`.
  - extraction de la passe B du rendu des cartes vers `TaskMDAGlobalFeed.buildGlobalFeedCardsHtml` (cartes manuelles, cartes notes, refs, docs lies, menus export).
  - `js/taskmda-team.js` conserve `renderGlobalFeed` comme facade d orchestration et delegue desormais le rendu des cartes au module feed.
  - suppression du bloc legacy de rendu cartes feed dans `js/taskmda-team.js`.
  - simplification du wrapper orchestrateur `resolveLinkedDocsForFeedPost` (delegation module + garde minimale).
  - renforcement du script de coherence doc/code `scripts/check-doc-coherence.ps1`:
    - verification README + CHANGELOG vs scripts charges par `taskmda-team.html`,
    - mode `-StrictChangelog` pour controle bloquant de la coherence CHANGELOG,
    - mode par defaut: README bloquant, CHANGELOG informatif (historique non bloquant).
  - extraction d utilitaires purs supplementaires vers `js/taskmda-core-utils.js`:
    - `getInitials`,
    - `stringToColor`,
    - `normalizeActionButtonLabel`,
    - `normalizeActionToken`.
  - extraction de normalisations annuaire vers `js/taskmda-core-utils.js`:
    - `normalizeViaAnnuaireLiveDomain`,
    - `normalizeViaAnnuaireDepartmentCode`,
    - `normalizeViaAnnuaireLiveSortKey`.
  - extraction supplementaire d utilitaires annuaire purs vers `js/taskmda-core-utils.js`:
    - `buildViaAnnuaireLiveResultRef`,
    - `sortViaAnnuaireLiveResults`,
    - `buildViaAnnuairePublicFicheUrl`,
    - `normalizeViaAnnuaireComparableText`,
    - `normalizeViaAnnuaireComparablePhone`,
    - `normalizeViaAnnuaireComparableEmail`,
    - `tokenizeViaAnnuaireComparableText`,
    - `computeViaAnnuaireTokenOverlap`,
    - `buildViaAnnuaireRecommendedAddress`,
    - `computeViaAnnuaireDiceSimilarity`,
    - `normalizeViaAnnuaireRorEndpoint`,
    - `normalizeViaAnnuaireRorSettings`.
  - extraction du parsing ROR vers `js/taskmda-core-utils.js`:
    - `extractViaAnnuaireRorEmailFromOrganization`,
    - `extractViaAnnuaireRorEmailFromPayload`,
    - `extractViaAnnuaireRorOrganizationFromPayload`,
    - `extractViaAnnuaireRorTelecomValue`,
    - `extractViaAnnuaireRorOrganizationAddress`,
    - `buildViaAnnuaireRorLookupUrlsFromEndpoint`.
  - nouveau module UI `js/taskmda-via-annuaire.js`:
    - extraction du rendu du panneau annuaire live (`renderViaAnnuaireLiveSearchPanel`),
    - extraction de la lecture des entrées UI (`readViaAnnuaireLiveSearchInputs`),
    - extraction du pipeline de recherche live:
      - `mapViaAnnuaireLiveResultItem`,
      - `filterViaAnnuaireRecordsBySearchInput`,
      - `runViaAnnuaireLiveSearch`,
    - extraction du pipeline audit live:
      - `buildViaAnnuaireAuditField`,
      - `computeViaAnnuaireAuditFromRows`,
      - `runViaAnnuaireAuditForRows`,
      - `toggleViaAnnuaireAuditDetails`,
      - `applyViaAnnuaireAuditRecommendedAddress`,
    - extraction de l enrichissement email ROR des lignes live:
      - `enrichViaAnnuaireRowsWithRorEmail`,
    - orchestration par injection depuis `js/taskmda-team.js` (runtime `TaskMDAViaAnnuaireUI`).
  - `js/taskmda-team.js` reutilise ces utilitaires via wrappers `core-utils`.

## Mise a jour incrementale - Mai 2026 (Regroupement docs bundle)

- Architecture:
  - fusion des modules js/taskmda-doc-storage-binding.js, js/taskmda-doc-preview-inline-ui.js, js/taskmda-doc-preview-modal-ui.js en un bundle unique js/taskmda-doc.js,
  - conservation des namespaces runtime (TaskMDADocStorageBinding, TaskMDADocPreviewInlineUI, TaskMDADocPreviewModalUI).
- Refactor sans impact fonctionnel:
  - mise a jour du chargement HTML vers un seul script documents,
  - suppression des trois anciens fichiers taskmda-doc-*.

## Mise a jour incrementale - Mai 2026 (Vague 2: doc storage binding, wrappers documents projet)

- Architecture:
  - extension du module metier `js/taskmda-doc-storage-binding.js`.
  - ajout du module UI `js/taskmda-doc-preview-inline-ui.js`.
  - ajout du module UI `js/taskmda-doc-preview-modal-ui.js`.
- Refactor sans impact fonctionnel:
  - deplacement des wrappers de lecture de fichiers documents projet dans la facade `doc-storage-binding`:
    - `readProjectDocumentFiles`,
    - `readCreateProjectDocumentFiles`,
    - `readEditProjectDocumentFiles`.
  - extraction de la resolution du contexte d apercu document vers la facade `doc-storage-binding`:
    - source `standalone`,
    - source `project-doc`,
    - source `task-attachment`,
    - hydratation runtime + evaluation des droits d edition.
  - extraction de la persistance inline des metadonnees d apercu document (name/theme/notes/sharingMode) vers `doc-storage-binding`, avec anti-redundance d ecriture et publication des evenements projet.
  - extraction du scheduling inline d apercu document (debounce + finalisation + reset timers) vers `doc-storage-binding`.
  - extraction de la couche UI d edition inline d apercu document vers `doc-preview-inline-ui` (rendu editable + interactions clavier/souris).
  - extraction du noyau modal d apercu document vers `doc-preview-modal-ui` (parsing ref, labels source, format path, rendu metadata).
  - extraction du moteur de rendu du contenu d apercu document vers `doc-preview-modal-ui` (image/pdf/texte/fallback).
  - suppression du rendu duplique dans `taskmda-team.js` pour `openDocumentPreview` (delegation principale vers `doc-preview-modal-ui`, fallback minimal conserve).
  - extraction de la fermeture de l apercu document vers `doc-preview-modal-ui` (fermeture modal, reset contexte, rerender post-fermeture via callback).
  - suppression du fallback local de fermeture/rerender dans `taskmda-team.js` pour `closeDocumentPreview` (delegation complete au module modal, fallback minimal de masquage uniquement).
  - suppression des fallbacks locaux metadata/parsing dans `openDocumentPreview` (delegation directe au module `doc-preview-modal-ui`, garde-fou minimal conserve pour le rendu si module absent).
  - suppression des wrappers residuels `parseDocumentPreviewRef`, `getDocumentPreviewSourceLabel`, `formatDocumentStoragePathForDisplay` dans `taskmda-team.js` (appels directs au module `doc-preview-modal-ui`).
  - demarrage extraction `global-docs` hors orchestrateur:
    - migration dans `TaskMDAGlobalDocs` de `resolveDocumentForBinding`,
    - migration de `deleteGlobalDocument`,
    - migration de `addStandaloneDocuments`,
    - delegation prioritaire de `taskmda-team.js` vers le module (fallback local conserve).
  - extraction de `renderGlobalDocs` vers `TaskMDAGlobalDocs` avec delegation prioritaire de l orchestrateur et garde anti-recursion.
  - suppression du fallback local de rendu documents dans `taskmda-team.js` (delegation complete `renderGlobalDocs` -> module `TaskMDAGlobalDocs`, garde minimale si module absent).
  - suppression des fallbacks locaux de `resolveDocumentForBinding`, `deleteGlobalDocument`, `addStandaloneDocuments` dans `taskmda-team.js` (delegation complete vers `TaskMDAGlobalDocs`, garde minimale si module absent).
  - internalisation dans `TaskMDAGlobalDocs` de l inline-edit binding docs (`initDocumentBindingInlineEditing`) et de la copie chemin (`copyDocumentBindingStoragePath`), avec wrappers orchestrateur reduits a la delegation.
  - suppression des fallbacks locaux des wrappers `initDocumentBindingInlineEditing` et `copyDocumentBindingStoragePath` dans `taskmda-team.js` (delegation complete au module `TaskMDAGlobalDocs`).
  - migration vers `TaskMDAGlobalDocs` du flux preview/docs upload:
    - `openGlobalDocUploadModal`,
    - `closeGlobalDocUploadModal`,
    - `openDocumentPreviewByRef`,
    - `downloadDocumentByRef`,
    - wrappers orchestrateur reduits a la delegation.
  - suppression des fallbacks locaux pour ces wrappers dans `taskmda-team.js` (delegation complete au module `TaskMDAGlobalDocs`).
  - `js/taskmda-team.js` delegue desormais ces flux au domaine `doc-storage-binding` (fallback conserve).
## Mise a jour incrementale - Mai 2026 (Vague 2: lifecycle + document storage binding)

- Architecture:
  - ajout du module metier `js/taskmda-doc-storage-binding.js`,
  - ajout du domaine `doc-storage-binding` dans le registre d orchestration.
- Refactor sans impact fonctionnel:
  - extraction et delegation supplementaire du domaine `Tasks lifecycle`:
    - `saveTaskFromModal`,
    - `closeTaskModalAndReset`,
    - handlers annexes de modale tache,
    - `removeAttachment`,
    - flux modale de conversion tache -> projet (open/close/confirm/Enter).
  - delegation de la logique de stockage documents (read/write fallback, hydration runtime, relocation par theme/scope) vers la facade `doc-storage-binding`.

## Mise a jour incrementale - Mai 2026 (Vague 2: Tasks lifecycle, tranche 1)

- Architecture:
  - ajout du module metier `js/taskmda-task-lifecycle-domain.js`, raccorde par injection de dependances depuis l orchestrateur,
  - ajout du domaine `task-lifecycle-domain` dans le registre d orchestration.
- Refactor sans impact fonctionnel:
  - extraction de l ouverture de modale tache (projet/hors projet + mode edition) hors `js/taskmda-team.js`,
  - extraction des transitions lifecycle: `toggleTaskStatus`, `markProjectTaskDone`, `editTask`, `deleteTask`, `archiveTask`, `toggleSubtask`,
  - `js/taskmda-team.js` delegue desormais ces operations au module domaine pour limiter l entropie et alleger l orchestrateur.

## Mise a jour incrementale - Avril 2026 (Referentiels: Generateur email)

- Referentiels:
  - ajout d un nouvel onglet `Generateur email`,
  - ajout d un module dedie `js/taskmda-email-generator.js` pour eviter de surcharger l orchestrateur principal,
  - templates email parametrables (to/cc/bcc, objet, contenu riche),
  - support de variables dynamiques (`{{app_name}}`, `{{user_name}}`, `{{date}}`, `{{project_name}}`, `{{task_title}}`, `{{status}}`),
  - actions d export pratique: copier HTML, copier texte, ouverture pre-remplie via `mailto:`,
  - persistance locale des templates dans `appSettings` (application locale sans serveur/npm).

## Mise a jour incrementale - Avril 2026 (Fil d info / Notes / Dashboard / Activite / UX cartes)

- Fil d info:
  - ajout d un titre optionnel sur les posts manuels (`global-feed-title`) avec persistance creation/edition,
  - affichage du titre dans les cartes + integration dans la recherche du fil,
  - ajout d un bouton `Lire` (modale de lecture confortable, sans edition),
  - ajout d un menu `Exporter` par post avec formats `HTML`, `PDF`, `DOCX`, `TXT`.
- Notes globales:
  - ajout d un bouton `Lire` sur les cartes de notes pour ouverture en modale de lecture.
- Dashboard:
  - ajustement de la logique `Une`:
    - la Une ne peut provenir que d un post manuel redige par un utilisateur,
    - en absence de post manuel, pas de Une; affichage des infos compactes automatiques uniquement.
- Activite projet:
  - correction d un bug de recuperation des evenements en mode chiffre:
    - conservation de champs indexables en clair dans `events` (`projectId`, `timestamp`, `type`, `author`),
    - fallback retrocompatibilite pour anciens enregistrements non indexables.
  - ajout de la pagination du journal d activite (avec conservation des filtres).
- Harmonisation des cartes projet:
  - actions masquables/affichables au survol-focus sur les cartes de taches (liste + kanban),
  - kanban projet aligne sur le comportement de la rubrique `Taches` (actions en overlay, sans espace reserve),
  - extension du meme comportement overlay aux cartes `Documents` (projet + documents transverses).

## Version actuelle - Avril 2026

### Nouvelle fonctionnalité - Avril 2026 (Surveillance de fichiers)

- **Référentiels / Surveillance fichiers**:
  - ajout d'un nouvel onglet `Surveillance fichiers` dans la section Référentiels,
  - création d'observateurs pour surveiller automatiquement les modifications de fichiers dans un dossier,
  - système de polling configurable (intervalle de 30 secondes à 1 heure),
  - détection de 3 types d'événements: création, modification, suppression de fichiers,
  - support de multiples formats de fichiers:
    - Excel (`.xlsx`, `.xls`, `.xlsm`, `.xlsb`)
    - Word (`.docx`, `.doc`, `.docm`)
    - PDF (`.pdf`)
    - CSV (`.csv`)
    - Texte (`.txt`, `.md`)
    - Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`)
    - Patterns personnalisés (ex: `rapport_*.pdf`)
  - mode récursif pour observer les sous-dossiers,
  - notifications automatiques intégrées au centre de notifications,
  - configuration fine des notifications par type d'événement,
  - interface complète:
    - liste en cartes avec statut visuel (actif/pausé),
    - modale de création/édition avec sélection de dossier (File System Access API),
    - modale de détail avec:
      - informations (statut, fréquence, récursif, dernière vérification),
      - actions rapides (pause/reprise, vérification manuelle, modifier, supprimer),
      - liste des fichiers surveillés (nom, taille),
      - historique complet des changements avec filtres (tous, créés, modifiés, supprimés),
  - modules autonomes:
    - `js/taskmda-file-watcher.js`: moteur de surveillance (polling, détection, notifications),
    - `js/taskmda-file-watcher-ui.js`: interface utilisateur (modales, actions, rendu),
  - migration DB_VERSION 21 avec 3 nouveaux stores IndexedDB:
    - `fileWatchers`: configuration des observateurs,
    - `fileWatcherSnapshots`: état de référence des fichiers (métadonnées),
    - `fileWatcherEvents`: historique des changements détectés,
  - documentation complète:
    - `docs/FILE_WATCHER.md`: documentation technique et architecture,
    - `docs/QUICKSTART_FILE_WATCHER.md`: guide rapide utilisateur avec exemples.

## Version actuelle - Avril 2026

### Correctif - Avril 2026 (Workflow: fin du seed automatique)

- Workflow:
  - suppression de l injection automatique du jeu d exemple au demarrage (`ensureSeedData` n est plus appele dans `init`),
  - apres reinitialisation locale complete, la vue Workflow reste vide (plus de reliquat `Maison de l autonomie / Service Evaluation / Pole instruction / Agent referent`).
  - le bouton d injection manuelle du jeu exemple reste disponible si besoin.

### Micro-lot securite - Avril 2026 (seed exemple Workflow verrouille)

- Workflow:
  - ajout d un flag admin explicite local (`mode seed`) avant toute possibilite d injection de jeu exemple,
  - bouton `Injecter jeu d exemple` masque par defaut, visible uniquement si:
    - utilisateur admin,
    - flag `mode seed` active.
  - ajout d un bouton admin `Activer/Désactiver mode seed`.
  - double confirmation renforcee:
    - activation du mode seed: confirmation + saisie du token `ACTIVER_SEED`,
    - injection du jeu exemple: confirmation + saisie du token `INJECTER`.

### Mise a jour incrementale - Avril 2026 (Notes globales - mini lot qualite UX)

- Rubrique `Notes` (transverse/privee):
  - ajout de l onglet `Favoris` dans les filtres rapides,
  - ajout d un marquage `Favori` par note (action directe depuis la carte),
  - ajout d une action `Exporter` (HTML) depuis chaque carte.
- Selection multiple:
  - ajout du mode `Selection multiple` dans la barre Notes globale,
  - ajout du bouton `Tout selectionner` (toggle auto vers `Tout deselectionner`),
  - suppression en masse des notes selectionnees (avec controle des droits).
- Export multi-notes:
  - remplacement des deux actions directes par un bouton unique `Export ZIP`,
  - ajout d une modale compacte de choix de format (`ZIP HTML` ou `ZIP TXT`),
  - generation d un ZIP local sans serveur/npm (format ZIP standard, non compresse).
- Pagination:
  - pagination dediee a la liste des notes globales (`global-notes-pagination`) pour garder une navigation fluide sur gros volumes.
- Tri:
  - nouveau tri `Favoris d abord` dans la liste des notes globales.
- Navigation:
  - la rubrique `Notes` est placee juste apres `Taches` dans la sidebar.

### Mise a jour incrementale - Avril 2026 (Rubrique Notes transverse + privee)

- Navigation:
  - ajout d une rubrique globale `Notes` dans la sidebar transverse.
- Stockage:
  - nouveau store IndexedDB `globalNotes` (DB_VERSION `20`) avec indexes `createdAt/updatedAt/createdBy/visibility/theme`.
- UX Notes:
  - liste de notes avec recherche, filtres de portee (`privee/transverse`), onglets rapides (`Toutes`, `Mes notes`, `Publiees dans le fil`) et tri.
  - creation/edition via modale dediee avec editeur riche (Quill/fallback), tags, thematique et mode de visibilite.
  - mode lecture pour les notes transverses non proprietaire (edition reservee auteur/admin).
- Integration Fil d info:
  - publication optionnelle d une note globale dans le fil via un post lie (`ref global-note`).
  - references `global-note` cliquables depuis le fil (ouverture directe de la note).
- Recherche globale:
  - indexation des notes transverses/privees dans la recherche d en-tete avec ouverture contextuelle.

### Mise a jour incrementale - Avril 2026 (Lot technique 1 - stockage documents sur disque)

- Documents:
  - ajout d un module dedie `js/taskmda-document-storage.js` pour isoler la logique de stockage fichier.
  - nouvel enregistrement par defaut sur disque partage (quand le dossier est lie) avec chemin structure:
    - horodatage,
    - rubrique source (upload projet/note/global),
    - scope (projet/global),
    - projet,
    - thematique.
  - fallback automatique vers stockage `data:` en base locale si ecriture disque indisponible.
- Compatibilite:
  - apercu et telechargement hydrates a la demande depuis le chemin disque (`storagePath`) si `data` absent.
  - edition document: ouverture compatible avec hydratation automatique du contenu.
  - re-liaison/rattachement de document conserve les metadonnees de stockage (`storageMode`, `storagePath`, etc.).

### Mise a jour incrementale - Avril 2026 (Deadlines flexibles Projets + Taches)

- Projets:
  - ajout d un bloc d echeance configurable a la creation et a l edition:
    - `Date precise`
    - `Mois`
    - `Annee`
    - `Periode (debut / fin)`
  - affichage de l echeance dans l entete projet et sur les cartes projet (dashboard / vue projets).
  - stockage harmonise (`deadlineMode`, `deadlineDate`, `deadlineMonth`, `deadlineYear`, `deadlineStart`, `deadlineEnd`, `deadlineAt`).
- Taches:
  - ajout d un mode d echeance flexible dans la modale de creation/edition avec les memes 4 formats.
  - conservation de la compatibilite avec la logique existante (tri, focus/chrono, timeline, calendrier) via `dueDate` derive automatiquement.
  - affichage adapte dans les rendus (cartes, listes, timeline, detail) pour montrer le format choisi (mois/annee/periode).
  - edition inline de la date limite convertie explicitement en mode `date precise`.
- Import:
  - normalisation des taches importees pour conserver/deriver le nouveau modele d echeance.

### Mise a jour incrementale - Avril 2026 (Workflow UX - alignement filtres Carte)

- Workflow / Carte:
  - correction CSS de la zone filtres des liaisons pour afficher `Rechercher une liaison...` et `Tri` sur la meme ligne en desktop.
  - comportement responsive conserve: retour en empilement sur petits ecrans.
  - ajustement applique dans `css/taskmda-workflow.css` (source de style active Workflow).

### Mise a jour incrementale - Avril 2026 (Hierarchie Epic/Feature finalisee)

- Projets / Structure:
  - KPIs hierarchiques ajoutes dans l onglet `Structure` (taches actives, avec/sans feature, terminees, completion).
  - actions rapides ajoutees:
    - deplacement `Feature -> Epic`
    - reassignment `Tache -> Feature`
  - drag & drop natif dans `Structure`:
    - `Feature -> Epic` par glisser-deposer
    - `Tache -> Feature` via liste de taches draggable et zones de depot par feature
    - zone `Sans feature` pour detacher rapidement une tache
- Taches projet/transverses:
  - affichage du badge `Epic` en plus du badge `Feature` sur les cartes et details.
  - filtres projet enrichis `Epic` + `Feature` (avec dependance dynamique Epic -> Features).
- Exports CSV:
  - export projets enrichi (`epics`, `features`, `taches_avec_feature`, `taches_sans_feature`).
  - export taches enrichi (`epic_id`, `epic`, `feature_id`, `feature`).

### Mise a jour incrementale - Avril 2026 (Annuaire ESMS + Audit divergences + UX)

- Referentiels / Annuaire ESMS:
  - stabilisation du connecteur Annuaire Sante FHIR (`gateway.api.esante.gouv.fr`) avec support endpoint configure + cle API optionnelle selon plan.
  - normalisation automatique des endpoints gateway (`/fhir` converti en `/fhir/v2`).
  - renforcement des requetes FHIR `Organization` (construction via `URLSearchParams`, variantes de recherche FINESS nettoyees).
  - garde-fous anti-bruit reseau:
    - pre-check unique de disponibilite/authentification avant enrichissement,
    - arret des appels d enrichissement en cas de `401/403` ou `400` persistant,
    - affichage explicite de la raison d indisponibilite.
  - ajout d un panneau de configuration API repliable/depliable (toggle) avec persistance locale de l etat.
  - libelle du toggle clarifie avec icones (`Afficher config API` / `Masquer config API`).
- Audit divergences FINESS vs FHIR:
  - ajout d un mode `Audit` activable depuis l annuaire.
  - badge par ligne + detail au clic des champs compares (nom, ville, adresse, telephone, email).
  - statuts introduits: `OK`, `Proche`, `Incomplet`, `Different`.
  - recapitulatif des compteurs par ligne (OK / Proche / Incomplet / Different).
  - moteur de proximite semantique pour limiter les faux positifs:
    - normalisation casse/accents/ponctuation,
    - similarite texte (Dice),
    - overlap de tokens,
    - detection d inclusion.
  - ajout d une recommandation `adresse enrichie` et action locale `Utiliser l adresse enrichie` quand l adresse FHIR est plus informative.
  - correction d un bug de boucle de rendu/audit (stabilisation UX en mode audit ON).
- UI Referentiels:
  - barre d onglets ajustee pour integrer le bouton d aide sur la meme ligne, a droite.
- Taches:
  - animation de completion sur carte (`pouce leve` flottant + fade) lors d un passage a `termine`.

### Mise a jour incrementale - Avril 2026 (UX/UI + Workflow KPI)

- Projets:
  - harmonisation de la vue `Projets` en panneaux separes (zone overview/filtres/actions + zone cartes).
  - fiabilisation du mode `Archives` (bascule, retour dashboard -> projets, etat d affichage).
  - ajustements visuels des cartes (barre top, coherence panel et filtres).
- Projet detail:
  - corrections de visibilite des actions contextuelles (ex: `Restaurer` uniquement pour les archives).
  - harmonisation des fonds `#project-overview-panel` et `#project-work-panel` selon les styles demandes.
- Sidebar/header:
  - integration visuelle du bloc marque dans la sidebar.
  - sidebar etendue sur toute la hauteur de page.
- Fil d info:
  - bloc `Nouveau post d'information` remonte au-dessus du fil et de la recherche.
  - bloc replie par defaut, depliage a la demande.
- Messagerie:
  - panneau `Agents connus` en mode toggle (ouvrir/reduire).
  - ajustement des proportions (panneau agents + zone conversation).
  - barre d envoi modernisee avec bouton `Envoyer` rectangulaire a bords arrondis.
- Onglet `Plus (x)`:
  - menu complementaire epingle au clic.
  - fermeture au second clic.
  - suppression de l ouverture au survol.
- Workflow:
  - ajout de la vue `KPI` dans `Pilotage`.
  - KPI: synthese volume, completion, bloquees, a valider, en cours, priorite haute.
  - KPI: repartitions par statut/priorite + charge par agent (top 8).
  - styles dedies clairs/sombres (`css/taskmda-workflow.css`).

### ✨ Nouvelles fonctionnalités
#### Workflow (MVP integre)
- Ajout de la rubrique principale `Workflow` dans la navigation.
- Nouveau module `js/taskmda-workflow.js` + styles `css/taskmda-workflow.css`.
- Vues disponibles: `Carte`, `Organisation`, `Agents`, `Taches`, `Procedures`, `Logiciels metiers`.
- Panneau detail lateral editable avec sauvegarde/suppression.
- CRUD finalise cote UI pour toutes les entites Workflow:
  - creation `communautes`, `services`, `groupes`, `agents`, `taches`, `procedures`, `logiciels`
  - edition/suppression via panneau detail sur toutes les entites
- Niveau 2 (structuration avancee) ajoute:
  - filtres combines `service` + `groupe` + `agent` persistes dans `workflowLayout`
  - dependances inter-taches (`prerequisiteTaskIds`, `dependentTaskIds`) avec synchronisation des liens reciproques
  - liens transverses inter-services via `relatedServiceIds`
  - hierarchie agents/manager visible dans les vues `Carte`, `Organisation` et `Agents`
  - versioning leger automatique des procedures (incrementation auto + historique en metadata)
  - mode lecture seule Workflow pour non-admin application (edition reservee a l'admin)
- Niveau 3 (workflow enrichi) ajoute:
  - statuts workflow et validation simple des taches (`todo`, `in_progress`, `blocked`, `ready_for_review`, `done`, `approved`)
  - checklist d'execution structuree par tache avec edition et completion rapide
  - actions rapides en fiche tache: demarrer, cocher checklist, valider
  - vue `Kanban` workflow (colonnes par statut) pour pilotage operationnel
  - vue `Journal` basee sur `workflowAudit` pour tracer les evenements
  - notifications internes (toasts + audit `notify`) sur transitions et validations
- Correctifs Niveau 3:
  - correction du layout Kanban (colonnes stables + scroll horizontal) pour eviter le debordement/coupure visuelle
  - correction des libelles Workflow mal encodes (accents dans les boutons/onglets)
  - optimisation performance: ecriture Workflow locale immediate + sync dossier partage en file asynchrone (non bloquante UI)
- Integration transverse modules existants:
  - ponts explicites Workflow <-> taches globales, documents globaux, themes et groupes referentiels
  - liens croises bidirectionnels materialises via `metadata.workflowRefs` dans `globalTasks`, `globalDocs`, `globalThemes`, `globalGroups`
  - affichage des ponts transverses dans la fiche detail des taches/procedures workflow
- Procedures wiki:
  - integration d'un editeur riche (Quill si disponible, fallback contenteditable) dans la fiche procedure
  - persistance HTML wiki via `wikiBodyHtml` sur `workflowProcedures`
  - evolution vers "PAGE WIKI MODE OPERATOIRE" avec:
    - sommaire auto (H1/H2/H3)
    - liens internes type wiki (`[[Titre]]` ou `[[Titre|Libelle]]`)
    - apercu wiki navigable vers les procedures ciblees
    - aide contextuelle sous l'editeur (exemples de syntaxe wiki)
- RBAC Workflow granulaire:
  - edition autorisee pour `admin application` OU `manager workflow` (agent mappe + `rbacHints`)
  - configuration manager workflow depuis la fiche agent (`metadata.userId`, `rbacHints`)
  - migration UI `Auto-lier comptes agents` + migration auto au chargement (une fois) pour pre-remplir `metadata.userId`
- Ergonomie Workflow:
  - remplacement du panneau lateral fixe par une modale detail large et confortable
  - fermeture uniquement explicite (bouton `X` / `Esc`) pour eviter les fermetures involontaires pendant copier-coller
- Lot 3 (demarrage architecture + tracabilite):
  - decoupage initial en modules `taskmda-workflow-store.js`, `taskmda-workflow-graph.js`, `taskmda-workflow-ui.js`
  - ajout du store `workflowHistory` (historique d'entites + restauration simple depuis la fiche detail)
  - journalisation des modifications workflow (save, quick update task, delete, restore)
  - comparaison avant/apres par liste de champs modifies + restauration selective de champs depuis l'historique
- Fil d'info - digestion documentaire:
  - nouveau bouton `Digerer document` dans le composeur du fil d'info
  - ingestion locale de fichiers `.eml/.txt/.html/.pdf/.docx` vers une actualite resumee
  - extraction PDF/DOCX avancee si librairies presentes (`pdfjsLib`, `mammoth`), sinon fallback binaire best-effort
  - chargement direct des librairies `pdf.js` et `mammoth` dans l'interface pour activer l'extraction PDF/DOCX
- Donnees seed de demarrage pour illustrer la structure metier.
- Migration IndexedDB vers `DB_VERSION = 13` avec nouveaux stores:
  - `workflowCommunities`, `workflowServices`, `workflowGroups`
  - `workflowAgents`, `workflowTasks`, `workflowProcedures`
  - `workflowSoftware`, `workflowLayout`, `workflowAudit`, `workflowHistory`

#### 🔎 Récurrence des tâches
- **Tâches récurrentes** : Création de tâches qui se répètent automatiquement
- **Types de récurrence** :
  - Hebdomadaire (avec sélection de plusieurs jours)
  - Mensuelle (avec sélection de plusieurs jours du mois)
  - Annuelle (avec sélection de plusieurs dates MM-DD)
- **Options de fin** :
  - Infini : Récurrence sans limite
  - Nombre d'occurrences : Défini le nombre de fois que la tâche se répète
  - Jusqu'à une date : Termine la récurrence à une date spécifiée
- **Intervalles personnalisables** : Configuration du nombre de périodes (1, 2, 3, etc.)
- **Interface intégrée** : Formulaire de configuration dans le modal de tâche
- **Compatible** : Tâches de projet et tâches hors projet (global)
- **Synchronisable** : Récurrence persistée et synchronisée en mode collaboratif

### 📔 Nouveaux fichiers
- `js/taskmda-recurrence.js` - Moteur de récurrence et utilitaires
- `js/taskmda-recurrence-ui.js` - Gestion UI et formulaire
- `docs/RECURRENCE.md` - Documentation technique complète
- `docs/QUICKSTART_RECURRENCE.md` - Guide rapide et exemples

### 📋 Anciennes nouvelles - Mars 2026

### ✨ Anciennes fonctionnalités

#### Chiffrement E2E et projets privés/partagés
- **Projets privés** : Stockés localement uniquement, non synchronisés
- **Projets partagés** : Synchronisation avec chiffrement E2E (AES-256-GCM)
- **Passphrase optionnelle** : Facilite le partage entre collaborateurs
- **Double chiffrement** : Local (mot de passe utilisateur) + Transport (clé partagée)
- **Badges visuels** : 🔒 PRIVÉ vs 🔥 PARTAGÉ 🔑

#### Amélioration UX
- **Édition du nom d'utilisateur** : Clic sur icône crayon dans l'en-tête
- **Interface de création** : Choix du mode (privé/partagé) avec radio buttons
- **Champ passphrase** : Affiché conditionnellement pour projets partagés

### 🔧 Améliorations techniques

#### Base de données
- **Store `sharedKeys`** : Ajouté pour stocker les clés partagées (chiffrées)
- **DB_VERSION 3** : Migration automatique

#### Synchronisation
- **Chargement automatique** : Découverte des projets existants lors de la connexion
- **Chiffrement E2E** : Tous les événements synchronisés sont chiffrés
- **Format v1-e2e-encrypted** : Nouveau format pour les fichiers du dossier partagé
- **Rétrocompatibilité** : Support des anciens fichiers JSON en clair

#### Module crypto
- 6 nouvelles fonctions pour chiffrement E2E :
  - `generateSharedKey()` - Génération clé AES-256
  - `exportSharedKey()` / `importSharedKey()` - Import/export
  - `deriveSharedKeyFromPassphrase()` - Dérivation PBKDF2
  - `encryptWithSharedKey()` / `decryptWithSharedKey()` - Chiffrement/déchiffrement

### 🐛 Corrections

#### Synchronisation multi-postes
- **Fix** : Les projets existants sont maintenant chargés lors de la connexion
- **Fonction** : `discoverAndLoadExistingProjects()` ajoutée
- **Paramètre** : `onlyNew` dans `readEventsFromSharedFolder()`

#### UUID
- **Fix** : Implémentation UUID en ligne (élimination dépendance CDN)

#### Base de données
- **Fix** : Pattern singleton pour éviter les fermetures de connexion
- **Fix** : `getDatabase()` synchrone

### 📡 Documentation

- README.md : Section sécurité complète et synthétique
- CHIFFREMENT_INDEXEDDB.md : Architecture technique détaillée
- TEST_CHIFFREMENT.md : Plan de test avec 14 scénarios
- PROJET.md : Spécifications event-sourcing

### 🔐 Sécurité

- **Aucune donnée en clair** : Tout est chiffré (local + transport)
- **Zero-knowledge** : Le dossier partagé ne contient que des données chiffrées
- **Clés en mémoire** : Jamais stockées sur disque
- **Standards** : AES-256-GCM, PBKDF2-SHA256, OWASP 2024

---

## Prochaines évolutions possibles

- Modal "Rejoindre un projet partagé" avec scanner automatique
- Export/import de clés (.key file)
- Gestion des clés partagées (interface dédiée)
- Rotation des clés
- Révocation de membres
- Notifications en temps réel


