import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  SurveyPoint,
  SurveyRoute,
  SurveyTrack,
  TrackPoint,
  EngineeringProject,
  SurveyLogRecord,
  UnitSettings,
} from '../types';
import { latLonToGauss, gaussToLatLon, haversineDistance } from '../utils/geodesy';
import { soundService } from '../utils/sound';
import { fileStorageService } from '../utils/fileStorageService';
import { exportTrackToGPX, exportPointsToCSV, exportPointsToCASS } from '../utils/exportImport';
import { backgroundTrackingService } from '../utils/backgroundTrackingService';

export interface ActiveRecordingState {
  isRecording: boolean;
  name: string;
  startTime: string;
  startTimeMs?: number;
  points: TrackPoint[];
  distance: number; // in meters
  elapsedSeconds: number;
}

interface SurveyDataContextType {
  currentProject: EngineeringProject;
  projects: EngineeringProject[];
  points: SurveyPoint[];
  routes: SurveyRoute[];
  tracks: SurveyTrack[];
  surveyLogs: SurveyLogRecord[];
  unitSettings: UnitSettings;
  activeRecording: ActiveRecordingState;
  
  // Point operations
  addPoint: (point: Omit<SurveyPoint, 'id' | 'createdAt'>) => SurveyPoint;
  updatePoint: (id: string, updates: Partial<SurveyPoint>) => void;
  deletePoint: (id: string) => void;
  deletePoints: (ids: string[]) => void;
  importPointsBatch: (newPoints: Partial<SurveyPoint>[]) => number;
  getNextPointName: () => string;

  // Route operations
  addRoute: (route: Omit<SurveyRoute, 'id' | 'createdAt'>) => SurveyRoute;
  deleteRoute: (id: string) => void;
  getNextRouteName: () => string;

  // Track operations & Background Recording
  addTrack: (track: Omit<SurveyTrack, 'id'>) => SurveyTrack;
  deleteTrack: (id: string) => void;
  getNextTrackName: () => string;
  startTrackRecording: (
    customName?: string,
    initialPoint?: { lat: number; lon: number; elevation?: number; speed?: number }
  ) => void;
  stopTrackRecording: (saveAsGPX?: boolean) => SurveyTrack | null;
  appendTrackPoint: (lat: number, lon: number, elevation: number, speed?: number) => void;

  // Project operations
  addProject: (project: Omit<EngineeringProject, 'id' | 'createTime' | 'pointCount'>) => EngineeringProject;
  deleteProject: (id: string) => boolean;
  switchProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<EngineeringProject>) => void;
  getNextProjectName: () => string;

  // Survey log & Unit settings
  addSurveyLog: (log: Omit<SurveyLogRecord, 'id' | 'time'>) => void;
  clearSurveyLogs: () => void;
  updateUnitSettings: (settings: Partial<UnitSettings>) => void;
}

// -----------------------------------------------------------------------------------
// Time-based sequential naming helpers
// Point: pointYYYY.MMDD_01
// Track: trackYYYYMMDD_1
// Project: projectYYYY.MMDD_01
// Route: routeYYYYMMDD_1
// -----------------------------------------------------------------------------------

