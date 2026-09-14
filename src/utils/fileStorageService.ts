/**
 * RTK Survey App Native File Storage Service
 * Primary Storage Root: /storage/emulated/0/com.RTKproject.files/
 * Fixed Top-level Folders:
 *  1. magnetometer calibration data
 *  2. mapdata
 *  3. project
 * Inside project/<projectName>/
 *  - points/
 *  - tracks/
 *  - Engineering Surveying/
 *      ├── project point collection/
 *      ├── Detail Surveying/
 *      ├── Point layout results/
 *      ├── Isometric setting-out results/
 *      ├── Linear setting-out results/
 *      ├── Area measurement result/
 *      ├── Length measurement result/
 *      └── Slope measurement results/
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export type StorageFolder =
  | 'point'
  | 'track'
  | 'project'
  | 'mapdata'
  | 'points'
  | 'tracks'
  | 'magnetometer calibration data'
  | 'magnetomater calibration data'
  | (string & {});

export interface StorageFolderInfo {
  name: string;
  displayName: string;
  path: string;
  count: number;
  description: string;
}

export interface StoredFileInfo {
  name: string;
  folder: string;
  path?: string;
  size?: number;
  mtime?: number;
  contentSnippet?: string;
}

const DEFAULT_ROOT_DIR = '/storage/emulated/0/com.RTKproject.files';
const STORAGE_ROOT_KEY = 'rtk_custom_storage_root';

// 3 Primary Mandatory Directories
const PRIMARY_TOP_FOLDERS = [
  'magnetometer calibration data',
  'mapdata',
  'project',
];

// Engineering Surveying Subcategories under project/<projectName>/Engineering Surveying/
export const ENGINEERING_SURVEY_SUBPATHS = {
  POINT_COLLECTION: 'Engineering Surveying/project point collection',
  DETAIL_SURVEYING: 'Engineering Surveying/Detail Surveying',
  POINT_LAYOUT_RESULTS: 'Engineering Surveying/Point layout results',
  ISOMETRIC_SETTING_OUT: 'Engineering Surveying/Isometric setting-out results',
  LINEAR_SETTING_OUT: 'Engineering Surveying/Linear setting-out results',
  AREA_MEASUREMENT: 'Engineering Surveying/area measurement',
  DISTANCE_MEASUREMENT: 'Engineering Surveying/distance measurement',
  SLOPE_MEASUREMENT: 'Engineering Surveying/slope measurement',

  // Backward-compatible aliases
  POINT_STAKEOUT: 'Engineering Surveying/Point layout results',
  ISOMETRIC_STAKEOUT: 'Engineering Surveying/Isometric setting-out results',
  LINEAR_STAKEOUT: 'Engineering Surveying/Linear setting-out results',
  AREA_MEASURE: 'Engineering Surveying/area measurement',
  LENGTH_MEASURE: 'Engineering Surveying/distance measurement',
  SLOPE_MEASURE: 'Engineering Surveying/slope measurement',
} as const;

class FileStorageService {
  private currentRootDir: string = DEFAULT_ROOT_DIR;
  private isCapacitorNative: boolean = false;
  private permissionGranted: boolean = false;

  constructor() {
    const savedRoot = localStorage.getItem(STORAGE_ROOT_KEY);
    if (savedRoot && savedRoot.trim()) {
      this.currentRootDir = savedRoot.trim();
    }
    this.detectEnvironment();
    // Auto initialize directory tree on startup
    this.initDirectories().catch(() => {});
  }

  private detectEnvironment() {
    this.isCapacitorNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
  }

  public getRootDir(): string {
    return this.currentRootDir;
  }

  public setRootDir(newRoot: string) {
    if (!newRoot || !newRoot.trim()) return;
    this.currentRootDir = newRoot.trim();
    localStorage.setItem(STORAGE_ROOT_KEY, this.currentRootDir);
    this.initDirectories();
  }

  public resetRootDir() {
    this.currentRootDir = DEFAULT_ROOT_DIR;
    localStorage.removeItem(STORAGE_ROOT_KEY);
    this.initDirectories();
  }

  public async checkAndRequestPermissions(): Promise<{ granted: boolean; message: string }> {
    try {
      if (this.isCapacitorNative) {
        const check = await Filesystem.checkPermissions();
        if (check.publicStorage === 'granted') {
          this.permissionGranted = true;
          await this.initDirectories();
          return { granted: true, message: '已获得 Android 外置存储读写权限' };
        }
        const request = await Filesystem.requestPermissions();
        if (request.publicStorage === 'granted') {
          this.permissionGranted = true;
          await this.initDirectories();
          return { granted: true, message: 'Android 存储读写权限申请成功' };
        }
      }
      // In Web / PWA mode, persistent indexed storage is standard
      this.permissionGranted = true;
      return { granted: true, message: '文件持久化存储系统已就绪' };
    } catch (e: any) {
      console.warn('Storage permission request:', e);
      return { granted: true, message: '存储系统初始化完成' };
    }
  }

  /**
   * Initializes root directory and the 3 primary subdirectories:
   * /storage/emulated/0/com.RTKproject.files/
   *  ├── magnetometer calibration data/
   *  ├── mapdata/
   *  └── project/
   *       └── project 1/ (mandatory default project)
   */
  public async initDirectories(): Promise<boolean> {
    try {
      if (this.isCapacitorNative) {
        // Ensure root folder exists
        try {
          await Filesystem.mkdir({
            path: 'com.RTKproject.files',
            directory: Directory.ExternalStorage,
            recursive: true,
          });
        } catch (e) {
          // ignore if already exists
        }

        for (const sub of PRIMARY_TOP_FOLDERS) {
          try {
            await Filesystem.mkdir({
              path: `com.RTKproject.files/${sub}`,
              directory: Directory.ExternalStorage,
              recursive: true,
            });
          } catch (err) {
            // directory may already exist
          }
        }
      }

      // Ensure default 'project 1' directory exists
      await this.ensureProjectDirectories('project 1');
      return true;
    } catch (e) {
      console.warn('initDirectories error:', e);
      return false;
    }
  }

  /**
   * Ensures a project's full directory tree exists:
   * project/<projectName>/
   *   ├── points/
   *   ├── tracks/
   *   └── Engineering Surveying/
   *        ├── project point collection/
   *        ├── Detail Surveying/
   *        ├── Point layout results/
   *        ├── Isometric setting-out results/
   *        ├── Linear setting-out results/
   *        ├── Area measurement result/
   *        ├── Length measurement result/
   *        └── Slope measurement results/
   */
  public async ensureProjectDirectories(projectName: string = 'project 1'): Promise<void> {
    const cleanProj = projectName.trim() || 'project 1';
    const subPaths = [
      `project/${cleanProj}/points`,
      `project/${cleanProj}/tracks`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.POINT_COLLECTION}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.DETAIL_SURVEYING}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.POINT_STAKEOUT}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.ISOMETRIC_STAKEOUT}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.LINEAR_STAKEOUT}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.AREA_MEASURE}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.LENGTH_MEASURE}`,
      `project/${cleanProj}/${ENGINEERING_SURVEY_SUBPATHS.SLOPE_MEASURE}`,
    ];

    if (this.isCapacitorNative) {
      for (const p of subPaths) {
        try {
          await Filesystem.mkdir({
            path: `com.RTKproject.files/${p}`,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Saves a file into a project's sub-path, e.g.:
   * project/project 1/Engineering Surveying/project point collection/pointcollection20260915_0001.json
   */
  public async saveProjectFile(
    projectName: string = 'project 1',
    subCategoryPath: string,
    filename: string,
    content: string | Blob
  ): Promise<{ success: boolean; path: string }> {
    const cleanProj = projectName.trim() || 'project 1';
    const stringContent = typeof content === 'string' ? content : await this.blobToString(content);
    const relPath = `project/${cleanProj}/${subCategoryPath}/${filename}`.replace(/\/+/g, '/');
    const fullPath = `${this.currentRootDir}/${relPath}`;

    try {
      if (this.isCapacitorNative) {
        await Filesystem.writeFile({
          path: `com.RTKproject.files/${relPath}`,
          data: stringContent,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      }
      this.saveToVirtualStorage(`proj_${cleanProj}_${subCategoryPath}`, filename, stringContent);
      return { success: true, path: fullPath };
    } catch (e) {
      console.warn('saveProjectFile fallback to virtual storage:', e);
      this.saveToVirtualStorage(`proj_${cleanProj}_${subCategoryPath}`, filename, stringContent);
      return { success: true, path: fullPath };
    }
  }

  /**
   * Reads a project file from a given sub-path
   */
  public async readProjectFile(
    projectName: string = 'project 1',
    subCategoryPath: string,
    filename: string
  ): Promise<string | null> {
    const cleanProj = projectName.trim() || 'project 1';
    const relPath = `project/${cleanProj}/${subCategoryPath}/${filename}`.replace(/\/+/g, '/');

    try {
      if (this.isCapacitorNative) {
        const res = await Filesystem.readFile({
          path: `com.RTKproject.files/${relPath}`,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
        });
        if (res && res.data) {
          return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        }
      }
    } catch {
      // fallback to virtual
    }

    const virtualKey = `proj_${cleanProj}_${subCategoryPath}`;
    const virtual = (await this.readFromVirtualStorageAsync(virtualKey, filename)) || this.readFromVirtualStorage(virtualKey, filename);
    return virtual;
  }

  /**
   * Lists files under a specific project sub-path
   */
  public async listProjectFiles(
    projectName: string = 'project 1',
    subCategoryPath: string = 'points'
  ): Promise<StoredFileInfo[]> {
    const cleanProj = projectName.trim() || 'project 1';
    const relPath = `project/${cleanProj}/${subCategoryPath}`.replace(/\/+/g, '/');
    const virtualKey = `proj_${cleanProj}_${subCategoryPath}`;
    const list: StoredFileInfo[] = [];

    const virtualFiles = this.listFromVirtualStorage(virtualKey);
    for (const vf of virtualFiles) {
      list.push({
        ...vf,
        folder: relPath,
        path: `${this.currentRootDir}/${relPath}/${vf.name}`,
      });
    }

    if (this.isCapacitorNative) {
      try {
        const nativeList = await Filesystem.readdir({
          path: `com.RTKproject.files/${relPath}`,
          directory: Directory.ExternalStorage,
        });
        if (nativeList && nativeList.files) {
          nativeList.files.forEach((file) => {
            const fileName = typeof file === 'string' ? file : file.name;
            if (!list.some((it) => it.name === fileName)) {
              list.push({
                name: fileName,
                folder: relPath,
                path: `${this.currentRootDir}/${relPath}/${fileName}`,
                size: typeof file === 'object' ? file.size : undefined,
                mtime: typeof file === 'object' ? file.mtime : undefined,
              });
            }
          });
        }
      } catch {
        // ignore
      }
    }

    return list;
  }

  /**
   * Saves a file into the specified subfolder, syncing both singular and plural forms (point/points, track/tracks)
   */
  public async saveFile(
    subfolder: StorageFolder,
    filename: string,
    content: string | Blob,
    mimeType: string = 'text/plain;charset=utf-8'
  ): Promise<{ success: boolean; path: string }> {
    const stringContent = typeof content === 'string' ? content : await this.blobToString(content);
    
    // Determine target folders (write to both singular & plural or alias forms)
    const targets: StorageFolder[] = [];
    if (subfolder === 'point' || subfolder === 'points') {
      targets.push('point', 'points');
    } else if (subfolder === 'track' || subfolder === 'tracks') {
      targets.push('track', 'tracks');
    } else if (subfolder === 'magnetomater calibration data' || subfolder === 'magnetometer calibration data') {
      targets.push('magnetomater calibration data', 'magnetometer calibration data');
    } else {
      targets.push(subfolder);
    }

    const primaryTarget = targets[0];
    const fullPath = `${this.currentRootDir}/${primaryTarget}/${filename}`;

    try {
      if (this.isCapacitorNative) {
        for (const target of targets) {
          try {
            await Filesystem.writeFile({
              path: `com.rtkproject.files/${target}/${filename}`,
              data: stringContent,
              directory: Directory.ExternalStorage,
              encoding: Encoding.UTF8,
              recursive: true,
            });
          } catch (writeErr) {
            console.warn(`Write to ${target} error:`, writeErr);
          }
        }
      }

      // Also mirror to Local/Indexed virtual file index for fast search & offline access
      for (const target of targets) {
        this.saveToVirtualStorage(target, filename, stringContent);
      }

      return { success: true, path: fullPath };
    } catch (e: any) {
      console.warn('Native write error, using virtual persistence:', e);
      for (const target of targets) {
        this.saveToVirtualStorage(target, filename, stringContent);
      }
      return { success: true, path: fullPath };
    }
  }

  /**
   * Reads a file from subfolder
   */
  public async readFile(
    subfolder: StorageFolder,
    filename: string
  ): Promise<string | null> {
    const checkFolders: StorageFolder[] = [];
    if (subfolder === 'point' || subfolder === 'points') {
      checkFolders.push('point', 'points');
    } else if (subfolder === 'track' || subfolder === 'tracks') {
      checkFolders.push('track', 'tracks');
    } else if (subfolder === 'magnetomater calibration data' || subfolder === 'magnetometer calibration data') {
      checkFolders.push('magnetomater calibration data', 'magnetometer calibration data');
    } else {
      checkFolders.push(subfolder);
    }

    for (const folder of checkFolders) {
      try {
        if (this.isCapacitorNative) {
          const res = await Filesystem.readFile({
            path: `com.rtkproject.files/${folder}/${filename}`,
            directory: Directory.ExternalStorage,
            encoding: Encoding.UTF8,
          });
          if (res && res.data) {
            return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          }
        }
      } catch (e) {
        // Continue to fallback
      }

      const virtual = (await this.readFromVirtualStorageAsync(folder, filename)) || this.readFromVirtualStorage(folder, filename);
      if (virtual) return virtual;
    }

    return null;
  }

  /**
   * Lists files in a subfolder (merging singular and plural aliases)
   */
  public async listFiles(subfolder: StorageFolder): Promise<StoredFileInfo[]> {
    const list: StoredFileInfo[] = [];
    const checkFolders: StorageFolder[] = [];
    if (subfolder === 'point' || subfolder === 'points') {
      checkFolders.push('point', 'points');
    } else if (subfolder === 'track' || subfolder === 'tracks') {
      checkFolders.push('track', 'tracks');
    } else if (subfolder === 'magnetomater calibration data' || subfolder === 'magnetometer calibration data') {
      checkFolders.push('magnetomater calibration data', 'magnetometer calibration data');
    } else {
      checkFolders.push(subfolder);
    }

    for (const folder of checkFolders) {
      const virtualFiles = this.listFromVirtualStorage(folder);
      for (const vf of virtualFiles) {
        if (!list.some((it) => it.name === vf.name)) {
          list.push(vf);
        }
      }

      if (this.isCapacitorNative) {
        try {
          const nativeList = await Filesystem.readdir({
            path: `com.rtkproject.files/${folder}`,
            directory: Directory.ExternalStorage,
          });
          if (nativeList && nativeList.files) {
            nativeList.files.forEach((file) => {
              const fileName = typeof file === 'string' ? file : file.name;
              if (!list.some((it) => it.name === fileName)) {
                list.push({
                  name: fileName,
                  folder: subfolder,
                  size: typeof file === 'object' ? file.size : undefined,
                  mtime: typeof file === 'object' ? file.mtime : undefined,
                });
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }

    return list;
  }

  /**
   * Deletes a file
   */
  public async deleteFile(
    subfolder: StorageFolder,
    filename: string
  ): Promise<boolean> {
    const targets: StorageFolder[] = [];
    if (subfolder === 'point' || subfolder === 'points') {
      targets.push('point', 'points');
    } else if (subfolder === 'track' || subfolder === 'tracks') {
      targets.push('track', 'tracks');
    } else if (subfolder === 'magnetomater calibration data' || subfolder === 'magnetometer calibration data') {
      targets.push('magnetomater calibration data', 'magnetometer calibration data');
    } else {
      targets.push(subfolder);
    }

    for (const target of targets) {
      try {
        if (this.isCapacitorNative) {
          await Filesystem.deleteFile({
            path: `com.rtkproject.files/${target}/${filename}`,
            directory: Directory.ExternalStorage,
          });
        }
      } catch (e) {
        // ignore
      }
      this.deleteFromVirtualStorage(target, filename);
    }
    return true;
  }

  /**
   * Gets overview count of files in all primary folders
   */
  public async getFolderStats(): Promise<StorageFolderInfo[]> {
    const infos: StorageFolderInfo[] = [
      {
        name: 'point',
        displayName: '位点库 (point)',
        path: `${this.currentRootDir}/point`,
        count: (await this.listFiles('point')).length,
        description: '保存当前采集与标记的位点文件 (.json/.txt)',
      },
      {
        name: 'track',
        displayName: '航迹库 (track)',
        path: `${this.currentRootDir}/track`,
        count: (await this.listFiles('track')).length,
        description: '保存实时测绘及记录的航迹文件 (.gpx/.json)',
      },
      {
        name: 'project',
        displayName: '工程配置 (project)',
        path: `${this.currentRootDir}/project`,
        count: (await this.listFiles('project')).length,
        description: '保存测区工程参数、椭球投影与四参数/七参数配置',
      },
      {
        name: 'mapdata',
        displayName: '离线地图与GIS缓存 (mapdata)',
        path: `${this.currentRootDir}/mapdata`,
        count: (await this.listFiles('mapdata')).length,
        description: '保存卫星影像瓦片缓存、CAD底图及矢量图层',
      },
      {
        name: 'magnetomater calibration data',
        displayName: '磁力计校准库 (magnetomater calibration data)',
        path: `${this.currentRootDir}/magnetomater calibration data`,
        count: (await this.listFiles('magnetomater calibration data')).length,
        description: '保存空间磁力分析动作解算、手机本性硬磁偏置、物理指南针比对及现场工区自适应校准文件',
      },
    ];
    return infos;
  }

  // --- Virtual Storage (IndexedDB + LocalStorage fallback) for Zero Data Loss across Sessions & Re-installs ---
  private idbInstance: Promise<IDBDatabase> | null = null;

  private getFileStorageDB(): Promise<IDBDatabase> {
    if (this.idbInstance) return this.idbInstance;
    this.idbInstance = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }
      const req = indexedDB.open('RTK_Virtual_Files_Store', 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.idbInstance;
  }

  private async saveToVirtualStorage(subfolder: string, filename: string, content: string) {
    const key = `rtk_file_${subfolder}_${filename}`;
    // 1. Try IndexedDB first (no 5MB quota limit, supports large tile bundles)
    try {
      const db = await this.getFileStorageDB();
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({
        key,
        subfolder,
        filename,
        content,
        size: content.length,
        updatedAt: Date.now(),
      });
    } catch {
      // Fallback
    }

    // 2. Keep lightweight entry / index in localStorage
    try {
      if (content.length < 500000) {
        localStorage.setItem(key, content);
      }
      const indexKey = `rtk_filelist_${subfolder}`;
      const listStr = localStorage.getItem(indexKey);
      const list: string[] = listStr ? JSON.parse(listStr) : [];
      if (!list.includes(filename)) {
        list.push(filename);
        localStorage.setItem(indexKey, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Virtual storage write index:', e);
    }
  }

  private async readFromVirtualStorageAsync(subfolder: string, filename: string): Promise<string | null> {
    const key = `rtk_file_${subfolder}_${filename}`;
    // 1. Try IndexedDB
    try {
      const db = await this.getFileStorageDB();
      const result = await new Promise<any>((resolve) => {
        const tx = db.transaction('files', 'readonly');
        const req = tx.objectStore('files').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (result && result.content) {
        return result.content;
      }
    } catch {
      // ignore
    }

    // 2. Fallback to localStorage
    return localStorage.getItem(key);
  }

  private readFromVirtualStorage(subfolder: string, filename: string): string | null {
    const key = `rtk_file_${subfolder}_${filename}`;
    return localStorage.getItem(key);
  }

  private listFromVirtualStorage(subfolder: string): StoredFileInfo[] {
    const indexKey = `rtk_filelist_${subfolder}`;
    const listStr = localStorage.getItem(indexKey);
    if (!listStr) return [];
    try {
      const names: string[] = JSON.parse(listStr);
      return names.map((name) => {
        const content = this.readFromVirtualStorage(subfolder, name) || '';
        return {
          name,
          folder: subfolder as any,
          size: content.length,
          contentSnippet: content.slice(0, 100),
        };
      });
    } catch {
      return [];
    }
  }

  private async deleteFromVirtualStorage(subfolder: string, filename: string) {
    const key = `rtk_file_${subfolder}_${filename}`;
    try {
      const db = await this.getFileStorageDB();
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(key);
    } catch {
      // ignore
    }

    localStorage.removeItem(key);

    const indexKey = `rtk_filelist_${subfolder}`;
    const listStr = localStorage.getItem(indexKey);
    if (listStr) {
      try {
        const list: string[] = JSON.parse(listStr);
        const filtered = list.filter((n) => n !== filename);
        localStorage.setItem(indexKey, JSON.stringify(filtered));
      } catch {
        // ignore
      }
    }
  }

  private blobToString(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  }
}

export const fileStorageService = new FileStorageService();

/**
 * Returns date stamp formatted as YYYYMMDD (e.g. 20260915)
 */
export function getDateStamp(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Formats standard survey item name with 4-digit sequential suffix:
 * e.g. prefix + YYYYMMDD + '_' + 0001
 */
export function generateSurveySequentialName(
  prefix: string,
  existingNames: string[],
  dateStr: string = getDateStamp()
): string {
  const basePrefix = `${prefix}${dateStr}_`;
  let maxSeq = 0;

  existingNames.forEach((name) => {
    if (!name) return;
    if (name.startsWith(basePrefix)) {
      const numStr = name.slice(basePrefix.length).replace(/\D.*$/, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${basePrefix}${nextSeq}`;
}

/**
 * Formats Area Surveying folder and node names:
 * Folder: area1@YYYYMMDD, area2@YYYYMMDD...
 * Node: Area node_0001, Area node_0002...
 */
export function generateAreaMeasurementName(existingAreaNames: string[], dateStr: string = getDateStamp()) {
  let maxAreaIndex = 0;
  existingAreaNames.forEach((name) => {
    const match = name.match(/area(\d+)@/i);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx > maxAreaIndex) maxAreaIndex = idx;
    }
  });

  const nextAreaIdx = maxAreaIndex + 1;
  const folderName = `area${nextAreaIdx}@${dateStr}`;

  const getNodeName = (nodeIndex: number) => {
    return `Area node_${String(nodeIndex).padStart(4, '0')}`;
  };

  return { folderName, getNodeName, areaIndex: nextAreaIdx };
}

