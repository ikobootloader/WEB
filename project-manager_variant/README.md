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
   - [Naviguer & filtrer](#naviguer--filtrer)
   - [Archives](#archives)
   - [Sauvegarde sur disque (FSA)](#sauvegarde-sur-disque-fsa)
   - [Import / Export](#import--export)
   - [Personnaliser l'en-tête](#personnaliser-len-tête)
7. [Structure des données](#structure-des-données)
8. [Architecture technique](#architecture-technique)
9. [Limites connues](#limites-connues)

---

## Présentation

Gestionnaire de tâches conçu pour un usage professionnel en environnement administratif. Il permet de suivre des demandes issues de différentes unités organisationnelles (S3AD, SE2S, MDA) par type d'outil (SOLIS, MULTIGEST, BO, Courriers…).

L'application fonctionne entièrement dans le navigateur. **Aucune donnée ne transite sur un réseau.** Tout est stocké localement dans le navigateur, chiffré avec AES-256-GCM, et peut optionnellement être synchronisé vers un fichier JSON sur le disque dur de l'utilisateur.

---

## Fonctionnalités

### Gestion des tâches
- Création, modification et suppression de tâches
- Champs : titre, demandeur, type de demande, description, urgence, statut, deadline
- 3 niveaux d'urgence : Faible / Moyenne / Haute
- 3 statuts : En cours / En attente / Réalisé
- Calcul automatique de l'avancement par rapport à la deadline (barre de progression)
- Modale de détail en lecture seule (clic sur une carte)

### Organisation
- Filtres combinables : urgence, demandeur, type
- Barre de recherche plein texte (titre, description, demandeur, type) avec debounce
- Tri : date d'ajout (croissant/décroissant), deadline, urgence
- Pagination automatique (15 tâches par page)

### Archives
- Les tâches marquées « Réalisé » sont automatiquement déplacées dans l'onglet Archives
- Filtres et tri dédiés aux archives
- Restauration d'une tâche archivée vers l'état « En cours »

### Interface
- Tableau de bord avec compteurs : tâches en cours, urgentes, en attente, en retard, archivées
- En-tête personnalisable (titre et sous-titre, persistés en base)
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

> La File System Access API (sauvegarde automatique sur disque) est uniquement disponible sur **Chrome et Edge**. Sur Firefox, toutes les autres fonctionnalités sont opérationnelles ; seule la liaison avec un fichier disque est désactivée.

---

## Installation & lancement

L'application ne nécessite aucune installation, aucun serveur, aucune dépendance npm.

```
gestionnaire-projets/
├── index.html   ← point d'entrée unique
└── app.js       ← logique applicative complète
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
- **Demandeur** : S3AD, SE2S, MDA, Autres
- **Type de demande** : SOLIS, MULTIGEST, BO, Courriers, Autres
- **Description** : champ libre
- **Urgence** : Faible / Moyenne / Haute
- **Deadline** : date optionnelle
- **Degré de réalisation** : En cours / En attente / Réalisé

Valider avec **Ajouter la tâche** ou `Entrée`. Une tâche marquée « Réalisé » est directement envoyée dans les archives.

### Naviguer & filtrer

La toolbar propose plusieurs niveaux de filtrage cumulatifs :

1. **Onglets d'urgence** (Toutes / Urgentes / Moyennes / Faibles)
2. **Sélecteurs** Demandeur et Type
3. **Barre de recherche** — porte sur le titre, la description, le demandeur et le type simultanément
4. **Tri** — Date d'ajout (↑/↓), Deadline, Urgence

Au-delà de 15 tâches affichées, une pagination apparaît automatiquement en bas de liste.

Cliquer sur une carte (hors boutons) ouvre une **modale de détail** en lecture seule avec toutes les informations de la tâche et les boutons d'action en bas à droite.

### Archives

L'onglet **Archives** regroupe toutes les tâches dont le statut est « Réalisé ». Elles sont triées par date de réalisation par défaut. Il est possible de :

- Filtrer par demandeur et type
- Rechercher
- **Restaurer** une tâche vers l'état « En cours »
- Supprimer définitivement

### Sauvegarde sur disque (FSA)

La sauvegarde automatique sur disque synchronise les tâches (en clair) vers un fichier JSON sur le disque à chaque modification.

**Première liaison :**
1. Cliquer sur **📂 Ouvrir tasks.json** pour charger un fichier existant (le fichier est importé ET lié comme cible de sauvegarde).
2. Ou cliquer sur **📁 Lier un fichier disque** pour créer ou sélectionner un nouveau fichier de destination.

**Sessions suivantes :**  
Le handle du fichier est persisté dans IndexedDB. À l'ouverture, l'application tente une reconnexion silencieuse. Si le navigateur requiert une confirmation, un bandeau orange apparaît en haut de page — un clic sur **Re-autoriser** rétablit la connexion sans avoir à re-sélectionner le fichier.

Pour désactiver la sauvegarde automatique : cliquer sur **🔗 Délier le fichier**.

### Import / Export

| Action | Bouton | Format | Notes |
|--------|--------|--------|-------|
| Charger un fichier + lier | 📂 Ouvrir tasks.json | JSON | Importe les tâches et lie le fichier comme cible FSA |
| Import simple | ⬆ Importer JSON *(Firefox)* | JSON | Import sans liaison FSA |
| Export JSON | ⬇ JSON | JSON | Tâches en clair, toutes colonnes |
| Export Excel | ⬇ Excel | .xlsx | Colonnes : Titre, Demandeur, Type, Urgence, Statut, Deadline, Commentaire, Archivé le |

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
  "archivedAt": null
}
```

| Champ | Type | Valeurs possibles |
|-------|------|-------------------|
| `id` | number | Timestamp Unix (ms) — sert d'identifiant unique |
| `title` | string | Libre |
| `requester` | string | `S3AD` · `SE2S` · `MDA` · `Autres` · `""` |
| `type` | string | `SOLIS` · `MULTIGEST` · `BO` · `Courriers` · `Autres` · `""` |
| `comment` | string | Libre |
| `urgency` | string | `low` · `medium` · `high` |
| `status` | string | `en-cours` · `en-attente` · `realise` |
| `deadline` | string | Format ISO `YYYY-MM-DD` ou `""` |
| `archivedAt` | string\|null | ISO 8601 (date de passage en « Réalisé ») ou `null` |

---

## Architecture technique

```
index.html          Markup, CSS intégré, structure des modales
app.js              Logique complète (pas de framework)
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
| Crypto | Dérivation de clé PBKDF2, chiffrement/déchiffrement AES-GCM |
| Stockage | Orchestration lecture/écriture IDB + fichier disque |
| FSA | Gestion du handle fichier, reconnexion, permissions |
| Lock screen | Écran de verrouillage, création/vérification mot de passe |
| CRUD | Création, modification, suppression, restauration de tâches |
| Rendu | `renderTasks`, `renderArchives`, `buildCard` |
| Pagination | `renderPagination`, `buildPageRange` |
| Recherche | `applySearch`, handlers debounce |
| Filtres / Tri | `applyFilters`, `applySort`, `initFilterTabs` |
| Détail | Modale de lecture `openDetail` / `closeDetail` |
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
