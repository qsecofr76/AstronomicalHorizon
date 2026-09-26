/**
 * viewshedWorker.js - Web Worker per il calcolo parallelo ad alta risoluzione di:
 * 1. Viewshed 2D con correzione curvatura/rifrazione
 * 2. Profilo Orizzonte a 720 punti (0.5° di risoluzione angolare)
 * 3. Interpolazione naturale e continua tra i picchi e i colli montani
 * 4. Buffer RGBA per overlay mappa Leaflet
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

    const R_EARTH = 6371000.0;
    const R_EFF = R_EARTH / (1.0 - refractionCoeff);

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

    const isVisible = new Uint8Array(gridSize * gridSize);
    const elevationAngles = new Float32Array(gridSize * gridSize);
    const distances = new Float32Array(gridSize * gridSize);
    const azimuths = new Float32Array(gridSize * gridSize);

    // 720 bins per 0.5° di risoluzione ad altissima fedeltà
    const NUM_BINS = 720;
    const horizonProfile = [];
    for (let i = 0; i < NUM_BINS; i++) {
        const az = i * (360.0 / NUM_BINS);
        horizonProfile.push({
            azimuth: Math.round(az * 10) / 10,
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

            let az = Math.atan2(dx, dy) * 180 / Math.PI;
            if (az < 0) az += 360;
            azimuths[idx] = az;

            // Correzione curvatura + rifrazione
            const curvatureDrop = (dist * dist) / (2.0 * R_EFF);
            const targetTotalElev = elev + targetHeight - curvatureDrop;
            const deltaH = targetTotalElev - obsTotalElev;

            const angleDeg = Math.atan2(deltaH, dist) * 180 / Math.PI;
            elevationAngles[idx] = angleDeg;

            if (dist <= radiusM) {
                totalInRadiusCount++;
            }
        }
    }

    // 2. Line of Sight (Ray Casting) a passo denso e sub-pixel
    const numRays = Math.max(gridSize * 6, 2880);
    const maxSteps = Math.floor(gridSize * 0.72);

    for (let ray = 0; ray < numRays; ray++) {
        const rayAngleRad = (ray / numRays) * 2 * Math.PI;
        const sinA = Math.sin(rayAngleRad);
        const cosA = Math.cos(rayAngleRad);

        let maxAngleOnRay = -90.0;

        for (let step = 0.5; step <= maxSteps; step += 0.5) {
            const rawC = obsCol + step * sinA;
            const rawR = obsRow - step * cosA;

            const c = Math.round(rawC);
            const r = Math.round(rawR);

            if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) break;

            const idx = r * gridSize + c;
            const dist = distances[idx];
            if (dist > radiusM) continue;

            const angle = elevationAngles[idx];
            const az = azimuths[idx];
            const binIdx = Math.floor((az / 360.0) * NUM_BINS) % NUM_BINS;

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

    // Conta celle visibili nel raggio
    for (let i = 0; i < gridSize * gridSize; i++) {
        if (distances[i] <= radiusM && isVisible[i] === 1) {
            visibleCount++;
        }
    }

    // 3. Interpolazione naturale e continua dell'orizzonte (Skyline Interpolation tra i picchi)
    interpolateHorizonProfile(horizonProfile, NUM_BINS, radiusKm, obsTotalElev, R_EFF);

    // 4. Generazione buffer immagine RGBA per la mappa
    const rgbaBuffer = new Uint8ClampedArray(gridSize * gridSize * 4);

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            const pixelIdx = idx * 4;
            const dist = distances[idx];

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
                    const normAngle = Math.max(0, Math.min(1, (angle - minAngleSeen) / (maxAngleSeen - minAngleSeen + 0.001)));
                    red = Math.floor(16 + 220 * normAngle);
                    green = Math.floor(185 + 50 * (1 - normAngle));
                    blue = Math.floor(129 * (1 - normAngle));
                    alpha = Math.floor(overlayOpacity * 255);
                } else {
                    red = 220;
                    green = 38;
                    blue = 38;
                    alpha = Math.floor(overlayOpacity * 0.35 * 255);
                }
            } else if (colorMode === 'elevation_angle') {
                const norm = Math.max(0, Math.min(1, (angle - minAngleSeen) / (maxAngleSeen - minAngleSeen + 0.001)));
                const color = turboColormap(norm);
                red = color[0];
                green = color[1];
                blue = color[2];
                alpha = visible ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.25 * 255);
            } else if (colorMode === 'elevation') {
                const normElev = Math.max(0, Math.min(1, (elev - minTerrainElev) / (maxTerrainElev - minTerrainElev + 0.001)));
                const color = terrainColormap(normElev);
                red = color[0];
                green = color[1];
                blue = color[2];
                alpha = visible ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.2 * 255);
            } else if (colorMode === 'distance') {
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
            radiusKm,
            numSightPoints: NUM_BINS
        }
    }, [rgbaBuffer.buffer]);
};

/**
 * Interpolazione avanzata circolare e continua tra i picchi e le selle montane (Skyline Spline)
 */
