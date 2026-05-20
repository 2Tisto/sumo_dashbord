"""
sumo_bridge.py — SIGT Cotonou
==============================
Connecteur local : lit les données SUMO via TraCI (TCP local)
et les envoie en temps réel au serveur SIGT déployé en ligne via HTTPS.

USAGE :
    python sumo_bridge.py

CONFIGURATION (.env.local dans le même dossier) :
    SIGT_SERVER_URL = https://ton-app.railway.app   ← URL du serveur déployé
    SUMO_API_KEY    = sigt_cotonou_secret_2024       ← Même clé que le backend
    SUMO_CFG        = ./simulation/stade.sumocfg     ← Chemin vers le fichier SUMO
    SUMO_BINARY     = sumo                           ← ou "sumo-gui" pour voir la simulation
    STEP_INTERVAL   = 1.0                            ← Secondes entre chaque envoi
    RETRY_MAX       = 5                              ← Tentatives si le serveur est HS

DÉPENDANCES :
    pip install requests python-dotenv

    SUMO doit être installé et la variable SUMO_HOME configurée :
    Windows : set SUMO_HOME=C:\\Program Files (x86)\\Eclipse\\Sumo
    Linux   : export SUMO_HOME=/usr/share/sumo
"""

import os
import sys
import time
import json
import logging
import requests
from dotenv import load_dotenv

# ─── Chargement configuration ────────────────────────────────────────────────
load_dotenv('.env.local')

SERVER_URL    = os.getenv('SIGT_SERVER_URL', 'http://localhost:3000')
API_KEY       = os.getenv('SUMO_API_KEY', '')
SUMO_CFG      = os.getenv('SUMO_CFG', './simulation/stade.sumocfg')
SUMO_BINARY   = os.getenv('SUMO_BINARY', 'sumo')
STEP_INTERVAL = float(os.getenv('STEP_INTERVAL', '1.0'))
RETRY_MAX     = int(os.getenv('RETRY_MAX', '5'))
ENDPOINT      = f"{SERVER_URL.rstrip('/')}/api/sumo/data"

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('SIGT-Bridge')

# ─── Import TraCI (SUMO) ─────────────────────────────────────────────────────
try:
    if 'SUMO_HOME' not in os.environ:
        # Chemins communs selon l'OS
        sumo_candidates = [
            r'C:\Program Files (x86)\Eclipse\Sumo',
            r'C:\Program Files\Eclipse\Sumo',
            '/usr/share/sumo',
            '/opt/sumo'
        ]
        for path in sumo_candidates:
            if os.path.isdir(path):
                os.environ['SUMO_HOME'] = path
                log.info(f"SUMO_HOME auto-détecté : {path}")
                break

    sumo_tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(sumo_tools)
    import traci
    import traci.constants as tc
    log.info("✅ TraCI importé avec succès")
except Exception as e:
    log.error(f"❌ Impossible d'importer TraCI : {e}")
    log.error("→ Vérifier que SUMO est installé et SUMO_HOME est configuré.")
    sys.exit(1)


# ─── Fonctions utilitaires ───────────────────────────────────────────────────

