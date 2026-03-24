# TaskMDA 🏛️

Application web de gestion de tâches et projets 100% locale, sans serveur ni base de données. Toutes les données sont chiffrées dans le navigateur avant d'être stockées dans le `localStorage`.

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
- **Champs étendus** : demandeur (S3AD, SE2S, MDA, PSS, ASG, Autres), type de demande (SOLIS, MULTIGEST, BO, Courriers, Autres), date de demande
- **Ordre/Index manuel** : possibilité de définir un ordre personnalisé (ex: 2026-1, 2026-2, etc.)
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
  - Type de tâche obligatoire
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
- **Moteur de recherche** : recherche en temps réel dans titre, description, demandeur, type
- **Filtrage avancé** : par urgence (Faible, Moyenne, Haute)
- **Tri multiple** : ordre manuel, date d'ajout, date de demande, deadline, urgence
- **Pagination** : affichage par lots de 12 tâches
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
- **Toggle MOIS/SEMAINES** : affichage par mois ou par semaines
  - Vue mois : colonnes mensuelles avec année
  - **Vue semaines** : header sur deux lignes (mois + année / numéros de semaines)
- **Statuts colorés** :
  - 🟢 EN COURS (#006c4a) - projet actif
  - 🔵 PLANIFIÉ (#6366f1) - projet à venir
  - 🔴 URGENT (#ef4444) - projet urgent
  - ⚪ TERMINÉ (#9ca3af) - projet complété
- **Informations projet** :
  - Nom, dates de début/fin, progression (0-100%)
  - Description détaillée
  - Demandeurs multiples
  - Calcul automatique des jours restants
- **Actions rapides** :
  - ✏️ **Édition** : modifier le projet
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
- **Templates personnalisables** : modèles d'emails pour tâches complétées et demandes de renseignements
- **Variables dynamiques** :
  - `{{TITLE}}` : titre de la tâche
  - `{{REQUESTER}}` : demandeur
  - `{{TYPE}}` : type de tâche
  - `{{URGENCY}}` : niveau d'urgence
  - `{{STATUS}}` : statut
  - `{{DEADLINE}}` : date limite
  - `{{COMMENT}}` : commentaire
- **Configuration dans Paramètres** : personnalisation des sujets et corps des emails
- **Boutons d'envoi rapide** : directement depuis les cartouches de tâches

### 📦 Gestion des versions logicielles
- **Registre des versions** : suivi des versions de SOLIS, MULTIGEST, BO, etc.
- **Interface dédiée** : modal élégante pour ajouter/modifier/supprimer les versions
- **Stockage chiffré** : versions sauvegardées avec chiffrement AES-256-GCM
- **Accès rapide** : depuis l'onglet Import/Export

### 🔒 Sécurité et données
- **Chiffrement AES-256-GCM** — les données ne quittent jamais votre appareil
- **Dérivation de clé PBKDF2-SHA256** (310 000 itérations, conforme OWASP 2024)
- **Verrouillage / déverrouillage** par mot de passe à chaque session
- **Support clavier** : touche Entrée pour valider le mot de passe
- **Affichage/masquage** : bouton œil pour voir le mot de passe en clair
- **Import JSON** et **export JSON / Excel** (.xlsx)
  - **Export Excel multi-feuilles** : tâches sur une feuille, projets sur une autre
  - Fichier nommé `TaskMDA_Export.xlsx`
  - Toast affichant le nombre de tâches et projets exportés
- **Sauvegarde automatique** sur disque (File System Access API - Chrome/Edge)
- **Indicateur FSA** : bouton header montrant l'état de liaison au fichier JSON
  - 🔴 Orange : non lié
  - 🟢 Vert : lié et synchronisé
  - ⚠️ Gris : non supporté (Firefox)
- **Dédoublonnage automatique** : suppression des tâches dupliquées au chargement
- **Protection anti-double-clic** : évite les créations/suppressions multiples accidentelles

### 📊 Statistiques et suivi
- **Tableau de bord enrichi** :
  - Total des tâches actives
  - Nombre de tâches urgentes
  - Tâches complétées (archives)
  - Projets actifs avec statistiques
  - Résumé textuel intelligent
- **Indicateurs visuels** : badges d'urgence (🌿/⚠️/🔥), statut, demandeur, type, récurrence
- **Compteurs temps réel** : mise à jour instantanée des badges sidebar après chaque action
- **Affichage des dernières tâches et projets** sur le dashboard
- **Barre de progression circulaire** : visualisation de l'approche de la deadline avec tooltip informatif
- **Cartes projets sur Dashboard** : aperçu rapide avec boutons d'action (éditer, archiver, supprimer)

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
| Import/Export JSON | ✅ | Format TaskMDA v4 |
| Export Excel | ✅ | Multi-feuilles (tâches + projets) |
| File System Access API | ✅ | Sauvegarde auto Chrome/Edge |
| Indicateur FSA header | ✅ | États colorés (vert/orange/gris) |
| Compteurs sidebar dynamiques | ✅ | Mise à jour temps réel |
| Design Emerald Flux | ✅ | Complet avec glassmorphisme |
| Responsive design | ✅ | Desktop, tablette, mobile |
| Gestionnaire de versions | ✅ | Modal avec CRUD complet |

### 🆕 Fonctionnalités NON documentées (nouvelles)

| Fonctionnalité | Description | Importance |
|---|---|---|
| **Mode sombre** | Thème sombre harmonieux avec palette cohérente | ⭐⭐⭐ |
| **Mode contraste renforcé** | Amélioration accessibilité | ⭐⭐⭐ |
| **Validation formulaires** | Messages d'erreur explicites + focus automatique | ⭐⭐⭐ |
| **Vue semaines 2 lignes** | Header Gantt avec mois et semaines séparés | ⭐⭐ |
| **Actions rapides projets** | Boutons éditer/archiver/supprimer au survol | ⭐⭐⭐ |
| **Tooltip titre projet** | Affichage titre complet si tronqué | ⭐⭐ |
| **Notifications email** | Templates personnalisables avec variables | ⭐⭐⭐ |
| **Demandeurs multiples projets** | Support de plusieurs demandeurs par projet | ⭐⭐ |
| **Refresh Dashboard après édition** | Synchronisation automatique des vues | ⭐⭐ |
| **Export Excel amélioré** | Feuilles séparées + compteur toast | ⭐⭐ |
| **Badges lisibles mode sombre** | Contraste optimisé pour tous les badges | ⭐⭐⭐ |
| **Toast harmonisé** | Fond vert avec glassmorphisme | ⭐ |

### 📝 Écarts entre documentation et implémentation

| Élément documenté | État réel | Action |
|---|---|---|
| "Affichage des 6 dernières tâches" | Nombre variable selon l'espace | ✅ Corrigé dans nouveau README |
| Vue semaines simple ligne | Maintenant sur 2 lignes (mois + semaines) | ✅ Corrigé dans nouveau README |
| Export Excel simple | Maintenant multi-feuilles (tâches + projets) | ✅ Corrigé dans nouveau README |
| Pas de mode sombre | Mode sombre complet implémenté | ✅ Ajouté au nouveau README |
| Pas de validation formulaire | Validation complète avec messages | ✅ Ajouté au nouveau README |
| Projets sans actions rapides | Boutons éditer/archiver/supprimer | ✅ Ajouté au nouveau README |
| Pas de notifications email | Templates email personnalisables | ✅ Ajouté au nouveau README |

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

Aucune installation requise. Ouvrez simplement `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).

> ⚠️ Le chiffrement repose sur la **Web Crypto API**, disponible uniquement en contexte sécurisé (`https://` ou `localhost`). L'ouverture directe via `file://` peut ne pas fonctionner selon le navigateur.

Au premier lancement, vous devrez créer un mot de passe (4 caractères minimum). Ce mot de passe chiffre toutes vos données localement — **il n'est jamais stocké ni transmis**.

### File System Access API (Chrome/Edge uniquement)

Pour activer la sauvegarde automatique sur disque :
1. Aller dans **Paramètres** > **Sauvegarde automatique**
2. Cliquer sur **"Choisir un répertoire et lier le fichier JSON"**
3. Sélectionner un dossier et nommer le fichier (ex: `tasks.json`)
4. L'icône header devient verte 🟢 : toute modification est auto-sauvegardée

Le bouton header affiche en temps réel l'état de la liaison :
- 🔴 **Orange** : aucun fichier lié
- 🟢 **Vert** : fichier lié et synchronisé
- ⚠️ **Gris** : API non supportée (Firefox)

### Personnalisation de l'apparence

Dans **Paramètres** > **Apparence** :
1. Activer le **Mode sombre** pour un thème sombre harmonieux
2. Activer le **Contraste renforcé** pour améliorer la lisibilité
3. Les deux modes peuvent être combinés
4. Les préférences sont sauvegardées automatiquement

---

## Sécurité

| Élément | Détail |
|---|---|
| Algorithme | AES-256-GCM |
| Dérivation de clé | PBKDF2-SHA256, 310 000 itérations |
| Sel | 16 octets aléatoires, généré à la création |
| IV | 12 octets aléatoires par chiffrement |
| Stockage de la clé | En mémoire uniquement (jamais persistée) |
| Transit réseau | Aucun |
| Protection doublons | Dédoublonnage automatique au chargement |
| Protection double-clic | Variable de verrouillage lors des soumissions |

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
  "type": "SOLIS | MULTIGEST | BO | Courriers | Autres",
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
  "types": ["SOLIS", "MULTIGEST", "BO", "Courriers"],
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
  "format": "TaskMDA v4.5"
}
```

---

## Technologies utilisées

- **Vanilla JS (ES2022+)** — aucune dépendance JS applicative
- **Web Crypto API** (natif navigateur) — chiffrement AES-256-GCM
- **[SheetJS / xlsx](https://sheetjs.com/)** — export Excel multi-feuilles
- **[Marked.js](https://marked.js.org/)** — rendu Markdown
- **[Tailwind CSS](https://tailwindcss.com/)** — framework CSS utility-first avec dark mode
- **File System Access API** — sauvegarde automatique sur disque (Chrome/Edge)
- **Google Fonts** : Manrope (display), Inter (interface)
- **Material Symbols Outlined** — icônes Google

---

## Changelog

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
