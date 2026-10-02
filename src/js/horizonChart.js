/**
 * horizonChart.js - Gestione del grafico interattivo dell'orizzonte astronomico ad alta risoluzione
 * Supporta:
 * - Profilo altimetrico 360° con magnificazione verticale (1x - 5x)
 * - Colorazione coordinata con la raggiera (Rosso > 20°, Verde < 15°)
 * - Tracciamento altazimutale di corpi celesti (Pianeti, Luna, Nebulose come Helix, Messier, Stelle)
 * - Calcolo in tempo reale di visibilità reale (sopra o sotto le creste montuose)
 * - Linee guida di soglia a 15° e 20° e tracce solari stagionali
 */

import { AstronomyService } from './astronomy.js';

export class HorizonChartManager {
    constructor(canvasId, onPointHover = null) {
        this.canvas = document.getElementById(canvasId);
        this.onPointHover = onPointHover;
        this.chart = null;
        this.currentHorizonData = null;
        this.observerLat = 0;
        this.observerLon = 0;
        this.showSunPaths = true;
        this.verticalMagnification = 2.0;
        this.trackedCelestialObjects = [];
        this.currentDate = new Date();
    }

    /**
     * Imposta il fattore di magnificazione verticale e aggiorna il grafico
     */
    setMagnification(factor) {
        this.verticalMagnification = Math.max(1.0, Math.min(5.0, factor));
        if (this.currentHorizonData) {
            this.updateChart(this.currentHorizonData, this.observerLat, this.observerLon, this.currentDate);
        }
    }

    /**
     * Imposta la lista di corpi celesti tracciati nel grafico
     */
    setTrackedCelestialObjects(objectsList, date = null) {
        this.trackedCelestialObjects = objectsList || [];
        if (date) this.currentDate = date;
        if (this.currentHorizonData) {
            this.updateChart(this.currentHorizonData, this.observerLat, this.observerLon, this.currentDate);
        }
    }

    /**
     * Imposta la data per i calcoli astronomici ed effemeridi
     */
    setDate(date) {
        this.currentDate = date || new Date();
        if (this.currentHorizonData) {
            this.updateChart(this.currentHorizonData, this.observerLat, this.observerLon, this.currentDate);
        }
    }

