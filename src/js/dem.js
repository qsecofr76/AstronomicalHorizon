/**
 * dem.js - Modulo per il recupero e decodifica dei raster altimetrici (DEM)
 * Utilizza i tile Terrarium di AWS Open Data Terrain (o fallback Open-Meteo).
 * Formato Terrarium: Quota in metri = (R * 256 + G + B / 256) - 32768
 * Con interpolazione bilineare ad alta precisione sub-pixel.
 */

export class DEMProvider {
    constructor() {
        this.tileCache = new Map();
        this.baseUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
    }

    /**
     * Converte Longitudine a X del tile per un dato zoom
     */
    lon2tile(lon, zoom) {
        return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    }

    /**
     * Converte Latitudine a Y del tile per un dato zoom
     */
    lat2tile(lat, zoom) {
        const latRad = lat * Math.PI / 180;
        return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
    }

    /**
     * Converte X del tile a Longitudine dell'angolo Nord-Ovest
     */
    tile2lon(x, zoom) {
        return (x / Math.pow(2, zoom)) * 360 - 180;
    }

    /**
     * Converte Y del tile a Latitudine dell'angolo Nord-Ovest
     */
    tile2lat(y, zoom) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    /**
     * Decodifica un singolo pixel RGB Terrarium in quota (metri)
     */
    decodeTerrariumPixel(r, g, b) {
        return (r * 256.0 + g + b / 256.0) - 32768.0;
    }

