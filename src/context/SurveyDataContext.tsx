import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SurveyPoint,
  SurveyRoute,
  SurveyTrack,
  EngineeringProject,
  SurveyLogRecord,
  UnitSettings,
} from '../types';
import { latLonToGauss } from '../utils/geodesy';
import { soundService } from '../utils/sound';

interface SurveyDataContextType {
  currentProject: EngineeringProject;
  projects: EngineeringProject[];
  points: SurveyPoint[];
  routes: SurveyRoute[];
  tracks: SurveyTrack[];
  surveyLogs: SurveyLogRecord[];
  unitSettings: UnitSettings;
  addPoint: (point: Omit<SurveyPoint, 'id' | 'createdAt'>) => SurveyPoint;
  updatePoint: (id: string, updates: Partial<SurveyPoint>) => void;
  deletePoint: (id: string) => void;
  deletePoints: (ids: string[]) => void;
  importPointsBatch: (newPoints: Partial<SurveyPoint>[]) => number;
  addRoute: (route: Omit<SurveyRoute, 'id' | 'createdAt'>) => SurveyRoute;
  deleteRoute: (id: string) => void;
  addTrack: (track: Omit<SurveyTrack, 'id'>) => SurveyTrack;
  deleteTrack: (id: string) => void;
  addProject: (project: Omit<EngineeringProject, 'id' | 'createTime' | 'pointCount'>) => EngineeringProject;
  deleteProject: (id: string) => boolean;
  switchProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<EngineeringProject>) => void;
  addSurveyLog: (log: Omit<SurveyLogRecord, 'id' | 'time'>) => void;
  clearSurveyLogs: () => void;
  updateUnitSettings: (settings: Partial<UnitSettings>) => void;
}

const defaultProject: EngineeringProject = {
  id: 'proj_default_01',
  name: '光谷科技园市政测绘工程',
  operator: '测量工程师_张工',
  coordSystem: 'CGCS2000',
  centralMeridian: 114.0,
  projectionType: 'Gauss3',
  sevenParams: { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, scale: 0 },
  createTime: '2026-08-20 08:30:00',
  pointCount: 6,
  desc: '高精RTK工程放样与GIS地形图碎部采集项目',
};

const initialProjects: EngineeringProject[] = [
  defaultProject,
  {
    id: 'proj_02',
    name: '三环线跨线桥桩基放样',
    operator: '李工',
    coordSystem: 'Beijing54',
    centralMeridian: 114.0,
    projectionType: 'Gauss3',
    sevenParams: { dx: -12.4, dy: 8.5, dz: 14.2, rx: 0.12, ry: -0.08, rz: 0.45, scale: 1.2 },
    createTime: '2026-08-22 14:10:00',
    pointCount: 4,
    desc: '高架桥主墩控制网与桩位偏距放样',
  },
];

// Initial realistic points around 30.62402372, 114.26778222 (Wuhan Optics Valley Area)
const baseLat = 30.62402372;
const baseLon = 114.26778222;

