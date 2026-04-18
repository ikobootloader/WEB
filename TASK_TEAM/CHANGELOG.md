# Changelog - TaskMDA Team

## Version actuelle - Avril 2026

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

