/**
 * celestialTracker.js - Controller della paletta di tracciamento corpi celesti & effemeridi
 * Gestisce:
 * - Filtro per categorie (Pianeti, Nebulose con Helix Nebula, Galassie, Ammassi, Stelle)
 * - Ricerca istantanea nel catalogo
 * - Selezione multipla di oggetti da tracciare nel grafico dell'orizzonte
 * - Calcolo e visualizzazione delle schede di effemeridi (sorge/tramonta dietro i rilievi, culminazione, ore visibili)
 */

import { CELESTIAL_CATALOG, CELESTIAL_CATEGORIES } from './deepSkyCatalog.js';
import { AstronomyService } from './astronomy.js';

export class CelestialTracker {
    constructor(chartManager, mapManager, onStateChange = null) {
        this.chartManager = chartManager;
        this.mapManager = mapManager;
        this.onStateChange = onStateChange;

        this.selectedObjects = new Map(); // id -> object
        this.activeCategory = 'all';
        this.searchQuery = '';
        this.selectedDate = new Date();
        this.activeDetailObject = null;

        // Seleziona di default NGC 7293 Helix Nebula e Giove come suggerimenti iniziali
        const helix = CELESTIAL_CATALOG.find(o => o.id === 'NGC7293');
        const jupiter = CELESTIAL_CATALOG.find(o => o.id === 'JUPITER');
        if (helix) this.selectedObjects.set(helix.id, helix);
        if (jupiter) this.selectedObjects.set(jupiter.id, jupiter);

        this.initDOM();
    }

    initDOM() {
        this.panel = document.getElementById('celestialPanel');
        this.objectListContainer = document.getElementById('celestialList');
        this.detailContainer = document.getElementById('celestialDetailCard');
        this.categoryTabsContainer = document.getElementById('celestialCategoryTabs');
        this.searchInput = document.getElementById('celestialSearchInput');
        this.dateInput = document.getElementById('celestialDatePicker');
        this.quickTrackHelixBtn = document.getElementById('quickHelixBtn');
        this.quickTrackPlanetsBtn = document.getElementById('quickPlanetsBtn');
        this.quickClearBtn = document.getElementById('quickClearBtn');

        this.bindEvents();
        this.renderCategoryTabs();
        this.renderObjectList();
    }