const initialPoints: SurveyPoint[] = [
  {
    id: 'pt_1',
    name: 'point 1',
    code: 'CP01',
    lat: baseLat + 0.00045,
    lon: baseLon + 0.00032,
    elevation: 24.12,
    x: latLonToGauss(baseLat + 0.00045, baseLon + 0.00032, 114.0, 'CGCS2000').x,
    y: latLonToGauss(baseLat + 0.00045, baseLon + 0.00032, 114.0, 'CGCS2000').y,
    coordSystem: 'CGCS2000',
    desc: '园区主入口高等级导线控制点',
    color: '#f97316',
    hrms: 0.008,
    vrms: 0.014,
    solutionType: 'FIXED',
    satCount: 28,
    createdAt: '2026-08-29 09:12:44',
    projectId: 'proj_default_01',
  },
  {
    id: 'pt_2',
    name: 'point 2',
    code: 'ROAD_CL',
    lat: baseLat + 0.0012,
    lon: baseLon - 0.0008,
    elevation: 23.85,
    x: latLonToGauss(baseLat + 0.0012, baseLon - 0.0008, 114.0, 'CGCS2000').x,
    y: latLonToGauss(baseLat + 0.0012, baseLon - 0.0008, 114.0, 'CGCS2000').y,
    coordSystem: 'CGCS2000',
    desc: '规划道路K0+080中心桩设计放样点',
    color: '#3b82f6',
    hrms: 0.007,
    vrms: 0.012,
    solutionType: 'FIXED',
    satCount: 30,
    createdAt: '2026-08-29 09:25:10',
    projectId: 'proj_default_01',
  },
  {
    id: 'pt_3',
    name: 'point 3',
    code: 'BM02',
    lat: baseLat - 0.0009,
    lon: baseLon + 0.0015,
    elevation: 25.6,
    x: latLonToGauss(baseLat - 0.0009, baseLon + 0.0015, 114.0, 'CGCS2000').x,
    y: latLonToGauss(baseLat - 0.0009, baseLon + 0.0015, 114.0, 'CGCS2000').y,
    coordSystem: 'CGCS2000',
    desc: '国家二等水准基点引测标志',
    color: '#10b981',
    hrms: 0.006,
    vrms: 0.009,
    solutionType: 'FIXED',
    satCount: 31,
    createdAt: '2026-08-29 09:40:02',
    projectId: 'proj_default_01',
  },
  {
    id: 'pt_4',
    name: 'point 4',
    code: 'BLDG_CORNER',
    lat: baseLat - 0.0006,
    lon: baseLon - 0.0011,
    elevation: 23.4,
    x: latLonToGauss(baseLat - 0.0006, baseLon - 0.0011, 114.0, 'CGCS2000').x,
    y: latLonToGauss(baseLat - 0.0006, baseLon - 0.0011, 114.0, 'CGCS2000').y,
    coordSystem: 'CGCS2000',
    desc: '1#厂房西南角外墙轴线交点',
    color: '#8b5cf6',
    hrms: 0.009,
    vrms: 0.016,
    solutionType: 'FIXED',
    satCount: 26,
    createdAt: '2026-08-29 10:05:30',
    projectId: 'proj_default_01',
  },
];

const initialRoutes: SurveyRoute[] = [
  {
    id: 'route_1',
    name: '主干道中线放样轴线',
    pointIds: ['pt_1', 'pt_2', 'pt_3'],
    totalDistance: 342.8,
    createdAt: '2026-08-29 10:15:00',
    desc: '自入口控制点至道路中心桩里程',
    color: '#f97316',
  },
];

