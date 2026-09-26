/**
 * exportUtils.js - Utilità di esportazione dati orizzonte in CSV, JSON e GeoJSON
 */

export class ExportUtils {
    static exportToCSV(horizonProfile, observer) {
        let csv = 'Azimuth_deg,ElevationAngle_deg,Obstacle_Elevation_m,Obstacle_Distance_km,Obstacle_Lat,Obstacle_Lon\n';
        horizonProfile.forEach((item, idx) => {
            csv += `${idx},${item.maxAngle.toFixed(3)},${item.elevationM},${item.distanceKm},${item.lat ? item.lat.toFixed(5) : ''},${item.lon ? item.lon.toFixed(5) : ''}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orizzonte_lat${observer.lat.toFixed(4)}_lon${observer.lon.toFixed(4)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    static exportToJSON(horizonProfile, observer, stats) {
        const data = {
            metadata: {
                appName: 'Astronomical Horizon & Viewshed Analyzer',
                generatedAt: new Date().toISOString(),
                observer: {
                    latitude: observer.lat,
                    longitude: observer.lon,
                    terrainElevationM: stats.obsTerrainElev,
                    observerHeightM: observer.height,
                    totalElevationM: stats.obsTotalElev
                },
                parameters: {
                    analysisRadiusKm: stats.radiusKm,
                    visibleAreaPercent: stats.visiblePercent,
                    minElevationM: stats.minTerrainElev,
                    maxElevationM: stats.maxTerrainElev,
                    minAngleDeg: stats.minAngleSeen,
                    maxAngleDeg: stats.maxAngleSeen
                }
            },
            horizon360: horizonProfile
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orizzonte_astronomico_${observer.lat.toFixed(4)}_${observer.lon.toFixed(4)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
