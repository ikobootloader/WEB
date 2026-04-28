# Changelog - TaskMDA Team

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

#### 🔄 Récurrence des tâches
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

### 📁 Nouveaux fichiers
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
- **Badges visuels** : 🔒 PRIVÉ vs 👥 PARTAGÉ 🔐

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

### 📚 Documentation

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
