/**
 * horizonChart.js - Gestione del grafico interattivo dell'orizzonte astronomico ad alta risoluzione
 * Disegna il profilo skyline con interpolazione morbida continua e traiettorie solari.
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
    }

    /**
     * Inizializza o aggiorna il grafico dell'orizzonte
     */
    updateChart(horizonProfile, lat, lon) {
        this.currentHorizonData = horizonProfile;
        this.observerLat = lat;
        this.observerLon = lon;

        if (!this.canvas) return;

        const ChartClass = window.Chart;
        if (!ChartClass) {
            console.error('Chart.js non trovato.');
            return;
        }

        const numPoints = horizonProfile.length;
        const labels = [];
        const horizonAngles = [];

        for (let i = 0; i < numPoints; i++) {
            const item = horizonProfile[i] || { azimuth: i, maxAngle: 0 };
            labels.push(item.azimuth);
            horizonAngles.push(Math.round(item.maxAngle * 100) / 100);
        }

        // Calcola percorsi solari
        const sunPaths = AstronomyService.getAstronomicalPaths(lat, lon);

        // Prepara dataset skyline con spline monotona
        const datasets = [
            {
                label: 'Orizzonte Topografico (Skyline)',
                data: horizonAngles,
                fill: 'origin',
                backgroundColor: 'rgba(30, 41, 59, 0.75)',
                borderColor: '#10b981',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#10b981',
                cubicInterpolationMode: 'monotone',
                tension: 0.25,
                order: 2
            }
        ];

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
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 1
                },
                {
                    label: 'Solstizio d\'Estate (21 Giu)',
                    data: summerData,
                    borderColor: '#f97316',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 3
                },
                {
                    label: 'Equinozio (20 Mar / 22 Set)',
                    data: equinoxData,
                    borderColor: '#a855f7',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 4
                },
                {
                    label: 'Solstizio d\'Inverno (21 Dic)',
                    data: winterData,
                    borderColor: '#38bdf8',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    spanGaps: true,
                    cubicInterpolationMode: 'monotone',
                    tension: 0.2,
                    order: 5
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

        if (this.chart) {
            this.chart.data.labels = labels;
            this.chart.data.datasets = datasets;
            this.chart.update('none');
            return;
        }

        const ctx = this.canvas.getContext('2d');
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
                            color: '#94a3b8',
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
                                if (info && info.hasObstacle) {
                                    return [
                                        `Quota Vetta: ${info.elevationM} m`,
                                        `Distanza Vetta: ${info.distanceKm} km`,
                                        `Coordinate: ${info.lat.toFixed(4)}, ${info.lon.toFixed(4)}`
                                    ];
                                }
                                return ['Nessun rilievo bloccante entro il raggio'];
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
                        title: {
                            display: true,
                            text: 'Altezza / Elevazione Angolare (°)',
                            color: '#94a3b8',
                            font: { size: 11 }
                        },
                        grid: {
                            color: (ctx) => ctx.tick.value === 0 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(51, 65, 85, 0.25)',
                            lineWidth: (ctx) => ctx.tick.value === 0 ? 1.5 : 1
                        },
                        ticks: {
                            color: '#94a3b8',
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
            this.updateChart(this.currentHorizonData, this.observerLat, this.observerLon);
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
