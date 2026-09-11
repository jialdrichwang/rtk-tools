/**
 * Offline Map Tile Cache Service using IndexedDB
 * Allows downloading and caching tiles for a designated bounding box / radius and zoom levels.
 * Automatically intercepts TileLayer requests to serve from IndexedDB cache first.
 */

import { fileStorageService } from './fileStorageService';

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
  scopeType?: 'radius' | 'world' | 'preset' | 'custom_file';
  minLat?: number;
  minLon?: number;
  maxLat?: number;
  maxLon?: number;
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
   * [USER REQ 3 & 8] Prioritize calling map data from com.rtkproject.files/mapdata/ and mapdata/mapcache/
   * 1. Checks IndexedDB tile blobs cache for (layerId_z_x_y or z_x_y).
   * 2. Checks filesystem storage under com.rtkproject.files/mapdata/mapcache/ and mapdata/
   * 3. Returns ObjectURL/DataURL if found locally; returns null if not found.
   */
  public async getMapDataTileUrl(
    layerId: string,
    z: number,
    x: number,
    y: number
  ): Promise<string | null> {
    const primaryKey = this.getTileKey(layerId, z, x, y);
    // 1. Check IndexedDB primary key
    const idbUrl = await this.getCachedTileUrl(primaryKey);
    if (idbUrl) return idbUrl;

    // 2. Check IndexedDB fallback generic key
    const genericKey = `${z}_${x}_${y}`;
    const genericIdbUrl = await this.getCachedTileUrl(genericKey);
    if (genericIdbUrl) return genericIdbUrl;

    // 3. Check com.rtkproject.files/mapdata/ and mapcache/ file storage
    const candidateFiles = [
      `mapcache/${layerId}_${z}_${x}_${y}.png`,
      `mapcache/${layerId}_${z}_${x}_${y}.jpg`,
      `mapcache/${layerId}_${z}_${x}_${y}.bin`,
      `${layerId}_${z}_${x}_${y}.png`,
      `${layerId}_${z}_${x}_${y}.jpg`,
      `${z}_${x}_${y}.png`,
      `${z}_${x}_${y}.jpg`,
      `${layerId}_${z}_${x}_${y}.webp`,
    ];

    for (const filename of candidateFiles) {
      try {
        const content = await fileStorageService.readFile('mapdata', filename);
        if (content) {
          // If it's a data URL or base64 image
          if (content.startsWith('data:image/')) {
            return content;
          }
          if (content.startsWith('http://') || content.startsWith('https://')) {
            return content;
          }
          // Raw base64 string
          const mime = filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
          return `data:${mime};base64,${content}`;
        }
      } catch {
        // file not present, continue
      }
    }

    return null;
  }

  /**
   * [USER REQ 8] Cache a browsed map tile into IndexedDB and mapdata/mapcache/
   * Automatically records layer type, coordinates calibration metadata
   */
  public async cacheBrowsedTile(
    layerId: string,
    z: number,
    x: number,
    y: number,
    blob: Blob
  ): Promise<void> {
    try {
      const tileKey = this.getTileKey(layerId, z, x, y);
      await this.saveTileBlob(tileKey, blob);

      // Async write to mapdata/mapcache/ on device storage for portable offline use across tablets
      const filename = `mapcache/${layerId}_${z}_${x}_${y}.png`;
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          if (base64data) {
            await fileStorageService.saveFile('mapdata', filename, base64data);
            this.updateMapCacheManifest(layerId, z, x, y);
          }
        } catch {}
      };
      reader.readAsDataURL(blob);
    } catch {}
  }

  private cacheManifestDebounceTimer: any = null;
  private pendingTilesCount = 0;
  private cachedLayersSet = new Set<string>();

  private updateMapCacheManifest(layerId: string, z: number, x: number, y: number) {
    this.pendingTilesCount++;
    this.cachedLayersSet.add(layerId);

    if (this.cacheManifestDebounceTimer) return;
    this.cacheManifestDebounceTimer = setTimeout(async () => {
      this.cacheManifestDebounceTimer = null;
      try {
        let manifest: any = {
          updatedAt: new Date().toISOString(),
          description: 'RTK 浏览地图自动缓存 (复制到其他平板可直接离线使用)',
          targetDirectory: 'com.rtkproject.files/mapdata/mapcache',
          layers: Array.from(this.cachedLayersSet),
          totalCachedTiles: this.pendingTilesCount,
        };
        try {
          const oldManifestStr = await fileStorageService.readFile('mapdata', 'mapcache/manifest.json');
          if (oldManifestStr) {
            const parsed = JSON.parse(oldManifestStr);
            manifest.totalCachedTiles = (parsed.totalCachedTiles || 0) + this.pendingTilesCount;
            manifest.layers = Array.from(new Set([...(parsed.layers || []), ...manifest.layers]));
          }
        } catch {}
        this.pendingTilesCount = 0;
        await fileStorageService.saveFile(
          'mapdata',
          'mapcache/manifest.json',
          JSON.stringify(manifest, null, 2)
        );
      } catch {}
    }, 5000);
  }

  /**
   * Scans com.rtkproject.files/mapdata/ for any offline .tilepack or .json packages and auto-syncs them
   */
  public async autoSyncMapdataPackages(): Promise<number> {
    try {
      const files = await fileStorageService.listFiles('mapdata');
      let restoredCount = 0;
      for (const f of files) {
        if (f.name.endsWith('.tilepack') || f.name.endsWith('_offline_package.json')) {
          const raw = await fileStorageService.readFile('mapdata', f.name);
          if (raw) {
            try {
              const res = await this.importTileBundle(raw);
              if (res.success) restoredCount += res.importedCount;
            } catch {
              // ignore invalid bundle
            }
          }
        }
      }
      return restoredCount;
    } catch (e) {
      console.warn('autoSyncMapdataPackages error:', e);
      return 0;
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
   * Fast O(1) memory tile count estimation for BBox
   */
  public estimateTileCountForBBox(
    minLat: number,
    minLon: number,
    maxLat: number,
    maxLon: number,
    minZoom: number,
    maxZoom: number
  ): number {
    const safeMinLat = Math.max(-85.0511, Math.min(minLat, maxLat));
    const safeMaxLat = Math.min(85.0511, Math.max(minLat, maxLat));
    const safeMinLon = Math.max(-180, Math.min(minLon, maxLon));
    const safeMaxLon = Math.min(180, Math.max(minLon, maxLon));

    // Clamp zoom levels for safety
    const safeMinZ = Math.max(1, Math.min(minZoom, 19));
    const safeMaxZ = Math.max(safeMinZ, Math.min(maxZoom, 19));

    // If global or large extent, prevent huge zoom levels that cause OOM
    const lonSpan = Math.abs(safeMaxLon - safeMinLon);
    const latSpan = Math.abs(safeMaxLat - safeMinLat);
    if ((lonSpan > 90 || latSpan > 60) && safeMaxZ > 10) {
      return 99999999;
    }

    let count = 0;
    for (let z = safeMinZ; z <= safeMaxZ; z++) {
      const n = Math.pow(2, z);
      const minX = Math.max(0, Math.floor(((safeMinLon + 180) / 360) * n));
      const maxX = Math.min(n - 1, Math.floor(((safeMaxLon + 180) / 360) * n));

      const latRadMax = (safeMaxLat * Math.PI) / 180;
      const minY = Math.max(
        0,
        Math.floor(((1 - Math.log(Math.tan(latRadMax) + 1 / Math.cos(latRadMax)) / Math.PI) / 2) * n)
      );

      const latRadMin = (safeMinLat * Math.PI) / 180;
      const maxY = Math.min(
        n - 1,
        Math.floor(((1 - Math.log(Math.tan(latRadMin) + 1 / Math.cos(latRadMin)) / Math.PI) / 2) * n)
      );

      const xCount = Math.max(0, maxX - minX + 1);
      const yCount = Math.max(0, maxY - minY + 1);
      count += xCount * yCount;
      if (count > 500000) break;
    }

    return count;
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
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const lonDelta = radiusKm / (111.0 * (Math.abs(cosLat) > 0.001 ? cosLat : 0.001));

    const minLat = Math.max(-85.0511, centerLat - latDelta);
    const maxLat = Math.min(85.0511, centerLat + latDelta);
    const minLon = Math.max(-180, centerLon - lonDelta);
    const maxLon = Math.min(180, centerLon + lonDelta);

    return this.calculateTilesForBBox(minLat, minLon, maxLat, maxLon, minZoom, maxZoom);
  }

  /**
   * Calculate tiles needed for an arbitrary bounding box [minLat, minLon, maxLat, maxLon] and zoom range
   * With safety boundary guards to prevent browser crash/OOM
   */
  public calculateTilesForBBox(
    minLat: number,
    minLon: number,
    maxLat: number,
    maxLon: number,
    minZoom: number,
    maxZoom: number
  ): { z: number; x: number; y: number }[] {
    const tiles: { z: number; x: number; y: number }[] = [];

    const safeMinLat = Math.max(-85.0511, Math.min(minLat, maxLat));
    const safeMaxLat = Math.min(85.0511, Math.max(minLat, maxLat));
    const safeMinLon = Math.max(-180, Math.min(minLon, maxLon));
    const safeMaxLon = Math.min(180, Math.max(minLon, maxLon));

    // Clamp zoom levels
    const safeMinZ = Math.max(1, Math.min(minZoom, 19));
    let safeMaxZ = Math.max(safeMinZ, Math.min(maxZoom, 19));

    // If global or macro extent (e.g. lon span > 90 deg), hard limit max zoom to 7
    const lonSpan = Math.abs(safeMaxLon - safeMinLon);
    const latSpan = Math.abs(safeMaxLat - safeMinLat);
    if ((lonSpan > 90 || latSpan > 60) && safeMaxZ > 7) {
      safeMaxZ = 7;
    }

    const MAX_SAFETY_TILES = 35000;

    for (let z = safeMinZ; z <= safeMaxZ; z++) {
      const n = Math.pow(2, z);
      const minX = Math.max(0, Math.floor(((safeMinLon + 180) / 360) * n));
      const maxX = Math.min(n - 1, Math.floor(((safeMaxLon + 180) / 360) * n));

      const latRadMax = (safeMaxLat * Math.PI) / 180;
      const minY = Math.max(
        0,
        Math.floor(((1 - Math.log(Math.tan(latRadMax) + 1 / Math.cos(latRadMax)) / Math.PI) / 2) * n)
      );

      const latRadMin = (safeMinLat * Math.PI) / 180;
      const maxY = Math.min(
        n - 1,
        Math.floor(((1 - Math.log(Math.tan(latRadMin) + 1 / Math.cos(latRadMin)) / Math.PI) / 2) * n)
      );

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ z, x, y });
          if (tiles.length >= MAX_SAFETY_TILES) {
            console.warn(`Tile count exceeded safety limit of ${MAX_SAFETY_TILES}, truncated to prevent memory crash.`);
            return tiles;
          }
        }
      }
    }

    return tiles;
  }

  /**
   * Save a completed region metadata and mirror package manifest to /storage/emulated/0/com.rtkproject.files/mapdata/
   */
  public async saveRegionMeta(meta: CacheRegionMeta): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const req = store.put(meta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Save region package manifest into native mapdata storage
    try {
      const manifest = {
        regionId: meta.id,
        regionName: meta.name,
        layerId: meta.layerId,
        layerName: meta.layerName,
        tileCount: meta.tileCount,
        sizeBytes: meta.sizeBytes,
        scopeType: meta.scopeType || 'radius',
        center: {
          lat: meta.centerLat,
          lon: meta.centerLon,
          radiusKm: meta.radiusKm,
        },
        bbox: {
          minLat: meta.minLat,
          minLon: meta.minLon,
          maxLat: meta.maxLat,
          maxLon: meta.maxLon,
        },
        zoomRange: {
          minZoom: meta.minZoom,
          maxZoom: meta.maxZoom,
        },
        createdAt: new Date(meta.createdAt).toISOString(),
        format: 'RTK_SURVEY_MAPDATA_PACKAGE_V1',
        storagePath: `/storage/emulated/0/com.rtkproject.files/mapdata/${meta.name}_package.json`,
      };

      // Also automatically pack all real tile PNG/IndexedDB blobs into a persistent .tilepack in mapdata
      await this.saveRealTilePackageToMapdata(meta);

      await fileStorageService.saveFile(
        'mapdata',
        `${meta.name}_package.json`,
        JSON.stringify(manifest, null, 2),
        'application/json'
      );
    } catch (err) {
      console.warn('Persist mapdata package to com.rtkproject.files/mapdata error:', err);
    }
  }

  /**
   * Directly exports and saves all IndexedDB tile blobs (PNG data) to mapdata folder:
   * /storage/emulated/0/com.rtkproject.files/mapdata/{region.name}_indexeddb_tiles.tilepack
   */
  public async saveRealTilePackageToMapdata(meta: CacheRegionMeta): Promise<{ filename: string; path: string; count: number }> {
    const filename = `${meta.name}_indexeddb_tiles.tilepack`;
    try {
      const tileEntries = await this.getTilesForRegion(meta);
      const packedTiles: Array<{ tileKey: string; data: string }> = [];

      for (const entry of tileEntries) {
        const base64 = await this.blobToBase64(entry.blob);
        packedTiles.push({
          tileKey: entry.tileKey,
          data: base64,
        });
      }

      const bundle = {
        format: 'RTK_SURVEY_TILEPACK_V1',
        version: 1,
        createdAt: new Date().toISOString(),
        region: meta,
        tileCount: packedTiles.length,
        tiles: packedTiles,
      };

      const jsonStr = JSON.stringify(bundle);
      const res = await fileStorageService.saveFile('mapdata', filename, jsonStr, 'application/json');
      return { filename, path: res.path, count: packedTiles.length };
    } catch (e: any) {
      console.warn('saveRealTilePackageToMapdata error:', e);
      return { filename, path: '', count: 0 };
    }
  }

  /**
   * Retrieves all tile blobs for a given region from IndexedDB
   */
  public async getTilesForRegion(meta: CacheRegionMeta): Promise<Array<{ tileKey: string; blob: Blob }>> {
    const db = await this.getDB();
    const prefix = `${meta.layerId}_`;
    const results: Array<{ tileKey: string; blob: Blob }> = [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value;
          if (val && val.tileKey && val.tileKey.startsWith(prefix) && val.blob) {
            // Check if zoom level is in range
            const parts = val.tileKey.split('_');
            const z = parseInt(parts[parts.length - 3], 10);
            if (!isNaN(z) && z >= meta.minZoom && z <= meta.maxZoom) {
              results.push({ tileKey: val.tileKey, blob: val.blob });
            }
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      req.onerror = () => resolve(results);
    });
  }

  /**
   * Restores an exported tilepack (.tilepack or .json) into IndexedDB in low-resource batches
   */
  public async importTileBundle(
    bundleData: any,
    onProgress?: (current: number, total: number, itemName?: string) => void,
    shouldPause?: () => boolean,
    shouldCancel?: () => boolean
  ): Promise<{ success: boolean; importedCount: number; message: string; region?: CacheRegionMeta }> {
    try {
      let bundle = typeof bundleData === 'string' ? JSON.parse(bundleData) : bundleData;

      if (!bundle || (!bundle.tiles && !Array.isArray(bundle))) {
        throw new Error('无效的瓦片包文件格式，未识别到瓦片数据');
      }

      const tilesList: Array<{ tileKey: string; data: string }> = Array.isArray(bundle)
        ? bundle
        : bundle.tiles || [];
      const regionMeta: CacheRegionMeta = bundle.region || {
        id: `reg_${Date.now()}`,
        name: `导入图层_${new Date().toLocaleDateString()}`,
        layerId: tilesList[0]?.tileKey.split('_')[0] || 'custom',
        layerName: '离线恢复图层',
        centerLat: 30.5,
        centerLon: 114.3,
        radiusKm: 5,
        minZoom: 1,
        maxZoom: 18,
        tileCount: tilesList.length,
        sizeBytes: 0,
        createdAt: Date.now(),
      };

      const db = await this.getDB();
      const total = tilesList.length;
      let imported = 0;
      let totalBytes = 0;

      // Process in low-resource chunks of 20 items to never lock the UI thread
      const CHUNK_SIZE = 20;
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        if (shouldCancel && shouldCancel()) {
          return { success: false, importedCount: imported, message: '用户已取消导入' };
        }

        while (shouldPause && shouldPause()) {
          await new Promise((r) => setTimeout(r, 200));
          if (shouldCancel && shouldCancel()) {
            return { success: false, importedCount: imported, message: '用户已取消导入' };
          }
        }

        const chunk = tilesList.slice(i, i + CHUNK_SIZE);
        await new Promise<void>((resolveTx, rejectTx) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);

          chunk.forEach((item) => {
            if (item.tileKey && item.data) {
              const blob = this.base64ToBlob(item.data);
              totalBytes += blob.size;
              store.put({
                tileKey: item.tileKey,
                blob,
                updatedAt: Date.now(),
              });
              imported++;
            }
          });

          tx.oncomplete = () => resolveTx();
          tx.onerror = () => rejectTx(tx.error);
        });

        if (onProgress) {
          const lastKey = chunk[chunk.length - 1]?.tileKey || '';
          onProgress(imported, total, `瓦片: ${lastKey}`);
        }

        // Cooperative multi-tasking yield to main thread
        await new Promise((r) => setTimeout(r, 20));
      }

      // Save or update region meta
      regionMeta.tileCount = imported;
      regionMeta.sizeBytes = totalBytes;
      const metaTx = db.transaction(META_STORE, 'readwrite');
      metaTx.objectStore(META_STORE).put(regionMeta);

      return {
        success: true,
        importedCount: imported,
        message: `成功将 ${imported} 张地图瓦片写入 IndexedDB，无需联网即可离线显示！`,
        region: regionMeta,
      };
    } catch (e: any) {
      return { success: false, importedCount: 0, message: `导入失败: ${e.message}` };
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(';base64,');
    const contentType = parts[0]?.replace('data:', '') || 'image/png';
    const raw = window.atob(parts[1] || parts[0]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
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
   * Delete a region or clear all caches and remove from mapdata
   */
  public async deleteRegion(id: string, regionName?: string): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (regionName) {
      try {
        await fileStorageService.deleteFile('mapdata', `${regionName}_package.json`);
      } catch {
        // ignore
      }
    }
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
