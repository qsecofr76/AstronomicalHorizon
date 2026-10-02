/**
 * celestialTracker.js - Controller della paletta di tracciamento corpi celesti & effemeridi
 * Gestisce:
 * - Filtro per categorie (Pianeti, Nebulose con Helix Nebula, Galassie, Ammassi, Stelle)
 * - Ricerca istantanea nel catalogo
 * - Selezione multipla di oggetti da tracciare nel grafico dell'orizzonte 360°
 * - Calcolo e visualizzazione delle schede di effemeridi (sorge/tramonta dietro i rilievi, culminazione, ore visibili)
 * - Layout a schede espandibili (accordion) senza sovrapposizioni
 */

import { CELESTIAL_CATALOG, CELESTIAL_CATEGORIES } from './deepSkyCatalog.js';
import { AstronomyService } from './astronomy.js';

export class CelestialTracker {
    constructor(chartManager, mapManager, onStateChange = null) {
        this.chartManager = chartManager;
        this.mapManager = mapManager;
        this.onStateChange = onStateChange;

        this.selectedObjects = new Map(); // id -> object
        this.expandedObjects = new Set(['NGC7293']); // Helix Nebula espansa di default per mostrare subito le effemeridi
        this.activeCategory = 'all';
        this.searchQuery = '';
        this.selectedDate = new Date();

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
        // Ricerca istantanea
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.renderObjectList();
            });
        }

        // Data osservazione
        if (this.dateInput) {
            const todayStr = new Date().toISOString().split('T')[0];
            this.dateInput.value = todayStr;
            this.dateInput.addEventListener('change', (e) => {
                if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    this.selectedDate = new Date(y, m - 1, d, 22, 0, 0); // default alle 22:00
                    this.updateChartTrackers();
                    this.renderObjectList();
                }
            });
        }

        // Pulsanti Rapidi
        if (this.quickTrackHelixBtn) {
            this.quickTrackHelixBtn.addEventListener('click', () => {
                const helix = CELESTIAL_CATALOG.find(o => o.id === 'NGC7293');
                if (helix) {
                    this.selectedObjects.set(helix.id, helix);
                    this.expandedObjects.add(helix.id);
                    this.updateChartTrackers();
                    this.renderObjectList();
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
            btn.type = 'button';
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
            const isExpanded = this.expandedObjects.has(obj.id);
            const eph = AstronomyService.calculateObjectEphemerides(obj, this.selectedDate, obs.lat, obs.lon, horizon);

            const raStr = `${Math.floor(eph.current.raHours)}h ${Math.floor((eph.current.raHours % 1) * 60)}m`;
            const decSign = eph.current.decDeg >= 0 ? '+' : '';
            const decStr = `${decSign}${eph.current.decDeg.toFixed(2)}°`;

            const card = document.createElement('div');
            card.className = `celestial-card ${isSelected ? 'selected' : ''} ${obj.featured ? 'featured' : ''} ${isExpanded ? 'expanded' : ''}`;
            
            // Header Scheda
            let cardHtml = `
                <div class="celestial-card-header">
                    <div class="celestial-title-wrap">
                        <span class="celestial-color-dot" style="background-color: ${obj.color || '#38bdf8'}"></span>
                        <div class="celestial-name">${obj.name}</div>
                    </div>
                    <div class="celestial-card-actions">
                        <label class="toggle-switch" title="Mostra/Nascondi traiettoria nel grafico dell'orizzonte">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${obj.id}">
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Barra di stato e sintesi rapida -->
                <div class="celestial-summary-row">
                    <span class="status-pill ${eph.current.statusClass}">
                        ${eph.current.isAboveMountains ? '🟢' : (eph.current.altitude > 0 ? '🟠' : '⚫')} ${eph.current.statusText} (${eph.current.altitude > 0 ? '+' : ''}${eph.current.altitude}°)
                    </span>
                    <span class="meta-tag"><i class="fas fa-compass"></i> ${obj.constellation}</span>
                    <span class="meta-tag"><i class="fas fa-star"></i> Mag ${obj.mag}</span>
                    <button type="button" class="btn-expand-details" title="${isExpanded ? 'Riduci dettagli' : 'Espandi effemeridi complete'}">
                        <span>${isExpanded ? 'Chiudi Dettagli ▲' : 'Effemeridi & Dettagli ▼'}</span>
                    </button>
                </div>
            `;

            // Dettagli Espansi (Accordion)
            if (isExpanded) {
                cardHtml += `
                    <div class="celestial-expanded-section">
                        ${obj.description ? `<div class="celestial-desc">${obj.description}</div>` : ''}

                        <div class="detail-grid">
                            <div class="detail-stat-box">
                                <span class="detail-label">🌄 Sorge sopra i rilievi</span>
                                <span class="detail-val highlight">${eph.rise.realTime}</span>
                                <span class="detail-subval">Az: ${eph.rise.realAz} (Teorico 0°: ${eph.rise.mathTime})</span>
                            </div>

                            <div class="detail-stat-box">
                                <span class="detail-label">🌟 Culminazione (Sud)</span>
                                <span class="detail-val highlight">${eph.culmination.time}</span>
                                <span class="detail-subval">Alt Max: ${eph.culmination.altitude}° (Az: ${eph.culmination.azimuth}°)</span>
                            </div>

                            <div class="detail-stat-box">
                                <span class="detail-label">🌇 Tramonta dietro i monti</span>
                                <span class="detail-val highlight">${eph.set.realTime}</span>
                                <span class="detail-subval">Az: ${eph.set.realAz} (Teorico 0°: ${eph.set.mathTime})</span>
                            </div>

                            <div class="detail-stat-box">
                                <span class="detail-label">⏱️ Finestra Buio Utile</span>
                                <span class="detail-val highlight-green">${eph.visibility.nightVisibleStr}</span>
                                <span class="detail-subval">Tempo totale sopra le vette di notte</span>
                            </div>
                        </div>

                        <div class="detail-coords-bar">
                            <span><strong>Coordinate:</strong> AR ${raStr} | Dec ${decStr}</span>
                            <span><strong>Orizzonte Monti:</strong> ${eph.current.horizonAngle}°</span>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = cardHtml;

            // Toggle espansione accordion
            const expandBtn = card.querySelector('.btn-expand-details');
            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.expandedObjects.has(obj.id)) {
                        this.expandedObjects.delete(obj.id);
                    } else {
                        this.expandedObjects.add(obj.id);
                    }
                    this.renderObjectList();
                });
            }

            // Click su tutta la card per espandere/chiudere
            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.classList.contains('switch-slider') || e.target.closest('.toggle-switch')) {
                    return; // gestito dal checkbox
                }
                if (this.expandedObjects.has(obj.id)) {
                    this.expandedObjects.delete(obj.id);
                } else {
                    this.expandedObjects.add(obj.id);
                }
                this.renderObjectList();
            });

            // Toggle switch nel checkbox
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleObjectSelection(obj, e.target.checked);
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

    onHorizonUpdated() {
        this.updateChartTrackers();
        if (this.panel && this.panel.classList.contains('open')) {
            this.renderObjectList();
        }
    }
}
