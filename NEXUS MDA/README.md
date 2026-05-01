# NEXUS MDA

> Application web de gestion de projets et de tâches collaborative et locale, sans serveur requis.

[![Version](https://img.shields.io/badge/version-2.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Platform](https://img.shields.io/badge/platform-Web-brightgreen.svg)]()
[![Author](https://img.shields.io/badge/author-Frédérick%20MURAT-blue.svg)]()

---

## 📋 Table des matières

- [Présentation](#-présentation)
- [Démarrage rapide](#-démarrage-rapide)
- [Fonctionnalités principales](#-fonctionnalités-principales)
- [Architecture technique](#-architecture-technique)
- [Nouveautés récentes](#-nouveautés-récentes)
- [Documentation](#-documentation)
- [Support](#-support)

---

## 🎯 Présentation

**NEXUS MDA** est une solution complète de gestion de projets, de tâches et de workflows organisationnels, conçue pour fonctionner en mode autonome ou collaboratif sans infrastructure serveur. L'application s'exécute entièrement dans le navigateur avec persistance locale et synchronisation collaborative optionnelle via dossier partagé.

### Caractéristiques distinctives

- ✅ **Aucun serveur requis** - Architecture 100% client
- 🔒 **Sécurité renforcée** - Chiffrement local AES-256-GCM
- 🤝 **Collaboration simplifiée** - Synchronisation via dossier partagé
- 📱 **Responsive** - Interface adaptative mobile/tablette/desktop
- 🎨 **Personnalisable** - Thèmes et configurations utilisateur

---

## 🚀 Démarrage rapide

### Prérequis

- Navigateur moderne : **Google Chrome** ou **Microsoft Edge** (recommandé)
- Espace de stockage local disponible (IndexedDB)
- *(Optionnel)* Dossier partagé réseau pour collaboration

### Installation

1. **Télécharger** ou cloner le projet dans un répertoire local
2. **Ouvrir** le fichier [`taskmda-team.html`](./taskmda-team.html) dans votre navigateur
3. **Créer** votre mot de passe local lors de la première utilisation
4. *(Optionnel)* **Configurer** un dossier partagé pour activer la synchronisation

### Configuration collaborative (optionnelle)

1. Accéder au menu utilisateur → **Lier un dossier partagé**
2. Sélectionner un dossier accessible par les membres de l'équipe
3. Autoriser l'accès (File System Access API)
4. La synchronisation automatique est activée

> **Note** : La liaison au dossier est persistante et se reconnecte automatiquement au démarrage si les permissions sont valides.

---

## ⚡ Fonctionnalités principales

### 📊 Gestion de projets

- **Création** de projets solo ou collaboratifs
- **Vues multiples** : liste, kanban, timeline, calendrier
- **Éditeur enrichi** : insertion d'images, titres hiérarchiques (H1/H2/H3)
- **Gestion documentaire** : versionnement et association aux tâches
- **Discussion** et fil d'activité par projet

### ✅ Gestion des tâches

- **CRUD complet** avec sous-tâches et progression
- **Tâches récurrentes** : hebdomadaire, mensuelle, annuelle
- **Archivage** et restauration avec historique
- **Conversion** tâche → projet en un clic
- **Vues transverses** : consolidation multi-projets

### 🗂️ Organisation

#### Workflow organisationnel

Vue complète de l'organisation avec :
- **Cartographie métier** : services, groupes, processus
- **Organigramme** interactif avec hiérarchies
- **Modélisation de processus** : concepteur visuel par blocs
- **Flux non-linéaires** : branches conditionnelles, parallélisme
- **Gouvernance** : validation multi-niveaux, quorum
- **Plans de contingence** : gestion de crise et exercices
- **Analyses avancées** : matrices croisées, détection d'anomalies

#### Référentiels

- **Thématiques** et groupes métier réutilisables
- **Versions logicielles** : registre centralisé
- **Annuaire ESMS** : recherche PA/PH via FINESS
- **Générateur d'emails** : templates personnalisables
- **Surveillance de fichiers** : monitoring automatique

### 🔐 RGPD

- **Registre des traitements** : création, validation, archivage
- **Détection automatique** depuis contenus métier
- **Contrôles** et audits de conformité
- **Liaisons contextuelles** : projet, tâche, workflow
- **Exports** JSON/CSV pour reporting

### 📝 Collaboration

- **Membres** et invitations utilisateurs
- **Groupes** métier et utilisateurs
- **RBAC** : owner, manager, member
- **Rôles globaux** : admin application, manager workflow
- **Messagerie** directe inter-agents
- **Fil d'info** : posts collaboratifs avec mentions

### 📄 Gestion documentaire

- **Stockage hybride** : local (IndexedDB) ou disque partagé
- **Éditeur intégré** : texte, HTML, Markdown, tableur
- **Aperçu** : images, PDF, Office, texte
- **Versionnement** et métadonnées enrichies
- **Drag & drop** généralisé

### 🔔 Notifications

- **Centre de notifications** intégré
- **Alertes proactives** : mentions, affectations, validations
- **Surveillance de fichiers** : changements détectés en temps réel

---

## 🏗️ Architecture technique

### Stack technologique

- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Persistance** : IndexedDB (event-sourcing)
- **Synchronisation** : File System Access API
- **Sécurité** : Web Crypto API (AES-256-GCM)
- **Éditeur** : Quill.js
- **Graphiques** : Charting intégré
- **Tableur** : Tabulator + SheetJS

### Architecture modulaire

L'application est structurée en modules spécialisés :

#### Modules métier
- `taskmda-project.js` - Domaine projets
- `taskmda-task-lifecycle-domain.js` - Cycle de vie des tâches
- `taskmda-workflow.js` - Orchestration workflow
- `taskmda-global.js` - Domaines transverses (notes, docs, feed)
- `taskmda-doc.js` - Gestion documentaire complète
- `taskmda-hierarchy.js` - Epic/Feature

#### Modules fonctionnels
- `taskmda-crypto.js` - Chiffrement et sécurité
- `taskmda-calendar.js` - Calendrier transverse
- `taskmda-recurrence.js` - Tâches récurrentes
- `taskmda-notifications.js` - Centre de notifications
- `taskmda-via-annuaire.js` - Annuaire ESMS
- `taskmda-email-generator.js` - Générateur emails
- `taskmda-file-watcher.js` - Surveillance fichiers
- `taskmda-document-storage.js` - Stockage documents

#### Modules infrastructure
- `taskmda-core-utils.js` - Utilitaires purs
- `taskmda-runtime-contract.js` - Contrat d'orchestration
- `taskmda-shell.js` - Shell transverse
- `taskmda-app-init.js` - Initialisation
- `taskmda-ui.js` - Composants UI
- `taskmda-theme.js` - Gestion des thèmes
- `taskmda-editor.js` - Éditeur Quill

### Base de données

**Nom** : `taskmda-team-standalone`
**Version du schéma** : `DB_VERSION = 21`

#### Stores principaux

| Store | Description |
|-------|-------------|
| `events` | Event-sourcing projets |
| `snapshots` | États projetés |
| `globalTasks` | Tâches transverses |
| `globalDocs` | Documents transverses |
| `globalNotes` | Notes collaboratives |
| `globalPosts` | Fil d'information |
| `workflowProcesses` | Processus métier |
| `workflowAgents` | Agents organisationnels |
| `rgpdActivities` | Registre RGPD |
| `fileWatchers` | Surveillance fichiers |

*Voir section complète dans le fichier pour liste exhaustive (40+ stores)*

### Synchronisation collaborative

#### Mécanisme

1. **Écriture locale immédiate** (IndexedDB)
2. **Réplication asynchrone** vers dossier partagé
3. **Détection des changements** à l'ouverture
4. **Fusion intelligente** avec résolution de conflits

#### Structure du dossier partagé

```
projects/
  <projectId>/
    events/
      <timestamp>.json
    shared-key.json
```

#### Sécurité

- Clé partagée AES-256 par projet
- Double chiffrement : local + transport
- Format `v1-e2e-encrypted`
- Rétrocompatibilité JSON clair

---

## 🆕 Nouveautés récentes

### Avril 2026

#### 🗂️ Surveillance de fichiers

Nouveau module complet de monitoring automatique :
- Observateurs configurables par dossier
- Polling automatique (30s à 1h)
- Détection création/modification/suppression
- Support multi-formats (Excel, Word, PDF, CSV, images)
- Mode récursif pour sous-dossiers
- Notifications temps réel
- Historique complet avec filtres

#### 📧 Générateur d'emails

Templates personnalisables avec :
- Variables dynamiques (`{{app_name}}`, `{{user_name}}`, etc.)
- Éditeur riche HTML
- Export HTML/texte
- Ouverture `mailto:` pré-remplie

#### 📝 Notes collaboratives

Rubrique dédiée avec :
- Notes privées vs transverses
- Éditeur riche (Quill)
- Favoris et export HTML/ZIP
- Publication dans le fil d'info
- Sélection multiple et actions groupées

#### 📊 Workflow KPI

Vue synthétique de pilotage :
- Volumétrie et complétion
- Répartitions statut/priorité
- Charge par agent (top 8)
- Exports PDF/CSV

#### 🎨 Harmonisation UX

- Mode d'affichage boutons (icône/texte/mixte)
- Infobulles harmonisées
- Fermeture modale au clic externe
- Édition inline généralisée
- Couleur chrome personnalisable

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`QUICKSTART.md`](docs/QUICKSTART.md) | Guide de démarrage rapide |
| [`CHANGELOG.md`](CHANGELOG.md) | Historique des versions |
| [`QA_REGRESSION_CHECKLIST.md`](docs/QA_REGRESSION_CHECKLIST.md) | Checklist de tests |
| [`RECURRENCE.md`](docs/RECURRENCE.md) | Tâches récurrentes (détails) |
| [`FILE_WATCHER.md`](docs/FILE_WATCHER.md) | Surveillance fichiers (technique) |
| [`QUICKSTART_FILE_WATCHER.md`](docs/QUICKSTART_FILE_WATCHER.md) | Surveillance fichiers (guide) |

---

## 🔒 Sécurité

### Chiffrement

- **Algorithme** : AES-256-GCM
- **Dérivation clés** : PBKDF2-SHA256
- **Standards** : OWASP 2024
- **Zero-knowledge** : données chiffrées en transit et au repos

### Confidentialité

- Aucune donnée transmise à des tiers
- Stockage 100% local ou réseau partagé
- Clés en mémoire uniquement (jamais sur disque)
- Verrouillage par mot de passe utilisateur

### Récupération

- Clé de récupération générée automatiquement
- Affichage et régénération depuis profil utilisateur
- Restauration d'accès en cas d'oubli

---

## 🧪 Tests recommandés

### Checklist fonctionnelle

- ✅ Navigation : dashboard, projets, tâches, calendrier, documents
- ✅ CRUD : projet, tâche, document, calendrier
- ✅ Récurrence : création et affichage des tâches récurrentes
- ✅ Workflow : CRUD entités, modèles, gouvernance, kanban
- ✅ Collaboration : membres, invitations, groupes, permissions
- ✅ Communication : notifications, emails, fil d'info
- ✅ Responsive : mobile, tablette, desktop
- ✅ Persistance : refresh, cohérence IndexedDB

### Non-régression

Consulter [`docs/QA_REGRESSION_CHECKLIST.md`](docs/QA_REGRESSION_CHECKLIST.md) pour la checklist détaillée.

---

## ⚠️ Limites connues

| Limitation | Description |
|------------|-------------|
| **SMTP** | Pas d'envoi email natif (utilisation `mailto:`) |
| **Authentification** | Pas d'authentification centralisée (application locale) |
| **Collaboration** | Dépendante du dossier partagé et permissions poste |
| **Navigateur** | Optimisé pour Chrome/Edge (File System Access API) |

---

## 💡 Débogage

### Mode debug

Activer les logs console :

```javascript
localStorage.setItem('taskmda_debug', '1')
```

Désactiver :

```javascript
localStorage.removeItem('taskmda_debug')
```

### Indicateur de synchronisation

L'icône dans le header indique l'état de synchronisation :
- 🔄 Rotation : synchronisation en cours
- ⏳ En attente : fichiers en file
- ❌ Erreur : échec de synchronisation

---

## 🤝 Support

Pour toute question ou problème :

1. Consulter la [documentation](#-documentation)
2. Vérifier les [limites connues](#️-limites-connues)
3. Activer le [mode debug](#-débogage)
4. Contacter l'équipe de support interne

---

## 📄 Licence

MIT License

Copyright (c) 2026 Frédérick MURAT

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🎯 Feuille de route

### Évolutions envisagées

- Modal "Rejoindre un projet partagé" avec scanner automatique
- Export/import de clés (fichier .key)
- Interface de gestion des clés partagées
- Rotation automatique des clés
- Révocation de membres
- Notifications temps réel (WebSocket/SSE)

---

<p align="center">
  <strong>NEXUS MDA</strong> - Gestion de projets collaborative sans serveur<br>
  Version 2.0 - Avril 2026<br>
  <br>
  Créé par <strong>Frédérick MURAT</strong><br>
  Licence MIT © 2026
</p>
