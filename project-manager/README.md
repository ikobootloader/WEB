# Gestionnaire de Projets 📋

Application web de gestion de tâches 100% locale, sans serveur ni base de données. Toutes les données sont chiffrées dans le navigateur avant d'être stockées dans le `localStorage`.

---

## Fonctionnalités

### Gestion des tâches
- **Création / édition / suppression** de tâches avec titre, description, niveau d'urgence et deadline
- **Bouton "Réalisé"** directement sur chaque tâche pour archivage rapide
- **Champs étendus** : demandeur (S3AD, SE2S, MDA, PSS, ASG, Autres), type de demande, date de demande
- **Ordre/Index manuel** : possibilité de définir un ordre personnalisé pour chaque tâche
- **Dates automatiques** : affichage de la date de création, modification et réalisation
- **Descriptions Markdown** : formatage riche avec gras, italique, listes, liens, code

### Tâches récurrentes
- **Fréquences configurables** : quotidien, hebdomadaire, mensuel, annuel
- **Intervalle personnalisé** : répéter tous les X jours/semaines/mois/années
- **Création automatique** : nouvelle occurrence générée automatiquement lors de la réalisation

### Fichiers joints
- **Association de fichiers** : images, PDF, documents Word/Excel, etc.
- **Limite de taille** : 5 Mo par fichier
- **Prévisualisation** : icônes et informations de taille
- **Téléchargement** : récupération des fichiers joints
- **Stockage Base64** : fichiers chiffrés avec les données

### Organisation et recherche
- **Moteur de recherche** : recherche en temps réel dans titre, description, demandeur, type
- **Filtrage avancé** : par urgence, demandeur, type de demande
- **Tri multiple** : ordre manuel, date d'ajout, date de demande, deadline, urgence
- **Pagination** : affichage par lots de 12 tâches
- **Onglets** : séparation tâches actives / archives

### Gestion des versions logicielles
- **Registre des versions** : suivi des versions de SOLIS, MULTIGEST, BO, etc.
- **Interface dédiée** : popup pour ajouter/modifier/supprimer les versions
- **Stockage chiffré** : versions sauvegardées avec chiffrement AES-256-GCM

### Sécurité et données
- **Chiffrement AES-256-GCM** — les données ne quittent jamais votre appareil
- **Dérivation de clé PBKDF2-SHA256** (310 000 itérations, conforme OWASP 2024)
- **Verrouillage / déverrouillage** par mot de passe à chaque session
- **Import JSON** et **export JSON / Excel** (.xlsx)
- **Sauvegarde automatique** sur disque (File System Access API)

### Statistiques et suivi
- **Tableau de bord** : total tâches, urgentes, en attente, en retard, archivées
- **Indicateurs visuels** : badges d'urgence, statut, demandeur, type, récurrence
- **Barre de progression** : visualisation de l'approche de la deadline

---

## Structure des fichiers

```
├── index.html   — Interface utilisateur (HTML + CSS intégré)
├── app.js       — Logique applicative (crypto, CRUD, rendu, import/export)
└── tasks.js     — Tâches d'exemple chargées au premier démarrage
```

---

## Démarrage

Aucune installation requise. Ouvrez simplement `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).

> ⚠️ Le chiffrement repose sur la **Web Crypto API**, disponible uniquement en contexte sécurisé (`https://` ou `localhost`). L'ouverture directe via `file://` peut ne pas fonctionner selon le navigateur.

Au premier lancement, vous devrez créer un mot de passe (4 caractères minimum). Ce mot de passe chiffre toutes vos données localement — **il n'est jamais stocké ni transmis**.

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

---

## Format des tâches (JSON)

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
  "order": 1,
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

---

## Technologies utilisées

- Vanilla JS (ES2022+) — aucune dépendance JS applicative
- Web Crypto API (natif navigateur) — chiffrement AES-256-GCM
- [SheetJS / xlsx](https://sheetjs.com/) — export Excel
- [Marked.js](https://marked.js.org/) — rendu Markdown
- File System Access API — sauvegarde automatique sur disque
- Google Fonts : Syne, DM Sans

## Nouveautés (Mars 2026)

✨ **Version 2.0** - Refonte majeure avec 12 nouvelles fonctionnalités :

1. ✅ Ajout des demandeurs PSS et ASG
2. 📅 Affichage de la date de création des tâches
3. 📝 Champ "Date de demande" avec tri associé
4. ✏️ Suivi de la date de modification
5. ⚡ Bouton "Réalisé" sur chaque cartouche
6. 📝 Support Markdown dans les descriptions
7. 🔢 Modification de l'ordre/index des tâches
8. 📄 Pagination de la liste (12 tâches par page)
9. 🔍 Moteur de recherche en temps réel
10. 📦 Gestionnaire de versions logicielles (popup)
11. 🔄 Tâches récurrentes avec fréquences paramétrables
12. 📎 Association de fichiers aux tâches (images, PDF, docs)

---

Frédérick MURAT - Licence MIT - Mars 2026
