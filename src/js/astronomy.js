/**
 * astronomy.js - Calcoli astronomici di base (Jean Meeus / NOAA) per le traiettorie solari
 * Permette di calcolare azimut ed elevazione del Sole nel corso della giornata per:
 * - Solstizio d'Estate (~21 Giugno)
 * - Solstizio d'Inverno (~21 Dicembre)
 * - Equinozi (~20 Marzo / 22 Settembre)
 * - Data odierna / personalizzata
 */

export class AstronomyService {
    /**
     * Calcola la posizione solare (Azimut ed Elevazione) per date/ore date a una data latitudine/longitudine
     */
    static getSolarPosition(date, lat, lon) {
        const rad = Math.PI / 180;
        const deg = 180 / Math.PI;

        const julianDate = this.getJulianDate(date);
        const julianCentury = (julianDate - 2451545.0) / 36525.0;

        // Longitudine media del Sole
        let geomMeanLongSun = 280.46646 + julianCentury * (36000.76983 + 0.0003032 * julianCentury);
        geomMeanLongSun = (geomMeanLongSun % 360 + 360) % 360;

        // Anomalia media del Sole
        const geomMeanAnomSun = 357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);

        // Eccentricità orbita terrestre
        const eccentEarthOrbit = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

        // Equazione del centro
        const sunEqOfCtr = Math.sin(geomMeanAnomSun * rad) * (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury))
            + Math.sin(2 * geomMeanAnomSun * rad) * (0.019993 - 0.000101 * julianCentury)
            + Math.sin(3 * geomMeanAnomSun * rad) * 0.000289;

        // Longitudine vera del Sole
        const sunTrueLong = geomMeanLongSun + sunEqOfCtr;

        // Longitudine apparente
        const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * julianCentury) * rad);

        // Obliquità media dell'eclittica
        const meanObliqEcliptic = 23.0 + (26.0 + ((21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813)))) / 60.0) / 60.0;
        const obliqCorr = meanObliqEcliptic + 0.00256 * Math.cos((125.04 - 1934.136 * julianCentury) * rad);

        // Declinazione solare
        const sinDeclination = Math.sin(obliqCorr * rad) * Math.sin(sunAppLong * rad);
        const declination = Math.asin(sinDeclination);

        // Equazione del tempo (minuti)
        const y = Math.tan(obliqCorr * rad / 2.0) * Math.tan(obliqCorr * rad / 2.0);
        const eqOfTime = 4.0 * deg * (
            y * Math.sin(2 * geomMeanLongSun * rad)
            - 2.0 * eccentEarthOrbit * Math.sin(geomMeanAnomSun * rad)
            + 4.0 * eccentEarthOrbit * y * Math.sin(geomMeanAnomSun * rad) * Math.cos(2 * geomMeanLongSun * rad)
            - 0.5 * y * y * Math.sin(4 * geomMeanLongSun * rad)
            - 1.25 * eccentEarthOrbit * eccentEarthOrbit * Math.sin(2 * geomMeanAnomSun * rad)
        );

        // Ora solare vera (True Solar Time) in minuti
        const timeZoneOffset = -date.getTimezoneOffset(); // in minuti
        const localTimeMinutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
        const trueSolarTime = (localTimeMinutes + eqOfTime + 4.0 * lon - timeZoneOffset * 60) % 1440;

        // Angolo orario solare
        let hourAngle = (trueSolarTime / 4.0) - 180.0;
        if (hourAngle < -180.0) hourAngle += 360.0;

        // Calcolo altezza solare (elevazione)
        const latRad = lat * rad;
        const sinAltitude = Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle * rad);
        const altitude = Math.asin(sinAltitude) * deg;

        // Calcolo azimut solare (0° Nord, 90° Est, 180° Sud, 270° Ovest)
        const cosAzimuth = (Math.sin(declination) - Math.sin(latRad) * sinAltitude) / (Math.cos(latRad) * Math.cos(altitude * rad));
        let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * deg;

        if (hourAngle > 0) {
            azimuth = 360 - azimuth;
        }

        return {
            azimuth: (azimuth + 180) % 360, // Normalizza a 0° Nord
            altitude: altitude,
            declinationDeg: declination * deg,
            timeString: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    }

    static getJulianDate(date) {
        return (date.getTime() / 86400000.0) + 2440587.5;
    }

    /**
     * Genera la curva solare per l'intera giornata (dall'alba al tramonto) a intervalli di 10 minuti
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

            // Includiamo posizioni con elevazione >= -6° (crepuscolo civile)
            if (pos.altitude >= -6.0) {
                points.push({
                    x: Math.round(pos.azimuth * 10) / 10,
                    y: Math.round(pos.altitude * 10) / 10,
                    time: pos.timeString
                });
            }
        }

        // Ordina i punti per azimut crescente per il grafico
        return points.sort((a, b) => a.x - b.x);
    }

    /**
     * Restituisce le tracce astronomiche chiave per una data latitudine/longitudine
     */
    static getAstronomicalPaths(lat, lon, customDate = new Date()) {
        const year = customDate.getFullYear();
        
        // Date astronomiche
        const summerSolstice = new Date(year, 5, 21, 12, 0, 0); // ~21 Giugno
        const winterSolstice = new Date(year, 11, 21, 12, 0, 0); // ~21 Dicembre
        const equinox = new Date(year, 2, 20, 12, 0, 0); // ~20 Marzo

        return {
            today: this.generateDailySolarPath(customDate, lat, lon),
            summerSolstice: this.generateDailySolarPath(summerSolstice, lat, lon),
            winterSolstice: this.generateDailySolarPath(winterSolstice, lat, lon),
            equinox: this.generateDailySolarPath(equinox, lat, lon)
        };
    }
}
