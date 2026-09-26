/**
 * viewshedWorker.js - Web Worker per il calcolo parallelo ad alte prestazioni di:
 * 1. Viewshed (matrice di intervisibilità 2D con correzione curvatura/rifrazione)
 * 2. Profilo dell'orizzonte topografico a 360° (azimut vs elevazione angolare)
 * 3. Buffer di pixel RGBA per visualizzazione immediata su mappa Leaflet
 */

self.onmessage = function (e) {
    const {
        gridData,
        observerHeight = 1.8,
        targetHeight = 0.0,
        colorMode = 'visibility',
        refractionCoeff = 0.13,
        overlayOpacity = 0.65
    } = e.data;

    const {
        centerLat,
        centerLon,
        radiusKm,
        minLat,
        maxLat,
        minLon,
        maxLon,
        gridSize,
        elevations
    } = gridData;

    const R_EARTH = 6371000.0; // Raggio medio terrestre in metri
    const R_EFF = R_EARTH / (1.0 - refractionCoeff); // Raggio efficace con rifrazione (~7.323.000 m)

    // Trova l'indice del punto osservatore al centro della griglia
    const obsRow = Math.floor(gridSize / 2);
    const obsCol = Math.floor(gridSize / 2);
    const obsTerrainElev = elevations[obsRow * gridSize + obsCol];
    const obsTotalElev = obsTerrainElev + observerHeight;

    const latStep = (maxLat - minLat) / (gridSize - 1);
    const lonStep = (maxLon - minLon) / (gridSize - 1);
    const centerLatRad = centerLat * Math.PI / 180;
    const cosCenterLat = Math.cos(centerLatRad);

    const mPerDegLat = 111320.0;
    const mPerDegLon = 111320.0 * cosCenterLat;

    const radiusM = radiusKm * 1000.0;

    // Buffer dei risultati
    const isVisible = new Uint8Array(gridSize * gridSize);
    const elevationAngles = new Float32Array(gridSize * gridSize);
    const distances = new Float32Array(gridSize * gridSize);
    const azimuths = new Float32Array(gridSize * gridSize);

    // Profilo orizzonte a 360° (360 bin da 1 grado ciascuno)
    const NUM_BINS = 360;
    const horizonProfile = [];
    for (let i = 0; i < NUM_BINS; i++) {
        horizonProfile.push({
            azimuth: i,
            maxAngle: -90.0,
            distanceKm: 0,
            elevationM: 0,
            lat: 0,
            lon: 0,
            hasObstacle: false
        });
    }

    let minAngleSeen = 90.0;
    let maxAngleSeen = -90.0;
    let minTerrainElev = 99999;
    let maxTerrainElev = -99999;
    let visibleCount = 0;
    let totalInRadiusCount = 0;

    // 1. Calcolo angoli, distanze e azimut per ogni cella rispetto all'osservatore
    for (let r = 0; r < gridSize; r++) {
        const lat = maxLat - r * latStep;
        const dy = (lat - centerLat) * mPerDegLat;

        for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            const lon = minLon + c * lonStep;
            const dx = (lon - centerLon) * mPerDegLon;

            const dist = Math.sqrt(dx * dx + dy * dy);
            distances[idx] = dist;

            const elev = elevations[idx];
            if (elev < minTerrainElev) minTerrainElev = elev;
            if (elev > maxTerrainElev) maxTerrainElev = elev;

            if (dist === 0) {
                azimuths[idx] = 0;
                elevationAngles[idx] = 0;
                isVisible[idx] = 1;
                continue;
            }

            // Calcolo Azimut (0° Nord, 90° Est, 180° Sud, 270° Ovest)
            let az = Math.atan2(dx, dy) * 180 / Math.PI;
            if (az < 0) az += 360;
            azimuths[idx] = az;

            // Correzione curvatura terrestre + rifrazione: deltaH = dist^2 / (2 * R_EFF)
            const curvatureDrop = (dist * dist) / (2.0 * R_EFF);
            const targetTotalElev = elev + targetHeight - curvatureDrop;
            const deltaH = targetTotalElev - obsTotalElev;

            // Elevazione angolare in gradi
            const angleDeg = Math.atan2(deltaH, dist) * 180 / Math.PI;
            elevationAngles[idx] = angleDeg;

            if (dist <= radiusM) {
                totalInRadiusCount++;
            }
        }
    }

    // 2. Line of Sight (Ray Casting) radiale verso il perimetro
    // Campioniamo raggi a passo molto fine per coprire tutti i pixel
    const numRays = gridSize * 4;
    const maxSteps = Math.floor(gridSize * 0.72);

    for (let ray = 0; ray < numRays; ray++) {
        const rayAngleRad = (ray / numRays) * 2 * Math.PI;
        const sinA = Math.sin(rayAngleRad); // x dir (lon)
        const cosA = Math.cos(rayAngleRad); // y dir (lat)

        let maxAngleOnRay = -90.0;

        for (let step = 1; step <= maxSteps; step++) {
            const c = Math.round(obsCol + step * sinA);
            const r = Math.round(obsRow - step * cosA);

            if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) break;

            const idx = r * gridSize + c;
            const dist = distances[idx];
            if (dist > radiusM) continue;

            const angle = elevationAngles[idx];
            const az = azimuths[idx];
            const binIdx = Math.floor(az) % NUM_BINS;

            if (angle >= maxAngleOnRay) {
                isVisible[idx] = 1;
                maxAngleOnRay = angle;

                if (angle > horizonProfile[binIdx].maxAngle) {
                    const lat = maxLat - r * latStep;
                    const lon = minLon + c * lonStep;
                    horizonProfile[binIdx].maxAngle = angle;
                    horizonProfile[binIdx].distanceKm = Math.round((dist / 1000) * 10) / 10;
                    horizonProfile[binIdx].elevationM = Math.round(elevations[idx]);
                    horizonProfile[binIdx].lat = lat;
                    horizonProfile[binIdx].lon = lon;
                    horizonProfile[binIdx].hasObstacle = true;
                }
            }

            if (angle > maxAngleSeen) maxAngleSeen = angle;
            if (angle < minAngleSeen) minAngleSeen = angle;
        }
    }

    // Conta visibili nel raggio
    for (let i = 0; i < gridSize * gridSize; i++) {
        if (distances[i] <= radiusM && isVisible[i] === 1) {
            visibleCount++;
        }
    }

    // Completa i bin dell'orizzonte non coperti con un valore di base piatto
    for (let i = 0; i < NUM_BINS; i++) {
        if (!horizonProfile[i].hasObstacle) {
            // Se nessun rilievo supera l'orizzonte geometrico
            const d = radiusKm * 1000;
            const drop = (d * d) / (2 * R_EFF);
            horizonProfile[i].maxAngle = Math.atan2(-obsTotalElev - drop, d) * 180 / Math.PI;
            horizonProfile[i].distanceKm = radiusKm;
            horizonProfile[i].elevationM = 0;
        }
    }

    // 3. Generazione buffer immagine RGBA per la mappa
    const rgbaBuffer = new Uint8ClampedArray(gridSize * gridSize * 4);

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            const pixelIdx = idx * 4;
            const dist = distances[idx];

            // Trasparente al di fuori del cerchio di raggio
            if (dist > radiusM) {
                rgbaBuffer[pixelIdx + 3] = 0;
                continue;
            }

            const visible = isVisible[idx] === 1;
            const angle = elevationAngles[idx];
            const elev = elevations[idx];

            let red = 0, green = 0, blue = 0, alpha = Math.floor(overlayOpacity * 255);

            if (colorMode === 'visibility') {
                if (visible) {
                    // Gradiente da verde smeraldo a giallo dorato in base all'angolo di elevazione
                    const normAngle = Math.max(0, Math.min(1, (angle - minAngleSeen) / (maxAngleSeen - minAngleSeen + 0.001)));
                    red = Math.floor(16 + 220 * normAngle);
                    green = Math.floor(185 + 50 * (1 - normAngle));
                    blue = Math.floor(129 * (1 - normAngle));
                    alpha = Math.floor(overlayOpacity * 255);
                } else {
                    // Aree in ombra: leggera sfumatura rubino/antracite semi-trasparente
                    red = 220;
                    green = 38;
                    blue = 38;
                    alpha = Math.floor(overlayOpacity * 0.35 * 255);
                }
            } else if (colorMode === 'elevation_angle') {
                // Mappa termica Turbo/Spectral per l'angolo di elevazione
                const norm = Math.max(0, Math.min(1, (angle - minAngleSeen) / (maxAngleSeen - minAngleSeen + 0.001)));
                const color = turboColormap(norm);
                red = color[0];
                green = color[1];
                blue = color[2];
                alpha = visible ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.25 * 255);
            } else if (colorMode === 'elevation') {
                // Gradiente altimetrico (verde pianura -> marrone -> bianco vette)
                const normElev = Math.max(0, Math.min(1, (elev - minTerrainElev) / (maxTerrainElev - minTerrainElev + 0.001)));
                const color = terrainColormap(normElev);
                red = color[0];
                green = color[1];
                blue = color[2];
                alpha = visible ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.2 * 255);
            } else if (colorMode === 'distance') {
                // Gradiente di distanza (Azzurro vicino -> Viola lontano)
                const normDist = dist / radiusM;
                red = Math.floor(59 + (147 - 59) * normDist);
                green = Math.floor(130 - 90 * normDist);
                blue = Math.floor(246 - 20 * normDist);
                alpha = visible ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.2 * 255);
            }

            rgbaBuffer[pixelIdx] = red;
            rgbaBuffer[pixelIdx + 1] = green;
            rgbaBuffer[pixelIdx + 2] = blue;
            rgbaBuffer[pixelIdx + 3] = alpha;
        }
    }

    const visiblePercent = totalInRadiusCount > 0 ? (visibleCount / totalInRadiusCount * 100).toFixed(1) : '0';

    self.postMessage({
        rgbaBuffer,
        horizonProfile,
        stats: {
            obsTerrainElev: Math.round(obsTerrainElev),
            obsTotalElev: Math.round(obsTotalElev * 10) / 10,
            minTerrainElev: Math.round(minTerrainElev),
            maxTerrainElev: Math.round(maxTerrainElev),
            minAngleSeen: Math.round(minAngleSeen * 100) / 100,
            maxAngleSeen: Math.round(maxAngleSeen * 100) / 100,
            visiblePercent,
            radiusKm
        }
    }, [rgbaBuffer.buffer]);
};

