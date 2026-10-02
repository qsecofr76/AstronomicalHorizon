/**
 * celestialTracker.js - Controller della paletta di tracciamento corpi celesti & effemeridi
 * Ottimizzato per calcolo on-demand ("un corpo alla volta, solo a richiesta"):
 * - La lista iniziale si genera istantaneamente in meno di 1 millisecondo senza bloccare l'interfaccia.
 * - Le effemeridi complete (levata monti, culminazione, tramonto, finestra buio) vengono calcolate SOLO per l'oggetto espanso dall'utente.
 */

import { CELESTIAL_CATALOG, CELESTIAL_CATEGORIES } from './deepSkyCatalog.js';
import { AstronomyService } from './astronomy.js';

export class CelestialTracker {
    constructor(chartManager, mapManager, onStateChange = null) {
        this.chartManager = chartManager;
        this.mapManager = mapManager;
        this.onStateChange = onStateChange;

        this.selectedObjects = new Map(); // id -> object
        this.expandedObjectId = null; // Un solo oggetto espanso alla volta per massima velocità
        this.activeCategory = 'all';
        this.searchQuery = '';
        this.selectedDate = new Date();

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
                    this.selectedDate = new Date(y, m - 1, d, 22, 0, 0);
                    AstronomyService.clearCache();
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
                    this.expandedObjectId = helix.id;
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
                this.expandedObjectId = null;
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
        const now = new Date();

        const filtered = CELESTIAL_CATALOG.filter(item => {
            if (this.activeCategory !== 'all' && item.category !== this.activeCategory) {
                return false;
            }
            if (this.searchQuery) {
                const matchesName = item.name.toLowerCase().includes(this.searchQuery);
                const matchesId = item.id.toLowerCase().includes(this.searchQuery);
                const matchesConst = (item.constellation || '').toLowerCase().includes(this.searchQuery);
                return matchesName || matchesId || matchesConst;
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
            const isExpanded = this.expandedObjectId === obj.id;
            
            // Calcolo ultra-veloce dello stato istantaneo (< 0.001 ms per oggetto)
            const quickStatus = AstronomyService.getQuickStatus(obj, now, obs.lat, obs.lon, horizon);

            const card = document.createElement('div');
            card.className = `celestial-card ${isSelected ? 'selected' : ''} ${obj.featured ? 'featured' : ''} ${isExpanded ? 'expanded' : ''}`;
            
            let cardHtml = `
                <div class="celestial-card-header">
                    <div class="celestial-title-wrap">
                        <span class="celestial-color-dot" style="background-color: ${obj.color || '#38bdf8'}"></span>
                        <div class="celestial-name">${obj.name}</div>
                    </div>
                    <label class="toggle-switch" title="Mostra/Nascondi traiettoria nel grafico">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${obj.id}">
                        <span class="switch-slider"></span>
                    </label>
                </div>

                <div class="celestial-summary-row">
                    <span class="status-pill ${quickStatus.statusClass}">
                        ${quickStatus.isAboveMountains ? '🟢' : (quickStatus.altitude > 0 ? '🟠' : '⚫')} ${quickStatus.statusText} (${quickStatus.altitude > 0 ? '+' : ''}${quickStatus.altitude}°)
                    </span>
                    <span class="meta-tag"><i class="fas fa-compass"></i> ${obj.constellation}</span>
                    <span class="meta-tag"><i class="fas fa-star"></i> Mag ${obj.mag}</span>
                    <button type="button" class="btn-expand-details" title="Calcola ed espandi le effemeridi topografiche">
                        <span>${isExpanded ? 'Chiudi ▲' : 'Effemeridi ▾'}</span>
                    </button>
                </div>
            `;

            // Calcolo effemeridi complete ON-DEMAND (solo se l'utente ha aperto questa specifica scheda!)
            if (isExpanded) {
                const eph = AstronomyService.calculateObjectEphemerides(obj, this.selectedDate, obs.lat, obs.lon, horizon);
                const raStr = `${Math.floor(eph.current.raHours)}h ${Math.floor((eph.current.raHours % 1) * 60)}m`;
                const decSign = eph.current.decDeg >= 0 ? '+' : '';
                const decStr = `${decSign}${eph.current.decDeg.toFixed(2)}°`;

                cardHtml += `
                    <div class="celestial-expanded-section">
                        ${obj.description ? `<div class="celestial-desc">${obj.description}</div>` : ''}

                        <div class="detail-grid">
                            <div class="detail-stat-box">
                                <span class="detail-label">🌄 Sorge sopra i monti</span>
                                <span class="detail-val highlight">${eph.rise.realTime}</span>
                                <span class="detail-subval">Az: ${eph.rise.realAz} (0°: ${eph.rise.mathTime})</span>
                            </div>

                            <div class="detail-stat-box">
                                <span class="detail-label">🌟 Culminazione (Sud)</span>
                                <span class="detail-val highlight">${eph.culmination.time}</span>
                                <span class="detail-subval">Alt Max: ${eph.culmination.altitude}°</span>
                            </div>

                            <div class="detail-stat-box">
                                <span class="detail-label">🌇 Tramonta dietro i monti</span>
                                <span class="detail-val highlight">${eph.set.realTime}</span>
                                <span class="detail-subval">Az: ${eph.set.realAz} (0°: ${eph.set.mathTime})</span>
                            </div>

                            <div class="detail-stat-box">
                                <span class="detail-label">⏱️ Finestra Buio Utile</span>
                                <span class="detail-val highlight-green">${eph.visibility.nightVisibleStr}</span>
                                <span class="detail-subval">Sopra i monti di notte</span>
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

            // Click per espandere/comprimere ON-DEMAND
            const expandBtn = card.querySelector('.btn-expand-details');
            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.expandedObjectId = (this.expandedObjectId === obj.id) ? null : obj.id;
                    this.renderObjectList();
                });
            }

            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.classList.contains('switch-slider') || e.target.closest('.toggle-switch')) {
                    return;
                }
                this.expandedObjectId = (this.expandedObjectId === obj.id) ? null : obj.id;
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
        AstronomyService.clearCache();
        this.updateChartTrackers();
        if (this.panel && this.panel.classList.contains('open')) {
            this.renderObjectList();
        }
    }
}
