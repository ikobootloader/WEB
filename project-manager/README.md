# Gestionnaire de Projets 📋

Application web de gestion de tâches 100% locale, sans serveur ni base de données. Toutes les données sont chiffrées dans le navigateur avant d'être stockées dans le `localStorage`.

---

## Fonctionnalités

- **Création / édition / suppression** de tâches avec titre, description, niveau d'urgence et deadline
- **Chiffrement AES-256-GCM** — les données ne quittent jamais votre appareil
- **Dérivation de clé PBKDF2-SHA256** (310 000 itérations, conforme OWASP 2024)
- **Verrouillage / déverrouillage** par mot de passe à chaque session
- **Filtrage** par urgence (Haute / Moyenne / Faible) et **tri** par date d'ajout, deadline ou urgence
- **Statistiques** : total, urgentes, moyennes, en retard
- **Import JSON** et **export JSON / Excel** (.xlsx)
- Données initiales pré-chargées au premier lancement via `tasks.js`

---

## Structure des fichiers

```
├── index.html   — Interface utilisateur (HTML + CSS intégré)
├── app.js       — Logique applicative (crypto, CRUD, rendu, import/export)

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
  "deadline": "2026-04-12",
  "comment": "Description optionnelle"
}
```

---

## Technologies utilisées

- Vanilla JS (ES2022+) — aucune dépendance JS applicative
- Web Crypto API (natif navigateur)
- [SheetJS / xlsx](https://sheetjs.com/) — export Excel
- Google Fonts : Syne, DM Sans

---

Frédérick MURAT - Licence MIT - Mars 2026