export function generateDateSlug(sep: string = ''): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${sep}${mm}${dd}`;
}

export function generateTimePointName(existingPoints: SurveyPoint[]): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `point${dateStr}_`;

  let maxSeq = 0;
  existingPoints.forEach((p) => {
    if (!p.name) return;
    if (p.name.startsWith(prefix)) {
      const numPart = parseInt(p.name.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    } else {
      const match = p.name.match(/^point\d{8}_(\d+)$/);
      if (match && p.name.includes(dateStr)) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

export function generateTimeTrackName(existingTracks: SurveyTrack[]): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `track${dateStr}_`;

  let maxSeq = 0;
  existingTracks.forEach((t) => {
    if (!t.name) return;
    if (t.name.startsWith(prefix)) {
      const numPart = parseInt(t.name.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    } else {
      const match = t.name.match(/^track\d{8}_(\d+)$/);
      if (match && t.name.includes(dateStr)) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

export function generateTimeProjectName(existingProjects: EngineeringProject[]): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `project${dateStr}_`;

  let maxSeq = 0;
  existingProjects.forEach((p) => {
    if (!p.name) return;
    if (p.name.startsWith(prefix)) {
      const numPart = parseInt(p.name.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    } else {
      const match = p.name.match(/^project\d{8}_(\d+)$/);
      if (match && p.name.includes(dateStr)) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

export function generateTimeRouteName(existingRoutes: SurveyRoute[]): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `route${dateStr}_`;

  let maxSeq = 0;
  existingRoutes.forEach((r) => {
    if (!r.name) return;
    if (r.name.startsWith(prefix)) {
      const numPart = parseInt(r.name.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    } else {
      const match = r.name.match(/^route\d{8}_(\d+)$/);
      if (match && r.name.includes(dateStr)) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

function createDefaultProject(): EngineeringProject {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
    2,
    '0'
  )}:${String(now.getSeconds()).padStart(2, '0')}`;

  const projName = generateTimeProjectName([]);

  return {
    id: `proj_${Date.now()}`,
    name: projName,
    operator: '测绘工程师',
    coordSystem: 'CGCS2000',
    centralMeridian: 114.0,
    projectionType: 'Gauss3',
    sevenParams: { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, scale: 0 },
    createTime: dateStr,
    pointCount: 0,
    desc: '高精RTK工程测量项目',
  };
}

const defaultUnitSettings: UnitSettings = {
  distanceUnit: 'm',
  angleFormat: 'dms',
  coordDisplay: 'xy',
  areaUnit: 'mu',
  pressureUnit: 'hpa',
  audioBeep: true,
  elevationDatum: 'orthometric',
};

const SurveyDataContext = createContext<SurveyDataContextType | undefined>(undefined);

