/**
 * horizonChart.js - Gestione del grafico interattivo dell'orizzonte astronomico a 360°
 * Utilizza Chart.js per disegnare il profilo altimetrico montano e le traiettorie solari.
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

        // Se Chart.js è disponibile globalmente o tramite bundle
        const ChartClass = window.Chart;
        if (!ChartClass) {
            console.error('Chart.js non trovato.');
            return;
        }

        // Estrai dati orizzonte (0° a 360°)
        const labels = [];
        const horizonAngles = [];
        for (let az = 0; az < 360; az++) {
            labels.push(az);
            const item = horizonProfile[az] || { maxAngle: 0 };
            horizonAngles.push(Math.round(item.maxAngle * 100) / 100);
        }

        // Calcola percorsi solari
        const sunPaths = AstronomyService.getAstronomicalPaths(lat, lon);

        // Prepara dataset solari
        const datasets = [
            {
                label: 'Orizzonte Topografico (Skyline)',
                data: horizonAngles,
                fill: 'origin',
                backgroundColor: 'rgba(30, 41, 59, 0.75)',
                borderColor: '#10b981',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#10b981',
                tension: 0.1,
                order: 2
            }
        ];

        if (this.showSunPaths) {
            // Mappa punti solari sui 360 gradi
            const summerData = new Array(360).fill(null);
            sunPaths.summerSolstice.forEach(p => {
                const az = Math.round(p.x) % 360;
                summerData[az] = p.y;
            });

            const winterData = new Array(360).fill(null);
            sunPaths.winterSolstice.forEach(p => {
                const az = Math.round(p.x) % 360;
                winterData[az] = p.y;
            });

            const equinoxData = new Array(360).fill(null);
            sunPaths.equinox.forEach(p => {
                const az = Math.round(p.x) % 360;
                equinoxData[az] = p.y;
            });

            const todayData = new Array(360).fill(null);
            sunPaths.today.forEach(p => {
                const az = Math.round(p.x) % 360;
                todayData[az] = p.y;
            });

            datasets.push(
                {
                    label: 'Sole Oggi',
                    data: todayData,
                    borderColor: '#fbbf24', // Oro
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    spanGaps: true,
                    order: 1
                },
                {
                    label: 'Solstizio d\'Estate (21 Giu)',
                    data: summerData,
                    borderColor: '#f97316', // Arancione
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    spanGaps: true,
                    order: 3
                },
                {
                    label: 'Equinozio (20 Mar / 22 Set)',
                    data: equinoxData,
                    borderColor: '#a855f7', // Viola
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    spanGaps: true,
                    order: 4
                },
                {
                    label: 'Solstizio d\'Inverno (21 Dic)',
                    data: winterData,
                    borderColor: '#38bdf8', // Celeste
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    spanGaps: true,
                    order: 5
                }
            );
        }

        const cardinalDirections = {
            0: 'Nord (0°)',
            45: 'NE (45°)',
            90: 'Est (90°)',
            135: 'SE (135°)',
            180: 'Sud (180°)',
            225: 'SO (225°)',
            270: 'Ovest (270°)',
            315: 'NO (315°)',
            359: 'Nord (360°)'
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
                                const az = items[0].dataIndex;
                                const cardinal = cardinalDirections[az] || `${az}°`;
                                return `Azimut: ${cardinal}`;
                            },
                            afterBody: (items) => {
                                const az = items[0].dataIndex;
                                const info = this.currentHorizonData ? this.currentHorizonData[az] : null;
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
                            color: (ctx) => [0, 45, 90, 135, 180, 225, 270, 315].includes(ctx.tick.value) ? 'rgba(148, 163, 184, 0.3)' : 'rgba(51, 65, 85, 0.15)',
                            lineWidth: (ctx) => [0, 90, 180, 270].includes(ctx.tick.value) ? 1.5 : 0.8
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: (value) => cardinalDirections[value] || (value % 45 === 0 ? `${value}°` : '')
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
                        const az = elements[0].index;
                        const info = this.currentHorizonData ? this.currentHorizonData[az] : null;
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
