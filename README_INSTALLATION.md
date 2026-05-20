# Guide d'Installation et de Lancement (A à Z)

Ce guide détaille toutes les étapes nécessaires pour installer, configurer et lancer le projet **SIGT Cotonou** (Backend Node.js + Simulateur de trafic SUMO) sur une nouvelle machine.

---

## 📋 Prérequis Globaux

Vous devez installer les outils suivants sur votre ordinateur :

1. **Node.js** (Version 18 ou supérieure) :
   - [Télécharger Node.js](https://nodejs.org/) (Téléchargez la version LTS).
2. **Python 3** (Version 3.8 ou supérieure) :
   - [Télécharger Python](https://www.python.org/downloads/) (Cochez bien l'option **"Add Python to PATH"** pendant l'installation).
3. **SUMO (Simulation of Urban MObility)** :
   - [Télécharger SUMO](https://eclipse.dev/sumo/) (Prenez l'installateur Windows `.msi` ou le package Linux correspondant).

---

## 🛠️ Étape 1 : Configuration de SUMO (Variable d'environnement)

Pour que le script Python puisse piloter le simulateur SUMO, le système a besoin de connaître l'emplacement de SUMO.

### Sous Windows :
1. Cherchez **"Modifier les variables d'environnement système"** dans votre barre de recherche Windows.
2. Cliquez sur **Variables d'environnement...** (en bas).
3. Dans **Variables système** (en bas), cliquez sur **Nouvelle...**.
4. Saisissez :
   - **Nom de la variable** : `SUMO_HOME`
   - **Valeur de la variable** : `C:\Program Files (x86)\Eclipse\Sumo` (ou le chemin exact où vous avez installé SUMO, par exemple `C:\Program Files\Eclipse\Sumo`).
5. Cliquez sur **OK** partout pour enregistrer.

### Sous Linux / macOS :
Ajoutez cette ligne dans votre fichier `.bashrc` ou `.zshrc` :
```bash
export SUMO_HOME=/usr/share/sumo # À adapter selon l'emplacement d'installation
```

---

## 🌐 Étape 2 : Installation & Lancement du Tableau de Bord (Node.js)

Le serveur Node.js reçoit les données et gère l'interface web.

1. Ouvrez votre terminal dans le dossier racine du projet (`Sumo`).
2. Installez les dépendances nécessaires :
   ```bash
   npm install
   ```
3. Lancez le serveur local :
   ```bash
   npm start
   ```
   *Le terminal doit afficher : `SIGT Backend running on http://localhost:3000`*
4. Ouvrez votre navigateur et allez sur : **[http://localhost:3000](http://localhost:3000)**. 
   *(Identifiants par défaut : **admin** / **admin**, puis code OTP : **123456**)*

---

## 🚗 Étape 3 : Installation & Lancement de la Simulation (Python + SUMO)

Cette partie lit les données de la simulation routière et les envoie au tableau de bord.

1. Ouvrez un **deuxième terminal** dans le même dossier (`Sumo`).
2. Installez les bibliothèques Python nécessaires :
   ```bash
   pip install -r requirements.txt
   ```
3. Vérifiez le fichier de configuration locale `.env.local`. Il doit contenir :
   ```env
   SIGT_SERVER_URL=http://localhost:3000
   SUMO_CFG=./simulation/stade.sumocfg
   SUMO_BINARY=sumo-gui
   STEP_INTERVAL=1.0
   ```
   > [!TIP]
   > Utilisez `SUMO_BINARY=sumo-gui` pour voir la simulation 2D s'ouvrir à l'écran, ou `SUMO_BINARY=sumo` pour la faire tourner en arrière-plan sans interface graphique (plus rapide).

4. Lancez le script de liaison :
   ```bash
   python sumo_bridge.py
   ```

---

## 🔄 Comment ça marche à l'utilisation ?

1. Dès que vous lancez `python sumo_bridge.py`, la fenêtre du simulateur SUMO s'ouvre.
2. Cliquez sur le bouton **Play (Démarrer)** dans SUMO pour lancer le trafic.
3. Regardez simultanément votre navigateur web sur `http://localhost:3000` : vous verrez les feux clignoter, le nombre de véhicules s'actualiser, et les graphiques de files d'attente s'animer en temps réel !
