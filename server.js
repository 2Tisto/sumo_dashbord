const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'cotonou_sigt_secure_key_2024';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// --- WebSockets ---
io.on('connection', (socket) => {
    console.log('[WS] Client connecté au tableau de bord:', socket.id);
    socket.on('disconnect', () => {
        console.log('[WS] Client déconnecté:', socket.id);
    });
});

// --- Mock Database ---
let config = {
    t_min: 15,
    t_max: 90,
    t_base: 45,
    queue_threshold: 50,
    acoustic_confidence: 80
};

let alerts = [
    { id: 1, timestamp: new Date().toISOString(), location: "Carrefour Godomey", type: "Défaillance capteur IR (E3Z-T61)", severity: "Critique", status: "En cours" },
    { id: 2, timestamp: new Date().toISOString(), location: "Stade de l’Amitié", type: "Préemption d'urgence : Ambulance", severity: "Majeure", status: "En cours" },
    { id: 3, timestamp: new Date().toISOString(), location: "Carrefour Cadjehoun", type: "Bascule mode dégradé (Watchdog)", severity: "Critique", status: "Résolu" }
];

// --- Routes API ---
app.post('/api/sumo/data', (req, res) => {
    const data = req.body;
    console.log(`[API] Trafic reçu (${data.sim_time}s) | Phase: ${data.current_phase.toUpperCase()} | Pression: NS=${data.pressure_ns} EO=${data.pressure_eo}`);
    // On rediffuse instantanément la donnée au front-end
    io.emit('traffic_update', data);
    res.json({ success: true, message: "Données diffusées au tableau de bord" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
        const token = jwt.sign({ username: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ token, message: "Authentification réussie" });
    }
    res.status(401).json({ message: "Identifiants invalides" });
});

app.get('/api/traffic/data', (req, res) => {
    res.json({
        intersections: [
            { id: 'stade', name: 'Stade de l’Amitié', status: 'Fluide', flow: 1250, waitTime: 45 },
            { id: 'cadjehoun', name: 'Cadjehoun', status: 'Ralentissement', flow: 2100, waitTime: 85 },
            { id: 'godomey', name: 'Godomey', status: 'Congestion', flow: 3400, waitTime: 120 }
        ],
        globalKpi: {
            totalFlow: 6750,
            avgWait: 76.5,
            activeAlerts: alerts.filter(a => a.status === 'En cours').length
        }
    });
});

app.get('/api/alerts', (req, res) => res.json(alerts));

app.post('/api/config/update', (req, res) => {
    config = { ...config, ...req.body };
    console.log(`[MQTT] Update:`, config);
    res.json({ success: true, message: "Configuration envoyée via MQTT" });
});

server.listen(PORT, () => {
    console.log(`SIGT Backend running on http://localhost:${PORT}`);
});
