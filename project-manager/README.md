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
- **Statuts colorés** :
  - 🟢 EN COURS (#006c4a) - projet actif
  - 🔵 PLANIFIÉ (#6366f1) - projet à venir
  - 🔴 URGENT (#ef4444) - projet urgent
  - ⚪ TERMINÉ (#9ca3af) - projet complété
- **Informations projet** :
  - Nom, dates de début/fin, progression (0-100%)
  - Description détaillée
  - Calcul automatique des jours restants
- **Édition rapide** : clic sur barre ou carte pour modifier
- **Responsive design** : adaptation automatique mobile/desktop
- **Stockage chiffré** : projets sauvegardés avec chiffrement AES-256-GCM

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
  - Résumé textuel intelligent
- **Indicateurs visuels** : badges d'urgence (🌿/⚠️/🔥), statut, demandeur, type, récurrence
- **Compteurs temps réel** : mise à jour instantanée des badges sidebar après chaque action
- **Affichage des 6 dernières tâches** sur le dashboard
- **Barre de progression circulaire** : visualisation de l'approche de la deadline avec tooltip informatif

---

## Améliorations UX/UI (Mars 2026)

### Interface modernisée
- ✨ **Design "Emerald Flux"** : palette raffinée, typographie duale, tonal layering
- 🎨 **Badges colorés** : urgence, statut, demandeur et type clairement identifiables
- 🔘 **Boutons avec gradients** : effet premium sur les actions principales
- 🌫️ **Glassmorphisme** : modaux avec fond flou et transparence
- 📱 **Responsive design** : adaptation tablette/mobile
- ⚡ **Animations fluides** : transitions et hover effects soignés

### Corrections et optimisations
- 🐛 **Fix filtres d'urgence** : dégradé CSS corrigé pour affichage correct du texte
- 🐛 **Fix badge demandeur** : suppression du doublon (affiché uniquement en bas)
- 🐛 **Fix boutons header** : notifications, aide et FSA fonctionnels
- 🐛 **Fix modal de suppression** : utilisation correcte de la classe 'hidden'
- 🐛 **Fix icône expand_more** : padding corrigé pour éviter le chevauchement avec le texte
- 🚀 **Compteurs sidebar dynamiques** : mise à jour instantanée après création/suppression/archivage
- 🛡️ **Protection doublons** : vérification anti-archivage multiple
- ⌨️ **Support clavier** : Entrée fonctionne sur les champs de mot de passe

---

## Structure des fichiers

```
├── index.html        — Interface utilisateur avec design Emerald Flux
├── app.js           — Logique applicative (crypto, CRUD, rendu, import/export)
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
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-03-20T15:30:00.000Z"
}
```

### Format d'export complet

```json
{
  "tasks": [...],
  "versions": {...},
  "projects": [...],
  "exportedAt": "2026-03-22T12:00:00.000Z",
  "format": "TaskMDA v4"
}
```

---

## Technologies utilisées

- **Vanilla JS (ES2022+)** — aucune dépendance JS applicative
- **Web Crypto API** (natif navigateur) — chiffrement AES-256-GCM
- **[SheetJS / xlsx](https://sheetjs.com/)** — export Excel
- **[Marked.js](https://marked.js.org/)** — rendu Markdown
- **[Tailwind CSS](https://tailwindcss.com/)** — framework CSS utility-first
- **File System Access API** — sauvegarde automatique sur disque (Chrome/Edge)
- **Google Fonts** : Manrope (display), Inter (interface)
- **Material Symbols Outlined** — icônes Google

---

## Changelog

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

## Licence

MIT License - Frédérick MURAT - Mars 2026

Vous êtes libre d'utiliser, modifier et distribuer ce logiciel. Aucune garantie n'est fournie.