    /**
     * Scarica e memorizza un tile Terrarium
     */
    async fetchTile(z, x, y) {
        const key = `${z}/${x}/${y}`;
        if (this.tileCache.has(key)) {
            return this.tileCache.get(key);
        }

        const url = this.baseUrl
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y);

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                
                const tileData = {
                    z, x, y,
                    width: img.width,
                    height: img.height,
                    data: imgData.data,
                    bounds: {
                        west: this.tile2lon(x, z),
                        east: this.tile2lon(x + 1, z),
                        north: this.tile2lat(y, z),
                        south: this.tile2lat(y + 1, z)
                    }
                };
                this.tileCache.set(key, tileData);
                resolve(tileData);
            };
            img.onerror = () => {
                console.warn(`Impossibile caricare tile Terrarium ${key}, fallback quota 0.`);
                resolve(null);
            };
            img.src = url;
        });
    }

    /**
     * Calcola la quota con interpolazione bilineare sub-pixel all'interno di un tile
     */
    getBilinearElevation(tile, rawX, rawY) {
        const w = tile.width;
        const h = tile.height;
        const x = Math.max(0, Math.min(w - 1.001, rawX));
        const y = Math.max(0, Math.min(h - 1.001, rawY));

        const x0 = Math.floor(x);
        const x1 = Math.min(w - 1, x0 + 1);
        const y0 = Math.floor(y);
        const y1 = Math.min(h - 1, y0 + 1);

        const fx = x - x0;
        const fy = y - y0;

        const idx00 = (y0 * w + x0) * 4;
        const idx10 = (y0 * w + x1) * 4;
        const idx01 = (y1 * w + x0) * 4;
        const idx11 = (y1 * w + x1) * 4;

        const h00 = this.decodeTerrariumPixel(tile.data[idx00], tile.data[idx00 + 1], tile.data[idx00 + 2]);
        const h10 = this.decodeTerrariumPixel(tile.data[idx10], tile.data[idx10 + 1], tile.data[idx10 + 2]);
        const h01 = this.decodeTerrariumPixel(tile.data[idx01], tile.data[idx01 + 1], tile.data[idx01 + 2]);
        const h11 = this.decodeTerrariumPixel(tile.data[idx11], tile.data[idx11 + 1], tile.data[idx11 + 2]);

        const hTop = h00 * (1.0 - fx) + h10 * fx;
        const hBottom = h01 * (1.0 - fx) + h11 * fx;
        return hTop * (1.0 - fy) + hBottom * fy;
    }

    /**
     * Calcola la quota di un punto specifico (lat, lon) con interpolazione bilineare
     */
    async getPointElevation(lat, lon, zoom = 12) {
        const x = this.lon2tile(lon, zoom);
        const y = this.lat2tile(lat, zoom);
        const tile = await this.fetchTile(zoom, x, y);
        if (!tile) {
            return await this.fetchOpenMeteoElevation(lat, lon);
        }

        const normX = ((lon - tile.bounds.west) / (tile.bounds.east - tile.bounds.west)) * tile.width;
        const latRad = lat * Math.PI / 180;
        const mercatorY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom);
        const normY = (mercatorY - y) * tile.height;

        const elev = this.getBilinearElevation(tile, normX, normY);
        return Math.round(elev * 10) / 10;
    }

    /**
     * Fallback API Open-Meteo se il tile Terrarium non è disponibile
     */
    async fetchOpenMeteoElevation(lat, lon) {
        try {
            const resp = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
            const data = await resp.json();
            if (data && data.elevation && data.elevation.length > 0) {
                return data.elevation[0];
            }
        } catch (e) {
            console.error('Fallback Open-Meteo fallito:', e);
        }
        return 0;
    }

    /**
     * Costruisce una griglia di campionamento altimetrico ad alta risoluzione con interpolazione bilineare
     */
    async getElevationGrid(centerLat, centerLon, radiusKm, gridSize = 420) {
        // Seleziona il livello di zoom ottimale in base al raggio
        let zoom = 12;
        if (radiusKm <= 8) zoom = 13;
        else if (radiusKm <= 25) zoom = 12;
        else if (radiusKm <= 60) zoom = 11;
        else zoom = 10;

        // Calcola bounding box in gradi (circa 111.32 km per grado di latitudine)
        const dLat = (radiusKm / 111.32);
        const dLon = (radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180)));

        const minLat = centerLat - dLat;
        const maxLat = centerLat + dLat;
        const minLon = centerLon - dLon;
        const maxLon = centerLon + dLon;

        const minTileX = this.lon2tile(minLon, zoom);
        const maxTileX = this.lon2tile(maxLon, zoom);
        const minTileY = this.lat2tile(maxLat, zoom); // Y0 is North
        const maxTileY = this.lat2tile(minLat, zoom); // Y1 is South

        // Scarica tutti i tile necessari in parallelo
        const tilePromises = [];
        for (let tx = minTileX; tx <= maxTileX; tx++) {
            for (let ty = minTileY; ty <= maxTileY; ty++) {
                tilePromises.push(this.fetchTile(zoom, tx, ty));
            }
        }
        const tiles = await Promise.all(tilePromises);
        const validTiles = tiles.filter(t => t !== null);

        // Costruisci matrice di altitudine (gridSize x gridSize)
        const elevations = new Float32Array(gridSize * gridSize);
        const latStep = (maxLat - minLat) / (gridSize - 1);
        const lonStep = (maxLon - minLon) / (gridSize - 1);

        for (let row = 0; row < gridSize; row++) {
            const currentLat = maxLat - row * latStep;
            const latRad = currentLat * Math.PI / 180;
            const mercatorY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom);
            const ty = Math.floor(mercatorY);

            for (let col = 0; col < gridSize; col++) {
                const currentLon = minLon + col * lonStep;
                const mercatorX = (currentLon + 180) / 360 * Math.pow(2, zoom);
                const tx = Math.floor(mercatorX);

                const tile = validTiles.find(t => t.x === tx && t.y === ty && t.z === zoom);
                let elev = 0;

                if (tile) {
                    const localX = (mercatorX - tx) * tile.width;
                    const localY = (mercatorY - ty) * tile.height;
                    elev = this.getBilinearElevation(tile, localX, localY);
                }

                elevations[row * gridSize + col] = elev;
            }
        }

        return {
            centerLat,
            centerLon,
            radiusKm,
            minLat,
            maxLat,
            minLon,
            maxLon,
            gridSize,
            zoom,
            elevations
        };
    }
}