    /**
     * Inizializza o aggiorna il grafico dell'orizzonte
     */
    updateChart(horizonProfile, lat, lon, date = null) {
        this.currentHorizonData = horizonProfile;
        this.observerLat = lat;
        this.observerLon = lon;
        if (date) this.currentDate = date;

        if (!this.canvas) return;

        const ChartClass = window.Chart;
        if (!ChartClass) {
            console.error('Chart.js non trovato.');
            return;
        }

        const numPoints = horizonProfile.length;
        const labels = [];
        const horizonAngles = [];
        let minAngle = 999;
        let maxAngle = -999;

        for (let i = 0; i < numPoints; i++) {
            const item = horizonProfile[i] || { azimuth: i, maxAngle: 0 };
            labels.push(item.azimuth);
            const ang = Math.round(item.maxAngle * 100) / 100;
            horizonAngles.push(ang);

            if (ang < minAngle) minAngle = ang;
            if (ang > maxAngle) maxAngle = ang;
        }

        // Calcola percorsi solari
        const sunPaths = AstronomyService.getAstronomicalPaths(lat, lon, this.currentDate);

        // Genera gradiente dinamico per lo skyline (Rosso se > 20°, Verde se < 15°)
        const ctx = this.canvas.getContext('2d');
        const chartHeight = this.canvas.clientHeight || 280;
        const skylineGradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
        skylineGradient.addColorStop(0, 'rgba(239, 68, 68, 0.85)'); // Rosso in cima (> 20°)
        skylineGradient.addColorStop(0.35, 'rgba(245, 158, 11, 0.7)'); // Giallo-Arancio (15°-20°)
        skylineGradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.65)'); // Verde (< 15°)
        skylineGradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)'); // Base scura

        // Prepara dataset skyline con spline monotona
        const datasets = [
            {
                label: 'Orizzonte Topografico (Skyline)',
                data: horizonAngles,
                fill: 'origin',
                backgroundColor: skylineGradient,
                borderColor: '#10b981',
                borderWidth: 2.2,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#f8fafc',
                pointHoverBorderColor: '#38bdf8',
                pointHoverBorderWidth: 2,
                cubicInterpolationMode: 'monotone',
                tension: 0.25,
                order: 20
            }
        ];

        // Linee di soglia di riferimento (20° Rosso e 15° Verde)
        const threshold20Data = new Array(numPoints).fill(20.0);
        const threshold15Data = new Array(numPoints).fill(15.0);

        datasets.push(
            {
                label: 'Soglia 20° (Rilievo Alto - Rosso)',
                data: threshold20Data,
                borderColor: 'rgba(239, 68, 68, 0.65)',
                borderWidth: 1.2,
                borderDash: [5, 4],
                pointRadius: 0,
                fill: false,
                order: 30
            },
            {
                label: 'Soglia 15° (Rilievo Basso - Verde)',
                data: threshold15Data,
                borderColor: 'rgba(16, 185, 129, 0.65)',
                borderWidth: 1.2,
                borderDash: [5, 4],
                pointRadius: 0,
                fill: false,
                order: 31
            }
        );

        // ==========================================
        // --- TRAIETTORIE CORPI CELESTI SELEZIONATI ---
        // ==========================================
        if (this.trackedCelestialObjects && this.trackedCelestialObjects.length > 0) {
            this.trackedCelestialObjects.forEach((celestialObj, objIndex) => {
                const celestialPathPoints = AstronomyService.generateCelestialPath(celestialObj, this.currentDate, lat, lon, 12);
                const celestialData = new Array(numPoints).fill(null);
                const timeMap = new Array(numPoints).fill('');

                celestialPathPoints.forEach(p => {
                    // Filtra punti molto sotto l'orizzonte (sotto -10°) per non sporcare la scala
                    if (p.y >= -10.0) {
                        const bin = Math.min(numPoints - 1, Math.max(0, Math.round((p.x / 360.0) * numPoints)));
                        celestialData[bin] = p.y;
                        timeMap[bin] = p.time;
                    }
                });

                const objColor = celestialObj.color || '#ec4899';

                datasets.push({
                    label: `${celestialObj.name}`,
                    data: celestialData,
                    borderColor: objColor,
                    backgroundColor: objColor,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#ffffff',
                    pointHoverBorderColor: objColor,
                    pointHoverBorderWidth: 3,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.25,
                    order: 5 + objIndex,
                    customTimes: timeMap,
                    isCelestial: true,
                    celestialMeta: celestialObj
                });
            });
        }

        // ==========================================
        // --- TRAIETTORIE SOLARI ---
        // ==========================================
        if (this.showSunPaths) {
            const summerData = new Array(numPoints).fill(null);
            const winterData = new Array(numPoints).fill(null);
            const equinoxData = new Array(numPoints).fill(null);
            const todayData = new Array(numPoints).fill(null);

            const mapSolarPath = (points, targetArr) => {
                points.forEach(p => {
                    const bin = Math.min(numPoints - 1, Math.max(0, Math.round((p.x / 360.0) * numPoints)));
                    targetArr[bin] = p.y;
                });
            };

            mapSolarPath(sunPaths.summerSolstice, summerData);
            mapSolarPath(sunPaths.winterSolstice, winterData);
            mapSolarPath(sunPaths.equinox, equinoxData);
            mapSolarPath(sunPaths.today, todayData);

            datasets.push(
                {
                    label: 'Sole Oggi',
                    data: todayData,
                    borderColor: '#fbbf24',
                    borderWidth: 2.0,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 10
                },
                {
                    label: 'Solstizio Estate (21 Giu)',
                    data: summerData,
                    borderColor: '#f97316',
                    borderWidth: 1.4,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 12
                },
                {
                    label: 'Equinozio (20 Mar / 22 Set)',
                    data: equinoxData,
                    borderColor: '#a855f7',
                    borderWidth: 1.4,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 13
                },
                {
                    label: 'Solstizio Inverno (21 Dic)',
                    data: winterData,
                    borderColor: '#38bdf8',
                    borderWidth: 1.4,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 14
                }
            );
        }

        const getCardinalLabel = (azimuth) => {
            const az = Math.round(azimuth);
            if (az === 0 || az === 360) return 'Nord (0°)';
            if (az === 45) return 'NE (45°)';
            if (az === 90) return 'Est (90°)';
            if (az === 135) return 'SE (135°)';
            if (az === 180) return 'Sud (180°)';
            if (az === 225) return 'SO (225°)';
            if (az === 270) return 'Ovest (270°)';
            if (az === 315) return 'NO (315°)';
            return null;
        };

        // Calcolo scala asse Y con magnificazione verticale
        const range = Math.max(8.0, (maxAngle - minAngle));
        const effectiveRange = range / this.verticalMagnification;
        const midPoint = (maxAngle + minAngle) / 2;
        const yMin = Math.floor(Math.min(-5.0, midPoint - effectiveRange * 0.55));
        const yMax = Math.ceil(Math.max(25.0, midPoint + effectiveRange * 0.75));

        if (this.chart) {
            this.chart.data.labels = labels;
            this.chart.data.datasets = datasets;
            this.chart.options.scales.y.min = yMin;
            this.chart.options.scales.y.max = yMax;
            this.chart.update('none');
            return;
        }

        this.chart = new ChartClass(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#cbd5e1',
                            boxWidth: 14,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#38bdf8',
                        bodyColor: '#f1f5f9',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                const az = labels[idx];
                                const cardinal = getCardinalLabel(az) || `${az}°`;
                                return `Azimut: ${cardinal}`;
                            },
                            afterBody: (items) => {
                                const idx = items[0].dataIndex;
                                const info = this.currentHorizonData ? this.currentHorizonData[idx] : null;
                                const bodyLines = [];

                                // Informazioni sui corpi celesti presenti su questo azimut
                                items.forEach(item => {
                                    const ds = this.chart.data.datasets[item.datasetIndex];
                                    if (ds && ds.isCelestial && ds.customTimes && ds.customTimes[idx]) {
                                        const altVal = item.parsed.y;
                                        const hAng = info ? info.maxAngle : 0;
                                        const isAbove = altVal >= hAng;
                                        const statusEmoji = isAbove ? '🟢 Visibile sopra le vette' : '🔴 Nascosto dal rilievo';
                                        bodyLines.push(`✨ ${ds.label}: Transito ore ${ds.customTimes[idx]} (${statusEmoji})`);
                                    }
                                });

                                if (info && info.hasObstacle) {
                                    const category = info.maxAngle >= 20 ? '🔴 Rilievo Alto (> 20°)' : (info.maxAngle >= 15 ? '🟠 Rilievo Medio (15°-20°)' : '🟢 Rilievo Basso (< 15°)');
                                    bodyLines.push(
                                        `Orizzonte: ${category}`,
                                        `Quota Vetta: ${info.elevationM} m (Distanza: ${info.distanceKm} km)`
                                    );
                                }
                                return bodyLines;
                            },
                            label: (context) => {
                                const val = context.parsed.y;
                                if (val === null || isNaN(val)) return null;
                                return `${context.dataset.label}: ${val.toFixed(2)}°`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: (ctx) => {
                                const az = labels[ctx.tick.value];
                                if (!az) return 'transparent';
                                const roundAz = Math.round(az);
                                return [0, 45, 90, 135, 180, 225, 270, 315].includes(roundAz)
                                    ? 'rgba(148, 163, 184, 0.3)'
                                    : 'rgba(51, 65, 85, 0.15)';
                            },
                            lineWidth: (ctx) => {
                                const az = labels[ctx.tick.value];
                                if (!az) return 1;
                                const roundAz = Math.round(az);
                                return [0, 90, 180, 270].includes(roundAz) ? 1.5 : 0.8;
                            }
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: (valueIndex) => {
                                const az = labels[valueIndex];
                                if (az === undefined) return '';
                                const cardinal = getCardinalLabel(az);
                                if (cardinal) return cardinal;
                                if (Math.round(az) % 45 === 0) return `${Math.round(az)}°`;
                                return '';
                            }
                        }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        title: {
                            display: true,
                            text: `Elevazione Angolare (Scala ${this.verticalMagnification.toFixed(1)}x)`,
                            color: '#94a3b8',
                            font: { size: 11 }
                        },
                        grid: {
                            color: (ctx) => {
                                if (ctx.tick.value === 20) return 'rgba(239, 68, 68, 0.45)';
                                if (ctx.tick.value === 15) return 'rgba(16, 185, 129, 0.45)';
                                if (ctx.tick.value === 0) return 'rgba(56, 189, 248, 0.5)';
                                return 'rgba(51, 65, 85, 0.25)';
                            },
                            lineWidth: (ctx) => (ctx.tick.value === 0 || ctx.tick.value === 15 || ctx.tick.value === 20) ? 1.5 : 1
                        },
                        ticks: {
                            color: (ctx) => {
                                if (ctx.tick.value >= 20) return '#ef4444';
                                if (ctx.tick.value >= 15) return '#f59e0b';
                                return '#10b981';
                            },
                            callback: (v) => `${v}°`
                        }
                    }
                },
                onHover: (event, elements) => {
                    if (this.onPointHover && elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const az = labels[idx];
                        const info = this.currentHorizonData ? this.currentHorizonData[idx] : null;
                        this.onPointHover(az, info);
                    }
                }
            }
        });
    }

    toggleSunPaths(visible) {
        this.showSunPaths = visible;
        if (this.currentHorizonData) {
            this.updateChart(this.currentHorizonData, this.observerLat, this.observerLon, this.currentDate);
        }
    }

    exportChartImage() {
        if (!this.canvas) return;
        const link = document.createElement('a');
        link.download = `orizzonte_astronomico_${this.observerLat.toFixed(3)}_${this.observerLon.toFixed(3)}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
}
