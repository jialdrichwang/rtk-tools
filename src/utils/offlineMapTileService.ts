/**
 * Offline Map Tile Cache Service using IndexedDB
 * Allows downloading and caching tiles for a designated bounding box / radius and zoom levels.
 * Automatically intercepts TileLayer requests to serve from IndexedDB cache first.
 */

const DB_NAME = 'RTK_Survey_OfflineMapTiles';
const STORE_NAME = 'tile_blobs';
const META_STORE = 'cache_metadata';
const DB_VERSION = 1;

export interface CacheRegionMeta {
  id: string;
  name: string;
  layerId: string;
  layerName: string;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  sizeBytes: number;
  createdAt: number;
}

class OfflineMapTileService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported in this environment'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'tileKey' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        resolve((e.target as IDBOpenDBRequest).result);
      };

      request.onerror = (e) => {
        reject((e.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Generate a unique storage key for a tile
   */
  public getTileKey(layerId: string, z: number, x: number, y: number): string {
    return `${layerId}_${z}_${x}_${y}`;
  }

  /**
   * Get cached tile Blob URL if exists in IndexedDB
   */
  public async getCachedTileUrl(tileKey: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(tileKey);

        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            const objectUrl = URL.createObjectURL(req.result.blob);
            resolve(objectUrl);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => {
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Store a downloaded tile blob into IndexedDB
   */
  public async saveTileBlob(tileKey: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        tileKey,
        blob,
        updatedAt: Date.now(),
      });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Calculate tiles needed for a given center coordinate, radius (km), and zoom range
   */
  public calculateTilesForRadius(
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    minZoom: number,
    maxZoom: number
  ): { z: number; x: number; y: number }[] {
    const tiles: { z: number; x: number; y: number }[] = [];

    // Approx degrees for radius
    const latDelta = radiusKm / 111.0;
    const lonDelta = radiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180));

    const minLat = Math.max(-85.0511, centerLat - latDelta);
    const maxLat = Math.min(85.0511, centerLat + latDelta);
    const minLon = Math.max(-180, centerLon - lonDelta);
    const maxLon = Math.min(180, centerLon + lonDelta);

    for (let z = minZoom; z <= maxZoom; z++) {
      const minX = Math.floor(((minLon + 180) / 360) * Math.pow(2, z));
      const maxX = Math.floor(((maxLon + 180) / 360) * Math.pow(2, z));
      const minY = Math.floor(
        ((1 - Math.log(Math.tan((maxLat * Math.PI) / 180) + 1 / Math.cos((maxLat * Math.PI) / 180)) / Math.PI) / 2) *
          Math.pow(2, z)
      );
      const maxY = Math.floor(
        ((1 - Math.log(Math.tan((minLat * Math.PI) / 180) + 1 / Math.cos((minLat * Math.PI) / 180)) / Math.PI) / 2) *
          Math.pow(2, z)
      );

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ z, x, y });
        }
      }
    }

    return tiles;
  }

  /**
   * Save a completed region metadata
   */
  public async saveRegionMeta(meta: CacheRegionMeta): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const req = store.put(meta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all saved cache regions
   */
  public async getAllRegions(): Promise<CacheRegionMeta[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(META_STORE, 'readonly');
        const store = tx.objectStore(META_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Delete a region or clear all caches
   */
  public async deleteRegion(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Clear entire offline tile store
   */
  public async clearAllCache(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(META_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineMapTileService = new OfflineMapTileService();
