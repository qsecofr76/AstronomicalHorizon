/**
 * astronomy.js - Motore di calcolo astronomico ed effemeridi ad alte prestazioni
 * Ottimizzato per calcolo on-demand (lazy), caching istantaneo e rendering a 60 FPS.
 */

export class AstronomyService {
    static RAD = Math.PI / 180;
    static DEG = 180 / Math.PI;

    // Cache per effemeridi dettagliate
    static _ephemCache = new Map();

    static getJulianDate(date) {
        return (date.getTime() / 86400000.0) + 2440587.5;
    }

    /**
     * Calcola il tempo siderale medio di Greenwich (GMST) in gradi [0, 360)
     */
    static getGMST(date) {
        const jd = this.getJulianDate(date);
        const d = jd - 2451545.0;
        let gmst = 280.46061837 + 360.98564736629 * d;
        return ((gmst % 360) + 360) % 360;
    }

    /**
     * Calcola il tempo siderale locale (LST) in gradi [0, 360)
     */
    static getLST(date, lon) {
        const gmst = this.getGMST(date);
        return ((gmst + lon) % 360 + 360) % 360;
    }

    /**
     * Converte coordinate equatoriali in Altazimutali (Azimut, Elevazione)
     * Azimut: 0° Nord, 90° Est, 180° Sud, 270° Ovest
     */
    static radecToAltAz(raHours, decDeg, latDeg, lonDeg, date) {
        const latRad = latDeg * this.RAD;
        const decRad = decDeg * this.RAD;
        const raDeg = raHours * 15.0;

        const lstDeg = this.getLST(date, lonDeg);
        let hourAngleDeg = ((lstDeg - raDeg) % 360 + 360) % 360;
        if (hourAngleDeg > 180) hourAngleDeg -= 360;
        const hRad = hourAngleDeg * this.RAD;

        const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hRad);
        const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
        const altDeg = altRad * this.DEG;

        const x = -Math.sin(hRad) * Math.cos(decRad);
        const y = Math.tan(decRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(hRad);
        let azDeg = Math.atan2(x, y) * this.DEG;
        azDeg = ((azDeg % 360) + 360) % 360;

        return {
            azimuth: azDeg,
            altitude: altDeg,
            hourAngleDeg: hourAngleDeg
        };
    }

    /**
     * Calcola la posizione solare (Azimut ed Elevazione)
     */
    static getSolarPosition(date, lat, lon) {
        const julianDate = this.getJulianDate(date);
        const julianCentury = (julianDate - 2451545.0) / 36525.0;

        let geomMeanLongSun = (280.46646 + julianCentury * (36000.76983 + 0.0003032 * julianCentury)) % 360;
        geomMeanLongSun = (geomMeanLongSun + 360) % 360;

        const geomMeanAnomSun = 357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);
        const eccentEarthOrbit = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

