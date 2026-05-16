document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    const state = { 
        currentScreen: 'dashboard', 
        timer: 60,
        charts: {},
        intersectionPhase: 'NS',
        map: null,
        mapInitialized: false,
        // Variables Algorithme MaxPressure Bénin
        T_MIN: 15,
        T_MAX: 90,
        T_BASE: 60,
        SEUIL_URGENCE: 80,
        DISTANCE_CRITIQUE: 30,
        FACTEUR_EXT: 0.5
    };

    // --- Auth Logic ---
    // (Conserver la logique existante)
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            const otpStep = document.getElementById('otp-step');
            if(otpStep) otpStep.classList.remove('hidden');
        });
    }

    const verifyBtn = document.getElementById('verify-otp');
    if(verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            const otpVal = document.getElementById('otp-input').value;
            if(otpVal === '123456') {
                const overlay = document.getElementById('auth-overlay');
                const shell = document.getElementById('app-shell');
                if(overlay) overlay.classList.add('hidden');
                if(shell) shell.classList.remove('opacity-0');
                initApp();
            } else {
                alert("Code OTP invalide. Utilisez 123456");
            }
        });
    }

    // --- Navigation ---
    const initNavigation = () => {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const screen = item.dataset.screen;
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.screen-view').forEach(s => s.classList.add('hidden'));
                
                const targetScreen = document.getElementById(`screen-${screen}`);
                if(targetScreen) targetScreen.classList.remove('hidden');
                
                const titleEl = document.getElementById('screen-title');
                if(titleEl) titleEl.innerText = item.innerText.trim();
                
                state.currentScreen = screen;
                if(screen === 'intersection') initIntersectionCharts();
                if(screen === 'stats') {
                    initStatsCharts();
                    initExportSystem();
                }
                if(screen === 'dashboard') {
                    initMap();
                    // Fix Leaflet blank map on SPA navigation
                    setTimeout(() => { if(state.map) state.map.invalidateSize(); }, 100);
                }
                if(screen === 'alerts') populateAlerts();
            });
        });
    };

    // --- Core Logic ---
    const initApp = () => {
        initNavigation();
        initMap();
        setInterval(() => {
            const clockEl = document.getElementById('live-clock');
            if(clockEl) clockEl.innerText = new Date().toLocaleTimeString();
            updateSystemLoad();
        }, 1000);
        setInterval(updateIntersection, 1000);
        setInterval(simulateMaxPressure, 1500); // Fluidité accrue
        setInterval(triggerEmergencyEvent, 30000); // Moins fréquent pour le réalisme
        populateAlerts();
    };

    const updateSystemLoad = () => {
        const load = 25 + Math.floor(Math.random() * 15);
        const bar = document.getElementById('load-bar');
        if(bar) {
            bar.style.width = load + '%';
            bar.className = `h-full transition-all duration-1000 ${load > 70 ? 'bg-red-500' : (load > 50 ? 'bg-amber-500' : 'bg-emerald-500')}`;
        }
    };

    const initMap = () => {
        const mapContainer = document.getElementById('map-container');
        if(!mapContainer) return;
        
        // Si la carte existe déjà, juste recalculer la taille
        if(state.mapInitialized && state.map) {
            setTimeout(() => state.map.invalidateSize(), 100);
            return;
        }
        
        state.map = L.map('map-container').setView([6.3812, 2.3754], 16);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© CartoDB',
            maxZoom: 19
        }).addTo(state.map);
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="width:18px;height:18px;background:#10b981;border-radius:50%;border:3px solid white;box-shadow:0 0 14px #10b981;"></div>`
        });
        L.marker([6.3812, 2.3754], { icon }).addTo(state.map)
            .bindPopup(`<b style="color:#09090b">INT-01 | Carrefour du Stade de l'Amitié ✔ MaxPressure Actif</b>`);
        
        state.mapInitialized = true;
    };

    const updateIntersection = () => {
        if(state.currentScreen !== 'intersection') return;
        state.timer--;
        if(state.timer < 0) {
            state.timer = state.T_BASE;
            state.intersectionPhase = state.intersectionPhase === 'NS' ? 'EW' : 'NS';
            const label = document.getElementById('active-phase-label');
            if(label) label.innerText = state.intersectionPhase === 'NS' ? 'AXE NORD-SUD' : 'AXE EST-OUEST';
        }
        const timerEl = document.getElementById('phase-timer');
        if(timerEl) timerEl.innerText = state.timer.toString().padStart(2, '0');
        
        const chronoText = document.getElementById('chrono-text');
        if(chronoText) {
            const elapsed = (state.T_BASE - state.timer).toString().padStart(2, '0');
            chronoText.innerText = `00:00:${elapsed} / 00:01:00`;
            const progress = document.getElementById('phase-progress');
            if(progress) progress.style.width = ((state.T_BASE - state.timer) / state.T_BASE * 100) + '%';
        }

        updateTrafficLights();
    };

    const updateTrafficLights = () => {
        const lights = {
            north: document.getElementById('tl-north'),
            south: document.getElementById('tl-south'),
            east: document.getElementById('tl-east'),
            west: document.getElementById('tl-west')
        };

        const setLight = (el, color) => {
            if(!el) return;
            const red = el.querySelector('.red');
            const orange = el.querySelector('.orange');
            const green = el.querySelector('.green');
            
            [red, orange, green].forEach(l => {
                if(l) l.classList.remove('active-red', 'active-orange', 'active-green');
            });
            
            if(state.timer < 4 && state.timer > 0) {
                if(orange) orange.classList.add('active-orange');
            } else if(color === 'green') {
                if(green) green.classList.add('active-green');
            } else {
                if(red) red.classList.add('active-red');
            }
        };

        if(state.intersectionPhase === 'NS') {
            setLight(lights.north, 'green'); setLight(lights.south, 'green');
            setLight(lights.east, 'red'); setLight(lights.west, 'red');
        } else {
            setLight(lights.north, 'red'); setLight(lights.south, 'red');
            setLight(lights.east, 'green'); setLight(lights.west, 'green');
        }
    };

    const simulateMaxPressure = () => {
        if (state.currentScreen !== 'intersection') return;
        const axes = ['north', 'south', 'east', 'west'];
        
        // Simulation asynchrone des files d'attente
        axes.forEach(axis => {
            const el = document.getElementById(`queue-${axis}`);
            if(!el) return;
            let q = parseInt(el.innerText);
            
            // Logique asynchrone : flux entrant variable
            q += Math.floor(Math.random() * 4); 
            
            // Débit de sortie si vert
            const light = document.getElementById(`tl-${axis}`);
            if(light && light.querySelector('.active-green')) {
                q -= (5 + Math.floor(Math.random() * 5));
            }
            
            el.innerText = Math.max(0, q);
        });

        // Mise à jour visuelle des scores P1/P2
        const qN = parseInt(document.getElementById('queue-north')?.innerText || 0);
        const qS = parseInt(document.getElementById('queue-south')?.innerText || 0);
        const qE = parseInt(document.getElementById('queue-east')?.innerText || 0);
        const qW = parseInt(document.getElementById('queue-west')?.innerText || 0);

        const p1 = (qN + qS + (Math.random() * 2)).toFixed(1);
        const p2 = (qE + qW + (Math.random() * 2)).toFixed(1);
        
        const pLabels = document.querySelectorAll('.font-mono.text-\\[10px\\] span');
        if(pLabels[0]) pLabels[0].innerText = `P1 = ${p1}`;
        if(pLabels[1]) pLabels[1].innerText = `P2 = ${p2}`;
    };

    const triggerEmergencyEvent = () => {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-8 right-8 bg-red-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-[1000] flex items-center gap-4 animate-bounce border border-red-400/20";
        toast.innerHTML = `<i data-lucide="alert-octagon"></i> <div><p class="font-bold text-sm">URGENCE DÉTECTÉE (SCORE ${state.SEUIL_URGENCE}%)</p><p class="text-[10px]">Ambulance en approche - Priorité Stade de l'Amitié</p></div>`;
        document.body.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 6000);
    };

    const populateAlerts = () => {
        const body = document.getElementById('alerts-table-body');
        if(!body) return;
        const mockData = [
            { time: "10:12:04", loc: "Carrefour Godomey", ev: "Défaillance matérielle : Capteur IR actif double faisceau (E3Z-T61) déconnecté sur l'Axe Nord", sev: "CRITIQUE", act: "Alerte maintenance envoyée" },
            { time: "09:45:12", loc: "Carrefour Stade de l'Amitié", ev: "Préemption d'Urgence : Sirène d'ambulance détectée par le microphone MEMS (Score : 85%)", sev: "MAJEURE", act: "Priorité Axe Nord-Sud accordée" },
            { time: "08:30:15", loc: "Carrefour Cadjehoun", ev: "Sécurité : Plantage du script de contrôle local. Relais Watchdog (MAX6369) - Mode Jaunes Clignotants", sev: "CRITIQUE", act: "Redémarrage système en cours" }
        ];
        body.innerHTML = mockData.map(a => `
            <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                <td class="px-6 py-4 font-mono text-[10px]">${a.time}</td>
                <td class="px-6 py-4 text-[10px] font-bold text-emerald-500">${a.loc}</td>
                <td class="px-6 py-4 text-[10px]">${a.ev}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-0.5 rounded text-[9px] font-black ${a.sev === 'CRITIQUE' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'} uppercase">${a.sev}</span>
                </td>
                <td class="px-6 py-4 text-[9px] text-zinc-500 italic">${a.act}</td>
            </tr>
        `).join('');
    };

    const initIntersectionCharts = () => {
        const canvas = document.getElementById('chart-pressure');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if(state.charts.pressure) state.charts.pressure.destroy();
        state.charts.pressure = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1m', '2m', '3m', '4m', '5m'],
                datasets: [{ 
                    label: 'Pression Stade', 
                    data: [12, 19, 15, 25, 22], 
                    borderColor: '#10b981',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    };

    const initStatsCharts = () => {
        const canvasEff = document.getElementById('chart-efficiency');
        const canvas24h = document.getElementById('chart-traffic-24h');
        
        if(!canvasEff || !canvas24h) return;

        if(state.charts.efficiency) state.charts.efficiency.destroy();
        state.charts.efficiency = new Chart(canvasEff.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Fixe Traditionnel', 'Adaptatif SIGT'],
                datasets: [{ 
                    label: 'Attente (s)', 
                    data: [124.3, 76.5], 
                    backgroundColor: ['#27272a', '#10b981'],
                    borderRadius: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        if(state.charts.traffic24h) state.charts.traffic24h.destroy();
        state.charts.traffic24h = new Chart(canvas24h.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['0h', '4h', '8h', '12h', '16h', '20h'],
                datasets: [{ 
                    label: 'Files (m)', 
                    data: [150, 100, 1200, 900, 1500, 700], 
                    borderColor: '#10b981',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    const initExportSystem = () => {
        const btnPdf = document.getElementById('btn-export-pdf');
        const btnCsv = document.getElementById('btn-export-csv');
        if(!btnPdf || !btnCsv) return;

        btnPdf.onclick = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFillColor(9, 9, 11);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text("SIGT-BENIN | RAPPORT STADE DE L'AMITIÉ", 15, 25);
            doc.autoTable({
                startY: 60,
                head: [['Indicateur', 'Mode Fixe', 'Mode Adaptatif', 'Gain']],
                body: [
                    ['Temps d\'attente moy.', '124.3 s', '76.5 s', '38.5%'],
                    ['Longueur de file (Pointe)', '420 m', '248 m', '40.8%'],
                    ['Taux de violations', '12%', '2%', '41.5%'],
                    ['Émissions CO2', '24.2 kg/h', '19.5 kg/h', '-4.7 kg/h']
                ],
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] }
            });
            doc.save("SIGT_Rapport_Stade_Cotonou.pdf");
        };

        btnCsv.onclick = () => {
            const data = [
                { "Indicateur": "Temps attente", "Fixe": 124.3, "SIGT": 76.5, "Gain": "38.5%" },
                { "Indicateur": "CO2", "Fixe": 24.2, "SIGT": 19.5, "Unite": "kg/h" }
            ];
            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", "SIGT_Stade_Data.csv");
            link.click();
        };
    };

    const settingsForm = document.getElementById('settings-form');
    if(settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            state.T_MIN = parseInt(formData.get('t_min'));
            state.T_MAX = parseInt(formData.get('t_max'));
            state.T_BASE = parseInt(formData.get('t_base'));
            alert("Configuration déployée au contrôleur local (CII) avec succès !");
        });
    }
});