export const SurveyDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Projects (Default to new time-based project if none)
  const [projects, setProjects] = useState<EngineeringProject[]>(() => {
    const saved = localStorage.getItem('rtk_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return [createDefaultProject()];
  });

  const [currentProject, setCurrentProject] = useState<EngineeringProject>(() => {
    const savedId = localStorage.getItem('rtk_current_proj_id');
    const list = localStorage.getItem('rtk_projects');
    let parsedList: EngineeringProject[] = [];
    if (list) {
      try {
        parsedList = JSON.parse(list);
      } catch (e) {
        // ignore
      }
    }
    if (parsedList.length === 0) {
      parsedList = projects;
    }
    return parsedList.find((p) => p.id === savedId) || parsedList[0] || createDefaultProject();
  });

  // Points (Empty clean slate by default, no mock data)
  const [points, setPoints] = useState<SurveyPoint[]>(() => {
    const saved = localStorage.getItem('rtk_points');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Routes
  const [routes, setRoutes] = useState<SurveyRoute[]>(() => {
    const saved = localStorage.getItem('rtk_routes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Tracks
  const [tracks, setTracks] = useState<SurveyTrack[]>(() => {
    const saved = localStorage.getItem('rtk_tracks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Survey logs
  const [surveyLogs, setSurveyLogs] = useState<SurveyLogRecord[]>(() => {
    const saved = localStorage.getItem('rtk_survey_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [unitSettings, setUnitSettings] = useState<UnitSettings>(() => {
    const saved = localStorage.getItem('rtk_unit_settings');
    return saved ? JSON.parse(saved) : defaultUnitSettings;
  });

  // --- Background Non-stop Track Recording Engine ---
  const [activeRecording, setActiveRecording] = useState<ActiveRecordingState>(() => {
    const saved = localStorage.getItem('rtk_active_recording');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      isRecording: false,
      name: '',
      startTime: '',
      points: [],
      distance: 0,
      elapsedSeconds: 0,
    };
  });

  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock API for background tracking
  useEffect(() => {
    if (activeRecording.isRecording) {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        (navigator as any).wakeLock?.request?.('screen').then((lock: any) => {
          wakeLockRef.current = lock;
        }).catch(() => {
          // ignore wake lock denial
        });
      }
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
    }
  }, [activeRecording.isRecording]);

  // Multi-tier keep-alive & elapsed timer when recording (Persistent in background/screen-off)
  useEffect(() => {
    if (!activeRecording.isRecording) {
      backgroundTrackingService.stop();
      return;
    }

    const updateTimer = () => {
      setActiveRecording((prev) => {
        if (!prev.isRecording) return prev;
        const now = Date.now();
        const start = prev.startTimeMs || now;
        const realElapsed = Math.max(0, Math.floor((now - start) / 1000));
        return {
          ...prev,
          elapsedSeconds: realElapsed,
        };
      });
    };

    backgroundTrackingService.start(updateTimer);
    const timer = setInterval(updateTimer, 1000);

    return () => {
      backgroundTrackingService.stop(updateTimer);
      clearInterval(timer);
    };
  }, [activeRecording.isRecording]);

  // Save active recording state to localStorage
  useEffect(() => {
    localStorage.setItem('rtk_active_recording', JSON.stringify(activeRecording));
  }, [activeRecording]);

  // Sync soundService
  useEffect(() => {
    soundService.setEnabled(unitSettings.audioBeep);
  }, [unitSettings.audioBeep]);

  // Persist storage & mirror to /storage/emulated/0/com.rtkproject.files/
  useEffect(() => {
    localStorage.setItem('rtk_projects', JSON.stringify(projects));
    // Auto-save projects backup
    fileStorageService.saveFile('project', 'projects_backup.json', JSON.stringify(projects, null, 2)).catch(() => {});
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('rtk_current_proj_id', currentProject.id);
  }, [currentProject]);

  useEffect(() => {
    localStorage.setItem('rtk_points', JSON.stringify(points));
    // Persist current project point library in /storage/emulated/0/com.rtkproject.files/point/
    if (points.length > 0) {
      fileStorageService.saveFile('point', `${currentProject.name}_points.json`, JSON.stringify(points, null, 2), 'application/json').catch(() => {});
      const summaryTxt = points.map((p, idx) => 
        `${idx + 1},${p.name},${p.x.toFixed(4)},${p.y.toFixed(4)},${p.elevation.toFixed(4)},${p.code || 'GPS'},${p.createdAt}`
      ).join('\n');
      fileStorageService.saveFile('point', `${currentProject.name}_point.txt`, summaryTxt, 'text/plain;charset=utf-8').catch(() => {});
    }
  }, [points, currentProject.name]);

  useEffect(() => {
    localStorage.setItem('rtk_routes', JSON.stringify(routes));
  }, [routes]);

  useEffect(() => {
    localStorage.setItem('rtk_tracks', JSON.stringify(tracks));
  }, [tracks]);

  useEffect(() => {
    localStorage.setItem('rtk_survey_logs', JSON.stringify(surveyLogs));
  }, [surveyLogs]);

  useEffect(() => {
    localStorage.setItem('rtk_unit_settings', JSON.stringify(unitSettings));
  }, [unitSettings]);

  // Name Generator Helpers
  const getNextPointName = useCallback(() => {
    return generateTimePointName(points);
  }, [points]);

  const getNextTrackName = useCallback(() => {
    return generateTimeTrackName(tracks);
  }, [tracks]);

  const getNextProjectName = useCallback(() => {
    return generateTimeProjectName(projects);
  }, [projects]);

  const getNextRouteName = useCallback(() => {
    return generateTimeRouteName(routes);
  }, [routes]);

  // Add Point with auto time formatting
  const addPoint = useCallback(
    (pointData: Omit<SurveyPoint, 'id' | 'createdAt'>): SurveyPoint => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const pointName = pointData.name?.trim() ? pointData.name : generateTimePointName(points);

      const newPoint: SurveyPoint = {
        ...pointData,
        name: pointName,
        id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: dateStr,
        projectId: pointData.projectId || currentProject.id,
      };

      setPoints((prev) => [newPoint, ...prev]);
      soundService.playPointSaved();

      // Immediately persist point file to /storage/emulated/0/com.rtkproject.files/point/
      const pointRecordTxt = [
        `点名: ${newPoint.name}`,
        `编码: ${newPoint.code || 'GPS'}`,
        `北坐标(X): ${newPoint.x.toFixed(4)}`,
        `东坐标(Y): ${newPoint.y.toFixed(4)}`,
        `高程(H): ${newPoint.elevation.toFixed(4)}`,
        `纬度(Lat): ${newPoint.lat.toFixed(8)}`,
        `经度(Lon): ${newPoint.lon.toFixed(8)}`,
        `平面精度(HRMS): ${(newPoint.hrms || 0.008).toFixed(4)}m`,
        `高程精度(VRMS): ${(newPoint.vrms || 0.015).toFixed(4)}m`,
        `解状态: ${newPoint.solutionType || 'FIXED'}`,
        `天线高: ${(newPoint.antennaHeight || 2.0).toFixed(3)}m`,
        `采集时间: ${dateStr}`,
        newPoint.desc ? `说明: ${newPoint.desc}` : '',
      ].filter(Boolean).join('\n');

      fileStorageService.saveFile('point', `${newPoint.name}.txt`, pointRecordTxt, 'text/plain;charset=utf-8').catch(() => {});
      fileStorageService.saveFile('point', `${newPoint.name}.json`, JSON.stringify(newPoint, null, 2), 'application/json').catch(() => {});

      // Log measurement record
      setSurveyLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          pointName: newPoint.name,
          pointCode: newPoint.code,
          type: 'point_collect',
          x: newPoint.x,
          y: newPoint.y,
          h: newPoint.elevation,
          lat: newPoint.lat,
          lon: newPoint.lon,
          hrms: newPoint.hrms || 0.008,
          vrms: newPoint.vrms || 0.015,
          solution: newPoint.solutionType || 'FIXED',
          antennaHeight: newPoint.antennaHeight || 2.0,
          epochs: 5,
          time: dateStr,
          notes: newPoint.desc,
        },
        ...prev,
      ]);

      return newPoint;
    },
    [currentProject.id, points]
  );

  const updatePoint = useCallback((id: string, updates: Partial<SurveyPoint>) => {
    setPoints((prev) => prev.map((pt) => (pt.id === id ? { ...pt, ...updates } : pt)));
  }, []);

  const deletePoint = useCallback((id: string) => {
    setPoints((prev) => prev.filter((pt) => pt.id !== id));
  }, []);

  const deletePoints = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setPoints((prev) => prev.filter((pt) => !idSet.has(pt.id)));
  }, []);

  const importPointsBatch = useCallback(
    (newPoints: Partial<SurveyPoint>[]): number => {
      let count = 0;
      const formattedPoints: SurveyPoint[] = [];
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd} ${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const ptPrefix = `point${yyyy}${mm}${dd}_`;

      let currentSeq = 0;
      const existingNames = new Set<string>();
      points.forEach((p) => {
        if (!p.name) return;
        existingNames.add(p.name.trim().toLowerCase());
        if (p.name.startsWith(ptPrefix)) {
          const num = parseInt(p.name.replace(ptPrefix, ''), 10);
          if (!isNaN(num) && num > currentSeq) currentSeq = num;
        }
      });

      newPoints.forEach((p, idx) => {
        let lat = p.lat || 0;
        let lon = p.lon || 0;
        let x = p.x || 0;
        let y = p.y || 0;

        if (x !== 0 && y !== 0 && (lat === 0 || isNaN(lat))) {
          // Plane coordinates (X, Y) provided without Lat/Lon (e.g. CASS DAT or plane survey TXT)
          const geo = gaussToLatLon(x, y, currentProject.centralMeridian, currentProject.coordSystem);
          lat = geo.lat;
          lon = geo.lon;
        } else if (lat !== 0 && lon !== 0 && (x === 0 || isNaN(x))) {
          // Geodetic coordinates (Lat, Lon) provided without X/Y
          const gauss = latLonToGauss(lat, lon, currentProject.centralMeridian, currentProject.coordSystem);
          x = gauss.x;
          y = gauss.y;
        } else if (lat === 0 && lon === 0 && x === 0 && y === 0) {
          lat = 30.62402372;
          lon = 114.26778222;
          const gauss = latLonToGauss(lat, lon, currentProject.centralMeridian, currentProject.coordSystem);
          x = gauss.x;
          y = gauss.y;
        }

        let ptName = p.name?.trim();
        // If name is absent, or already exists, or is generic placeholder PT_x:
        if (!ptName || existingNames.has(ptName.toLowerCase())) {
          currentSeq++;
          ptName = `${ptPrefix}${String(currentSeq).padStart(4, '0')}`;
        }
        existingNames.add(ptName.toLowerCase());

        formattedPoints.push({
          id: `pt_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          name: ptName,
          code: p.code || 'IMP',
          lat,
          lon,
          elevation: p.elevation || 0,
          x,
          y,
          coordSystem: currentProject.coordSystem,
          desc: p.desc || '批量导入数据点',
          color: '#3b82f6',
          hrms: 0.01,
          vrms: 0.02,
          solutionType: 'FIXED',
          createdAt: dateStr,
          projectId: currentProject.id,
        });
        count++;
      });

      setPoints((prev) => [...formattedPoints, ...prev]);
      return count;
    },
    [currentProject, points]
  );

  const addRoute = useCallback(
    (routeData: Omit<SurveyRoute, 'id' | 'createdAt'>): SurveyRoute => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newRoute: SurveyRoute = {
        ...routeData,
        name: routeData.name?.trim() ? routeData.name : generateTimeRouteName(routes),
        id: `route_${Date.now()}`,
        createdAt: dateStr,
      };

      setRoutes((prev) => [newRoute, ...prev]);
      return newRoute;
    },
    [routes]
  );

  const deleteRoute = useCallback((id: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addTrack = useCallback((trackData: Omit<SurveyTrack, 'id'>): SurveyTrack => {
    const newTrack: SurveyTrack = {
      ...trackData,
      id: `track_${Date.now()}`,
    };
    setTracks((prev) => [newTrack, ...prev]);

    // Auto-save GPX and track data to /storage/emulated/0/com.rtkproject.files/track/
    const gpx = exportTrackToGPX(newTrack);
    fileStorageService.saveFile('track', `${newTrack.name}.gpx`, gpx, 'application/gpx+xml').catch(() => {});
    fileStorageService.saveFile('track', `${newTrack.name}.json`, JSON.stringify(newTrack, null, 2), 'application/json').catch(() => {});

    return newTrack;
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Background Track Recording Functions ---
  const startTrackRecording = useCallback(
    (
      customName?: string,
      initialPoint?: { lat: number; lon: number; elevation?: number; speed?: number }
    ) => {
      soundService.playClick();
      const trackName = customName?.trim() ? customName.trim() : generateTimeTrackName(tracks);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Automatically record current coordinate as the very first point
      const initialPoints: TrackPoint[] = [];
      if (initialPoint && typeof initialPoint.lat === 'number' && typeof initialPoint.lon === 'number') {
        initialPoints.push({
          lat: initialPoint.lat,
          lon: initialPoint.lon,
          elevation: initialPoint.elevation ?? 0,
          time: timeStr,
          speed: initialPoint.speed ?? 0,
        });
      }

      setActiveRecording({
        isRecording: true,
        name: trackName,
        startTime: dateStr,
        startTimeMs: Date.now(),
        points: initialPoints,
        distance: 0,
        elapsedSeconds: 0,
      });
    },
    [tracks]
  );

  const appendTrackPoint = useCallback((lat: number, lon: number, elevation: number, speed: number = 0) => {
    setActiveRecording((prev) => {
      if (!prev.isRecording) return prev;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newPoint: TrackPoint = {
        lat,
        lon,
        elevation,
        time: timeStr,
        speed: speed || 0,
      };

      if (prev.points.length === 0) {
        return {
          ...prev,
          points: [newPoint],
          distance: 0,
        };
      }

      const last = prev.points[prev.points.length - 1];
      const addedDist = haversineDistance(last.lat, last.lon, lat, lon);

      // Record point if moved slightly or after periodic sampling
      return {
        ...prev,
        points: [...prev.points, newPoint],
        distance: prev.distance + (addedDist >= 0.05 ? addedDist : 0),
      };
    });
  }, []);

  const stopTrackRecording = useCallback((saveAsGPX: boolean = true): SurveyTrack | null => {
    soundService.playSuccess();

    if (!activeRecording.isRecording || activeRecording.points.length === 0) {
      setActiveRecording({
        isRecording: false,
        name: '',
        startTime: '',
        points: [],
        distance: 0,
        elapsedSeconds: 0,
      });
      return null;
    }

    const now = new Date();
    const endTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newTrack: SurveyTrack = {
      id: `track_${Date.now()}`,
      name: activeRecording.name || generateTimeTrackName(tracks),
      points: activeRecording.points,
      distance: activeRecording.distance,
      duration: activeRecording.elapsedSeconds,
      startTime: activeRecording.startTime,
      endTime: endTimeStr,
      color: '#06b6d4',
    };

    setTracks((prev) => [newTrack, ...prev]);

    // Save as standard GPX format & JSON to /storage/emulated/0/com.rtkproject.files/track/
    if (saveAsGPX) {
      const gpxContent = exportTrackToGPX(newTrack);
      fileStorageService.saveFile('track', `${newTrack.name}.gpx`, gpxContent, 'application/gpx+xml').catch(() => {});
      fileStorageService.saveFile('track', `${newTrack.name}.json`, JSON.stringify(newTrack, null, 2), 'application/json').catch(() => {});
    }

    setActiveRecording({
      isRecording: false,
      name: '',
      startTime: '',
      points: [],
      distance: 0,
      elapsedSeconds: 0,
    });

    return newTrack;
  }, [activeRecording, tracks]);

  const addProject = useCallback(
    (projData: Omit<EngineeringProject, 'id' | 'createTime' | 'pointCount'>): EngineeringProject => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const projName = projData.name?.trim() ? projData.name : generateTimeProjectName(projects);

      const newProject: EngineeringProject = {
        ...projData,
        name: projName,
        id: `proj_${Date.now()}`,
        createTime: dateStr,
        pointCount: 0,
      };

      setProjects((prev) => [newProject, ...prev]);
      setCurrentProject(newProject);

      // Save project metadata file to project/ folder
      fileStorageService.saveFile('project', `${newProject.name}_config.json`, JSON.stringify(newProject, null, 2)).catch(() => {});

      return newProject;
    },
    [projects]
  );

  const deleteProject = useCallback(
    (id: string): boolean => {
      if (projects.length <= 1) {
        return false;
      }
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (currentProject.id === id && next.length > 0) {
          setCurrentProject(next[0]);
        }
        return next;
      });
      return true;
    },
    [projects.length, currentProject.id]
  );

  const switchProject = useCallback(
    (id: string) => {
      const found = projects.find((p) => p.id === id);
      if (found) {
        setCurrentProject(found);
      }
    },
    [projects]
  );

  const updateProject = useCallback((id: string, updates: Partial<EngineeringProject>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    setCurrentProject((prev) => (prev.id === id ? { ...prev, ...updates } : prev));
  }, []);

  const addSurveyLog = useCallback((logData: Omit<SurveyLogRecord, 'id' | 'time'>) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog: SurveyLogRecord = {
      ...logData,
      id: `log_${Date.now()}`,
      time: dateStr,
    };
    setSurveyLogs((prev) => [newLog, ...prev]);
  }, []);

  const clearSurveyLogs = useCallback(() => {
    setSurveyLogs([]);
  }, []);

  const updateUnitSettings = useCallback((updates: Partial<UnitSettings>) => {
    setUnitSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <SurveyDataContext.Provider
      value={{
        currentProject,
        projects,
        points,
        routes,
        tracks,
        surveyLogs,
        unitSettings,
        activeRecording,
        addPoint,
        updatePoint,
        deletePoint,
        deletePoints,
        importPointsBatch,
        getNextPointName,
        addRoute,
        deleteRoute,
        getNextRouteName,
        addTrack,
        deleteTrack,
        getNextTrackName,
        startTrackRecording,
        stopTrackRecording,
        appendTrackPoint,
        addProject,
        deleteProject,
        switchProject,
        updateProject,
        getNextProjectName,
        addSurveyLog,
        clearSurveyLogs,
        updateUnitSettings,
      }}
    >
      {children}
    </SurveyDataContext.Provider>
  );
};

export const useSurveyData = () => {
  const context = useContext(SurveyDataContext);
  if (!context) {
    throw new Error('useSurveyData must be used within SurveyDataProvider');
  }
  return context;
};
