/**
 * viewshedWorker.js - Web Worker per il calcolo parallelo ad alta risoluzione di:
 * 1. Raggiera dell'Orizzonte Massimo (bloccata dai rilievi, colorata di rosso > 20° e verde < 15°)
 * 2. Gestione tolleranze operative: esclusione micro-rumore ravvicinato (<100m) ed estensione orizzonte aperto per pendenze <= 2°
 * 3. Viewshed 2D e campionamento delle quote
 * 4. Profilo Orizzonte a 720 punti con interpolazione naturale continua
 * 5. Buffer RGBA per visualizzazione su mappa Leaflet
 */

self.onmessage = function (e) {
    const {
        gridData,
        observerHeight = 1.8,
        targetHeight = 0.0,
        colorMode = 'raggiera_horizon',
        refractionCoeff = 0.13,
        overlayOpacity = 0.70
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

    // Angolo dell'orizzonte geometrico sferico (con rifrazione)
    const dropAtRadius = (radiusM * radiusM) / (2.0 * R_EFF);
    const geometricHorizonAngle = Math.atan2(-obsTotalElev - dropAtRadius, radiusM) * 180 / Math.PI;

    const isVisible = new Uint8Array(gridSize * gridSize);
    const elevationAngles = new Float32Array(gridSize * gridSize);
    const distances = new Float32Array(gridSize * gridSize);
    const azimuths = new Float32Array(gridSize * gridSize);

    // 720 bins (0.5° per bin)
    const NUM_BINS = 720;
    const horizonProfile = [];
    for (let i = 0; i < NUM_BINS; i++) {
        const az = i * (360.0 / NUM_BINS);
        horizonProfile.push({
            azimuth: Math.round(az * 10) / 10,
            maxAngle: geometricHorizonAngle,
            distanceKm: radiusKm, // Di default orizzonte aperto alla massima distanza
            elevationM: 0,
            lat: centerLat + (radiusKm / 111.32) * Math.cos(az * Math.PI / 180),
            lon: centerLon + (radiusKm / (111.32 * cosCenterLat)) * Math.sin(az * Math.PI / 180),
            hasObstacle: false,
            maxPeakFound: -90.0,
            peakDistM: radiusM,
            peakElev: 0,
            peakLat: 0,
            peakLon: 0
        });
    }

    let minAngleSeen = 90.0;
    let maxAngleSeen = -90.0;
    let minTerrainElev = 99999;
    let maxTerrainElev = -99999;
    let visibleCount = 0;
    let totalInRadiusCount = 0;

    // 1. Calcolo angoli, distanze e azimut per ogni cella
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

    // 2. Line of Sight (Ray Casting) con tolleranze operative e filtro prossimale
    // Tolleranza operativa:
    // - I punti entro MIN_OBSTACLE_DIST (es. 100m) non bloccano l'orizzonte (evita micro-bump da 1 metro sul terreno dei piedi)
    // - Un rilievo con inclinazione <= 2.0° è considerato orizzonte zero/aperto (la raggiera prosegue fino alla massima distanza)
    const MIN_OBSTACLE_DIST_M = 100.0;
    const FLAT_HORIZON_THRESHOLD_DEG = 2.0;

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

            // Determina se il punto è visibile
            if (angle >= maxAngleOnRay) {
                isVisible[idx] = 1;
                maxAngleOnRay = angle;

                // Registra il picco dell'orizzonte SOLO a distanza distale (>= 100 metri)
                if (dist >= MIN_OBSTACLE_DIST_M) {
                    const bin = horizonProfile[binIdx];
                    if (angle > bin.maxPeakFound) {
                        bin.maxPeakFound = angle;
                        bin.peakDistM = dist;
                        bin.peakElev = elevations[idx];
                        bin.peakLat = maxLat - r * latStep;
                        bin.peakLon = minLon + c * lonStep;
                    }
                }
            }

            if (angle > maxAngleSeen) maxAngleSeen = angle;
            if (angle < minAngleSeen) minAngleSeen = angle;
        }
    }

    // 3. Valutazione Orizzonte per ogni Azimut con tolleranza pendenza <= 2°
    for (let i = 0; i < NUM_BINS; i++) {
        const bin = horizonProfile[i];
        const peakAngle = bin.maxPeakFound;

        if (peakAngle > FLAT_HORIZON_THRESHOLD_DEG) {
            // Rilievo reale significativo (> 2°): orizzonte bloccato dal picco/cresta
            bin.maxAngle = peakAngle;
            bin.distanceKm = Math.round((bin.peakDistM / 1000.0) * 10) / 10;
            bin.elevationM = Math.round(bin.peakElev);
            bin.lat = bin.peakLat;
            bin.lon = bin.peakLon;
            bin.hasObstacle = true;
        } else {
            // Pendenza minima (<= 2°): pianura, vallata aperta, lago o belvedere
            // L'orizzonte si estende aperto alla massima distanza del raggio impostato
            bin.maxAngle = Math.max(geometricHorizonAngle, peakAngle > -80 ? peakAngle : geometricHorizonAngle);
            bin.distanceKm = radiusKm;
            bin.elevationM = Math.round(bin.peakElev || 0);
            bin.hasObstacle = false;
        }
    }

    // Conta celle visibili nel raggio
    for (let i = 0; i < gridSize * gridSize; i++) {
        if (distances[i] <= radiusM && isVisible[i] === 1) {
            visibleCount++;
        }
    }

    // 4. Interpolazione naturale e continua tra i picchi montani
    interpolateHorizonProfile(horizonProfile, NUM_BINS, radiusKm, obsTotalElev, R_EFF, geometricHorizonAngle);

    // 5. Generazione buffer immagine RGBA per la mappa
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

            const az = azimuths[idx];
            const binIdx = Math.floor((az / 360.0) * NUM_BINS) % NUM_BINS;
            const horizonItem = horizonProfile[binIdx];
            const obstacleDistM = (horizonItem.distanceKm || radiusKm) * 1000.0;
            const horizonAngle = horizonItem.maxAngle;

            let red = 0, green = 0, blue = 0, alpha = 0;

            if (colorMode === 'raggiera_horizon') {
                // MODALITÀ RAGGIERA DELL'ORIZZONTE MASSIMO:
                // - Se dist <= obstacleDistM: raggio visivo attivo
                // - Rosso se supera i 20°, verde se inferiore ai 15°
                if (dist <= obstacleDistM) {
                    const color = getHorizonThresholdColor(horizonAngle);
                    red = color[0];
                    green = color[1];
                    blue = color[2];

                    // Effetto raggiera: lieve modulazione radiale per esaltare i fasci di vista
                    const rayModulation = 0.90 + 0.10 * Math.abs(Math.cos(az * Math.PI / 180 * 36));
                    red = Math.min(255, Math.floor(red * rayModulation));
                    green = Math.min(255, Math.floor(green * rayModulation));
                    blue = Math.min(255, Math.floor(blue * rayModulation));

                    const distRatio = dist / Math.max(1, obstacleDistM);
                    const baseAlpha = overlayOpacity * (0.55 + 0.45 * distRatio);

                    // Evidenziazione bordo di cresta per veri ostacoli
                    const isRidgeBorder = horizonItem.hasObstacle && Math.abs(dist - obstacleDistM) < (radiusM / gridSize * 2.5);
                    if (isRidgeBorder) {
                        alpha = Math.floor(Math.min(1.0, overlayOpacity + 0.25) * 255);
                        red = Math.min(255, red + 30);
                        green = Math.min(255, green + 30);
                        blue = Math.min(255, blue + 30);
                    } else {
                        alpha = Math.floor(baseAlpha * 255);
                    }
                } else {
                    // Oltre il rilievo bloccante: zona in ombra discreta
                    red = 30;
                    green = 41;
                    blue = 59;
                    alpha = Math.floor(overlayOpacity * 0.15 * 255);
                }
            } else if (colorMode === 'visibility') {
                const visible = isVisible[idx] === 1;
                const angle = elevationAngles[idx];
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
                const angle = elevationAngles[idx];
                const norm = Math.max(0, Math.min(1, (angle - minAngleSeen) / (maxAngleSeen - minAngleSeen + 0.001)));
                const color = turboColormap(norm);
                red = color[0];
                green = color[1];
                blue = color[2];
                alpha = isVisible[idx] ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.25 * 255);
            } else if (colorMode === 'elevation') {
                const elev = elevations[idx];
                const normElev = Math.max(0, Math.min(1, (elev - minTerrainElev) / (maxTerrainElev - minTerrainElev + 0.001)));
                const color = terrainColormap(normElev);
                red = color[0];
                green = color[1];
                blue = color[2];
                alpha = isVisible[idx] ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.2 * 255);
            } else if (colorMode === 'distance') {
                const normDist = dist / radiusM;
                red = Math.floor(59 + (147 - 59) * normDist);
                green = Math.floor(130 - 90 * normDist);
                blue = Math.floor(246 - 20 * normDist);
                alpha = isVisible[idx] ? Math.floor(overlayOpacity * 255) : Math.floor(overlayOpacity * 0.2 * 255);
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
 * Calcola il colore per la raggiera in base all'angolo dell'orizzonte massimo:
 * - Rosso se supera i 20°
 * - Gradiente verso toni verdi se inferiore ai 15°
 */
function getHorizonThresholdColor(angleDeg) {
    if (angleDeg >= 20.0) {
        const intensity = Math.min(1.0, (angleDeg - 20.0) / 10.0);
        const r = 239;
        const g = Math.floor(68 * (1.0 - intensity * 0.4));
        const b = Math.floor(68 * (1.0 - intensity * 0.4));
        return [r, g, b];
    } else if (angleDeg >= 15.0) {
        const t = (angleDeg - 15.0) / 5.0; // 0.0 a 15°, 1.0 a 20°
        const r = Math.floor(132 + (239 - 132) * t);
        const g = Math.floor(204 + (68 - 204) * t);
        const b = Math.floor(22 + (68 - 22) * t);
        return [r, g, b];
    } else {
        // Toni verdi per angoli inferiori a 15°
        const t = Math.max(0.0, Math.min(1.0, (angleDeg - 0.0) / 15.0));
        const r = Math.floor(34 + (132 - 34) * t);
        const g = Math.floor(197 + (204 - 197) * t);
        const b = Math.floor(94 + (22 - 94) * t);
        return [r, g, b];
    }
}

/**
 * Interpolazione circolare e continua tra i picchi e le selle montane
 */
function interpolateHorizonProfile(horizonProfile, numBins, radiusKm, obsTotalElev, R_EFF, geometricHorizonAngle) {
    const obstacleIndices = [];
    for (let i = 0; i < numBins; i++) {
        if (horizonProfile[i].hasObstacle && horizonProfile[i].maxAngle > 2.0) {
            obstacleIndices.push(i);
        }
    }

    if (obstacleIndices.length === 0) {
        // Nessun rilievo alto > 2°: l'orizzonte è aperto a 360°
        return;
    }

    // Interpola buchi stretti tra picchi adiacenti (es. creste montuose continue)
    for (let k = 0; k < obstacleIndices.length; k++) {
        const currIdx = obstacleIndices[k];
        const nextIdx = obstacleIndices[(k + 1) % obstacleIndices.length];

        let gap = nextIdx - currIdx;
        if (gap <= 0) gap += numBins;

        // Interpola solo gap ragionevoli (< 45° di ampiezza, pari a 90 bin)
        if (gap > 1 && gap < 90) {
            const pStart = horizonProfile[currIdx];
            const pEnd = horizonProfile[nextIdx];

            for (let step = 1; step < gap; step++) {
                const targetIdx = (currIdx + step) % numBins;
                if (!horizonProfile[targetIdx].hasObstacle) {
                    const t = step / gap;
                    const smoothT = t * t * (3 - 2 * t);

                    const interpAngle = pStart.maxAngle * (1 - smoothT) + pEnd.maxAngle * smoothT;
                    const interpDist = pStart.distanceKm * (1 - smoothT) + pEnd.distanceKm * smoothT;
                    const interpElev = pStart.elevationM * (1 - smoothT) + pEnd.elevationM * smoothT;
                    const interpLat = pStart.lat * (1 - smoothT) + pEnd.lat * smoothT;
                    const interpLon = pStart.lon * (1 - smoothT) + pEnd.lon * smoothT;

                    if (interpAngle > 2.0) {
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
    }

    // Filtro di smoothing locale preservativo per i picchi
    const origAngles = horizonProfile.map(p => p.maxAngle);
    for (let i = 0; i < numBins; i++) {
        if (horizonProfile[i].hasObstacle) {
            const im1 = (i - 1 + numBins) % numBins;
            const ip1 = (i + 1) % numBins;
            const weightedAvg = 0.25 * origAngles[im1] + 0.5 * origAngles[i] + 0.25 * origAngles[ip1];
            horizonProfile[i].maxAngle = Math.max(origAngles[i] * 0.96, weightedAvg);
        }
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
