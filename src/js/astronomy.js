/**
 * astronomy.js - Motore di calcolo astronomico ed effemeridi (Jean Meeus / NOAA / VSOP87 approx)
 * Calcola:
 * - Traiettorie solari giornaliere (Oggi, Solstizi ed Equinozi)
 * - Posizione in tempo reale e traiettorie altazimutali di Pianeti, Luna e Oggetti del Cielo Profondo (DSO / Messier / NGC)
 * - Effemeridi complete: Levata, Culminazione, Tramonto e Intervisibilità reale con la cresta montuosa
 */

export class AstronomyService {
    static RAD = Math.PI / 180;
    static DEG = 180 / Math.PI;

    static getJulianDate(date) {
        return (date.getTime() / 86400000.0) + 2440587.5;
    }

    /**
     * Calcola il tempo siderale medio di Greenwich (GMST) in gradi [0, 360)
     */
    static getGMST(date) {
        const jd = this.getJulianDate(date);
        const d = jd - 2451545.0; // Giorni da J2000.0
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
     * Converte coordinate equatoriali (RA in ore, Dec in gradi) in Altazimutali (Azimut, Elevazione)
     * Azimut: 0° Nord, 90° Est, 180° Sud, 270° Ovest
     */
    static radecToAltAz(raHours, decDeg, latDeg, lonDeg, date) {
        const latRad = latDeg * this.RAD;
        const decRad = decDeg * this.RAD;
        const raDeg = raHours * 15.0;

        // Calcolo Angolo Orario H in radianti
        const lstDeg = this.getLST(date, lonDeg);
        let hourAngleDeg = ((lstDeg - raDeg) % 360 + 360) % 360;
        if (hourAngleDeg > 180) hourAngleDeg -= 360;
        const hRad = hourAngleDeg * this.RAD;

        // Calcolo Elevazione (Altezza angolare h)
        const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hRad);
        const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
        const altDeg = altRad * this.DEG;

        // Calcolo Azimut astronomico da Nord
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
     * Calcola la posizione solare accurata (Azimut ed Elevazione)
     */
    static getSolarPosition(date, lat, lon) {
        const julianDate = this.getJulianDate(date);
        const julianCentury = (julianDate - 2451545.0) / 36525.0;

        // Longitudine media del Sole
        let geomMeanLongSun = 280.46646 + julianCentury * (36000.76983 + 0.0003032 * julianCentury);
        geomMeanLongSun = ((geomMeanLongSun % 360) + 360) % 360;

        // Anomalia media del Sole
        const geomMeanAnomSun = 357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);

        // Eccentricità orbita terrestre
        const eccentEarthOrbit = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

        // Equazione del centro
        const sunEqOfCtr = Math.sin(geomMeanAnomSun * this.RAD) * (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury))
            + Math.sin(2 * geomMeanAnomSun * this.RAD) * (0.019993 - 0.000101 * julianCentury)
            + Math.sin(3 * geomMeanAnomSun * this.RAD) * 0.000289;