def send_data(payload: dict, retry: int = 0) -> bool:
    """Envoie les données SUMO au serveur en ligne avec retry automatique."""
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
    }
    try:
        resp = requests.post(ENDPOINT, json=payload, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            log.info(f"📡 t={payload['sim_time']}s envoyé → {data.get('clients', '?')} client(s) connecté(s)")
            return True
        elif resp.status_code == 401:
            log.error("❌ Clé API refusée ! Vérifier SUMO_API_KEY dans .env.local")
            return False
        else:
            log.warning(f"⚠️  Réponse inattendue : {resp.status_code} — {resp.text[:100]}")
            return False
    except requests.exceptions.ConnectionError:
        if retry < RETRY_MAX:
            wait = 2 ** retry  # Backoff exponentiel : 1s, 2s, 4s, 8s...
            log.warning(f"🔌 Serveur injoignable, retry {retry+1}/{RETRY_MAX} dans {wait}s...")
            time.sleep(wait)
            return send_data(payload, retry + 1)
        else:
            log.error(f"❌ Serveur inaccessible après {RETRY_MAX} tentatives.")
            return False
    except requests.exceptions.Timeout:
        log.warning("⏱ Timeout — serveur trop lent à répondre")
        return False


def get_phase_name(tl_id: str) -> str:
    """Retourne la phase actuelle d'un feu ('NS' ou 'EO')."""
    try:
        phase_index = traci.trafficlight.getPhase(tl_id)
        phase_def   = traci.trafficlight.getAllProgramLogics(tl_id)[0].phases[phase_index].state
        # Heuristique : si les voies N/S sont vertes → NS, sinon EO
        return 'NS' if phase_def[0].lower() == 'g' else 'EO'
    except Exception:
        return 'NS'


def compute_pressure(tl_id: str) -> tuple:
    """Calcule les pressions NS et EO (nombre de véhicules en attente)."""
    try:
        controlled_lanes = traci.trafficlight.getControlledLanes(tl_id)
        p_ns, p_eo = 0, 0
        for i, lane in enumerate(controlled_lanes):
            count = traci.lane.getLastStepVehicleNumber(lane)
            if i % 2 == 0:  # Heuristique : alternance NS/EO
                p_ns += count
            else:
                p_eo += count
        return round(p_ns, 2), round(p_eo, 2)
    except Exception:
        return 0, 0


def collect_metrics(tl_id: str = 'stade') -> dict:
    """Collecte toutes les métriques SUMO pour un pas de simulation."""
    sim_time = traci.simulation.getTime()

    # Véhicules
    all_vehicles   = traci.vehicle.getIDList()
    active_count   = len(all_vehicles)
    motorcycles    = sum(1 for v in all_vehicles if traci.vehicle.getTypeID(v) in ('motorcycle', 'moped', 'bicycle'))
    emergency      = sum(1 for v in all_vehicles if traci.vehicle.getTypeID(v) == 'emergency')

    # Temps d'attente moyen
    wait_times = [traci.vehicle.getWaitingTime(v) for v in all_vehicles] if all_vehicles else [0]
    avg_wait   = round(sum(wait_times) / len(wait_times), 2) if wait_times else 0

    # Débit (véhicules sortis cette seconde × 3600)
    arrived    = traci.simulation.getArrivedNumber()
    throughput = arrived * 3600

    # Files d'attente sur axes NS et EO
    try:
        controlled_lanes = traci.trafficlight.getControlledLanes(tl_id)
        half = len(controlled_lanes) // 2
        ns_lanes = controlled_lanes[:half]
        eo_lanes = controlled_lanes[half:]
        q_ns = sum(traci.lane.getLastStepVehicleNumber(l) for l in ns_lanes)
        q_eo = sum(traci.lane.getLastStepVehicleNumber(l) for l in eo_lanes)
    except Exception:
        q_ns, q_eo = 0, 0

    # Phase et pression
    current_phase  = get_phase_name(tl_id)
    p_ns, p_eo    = compute_pressure(tl_id)

    return {
        "sim_time":         round(sim_time, 1),
        "current_phase":    current_phase,
        "pressure_ns":      p_ns,
        "pressure_eo":      p_eo,
        "queue_length_ns":  q_ns,
        "queue_length_eo":  q_eo,
        "avg_wait_time":    avg_wait,
        "throughput":       throughput,
        "active_vehicles":  active_count,
        "motorcycles_count": motorcycles,
        "emergency_count":  emergency
    }


# ─── Boucle principale ───────────────────────────────────────────────────────

def run_bridge():
    log.info("="*60)
    log.info("🚦 SIGT Bridge — Démarrage")
    log.info(f"   Serveur cible : {SERVER_URL}")
    log.info(f"   Clé API       : {'✅ Configurée' if API_KEY else '⚠️  Manquante'}")
    log.info(f"   Config SUMO   : {SUMO_CFG}")
    log.info(f"   Intervalle    : {STEP_INTERVAL}s")
    log.info("="*60)

    # Test de connectivité au serveur avant de lancer SUMO
    log.info("🔗 Test de connexion au serveur...")
    try:
        r = requests.get(SERVER_URL, timeout=5)
        if r.status_code == 200:
            info = r.json()
            log.info(f"✅ Serveur joignable — {info.get('connectedClients', 0)} client(s) connecté(s)")
        else:
            log.warning(f"⚠️  Serveur répond {r.status_code}")
    except Exception as e:
        log.error(f"❌ Serveur inaccessible : {e}")
        log.error("→ Vérifier SIGT_SERVER_URL dans .env.local ou que le serveur est démarré.")
        sys.exit(1)

    # Lancement SUMO
    sumo_cmd = [SUMO_BINARY, '-c', SUMO_CFG, '--no-step-log', 'true', '--waiting-time-memory', '100']
    log.info(f"🏁 Lancement SUMO : {' '.join(sumo_cmd)}")
    traci.start(sumo_cmd)
    log.info("✅ TraCI connecté à SUMO")

    # ID du feu principal (à adapter selon ton fichier .sumocfg)
    tl_id = 'stade'
    try:
        all_tls = traci.trafficlight.getIDList()
        log.info(f"🚦 Feux disponibles : {all_tls}")
        if tl_id not in all_tls and all_tls:
            tl_id = all_tls[0]
            log.warning(f"⚠️  '{tl_id}' non trouvé, utilisation de '{tl_id}'")
    except Exception:
        log.warning("Impossible de lire les feux disponibles.")

    step = 0
    last_send = time.time()

    try:
        while traci.simulation.getMinExpectedNumber() > 0:
            traci.simulationStep()
            step += 1

            # Envoi des données à l'intervalle configuré
            now = time.time()
            if (now - last_send) >= STEP_INTERVAL:
                payload = collect_metrics(tl_id)
                send_data(payload)
                last_send = now

    except KeyboardInterrupt:
        log.info("\n⏹ Arrêt demandé (Ctrl+C)")
    except traci.exceptions.TraCIException as e:
        log.error(f"Erreur TraCI : {e}")
    finally:
        log.info("🔌 Fermeture de la connexion SUMO...")
        traci.close()
        log.info("✅ SIGT Bridge terminé proprement.")


if __name__ == '__main__':
    run_bridge()