/**
 * Colormap Termico / Turbo (0.0 -> 1.0)
 */
function turboColormap(t) {
    // Approssimazione colormap vibrante (Blu -> Ciano -> Verde -> Giallo -> Rosso)
    let r, g, b;
    if (t < 0.25) {
        const f = t / 0.25;
        r = 0;
        g = Math.floor(255 * f);
        b = 255;
    } else if (t < 0.5) {
        const f = (t - 0.25) / 0.25;
        r = 0;
        g = 255;
        b = Math.floor(255 * (1 - f));
    } else if (t < 0.75) {
        const f = (t - 0.5) / 0.25;
        r = Math.floor(255 * f);
        g = 255;
        b = 0;
    } else {
        const f = (t - 0.75) / 0.25;
        r = 255;
        g = Math.floor(255 * (1 - f * 0.8));
        b = 0;
    }
    return [r, g, b];
}

/**
 * Colormap Topografico (Verde -> Giallo -> Marrone -> Grigio -> Bianco)
 */
function terrainColormap(t) {
    if (t < 0.2) {
        return [34, 139, 34]; // Forest green
    } else if (t < 0.4) {
        return [154, 205, 50]; // Yellow green
    } else if (t < 0.65) {
        return [218, 165, 32]; // Goldenrod / brown
    } else if (t < 0.85) {
        return [139, 69, 19]; // Saddle brown / rock
    } else {
        return [245, 245, 245]; // Snow white
    }
}
