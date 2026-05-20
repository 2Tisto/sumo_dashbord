# Guide de Démarrage Rapide (En 2 Clics) 🚀

Ce guide vous explique comment lancer rapidement le projet **SIGT Cotonou** sur votre machine en utilisant les scripts automatisés (`.bat`).

---

## 🛠️ Prérequis indispensables

Avant de lancer les scripts, assurez-vous d'avoir installé sur votre machine :
1. **Node.js** (https://nodejs.org)
2. **Python 3** (https://www.python.org/downloads/) - *Cochez "Add Python to PATH"*
3. **SUMO** (https://eclipse.dev/sumo/)
4. La variable d'environnement **`SUMO_HOME`** configurée sur le dossier d'installation de SUMO (ex: `C:\Program Files (x86)\Eclipse\Sumo`).

---

## 🚀 Lancement du Projet

Une fois les prérequis installés, suivez ces 3 étapes simples :

### Étape 1 : Configurer l'environnement (Seulement au premier lancement)
* Si le fichier `.env.local` n'existe pas dans le dossier :
  - Dupliquez le fichier `.env.example`
  - Renommez la copie en **`.env.local`**

### Étape 2 : Lancer le Tableau de Bord
* Double-cliquez sur le fichier **`lancer_serveur.bat`**
* *Ce script va installer automatiquement les paquets nécessaires et lancer le serveur. Une fois démarré, ouvrez votre navigateur sur :*
  👉 **[http://localhost:3000](http://localhost:3000)** (Identifiants : `admin` / `admin` | OTP : `123456`)

### Étape 3 : Lancer la Simulation
* Double-cliquez sur le fichier **`lancer_simulation.bat`**
* *Ce script va installer les dépendances Python nécessaires et lancer la simulation SUMO en temps réel.*
* Cliquez sur le bouton **Play (Démarrer)** dans l'interface de SUMO pour lancer le trafic et voir les feux s'animer sur le tableau de bord !
