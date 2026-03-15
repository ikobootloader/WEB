# 🤖 Chatbot de Navigation MDPH

> Système de navigation intelligent pour guider les usagers dans leurs démarches auprès des Maisons Départementales des Personnes Handicapées (MDPH)

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com)
[![Précision](https://img.shields.io/badge/précision-94%25-brightgreen.svg)](https://github.com)
[![Matches exacts](https://img.shields.io/badge/matches%20exacts-89.5%25-brightgreen.svg)](https://github.com)
[![Couverture](https://img.shields.io/badge/couverture-100%25-brightgreen.svg)](https://github.com)
[![Chunks](https://img.shields.io/badge/chunks-250-green.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com)

---

## 📋 Table des matières

- [À propos](#-à-propos)
- [Caractéristiques](#-caractéristiques)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Utilisation](#-utilisation)
- [Tests et évaluation](#-tests-et-évaluation)
- [Contribution](#-contribution)

---

## 🎯 À propos

Le **Chatbot de Navigation MDPH** est un système intelligent conçu pour aider les personnes en situation de handicap, leurs aidants et les professionnels à naviguer dans le complexe écosystème des démarches MDPH.

### Problème résolu

Les démarches MDPH sont souvent complexes et intimidantes :
- Plus de **100 prestations et aides** différentes (AAH, PCH, RQTH, CMI, AEEH...)
- Procédures administratives longues et techniques
- Manque d'information claire et accessible
- Difficulté à trouver la bonne réponse parmi des centaines de pages

### Solution apportée

Un chatbot qui :
- ✅ Répond en **langage naturel** aux questions des usagers
- ✅ Guide vers l'**information précise** en 1 clic
- ✅ Propose des **liens de navigation** contextuels
- ✅ Fonctionne **100% côté client** (pas de serveur nécessaire)
- ✅ Est **gratuit et open-source**

---

## ✨ Caractéristiques

### 🔍 Système de recherche hybride en 3 phases

**Phase 0 : Résolution contextuelle**
- Détection automatique des questions courtes ou avec pronoms ("l'obtenir", "la demander", "quel montant ?")
- Résolution prioritaire via related_links du chunk précédent
- Enrichissement de la question avec le contexte conversationnel (3 derniers chunks)
- Indicateur visuel "💡 Question comprise en contexte"

**Phase 1 : Questions typiques**
- Matching exact ou similarité ≥85% avec questions pré-définies
- Score : 10000 (exact) ou 9000+ (similaire)
- Priorité absolue sur le fallback keywords

**Phase 2 : Keywords**
- Recherche par mots-clés pondérés
- Score variable selon densité de matching
- Utilisé uniquement si phases 0 et 1 échouent

### 📊 Base de connaissances

- **250 chunks** de contenu structuré
- **835 liens de navigation** inter-chunks
- **3832 questions typiques** pré-indexées
- Couvre **100% des démarches MDPH** courantes
- **94% de précision** sur questions utilisateurs réelles

### 🎨 Interface utilisateur

- Interface conversationnelle intuitive
- Affichage des réponses en Markdown formaté
- Navigation contextuelle vers sujets connexes
- Historique de conversation
- Responsive design optimisé mobile/desktop

### ⚡ Performance

- **Temps de réponse** : <100ms en moyenne
- **Taille fichier** : 871 Ko (version standalone)
- **Pas de dépendances** externes
- Fonctionne 100% offline après chargement

---

## 🏗️ Architecture

### Méthode de fonctionnement

Le chatbot utilise une approche hybride en 3 phases séquentielles :

1. **Détection contextuelle** : Identifie les questions courtes ou pronominales et tente de les résoudre via l'historique conversationnel
2. **Matching sémantique** : Compare la question avec une base de questions typiques pré-indexées
3. **Fallback keywords** : Recherche par mots-clés si les phases précédentes échouent

Cette architecture garantit :
- Précision maximale sur les questions fréquentes (phase 1)
- Gestion naturelle des conversations (phase 0)
- Couverture totale avec fallback (phase 2)

### Format des données

Chaque chunk contient :
- **id** : Identifiant unique
- **question** : Titre du chunk
- **answer** : Réponse formatée en Markdown
- **source** : Source officielle
- **keywords** : Liste de mots-clés pour le fallback
- **typical_questions** : Questions pré-indexées (phase 1)
- **related_links** : Liens vers chunks connexes

---

## 🚀 Installation

Aucune installation requise ! Ouvrez simplement le fichier :

```bash
chatbot-navigation-all-in-one.html
```

---

## 💻 Utilisation

Le fichier `chatbot-navigation-all-in-one.html` contient tout le nécessaire :
- HTML + CSS + JavaScript
- Données (250 chunks)
- Fonctionne offline
- Déploiement simple (1 fichier)

### Exemples de conversations

**Conversation contextuelle AAH** :
```
👤 "qu'est-ce que l'AAH ?"
🤖 [Affiche aah_definition]

👤 "quel montant ?"
🤖 💡 Question comprise en contexte (AAH)
   [Affiche aah_montant]

👤 "comment la demander ?"
🤖 💡 Question comprise en contexte (AAH)
   [Affiche aah_demarches]
```

---

## 🧪 Tests et évaluation

### Performance actuelle

- **94% de précision** sur questions réelles
- **100% de couverture** (aucune question sans réponse)
- **89.5% de matches exacts** sur vraies questions d'usagers

### Tests automatiques

```bash
# Test sur dataset de référence
node test-100-questions.js

# Test sur questions réelles d'usagers
node test-100-credibles-validation.js
```

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche : `git checkout -b feature/nouvelle-fonctionnalite`
3. Commiter : `git commit -m "Ajout nouvelle fonctionnalité"`
4. Pousser : `git push origin feature/nouvelle-fonctionnalite`
5. Créer une Pull Request

### Guidelines

- ✅ Sources officielles uniquement
- ✅ Langage simple et accessible
- ✅ Markdown pour le formatage
- ✅ Tests avant soumission

---

## 📚 Ressources

### Documentation officielle MDPH

- [Service Public - Handicap](https://www.service-public.fr/particuliers/vosdroits/N12230)
- [Mon Parcours Handicap](https://www.monparcourshandicap.gouv.fr/)
- [CNSA - Documentation](https://www.cnsa.fr/)
- [Légifrance - Code de l'action sociale](https://www.legifrance.gouv.fr/)

---

## 📜 Licence

Ce projet est sous licence **MIT**.

---

## 👥 Auteurs

**Frédérick MURAT**

---

<div align="center">

**⭐ Si ce projet vous est utile, n'hésitez pas à mettre une étoile !**

[⬆ Retour en haut](#-chatbot-de-navigation-mdph)

</div>
