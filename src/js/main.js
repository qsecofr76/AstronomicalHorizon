/**
 * main.js - Modulo principale e controller applicazione Astronomical Horizon
 * Con supporto completo per navigazione mobile portrait (drawer, bottom tabs, badge flottante).
 */

import { DEMProvider } from './dem.js';
import { MapManager } from './map.js';
import { HorizonChartManager } from './horizonChart.js';
import { ExportUtils } from './exportUtils.js';

class AstronomicalHorizonApp {
    constructor() {
        this.demProvider = new DEMProvider();
        this.worker = null;
        this.mapManager = null;
        this.chartManager = null;

        this.currentGridData = null;
        this.currentHorizonData = null;
        this.currentStats = null;
        this.isCalculating = false;

        this.params = {
            radiusKm: 15,
            observerHeight: 1.8,
            targetHeight: 0.0,
            colorMode: 'raggiera_horizon',
            verticalMagnification: 2.0,
            refractionCoeff: 0.13,
            overlayOpacity: 0.70,
            showSunPaths: true
        };

        this.init();
    }

    async init() {
        this.initWorker();
        this.initUI();
        this.initMobileNav();
        this.initMapAndChart();
        
        // Calcolo iniziale con posizione predefinita (Lago di Pramollo - Ristorante da Livio)
        setTimeout(() => {
            this.runViewshedCalculation(46.55744, 13.27853);
        }, 500);
    }

    initWorker() {
        try {
            this.worker = new Worker(new URL('./viewshedWorker.js', import.meta.url), { type: 'module' });
        } catch (e) {
            console.warn('Fallback worker standard:', e);
            this.worker = new Worker('src/js/viewshedWorker.js');
        }

        this.worker.onmessage = (e) => {
            this.handleWorkerResult(e.data);
        };

        this.worker.onerror = (err) => {
            console.error('Errore nel Viewshed Worker:', err);
            this.setLoading(false);
            this.showToast('Errore durante il calcolo della visibilità', 'error');
        };
    }

    initMapAndChart() {
        this.chartManager = new HorizonChartManager('horizonChartCanvas', (azimuth, info) => {
            if (this.mapManager) {
                this.mapManager.highlightHorizonTarget(azimuth, info);
            }
        });

        this.mapManager = new MapManager(
            'map',
            (lat, lon) => this.onLocationChanged(lat, lon),
            (lat, lon) => this.onMouseHoverMap(lat, lon)
        );
    }

