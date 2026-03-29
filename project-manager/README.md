# TaskMDA 🏛️

Application web de gestion de tâches et projets **100% locale**, sans serveur ni base de données. Toutes les données sont chiffrées avec **AES-256-GCM** dans le navigateur avant d'être stockées dans **IndexedDB**.

**TaskMDA** est conçu pour les collectivités et administrations publiques avec un système de gestion de projets intégré via diagramme de Gantt.

---

## Design System : Emerald Flux

Interface redesignée avec le système de design **"Emerald Flux"** :
- **Couleur primaire** : Emerald Green (#006c4a) - professionnel et apaisant
- **Typographie duale** : Manrope (titres) + Inter (interface) pour équilibre et lisibilité
- **Tonal Layering** : utilisation de surfaces étagées sans bordures rigides
- **Glassmorphisme** : modaux avec fond flou et transparence subtile
- **Gradients** : boutons d'action avec dégradés linéaires pour un effet premium
- **Animations fluides** : transitions et effets hover soignés
- **Mode sombre** : thème sombre harmonieux avec excellent contraste
- **Accessibilité** : mode contraste renforcé pour une meilleure lisibilité

---

## Fonctionnalités principales

### 🎯 Gestion des tâches
- **Création / édition / suppression** de tâches avec titre, description, niveau d'urgence et deadline
- **Bouton "Réalisé"** directement sur chaque cartouche pour archivage rapide
- **Champs étendus** : demandeur (S3AD, SE2S, MDA, PSS, ASG, Autres), sujet de demande (SOLIS, MULTIGEST, BO, Courriers, Autres), date de demande
- **Ordre/Index manuel** : possibilité de définir un ordre personnalisé (ex: 2026-1, 2026-2, etc.)
- **Modes d'affichage multiples** : 4 vues différentes (1, 2, 3, 4 colonnes) avec adaptation du niveau de détail
  - Vue 1 colonne : détails complets avec descriptions longues
  - Vue 2 colonnes : vue équilibrée avec descriptions moyennes
  - Vue 3 colonnes : vue compacte sans descriptif (230px de hauteur)
  - Vue 4 colonnes : vue ultra-compacte pour vue d'ensemble
- **Dates automatiques** : affichage de la date de création, modification et archivage
- **Descriptions Markdown** : formatage riche avec gras, italique, listes, liens, code
- **Indicateur de progression** : cercle de progression coloré affichant les jours restants avant l'échéance
  - 🟢 Vert : plus de 25% du temps restant
  - 🟠 Orange : plus de 75% du temps écoulé
  - 🔴 Rouge vif : moins de 2 jours restants
  - ⛔ Rouge erreur : échéance dépassée
- **Validation des formulaires** : messages d'erreur explicites pour les champs obligatoires
  - Titre obligatoire avec message et focus automatique
  - Demandeur obligatoire
  - Sujet de tâche obligatoire
  - Animation shake sur les champs en erreur

### 🔄 Tâches récurrentes
- **Fréquences configurables** : quotidien, hebdomadaire, mensuel, annuel
- **Intervalle personnalisé** : répéter tous les X jours/semaines/mois/années
- **Création automatique** : nouvelle occurrence générée automatiquement lors de la réalisation
- **Badge visuel** : indicateur 🔄 sur les tâches récurrentes

### 📎 Fichiers joints
- **Association de fichiers** : images, PDF, documents Word/Excel, etc.
- **Limite de taille** : 5 Mo par fichier
- **Prévisualisation** : icônes et informations de taille
- **Téléchargement** : récupération des fichiers joints
- **Stockage Base64** : fichiers chiffrés avec les données
- **Compteur visuel** : badge affichant le nombre de fichiers joints

### 🔍 Organisation et recherche
- **Moteur de recherche** : recherche en temps réel dans titre, description, demandeur, sujet
- **Filtrage avancé** : par urgence (Faible, Moyenne, Haute)
- **Tri multiple** : ordre manuel, date d'ajout, date de demande, deadline, urgence
- **Pagination** : affichage par lots de 12 tâches
- **Préférences de vue persistantes** : mémorisation du mode d'affichage choisi (1-4 colonnes)
- **Navigation fluide** :
  - 📊 Tableau de bord - vue d'ensemble et statistiques
  - ✅ Mes tâches - tâches actives avec compteur dynamique
  - 📁 Projets - gestion de projets avec Gantt
  - 🗄️ Archives - tâches terminées avec compteur dynamique
  - 📥📤 Import/Export - gestion des données
  - ⚙️ Paramètres - configuration et sécurité

### 📁 Gestion de projets (Gantt)
- **Diagramme de Gantt interactif** : visualisation timeline des projets
- **Vues multiples** :
  - 🖥️ **Desktop** : Gantt complet avec barres de progression et timeline
  - 📱 **Mobile** : vue cartes optimisée pour petits écrans
- **Zoom chronologique 3 niveaux** : basculement fluide entre vues
  - 📅 **TRIMESTRES** : vue macro pour planification long terme
  - 📆 **MOIS** : vue standard pour suivi mensuel (par défaut)
  - 📊 **SEMAINES** : vue détaillée pour suivi fin
    - Header sur deux lignes (mois + numéros de semaines)
    - Scroll horizontal contenu dans le cadre de la frise
    - Barres de projet calculées en pixels pour précision maximale
- **Statuts colorés** :
  - 🟢 EN COURS (#006c4a) - projet actif
  - 🔵 PLANIFIÉ (#6366f1) - projet à venir
  - 🔴 URGENT (#ef4444) - projet urgent
  - ⚪ TERMINÉ (#9ca3af) - projet complété
- **Informations projet** :
  - Nom, dates de début/fin, progression (0-100%)
  - Description détaillée
  - Demandeurs multiples avec emails
  - Calcul automatique des jours restants
- **Actions rapides** :
  - ✏️ **Édition** : modifier le projet (clic sur carte ou barre)
  - 📦 **Archivage** : archiver le projet rapidement
  - 🗑️ **Suppression** : supprimer définitivement
  - Boutons visibles au survol en haut à droite des cartouches
- **Validation des formulaires** : messages d'erreur explicites
  - Nom du projet obligatoire
  - Date de début obligatoire
  - Date de fin obligatoire
  - Cohérence des dates (fin après début)
  - Au moins un demandeur obligatoire
- **Tooltip informatif** : titre complet du projet au survol (utile si tronqué)
- **Responsive design** : adaptation automatique mobile/desktop
- **Stockage chiffré** : projets sauvegardés avec chiffrement AES-256-GCM

### 📧 Notifications par email
- **Templates personnalisables** : modèles d'emails pour tâches/projets complétés et demandes de renseignements
- **Variables dynamiques** :
  - `{{TITLE}}` : titre de la tâche/projet
  - `{{REQUESTER}}` : demandeur(s)
  - `{{SUJET}}` : sujet de la tâche (anciennement TYPE)
  - `{{URGENCY}}` : niveau d'urgence
  - `{{STATUS}}` : statut
  - `{{DEADLINE}}` : date limite
  - `{{COMMENT}}` : commentaire
  - Support rétro-compatible de `{{TYPE}}`
- **Multi-destinataires** : envoi simultané à plusieurs demandeurs
  - Support des tâches et projets avec plusieurs demandeurs
  - Tous les demandeurs doivent avoir un email configuré
  - Destinataires séparés par points-virgules dans le mailto
- **Configuration emails** : gestion dans Paramètres > Templates d'emails & Signature
  - Configuration des emails par demandeur
  - Signature textuelle personnalisable
  - Note : Les images ne peuvent pas être intégrées via mailto (limitation du protocole)
- **Boutons d'envoi rapide** :
  - Directement depuis les cartouches de tâches
  - Dans les modales de détail tâches/projets
  - Apparition automatique si tous les demandeurs ont un email

### 📦 Gestion des versions logicielles
- **Registre des versions** : suivi des versions de SOLIS, MULTIGEST, BO, etc.
- **Interface dédiée** : modal élégante pour ajouter/modifier/supprimer les versions
- **Stockage chiffré** : versions sauvegardées avec chiffrement AES-256-GCM
- **Accès rapide** : depuis l'onglet Import/Export

### 🔒 Sécurité et stockage
- **Stockage IndexedDB** — persistant et local, capacité plusieurs GB
- **Chiffrement AES-256-GCM** — toutes les données chiffrées localement
  - Tâches, projets, versions, configuration : tout est chiffré
  - Seul le sel cryptographique reste en clair (requis pour dérivation)
- **Dérivation de clé PBKDF2-SHA256** (310 000 itérations, conforme OWASP 2024)
- **Verrouillage / déverrouillage** par mot de passe à chaque session
- **Support clavier** : touche Entrée pour valider le mot de passe
- **Affichage/masquage** : bouton œil pour voir le mot de passe en clair
- **Import/Export JSON** : sauvegarde manuelle de toutes les données
  - Export non chiffré pour portabilité et lisibilité
  - Import avec chiffrement automatique vers IndexedDB
- **Export Excel (.xlsx)** : export multi-feuilles
  - Tâches sur une feuille, projets sur une autre
  - Fichier nommé `TaskMDA_Export.xlsx`
  - Toast affichant le nombre de tâches et projets exportés
- **Migration automatique** : transfert transparent depuis localStorage (ancienne version)
- **Dédoublonnage automatique** : suppression des tâches dupliquées au chargement
- **Protection anti-double-clic** : évite les créations/suppressions multiples accidentelles

### 📊 Statistiques et suivi
- **Tableau de bord enrichi** :
  - Total des tâches actives
  - Nombre de tâches urgentes
  - Tâches complétées (archives)
  - Projets actifs avec statistiques
  - Résumé textuel intelligent
  - Statistics Cards avec bordures fines (bottom et right) pour meilleure visibilité
- **Indicateurs visuels** : badges d'urgence (🌿/⚠️/🔥), statut, demandeur, sujet, récurrence
- **Compteurs temps réel** : mise à jour instantanée des badges sidebar après chaque action
- **Affichage des dernières tâches et projets** sur le dashboard
- **Barre de progression circulaire** : visualisation de l'approche de la deadline avec tooltip informatif
- **Cartes projets sur Dashboard** : aperçu rapide avec boutons d'action (éditer, archiver, supprimer) et bordures fines
- **Navigation rapide** : liens "Voir tout →" discrets pour accéder aux vues complètes

### 🎨 Apparence personnalisable
- **Mode sombre** : thème sombre complet et harmonieux
  - Palette cohérente : #121212 → #3a3a3a
  - Excellent contraste pour textes et icônes
  - Badges de statut parfaitement lisibles
  - Header et sidebar harmonisés
  - Formulaires et inputs stylisés
- **Mode contraste renforcé** : bordures et contrastes renforcés pour meilleure lisibilité
- **Combinaison possible** : mode sombre + contraste renforcé
- **Persistance** : préférences sauvegardées dans le config chiffré

---

## Comparatif README vs Application actuelle

### ✅ Fonctionnalités documentées ET implémentées

| Fonctionnalité | Status | Notes |
|---|---|---|
| Gestion complète des tâches | ✅ | Création, édition, suppression, archivage |
| Tâches récurrentes | ✅ | Toutes fréquences avec intervalles personnalisés |
| Fichiers joints | ✅ | Support complet avec limite 5 Mo |
| Recherche et filtrage | ✅ | Temps réel avec filtres d'urgence |
| Markdown dans descriptions | ✅ | Support complet via Marked.js |
| Gantt interactif | ✅ | Vue mois/semaines, responsive |
| Chiffrement AES-256-GCM | ✅ | Toutes données chiffrées localement |
| Stockage IndexedDB | ✅ | Persistant, performant, local |
| Migration automatique | ✅ | Depuis localStorage vers IndexedDB |
| Import/Export JSON | ✅ | Format TaskMDA v5 |
| Export Excel | ✅ | Multi-feuilles (tâches + projets) |
| Compteurs sidebar dynamiques | ✅ | Mise à jour temps réel |
| Design Emerald Flux | ✅ | Complet avec glassmorphisme |
| Responsive design | ✅ | Desktop, tablette, mobile |
| Gestionnaire de versions | ✅ | Modal avec CRUD complet |

### 🆕 Fonctionnalités récemment ajoutées

| Fonctionnalité | Description | Importance |
|---|---|---|
| **Zoom Gantt 3 niveaux** | Trimestres / Mois / Semaines avec scroll horizontal contenu | ⭐⭐⭐ |
| **Scroll horizontal isolé** | Frise chronologique avec scroll dans son cadre uniquement | ⭐⭐⭐ |
| **Emails multi-destinataires** | Envoi simultané à plusieurs demandeurs (tâches + projets) | ⭐⭐⭐ |
| **Paramètres accordéon** | Sections pliables/dépliables dans les Paramètres | ⭐⭐ |
| **Badge échéance coloré vue 4 colonnes** | Badge avec couleur d'urgence pour meilleure visibilité | ⭐⭐ |
| **Gestion versions dans Paramètres** | Section "Versions des logiciels" déplacée dans Paramètres | ⭐⭐ |
| **Mode sombre** | Thème sombre harmonieux avec palette cohérente | ⭐⭐⭐ |
| **Mode contraste renforcé** | Amélioration accessibilité | ⭐⭐⭐ |
| **Validation formulaires** | Messages d'erreur explicites + focus automatique | ⭐⭐⭐ |
| **Vue semaines 2 lignes** | Header Gantt avec mois et semaines séparés | ⭐⭐⭐ |
| **Actions rapides projets** | Boutons éditer/archiver/supprimer au survol | ⭐⭐⭐ |
| **Tooltip titre projet** | Affichage titre complet si tronqué | ⭐⭐ |
| **Demandeurs multiples projets** | Support de plusieurs demandeurs par projet | ⭐⭐ |
| **Refresh Dashboard après édition** | Synchronisation automatique des vues | ⭐⭐ |
| **Export Excel amélioré** | Feuilles séparées + compteur toast | ⭐⭐ |
| **Badges lisibles mode sombre** | Contraste optimisé pour tous les badges | ⭐⭐⭐ |
| **Toast harmonisé** | Fond vert avec glassmorphisme | ⭐ |
| **Vues multiples tâches** | 4 modes d'affichage (1/2/3/4 colonnes) avec préférence persistante | ⭐⭐⭐ |
| **Troncature intelligente texte** | Texte tronqué en JS pour éviter débordement | ⭐⭐ |
| **Bordures Statistics Cards** | Bordures fines bottom/right pour meilleure visibilité | ⭐⭐ |
| **Terminologie "Sujets"** | Remplacement de "Types" par "Sujets" dans l'UI | ⭐⭐ |
| **Navigation rapide Dashboard** | Liens "Voir tout" discrets vers vues complètes | ⭐⭐ |
| **Anti-FOUC** | Loader initial avant affichage de l'écran de connexion | ⭐⭐ |

### 📝 Changements majeurs v5.0

| Ancien système | Nouveau système | Impact |
|---|---|---|
| localStorage (5-10 MB) | IndexedDB (plusieurs GB) | ✅ Plus de capacité |
| Opérations synchrones | Opérations asynchrones | ✅ Meilleures performances |
| File System Access API | Supprimé | ✅ Interface simplifiée |
| Indicateur FSA header | Supprimé | ✅ Interface épurée |
| Sauvegarde auto fichier | Supprimée | ⚠️ Utiliser Export JSON manuel |
| Format export v4 | Format export v5 | ✅ Migration automatique |

### 🎯 Impact utilisateur

**Améliorations majeures non documentées** :
1. **Mode sombre** : confort visuel considérable pour usage prolongé
2. **Validation formulaires** : prévient les erreurs de saisie, améliore l'UX
3. **Actions rapides projets** : gain de temps significatif dans la gestion
4. **Notifications email** : communication facilitée avec les demandeurs
5. **Contraste renforcé** : accessibilité améliorée pour tous les utilisateurs

---

## Structure des fichiers

```
├── index.html        — Interface utilisateur avec design Emerald Flux
├── app.js           — Logique applicative (crypto, CRUD, rendu, import/export)
├── README.md        — Documentation complète (ce fichier)
└── model/
    ├── DESIGN.md    — Spécifications du design system Emerald Flux
    └── code.html    — Archive de la précédente version
```

---

## Démarrage

**Aucune installation requise.** Ouvrez simplement `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).

L'application fonctionne **100% en local** :
- ✅ Aucun serveur requis
- ✅ Aucune connexion internet nécessaire
- ✅ Toutes les données stockées dans IndexedDB (local au navigateur)
- ✅ Chiffrement AES-256-GCM côté client uniquement

Au premier lancement, vous devrez créer un mot de passe (4 caractères minimum). Ce mot de passe chiffre toutes vos données localement — **il n'est jamais stocké ni transmis**.

### Migration automatique

Si vous utilisez déjà TaskMDA avec localStorage (ancienne version) :
- Au premier lancement, vos données seront **automatiquement migrées** vers IndexedDB
- Aucune perte de données
- Le mot de passe reste le même
- Un message de confirmation s'affichera dans la console du navigateur

### Personnalisation de l'apparence

Dans **Paramètres** > **Apparence** :
1. Activer le **Mode sombre** pour un thème sombre harmonieux
2. Activer le **Contraste renforcé** pour améliorer la lisibilité
3. Les deux modes peuvent être combinés
4. Les préférences sont sauvegardées automatiquement

---

## Sécurité et stockage

### Chiffrement

| Élément | Détail |
|---|---|
| Algorithme | AES-256-GCM |
| Dérivation de clé | PBKDF2-SHA256, 310 000 itérations |
| Sel | 16 octets aléatoires, généré à la création |
| IV | 12 octets aléatoires par chiffrement |
| Stockage de la clé | En mémoire uniquement (jamais persistée) |
| Transit réseau | Aucun |

### Stockage IndexedDB

| Élément | Détail |
|---|---|
| Base de données | `TaskMDA_DB` |
| Object Store | `encrypted_data` |
| Clés stockées | `salt`, `tasks`, `versions`, `projects`, `config` |
| Données chiffrées | ✅ Tâches, projets, versions, configuration |
| Données en clair | Uniquement le sel (requis pour dérivation) |
| Capacité | Plusieurs GB (selon navigateur) |
| Performance | Opérations asynchrones (non-bloquantes) |

### Protections

| Élément | Détail |
|---|---|
| Protection doublons | Dédoublonnage automatique au chargement |
| Protection double-clic | Variable de verrouillage lors des soumissions |
| Migration automatique | Transfert transparent depuis localStorage |
| Validation formulaires | Messages d'erreur explicites avec focus |

---

## Format des données (JSON)

### Tâches

```json
{
  "id": 1773318557563,
  "title": "Nom de la tâche",
  "urgency": "high | medium | low",
  "status": "en-cours | en-attente | realise",
  "deadline": "2026-04-12",
  "requestDate": "2026-03-20",
  "requester": "S3AD | SE2S | MDA | PSS | ASG | Autres",
  "type": "SOLIS | MULTIGEST | BO | Courriers | Autres (renommé en 'sujet' dans l'UI)",
  "comment": "Description avec support **Markdown**",
  "order": "2026-1",
  "recurring": {
    "frequency": "daily | weekly | monthly | yearly",
    "interval": 1
  },
  "files": [
    {
      "name": "document.pdf",
      "type": "application/pdf",
      "size": 123456,
      "data": "data:application/pdf;base64,..."
    }
  ],
  "createdAt": "2026-03-20T10:30:00.000Z",
  "updatedAt": "2026-03-20T15:45:00.000Z",
  "archivedAt": "2026-03-21T09:00:00.000Z"
}
```

### Projets

```json
{
  "id": 1773318557563,
  "name": "Nom du projet",
  "status": "en-cours | planifie | urgent | termine",
  "startDate": "2026-03-01",
  "endDate": "2026-06-30",
  "progress": 75,
  "description": "Description détaillée du projet",
  "requesters": ["S3AD", "SE2S"],
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-03-20T15:30:00.000Z",
  "archivedAt": null
}
```

### Configuration

```json
{
  "requesters": ["S3AD", "SE2S", "MDA", "PSS", "ASG"],
  "types": ["SOLIS", "MULTIGEST", "BO", "Courriers"],  // Appelé "sujets" dans l'interface
  "emailTemplates": {
    "completion": {
      "subject": "Tâche réalisée : {{TITLE}}",
      "body": "Bonjour,\n\nLa tâche suivante a été réalisée..."
    },
    "inquiry": {
      "subject": "Demande de renseignements : {{TITLE}}",
      "body": "Bonjour,\n\nJe souhaiterais obtenir..."
    }
  },
  "appearance": {
    "darkMode": false,
    "highContrast": false
  }
}
```

### Format d'export complet

```json
{
  "tasks": [...],
  "versions": {...},
  "projects": [...],
  "config": {...},
  "exportedAt": "2026-03-24T12:00:00.000Z",
  "format": "TaskMDA v5"
}
```

---

## Technologies utilisées

- **Vanilla JS (ES2022+)** — aucune dépendance JS applicative
- **IndexedDB** (natif navigateur) — stockage local persistant
- **Web Crypto API** (natif navigateur) — chiffrement AES-256-GCM
- **[SheetJS / xlsx](https://sheetjs.com/)** — export Excel multi-feuilles
- **[Marked.js](https://marked.js.org/)** — rendu Markdown
- **[Tailwind CSS](https://tailwindcss.com/)** — framework CSS utility-first avec dark mode
- **Google Fonts** : Manrope (display), Inter (interface)
- **Material Symbols Outlined** — icônes Google

---

## Changelog

### 💾 Version 5.0 - IndexedDB Migration (Mars 2026)

**Migration vers IndexedDB**
- 💾 **Remplacement de localStorage par IndexedDB**
  - Meilleure performance pour gros volumes de données
  - Capacité de stockage augmentée (plusieurs GB vs 5-10 MB)
  - Opérations asynchrones (non-bloquantes)
  - Support natif des transactions ACID
- 🔄 **Migration automatique** : transfert transparent depuis localStorage
  - Détection automatique des données existantes
  - Migration au premier lancement
  - Nettoyage automatique de localStorage
  - Aucune perte de données
- 🔐 **Chiffrement conservé** : AES-256-GCM pour toutes les données
  - Tâches chiffrées
  - Projets chiffrés
  - Versions chiffrées
  - Configuration chiffrée
  - Seul le sel reste en clair (requis pour dérivation)
- 🗑️ **Suppression File System Access API** : système de liaison fichier JSON externe retiré
  - IndexedDB stocke déjà tout localement
  - Pas besoin de lier un fichier externe
  - Interface simplifiée
  - Export/Import JSON manuel toujours disponible

**Avantages IndexedDB**
- ⚡ Plus rapide que localStorage
- 📊 Meilleure gestion de gros volumes
- 🔒 Toujours 100% local et chiffré
- 🌐 Compatible tous navigateurs modernes
- 📱 Fonctionne sans serveur

### 🌙 Version 4.5 - Dark Mode & Validation (Mars 2026)

**Apparence personnalisable**
- 🌙 **Mode sombre** : thème sombre complet et harmonieux
  - Palette cohérente (#121212 → #3a3a3a)
  - Excellent contraste pour tous les éléments
  - Badges de statut parfaitement lisibles
  - Header et sidebar harmonisés
- 🔲 **Mode contraste renforcé** : bordures et contrastes améliorés
- 💾 **Persistance** : préférences sauvegardées dans config chiffré
- 🎨 **Toggle dans Paramètres** : activation/désactivation facile

**Validation des formulaires**
- ✅ **Formulaire tâche** : validation complète avec messages explicites
  - Titre obligatoire + focus automatique
  - Demandeur obligatoire
  - Type de tâche obligatoire
- ✅ **Formulaire projet** : validation renforcée
  - Nom obligatoire
  - Date de début obligatoire
  - Date de fin obligatoire
  - Cohérence des dates (fin après début)
  - Au moins un demandeur obligatoire
- ⚡ **Animation shake** : effet visuel sur champs en erreur
- 🎯 **Focus automatique** : curseur positionné sur le champ problématique

**Améliorations UX projets**
- 🔘 **Actions rapides** : boutons éditer/archiver/supprimer au survol
- 💡 **Tooltip titre** : affichage titre complet si tronqué
- 🔄 **Refresh automatique** : synchronisation Dashboard après modifications
- 📊 **Vue semaines améliorée** : header sur 2 lignes (mois + semaines)

**Notifications email**
- 📧 **Templates personnalisables** : modèles pour tâches complétées et demandes
- 🔤 **Variables dynamiques** : TITLE, REQUESTER, TYPE, URGENCY, etc.
- ⚙️ **Configuration** : personnalisation dans Paramètres
- 📤 **Envoi rapide** : boutons directement sur les cartouches

**Export amélioré**
- 📊 **Excel multi-feuilles** : tâches et projets sur feuilles séparées
- 📝 **Fichier renommé** : `TaskMDA_Export.xlsx`
- 💬 **Toast détaillé** : affichage nombre de tâches et projets exportés

### 🏛️ Version 4.0 - TaskMDA (Mars 2026)

**Refonte identité**
- 🏛️ Rebranding : TaskArchitect → **TaskMDA**
- 🏢 Nouvelle icône `account_balance` (collectivité/administration)
- 🎯 Positionnement : gestion de projets pour administrations publiques

**Gestion de projets - Gantt**
- 📊 **Diagramme de Gantt interactif** avec timeline visuelle
- 🔄 **Toggle MOIS/SEMAINES** : basculer entre vue mensuelle et hebdomadaire
- 📱 **Responsive design avancé** :
  - Desktop : Gantt complet avec scroll horizontal
  - Mobile : cartes empilées optimisées
- 🎨 **4 statuts colorés** : EN COURS, PLANIFIÉ, URGENT, TERMINÉ
- 📈 **Barres de progression** colorées selon le statut
- 📅 **Calcul automatique** : jours restants avant échéance
- ✏️ **Édition rapide** : clic sur barre/carte pour modifier
- 💾 **Stockage chiffré** : projets dans localStorage avec AES-256-GCM
- 📤 **Import/Export** : projets inclus dans les exports JSON

**Améliorations responsive**
- 📱 Vue mobile optimisée pour la rubrique Projets
- 🎴 Cartes empilées avec toutes les infos (dates, progression, statut)
- 🖥️ Gantt complet affiché uniquement sur desktop (≥1024px)
- 📏 Adaptation automatique selon la taille d'écran

### 🎨 Version 3.0 - Emerald Flux (Mars 2026)

**Design System**
- ✨ Refonte complète avec design system "Emerald Flux"
- 🎨 Nouvelle palette Emerald Green (#006c4a) professionnelle
- 📝 Typographie duale : Manrope + Inter
- 🌫️ Glassmorphisme sur les modaux
- 🔘 Gradients sur les boutons d'action

**Nouvelles fonctionnalités**
- ⏰ Indicateur de progression circulaire pour les deadlines
- 🔗 Bouton FSA header montrant l'état de liaison fichier JSON
- ⌨️ Support touche Entrée sur les champs mot de passe
- 📊 Compteurs sidebar mis à jour en temps réel
- 🧹 Dédoublonnage automatique des tâches

**Corrections de bugs**
- 🐛 Filtres d'urgence : texte visible avec dégradé CSS
- 🐛 Badge demandeur : suppression du doublon
- 🐛 Modal suppression : classe 'hidden' corrigée
- 🐛 Icône expand_more : padding suffisant
- 🐛 Protection anti-double-clic sur soumission
- 🐛 Vérification anti-archivage multiple

### ✨ Version 2.0 (Mars 2026)

1. ✅ Ajout des demandeurs PSS et ASG + types BO et Courriers
2. 📅 Affichage de la date de création des tâches
3. 📝 Champ "Date de demande" avec tri associé
4. ✏️ Suivi de la date de modification
5. ⚡ Bouton "Réalisé" sur chaque cartouche
6. 📝 Support Markdown dans les descriptions
7. 🔢 Modification de l'ordre/index des tâches
8. 📄 Pagination de la liste (12 tâches par page)
9. 🔍 Moteur de recherche en temps réel
10. 📦 Gestionnaire de versions logicielles (modal)
11. 🔄 Tâches récurrentes avec fréquences paramétrables
12. 📎 Association de fichiers aux tâches (images, PDF, docs)

---

## Roadmap future (suggestions)

### Fonctionnalités potentielles

- 🔔 **Notifications navigateur** : rappels pour deadlines approchantes
- 📊 **Graphiques avancés** : statistiques visuelles (Chart.js)
- 🏷️ **Tags personnalisés** : étiquettes libres sur tâches
- 📋 **Templates de tâches** : modèles pré-remplis réutilisables
- 🔗 **Liens entre tâches** : dépendances et relations
- 📱 **PWA** : installation comme application mobile
- 🌐 **Multi-langues** : support i18n (EN, FR, ES, DE)
- 👥 **Collaboration** : partage sécurisé entre utilisateurs
- 📆 **Vue calendrier** : affichage type agenda
- 🎨 **Thèmes personnalisés** : palettes de couleurs au choix

---

## Licence

MIT License - Frédérick MURAT - Mars 2026

Vous êtes libre d'utiliser, modifier et distribuer ce logiciel. Aucune garantie n'est fournie.
