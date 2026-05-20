document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    const state = { 
        currentScreen: 'dashboard', 
        timer: 60,
        charts: {},
        intersectionPhase: 'NS',
        map: null,
        mapMarker: null,
        mapInitialized: false,
        alerts: [],
        statsHistory: [],
        maxQueue: 0,
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
                
                // Active l'élément dans les deux menus (Sidebar et Bottom nav)
                document.querySelectorAll(`.nav-item[data-screen="${screen}"]`).forEach(i => i.classList.add('active'));
                
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
    const socket = io(); // Connexion WebSocket vers server.js

    const initApp = () => {
        initNavigation();
        initMap();
        setInterval(() => {
            const clockEl = document.getElementById('live-clock');
            if(clockEl) clockEl.innerText = new Date().toLocaleTimeString();
            updateSystemLoad();
        }, 1000);
        
        // Simulations locales retirées au profit de WebSocket
        // setInterval(updateIntersection, 1000);
        // setInterval(simulateMaxPressure, 1500);
        
        setInterval(triggerEmergencyEvent, 300000); // Gardé en secours pour démo
        populateAlerts();

        // Écoute des données SUMO en temps réel
        socket.on('traffic_update', (data) => {
            
            // --- MAJ HISTORIQUE STATS ---
            const nowTime = new Date().toLocaleTimeString();
            state.statsHistory.push({
                time: nowTime,
                wait: data.avg_wait_time || 0,
                queue: (data.queue_length_ns || 0) + (data.queue_length_eo || 0),
                throughput: data.throughput || 0,
                co2: data.active_vehicles ? (data.active_vehicles * 0.15) : 0 // Estimation CO2
            });
            if (state.statsHistory.length > 30) state.statsHistory.shift(); // Garde les 30 derniers points
            
            const totalQ = (data.queue_length_ns || 0) + (data.queue_length_eo || 0);
            if (totalQ > state.maxQueue) state.maxQueue = totalQ;

            // --- MAJ ÉCRAN 1 (Dashboard Global) ---
            if (data.avg_wait_time !== undefined) {
                const elWait = document.getElementById('dash-wait-time');
                if (elWait) elWait.innerText = data.avg_wait_time.toFixed(1);
                const statWait = document.getElementById('stat-wait');
                if (statWait) statWait.innerText = data.avg_wait_time.toFixed(1);
            }
            if (data.throughput !== undefined) {
                const elThroughput = document.getElementById('dash-throughput');
                if (elThroughput) elThroughput.innerText = data.throughput;
                const statThroughput = document.getElementById('stat-throughput');
                if (statThroughput) statThroughput.innerText = data.throughput;
            }
            if (data.active_vehicles !== undefined) {
                const elActive = document.getElementById('dash-active-veh');
                if (elActive) elActive.innerText = data.active_vehicles;
                const statActive = document.getElementById('stat-active');
                if (statActive) statActive.innerText = data.active_vehicles;
            }
            if (data.motorcycles_count !== undefined) {
                const elMoto = document.getElementById('dash-motorcycles');
                if (elMoto) elMoto.innerText = data.motorcycles_count;
            }

            const statQueue = document.getElementById('stat-queue');
            if (statQueue) statQueue.innerText = state.maxQueue;

            // --- MAJ CARTE (Couleur marqueur selon trafic) ---
            if (state.mapMarker) {
                const markerEl = document.getElementById('live-map-marker');
                if (markerEl) {
                    markerEl.className = `w-6 h-6 rounded-full border-4 border-zinc-900 animate-pulse ${
                        (data.avg_wait_time || 0) > 40 ? 'bg-red-500 neon-glow-red' : 
                        (data.avg_wait_time || 0) > 20 ? 'bg-amber-500 neon-glow-amber' : 
                        'bg-emerald-500 neon-glow-emerald'
                    }`;
                }
            }

            // --- MAJ ALERTES (emergency_count) ---
            if (data.emergency_count > 0) {
                if (!state.lastEmergency || (Date.now() - state.lastEmergency) > 10000) {
                    const evt = { type: "URGENCE DÉTECTÉE", message: "Véhicule prioritaire sur l'axe en approche !" };
                    triggerRealEmergency(evt);
                    state.lastEmergency = Date.now();
                    
                    // Ajout à l'historique
                    state.alerts.unshift({
                        time: nowTime,
                        axe: "Stade de l'Amitié",
                        ev: evt.message,
                        sev: "MAJEURE",
                        act: "Mode préemption activé automatiquement"
                    });
                    if (state.alerts.length > 20) state.alerts.pop();
                    renderAlertsTable();
                }
            }

            // --- MAJ GRAPHIQUES STATS ---
            updateStatsCharts();

            // Si on n'est pas sur la vue carrefour détaillée, on s'arrête ici pour économiser les perfs
            if(state.currentScreen !== 'intersection') return;

            // --- MAJ ÉCRAN 2 (Vue Carrefour détaillée) ---
            // 1. Mise à jour des files d'attente (Mapping NS et EO)
            if (data.queue_length_ns !== undefined) {
                const elN = document.getElementById('queue-north');
                const elS = document.getElementById('queue-south');
                if(elN) elN.innerText = Math.ceil(data.queue_length_ns / 2);
                if(elS) elS.innerText = Math.floor(data.queue_length_ns / 2);
            }
            if (data.queue_length_eo !== undefined) {
                const elE = document.getElementById('queue-east');
                const elW = document.getElementById('queue-west');
                if(elE) elE.innerText = Math.ceil(data.queue_length_eo / 2);
                if(elW) elW.innerText = Math.floor(data.queue_length_eo / 2);
            }

            // 2. Mise à jour des feux et chronomètre
            if (data.current_phase) {
                const newPhase = data.current_phase.toLowerCase() === 'ns' ? 'NS' : 'EW';
                
                // Si la phase change, on réinitialise le timer, sinon on décrémente pour l'animation
                if (state.intersectionPhase !== newPhase) {
                    state.intersectionPhase = newPhase;
                    state.timer = state.T_BASE; 
                } else {
                    if (state.timer > 0) state.timer--;
                }
                
                const label = document.getElementById('active-phase-label');
                if(label) label.innerText = state.intersectionPhase === 'NS' ? 'AXE NORD-SUD' : 'AXE EST-OUEST';
                
                const timerEl = document.getElementById('phase-timer');
                if(timerEl) timerEl.innerText = state.timer.toString().padStart(2, '0');
                
                const chronoText = document.getElementById('chrono-text');
                if(chronoText) {
                    const elapsed = Math.max(0, state.T_BASE - state.timer).toString().padStart(2, '0');
                    chronoText.innerText = `00:00:${elapsed} / 00:01:00`;
                    const progress = document.getElementById('phase-progress');
                    if(progress) progress.style.width = ((state.T_BASE - state.timer) / state.T_BASE * 100) + '%';
                }
                
                updateTrafficLights();
            }

            // 3. Mise à jour des pressions (P1 / P2) et Graphique
            if (data.pressure_ns !== undefined && data.pressure_eo !== undefined) {
                const pLabels = document.querySelectorAll('.font-mono.text-\\[10px\\] span');
                if(pLabels[0]) pLabels[0].innerText = `P1 = ${data.pressure_ns}`;
                if(pLabels[1]) pLabels[1].innerText = `P2 = ${data.pressure_eo}`;
                
                if(state.charts.pressure) {
                    const dataArr = state.charts.pressure.data.datasets[0].data;
                    dataArr.shift();
                    dataArr.push(Math.max(data.pressure_ns, data.pressure_eo));
                    state.charts.pressure.update('none');
                }
            }
        });

        // Raccourci clavier secret pour le jury (Shift + A)
        document.addEventListener('keydown', (e) => {
            if(e.shiftKey && e.key.toLowerCase() === 'a') {
                triggerEmergencyEvent();
                const label = document.getElementById('active-phase-label');
                if(label) {
                    label.innerText = 'URGENCE AMBULANCE';
                    label.classList.remove('text-emerald-500');
                    label.classList.add('text-red-500', 'animate-pulse');
                    setTimeout(() => {
                        label.innerText = state.intersectionPhase === 'NS' ? 'AXE NORD-SUD' : 'AXE EST-OUEST';
                        label.classList.remove('text-red-500', 'animate-pulse');
                        label.classList.add('text-emerald-500');
                    }, 8000);
                }
            }
        });
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
        if (!state.mapInitialized) {
            const mapContainer = document.getElementById('leaflet-map');
            if (mapContainer) {
                // Stade de l'Amitié, Cotonou
                state.map = L.map('leaflet-map', { zoomControl: false }).setView([6.387, 2.378], 16);
                
                L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                    maxZoom: 20,
                    subdomains:['mt0','mt1','mt2','mt3'],
                    attribution: 'Google Maps'
                }).addTo(state.map);

                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="w-6 h-6 bg-emerald-500 rounded-full border-4 border-zinc-900 neon-glow-emerald animate-pulse" id="live-map-marker"></div>`,
                    iconSize: [24, 24]
                });

                state.mapMarker = L.marker([6.387, 2.378], { icon }).addTo(state.map);
                state.mapInitialized = true;
            }
        }

        const closeBtn = document.getElementById('close-place-card');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => {
                const card = document.getElementById('place-card');
                if(card) {
                    card.classList.remove('translate-x-0', 'opacity-100');
                    card.classList.add('-translate-x-[120%]', 'opacity-0');
                }
            });
        }
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

        // Mise à jour du graphique en temps réel
        if(state.charts.pressure) {
            const dataArr = state.charts.pressure.data.datasets[0].data;
            dataArr.shift();
            dataArr.push(Math.max(parseFloat(p1), parseFloat(p2)));
            state.charts.pressure.update('none'); // Update sans animation complète pour plus de fluidité
        }
    };

    const triggerEmergencyEvent = () => {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-8 right-8 bg-red-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-[1000] flex items-center gap-4 animate-bounce border border-red-400/20";
        toast.innerHTML = `<i data-lucide="alert-octagon"></i> <div><p class="font-bold text-sm">URGENCE DÉTECTÉE (SCORE ${state.SEUIL_URGENCE}%)</p><p class="text-[10px]">Ambulance en approche - Priorité Stade de l'Amitié</p></div>`;
        document.body.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 6000);
    };

    const triggerRealEmergency = (event) => {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-8 right-8 bg-amber-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-[1000] flex items-center gap-4 animate-bounce border border-amber-400/20";
        toast.innerHTML = `<i data-lucide="alert-triangle"></i> <div><p class="font-bold text-sm">${event.type || 'ALERTE SUMO'}</p><p class="text-[10px]">${event.message || ''}</p></div>`;
        document.body.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 6000);
    };

    const renderAlertsTable = () => {
        const body = document.getElementById('alerts-table-body');
        const mobileCards = document.getElementById('alerts-cards-mobile');

        const rowsHtml = state.alerts.length === 0 
            ? `<tr><td colspan="5" class="px-6 py-12 text-center text-zinc-600 text-xs">Aucune alerte pour le moment. En attente de données SUMO...</td></tr>`
            : state.alerts.map(a => `
            <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/10 transition-colors">
                <td class="px-6 py-4 font-mono text-[10px] text-zinc-500 whitespace-nowrap">${a.time}</td>
                <td class="px-6 py-4 text-[10px] font-black text-emerald-400 whitespace-nowrap">${a.axe}</td>
                <td class="px-6 py-4 text-[10px] text-zinc-300 max-w-xs">${a.ev}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        a.sev === 'CRITIQUE' ? 'bg-red-500/20 text-red-400' : 
                        a.sev === 'MAJEURE'  ? 'bg-amber-500/20 text-amber-400' : 
                        'bg-blue-500/20 text-blue-400'
                    }">${a.sev}</span>
                </td>
                <td class="px-6 py-4 text-[9px] text-zinc-500 italic max-w-xs">${a.act}</td>
            </tr>
        `).join('');
        if (body) body.innerHTML = rowsHtml;

        // Vue Mobile : Cartes
        if (mobileCards) {
            mobileCards.innerHTML = state.alerts.length === 0
                ? `<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-600 text-xs">Aucune alerte pour le moment.</div>`
                : state.alerts.map(a => `
                <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="font-mono text-[10px] text-zinc-500">${a.time}</span>
                        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            a.sev === 'CRITIQUE' ? 'bg-red-500/20 text-red-400' : 
                            a.sev === 'MAJEURE'  ? 'bg-amber-500/20 text-amber-400' : 
                            'bg-blue-500/20 text-blue-400'
                        }">${a.sev}</span>
                    </div>
                    <p class="text-[10px] font-black text-emerald-400">${a.axe}</p>
                    <p class="text-[10px] text-zinc-300 leading-relaxed">${a.ev}</p>
                    <p class="text-[9px] text-zinc-500 italic border-t border-zinc-800 pt-2">${a.act}</p>
                </div>
            `).join('');
        }
    };

    const populateAlerts = () => {
        renderAlertsTable();
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
                    data: [120, 0], 
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
                labels: [],
                datasets: [{ 
                    label: 'Files (veh)', 
                    data: [], 
                    borderColor: '#10b981',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    const updateStatsCharts = () => {
        if (!state.charts.efficiency || !state.charts.traffic24h || state.statsHistory.length === 0) return;
        
        const latest = state.statsHistory[state.statsHistory.length - 1];
        
        // Update Efficiency Bar
        state.charts.efficiency.data.datasets[0].data[1] = latest.wait;
        state.charts.efficiency.update('none');

        // Update 24h Line
        state.charts.traffic24h.data.labels = state.statsHistory.map(h => h.time);
        state.charts.traffic24h.data.datasets[0].data = state.statsHistory.map(h => h.queue);
        state.charts.traffic24h.update('none');
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
            
            const latest = state.statsHistory[state.statsHistory.length - 1] || { wait: 0, queue: 0, co2: 0 };
            const gain = latest.wait > 0 ? ((120 - latest.wait)/120*100).toFixed(1) : 0;
            
            doc.autoTable({
                startY: 60,
                head: [['Indicateur', 'Mode Fixe', 'Mode Adaptatif', 'Gain Estimé']],
                body: [
                    ['Temps d\'attente moy.', '120.0 s', `${latest.wait.toFixed(1)} s`, `${gain}%`],
                    ['Longueur de file', '-', `${latest.queue} veh`, '-'],
                    ['Émissions CO2', '-', `${latest.co2.toFixed(1)} kg/h`, '-']
                ],
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] }
            });
            doc.save("SIGT_Rapport_Dynamique.pdf");
        };

        btnCsv.onclick = () => {
            const data = state.statsHistory.map(h => ({
                Heure: h.time,
                Attente_s: h.wait,
                File_veh: h.queue,
                Debit_veh_h: h.throughput,
                CO2_kg_h: h.co2
            }));
            const csv = Papa.unparse(data.length > 0 ? data : [{Info: "Aucune donnée"}]);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", "SIGT_Historique.csv");
            link.click();
        };
    };

    const settingsForm = document.getElementById('settings-form');
    if(settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            const payload = {
                t_min: parseInt(formData.get('t_min')),
                t_max: parseInt(formData.get('t_max')),
                t_base: parseInt(formData.get('t_base')),
                seuil_urgence: parseInt(formData.get('seuil_urgence')),
                distance_critique: parseInt(formData.get('distance_critique')),
                facteur_ext: parseFloat(formData.get('facteur_ext'))
            };
            
            fetch('/api/config/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json()).then(data => {
                alert("Configuration déployée au contrôleur local via l'API !");
                state.T_BASE = payload.t_base;
            }).catch(err => {
                alert("Erreur de connexion au serveur.");
            });
        });
    }
});