function interpolateHorizonProfile(horizonProfile, numBins, radiusKm, obsTotalElev, R_EFF) {
    const d = radiusKm * 1000;
    const drop = (d * d) / (2 * R_EFF);
    const geometricHorizonAngle = Math.atan2(-obsTotalElev - drop, d) * 180 / Math.PI;

    // Trova tutti gli indici che hanno un ostacolo valido rilevato
    const obstacleIndices = [];
    for (let i = 0; i < numBins; i++) {
        if (horizonProfile[i].hasObstacle && horizonProfile[i].maxAngle > -89.0) {
            obstacleIndices.push(i);
        }
    }

    if (obstacleIndices.length === 0) {
        // Nessun rilievo: orizzonte piatto sferico
        for (let i = 0; i < numBins; i++) {
            horizonProfile[i].maxAngle = geometricHorizonAngle;
            horizonProfile[i].distanceKm = radiusKm;
            horizonProfile[i].elevationM = 0;
        }
        return;
    }

    // Se ci sono buchi tra i picchi rilevati, interpola circolarmente con spline cubica naturale
    for (let k = 0; k < obstacleIndices.length; k++) {
        const currIdx = obstacleIndices[k];
        const nextIdx = obstacleIndices[(k + 1) % obstacleIndices.length];

        let gap = nextIdx - currIdx;
        if (gap <= 0) gap += numBins;

        if (gap > 1) {
            const pStart = horizonProfile[currIdx];
            const pEnd = horizonProfile[nextIdx];

            for (let step = 1; step < gap; step++) {
                const targetIdx = (currIdx + step) % numBins;
                const t = step / gap;
                // Interpolazione cosinusoidale / smoothstep per un profilo montano organico
                const smoothT = t * t * (3 - 2 * t);

                // Calcola quota e angolo interpolato
                const interpAngle = pStart.maxAngle * (1 - smoothT) + pEnd.maxAngle * smoothT;
                const interpDist = pStart.distanceKm * (1 - smoothT) + pEnd.distanceKm * smoothT;
                const interpElev = pStart.elevationM * (1 - smoothT) + pEnd.elevationM * smoothT;
                const interpLat = pStart.lat * (1 - smoothT) + pEnd.lat * smoothT;
                const interpLon = pStart.lon * (1 - smoothT) + pEnd.lon * smoothT;

                if (!horizonProfile[targetIdx].hasObstacle || horizonProfile[targetIdx].maxAngle < interpAngle) {
                    horizonProfile[targetIdx].maxAngle = interpAngle;
                    horizonProfile[targetIdx].distanceKm = Math.round(interpDist * 10) / 10;
                    horizonProfile[targetIdx].elevationM = Math.round(interpElev);
                    horizonProfile[targetIdx].lat = interpLat;
                    horizonProfile[targetIdx].lon = interpLon;
                    horizonProfile[targetIdx].hasObstacle = true;
                }
            }
        }
    }

    // Filtro di lisciatura circolare a 5 punti che preserva i picchi montani più alti
    const origAngles = horizonProfile.map(p => p.maxAngle);
    for (let i = 0; i < numBins; i++) {
        const im2 = (i - 2 + numBins) % numBins;
        const im1 = (i - 1 + numBins) % numBins;
        const ip1 = (i + 1) % numBins;
        const ip2 = (i + 2) % numBins;

        const weightedAvg = 0.1 * origAngles[im2] + 0.25 * origAngles[im1] + 0.3 * origAngles[i] + 0.25 * origAngles[ip1] + 0.1 * origAngles[ip2];
        // Preserva i picchi e ammorbidisce le valli
        horizonProfile[i].maxAngle = Math.max(origAngles[i] * 0.96, weightedAvg);
    }
}

function turboColormap(t) {
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

function terrainColormap(t) {
    if (t < 0.2) return [34, 139, 34];
    if (t < 0.4) return [154, 205, 50];
    if (t < 0.65) return [218, 165, 32];
    if (t < 0.85) return [139, 69, 19];
    return [245, 245, 245];
}
