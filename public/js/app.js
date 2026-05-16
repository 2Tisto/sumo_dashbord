document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    const state = { currentScreen: 'dashboard', timer: 24, charts: {} };

    // --- Auth Logic ---
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        document.getElementById('otp-step').classList.remove('hidden');
    });

    document.getElementById('verify-otp').addEventListener('click', () => {
        if(document.getElementById('otp-input').value === '123456') {
            document.getElementById('auth-overlay').classList.add('hidden');
            document.getElementById('app-shell').classList.remove('opacity-0');
            initApp();
        }
    });

    // --- Navigation ---
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.dataset.screen;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.screen-view').forEach(s => s.classList.add('hidden'));
            document.getElementById(`screen-${screen}`).classList.remove('hidden');
            document.getElementById('screen-title').innerText = item.innerText.trim();
            state.currentScreen = screen;
            if(screen === 'intersection') initIntersectionCharts();
            if(screen === 'stats') {
                initStatsCharts();
                initExportSystem();
            }
        });
    });

    // --- Core Logic ---
    const initApp = () => {
        initMap();
        setInterval(() => {
            const clock = document.getElementById('live-clock');
            if(clock) clock.innerText = new Date().toLocaleTimeString();
            updateSystemLoad();
        }, 1000);
        setInterval(updateIntersection, 1000);
        setInterval(simulateMaxPressure, 2000);
        setInterval(triggerEmergencyEvent, 15000);
        populateAlerts();
    };

    // ... (rest of functions) ...

    const initStatsCharts = () => {
        const canvasEff = document.getElementById('chart-efficiency');
        const canvas24h = document.getElementById('chart-traffic-24h');
        const canvasViol = document.getElementById('chart-violations');
        
        if(!canvasEff || !canvas24h || !canvasViol) return;

        // Efficiency Chart
        if(state.charts.efficiency) state.charts.efficiency.destroy();
        state.charts.efficiency = new Chart(canvasEff.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Fixe', 'Adaptatif'],
                datasets: [{ 
                    label: 'Attente (s)', 
                    data: [124.3, 76.5], 
                    backgroundColor: ['#27272a', '#10b981'],
                    borderRadius: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // 24h Traffic Chart
        if(state.charts.traffic24h) state.charts.traffic24h.destroy();
        state.charts.traffic24h = new Chart(canvas24h.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['0h', '4h', '8h', '12h', '16h', '20h'],
                datasets: [{ 
                    label: 'Véhicules', 
                    data: [120, 80, 1100, 850, 1450, 600], 
                    borderColor: '#3b82f6',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Violations Chart
        if(state.charts.violations) state.charts.violations.destroy();
        state.charts.violations = new Chart(canvasViol.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Fixe', 'IA'],
                datasets: [{ 
                    data: [15, 3], 
                    backgroundColor: ['#ef4444', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });
    };

    const initExportSystem = () => {
        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Header
            doc.setFillColor(9, 9, 11);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text("SIGT-BENIN | RAPPORT DE PERFORMANCE", 15, 25);
            
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(10);
            doc.text(`Généré le : ${new Date().toLocaleString()}`, 15, 50);

            // Table
            doc.autoTable({
                startY: 60,
                head: [['Indicateur', 'Mode Fixe', 'Mode Adaptatif', 'Gain']],
                body: [
                    ['Temps d\'attente moy.', '124.3 s', '76.5 s', '38.5%'],
                    ['Débit horaire moy.', '815 v/h', '1312 v/h', '61.0%'],
                    ['Taux de violations', '12%', '2%', '83.3%'],
                    ['CO2 économisé', '-', '-', '4.7 kg/h']
                ],
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] }
            });

            doc.save("SIGT_Cotonou_Performance.pdf");
        });

        document.getElementById('btn-export-csv').addEventListener('click', () => {
            const data = [
                { "Indicateur": "Temps attente", "Fixe": 124.3, "Adaptatif": 76.5, "Unite": "s" },
                { "Indicateur": "Debit", "Fixe": 815, "Adaptatif": 1312, "Unite": "v/h" }
            ];
            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", "SIGT_Data.csv");
            link.click();
        });
    };
});

    const updateSystemLoad = () => {
        const load = 30 + Math.floor(Math.random() * 20);
        const bar = document.getElementById('load-bar');
        if(bar) {
            bar.style.width = load + '%';
            bar.className = load > 70 ? 'bg-red-500' : (load > 50 ? 'bg-amber-500' : 'bg-green-500');
        }
    };

    const initMap = () => {
        const map = L.map('map-container').setView([6.37, 2.39], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const points = [[6.38, 2.37, "Stade"], [6.35, 2.39, "Cadjehoun"], [6.41, 2.34, "Godomey"]];
        points.forEach(p => {
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div class="w-3 h-3 bg-blue-500 rounded-full border-2 border-white neon-glow-blue"></div>`
            });
            L.marker([p[0], p[1]], { icon }).addTo(map).bindPopup(p[2]);
        });
    };

    const updateIntersection = () => {
        if(state.currentScreen !== 'intersection') return;
        state.timer--;
        if(state.timer < 0) {
            state.timer = 30;
            state.intersectionPhase = state.intersectionPhase === 'NS' ? 'EW' : 'NS';
            document.getElementById('active-phase-label').innerText = state.intersectionPhase === 'NS' ? 'AXE NORD-SUD' : 'AXE EST-OUEST';
        }
        document.getElementById('phase-timer').innerText = state.timer.toString().padStart(2, '0');
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
            
            [red, orange, green].forEach(l => l.className = l.className.split(' ')[0]); // reset
            
            if(state.timer < 4 && state.timer > 0) {
                orange.classList.add('active-orange');
            } else if(color === 'green') {
                green.classList.add('active-green');
            } else {
                red.classList.add('active-red');
            }
        };

        if(state.intersectionPhase === 'NS') {
            setLight(lights.north, 'green');
            setLight(lights.south, 'green');
            setLight(lights.east, 'red');
            setLight(lights.west, 'red');
        } else {
            setLight(lights.north, 'red');
            setLight(lights.south, 'red');
            setLight(lights.east, 'green');
            setLight(lights.west, 'green');
        }
    };

    const simulateMaxPressure = () => {
        if (state.currentScreen !== 'intersection') return;
        const axes = ['north', 'south', 'east', 'west'];
        axes.forEach(axis => {
            const el = document.getElementById(`queue-${axis}`);
            let q = parseInt(el.innerText);
            q += Math.floor(Math.random() * 3);
            const light = document.getElementById(`tl-${axis}`);
            if(light && light.querySelector('.active-green')) q -= Math.floor(Math.random() * 5);
            el.innerText = Math.max(0, q);
        });

        const qN = parseInt(document.getElementById('queue-north').innerText);
        const qS = parseInt(document.getElementById('queue-south').innerText);
        const qE = parseInt(document.getElementById('queue-east').innerText);
        const qW = parseInt(document.getElementById('queue-west').innerText);

        const nsP = Math.min(100, (qN + qS) * 2);
        const ewP = Math.min(100, (qE + qW) * 2);

        document.getElementById('bar-pressure-ns').style.width = nsP + '%';
        document.getElementById('pressure-val-ns').innerText = nsP + '%';
        document.getElementById('bar-pressure-ew').style.width = ewP + '%';
        document.getElementById('pressure-val-ew').innerText = ewP + '%';
    };

    const triggerEmergencyEvent = () => {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-8 right-8 bg-red-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-[1000] flex items-center gap-4 animate-bounce border border-red-400/20";
        toast.innerHTML = `<i data-lucide="alert-octagon"></i> <div><p class="font-bold text-sm">URGENCE DÉTECTÉE</p><p class="text-[10px]">Ambulance en approche - Priorité Carrefour Stade</p></div>`;
        document.body.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 6000);
    };

    const populateAlerts = () => {
        const body = document.getElementById('alerts-table-body');
        const mockData = [
            { time: "12:04:12", loc: "Godomey", ev: "Capteur IR Défaillant", sev: "CRITIQUE" },
            { time: "12:15:45", loc: "Stade", ev: "Ambulance Détectée", sev: "MAJEURE" }
        ];
        body.innerHTML = mockData.map(a => `
            <tr class="border-b border-zinc-800">
                <td class="px-6 py-4 font-mono text-xs">${a.time}</td>
                <td class="px-6 py-4">${a.loc}</td>
                <td class="px-6 py-4 text-xs">${a.ev}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 ${a.sev === 'CRITIQUE' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'} text-[10px] font-bold rounded">${a.sev}</span></td>
                <td class="px-6 py-4"><button class="text-xs text-blue-500">Acquitter</button></td>
            </tr>
        `).join('');
    };

    const initIntersectionCharts = () => {
        const ctx = document.getElementById('chart-pressure').getContext('2d');
        if(state.charts.pressure) state.charts.pressure.destroy();
        state.charts.pressure = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1m', '2m', '3m', '4m', '5m'],
                datasets: [{ label: 'Pression Axe N-S', data: [12, 19, 15, 25, 22], borderColor: '#3b82f6' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        alert("Configuration publiée sur MQTT !");
    });
});
