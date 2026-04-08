# Gestionnaire de Projets

Application web de gestion de tâches 100 % locale, sans serveur, avec chiffrement des données et sauvegarde automatique sur disque.

---

## Sommaire

1. [Présentation](#présentation)
2. [Fonctionnalités](#fonctionnalités)
3. [Sécurité & confidentialité](#sécurité--confidentialité)
4. [Compatibilité](#compatibilité)
5. [Installation & lancement](#installation--lancement)
6. [Utilisation](#utilisation)
   - [Premier démarrage](#premier-démarrage)
   - [Créer une tâche](#créer-une-tâche)
   - [Récurrence](#récurrence)
   - [Naviguer & filtrer](#naviguer--filtrer)
   - [Mise en avant des tâches dues](#mise-en-avant-des-tâches-dues)
   - [Archives](#archives)
   - [Modale de détail & édition inline](#modale-de-détail--édition-inline)
   - [Gérer les listes (demandeurs & types)](#gérer-les-listes-demandeurs--types)
   - [Sauvegarde sur disque (FSA)](#sauvegarde-sur-disque-fsa)
   - [Import / Export](#import--export)
   - [Personnaliser l'en-tête](#personnaliser-len-tête)
7. [Structure des données](#structure-des-données)
8. [Architecture technique](#architecture-technique)
9. [Limites connues](#limites-connues)

---

## Présentation

Gestionnaire de tâches conçu pour un usage professionnel en environnement administratif. Il permet de suivre des demandes issues de différentes unités organisationnelles (S3AD, SE2S, MDA…) par type d'outil (SOLIS, MULTIGEST, BO, Courriers…).

L'application fonctionne entièrement dans le navigateur. **Aucune donnée ne transite sur un réseau.** Tout est stocké localement dans le navigateur, chiffré avec AES-256-GCM, et peut optionnellement être synchronisé vers un fichier JSON sur le disque dur de l'utilisateur.

---

## Fonctionnalités

### Gestion des tâches
- Création, modification et suppression de tâches
- Champs : titre, demandeur, type de demande, description, urgence, statut, deadline, récurrence
- 3 niveaux d'urgence : Faible / Moyenne / Haute
- 3 statuts : En cours / En attente / Réalisé
- Calcul automatique de l'avancement par rapport à la deadline (barre de progression)
- Modale de détail avec édition inline de tous les champs (clic sur une carte)

### Récurrence
- 4 modes : Hebdomadaire / Mensuel / Annuel / Aucune
- Intervalle configurable (tous les N semaines, mois ou années)
- Sélection des jours de la semaine pour les récurrences hebdomadaires
- Date de fin optionnelle ou récurrence infinie
- Marquer « Réalisé » sur une tâche récurrente recalcule automatiquement la prochaine échéance sans archiver la tâche
- Les tâches récurrentes hebdomadaires sans deadline sont mises en avant le jour concerné

### Organisation
- Filtres combinables : urgence, demandeur, type
- Barre de recherche plein texte (titre, description, demandeur, type) avec debounce
- Tri : date d'ajout (croissant/décroissant), deadline, urgence
- Pagination automatique (15 tâches par page)
- Les tâches échues ou dues aujourd'hui remontent automatiquement en tête, triées par urgence décroissante

### Archives
- Les tâches marquées « Réalisé » sont automatiquement déplacées dans l'onglet Archives (sauf récurrentes actives)
- Filtres, recherche et tri dédiés aux archives
- Restauration d'une tâche archivée vers l'état « En cours »

### Interface
- Tableau de bord avec compteurs : tâches en cours, urgentes, en attente, en retard, archivées
- Panneau supérieur repliable (statistiques + barre d'import/actions)
- En-tête personnalisable (titre et sous-titre, persistés en base)
- Listes dynamiques : demandeurs et types personnalisables via le gestionnaire de listes (🏷)
- Mise en avant visuelle des tâches dues : fond coloré gradient selon l'urgence, bordure épaisse, chip « 📅 Aujourd'hui »
- Design responsive, polices Syne + DM Sans
- Notifications toast non bloquantes
- Confirmations avant suppression

### Sécurité
- Écran de verrouillage avec mot de passe (4 caractères minimum)
- Chiffrement AES-256-GCM de toutes les données au repos
- Verrouillage manuel et changement de mot de passe

### Persistance
- Stockage primaire : IndexedDB (navigateur)
- Stockage secondaire optionnel : fichier JSON sur disque via File System Access API
- Sauvegarde automatique sur disque à chaque modification
- Reconnexion automatique au fichier au redémarrage

---

## Sécurité & confidentialité

### Chiffrement

| Propriété | Valeur |
|-----------|--------|
| Algorithme | AES-256-GCM |
| Dérivation de clé | PBKDF2-SHA-256 |
| Itérations PBKDF2 | 310 000 (recommandation OWASP 2024) |
| Vecteur d'initialisation | 96 bits aléatoires (généré à chaque sauvegarde) |
| Sel | 128 bits aléatoires (généré à la création du mot de passe) |
| Stockage de la clé | En mémoire vive uniquement (jamais persistée) |

La clé de chiffrement est **dérivée du mot de passe à chaque session** et n'est jamais écrite sur le disque ni dans IndexedDB. Si le navigateur est fermé, la clé est perdue — c'est voulu.

### Ce qui est stocké dans IndexedDB

| Clé | Contenu |
|-----|---------|
| `tasks_enc` | Tâches chiffrées (`{iv: ArrayBuffer, ct: ArrayBuffer}`) |
| `salt` | Sel PBKDF2 (Uint8Array, non sensible) |
| `fsa_handle` | Handle FileSystem (référence au fichier disque, sans contenu) |
| `fsa_name` | Nom du fichier lié (string) |
| `app_header` | Titre et sous-titre personnalisés (en clair) |
| `custom_requesters` | Liste des demandeurs ajoutés par l'utilisateur (string[]) |
| `custom_types` | Liste des types de demande ajoutés par l'utilisateur (string[]) |

### Export JSON

Le fichier JSON exporté via « ⬇ JSON » contient les tâches **en clair**. Il est destiné à la sauvegarde ou au transfert entre postes. À conserver dans un emplacement sécurisé.

Le fichier de sauvegarde automatique sur disque (FSA) est lui aussi en clair — il s'agit d'une copie de travail lisible par d'autres outils.

---

## Compatibilité

| Navigateur | Stockage IDB | Sauvegarde disque (FSA) |
|------------|:---:|:---:|
| Chrome 86+ | ✅ | ✅ |
| Edge 86+ | ✅ | ✅ |
| Firefox | ✅ | ❌ (API non supportée) |
| Safari 15.2+ | ✅ | ❌ (API non supportée) |

> La File System Access API (sauvegarde automatique sur disque) est uniquement disponible sur **Chrome et Edge**. Sur Firefox, toutes les autres fonctionnalités sont opérationnelles ; seule la liaison avec un fichier disque est désactivée (le bouton « ⬆ Importer JSON » apparaît en remplacement).

---

## Installation & lancement

L'application ne nécessite aucune installation, aucun serveur, aucune dépendance npm.

```
gestionnaire-projets/
├── index.html   ← point d'entrée unique
├── app.js       ← logique applicative complète
└── README.md    ← ce fichier
```

**Pour lancer :**

1. Placer `index.html` et `app.js` dans le même dossier.
2. Ouvrir `index.html` dans Chrome ou Edge.

> ⚠️ L'application doit être ouverte via un serveur HTTP (même local) ou directement depuis le système de fichiers. Elle **ne fonctionne pas** si le navigateur bloque les scripts locaux (politique `file://` restrictive de certaines configurations). En cas de blocage, utiliser un serveur local minimal : `python -m http.server 8080` puis ouvrir `http://localhost:8080`.

La bibliothèque SheetJS (export Excel) est chargée depuis un CDN :
```
https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js
```
Une connexion internet est nécessaire au premier chargement. Ensuite, le navigateur met en cache le fichier.

---

## Utilisation

### Premier démarrage

Au premier lancement, un écran de création de mot de passe s'affiche. Ce mot de passe protège l'intégralité des données. Il n'existe aucune procédure de récupération en cas d'oubli — **les données seraient alors inaccessibles**.

Lors des sessions suivantes, l'écran demande simplement la saisie du mot de passe pour déchiffrer les données.

### Créer une tâche

Cliquer sur **+ Nouvelle tâche** (en haut à droite). Le formulaire propose :

- **Titre** *(obligatoire)*
- **Demandeur** : S3AD, SE2S, MDA, Autres (+ valeurs personnalisées)
- **Type de demande** : SOLIS, MULTIGEST, BO, Courriers, Autres (+ valeurs personnalisées)
- **Description** : champ libre
- **Urgence** : Faible / Moyenne / Haute
- **Deadline** : date optionnelle
- **Récurrence** : Aucune / Hebdomadaire / Mensuel / Annuel
- **Degré de réalisation** : En cours / En attente / Réalisé

Valider avec **Ajouter la tâche**. Une tâche marquée « Réalisé » est directement envoyée dans les archives (sauf si elle est récurrente — voir ci-dessous).

### Récurrence

La récurrence permet de créer des tâches qui se répètent automatiquement. Lors de la création ou modification d'une tâche, sélectionner un mode de récurrence :

- **Hebdomadaire** : possibilité de cocher les jours de la semaine concernés (Lun–Dim). Un intervalle « Tous les N » permet d'espacer les occurrences.
- **Mensuel** : tous les N mois à partir de la deadline.
- **Annuel** : tous les N ans à partir de la deadline.

Options supplémentaires : cocher « Sans date de fin » pour une récurrence infinie, ou spécifier une date de fin.

**Comportement à la réalisation :**
- Cliquer **✅ Réalisé** sur une tâche récurrente active ne l'archive pas. La deadline est automatiquement recalculée vers la prochaine occurrence, et la tâche reste en statut « En cours ».
- Si la date de fin de récurrence est dépassée, la tâche est archivée normalement.
- Pour les tâches hebdomadaires sans deadline avec des jours spécifiques, la prochaine occurrence est calculée à partir du prochain jour coché.

### Naviguer & filtrer

La toolbar propose plusieurs niveaux de filtrage cumulatifs :

1. **Onglets d'urgence** (Toutes / Urgentes / Moyennes / Faibles)
2. **Sélecteurs** Demandeur et Type
3. **Barre de recherche** — porte sur le titre, la description, le demandeur et le type simultanément ; un bouton ✕ apparaît pour effacer la saisie
4. **Tri** — Date d'ajout (↑/↓), Deadline, Urgence

Au-delà de 15 tâches affichées, une pagination apparaît automatiquement en bas de liste. La page est réinitialisée lors d'un changement de filtre ou de tri, et conservée lors des opérations CRUD.

Le panneau supérieur (statistiques et barre d'import) est repliable via le bouton chevron intégré aux onglets.

### Mise en avant des tâches dues

Les tâches dont la deadline est atteinte ou dépassée sont automatiquement mises en avant :

- **Remontée en tête de liste**, triées par urgence décroissante
- **Fond coloré gradient** selon le niveau d'urgence (vert/orange/rouge)
- **Bordure épaisse** et bandeau supérieur renforcé
- **Chip « 📅 Aujourd'hui »** ou « 📅 En retard de N j »

Ce comportement s'applique également aux **tâches récurrentes hebdomadaires sans deadline** : si aujourd'hui correspond à un des jours cochés, la tâche est mise en avant avec un chip « 📅 Aujourd'hui » même en l'absence de deadline explicite.

### Archives

L'onglet **Archives** regroupe toutes les tâches dont le statut est « Réalisé ». Elles sont triées par date de réalisation par défaut. Il est possible de :

- Filtrer par demandeur et type
- Rechercher en plein texte
- **Restaurer** une tâche vers l'état « En cours »
- Supprimer définitivement

### Modale de détail & édition inline

Cliquer sur une carte (hors boutons d'action) ouvre une **modale de détail** affichant toutes les informations de la tâche. Depuis cette modale, chaque champ est modifiable directement :

- **Titre** : cliquer pour éditer en ligne (valider avec Entrée, annuler avec Échap)
- **Urgence** et **Statut** : cliquer sur le badge pour ouvrir un sélecteur inline
- **Demandeur** et **Type** : cliquer sur le champ pour afficher un menu déroulant
- **Deadline** : cliquer pour afficher un champ date avec option d'effacement
- **Description** : cliquer pour éditer dans un textarea (valider avec Ctrl+Entrée)

Les modifications sont enregistrées immédiatement et les vues se rafraîchissent en temps réel. Les champs éditables sont signalés par un indicateur ✎ au survol.

### Gérer les listes (demandeurs & types)

Le bouton **🏷 Gérer les listes** ouvre une modale de gestion des valeurs de demandeurs et types de demande.

- Les entrées **système** (S3AD, SE2S, MDA, Autres, SOLIS, MULTIGEST, BO, Courriers) sont permanentes et ne peuvent pas être supprimées.
- L'utilisateur peut **ajouter** de nouvelles entrées personnalisées (40 caractères max).
- Les entrées personnalisées peuvent être **supprimées** à tout moment.
- Les modifications se répercutent immédiatement dans tous les sélecteurs (formulaire, filtres tâches, filtres archives).
- Les listes personnalisées sont persistées dans IndexedDB.

### Sauvegarde sur disque (FSA)

La sauvegarde automatique sur disque synchronise les tâches (en clair) vers un fichier JSON sur le disque à chaque modification.

**Première liaison :**
1. Cliquer sur **📂 Ouvrir tasks.json** pour charger un fichier existant (le fichier est importé ET lié comme cible de sauvegarde).
2. Ou cliquer sur **📁 Lier un fichier disque** pour créer ou sélectionner un nouveau fichier de destination.

**Sessions suivantes :**
Le handle du fichier est persisté dans IndexedDB. À l'ouverture, l'application tente une reconnexion silencieuse (`queryPermission`). Si le navigateur requiert une confirmation (état « prompt »), un bandeau orange apparaît en haut de page — un clic sur **📁 Re-lier le fichier** rétablit la connexion sans avoir à re-sélectionner le fichier.

Pour désactiver la sauvegarde automatique : cliquer sur **🔗 Délier le fichier**.

> Sur Firefox, les boutons FSA sont masqués. Le bouton « ⬆ Importer JSON » est affiché en remplacement.

### Import / Export

| Action | Bouton | Format | Notes |
|--------|--------|--------|-------|
| Charger un fichier + lier | 📂 Ouvrir tasks.json | JSON | Importe les tâches et lie le fichier comme cible FSA |
| Import simple | ⬆ Importer JSON *(Firefox)* | JSON | Import sans liaison FSA |
| Export JSON | ⬇ JSON | JSON | Tâches en clair, toutes colonnes |
| Export Excel | ⬇ Excel | .xlsx | Colonnes : Titre, Demandeur, Type, Urgence, Statut, Deadline, Récurrence, Commentaire, Archivé le |

### Personnaliser l'en-tête

Survoler le titre principal fait apparaître une icône ✏️. Un clic active l'édition inline du titre et du sous-titre. Les modifications sont validées avec **✓ Valider** ou la touche `Entrée`, annulées avec **Annuler** ou `Échap`. Les valeurs sont persistées dans IndexedDB et rechargées à chaque session.

---

## Structure des données

Chaque tâche est un objet JSON avec les propriétés suivantes :

```json
{
  "id":         1718000000000,
  "title":      "Traitement dossier allocataire",
  "requester":  "S3AD",
  "type":       "SOLIS",
  "comment":    "Vérifier les pièces justificatives manquantes.",
  "urgency":    "high",
  "status":     "en-cours",
  "deadline":   "2025-06-30",
  "recurrence": {
    "type":     "weekly",
    "interval": 1,
    "days":     [3],
    "endDate":  null
  },
  "archivedAt": null
}
```

| Champ | Type | Valeurs possibles |
|-------|------|-------------------|
| `id` | number | Timestamp Unix (ms) — sert d'identifiant unique |
| `title` | string | Libre |
| `requester` | string | Valeurs système + valeurs personnalisées, ou `""` |
| `type` | string | Valeurs système + valeurs personnalisées, ou `""` |
| `comment` | string | Libre |
| `urgency` | string | `low` · `medium` · `high` |
| `status` | string | `en-cours` · `en-attente` · `realise` |
| `deadline` | string | Format ISO `YYYY-MM-DD` ou `""` |
| `recurrence` | object\|null | Objet récurrence (voir ci-dessous) ou `null` |
| `archivedAt` | string\|null | ISO 8601 (date de passage en « Réalisé ») ou `null` |

### Objet récurrence

| Champ | Type | Description |
|-------|------|-------------|
| `type` | string | `none` · `weekly` · `monthly` · `yearly` · `infinite` (rétrocompat) |
| `interval` | number | Fréquence : tous les N (semaines, mois ou années) |
| `days` | number[] | Jours de la semaine (0=Dim … 6=Sam), uniquement pour `weekly` |
| `endDate` | string\|null | Date de fin ISO `YYYY-MM-DD`, ou `null` pour récurrence infinie |

> Le type `infinite` est un ancien format conservé pour rétrocompatibilité. Il est traité comme `weekly` avec intervalle 1 et sans date de fin.

---

## Architecture technique

```
index.html          Markup, CSS intégré, structure des modales
app.js              Logique complète (pas de framework)
README.md           Documentation
```

### Dépendances externes

| Bibliothèque | Source | Usage |
|---|---|---|
| SheetJS (xlsx) | jsDelivr CDN | Export Excel |
| Syne + DM Sans | Google Fonts | Typographie |

### Modules fonctionnels dans app.js

| Section | Responsabilité |
|---------|----------------|
| IndexedDB | Couche de persistance (`dbGet` / `dbSet` / `dbDelete`) |
| Listes dynamiques | Gestion des demandeurs et types personnalisables |
| Crypto | Dérivation de clé PBKDF2, chiffrement/déchiffrement AES-GCM |
| Stockage | Orchestration lecture/écriture IDB + fichier disque |
| FSA | Gestion du handle fichier, reconnexion, permissions |
| Lock screen | Écran de verrouillage, création/vérification mot de passe |
| Récurrence | `nextDeadline`, `recurrenceLabel`, `isTaskDueToday` |
| CRUD | Création, modification, suppression, restauration de tâches |
| Rendu | `renderTasks`, `renderArchives`, `buildCard` |
| Pagination | `renderPagination`, `buildPageRange` |
| Recherche | `applySearch`, handlers debounce |
| Filtres / Tri | `applyFilters`, `applySort`, `initFilterTabs` |
| Détail & édition inline | `openDetail`, `_renderDetail`, `inlineEdit*` |
| Header | `loadHeader`, `startEditHeader`, `saveHeader` |
| Import/Export | JSON, Excel, `openAndLinkFile` |

### Flux de démarrage

```
DOMContentLoaded
  └─ dbGet(KEY_TASKS)
       ├─ null        → showLockScreen('create')   [première utilisation]
       └─ présent     → showLockScreen('unlock')   [sessions suivantes]

submitPassword()
  ├─ mode 'create' → génère sel → deriveKey → saveToStorage
  └─ mode 'unlock' → dbGet(salt) → deriveKey → loadFromStorage → decrypt
       ├─ loadLists()          → charge demandeurs & types personnalisés
       ├─ refreshAllSelects()  → peuple tous les <select>
       ├─ loadHeader()         → restaure titre & sous-titre
       └─ restoreFsaHandle()
            ├─ permission 'granted' → reconnexion silencieuse
            ├─ permission 'prompt'  → affichage banner
            └─ permission 'denied'  → nettoyage IDB
```

---

## Limites connues

- **Oubli du mot de passe** : aucune récupération possible. Les données chiffrées dans IndexedDB sont inaccessibles sans le mot de passe. Exporter régulièrement en JSON constitue la seule sauvegarde de secours.
- **Suppression des données IDB** : vider le cache ou les données du site dans les paramètres du navigateur supprime définitivement les tâches stockées dans IndexedDB. La sauvegarde disque (FSA) permet de les réimporter via « 📂 Ouvrir tasks.json ».
- **File System Access API** : non disponible sur Firefox et Safari. Sur ces navigateurs, la sauvegarde automatique sur disque est désactivée ; l'export manuel JSON reste disponible.
- **Fichier disque en clair** : le fichier `tasks.json` sur disque n'est pas chiffré. Veiller à le stocker dans un emplacement protégé par les droits système si les données sont sensibles.
- **Multi-onglets** : ouvrir l'application dans plusieurs onglets simultanément peut entraîner des conflits d'écriture dans IndexedDB. Usage mono-onglet recommandé.
- **Récurrence sans deadline** : les récurrences mensuelles et annuelles nécessitent une deadline initiale pour calculer les occurrences suivantes. Seule la récurrence hebdomadaire avec jours cochés fonctionne sans deadline.
