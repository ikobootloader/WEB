# Contingence Local - Vanguard Command Center

> Application web locale de gestion des plans de contingence pour organisations publiques et services d'urgence. 100% hors-ligne, sans serveur, sans dépendances npm.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.txt)
[![Made with](https://img.shields.io/badge/made%20with-Vanilla%20JS-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## 📋 Table des matières

- [Nouveautés v1.0.0](#-nouveautés-v100)
- [Aperçu](#-aperçu)
- [Fonctionnalités](#-fonctionnalités)
- [Démarrage rapide](#-démarrage-rapide)
- [Architecture](#-architecture)
- [Design System](#-design-system-vanguard)
- [Sauvegarde automatique](#-sauvegarde-automatique-fsa)
- [Structure des plans](#-structure-des-plans)
- [Exports & Imports](#-exports--imports)
- [Mode Urgence](#-mode-urgence-centre-de-crise)
- [Plans Pré-Configurés](#-plans-pré-configurés-disponibles)
- [Compatibilité navigateurs](#-compatibilité-navigateurs)
- [Documentation](#-documentation)
- [Licence](#-licence)

---

## 🆕 Nouveautés v1.1.0 (Phase 1)

### Schéma des Plans Enrichi
**4 nouveaux champs** pour améliorer la gestion de crise (basé sur retour d'analyse professionnelle) :
- 🎯 **Priorité d'activation** (1-5) - Priorisation inter-plans en cas de crises multiples
- ⚖️ **Matrice décisionnelle** - Qui décide quoi ? (décision | responsable | backup)
- 📡 **Canaux de communication** - Comment communiquer ? (type | fréquence | destinataires | template)
- ✅ **Critères de sortie de crise** - KPI de retour à la normale (critère | indicateur | cible)

### Persistance du Mode Crise (v1.0.0)
Le mode urgence a été considérablement amélioré avec une **persistance complète** :
- 🕐 **Chronomètre continu** - Continue de compter même après fermeture du navigateur
- 💾 **Restauration automatique** - Le centre de crise se recharge automatiquement au redémarrage
- ✅ **État checklist sauvegardé** - Les cases cochées sont préservées par plan
- 🔴 **Indicateur TopBar** - Badge rouge permanent tant que le mode crise est actif

### Nouveaux Plans Pré-Configurés (v1.0.0)
**5 nouveaux plans** pour administrations publiques dans [nouveaux-plans.json](nouveaux-plans.json) :
- ⚡ Coupure électrique prolongée sur site stratégique (Critique)
- 📢 Crise médiatique et communication de crise (Importante)
- 📁 Défaillance système GED (Importante)
- 🚨 Menace sécuritaire ou intrusion malveillante (Critique)
- 🌊 Pollution environnementale accidentelle (Importante)

### Améliorations UX (v1.0.0)
- 🔝 **Auto-scroll** - La page remonte automatiquement lors des changements de vue
- 🏷️ **Branding dynamique** - Le nom personnalisé apparaît dans le fil d'Ariane du mode crise
- 🔘 **Navigation checklist** - Le bouton "Voir Protocole Complet" ouvre directement le plan dans l'éditeur

---

## 🎯 Aperçu

**Contingence Local** est une application web monopage (SPA) permettant de créer, gérer et consulter des plans de contingence critiques entièrement dans le navigateur. Conçue pour les collectivités territoriales et services d'urgence français, elle offre :

- ✅ **100% Local** - Aucun serveur, aucune connexion réseau requise
- ✅ **Sauvegarde automatique** - File System Access API pour backup en temps réel
- ✅ **Mode Crise Persistant** - Interface tactique qui survit aux redémarrages navigateur
- ✅ **Chronomètre continu** - Le timer continue automatiquement entre les sessions
- ✅ **15 plans pré-configurés** - Templates MDA et administration publique prêts à l'emploi
- ✅ **Personnalisable** - Nom d'application et branding configurables
- ✅ **Multi-formats** - Exports JSON, CSV/Excel, PDF et impression
- ✅ **Accessible** - Raccourcis clavier, ARIA, Material Design 3

**Cas d'usage typiques :**
- Maisons Départementales de l'Autonomie (MDA/MDPH)
- Services départementaux de gestion de crise
- Plans Communaux de Sauvegarde (PCS)
- Plans de Continuité d'Activité (PCA) métiers

---

## ✨ Fonctionnalités

### Gestion Complète des Plans (CRUD)

- **Création guidée** - Formulaire structuré avec 20+ champs spécialisés
- **Édition avancée** - Validation en temps réel, métadonnées complètes
- **Duplication rapide** - Créer des variantes à partir de plans existants
- **Archivage logique** - Conservation de l'historique sans suppression
- **Recherche plein texte** - Filtrage instantané sur tous les champs
- **Filtres multiples** - Par catégorie, criticité, statut

### Catégories de Plans (10 types prédéfinis)

1. 🔒 Cyberattaque / perte de données
2. 💻 Panne informatique majeure
3. 📡 Indisponibilité réseau / télécom
4. 🏢 Sinistre bâtiment
5. 👥 Indisponibilité massive du personnel
6. 🌪️ Catastrophe naturelle
7. 🚨 Crise sécuritaire
8. 📦 Défaillance prestataire critique
9. ⚡ Rupture énergétique
10. 📝 Plan libre / personnalisé

### Niveaux de Criticité

- 🟢 **Basse** - Impact limité, délai de réponse souple
- 🟡 **Moyenne** - Impact modéré, réponse sous quelques heures
- 🟠 **Haute** - Impact significatif, réponse rapide requise
- 🔴 **Critique** - Impact majeur, activation immédiate en mode crise

### Multi-Vues Spécialisées

#### 1. 📊 Tableau de Bord
- Statistiques globales (total plans, plans critiques)
- Indicateur de dernière sauvegarde
- Bouton d'activation mode urgence
- Actions rapides (Nouveau plan, Export, Import)

#### 2. 📁 Explorateur de Plans
- Liste complète avec badges de statut
- Recherche et filtres avancés
- Tri par catégorie, criticité, date de mise à jour
- Aperçu rapide des métadonnées

#### 3. ✏️ Éditeur de Plan
- Interface structurée en sections logiques
- Sauvegarde automatique (Ctrl+S)
- Boutons d'action : Dupliquer, Archiver, Supprimer
- Exports individuels (JSON, CSV, PDF, Impression)

#### 4. 🚨 Centre de Crise (Mode Urgence)
- **Sélection de plan critique** - Grille visuelle avec icônes catégorielles
- **Chronomètre en temps réel** - Temps écoulé depuis activation
- **⭐ Persistance totale** - Le mode crise survit aux redémarrages navigateur
  - Chronomètre continue automatiquement depuis l'activation initiale
  - Plan actif restauré au redémarrage
  - État checklist préservé par plan
  - Indicateur permanent en TopBar tant que mode actif
- **Checklist interactive** - Actions 0-30 min avec cases à cocher et sauvegarde automatique
- **Contacts stratégiques** - Avatars et boutons d'appel direct
- **Carte tactique** - Visualisation des zones d'impact
- **Services critiques** - Indicateurs de statut avec barres de progression
- **Flux en temps réel** - Défilement continu des événements
- **Bouton de sortie** - Désactivation avec confirmation

#### 5. ⚙️ Paramètres
- **Personnalisation** - Nom et sous-titre de l'application
- **Sauvegarde automatique** - Liaison dossier FSA, backup manuel
- **Exports globaux** - JSON complet, CSV, PDF de tous les plans
- **Import** - Upload JSON avec prévisualisation et validation

---

## 🚀 Démarrage rapide

### Prérequis

- Navigateur moderne : **Chrome 86+** ou **Edge 86+** (recommandé pour FSA)
- Aucune installation, aucun serveur requis

### Installation

1. **Télécharger** le dossier `CONTINGENCE/`
2. **Ouvrir** le fichier `index.html` dans Chrome/Edge
3. **(Optionnel)** Pour le service worker, servir via HTTP local :
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js (avec npx)
   npx http-server -p 8000
   ```

### Configuration initiale recommandée

1. **Paramètres** → **Sauvegarde Automatique** → **Lier un Dossier**
2. Sélectionner un dossier sur votre ordinateur (ex: `Documents/Contingence_Backup/`)
3. Autoriser l'accès en lecture/écriture
4. Les plans seront désormais sauvegardés automatiquement en JSON

### Premiers pas

1. **Importer des plans pré-configurés** (optionnel) :
   - **Plans MDA** - Paramètres → Import → Sélectionner `plans-mda-import.json`
     - 10 plans pour Maison Départementale de l'Autonomie
   - **Plans Administration Publique** - Paramètres → Import → Sélectionner `nouveaux-plans.json`
     - 5 plans critiques et importants pour collectivités
     - Coupure électrique, crise médiatique, défaillance GED, menace sécuritaire, pollution
   - Prévisualiser les plans avant import
   - Cliquer "Importer en fusion"

2. **Créer un nouveau plan** :
   - Dashboard → Bouton "Nouveau Plan" (orange)
   - Remplir les champs du formulaire
   - `Ctrl+S` pour enregistrer

3. **Activer le mode crise** :
   - Cliquer sur "URGENCE" dans la navigation latérale
   - Sélectionner un plan critique dans la grille
   - Le centre de commandement tactique s'active
   - Le chronomètre démarre automatiquement
   - **Le mode crise persiste** - même si vous fermez le navigateur, il reprendra où vous en étiez

---

## 🏗️ Architecture

### Stack Technique

```
Frontend:     HTML5, CSS3, Vanilla JavaScript (ES6+)
Stockage:     IndexedDB (natif navigateur)
Backup:       File System Access API (Chrome/Edge)
Icônes:       Google Material Symbols
Typographie:  Inter (Google Fonts)
Offline:      Service Worker (sw.js)
Design:       Material Design 3 (tokens custom)
```

### Structure des Fichiers

```
CONTINGENCE/
├── index.html              # SPA principale (5 vues)
├── app.js                  # Logique applicative (2500+ lignes)
├── db.js                   # Wrapper IndexedDB
├── fsa.js                  # Module File System Access
├── sw.js                   # Service Worker
├── styles/
│   ├── design-tokens.css   # Variables Material Design 3
│   ├── vanguard-core.css   # Composants (buttons, cards, etc.)
│   ├── vanguard-layouts.css # Grilles et layouts asymétriques
│   └── vanguard-print.css  # Styles d'impression
├── model/                  # Design inspirations
│   └── vanguard_*/
├── plans-mda-import.json   # 10 plans MDA prêts à importer
├── nouveaux-plans.json     # 5 plans administration publique
└── Documentation/
    ├── projet.md           # Spécification complète
    ├── REFONTE-UX.md       # Alignement design system
    ├── SAUVEGARDE_FSA.md   # Guide utilisateur FSA
    └── ROADMAP-CRITIQUE.md # Améliorations futures
```

### Base de Données IndexedDB

**Nom:** `contingence_local_db` (version 1)

**Object Stores:**

| Store | Clé | Index | Description |
|-------|-----|-------|-------------|
| `plans` | `id` | category, criticality, status, updatedAt | Plans de contingence |
| `settings` | `key` | - | Configuration application |
| `exportsHistory` | auto-increment | createdAt | Historique exports |
| `auditLog` | auto-increment | timestamp | Journal d'audit |

**Clés Settings importantes :**

| Clé | Type | Description |
|-----|------|-------------|
| `appName` | string | Nom personnalisé de l'application |
| `appSubtitle` | string | Sous-titre personnalisé |
| `activeCrisisPlanId` | string | ID du plan actuellement actif en mode crise |
| `crisisActivatedAt` | timestamp | Date/heure d'activation du mode crise (pour chronomètre) |
| `checklist_state_${planId}` | object | État des cases cochées par plan (format: `{0: true, 1: false, ...}`) |
| `fsaDirectoryHandle` | FileSystemDirectoryHandle | Handle du dossier de sauvegarde automatique |

---

## 🎨 Design System: Vanguard

### Philosophie

**"Vigilant Sentinel"** - Interface d'autorité calme sous pression

- **Editorial Structuralism** - Hiérarchie typographique agressive
- **Tonal Authority** - Profondeur par couleur, pas par bordures
- **No-Line Rule** - Limites via changements de surface uniquement
- **Glassmorphism** - Éléments flottants avec blur backdrop

### Palette de Couleurs (Material Design 3)

```css
--primary:              #00204F  /* Navy - Commandement */
--primary-container:    #1A3668  /* Container sombre */
--secondary:            #555E74  /* Gris équilibré */
--tertiary:             #351C00  /* Marron */
--tertiary-fixed-dim:   #F39200  /* Orange - Action haute visibilité */
--error:                #BA1A1A  /* Rouge - Alertes critiques */
--background:           #FAF8FE  /* Surface principale claire */
--surface-container-*:  5 niveaux de profondeur hiérarchique
```

### Typographie (Inter)

| Niveau | Taille | Usage |
|--------|--------|-------|
| Display | 3.5rem - 2.25rem | Métriques dashboard |
| Headline | 2rem - 1.5rem | Titres de section |
| Title | 1.375rem - 0.875rem | Sous-sections |
| Body | 1rem - 0.75rem | Contenu texte |
| Label | 0.875rem - 0.625rem | Métadonnées (UPPERCASE) |

### Système d'Espacement

Base: **4px** | Scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px

### Border Radius

`sm: 4px` | `md: 8px` | `lg: 12px` | `xl: 16px` | `full: 9999px`

---

## 💾 Sauvegarde Automatique (FSA)

### File System Access API

**Stratégie de double protection :**

1. **Couche 1 : IndexedDB** (navigateur)
   - Stockage primaire dans le navigateur
   - Accès rapide, recherche indexée
   - Peut être effacé si cache navigateur vidé

2. **Couche 2 : Fichiers locaux** (FSA)
   - Sauvegarde automatique sur disque dur
   - 3 fichiers JSON créés/mis à jour automatiquement
   - Récupérable même si navigateur réinitialisé

### Fichiers Créés

```
📁 Dossier lié (ex: Documents/Contingence_Backup/)
├── contingence-backup.json      # Backup complet (plans + settings)
├── contingence-plans.json       # Liste des plans uniquement
└── contingence-metadata.json    # Métadonnées (date, compteurs)
```

### Déclenchement Automatique

La sauvegarde FSA s'exécute automatiquement après :
- ✅ Création d'un plan
- ✅ Modification d'un plan
- ✅ Suppression d'un plan
- ✅ Duplication
- ✅ Archivage
- ✅ Import de plans

### Configuration

1. Paramètres → **Sauvegarde Automatique**
2. Cliquer **"Lier un Dossier de Sauvegarde"**
3. Sélectionner dossier (permissions lecture/écriture requises)
4. Confirmer → Badge vert "SAUVEGARDE ACTIVE" apparaît en TopBar

**Note :** Firefox ne supporte pas FSA. Utilisez Chrome/Edge pour cette fonctionnalité.

---

## 📄 Structure des Plans

Chaque plan de contingence contient **25+ champs structurés** :

### Identité & Métadonnées

```javascript
{
  id: "plan-cyber-001",              // Identifiant unique
  title: "Cyberattaque ransomware",  // Titre (max 180 car.)
  category: "cyberattaque",          // Catégorie (10 types)
  criticality: "critique",           // basse|moyenne|haute|critique
  priority: 5,                       // 1-5 : Priorité d'activation (🆕 v1.1)
  status: "valide",                  // brouillon|valide|archive
  version: 1,                        // Numéro de version
  createdAt: "2026-03-28T10:00:00Z", // Date création ISO
  updatedAt: "2026-03-28T15:30:00Z"  // Dernière modification
}
```

### Analyse de Scénario

- **Summary** - Vue d'ensemble de la situation
- **Scenario** - Description détaillée du contexte
- **Triggers** - Conditions de déclenchement (tableau)
- **Impacts** - Conséquences potentielles (tableau)

### Procédures Opérationnelles

- **Services** - Services/départements affectés (tableau)
- **Roles** - Rôles et responsabilités (format: `nom | responsabilité`)
- **ImmediateActions** - Actions T0-T2h (tableau)
- **ContinuityActions** - Procédures T2h-T48h (tableau)
- **RecoveryActions** - Retour à la normale (tableau)

### Gestion de Crise (🆕 v1.1)

- **DecisionMatrix** - Matrice décisionnelle (format: `décision | responsable | backup`)
- **CommunicationChannels** - Canaux de communication (format: `type | fréquence | destinataires | template`)
- **ExitCriteria** - Critères de sortie de crise / KPI (format: `critère | indicateur | cible`)

### Support & Ressources

- **Contacts** - Personnes clés (format: `nom | téléphone | email`)
- **Resources** - Équipements, lieux (tableau)
- **Checklists** - Listes de vérification par phase (format: `phase: item1; item2`)
- **Attachments** - Liens externes, documents (tableau)

---

## 📤 Exports & Imports

### Formats d'Export

#### 1. JSON (Complet)
```json
{
  "app": "contingence-local",
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-03-28T10:00:00.000Z",
  "data": {
    "plans": [...],
    "settings": {...}
  }
}
```
**Usage :** Sauvegarde complète, transfert vers autre machine

#### 2. CSV/Excel
```csv
ID,Titre,Catégorie,Criticité,Statut,Résumé,...
plan-001,"Cyberattaque...","cyberattaque","critique","valide","Plan de..."
```
**Usage :** Analyse dans Excel, rapports, tableaux de bord

#### 3. PDF
Document imprimable multi-pages avec :
- Métadonnées du plan
- Scénario complet
- Toutes les procédures
- Contacts et ressources
- Checklists

**Usage :** Documentation papier, exercices terrain, classeurs physiques

### Import de Plans

1. **Upload JSON** - Paramètres → Import → Choisir fichier
2. **Prévisualisation** - Nombre de plans, nouveaux vs existants
3. **Stratégie** :
   - **Fusion** - Conserve plans existants, ajoute/met à jour nouveaux
   - **Remplacement** - Supprime tout, remplace par import
4. **Validation** - Schéma vérifié, erreurs affichées si invalide

**Formats acceptés :**
- Export officiel app (avec `schemaVersion`)
- Format manuel (avec `version` string)
- Tableau direct de plans (avec `plans: [...]` à la racine)

---

## 🚨 Mode Urgence: Centre de Crise

### Workflow d'Activation

1. **Navigation** → Cliquer bouton **"URGENCE"** (sidebar)
2. **Sélection** → Grille de plans critiques s'affiche
3. **Activation** → Cliquer sur la carte du plan concerné
4. **Centre de Crise** → Interface tactique se charge

### Persistance et Récupération Automatique

**Le mode crise survit aux redémarrages de navigateur :**
- ✅ **Chronomètre persistant** - Continue à compter même après fermeture du navigateur
- ✅ **Plan actif sauvegardé** - Le plan en cours reste actif entre les sessions
- ✅ **Restauration automatique** - Au redémarrage, le centre de crise se recharge automatiquement
- ✅ **État checklist préservé** - Les cases cochées sont sauvegardées par plan
- ✅ **Indicateur TopBar** - Badge rouge permanent tant que le mode crise est actif

**Fonctionnement technique :**
- `activeCrisisPlanId` et `crisisActivatedAt` stockés dans IndexedDB
- État de checklist sauvegardé par plan (`checklist_state_${planId}`)
- Fonction `restoreCrisisMode()` appelée au démarrage de l'application
- Le chronomètre reprend automatiquement à partir du timestamp d'activation initial

### Interface Tactique

**Breadcrumb personnalisé :**
```
[NOM_APP] › CENTRE DE CRISE
```
*Note : Utilise le nom d'application personnalisé défini dans les paramètres*

**Header éditorial :**
- Badge "CODE ROUGE"
- Catégorie et ID du plan
- Titre du plan (3rem, gras)
- Résumé / scénario
- **Chronomètre temps réel** (HH:MM:SS depuis activation)
  - Mise à jour chaque seconde
  - Persiste entre les sessions navigateur
  - Nettoyage automatique si hash change

**Layout Bento (asymétrique 4-8 colonnes) :**

#### Colonne Gauche (4/12)

**Checklist Immédiate (0-30 min)**
- Cases à cocher interactives avec persistance
- État sauvegardé automatiquement dans IndexedDB
- 4-6 actions prioritaires
- Compteur d'actions
- Bouton "Voir Protocole Complet" (navigation vers l'éditeur)

**Contacts Stratégiques**
- 3 contacts maximum
- Avatars générés (initiale)
- Bouton appel direct (tel:)
- Rôle/fonction

#### Colonne Centrale (8/12)

**Carte Tactique**
- Fond gradient sombre
- Grille tactique (lignes orange)
- Zone d'impact centrale animée (pulse)
- Overlay impacts (3 max)

**Services Critiques (grille 2x2)**
- Pourcentage opérationnel
- Barre de progression
- Icône service (bolt, hospital, water, wifi)
- Couleurs d'alerte (> 85% = primary, < 85% = error)

**Flux en Temps Réel (footer)**
- Badge "FLUX LIVE" avec pulse rouge
- Défilement horizontal infini (marquee)
- Messages horodatés avec couleur tertiaire
- Bouton "X plans disponibles" si plusieurs critiques

### Désactivation

- Bouton **"Quitter Mode Urgence"** (top-right)
- Confirmation requise
- Retour à la grille de sélection
- Chronomètre arrêté et état nettoyé
- Suppression des données de persistance (IndexedDB)

---

## 🌐 Compatibilité Navigateurs

| Navigateur | Version Min. | FSA Support | Service Worker | Recommandation |
|------------|--------------|-------------|----------------|----------------|
| Chrome | 86+ | ✅ Full | ✅ | ⭐ **Recommandé** |
| Edge | 86+ | ✅ Full | ✅ | ⭐ **Recommandé** |
| Firefox | 90+ | ❌ Non | ✅ | ⚠️ Fonctionne (sans FSA) |
| Safari | 15+ | ⚠️ Partiel | ✅ | ⚠️ Tests limités |

**Notes :**
- FSA (File System Access) = Sauvegarde automatique
- Sans FSA, utiliser exports manuels réguliers
- Service Worker nécessite contexte sécurisé (HTTPS ou localhost)

---

## 📚 Documentation

| Fichier | Description |
|---------|-------------|
| [projet.md](Documentation/projet.md) | Spécification complète du projet (vision, phases, risques) |
| [REFONTE-UX.md](Documentation/REFONTE-UX.md) | Alignement design Vanguard, tokens, composants |
| [SAUVEGARDE_FSA.md](Documentation/SAUVEGARDE_FSA.md) | Guide utilisateur FSA (setup, troubleshooting) |
| [STRATEGIE_SAUVEGARDE.md](Documentation/STRATEGIE_SAUVEGARDE.md) | Architecture technique backup (workflows, formats) |
| [ROADMAP-CRITIQUE.md](Documentation/ROADMAP-CRITIQUE.md) | Améliorations post-MVP, innovations futures |

---

## 🔑 Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Enregistrer le plan en cours d'édition |
| `Ctrl+F` | Focuser la barre de recherche globale |

---

## 🛠️ Technologies & Standards

- **HTML5** - Structure sémantique
- **CSS3** - Design tokens, Grid, Flexbox, Glassmorphism
- **JavaScript ES6+** - Modules, async/await, destructuring
- **IndexedDB API** - Stockage local structuré
- **File System Access API** - Backup automatique (Chrome Origin Trial)
- **Service Worker API** - Cache offline
- **Material Design 3** - Design system Google 2021+
- **Accessibility** - ARIA labels, semantic HTML, keyboard nav

---

## 🎯 Cas d'Usage Réels

### Maison Départementale de l'Autonomie (MDA)

**Plans fournis** (10 dans `plans-mda-import.json`) :
1. Cyberattaque ransomware SI-MDPH
2. Panne majeure système iodas
3. Coupure téléphonie/internet
4. Sinistre bâtiment (incendie, inondation)
5. Épidémie personnel
6. Violation RGPD données usagers
7. Canicule protection usagers vulnérables
8. Défaillance prestataire transport/repas
9. Pandémie type COVID-19
10. Inondation majeure évacuation

**Spécificités MDA intégrées :**
- Instruction dossiers MDPH (PCH, APA, cartes mobilité)
- Délais légaux 4 mois
- Coordination CCAS, ARS, prestataires SAAD/SSIAD
- Registre canicule, cellule de crise

### Plan Communal de Sauvegarde (PCS)

**Utilisation :**
- Plans par risque majeur (inondation, séisme, tempête)
- Rôles maire, adjoint, services techniques
- Contacts pompiers, gendarmerie, préfecture
- Ressources : bâtiments refuge, matériel

### Plan de Continuité d'Activité (PCA)

**Utilisation :**
- Plans IT (panne serveur, cyberattaque)
- Plans RH (absentéisme, grève)
- Plans fournisseurs (rupture approvisionnement)
- Mode dégradé, procédures de secours

---

## 📦 Plans Pré-Configurés Disponibles

L'application fournit des templates de plans prêts à l'emploi pour démarrage rapide.

### Plans MDA (plans-mda-import.json)

**10 plans** spécifiques aux Maisons Départementales de l'Autonomie :

| ID | Titre | Criticité | Catégorie |
|----|-------|-----------|-----------|
| PLAN-CYBER-MDA-001 | Cyberattaque ransomware SI-MDPH | Critique | Cyberattaque |
| PLAN-IT-MDA-001 | Panne majeure système iodas | Critique | Informatique |
| PLAN-TELCOM-MDA-001 | Coupure téléphonie/internet | Importante | Infrastructure |
| PLAN-SINISTRE-MDA-001 | Sinistre bâtiment | Critique | Infrastructure |
| PLAN-SANTE-MDA-001 | Épidémie personnel | Importante | Santé |
| PLAN-RGPD-MDA-001 | Violation RGPD données usagers | Critique | Juridique |
| PLAN-CANICULE-MDA-001 | Canicule protection usagers vulnérables | Importante | Environnement |
| PLAN-PRESTA-MDA-001 | Défaillance prestataire transport/repas | Moyenne | Logistique |
| PLAN-COVID-MDA-001 | Pandémie type COVID-19 | Critique | Santé |
| PLAN-INNOND-MDA-001 | Inondation majeure évacuation | Critique | Environnement |

### Plans Administration Publique (nouveaux-plans.json)

**5 plans** pour collectivités territoriales et administrations :

| ID | Titre | Criticité | Catégorie |
|----|-------|-----------|-----------|
| PLAN-ELECT-001 | Coupure électrique prolongée sur site stratégique | Critique | Infrastructure |
| PLAN-SOCIAL-001 | Crise médiatique et communication de crise | Importante | Communication |
| PLAN-TECH-002 | Défaillance système GED (Gestion Électronique Documents) | Importante | Informatique |
| PLAN-SECU-001 | Menace sécuritaire ou intrusion malveillante | Critique | Sécurité |
| PLAN-ENV-001 | Pollution environnementale accidentelle | Importante | Environnement |

**Caractéristiques communes :**
- ✅ Scénarios détaillés et réalistes
- ✅ Procédures complètes (immédiate, continuité, récupération)
- ✅ Contacts et rôles pré-remplis (à adapter)
- ✅ Checklists opérationnelles 0-30 min
- ✅ Services critiques identifiés
- ✅ Ressources et équipements listés

**Import :**
1. Paramètres → Import
2. Sélectionner le fichier JSON
3. Prévisualiser les plans
4. Choisir "Fusion" ou "Remplacement"
5. Confirmer l'import

---

## 📊 Statistiques Projet

- **Lignes de code JavaScript :** ~2500+ (app.js)
- **Variables CSS (design tokens) :** 90+
- **Vues interface :** 5 (Dashboard, Plans, Éditeur, Crise, Paramètres)
- **Catégories de plans :** 10
- **Niveaux de criticité :** 4
- **Formats d'export :** 4 (JSON, CSV, PDF, Print)
- **Object Stores IndexedDB :** 4
- **Plans pré-configurés :** 15 (10 MDA + 5 Administration Publique)
- **Fonctionnalités persistantes :** 3 (Mode crise, Chronomètre, État checklist)

---

## ⚠️ Limitations Connues

1. **Firefox** - Pas de support FSA (backup manuel requis)
2. **Quotas navigateur** - IndexedDB limité ~50-100MB selon navigateur
3. **Concurrence** - Usage mono-onglet recommandé (permissions FSA)
4. **Migration schéma** - Import v1 uniquement (migration future)
5. **Authentification** - Pas de login (accès local machine uniquement)

---

## 🗺️ Roadmap (Post-MVP)

### Priorités Court Terme
- [ ] Assistant création guidée (wizard)
- [ ] Vue crise ultra-rapide 10 secondes
- [ ] Indicateurs progression checklist
- [ ] Résolution conflits import améliorée
- [ ] Historique versions avec diff

### Innovations Moyen Terme
- [ ] Mode exercice (simulation chronométrée)
- [ ] Packs terrain (bundles multi-plans imprimables)
- [ ] Score préparation (readiness indicator)
- [ ] Rappels révision périodique
- [ ] Mode sombre

Voir [ROADMAP-CRITIQUE.md](Documentation/ROADMAP-CRITIQUE.md) pour détails complets.

---

## 📜 Licence

**MIT License**

Copyright (c) 2026 Frédérick MURAT

L'utilisation, la copie, la modification et la distribution de ce logiciel sont autorisées, sous réserve que l'avis de copyright ci-dessus et cette permission figurent dans toutes les copies ou portions substantielles du logiciel.

LE LOGICIEL EST FOURNI "TEL QUEL", SANS GARANTIE D'AUCUNE SORTE.

Voir [LICENSE.txt](LICENSE.txt) pour le texte complet.

---

## 👤 Auteur

**Frédérick MURAT**

- Application développée en 2026
- Design System: Vanguard Command Center
- Architecture: SPA Vanilla JS, Material Design 3

---

## 🙏 Remerciements

- **Material Design 3** - Google Design System
- **Material Symbols** - Iconographie
- **Inter Font** - Typographie (Rasmus Andersson)
- **File System Access API** - Chrome Team

---

## 📞 Support & Feedback

Pour questions, bugs ou suggestions :
1. Consulter la [documentation](Documentation/)
2. Vérifier les [limitations connues](#-limitations-connues)
3. Consulter le fichier [projet.md](Documentation/projet.md)

---

<div align="center">

**Contingence Local v1.0.0** - Gestion de Plans de Contingence

*Développé avec ❤️ pour les services publics et organisations d'urgence*

[🏠 Accueil](#contingence-local---vanguard-command-center) · [📚 Documentation](#-documentation) · [📜 Licence](#-licence)

</div>