const initialTracks: SurveyTrack[] = [
  {
    id: 'track_1',
    name: '20260829_勘测巡线航迹',
    points: [
      { lat: baseLat, lon: baseLon, elevation: 23.4, time: '2026-08-29 09:00:00', speed: 1.2 },
      { lat: baseLat + 0.0003, lon: baseLon + 0.0002, elevation: 23.8, time: '2026-08-29 09:05:00', speed: 1.4 },
      { lat: baseLat + 0.0008, lon: baseLon - 0.0004, elevation: 24.1, time: '2026-08-29 09:12:00', speed: 1.1 },
      { lat: baseLat + 0.0012, lon: baseLon - 0.0008, elevation: 23.85, time: '2026-08-29 09:20:00', speed: 0.9 },
    ],
    distance: 428.5,
    duration: 1200,
    startTime: '2026-08-29 09:00:00',
    endTime: '2026-08-29 09:20:00',
    color: '#06b6d4',
  },
];

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
  const [projects, setProjects] = useState<EngineeringProject[]>(() => {
    const saved = localStorage.getItem('rtk_projects');
    return saved ? JSON.parse(saved) : initialProjects;
  });

  const [currentProject, setCurrentProject] = useState<EngineeringProject>(() => {
    const savedId = localStorage.getItem('rtk_current_proj_id');
    const list = localStorage.getItem('rtk_projects');
    const parsedList: EngineeringProject[] = list ? JSON.parse(list) : initialProjects;
    return parsedList.find((p) => p.id === savedId) || parsedList[0] || defaultProject;
  });

  const [points, setPoints] = useState<SurveyPoint[]>(() => {
    const saved = localStorage.getItem('rtk_points');
    return saved ? JSON.parse(saved) : initialPoints;
  });

  const [routes, setRoutes] = useState<SurveyRoute[]>(() => {
    const saved = localStorage.getItem('rtk_routes');
    return saved ? JSON.parse(saved) : initialRoutes;
  });

  const [tracks, setTracks] = useState<SurveyTrack[]>(() => {
    const saved = localStorage.getItem('rtk_tracks');
    return saved ? JSON.parse(saved) : initialTracks;
  });

  const [surveyLogs, setSurveyLogs] = useState<SurveyLogRecord[]>(() => {
    const saved = localStorage.getItem('rtk_survey_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [unitSettings, setUnitSettings] = useState<UnitSettings>(() => {
    const saved = localStorage.getItem('rtk_unit_settings');
    return saved ? JSON.parse(saved) : defaultUnitSettings;
  });

  // Sync soundService enabled status with unitSettings
  useEffect(() => {
    soundService.setEnabled(unitSettings.audioBeep);
  }, [unitSettings.audioBeep]);

  // Persist storage
  useEffect(() => {
    localStorage.setItem('rtk_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('rtk_current_proj_id', currentProject.id);
  }, [currentProject]);

  useEffect(() => {
    localStorage.setItem('rtk_points', JSON.stringify(points));
  }, [points]);

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

  const addPoint = useCallback(
    (pointData: Omit<SurveyPoint, 'id' | 'createdAt'>): SurveyPoint => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newPoint: SurveyPoint = {
        ...pointData,
        id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: dateStr,
        projectId: pointData.projectId || currentProject.id,
      };

      setPoints((prev) => [newPoint, ...prev]);
      soundService.playPointSaved();

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
    [currentProject.id]
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
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      newPoints.forEach((p, idx) => {
        let lat = p.lat || baseLat;
        let lon = p.lon || baseLon;
        let x = p.x || 0;
        let y = p.y || 0;

        if (x !== 0 && y !== 0 && (lat === 0 || isNaN(lat))) {
          // calculate lat/lon from Gauss
          const gaussCalc = latLonToGauss(lat, lon, currentProject.centralMeridian, currentProject.coordSystem);
          x = gaussCalc.x;
          y = gaussCalc.y;
        } else if (lat !== 0 && lon !== 0 && (x === 0 || isNaN(x))) {
          const gauss = latLonToGauss(lat, lon, currentProject.centralMeridian, currentProject.coordSystem);
          x = gauss.x;
          y = gauss.y;
        }

        formattedPoints.push({
          id: `pt_imp_${Date.now()}_${idx}`,
          name: p.name || `Import_${idx + 1}`,
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
    [currentProject]
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
        id: `route_${Date.now()}`,
        createdAt: dateStr,
      };

      setRoutes((prev) => [newRoute, ...prev]);
      return newRoute;
    },
    []
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
    return newTrack;
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addProject = useCallback(
    (projData: Omit<EngineeringProject, 'id' | 'createTime' | 'pointCount'>): EngineeringProject => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newProject: EngineeringProject = {
        ...projData,
        id: `proj_${Date.now()}`,
        createTime: dateStr,
        pointCount: 0,
      };

      setProjects((prev) => [newProject, ...prev]);
      setCurrentProject(newProject);
      return newProject;
    },
    []
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
      now.getMonth() + 1
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
        addPoint,
        updatePoint,
        deletePoint,
        deletePoints,
        importPointsBatch,
        addRoute,
        deleteRoute,
        addTrack,
        deleteTrack,
        addProject,
        deleteProject,
        switchProject,
        updateProject,
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