        // Longitudine vera ed apparente
        const sunTrueLong = geomMeanLongSun + sunEqOfCtr;
        const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * julianCentury) * this.RAD);

        // Obliquità dell'eclittica
        const meanObliqEcliptic = 23.0 + (26.0 + ((21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813)))) / 60.0) / 60.0;
        const obliqCorr = meanObliqEcliptic + 0.00256 * Math.cos((125.04 - 1934.136 * julianCentury) * this.RAD);

        // Declinazione solare e Ascensione Retta
        const sinDeclination = Math.sin(obliqCorr * this.RAD) * Math.sin(sunAppLong * this.RAD);
        const declination = Math.asin(sinDeclination);
        
        const cosSunAppLong = Math.cos(sunAppLong * this.RAD);
        const sinSunAppLong = Math.sin(sunAppLong * this.RAD);
        let raRad = Math.atan2(Math.cos(obliqCorr * this.RAD) * sinSunAppLong, cosSunAppLong);
        let raHours = (raRad * this.DEG / 15.0 + 24) % 24;

        // Equazione del tempo
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
        if (hourAngle > 0) {
            azimuth = 360 - azimuth;
        }

        return {
            azimuth: (azimuth + 180) % 360,
            altitude: altitude,
            raHours: raHours,
            decDeg: declination * this.DEG,
            timeString: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    }

    /**
     * Calcola la posizione apparente di Luna e Pianeti (Algoritmi orbitali Meeus / Kepleriani)
     */
    static getPlanetaryEquatorialCoords(planetId, date) {
        const jd = this.getJulianDate(date);
        const d = jd - 2451545.0; // Giorni da J2000.0
        const T = d / 36525.0;
        const rad = this.RAD;
        const deg = this.DEG;

        if (planetId === 'MOON') {
            // Algoritmo di posizionamento lunare di Meeus semplificato ad alta precisione (~0.3°)
            let L0 = 218.3164477 + 481267.88128 * T; // Longitudine media Luna
            let M = 134.9633964 + 477198.867505 * T; // Anomalia media Luna
            let M_sun = 357.5291092 + 35999.0502909 * T; // Anomalia media Sole
            let D = 297.8501921 + 445267.1114034 * T; // Allungamento medio
            let F = 93.2720950 + 483202.0175233 * T; // Argomento di latitudine

            L0 = (L0 % 360 + 360) % 360;
            M = (M % 360 + 360) % 360;
            M_sun = (M_sun % 360 + 360) % 360;
            D = (D % 360 + 360) % 360;
            F = (F % 360 + 360) % 360;

            // Principali perturbazioni periodiche
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

            lEcl = (lEcl % 360 + 360) % 360;

            // Obliquità dell'eclittica
            const eps = 23.439291 - 0.0130042 * T;

            // Trasformazione in RA e Dec
            const sinDec = Math.sin(bEcl * rad) * Math.cos(eps * rad) + Math.cos(bEcl * rad) * Math.sin(eps * rad) * Math.sin(lEcl * rad);
            const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) * deg;

            const y = Math.sin(lEcl * rad) * Math.cos(eps * rad) - Math.tan(bEcl * rad) * Math.sin(eps * rad);
            const x = Math.cos(lEcl * rad);
            let raDeg = Math.atan2(y, x) * deg;
            raDeg = (raDeg % 360 + 360) % 360;

            // Calcolo fase lunare (0 = Nuova, 0.5 = Piena, 1.0 = Nuova)
            const phaseAngle = ((D % 360 + 360) % 360);
            const illumination = (1 - Math.cos(phaseAngle * rad)) / 2;

            return {
                raHours: raDeg / 15.0,
                decDeg: dec,
                illumination: illumination,
                phaseAngleDeg: phaseAngle
            };
        }

        // Elementi orbitali eliocentrici medi per i pianeti maggiori (JPL/Meeus)
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
        if (!p) {
            return { raHours: 0, decDeg: 0 };
        }

        // Terra eliocentrica
        const L_earth = (100.466457 + 0.985647358 * d) % 360;
        const M_earth = (357.5291 + 0.98560028 * d) % 360;
        const e_earth = 0.0167086;
        const v_earth = M_earth + (2 * e_earth - Math.pow(e_earth, 3) / 4) * deg * Math.sin(M_earth * rad) + (5/4) * Math.pow(e_earth, 2) * deg * Math.sin(2 * M_earth * rad);
        const l_earth = (v_earth + 102.9373) % 360;
        const r_earth = (1.000001018 * (1 - Math.pow(e_earth, 2))) / (1 + e_earth * Math.cos(v_earth * rad));
        const Xe = r_earth * Math.cos(l_earth * rad);
        const Ye = r_earth * Math.sin(l_earth * rad);
        const Ze = 0;

        // Pianeta eliocentrico
        const M_planet = (p.L + p.n * d - p.longPeri) % 360;
        let E = M_planet * rad;
        for (let iter = 0; iter < 5; iter++) {
            E = E - (E - p.e * Math.sin(E) - M_planet * rad) / (1 - p.e * Math.cos(E));
        }
        const v_planet = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2)) * deg;
        const r_planet = p.a * (1 - p.e * Math.cos(E));

        // Coordinate eliocentriche 3D
        const u = (v_planet + p.longPeri - p.longNode) * rad;
        const x_orb = r_planet * (Math.cos(p.longNode * rad) * Math.cos(u) - Math.sin(p.longNode * rad) * Math.sin(u) * Math.cos(p.I * rad));
        const y_orb = r_planet * (Math.sin(p.longNode * rad) * Math.cos(u) + Math.cos(p.longNode * rad) * Math.sin(u) * Math.cos(p.I * rad));
        const z_orb = r_planet * Math.sin(u) * Math.sin(p.I * rad);

        // Geocentriche
        const Xg = x_orb - Xe;
        const Yg = y_orb - Ye;
        const Zg = z_orb - Ze;

        // Eclittica -> Equatoriale
        const eps = (23.439291 - 0.0130042 * T) * rad;
        const Xeq = Xg;
        const Yeq = Yg * Math.cos(eps) - Zg * Math.sin(eps);
        const Zeq = Yg * Math.sin(eps) + Zg * Math.cos(eps);

        let raDeg = Math.atan2(Yeq, Xeq) * deg;
        raDeg = (raDeg % 360 + 360) % 360;
        const dist = Math.sqrt(Xeq * Xeq + Yeq * Yeq + Zeq * Zeq);
        const decDeg = Math.asin(Math.max(-1, Math.min(1, Zeq / dist))) * deg;

        return {
            raHours: raDeg / 15.0,
            decDeg: decDeg
        };
    }

    /**
     * Calcola la posizione istantanea (Azimut ed Elevazione) di qualsiasi corpo celeste del catalogo
     */
    static getCelestialObjectPosition(object, date, lat, lon) {
        let raHours = object.raHours;
        let decDeg = object.decDeg;
        let extraInfo = {};

        if (object.isSolarSystem) {
            const planetCoords = this.getPlanetaryEquatorialCoords(object.id, date);
            raHours = planetCoords.raHours;
            decDeg = planetCoords.decDeg;
            if (planetCoords.illumination !== undefined) {
                extraInfo.illumination = planetCoords.illumination;
                extraInfo.phaseAngleDeg = planetCoords.phaseAngleDeg;
            }
        }

        const altAz = this.radecToAltAz(raHours, decDeg, lat, lon, date);

        return {
            azimuth: altAz.azimuth,
            altitude: altAz.altitude,
            hourAngleDeg: altAz.hourAngleDeg,
            raHours: raHours,
            decDeg: decDeg,
            date: date,
            timeString: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ...extraInfo
        };
    }

    /**
     * Genera la traiettoria altazimutale di un corpo celeste per l'intera giornata/notte
     * Campionata ogni 10 minuti per formare una curva continua a 360°
     */
    static generateCelestialPath(object, baseDate, lat, lon, stepMinutes = 10) {
        const points = [];
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();

        // Se l'oggetto è una stella/DSO o un pianeta, calcoliamo i punti lungo le 24 ore
        for (let m = 0; m <= 24 * 60; m += stepMinutes) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const d = new Date(year, month, day, h, min, 0);
            
            const pos = this.getCelestialObjectPosition(object, d, lat, lon);
            
            points.push({
                x: Math.round(pos.azimuth * 10) / 10,
                y: Math.round(pos.altitude * 10) / 10,
                time: pos.timeString,
                rawDate: d,
                rawAlt: pos.altitude,
                rawAz: pos.azimuth
            });
        }

        return points;
    }

    /**
     * Calcola le effemeridi complete per un corpo celeste rispetto all'orizzonte reale e teorico
     */
    static calculateObjectEphemerides(object, baseDate, lat, lon, horizonProfile = null) {
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();

        const now = new Date();
        const currentPos = this.getCelestialObjectPosition(object, now, lat, lon);

        // Campioniamo ogni minuto per trovare con precisione levata, culminazione e tramonto
        let maxAlt = -999;
        let culminationTime = null;
        let culminationAz = 180;
        
        let riseTimeMath = null;
        let riseAzMath = null;
        let setTimeMath = null;
        let setAzMath = null;

        let riseTimeReal = null;
        let riseAzReal = null;
        let setTimeReal = null;
        let setAzReal = null;

        let totalVisibleMinutesReal = 0;
        let totalNightMinutesVisible = 0;

        let prevAltMath = null;
        let prevAltRealDiff = null;

        const numHorizonPoints = horizonProfile ? horizonProfile.length : 360;
        const getHorizonThreshold = (az) => {
            if (!horizonProfile || horizonProfile.length === 0) return 0.0;
            const bin = Math.min(numHorizonPoints - 1, Math.max(0, Math.round((az / 360.0) * numHorizonPoints)));
            return horizonProfile[bin] ? horizonProfile[bin].maxAngle : 0.0;
        };

        for (let m = 0; m <= 24 * 60; m += 2) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const d = new Date(year, month, day, h, min, 0);

            const pos = this.getCelestialObjectPosition(object, d, lat, lon);
            const hThresh = getHorizonThreshold(pos.azimuth);
            const altRealDiff = pos.altitude - hThresh;

            // Culminazione (massima altezza sull'orizzonte)
            if (pos.altitude > maxAlt) {
                maxAlt = pos.altitude;
                culminationTime = pos.timeString;
                culminationAz = pos.azimuth;
            }

            // Levata e Tramonto Matematico (0°)
            if (prevAltMath !== null) {
                if (prevAltMath < 0 && pos.altitude >= 0 && !riseTimeMath) {
                    riseTimeMath = pos.timeString;
                    riseAzMath = pos.azimuth;
                } else if (prevAltMath >= 0 && pos.altitude < 0 && !setTimeMath) {
                    setTimeMath = pos.timeString;
                    setAzMath = pos.azimuth;
                }
            }

            // Levata e Tramonto Reale (sopra i monti)
            if (prevAltRealDiff !== null) {
                if (prevAltRealDiff < 0 && altRealDiff >= 0 && !riseTimeReal) {
                    riseTimeReal = pos.timeString;
                    riseAzReal = pos.azimuth;
                } else if (prevAltRealDiff >= 0 && altRealDiff < 0 && !setTimeReal) {
                    setTimeReal = pos.timeString;
                    setAzReal = pos.azimuth;
                }
            }

            // Conteggio minuti di visibilità reale (sopra la cresta)
            if (altRealDiff >= 0) {
                totalVisibleMinutesReal += 2;

                // Controlla se a quest'ora è notte (Sole sotto -12° crepuscolo nautico)
                const sunPos = this.getSolarPosition(d, lat, lon);
                if (sunPos.altitude <= -12.0) {
                    totalNightMinutesVisible += 2;
                }
            }

            prevAltMath = pos.altitude;
            prevAltRealDiff = altRealDiff;
        }

        // Verifica stato attuale rispetto ai monti
        const currentHorizonAngle = getHorizonThreshold(currentPos.azimuth);
        const isCurrentlyAboveHorizon = currentPos.altitude >= currentHorizonAngle;
        const currentSun = this.getSolarPosition(now, lat, lon);
        const isNightNow = currentSun.altitude <= -6.0;

        let statusText = 'Sotto l\'orizzonte';
        let statusClass = 'status-subhorizon';
        if (currentPos.altitude > 0 && !isCurrentlyAboveHorizon) {
            statusText = 'Nascosto dai rilievi';
            statusClass = 'status-blocked';
        } else if (isCurrentlyAboveHorizon) {
            if (isNightNow) {
                statusText = 'Visibile ORA nel cielo notturno';
                statusClass = 'status-visible-night';
            } else {
                statusText = 'Sopra l\'orizzonte (Cielo diurno)';
                statusClass = 'status-visible-day';
            }
        }

        const formatHours = (mins) => {
            const hh = Math.floor(mins / 60);
            const mm = mins % 60;
            return `${hh}h ${mm}m`;
        };

        return {
            object: object,
            current: {
                altitude: Math.round(currentPos.altitude * 10) / 10,
                azimuth: Math.round(currentPos.azimuth * 10) / 10,
                horizonAngle: Math.round(currentHorizonAngle * 10) / 10,
                isAboveMountains: isCurrentlyAboveHorizon,
                statusText: statusText,
                statusClass: statusClass,
                raHours: currentPos.raHours,
                decDeg: currentPos.decDeg,
                illumination: currentPos.illumination
            },
            culmination: {
                time: culminationTime || '--:--',
                altitude: Math.round(maxAlt * 10) / 10,
                azimuth: Math.round(culminationAz * 10) / 10
            },
            rise: {
                realTime: riseTimeReal || (maxAlt < 0 ? 'Mai (Invisibile)' : 'Sempre sorto (Circumpolare)'),
                realAz: riseAzReal !== null ? `${Math.round(riseAzReal)}°` : '--',
                mathTime: riseTimeMath || '--:--',
                mathAz: riseAzMath !== null ? `${Math.round(riseAzMath)}°` : '--'
            },
            set: {
                realTime: setTimeReal || (maxAlt < 0 ? 'Mai (Invisibile)' : 'Non tramonta (Circumpolare)'),
                realAz: setAzReal !== null ? `${Math.round(setAzReal)}°` : '--',
                mathTime: setTimeMath || '--:--',
                mathAz: setAzMath !== null ? `${Math.round(setAzMath)}°` : '--'
            },
            visibility: {
                totalVisibleStr: formatHours(totalVisibleMinutesReal),
                nightVisibleStr: formatHours(totalNightMinutesVisible),
                totalNightMinutes: totalNightMinutesVisible
            }
        };
    }

    /**
     * Genera la curva solare per l'intera giornata a intervalli di 10 minuti
     */
    static generateDailySolarPath(baseDate, lat, lon) {
        const points = [];
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();

        for (let m = 0; m < 24 * 60; m += 10) {
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

    /**
     * Tracce solari chiave (Oggi, Solstizi ed Equinozi)
     */
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