    initUI() {
        // Parametri Sliders
        const radiusSlider = document.getElementById('radiusSlider');
        const radiusVal = document.getElementById('radiusVal');
        radiusSlider.addEventListener('input', (e) => {
            this.params.radiusKm = parseFloat(e.target.value);
            radiusVal.textContent = `${this.params.radiusKm} km`;
            this.mapManager.updateRadiusCircle(this.params.radiusKm);
        });
        radiusSlider.addEventListener('change', () => this.recalculate());

        const heightSlider = document.getElementById('heightSlider');
        const heightVal = document.getElementById('heightVal');
        heightSlider.addEventListener('input', (e) => {
            this.params.observerHeight = parseFloat(e.target.value);
            heightVal.textContent = `${this.params.observerHeight} m`;
        });
        heightSlider.addEventListener('change', () => this.recalculate(false));

        // Slider Magnificazione Profilo
        const magSlider = document.getElementById('magnificationSlider');
        const magVal = document.getElementById('magnificationVal');
        if (magSlider && magVal) {
            magSlider.addEventListener('input', (e) => {
                this.params.verticalMagnification = parseFloat(e.target.value);
                magVal.textContent = `${this.params.verticalMagnification.toFixed(1)}x`;
                if (this.chartManager) {
                    this.chartManager.setMagnification(this.params.verticalMagnification);
                }
            });
        }

        const opacitySlider = document.getElementById('opacitySlider');
        const opacityVal = document.getElementById('opacityVal');
        opacitySlider.addEventListener('input', (e) => {
            this.params.overlayOpacity = parseFloat(e.target.value);
            opacityVal.textContent = `${Math.round(this.params.overlayOpacity * 100)}%`;
            this.mapManager.setOverlayOpacity(this.params.overlayOpacity);
        });

        // Selezione Modalità Colore
        const colorModeSelect = document.getElementById('colorModeSelect');
        colorModeSelect.addEventListener('change', (e) => {
            this.params.colorMode = e.target.value;
            this.recalculate(false);
        });

        // Toggle Layer Orizzonte / Visibilità
        const toggleOverlay = document.getElementById('toggleOverlay');
        if (toggleOverlay) {
            toggleOverlay.addEventListener('change', (e) => {
                this.mapManager.setOverlayVisible(e.target.checked);
            });
        }

        // Toggle Tracce Solari
        const toggleSunPaths = document.getElementById('toggleSunPaths');
        if (toggleSunPaths) {
            toggleSunPaths.addEventListener('change', (e) => {
                this.params.showSunPaths = e.target.checked;
                this.chartManager.toggleSunPaths(e.target.checked);
            });
        }

        // Tasto Espandi / Riduci Grafico
        const expandChartBtn = document.getElementById('expandChartBtn');
        const horizonPanel = document.getElementById('horizonPanel');
        if (expandChartBtn && horizonPanel) {
            expandChartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                horizonPanel.classList.toggle('expanded');
                const isExpanded = horizonPanel.classList.contains('expanded');
                expandChartBtn.innerHTML = isExpanded
                    ? '<i class="fas fa-compress-alt"></i> <span class="desktop-only">Riduci</span>'
                    : '<i class="fas fa-expand-alt"></i> <span class="desktop-only">Espandi</span>';
                setTimeout(() => {
                    if (this.chartManager && this.chartManager.chart) {
                        this.chartManager.chart.resize();
                    }
                }, 310);
            });
        }

        // Preset Località Note
        const presetSelect = document.getElementById('presetSelect');
        presetSelect.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const [lat, lon] = e.target.value.split(',');
            const pLat = parseFloat(lat);
            const pLon = parseFloat(lon);
            this.mapManager.panTo(pLat, pLon, 12);
            this.mapManager.setObserverPosition(pLat, pLon, true);
            this.closeMobileDrawer();
        });

        // Ricerca Nominatim
        const searchInput = document.getElementById('locationSearch');
        const searchBtn = document.getElementById('searchBtn');
        const doSearch = async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            try {
                this.setLoading(true, 'Ricerca toponimo in corso...');
                const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const results = await resp.json();
                this.setLoading(false);
                if (results && results.length > 0) {
                    const first = results[0];
                    const lat = parseFloat(first.lat);
                    const lon = parseFloat(first.lon);
                    this.mapManager.panTo(lat, lon, 12);
                    this.mapManager.setObserverPosition(lat, lon, true);
                    this.showToast(`Trovato: ${first.display_name.split(',')[0]}`, 'success');
                    this.closeMobileDrawer();
                } else {
                    this.showToast('Nessun risultato trovato.', 'warning');
                }
            } catch (err) {
                this.setLoading(false);
                this.showToast('Errore di connessione durante la ricerca.', 'error');
            }
        };

        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });

        // Pulsanti Esportazione
        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            if (this.currentHorizonData && this.mapManager.currentObserver) {
                ExportUtils.exportToCSV(this.currentHorizonData, this.mapManager.currentObserver);
            }
        });

        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            if (this.currentHorizonData && this.mapManager.currentObserver && this.currentStats) {
                ExportUtils.exportToJSON(this.currentHorizonData, this.mapManager.currentObserver, this.currentStats);
            }
        });

        document.getElementById('exportChartBtn').addEventListener('click', () => {
            this.chartManager.exportChartImage();
        });

        // Ricalcolo esplicito
        document.getElementById('recalculateBtn').addEventListener('click', () => {
            this.recalculate(true);
            this.closeMobileDrawer();
        });
    }

    /**
     * Gestione Interfaccia e Navigazione Mobile (Portrait)
     */
    initMobileNav() {
        const mobileDrawerBtn = document.getElementById('mobileDrawerBtn');
        const closeDrawerBtn = document.getElementById('closeDrawerBtn');
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');
        const closeMobileChartBtn = document.getElementById('closeMobileChartBtn');

        const tabMap = document.getElementById('tabMap');
        const tabHorizon = document.getElementById('tabHorizon');
        const tabControls = document.getElementById('tabControls');
        const horizonPanel = document.getElementById('horizonPanel');

        // Toggle Drawer Parametri
        if (mobileDrawerBtn) {
            mobileDrawerBtn.addEventListener('click', () => this.toggleMobileDrawer());
        }
        if (closeDrawerBtn) {
            closeDrawerBtn.addEventListener('click', () => this.closeMobileDrawer());
        }
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', () => this.closeMobileDrawer());
        }

        // Chiudi Bottom Sheet Grafico su Mobile
        if (closeMobileChartBtn && horizonPanel) {
            closeMobileChartBtn.addEventListener('click', () => {
                horizonPanel.classList.remove('mobile-active');
                if (tabMap && tabHorizon) {
                    tabHorizon.classList.remove('active');
                    tabMap.classList.add('active');
                }
            });
        }

        // Bottom Navigation Tabs
        if (tabMap) {
            tabMap.addEventListener('click', () => {
                this.setActiveNavTab(tabMap);
                this.closeMobileDrawer();
                if (horizonPanel) horizonPanel.classList.remove('mobile-active');
            });
        }

        if (tabHorizon) {
            tabHorizon.addEventListener('click', () => {
                this.setActiveNavTab(tabHorizon);
                this.closeMobileDrawer();
                if (horizonPanel) {
                    horizonPanel.classList.add('mobile-active');
                    setTimeout(() => {
                        if (this.chartManager && this.chartManager.chart) {
                            this.chartManager.chart.resize();
                        }
                    }, 250);
                }
            });
        }

        if (tabControls) {
            tabControls.addEventListener('click', () => {
                this.setActiveNavTab(tabControls);
                this.openMobileDrawer();
            });
        }
    }

    setActiveNavTab(activeTab) {
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        if (activeTab) activeTab.classList.add('active');
    }

    openMobileDrawer() {
        const sidebar = document.getElementById('sidebarDrawer');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
    }

    closeMobileDrawer() {
        const sidebar = document.getElementById('sidebarDrawer');
        const backdrop = document.getElementById('sidebarBackdrop');
        const tabControls = document.getElementById('tabControls');
        const tabMap = document.getElementById('tabMap');

        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
        if (tabControls && tabControls.classList.contains('active')) {
            this.setActiveNavTab(tabMap);
        }
    }

    toggleMobileDrawer() {
        const sidebar = document.getElementById('sidebarDrawer');
        if (sidebar && sidebar.classList.contains('open')) {
            this.closeMobileDrawer();
        } else {
            this.openMobileDrawer();
        }
    }

    async onLocationChanged(lat, lon) {
        this.runViewshedCalculation(lat, lon);
    }

    async onMouseHoverMap(lat, lon) {
        const coordSpan = document.getElementById('hoverCoords');
        if (coordSpan) {
            coordSpan.textContent = `Lat: ${lat.toFixed(4)}°, Lon: ${lon.toFixed(4)}°`;
        }
    }

    /**
     * Esegue il calcolo completo:
     * 1. Recupero quota osservatore istantanea
     * 2. Recupero matrice DEM ad alta risoluzione
     * 3. Lancio Worker per raggiera e profilo orizzonte
     */
    async runViewshedCalculation(lat, lon) {
        if (this.isCalculating) return;
        this.isCalculating = true;

        try {
            this.setLoading(true, 'Scaricamento dati altimetrici DEM...');
            this.mapManager.updateRadiusCircle(this.params.radiusKm);

            // 1. Recupero quota osservatore istantanea
            const obsElevation = await this.demProvider.getPointElevation(lat, lon);
            this.updateObserverElevationDisplay(lat, lon, obsElevation);

            // 2. Recupero griglia di elevazione DEM ad alta risoluzione
            this.setLoading(true, 'Generazione raster altimetrico ad alta risoluzione...');
            this.currentGridData = await this.demProvider.getElevationGrid(lat, lon, this.params.radiusKm, 420);

            // 3. Invio al Web Worker per il calcolo della raggiera e intervisibilità
            this.setLoading(true, 'Calcolo raggiera e orizzonte massimo a 360°...');
            this.worker.postMessage({
                gridData: this.currentGridData,
                observerHeight: this.params.observerHeight,
                targetHeight: this.params.targetHeight,
                colorMode: this.params.colorMode,
                refractionCoeff: this.params.refractionCoeff,
                overlayOpacity: this.params.overlayOpacity
            });

        } catch (err) {
            console.error('Errore durante il recupero DEM:', err);
            this.setLoading(false);
            this.isCalculating = false;
            this.showToast('Errore durante il recupero dei dati di elevazione', 'error');
        }
    }

    /**
     * Ricalcola la vista
     */
    recalculate(forceFetchDEM = false) {
        const obs = this.mapManager.currentObserver;
        if (!obs) return;

        if (forceFetchDEM || !this.currentGridData || this.currentGridData.radiusKm !== this.params.radiusKm) {
            this.runViewshedCalculation(obs.lat, obs.lon);
        } else {
            this.setLoading(true, 'Ricalcolo raggiera con nuovi parametri...');
            this.worker.postMessage({
                gridData: this.currentGridData,
                observerHeight: this.params.observerHeight,
                targetHeight: this.params.targetHeight,
                colorMode: this.params.colorMode,
                refractionCoeff: this.params.refractionCoeff,
                overlayOpacity: this.params.overlayOpacity
            });
        }
    }

    handleWorkerResult(data) {
        const { rgbaBuffer, horizonProfile, stats } = data;
        this.currentHorizonData = horizonProfile;
        this.currentStats = stats;

        // 1. Aggiorna overlay mappa con raggiera e perimetro
        if (this.currentGridData) {
            this.mapManager.updateViewshedOverlay(rgbaBuffer, this.currentGridData, this.params.overlayOpacity, horizonProfile);
        }

        // 2. Aggiorna grafico orizzonte 360° con magnificazione
        const obs = this.mapManager.currentObserver;
        this.chartManager.updateChart(horizonProfile, obs.lat, obs.lon);

        // 3. Aggiorna statistiche UI e badge mobile
        this.updateStatsUI(stats);

        this.setLoading(false);
        this.isCalculating = false;
    }

    updateObserverElevationDisplay(lat, lon, elev) {
        const latSpan = document.getElementById('obsLat');
        const lonSpan = document.getElementById('obsLon');
        const elevSpan = document.getElementById('obsElev');
        const mobObsElev = document.getElementById('mobObsElev');

        if (latSpan) latSpan.textContent = `${lat.toFixed(5)}°`;
        if (lonSpan) lonSpan.textContent = `${lon.toFixed(5)}°`;
        if (elevSpan) elevSpan.textContent = `${Math.round(elev)} m`;
        if (mobObsElev) mobObsElev.textContent = `🏔️ Quota: ${Math.round(elev)} m`;

        const gmapsLink = document.getElementById('gmapsLink');
        const streetViewLink = document.getElementById('streetViewLink');
        if (gmapsLink) {
            gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
        }
        if (streetViewLink) {
            streetViewLink.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}`;
        }
    }

    updateStatsUI(stats) {
        document.getElementById('statObsElev').textContent = `${stats.obsTerrainElev} m`;
        document.getElementById('statTotalElev').textContent = `${stats.obsTotalElev} m`;
        document.getElementById('statVisiblePct').textContent = `${stats.visiblePercent}%`;
        document.getElementById('statMinElev').textContent = `${stats.minTerrainElev} m`;
        document.getElementById('statMaxElev').textContent = `${stats.maxTerrainElev} m`;
        document.getElementById('statMaxAngle').textContent = `${stats.maxAngleSeen > 0 ? '+' : ''}${stats.maxAngleSeen}°`;

        const mobObsAngle = document.getElementById('mobObsAngle');
        if (mobObsAngle) {
            mobObsAngle.textContent = `Orizzonte Max: ${stats.maxAngleSeen > 0 ? '+' : ''}${stats.maxAngleSeen}°`;
        }
    }

    setLoading(active, message = 'Elaborazione in corso...') {
        const loader = document.getElementById('loaderOverlay');
        const loaderText = document.getElementById('loaderText');
        if (loader) {
            if (active) {
                loader.classList.remove('hidden');
                if (loaderText) loaderText.textContent = message;
            } else {
                loader.classList.add('hidden');
            }
        }
    }

    showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${msg}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
}

// Avvio applicazione al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AstronomicalHorizonApp();
});