    bindEvents() {
        // Ricerca
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.renderObjectList();
            });
        }

        // Data
        if (this.dateInput) {
            const todayStr = new Date().toISOString().split('T')[0];
            this.dateInput.value = todayStr;
            this.dateInput.addEventListener('change', (e) => {
                if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    this.selectedDate = new Date(y, m - 1, d, 22, 0, 0); // default alle 22:00
                    this.updateChartTrackers();
                    this.renderObjectList();
                    if (this.activeDetailObject) {
                        this.showObjectDetails(this.activeDetailObject);
                    }
                }
            });
        }

        // Bottoni Rapidi
        if (this.quickTrackHelixBtn) {
            this.quickTrackHelixBtn.addEventListener('click', () => {
                const helix = CELESTIAL_CATALOG.find(o => o.id === 'NGC7293');
                if (helix) {
                    this.toggleObjectSelection(helix, true);
                    this.showObjectDetails(helix);
                }
            });
        }

        if (this.quickTrackPlanetsBtn) {
            this.quickTrackPlanetsBtn.addEventListener('click', () => {
                CELESTIAL_CATALOG.filter(o => o.category === 'planet').forEach(p => {
                    this.selectedObjects.set(p.id, p);
                });
                this.updateChartTrackers();
                this.renderObjectList();
            });
        }

        if (this.quickClearBtn) {
            this.quickClearBtn.addEventListener('click', () => {
                this.selectedObjects.clear();
                this.updateChartTrackers();
                this.renderObjectList();
            });
        }

        // Toggle Pannello Corpi Celesti
        const openBtn = document.getElementById('openCelestialBtn');
        const closeBtn = document.getElementById('closeCelestialBtn');
        const tabBtn = document.getElementById('tabCelestial');

        if (openBtn) openBtn.addEventListener('click', () => this.openPanel());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closePanel());
        if (tabBtn) tabBtn.addEventListener('click', () => {
            this.openPanel();
        });
    }

    openPanel() {
        if (this.panel) {
            this.panel.classList.add('open');
            this.renderObjectList();
            if (!this.activeDetailObject) {
                const helix = CELESTIAL_CATALOG.find(o => o.id === 'NGC7293');
                if (helix) this.showObjectDetails(helix);
            }
        }
    }

    closePanel() {
        if (this.panel) {
            this.panel.classList.remove('open');
        }
    }

    togglePanel() {
        if (this.panel && this.panel.classList.contains('open')) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    renderCategoryTabs() {
        if (!this.categoryTabsContainer) return;
        this.categoryTabsContainer.innerHTML = '';

        Object.entries(CELESTIAL_CATEGORIES).forEach(([key, label]) => {
            const btn = document.createElement('button');
            btn.className = `cat-tab ${this.activeCategory === key ? 'active' : ''}`;
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.activeCategory = key;
                this.renderCategoryTabs();
                this.renderObjectList();
            });
            this.categoryTabsContainer.appendChild(btn);
        });
    }

    renderObjectList() {
        if (!this.objectListContainer) return;
        this.objectListContainer.innerHTML = '';

        const obs = this.mapManager ? this.mapManager.currentObserver : { lat: 46.55744, lon: 13.27853 };
        const horizon = this.chartManager ? this.chartManager.currentHorizonData : null;

        const filtered = CELESTIAL_CATALOG.filter(item => {
            // Filtro Categoria
            if (this.activeCategory !== 'all' && item.category !== this.activeCategory) {
                return false;
            }
            // Filtro Testo di Ricerca
            if (this.searchQuery) {
                const matchesName = item.name.toLowerCase().includes(this.searchQuery);
                const matchesId = item.id.toLowerCase().includes(this.searchQuery);
                const matchesConst = (item.constellation || '').toLowerCase().includes(this.searchQuery);
                const matchesDesc = (item.description || '').toLowerCase().includes(this.searchQuery);
                return matchesName || matchesId || matchesConst || matchesDesc;
            }
            return true;
        });

        if (filtered.length === 0) {
            this.objectListContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <span>Nessun corpo celeste trovato per "${this.searchQuery}"</span>
                </div>
            `;
            return;
        }

        filtered.forEach(obj => {
            const isSelected = this.selectedObjects.has(obj.id);
            const eph = AstronomyService.calculateObjectEphemerides(obj, this.selectedDate, obs.lat, obs.lon, horizon);

            const card = document.createElement('div');
            card.className = `celestial-card ${isSelected ? 'selected' : ''} ${obj.featured ? 'featured' : ''}`;
            
            card.innerHTML = `
                <div class="celestial-card-header">
                    <div class="celestial-title-wrap">
                        <span class="celestial-color-dot" style="background-color: ${obj.color || '#38bdf8'}"></span>
                        <div class="celestial-name">${obj.name}</div>
                    </div>
                    <label class="toggle-switch" title="Mostra traiettoria nel grafico">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${obj.id}">
                        <span class="switch-slider"></span>
                    </label>
                </div>
                <div class="celestial-meta">
                    <span class="meta-tag"><i class="fas fa-compass"></i> ${obj.constellation}</span>
                    <span class="meta-tag"><i class="fas fa-star"></i> Mag ${obj.mag}</span>
                    <span class="status-pill ${eph.current.statusClass}">
                        ${eph.current.isAboveMountains ? '🟢' : (eph.current.altitude > 0 ? '🟠' : '⚫')} ${eph.current.statusText} (${eph.current.altitude > 0 ? '+' : ''}${eph.current.altitude}°)
                    </span>
                </div>
                <div class="celestial-eph-summary">
                    <span><i class="fas fa-mountain"></i> Visibile stanotte: <strong>${eph.visibility.nightVisibleStr}</strong></span>
                    <span><i class="fas fa-arrow-up"></i> Culmina: <strong>${eph.culmination.time} (${eph.culmination.altitude}°)</strong></span>
                </div>
            `;

            // Click sulla scheda: mostra dettagli approfonditi
            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.classList.contains('switch-slider')) {
                    return; // gestito dal checkbox
                }
                this.showObjectDetails(obj);
            });

            // Toggle switch nel checkbox
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleObjectSelection(obj, e.target.checked);
                    card.classList.toggle('selected', e.target.checked);
                });
            }

            this.objectListContainer.appendChild(card);
        });
    }

    toggleObjectSelection(obj, select = null) {
        const currentlySelected = this.selectedObjects.has(obj.id);
        const shouldSelect = select !== null ? select : !currentlySelected;

        if (shouldSelect) {
            this.selectedObjects.set(obj.id, obj);
        } else {
            this.selectedObjects.delete(obj.id);
        }

        this.updateChartTrackers();
        this.renderObjectList();
    }

    updateChartTrackers() {
        if (this.chartManager) {
            const list = Array.from(this.selectedObjects.values());
            this.chartManager.setTrackedCelestialObjects(list, this.selectedDate);
        }
        if (this.onStateChange) {
            this.onStateChange(this.selectedObjects);
        }
    }

    showObjectDetails(obj) {
        this.activeDetailObject = obj;
        if (!this.detailContainer) return;

        const obs = this.mapManager ? this.mapManager.currentObserver : { lat: 46.55744, lon: 13.27853 };
        const horizon = this.chartManager ? this.chartManager.currentHorizonData : null;
        const eph = AstronomyService.calculateObjectEphemerides(obj, this.selectedDate, obs.lat, obs.lon, horizon);
        const isSelected = this.selectedObjects.has(obj.id);

        const raStr = `${Math.floor(eph.current.raHours)}h ${Math.floor((eph.current.raHours % 1) * 60)}m`;
        const decSign = eph.current.decDeg >= 0 ? '+' : '';
        const decStr = `${decSign}${eph.current.decDeg.toFixed(2)}°`;

        this.detailContainer.innerHTML = `
            <div class="detail-card-inner">
                <div class="detail-header">
                    <div>
                        <h3 class="detail-title">${obj.name}</h3>
                        <div class="detail-sub">${obj.description || ''}</div>
                    </div>
                    <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}" id="detailToggleTrackBtn">
                        <i class="fas ${isSelected ? 'fa-check' : 'fa-plus'}"></i> ${isSelected ? 'Tracciato' : 'Traccia nel Grafico'}
                    </button>
                </div>

                <div class="detail-status-banner ${eph.current.statusClass}">
                    <i class="fas ${eph.current.isAboveMountains ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    <span>${eph.current.statusText} — Elevazione: <strong>${eph.current.altitude > 0 ? '+' : ''}${eph.current.altitude}°</strong> (Orizzonte Rilievi: ${eph.current.horizonAngle}°)</span>
                </div>

                <div class="detail-grid">
                    <div class="detail-stat-box">
                        <span class="detail-label">🌄 Sorge sopra i rilievi</span>
                        <span class="detail-val highlight">${eph.rise.realTime}</span>
                        <span class="detail-subval">Azimut: ${eph.rise.realAz} (Teorico 0°: ${eph.rise.mathTime})</span>
                    </div>

                    <div class="detail-stat-box">
                        <span class="detail-label">🌟 Culminazione (Sud)</span>
                        <span class="detail-val highlight">${eph.culmination.time}</span>
                        <span class="detail-subval">Altezza Max: ${eph.culmination.altitude}° (Az: ${eph.culmination.azimuth}°)</span>
                    </div>

                    <div class="detail-stat-box">
                        <span class="detail-label">🌇 Tramonta dietro i monti</span>
                        <span class="detail-val highlight">${eph.set.realTime}</span>
                        <span class="detail-subval">Azimut: ${eph.set.realAz} (Teorico 0°: ${eph.set.mathTime})</span>
                    </div>

                    <div class="detail-stat-box">
                        <span class="detail-label">⏱️ Finestra Buio Utile</span>
                        <span class="detail-val highlight-green">${eph.visibility.nightVisibleStr}</span>
                        <span class="detail-subval">Tempo totale sopra le vette di notte</span>
                    </div>
                </div>

                <div class="detail-coords-bar">
                    <span><strong>Costellazione:</strong> ${obj.constellation}</span>
                    <span><strong>Magnitudine:</strong> ${obj.mag}</span>
                    <span><strong>AR / Dec:</strong> ${raStr} / ${decStr}</span>
                </div>
            </div>
        `;

        const detailToggleBtn = document.getElementById('detailToggleTrackBtn');
        if (detailToggleBtn) {
            detailToggleBtn.addEventListener('click', () => {
                this.toggleObjectSelection(obj);
                this.showObjectDetails(obj);
            });
        }
    }

    onHorizonUpdated() {
        this.updateChartTrackers();
        if (this.panel && this.panel.classList.contains('open')) {
            this.renderObjectList();
            if (this.activeDetailObject) {
                this.showObjectDetails(this.activeDetailObject);
            }
        }
    }
}
