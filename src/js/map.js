/**
 * map.js - Gestione della mappa OpenStreetMap con Leaflet
 * Supporta:
 * - Layer cartografici con SkyAtlas 2025 (Inquinamento Luminoso) ad alta risoluzione continua (maxNativeZoom: 6, maxZoom: 19)
 * - Mappa Ibrida SkyAtlas Notturna con strade, toponimi, cime montane e confini
 * - Accesso rapido a Google Maps e Google Street View tramite click destro e popup
 * - Raggiera dell'Orizzonte Massimo e contorno perimetrale vette
 */

export class MapManager {
    constructor(mapContainerId, onLocationSelected, onElevationProbe) {
        this.mapContainerId = mapContainerId;
        this.onLocationSelected = onLocationSelected;
        this.onElevationProbe = onElevationProbe;

        this.map = null;
        this.observerMarker = null;
        this.radiusCircle = null;
        this.viewshedOverlay = null;
        this.sightlineLayer = null;
        this.horizonPerimeterLayer = null;

        this.currentObserver = {
            lat: 46.55744, // Default: Lago di Pramollo - Ristorante da Livio
            lon: 13.27853,
            height: 1.8
        };

        this.initMap();
    }

    initMap() {
        const L = window.L;
        if (!L) {
            console.error('Leaflet L non trovato.');
            return;
        }

        // 1. Layer Cartografici di Base
        const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: 'Mappa: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> | Dati: &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        });

        const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });

        const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
            attribution: 'Satellite: &copy; Esri, Maxar, Earthstar Geographics'
        });

        const esriDark = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 16,
            attribution: 'Tiles &copy; Esri &mdash; Canvas Dark'
        });

        // 2. Layer di Riferimento Geografico (Toponimi, Cime, Strade, Confini)
        const referenceLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            opacity: 0.95
        });

        const referenceRoads = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            opacity: 0.85
        });

        // 3. Generatore Layer SkyAtlas 2025 con upscaling automatico oltre il livello nativo
        // maxNativeZoom: 6 con tileSize 1024px evita che la mappa diventi nera o scompaia zoomando dentro!
        const createSkyAtlasTileLayer = (opacity = 0.80) => L.tileLayer(
            'https://djlorenz.github.io/astronomy/image_tiles/tiles2025/tile_{z}_{x}_{y}.png',
            {
                tileSize: 1024,
                zoomOffset: -2,
                minZoom: 3,
                maxNativeZoom: 6,
                maxZoom: 19,
                opacity: opacity,
                attribution: 'Inquinamento Luminoso: &copy; <a href="https://djlorenz.github.io/astronomy/lp2025/" target="_blank">David J. Lorenz (SkyAtlas 2025)</a>'
            }
        );

        // 4. SkyAtlas 2025 Ibrido Notturno: Dark Canvas + Inquinamento Luminoso + Strade + Cime/Toponimi
        const skyAtlas2025Hybrid = L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }),
            createSkyAtlasTileLayer(0.85),
            referenceRoads,
            referenceLabels
        ]);

        // 5. SkyAtlas 2025 su Rilievi Topografici (OpenTopoMap + SkyAtlas + Riferimenti)
        const skyAtlas2025Topo = L.layerGroup([
            openTopoMap,
            createSkyAtlasTileLayer(0.55),
            referenceLabels
        ]);

        // 6. Overlay autonomi attivabili sopra qualsiasi mappa
        const skyAtlas2025Overlay = createSkyAtlasTileLayer(0.70);
        const geographicLabelsOverlay = L.layerGroup([referenceRoads, referenceLabels]);

        this.map = L.map(this.mapContainerId, {
            center: [this.currentObserver.lat, this.currentObserver.lon],
            zoom: 12,
            layers: [openTopoMap] // Default rilievo topografico
        });

        // Controllo Layer Mappe Base e Overlay
        const baseMaps = {
            "OpenTopoMap (Rilievi)": openTopoMap,
            "OpenStreetMap (Standard)": osmStandard,
            "Satellite (Esri)": esriSatellite,
            "SkyAtlas 2025 Notte Ibrido (Inquinamento + Strade/Cime)": skyAtlas2025Hybrid,
            "SkyAtlas 2025 su Topografia (Rilievi + Inquinamento)": skyAtlas2025Topo,
            "Mappa Dark Canvas": esriDark
        };

        const overlayMaps = {
            "🌙 Overlay SkyAtlas 2025 (Inquinamento Luminoso)": skyAtlas2025Overlay,
            "🏷️ Strade, Cime e Confini": geographicLabelsOverlay
        };

        L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(this.map);

        // Scala metrica
        L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(this.map);

        // Layer per contorno perimetrale orizzonte e linea di vista
        this.horizonPerimeterLayer = L.layerGroup().addTo(this.map);
        this.sightlineLayer = L.layerGroup().addTo(this.map);

        // Icona personalizzata per l'osservatore
        const observerIcon = L.divIcon({
            className: 'observer-marker-icon',
            html: `<div class="pulse-ring"></div><div class="observer-center-dot"><i class="fas fa-eye"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        this.observerMarker = L.marker([this.currentObserver.lat, this.currentObserver.lon], {
            icon: observerIcon,
            draggable: true,
            title: 'Punto di osservazione (Trascina per spostare o clicca per opzioni)'
        }).addTo(this.map);

        this.updateObserverPopup();

        this.observerMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            this.setObserverPosition(pos.lat, pos.lng, true);
        });

        // Evento Click sinistro per spostare osservatore
        this.map.on('click', (e) => {
            this.setObserverPosition(e.latlng.lat, e.latlng.lng, true);
        });

        // Evento Click destro (Context Menu) per accesso rapido a Google Maps & Street View
        this.map.on('contextmenu', (e) => {
            const lat = e.latlng.lat.toFixed(5);
            const lon = e.latlng.lng.toFixed(5);
            const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
            const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

            const popupContent = `
                <div class="custom-context-menu">
                    <div class="menu-title"><i class="fas fa-map-marker-alt"></i> Punto Selezionato (${lat}°, ${lon}°)</div>
                    <div class="menu-actions">
                        <button class="btn btn-sm btn-primary" onclick="window.app.mapManager.setObserverPosition(${lat}, ${lon}, true); window.app.mapManager.map.closePopup();">
                            <i class="fas fa-crosshairs"></i> Imposta Osservatore Qui
                        </button>
                        <a href="${gmapsUrl}" target="_blank" class="btn btn-sm btn-gmaps">
                            <i class="fab fa-google"></i> Apri su Google Maps
                        </a>
                        <a href="${streetViewUrl}" target="_blank" class="btn btn-sm btn-streetview">
                            <i class="fas fa-street-view"></i> Apri Google Street View
                        </a>
                    </div>
                </div>
            `;

            L.popup({ className: 'custom-map-popup' })
                .setLatLng(e.latlng)
                .setContent(popupContent)
                .openOn(this.map);
        });

        // Evento mousemove per quota istantanea
        this.map.on('mousemove', (e) => {
            if (this.onElevationProbe) {
                this.onElevationProbe(e.latlng.lat, e.latlng.lng);
            }
        });
    }

    /**
     * Aggiorna il popup interattivo dell'osservatore con link a Google Maps e Street View
     */
    updateObserverPopup() {
        if (!this.observerMarker) return;
        const lat = this.currentObserver.lat.toFixed(5);
        const lon = this.currentObserver.lon.toFixed(5);
        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

        const popupContent = `
            <div class="observer-popup">
                <div class="popup-header"><i class="fas fa-eye"></i> <b>Punto di Osservazione</b></div>
                <div class="popup-coords">Lat: ${lat}°, Lon: ${lon}°</div>
                <div class="popup-buttons">
                    <a href="${gmapsUrl}" target="_blank" class="btn btn-sm btn-gmaps">
                        <i class="fab fa-google"></i> Google Maps
                    </a>
                    <a href="${streetViewUrl}" target="_blank" class="btn btn-sm btn-streetview">
                        <i class="fas fa-street-view"></i> Street View
                    </a>
                </div>
            </div>
        `;

        this.observerMarker.bindPopup(popupContent, { className: 'custom-map-popup' });
    }

    /**
     * Sposta la posizione dell'osservatore e invoca il callback di calcolo
     */
    setObserverPosition(lat, lon, triggerCallback = true) {
        this.currentObserver.lat = lat;
        this.currentObserver.lon = lon;

        if (this.observerMarker) {
            this.observerMarker.setLatLng([lat, lon]);
            this.updateObserverPopup();
        }

        if (triggerCallback && this.onLocationSelected) {
            this.onLocationSelected(lat, lon);
        }
    }

    /**
     * Aggiorna o crea il cerchio del raggio di visibilità
     */
    updateRadiusCircle(radiusKm) {
        const L = window.L;
        if (!this.map || !L) return;

        const radiusM = radiusKm * 1000;
        const center = [this.currentObserver.lat, this.currentObserver.lon];

        if (this.radiusCircle) {
            this.radiusCircle.setLatLng(center);
            this.radiusCircle.setRadius(radiusM);
        } else {
            this.radiusCircle = L.circle(center, {
                radius: radiusM,
                color: 'rgba(56, 189, 248, 0.4)',
                weight: 1.2,
                dashArray: '4, 4',
                fill: false,
                interactive: false
            }).addTo(this.map);
        }
    }

    /**
     * Applica l'overlay grafico della raggiera/viewshed sulla mappa
     */
    updateViewshedOverlay(rgbaBuffer, gridData, opacity = 0.70, horizonProfile = null) {
        const L = window.L;
        if (!this.map || !L) return;

        const { minLat, maxLat, minLon, maxLon, gridSize } = gridData;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = gridSize;
        offCanvas.height = gridSize;
        const ctx = offCanvas.getContext('2d');
        const imgData = ctx.createImageData(gridSize, gridSize);
        imgData.data.set(rgbaBuffer);
        ctx.putImageData(imgData, 0, 0);

        const dataUrl = offCanvas.toDataURL('image/png');
        const bounds = [[minLat, minLon], [maxLat, maxLon]];

        if (this.viewshedOverlay) {
            this.viewshedOverlay.setUrl(dataUrl);
            this.viewshedOverlay.setBounds(bounds);
            this.viewshedOverlay.setOpacity(opacity);
        } else {
            this.viewshedOverlay = L.imageOverlay(dataUrl, bounds, {
                opacity: opacity,
                interactive: false
            }).addTo(this.map);
        }

        // Traccia il perimetro della cresta dell'orizzonte (solo per veri ostacoli > 2°)
        if (horizonProfile && this.horizonPerimeterLayer) {
            this.horizonPerimeterLayer.clearLayers();
            const points = [];
            horizonProfile.forEach(p => {
                if (p.lat && p.lon && p.hasObstacle && p.maxAngle > 2.0) {
                    points.push([p.lat, p.lon]);
                }
            });

            if (points.length > 2) {
                L.polyline(points, {
                    color: '#38bdf8',
                    weight: 1.6,
                    dashArray: '4, 4',
                    opacity: 0.8,
                    interactive: false
                }).addTo(this.horizonPerimeterLayer);
            }
        }
    }

    setOverlayOpacity(opacity) {
        if (this.viewshedOverlay) {
            this.viewshedOverlay.setOpacity(opacity);
        }
    }

    setOverlayVisible(visible) {
        if (this.viewshedOverlay) {
            if (visible) {
                this.viewshedOverlay.addTo(this.map);
                if (this.horizonPerimeterLayer) this.horizonPerimeterLayer.addTo(this.map);
            } else {
                this.map.removeLayer(this.viewshedOverlay);
                if (this.horizonPerimeterLayer) this.map.removeLayer(this.horizonPerimeterLayer);
            }
        }
    }

    /**
     * Evidenzia la linea di vista e la vetta corrispondente all'azimut selezionato sul grafico
     */
    highlightHorizonTarget(azimuth, info) {
        const L = window.L;
        if (!this.map || !L || !this.sightlineLayer) return;

        this.sightlineLayer.clearLayers();
        if (!info || !info.lat || !info.lon) return;

        const obsLatLng = [this.currentObserver.lat, this.currentObserver.lon];
        const peakLatLng = [info.lat, info.lon];

        let targetColor = '#10b981'; // Verde (< 15°)
        let statusBadge = '<span style="color:#10b981;">● Rilievo Basso (&lt; 15°)</span>';
        if (info.maxAngle >= 20.0) {
            targetColor = '#ef4444'; // Rosso (>= 20°)
            statusBadge = '<span style="color:#ef4444;">● Rilievo Alto (&ge; 20°)</span>';
        } else if (info.maxAngle >= 15.0) {
            targetColor = '#f59e0b'; // Arancio (15° - 20°)
            statusBadge = '<span style="color:#f59e0b;">● Rilievo Medio (15°-20°)</span>';
        }

        // Linea di vista verso il punto di blocco o orizzonte aperto
        L.polyline([obsLatLng, peakLatLng], {
            color: targetColor,
            weight: 3,
            dashArray: '5, 4'
        }).addTo(this.sightlineLayer);

        // Marker sulla vetta / orizzonte
        const peakIcon = L.divIcon({
            className: 'peak-target-icon',
            html: `<div class="peak-dot" style="background:${targetColor}; box-shadow:0 0 12px ${targetColor};"><i class="fas ${info.hasObstacle ? 'fa-mountain' : 'fa-sun'}"></i></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });

        const titleText = info.hasObstacle ? 'Rilievo Orizzonte' : 'Orizzonte Aperto';
        L.marker(peakLatLng, { icon: peakIcon })
            .bindTooltip(`<b>${titleText} (Azimut ${azimuth}°)</b><br>${statusBadge}<br>Inclinazione: <b>+${info.maxAngle.toFixed(2)}°</b><br>Quota: ${info.elevationM} m<br>Distanza: ${info.distanceKm} km`, {
                permanent: false,
                direction: 'top'
            })
            .addTo(this.sightlineLayer);
    }

    clearHighlight() {
        if (this.sightlineLayer) {
            this.sightlineLayer.clearLayers();
        }
    }

    /**
     * Sposta la vista della mappa su determinate coordinate
     */
    panTo(lat, lon, zoom = 12) {
        if (this.map) {
            this.map.setView([lat, lon], zoom, { animate: true });
        }
    }
}
