# 📂 Catalogue des Requêtes BO — MDA de l'Orne

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Statut](https://img.shields.io/badge/statut-Production_Ready-success)
![Sécurité](https://img.shields.io/badge/sécurité-AES--256--GCM-orange)

Application locale, sécurisée et autonome permettant de cataloguer, gérer et consulter les requêtes BusinessObjects (BO) de la MDA de l'Orne.

> **Note de conception :** Cette application est conçue pour fonctionner **100% en local, sans serveur, sans dépendances (zéro NPM)**. Elle garantit la confidentialité des données grâce à un chiffrement fort et un stockage dans le navigateur.

---

## ✨ Fonctionnalités Principales

- 🔐 **Sécurité Avancée :** Chiffrement de toutes les données en AES-256-GCM via l'API Web Crypto.
- 🗄️ **Stockage Local :** Utilisation d'IndexedDB pour la persistance des données directement dans le navigateur.
- 👁️ **Vues Multiples :** Affichage sous forme de cartes, tableau détaillé ou arborescence.
- 🔍 **Recherche & Filtres :** Moteur de recherche full-text et filtres croisés (Univers, Fréquence, Statuts).
- 🏷️ **Référentiel Intégré :** Intégration complète du Référentiel statistique CNSA.
- 📤 **Import / Export :** Sauvegarde et restauration via JSON, et export des données vers Excel (.xls / .xlsx).
- 🎨 **Interface Moderne :** Design responsive, animations fluides et gestion native des thèmes.

## 🛠️ Stack Technique

- **Structure :** HTML5
- **Style :** CSS3 (Variables CSS, Grid, Flexbox)
- **Logique :** Vanilla JavaScript (ES6+)
- **Stockage :** IndexedDB (API native)
- **Cryptographie :** Web Crypto API (SubtleCrypto)

## 🏗️ Architecture et Évolutivité (Stratégie de Modularisation)

Afin de maintenir la lisibilité du projet tout en respectant la contrainte stricte du "zéro serveur / zéro outil de build (NPM)", l'application est conçue autour d'un **Orchestrateur Principal**. 

Pour toute nouvelle implémentation de fonctionnalités conséquentes, l'architecture évoluera vers l'utilisation de **modules ES natifs** (`<script type="module">`) :

1. **`app-orchestrator.js` :** Le cœur de l'application, gérant l'initialisation, le routage interne et l'état global.
2. **Modules isolés (`/modules/*.js`) :** Les nouvelles fonctionnalités (ex: moteur de recherche avancé, export PDF, gestionnaire de thèmes) seront écrites dans des fichiers JavaScript dédiés.
3. **Import natif :** Les modules seront importés via la syntaxe native du navigateur (`import { feature } from './modules/feature.js'`).

*Cette approche garantit un code maintenable et découplé sans sacrifier la portabilité extrême du projet.*

## 🚀 Guide de Démarrage

### Premier Lancement
1. Ouvrir le fichier `BO_CatalogueRequetes_Inline.html` avec un navigateur moderne (Chrome, Edge, Firefox).
2. L'écran de configuration initiale s'affiche.
3. Définissez un **mot de passe fort**. *(Attention : il est impossible de le récupérer en cas d'oubli).*
4. L'application se déverrouille et charge un jeu de données de démonstration.

### Lancements Suivants
1. Ouvrir `BO_CatalogueRequetes_Inline.html`.
2. Saisir votre mot de passe pour déchiffrer la base de données.
3. Accéder à l'interface.

## ⌨️ Raccourcis Clavier

| Raccourci | Action |
| --- | --- |
| `Ctrl` + `N` | Créer une nouvelle requête |
| `Ctrl` + `L` | Verrouiller l'application (retour à l'écran de connexion) |
| `Échap` | Fermer les fenêtres modales / menus |

## 💾 Sauvegarde et Restauration

**Vos données ne vivent que dans votre navigateur.** Il est crucial de faire des sauvegardes régulières :
- **Exporter :** Cliquez sur le bouton "Exporter" (en haut à droite) et choisissez "Export JSON".
- **Restaurer :** Cliquez sur "Importer JSON" (dans le menu latéral) et chargez votre fichier de sauvegarde.

## 🆘 Dépannage

- **Mot de passe oublié :** Vos données sont perdues. Vous devez réinitialiser l'application en ouvrant les outils de développement (`F12`), onglet *Application* > *IndexedDB*, et en supprimant la base `MDA_BO_Catalogue`. Actualisez la page et importez votre dernière sauvegarde JSON.
- **Problème d'affichage :** Assurez-vous d'utiliser un navigateur web à jour et non un vieil outil comme Internet Explorer.

---
*Conçu et développé pour la MDA de l'Orne.*
