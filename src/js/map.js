/**
 * map.js - Gestione della mappa OpenStreetMap con Leaflet
 * Gestisce i layer di base, il marker dell'osservatore, l'overlay canvas del Viewshed
 * e il raggio di analisi.
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
        this.peakMarker = null;

        this.currentObserver = {
            lat: 45.8326, // Default: Monte Bianco
            lon: 6.8652,
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

        // Layer Cartografici
        const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });

        const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
        });

        const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });

        const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
        });

        this.map = L.map(this.mapContainerId, {
            center: [this.currentObserver.lat, this.currentObserver.lon],
            zoom: 11,
            layers: [openTopoMap] // Default rilievo topografico
        });

        // Controllo Layer
        const baseMaps = {
            "OpenTopoMap (Rilievi)": openTopoMap,
            "OpenStreetMap (Standard)": osmStandard,
            "Satellite (Esri)": esriSatellite,
            "Carto Dark": cartoDark
        };
        L.control.layers(baseMaps, null, { position: 'topright' }).addTo(this.map);

        // Scala metrica
        L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(this.map);

        // Layer per linea di vista e picco
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
            title: 'Punto di osservazione (Trascina per spostare)'
        }).addTo(this.map);

        this.observerMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            this.setObserverPosition(pos.lat, pos.lng, true);
        });

        // Eventi click su mappa
        this.map.on('click', (e) => {
            this.setObserverPosition(e.latlng.lat, e.latlng.lng, true);
        });

        // Evento mousemove per quota istantanea
        this.map.on('mousemove', (e) => {
            if (this.onElevationProbe) {
                this.onElevationProbe(e.latlng.lat, e.latlng.lng);
            }
        });
    }

    /**
     * Sposta la posizione dell'osservatore e invoca il callback di calcolo
     */
    setObserverPosition(lat, lon, triggerCallback = true) {
        this.currentObserver.lat = lat;
        this.currentObserver.lon = lon;

        if (this.observerMarker) {
            this.observerMarker.setLatLng([lat, lon]);
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
                color: '#38bdf8',
                weight: 1.5,
                dashArray: '5, 5',
                fill: false,
                interactive: false
            }).addTo(this.map);
        }
    }

    /**
     * Applica l'overlay grafico RGBA del Viewshed sulla mappa
     */
    updateViewshedOverlay(rgbaBuffer, gridData, opacity = 0.65) {
        const L = window.L;
        if (!this.map || !L) return;

        const { minLat, maxLat, minLon, maxLon, gridSize } = gridData;

        // Crea un canvas temporaneo in memoria per generare l'immagine
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
            } else {
                this.map.removeLayer(this.viewshedOverlay);
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
        if (!info || !info.hasObstacle || !info.lat || !info.lon) return;

        const obsLatLng = [this.currentObserver.lat, this.currentObserver.lon];
        const peakLatLng = [info.lat, info.lon];

        // Linea di vista
        const line = L.polyline([obsLatLng, peakLatLng], {
            color: '#fbbf24',
            weight: 2.5,
            dashArray: '4, 4'
        }).addTo(this.sightlineLayer);

        // Marker sulla vetta
        const peakIcon = L.divIcon({
            className: 'peak-target-icon',
            html: `<div class="peak-dot"><i class="fas fa-mountain"></i></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const peakMarker = L.marker(peakLatLng, { icon: peakIcon })
            .bindTooltip(`<b>Vetta Orizzonte (Azimut ${azimuth}°)</b><br>Quota: ${info.elevationM} m<br>Distanza: ${info.distanceKm} km<br>Angolo: +${info.maxAngle.toFixed(2)}°`, {
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