        const sunEqOfCtr = Math.sin(geomMeanAnomSun * this.RAD) * (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury))
            + Math.sin(2 * geomMeanAnomSun * this.RAD) * (0.019993 - 0.000101 * julianCentury)
            + Math.sin(3 * geomMeanAnomSun * this.RAD) * 0.000289;

        const sunTrueLong = geomMeanLongSun + sunEqOfCtr;
        const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * julianCentury) * this.RAD);

        const meanObliqEcliptic = 23.0 + (26.0 + ((21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813)))) / 60.0) / 60.0;
        const obliqCorr = meanObliqEcliptic + 0.00256 * Math.cos((125.04 - 1934.136 * julianCentury) * this.RAD);

        const sinDeclination = Math.sin(obliqCorr * this.RAD) * Math.sin(sunAppLong * this.RAD);
        const declination = Math.asin(sinDeclination);

        const y = Math.tan(obliqCorr * this.RAD / 2.0) * Math.tan(obliqCorr * this.RAD / 2.0);
        const eqOfTime = 4.0 * this.DEG * (
            y * Math.sin(2 * geomMeanLongSun * this.RAD)
            - 2.0 * eccentEarthOrbit * Math.sin(geomMeanAnomSun * this.RAD)
            + 4.0 * eccentEarthOrbit * y * Math.sin(geomMeanAnomSun * this.RAD) * Math.cos(2 * geomMeanLongSun * this.RAD)
            - 0.5 * y * y * Math.sin(4 * geomMeanLongSun * this.RAD)
            - 1.25 * eccentEarthOrbit * eccentEarthOrbit * Math.sin(2 * geomMeanAnomSun * this.RAD)
        );

        const timeZoneOffset = -date.getTimezoneOffset();
        const localTimeMinutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
        const trueSolarTime = (localTimeMinutes + eqOfTime + 4.0 * lon - timeZoneOffset * 60 + 2880) % 1440;

        let hourAngle = (trueSolarTime / 4.0) - 180.0;
        if (hourAngle < -180.0) hourAngle += 360.0;

        const latRad = lat * this.RAD;
        const sinAltitude = Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle * this.RAD);
        const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude))) * this.DEG;

        const cosAzimuth = (Math.sin(declination) - Math.sin(latRad) * sinAltitude) / (Math.cos(latRad) * Math.cos(altitude * this.RAD));
        let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * this.DEG;
        if (hourAngle > 0) azimuth = 360 - azimuth;

        return {
            azimuth: (azimuth + 180) % 360,
            altitude: altitude,
            timeString: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    }

    /**
     * Calcola la posizione equatoriale per i pianeti e la Luna
     */
    static getPlanetaryEquatorialCoords(planetId, date) {
        const jd = this.getJulianDate(date);
        const d = jd - 2451545.0;
        const T = d / 36525.0;
        const rad = this.RAD;
        const deg = this.DEG;

        if (planetId === 'MOON') {
            let L0 = (218.3164477 + 481267.88128 * T) % 360;
            let M = (134.9633964 + 477198.867505 * T) % 360;
            let M_sun = (357.5291092 + 35999.0502909 * T) % 360;
            let D = (297.8501921 + 445267.1114034 * T) % 360;
            let F = (93.2720950 + 483202.0175233 * T) % 360;

            let lEcl = L0 
                + 6.289 * Math.sin(M * rad)
                - 1.274 * Math.sin((2 * D - M) * rad)
                + 0.658 * Math.sin(2 * D * rad)
                - 0.214 * Math.sin(2 * M * rad)
                - 0.186 * Math.sin(M_sun * rad)
                - 0.114 * Math.sin(2 * F * rad);

            let bEcl = 5.128 * Math.sin(F * rad)
                + 0.280 * Math.sin((M + F) * rad)
                + 0.277 * Math.sin((M - F) * rad)
                + 0.173 * Math.sin((2 * D - F) * rad);

            const eps = 23.439291 - 0.0130042 * T;
            const sinDec = Math.sin(bEcl * rad) * Math.cos(eps * rad) + Math.cos(bEcl * rad) * Math.sin(eps * rad) * Math.sin(lEcl * rad);
            const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) * deg;

            const y = Math.sin(lEcl * rad) * Math.cos(eps * rad) - Math.tan(bEcl * rad) * Math.sin(eps * rad);
            const x = Math.cos(lEcl * rad);
            let raDeg = ((Math.atan2(y, x) * deg) % 360 + 360) % 360;

            return { raHours: raDeg / 15.0, decDeg: dec };
        }

        const planetElements = {
            MERCURY: { a: 0.387098, e: 0.205630, I: 7.0049, L: 252.2509, longPeri: 77.4561, longNode: 48.3309, n: 4.09233445 },
            VENUS:   { a: 0.723332, e: 0.006773, I: 3.3946, L: 181.9798, longPeri: 131.5637, longNode: 76.6799, n: 1.60213034 },
            MARS:    { a: 1.523679, e: 0.093405, I: 1.8497, L: 355.4330, longPeri: 336.0602, longNode: 49.5581, n: 0.52403915 },
            JUPITER: { a: 5.2044,   e: 0.048498, I: 1.3030, L: 34.3515,  longPeri: 14.3312,  longNode: 100.4644, n: 0.08308676 },
            SATURN:  { a: 9.5826,   e: 0.055546, I: 2.4889, L: 50.0774,  longPeri: 93.0572,  longNode: 113.6655, n: 0.03344414 },
            URANUS:  { a: 19.2184,  e: 0.046381, I: 0.7732, L: 314.0550, longPeri: 173.0053, longNode: 74.0060, n: 0.01172834 },
            NEPTUNE: { a: 30.1104,  e: 0.009456, I: 1.7700, L: 304.3487, longPeri: 48.1203,  longNode: 131.7841, n: 0.00598103 }
        };

        const p = planetElements[planetId];
        if (!p) return { raHours: 0, decDeg: 0 };

        const M_earth = (357.5291 + 0.98560028 * d) % 360;
        const e_earth = 0.0167086;
        const v_earth = M_earth + (2 * e_earth - Math.pow(e_earth, 3) / 4) * deg * Math.sin(M_earth * rad);
        const l_earth = (v_earth + 102.9373) % 360;
        const r_earth = (1.000001018 * (1 - Math.pow(e_earth, 2))) / (1 + e_earth * Math.cos(v_earth * rad));
        const Xe = r_earth * Math.cos(l_earth * rad);
        const Ye = r_earth * Math.sin(l_earth * rad);

        const M_planet = (p.L + p.n * d - p.longPeri) % 360;
        let E = M_planet * rad;
        for (let iter = 0; iter < 4; iter++) {
            E = E - (E - p.e * Math.sin(E) - M_planet * rad) / (1 - p.e * Math.cos(E));
        }
        const v_planet = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2)) * deg;
        const r_planet = p.a * (1 - p.e * Math.cos(E));

        const u = (v_planet + p.longPeri - p.longNode) * rad;
        const x_orb = r_planet * (Math.cos(p.longNode * rad) * Math.cos(u) - Math.sin(p.longNode * rad) * Math.sin(u) * Math.cos(p.I * rad));
        const y_orb = r_planet * (Math.sin(p.longNode * rad) * Math.cos(u) + Math.cos(p.longNode * rad) * Math.sin(u) * Math.cos(p.I * rad));
        const z_orb = r_planet * Math.sin(u) * Math.sin(p.I * rad);

        const eps = (23.439291 - 0.0130042 * T) * rad;
        const Xeq = x_orb - Xe;
        const Yeq = (y_orb - Ye) * Math.cos(eps) - z_orb * Math.sin(eps);
        const Zeq = (y_orb - Ye) * Math.sin(eps) + z_orb * Math.cos(eps);

        let raDeg = ((Math.atan2(Yeq, Xeq) * deg) % 360 + 360) % 360;
        const dist = Math.sqrt(Xeq * Xeq + Yeq * Yeq + Zeq * Zeq);
        const decDeg = Math.asin(Math.max(-1, Math.min(1, Zeq / dist))) * deg;

        return { raHours: raDeg / 15.0, decDeg: decDeg };
    }

    /**
     * Posizione istantanea (Ultra-rapida: 1 sola chiamata trigonometrica)
     */
    static getCelestialObjectPosition(object, date, lat, lon) {
        let raHours = object.raHours;
        let decDeg = object.decDeg;

        if (object.isSolarSystem) {
            const planetCoords = this.getPlanetaryEquatorialCoords(object.id, date);
            raHours = planetCoords.raHours;
            decDeg = planetCoords.decDeg;
        }

        const altAz = this.radecToAltAz(raHours, decDeg, lat, lon, date);
        return {
            azimuth: altAz.azimuth,
            altitude: altAz.altitude,
            raHours: raHours,
            decDeg: decDeg,
            timeString: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    }

    /**
     * Stato sintetico istantaneo per la lista (Eseguito in sub-millisecondo senza loop)
     */
    static getQuickStatus(object, date, lat, lon, horizonProfile = null) {
        const pos = this.getCelestialObjectPosition(object, date, lat, lon);
        
        let hThresh = 0.0;
        if (horizonProfile && horizonProfile.length > 0) {
            const bin = Math.min(horizonProfile.length - 1, Math.max(0, Math.round((pos.azimuth / 360.0) * horizonProfile.length)));
            hThresh = horizonProfile[bin] ? horizonProfile[bin].maxAngle : 0.0;
        }

        const isAbove = pos.altitude >= hThresh;
        let statusText = 'Sotto l\'orizzonte';
        let statusClass = 'status-subhorizon';

        if (pos.altitude > 0 && !isAbove) {
            statusText = 'Nascosto dai rilievi';
            statusClass = 'status-blocked';
        } else if (isAbove) {
            statusText = 'Sopra i monti';
            statusClass = 'status-visible-night';
        }

        return {
            altitude: Math.round(pos.altitude * 10) / 10,
            azimuth: Math.round(pos.azimuth * 10) / 10,
            horizonAngle: Math.round(hThresh * 10) / 10,
            isAboveMountains: isAbove,
            statusText: statusText,
            statusClass: statusClass,
            raHours: pos.raHours,
            decDeg: pos.decDeg
        };
    }

    /**
     * Calcolo approfondito delle effemeridi giornaliere (ESEGUITO ON-DEMAND, SOLO QUANDO RICHIESTO)
     * Utilizza cache in memoria per evitare ricalcoli inutili
     */
    static calculateObjectEphemerides(object, baseDate, lat, lon, horizonProfile = null) {
        const dateKey = `${object.id}_${lat.toFixed(2)}_${lon.toFixed(2)}_${baseDate.toDateString()}`;
        if (this._ephemCache.has(dateKey)) {
            return this._ephemCache.get(dateKey);
        }

        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();
        const now = new Date();

        const currentPos = this.getCelestialObjectPosition(object, now, lat, lon);

        let maxAlt = -999;
        let culminationTime = null;
        let culminationAz = 180;
        let riseTimeReal = null;
        let riseAzReal = null;
        let setTimeReal = null;
        let setAzReal = null;
        let riseTimeMath = null;
        let setTimeMath = null;

        let totalNightMinutesVisible = 0;
        let prevAltMath = null;
        let prevAltRealDiff = null;

        const numHorizonPoints = horizonProfile ? horizonProfile.length : 360;
        const getHorizonThreshold = (az) => {
            if (!horizonProfile || horizonProfile.length === 0) return 0.0;
            const bin = Math.min(numHorizonPoints - 1, Math.max(0, Math.round((az / 360.0) * numHorizonPoints)));
            return horizonProfile[bin] ? horizonProfile[bin].maxAngle : 0.0;
        };

        // Passo ottimizzato di 6 minuti (240 step invece di 720, super-veloce)
        for (let m = 0; m <= 24 * 60; m += 6) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const d = new Date(year, month, day, h, min, 0);

            const pos = this.getCelestialObjectPosition(object, d, lat, lon);
            const hThresh = getHorizonThreshold(pos.azimuth);
            const altRealDiff = pos.altitude - hThresh;

            if (pos.altitude > maxAlt) {
                maxAlt = pos.altitude;
                culminationTime = pos.timeString;
                culminationAz = pos.azimuth;
            }

            if (prevAltMath !== null) {
                if (prevAltMath < 0 && pos.altitude >= 0 && !riseTimeMath) {
                    riseTimeMath = pos.timeString;
                } else if (prevAltMath >= 0 && pos.altitude < 0 && !setTimeMath) {
                    setTimeMath = pos.timeString;
                }
            }

            if (prevAltRealDiff !== null) {
                if (prevAltRealDiff < 0 && altRealDiff >= 0 && !riseTimeReal) {
                    riseTimeReal = pos.timeString;
                    riseAzReal = pos.azimuth;
                } else if (prevAltRealDiff >= 0 && altRealDiff < 0 && !setTimeReal) {
                    setTimeReal = pos.timeString;
                    setAzReal = pos.azimuth;
                }
            }

            if (altRealDiff >= 0) {
                // Controllo notte veloce
                const sunPos = this.getSolarPosition(d, lat, lon);
                if (sunPos.altitude <= -12.0) {
                    totalNightMinutesVisible += 6;
                }
            }

            prevAltMath = pos.altitude;
            prevAltRealDiff = altRealDiff;
        }

        const currentHorizonAngle = getHorizonThreshold(currentPos.azimuth);
        const isCurrentlyAboveHorizon = currentPos.altitude >= currentHorizonAngle;

        const formatHours = (mins) => {
            const hh = Math.floor(mins / 60);
            const mm = mins % 60;
            return `${hh}h ${mm}m`;
        };

        const result = {
            object: object,
            current: {
                altitude: Math.round(currentPos.altitude * 10) / 10,
                azimuth: Math.round(currentPos.azimuth * 10) / 10,
                horizonAngle: Math.round(currentHorizonAngle * 10) / 10,
                isAboveMountains: isCurrentlyAboveHorizon,
                statusText: isCurrentlyAboveHorizon ? 'Visibile sopra i rilievi' : (currentPos.altitude > 0 ? 'Nascosto dai monti' : 'Sotto l\'orizzonte'),
                statusClass: isCurrentlyAboveHorizon ? 'status-visible-night' : (currentPos.altitude > 0 ? 'status-blocked' : 'status-subhorizon'),
                raHours: currentPos.raHours,
                decDeg: currentPos.decDeg
            },
            culmination: {
                time: culminationTime || '--:--',
                altitude: Math.round(maxAlt * 10) / 10,
                azimuth: Math.round(culminationAz * 10) / 10
            },
            rise: {
                realTime: riseTimeReal || (maxAlt < 0 ? 'Invisibile' : 'Sempre sorto'),
                realAz: riseAzReal !== null ? `${Math.round(riseAzReal)}°` : '--',
                mathTime: riseTimeMath || '--:--'
            },
            set: {
                realTime: setTimeReal || (maxAlt < 0 ? 'Invisibile' : 'Non tramonta'),
                realAz: setAzReal !== null ? `${Math.round(setAzReal)}°` : '--',
                mathTime: setTimeMath || '--:--'
            },
            visibility: {
                nightVisibleStr: formatHours(totalNightMinutesVisible)
            }
        };

        this._ephemCache.set(dateKey, result);
        return result;
    }

    /**
     * Svuota la cache delle effemeridi (es. al cambio di coordinate)
     */
    static clearCache() {
        this._ephemCache.clear();
    }

    /**
     * Genera la traiettoria per il grafico dell'orizzonte (solo per gli oggetti attivi)
     */
    static generateCelestialPath(object, baseDate, lat, lon, stepMinutes = 12) {
        const points = [];
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();

        for (let m = 0; m <= 24 * 60; m += stepMinutes) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const d = new Date(year, month, day, h, min, 0);
            const pos = this.getCelestialObjectPosition(object, d, lat, lon);

            points.push({
                x: Math.round(pos.azimuth * 10) / 10,
                y: Math.round(pos.altitude * 10) / 10,
                time: pos.timeString
            });
        }

        return points;
    }

    /**
     * Genera la traiettoria solare per il grafico
     */
    static generateDailySolarPath(baseDate, lat, lon) {
        const points = [];
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();

        for (let m = 0; m < 24 * 60; m += 12) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const d = new Date(year, month, day, h, min, 0);
            const pos = this.getSolarPosition(d, lat, lon);

            if (pos.altitude >= -6.0) {
                points.push({
                    x: Math.round(pos.azimuth * 10) / 10,
                    y: Math.round(pos.altitude * 10) / 10,
                    time: pos.timeString
                });
            }
        }

        return points.sort((a, b) => a.x - b.x);
    }

    static getAstronomicalPaths(lat, lon, customDate = new Date()) {
        const year = customDate.getFullYear();
        const summerSolstice = new Date(year, 5, 21, 12, 0, 0);
        const winterSolstice = new Date(year, 11, 21, 12, 0, 0);
        const equinox = new Date(year, 2, 20, 12, 0, 0);

        return {
            today: this.generateDailySolarPath(customDate, lat, lon),
            summerSolstice: this.generateDailySolarPath(summerSolstice, lat, lon),
            winterSolstice: this.generateDailySolarPath(winterSolstice, lat, lon),
            equinox: this.generateDailySolarPath(equinox, lat, lon)
        };
    }
}
