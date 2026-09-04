import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  X,
  Globe,
  Building2,
  FileCode,
  FileDown,
  Upload,
  Check,
  FolderDown,
  HelpCircle,
  MapPin,
  Compass,
  Sliders,
  PenTool,
  FolderArchive,
} from 'lucide-react';
import { offlineMapTileService, CacheRegionMeta } from '../../utils/offlineMapTileService';
import { MapLayerType, getMapTileUrl } from '../../utils/mapTileUrls';
import { useRTK } from '../../context/RTKContext';
import { fileStorageService } from '../../utils/fileStorageService';
import { soundService } from '../../utils/sound';

export interface OfflineMapModalProps {
  isOpen?: boolean;
  onClose: () => void;
  centerLat?: number;
  centerLon?: number;
  currentLayer?: MapLayerType;
  getTileUrlFunction?: (layerId: string, x: number, y: number, z: number) => string;
}

export interface AdminRegionPreset {
  id: string;
  name: string;
  shortName: string;
  category: string;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  centerLat: number;
  centerLon: number;
  desc: string;
}

export const PRESET_ADMIN_REGIONS: AdminRegionPreset[] = [
  {
    id: 'beijing_core',
    name: '北京市-核心工程测区',
    shortName: '北京核心区',
    category: '直辖市',
    minLat: 39.80,
    minLon: 116.25,
    maxLat: 40.05,
    maxLon: 116.55,
    centerLat: 39.9042,
    centerLon: 116.4074,
    desc: '东城、西城、朝阳、海淀及亦庄重点工程',
  },
  {
    id: 'shanghai_pudong',
    name: '上海市-浦东与临港新片区',
    shortName: '上海临港',
    category: '直辖市',
    minLat: 30.90,
    minLon: 121.40,
    maxLat: 31.35,
    maxLon: 121.95,
    centerLat: 31.2304,
    centerLon: 121.5737,
    desc: '重大外港、张江自贸区及临港高新产城测绘',
  },
  {
    id: 'guangzhou_huangpu',
    name: '广州市-黄埔开发区与天河区',
    shortName: '广州开发区',
    category: '大湾区',
    minLat: 23.05,
    minLon: 113.28,
    maxLat: 23.35,
    maxLon: 113.58,
    centerLat: 23.1291,
    centerLon: 113.3644,
    desc: '知识城重大基建工程与天河智能制造走廊',
  },
  {
    id: 'shenzhen_qianhai',
    name: '深圳市-前海与南山自贸区',
    shortName: '深圳前海',
    category: '大湾区',
    minLat: 22.45,
    minLon: 113.85,
    maxLat: 22.62,
    maxLon: 114.05,
    centerLat: 22.5331,
    centerLon: 113.9379,
    desc: '深港现代服务业特区及高新园区高精工程',
  },
  {
    id: 'chengdu_tianfu',
    name: '成都市-天府新区核心区',
    shortName: '成都天府',
    category: '成渝地区',
    minLat: 30.38,
    minLon: 103.98,
    maxLat: 30.65,
    maxLon: 104.22,
    centerLat: 30.5228,
    centerLon: 104.0668,
    desc: '天府总部商务区及科学城基建大范围工程',
  },
];

type ScopeMode = 'radius' | 'world' | 'preset' | 'custom_file';
type WorldScopeType = 'global' | 'china' | 'asia' | 'local_macro' | 'custom';

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  isOpen = true,
  onClose,
  centerLat,
  centerLon,
  currentLayer: propLayer,
  getTileUrlFunction = getMapTileUrl,
}) => {
  const { rtkState } = useRTK();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effective coordinates and layer (guaranteed safe numbers)
  const rawLat = centerLat ?? rtkState.currentLat;
  const rawLon = centerLon ?? rtkState.currentLon;
  const effectiveCenterLat = typeof rawLat === 'number' && !isNaN(rawLat) && rawLat !== 0 ? rawLat : 39.9042;
  const effectiveCenterLon = typeof rawLon === 'number' && !isNaN(rawLon) && rawLon !== 0 ? rawLon : 116.4074;
  const currentLayer = propLayer ?? 'gaode_satellite';

  // Primary mode state
  const [scopeMode, setScopeMode] = useState<ScopeMode>('radius');

  // ==========================================
  // 1. 现场测区半径（工程高精）独立状态
  // ==========================================
  const [surveyRadiusKm, setSurveyRadiusKm] = useState<number>(1.0);
  const [surveyMinZoom, setSurveyMinZoom] = useState<number>(12);
  const [surveyMaxZoom, setSurveyMaxZoom] = useState<number>(16);
  const [surveyRegionName, setSurveyRegionName] = useState<string>('');

  // ==========================================
  // 2. 世界/宏观概览（彻底脱钩）独立状态
  //    支持自主定义下载范围，独立宏观级别 (1~6 级)
  // ==========================================
  const [worldScopeType, setWorldScopeType] = useState<WorldScopeType>('china');
  const [worldMinZoom, setWorldMinZoom] = useState<number>(1);
  const [worldMaxZoom, setWorldMaxZoom] = useState<number>(4);
  const [worldRegionName, setWorldRegionName] = useState<string>('中国全境宏观底图_L1-L4');

  // 自定义宏观经纬度范围
  const [customMacroMinLat, setCustomMacroMinLat] = useState<number>(18.0);
  const [customMacroMaxLat, setCustomMacroMaxLat] = useState<number>(54.0);
  const [customMacroMinLon, setCustomMacroMinLon] = useState<number>(73.0);
  const [customMacroMaxLon, setCustomMacroMaxLon] = useState<number>(135.0);

  // ==========================================
  // 3. 常用行政区独立状态
  // ==========================================
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_ADMIN_REGIONS[0].id);
  const [presetMinZoom, setPresetMinZoom] = useState<number>(10);
  const [presetMaxZoom, setPresetMaxZoom] = useState<number>(15);
  const [presetRegionName, setPresetRegionName] = useState<string>('');

  // ==========================================
  // 4. 自定义两顶点选区文件独立状态
  // ==========================================
  const [customBBox, setCustomBBox] = useState<{
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
    fileName?: string;
    description?: string;
  } | null>(null);
  const [customMinZoom, setCustomMinZoom] = useState<number>(11);
  const [customMaxZoom, setCustomMaxZoom] = useState<number>(16);
  const [customRegionName, setCustomRegionName] = useState<string>('自定义选区底图');
  const [customFileError, setCustomFileError] = useState<string | null>(null);
  const [showSampleHelp, setShowSampleHelp] = useState<boolean>(false);
  const [customInputMode, setCustomInputMode] = useState<'upload' | 'manual'>('upload');
  const [manualV1Lat, setManualV1Lat] = useState('39.780000');
  const [manualV1Lon, setManualV1Lon] = useState('116.450000');
  const [manualV2Lat, setManualV2Lat] = useState('39.920000');
  const [manualV2Lon, setManualV2Lon] = useState('116.620000');
  const [manualRegionTitle, setManualRegionTitle] = useState('自定义高精测区');

  const handleApplyManualVertices = () => {
    const v1Lat = parseFloat(manualV1Lat);
    const v1Lon = parseFloat(manualV1Lon);
    const v2Lat = parseFloat(manualV2Lat);
    const v2Lon = parseFloat(manualV2Lon);
    if (isNaN(v1Lat) || isNaN(v1Lon) || isNaN(v2Lat) || isNaN(v2Lon)) {
      setCustomFileError('请输入有效的两顶点经纬度数值');
      return;
    }
    const minLat = Math.min(v1Lat, v2Lat);
    const maxLat = Math.max(v1Lat, v2Lat);
    const minLon = Math.min(v1Lon, v2Lon);
    const maxLon = Math.max(v1Lon, v2Lon);

    setCustomBBox({
      minLat,
      minLon,
      maxLat,
      maxLon,
      fileName: `${manualRegionTitle}.txt`,
      description: manualRegionTitle,
    });
    setCustomRegionName(manualRegionTitle);
    setCustomFileError(null);
    soundService.playSuccess();
    setNotificationMsg(`已成功设定自定义对角选区：${manualRegionTitle}`);
  };

  // Download & storage state
  const [downloading, setDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ total: number; current: number; failed: number }>({
    total: 0,
    current: 0,
    failed: 0,
  });
  const [savedRegions, setSavedRegions] = useState<CacheRegionMeta[]>([]);
  const [activeTab, setActiveTab] = useState<'download' | 'manage'>('download');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const layerNameMap: Record<string, string> = {
    offline_grid: '脱离底图网格雷达',
    baidu_street: '百度地图标准街道',
    baidu_satellite: '百度高精卫星遥感',
    bing_satellite: '微软必应高精卫星',
    bing_road: '微软必应道路地图',
    gaode_street: '高德地图标准路网',
    gaode_satellite: '高德卫星遥感影像',
    tianditu_satellite: '天地图国家高精遥感',
    esri_satellite: 'ArcGIS全球高清卫星',
    street: 'CartoDB/OSM标准街道',
    terrain: '全球等高线地形图',
  };

  const loadSavedRegions = async () => {
    const list = await offlineMapTileService.getAllRegions();
    setSavedRegions(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedRegions();
      if (!surveyRegionName) {
        setSurveyRegionName(`测区_${effectiveCenterLat.toFixed(4)}_${effectiveCenterLon.toFixed(4)}`);
      }
      if (!presetRegionName) {
        const preset = PRESET_ADMIN_REGIONS.find((p) => p.id === selectedPresetId);
        setPresetRegionName(preset ? `${preset.name}_离线底图` : '行政区离线底图');
      }
    }
  }, [isOpen, effectiveCenterLat, effectiveCenterLon]);

  // Sync preset name when changed
  useEffect(() => {
    const p = PRESET_ADMIN_REGIONS.find((it) => it.id === selectedPresetId);
    if (p) {
      setPresetRegionName(`${p.name}_离线底图`);
    }
  }, [selectedPresetId]);

  // Sync world region name when scope or zoom changes
  useEffect(() => {
    if (worldScopeType === 'global') {
      setWorldRegionName(`世界全图概览_L${worldMinZoom}-L${worldMaxZoom}`);
    } else if (worldScopeType === 'china') {
      setWorldRegionName(`中国全境及邻近陆海_L${worldMinZoom}-L${worldMaxZoom}`);
    } else if (worldScopeType === 'asia') {
      setWorldRegionName(`亚洲与西太平洋_L${worldMinZoom}-L${worldMaxZoom}`);
    } else if (worldScopeType === 'local_macro') {
      setWorldRegionName(`作业省域大区300km_L${worldMinZoom}-L${worldMaxZoom}`);
    } else if (worldScopeType === 'custom') {
      setWorldRegionName(`自定义宏观区域_L${worldMinZoom}-L${worldMaxZoom}`);
    }
  }, [worldScopeType, worldMinZoom, worldMaxZoom]);

  // ==========================================================
  // Pure O(1) Memory Safe Active Configuration Calculation
  // Completely isolated by mode! Zero cross-contamination!
  // ==========================================================
  const activeConfig = useMemo(() => {
    if (scopeMode === 'world') {
      let bbox = { minLat: -75, minLon: -180, maxLat: 75, maxLon: 180 };
      let desc = '全球全图 (南纬75°~北纬75°, 西经180°~东经180°)';

      if (worldScopeType === 'china') {
        bbox = { minLat: 15, minLon: 70, maxLat: 55, maxLon: 140 };
        desc = '中国全境及邻近陆海 [15°N~55°N, 70°E~140°E]';
      } else if (worldScopeType === 'asia') {
        bbox = { minLat: -10, minLon: 60, maxLat: 55, maxLon: 150 };
        desc = '亚洲与西太平洋区域 [10°S~55°N, 60°E~150°E]';
      } else if (worldScopeType === 'local_macro') {
        const deltaLat = 300 / 111.0;
        const cosLat = Math.cos((effectiveCenterLat * Math.PI) / 180);
        const deltaLon = 300 / (111.0 * (Math.abs(cosLat) > 0.001 ? cosLat : 0.001));
        bbox = {
          minLat: Math.max(-85, effectiveCenterLat - deltaLat),
          minLon: Math.max(-180, effectiveCenterLon - deltaLon),
          maxLat: Math.min(85, effectiveCenterLat + deltaLat),
          maxLon: Math.min(180, effectiveCenterLon + deltaLon),
        };
        desc = `作业地300km宏观背景 [中心 B:${effectiveCenterLat.toFixed(3)}°, L:${effectiveCenterLon.toFixed(3)}°]`;
      } else if (worldScopeType === 'custom') {
        bbox = {
          minLat: Math.min(customMacroMinLat, customMacroMaxLat),
          minLon: Math.min(customMacroMinLon, customMacroMaxLon),
          maxLat: Math.max(customMacroMinLat, customMacroMaxLat),
          maxLon: Math.max(customMacroMinLon, customMacroMaxLon),
        };
        desc = `自定义宏观经纬度 [${bbox.minLat}°~${bbox.maxLat}°, ${bbox.minLon}°~${bbox.maxLon}°]`;
      }

      const count = offlineMapTileService.estimateTileCountForBBox(
        bbox.minLat,
        bbox.minLon,
        bbox.maxLat,
        bbox.maxLon,
        worldMinZoom,
        worldMaxZoom
      );

      return {
        bbox,
        minZoom: worldMinZoom,
        maxZoom: worldMaxZoom,
        desc,
        count,
        name: worldRegionName || '世界宏观底图',
        centerLat: (bbox.minLat + bbox.maxLat) / 2,
        centerLon: (bbox.minLon + bbox.maxLon) / 2,
        radiusKm: 0,
        isWorld: true,
      };
    }

    if (scopeMode === 'preset') {
      const p = PRESET_ADMIN_REGIONS.find((it) => it.id === selectedPresetId) || PRESET_ADMIN_REGIONS[0];
      const bbox = { minLat: p.minLat, minLon: p.minLon, maxLat: p.maxLat, maxLon: p.maxLon };
      const count = offlineMapTileService.estimateTileCountForBBox(
        p.minLat,
        p.minLon,
        p.maxLat,
        p.maxLon,
        presetMinZoom,
        presetMaxZoom
      );
      return {
        bbox,
        minZoom: presetMinZoom,
        maxZoom: presetMaxZoom,
        desc: `${p.name} [${p.minLat}°, ${p.minLon}° 至 ${p.maxLat}°, ${p.maxLon}°]`,
        count,
        name: presetRegionName || `${p.name}_离线底图`,
        centerLat: p.centerLat,
        centerLon: p.centerLon,
        radiusKm: 0,
        isWorld: false,
      };
    }

    if (scopeMode === 'custom_file') {
      if (!customBBox) {
        return {
          bbox: { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 },
          minZoom: customMinZoom,
          maxZoom: customMaxZoom,
          desc: '未加载选区文件，请上传两顶点选区文件 (.txt / .json)',
          count: 0,
          name: customRegionName || '自定义选区底图',
          centerLat: 0,
          centerLon: 0,
          radiusKm: 0,
          isWorld: false,
        };
      }
      const count = offlineMapTileService.estimateTileCountForBBox(
        customBBox.minLat,
        customBBox.minLon,
        customBBox.maxLat,
        customBBox.maxLon,
        customMinZoom,
        customMaxZoom
      );
      return {
        bbox: {
          minLat: customBBox.minLat,
          minLon: customBBox.minLon,
          maxLat: customBBox.maxLat,
          maxLon: customBBox.maxLon,
        },
        minZoom: customMinZoom,
        maxZoom: customMaxZoom,
        desc: `${customBBox.description || '自定义选区'} [${customBBox.minLat.toFixed(4)}°, ${customBBox.minLon.toFixed(4)}° 至 ${customBBox.maxLat.toFixed(4)}°, ${customBBox.maxLon.toFixed(4)}°]`,
        count,
        name: customRegionName || customBBox.description || '自定义选区底图',
        centerLat: (customBBox.minLat + customBBox.maxLat) / 2,
        centerLon: (customBBox.minLon + customBBox.maxLon) / 2,
        radiusKm: 0,
        isWorld: false,
      };
    }

    // Default: scopeMode === 'radius' (现场测区周边半径，完全脱钩)
    const latDelta = surveyRadiusKm / 111.0;
    const cosLat = Math.cos((effectiveCenterLat * Math.PI) / 180);
    const lonDelta = surveyRadiusKm / (111.0 * (Math.abs(cosLat) > 0.001 ? cosLat : 0.001));
    const bbox = {
      minLat: Math.max(-85, effectiveCenterLat - latDelta),
      minLon: Math.max(-180, effectiveCenterLon - lonDelta),
      maxLat: Math.min(85, effectiveCenterLat + latDelta),
      maxLon: Math.min(180, effectiveCenterLon + lonDelta),
    };
    const count = offlineMapTileService.estimateTileCountForBBox(
      bbox.minLat,
      bbox.minLon,
      bbox.maxLat,
      bbox.maxLon,
      surveyMinZoom,
      surveyMaxZoom
    );

    return {
      bbox,
      minZoom: surveyMinZoom,
      maxZoom: surveyMaxZoom,
      desc: `以 B:${effectiveCenterLat.toFixed(5)}°, L:${effectiveCenterLon.toFixed(5)}° 为中心, 半径 ${surveyRadiusKm}km`,
      count,
      name: surveyRegionName || `测区_${effectiveCenterLat.toFixed(4)}_${effectiveCenterLon.toFixed(4)}`,
      centerLat: effectiveCenterLat,
      centerLon: effectiveCenterLon,
      radiusKm: surveyRadiusKm,
      isWorld: false,
    };
  }, [
    scopeMode,
    surveyRadiusKm,
    surveyMinZoom,
    surveyMaxZoom,
    surveyRegionName,
    worldScopeType,
    worldMinZoom,
    worldMaxZoom,
    worldRegionName,
    customMacroMinLat,
    customMacroMaxLat,
    customMacroMinLon,
    customMacroMaxLon,
    selectedPresetId,
    presetMinZoom,
    presetMaxZoom,
    presetRegionName,
    customBBox,
    customMinZoom,
    customMaxZoom,
    customRegionName,
    effectiveCenterLat,
    effectiveCenterLon,
  ]);

  if (!isOpen) return null;

  const displayTileCount = activeConfig.count;
  const estimatedSizeMb = ((displayTileCount * 25) / 1024).toFixed(1);

  // Helper to fetch tile as blob with canvas fallback
  const fetchTileBlob = async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 100) return blob;
      }
    } catch {
      // fallback
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 256;
          canvas.height = img.naturalHeight || 256;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), 'image/png');
            return;
          }
        } catch {
          resolve(null);
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // Start tile download process
  const handleStartDownload = async () => {
    if (currentLayer === 'offline_grid') {
      alert('当前处于脱离底图网格模式，无需下载瓦片！请先切换至卫星遥感或矢量图层后再进行下载。');
      return;
    }

    if (displayTileCount === 0) {
      alert('当前选区范围内没有可下载的瓦片，请检查选区或缩放级设置。');
      return;
    }

    if (displayTileCount > 30000) {
      if (
        !confirm(
          `当前选区瓦片数量较多 (${displayTileCount.toLocaleString()} 张，预估 ~${estimatedSizeMb} MB)。\n建议在 Wi-Fi 网络下下载，是否继续？`
        )
      ) {
        return;
      }
    }

    soundService.playClick();
    setDownloading(true);

    // Compute concrete tile list with safety guard
    const tilesToDownload = offlineMapTileService.calculateTilesForBBox(
      activeConfig.bbox.minLat,
      activeConfig.bbox.minLon,
      activeConfig.bbox.maxLat,
      activeConfig.bbox.maxLon,
      activeConfig.minZoom,
      activeConfig.maxZoom
    );

    const total = tilesToDownload.length;
    let current = 0;
    let failed = 0;
    let totalSizeBytes = 0;

    setProgress({ total, current: 0, failed: 0 });

    // Concurrent chunk download (6 concurrent requests)
    const chunkSize = 6;
    for (let i = 0; i < tilesToDownload.length; i += chunkSize) {
      const chunk = tilesToDownload.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (tile) => {
          const tileKey = offlineMapTileService.getTileKey(currentLayer, tile.z, tile.x, tile.y);
          const url = getTileUrlFunction(currentLayer, tile.x, tile.y, tile.z);

          try {
            const blob = await fetchTileBlob(url);
            if (blob) {
              totalSizeBytes += blob.size;
              await offlineMapTileService.saveTileBlob(tileKey, blob);
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
          current++;
          setProgress({ total, current, failed });
        })
      );
    }

    const cleanRegionName = activeConfig.name.trim() || '未命名离线测区';

    // Save region metadata and mirror package manifest to /storage/emulated/0/com.rtkproject.files/mapdata/
    const newMeta: CacheRegionMeta = {
      id: 'region_' + Date.now(),
      name: cleanRegionName,
      layerId: currentLayer,
      layerName: layerNameMap[currentLayer] || currentLayer,
      centerLat: activeConfig.centerLat,
      centerLon: activeConfig.centerLon,
      radiusKm: activeConfig.radiusKm,
      minZoom: activeConfig.minZoom,
      maxZoom: activeConfig.maxZoom,
      tileCount: current - failed,
      sizeBytes: totalSizeBytes || Math.round((current - failed) * 25 * 1024),
      createdAt: Date.now(),
      scopeType: scopeMode,
      minLat: activeConfig.bbox.minLat,
      minLon: activeConfig.bbox.minLon,
      maxLat: activeConfig.bbox.maxLat,
      maxLon: activeConfig.bbox.maxLon,
    };

    await offlineMapTileService.saveRegionMeta(newMeta);
    await loadSavedRegions();

    soundService.playSuccess();
    setDownloading(false);
    setActiveTab('manage');
    setNotificationMsg(`已成功下载并缓存 ${newMeta.name}，清单文件已同步存入 com.rtkproject.files/mapdata 目录！`);
    setTimeout(() => setNotificationMsg(null), 6000);
  };

  const handleDeleteRegion = async (id: string, name: string) => {
    if (confirm(`确认删除测区 [${name}] 的离线缓存数据及 mapdata 目录中的数据包？`)) {
      soundService.playClick();
      await offlineMapTileService.deleteRegion(id, name);
      await loadSavedRegions();
    }
  };

  const handleClearAll = async () => {
    if (confirm('警告：将清空手机本地缓存的所有离线瓦片及 mapdata 离线地图清单，是否继续？')) {
      soundService.playClick();
      await offlineMapTileService.clearAllCache();
      await loadSavedRegions();
    }
  };

  // Export package to device
  const handleExportPackage = async (region: CacheRegionMeta) => {
    soundService.playClick();
    const pkg = {
      format: 'RTK_SURVEY_MAPDATA_PACKAGE_V1',
      regionId: region.id,
      regionName: region.name,
      layerId: region.layerId,
      layerName: region.layerName,
      tileCount: region.tileCount,
      sizeBytes: region.sizeBytes,
      scopeType: region.scopeType || 'radius',
      center: { lat: region.centerLat, lon: region.centerLon, radiusKm: region.radiusKm },
      bbox: { minLat: region.minLat, minLon: region.minLon, maxLat: region.maxLat, maxLon: region.maxLon },
      zoomRange: { minZoom: region.minZoom, maxZoom: region.maxZoom },
      createdAt: new Date(region.createdAt).toISOString(),
    };

    const content = JSON.stringify(pkg, null, 2);
    const filename = `${region.name}_offline_package.json`;

    // Save to com.rtkproject.files/mapdata/
    await fileStorageService.saveFile('mapdata', filename, content, 'application/json');

    // Also trigger browser/device download
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`已将选区清单包导出至: /storage/emulated/0/com.rtkproject.files/mapdata/${filename}`);
  };

  // Sample file downloads
  const [isPacking, setIsPacking] = useState<string | null>(null);
  const [importingTilepack, setImportingTilepack] = useState(false);
  const tilepackInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportTilePack = async (region: CacheRegionMeta) => {
    soundService.playClick();
    setIsPacking(region.id);
    try {
      const res = await offlineMapTileService.saveRealTilePackageToMapdata(region);
      const filename = res.filename;
      // Also download to browser
      const content = await fileStorageService.readFile('mapdata', filename);
      if (content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      soundService.playSuccess();
      alert(`✅ 已成功打包并保存 ${res.count} 张瓦片PNG数据至:\n/storage/emulated/0/com.rtkproject.files/mapdata/${filename}\n重装或换机后可直接一键导入，无需重新下载！`);
    } catch (e: any) {
      alert(`打包失败: ${e.message}`);
    } finally {
      setIsPacking(null);
    }
  };

  const handleTilepackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingTilepack(true);
    soundService.playClick();
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const res = await offlineMapTileService.importTileBundle(content);
          if (res.success) {
            soundService.playSuccess();
            await loadSavedRegions();
            alert(`✅ 导入成功！${res.message}`);
          } else {
            alert(`❌ 导入失败: ${res.message}`);
          }
        } catch (err: any) {
          alert(`解析瓦片包出错: ${err.message}`);
        } finally {
          setImportingTilepack(false);
          if (tilepackInputRef.current) tilepackInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } catch (e: any) {
      alert(`读取文件失败: ${e.message}`);
      setImportingTilepack(false);
    }
  };

  const handleDownloadSampleTxt = () => {
    soundService.playClick();
    const sampleTxt = `# =======================================================
# RTK外业工程测绘 - 自定义测区选区定义文件 (两顶点格式样例)
# 说明: 以井号(#)开头的行为注释行，解析时自动忽略
# 数据格式: 西南角纬度,西南角经度,东北角纬度,东北角经度[,测区名称]
# 坐标系: WGS-84 / CGCS2000 十进制度数 (南纬/西经为负值)
# =======================================================
39.780000,116.450000,39.920000,116.620000,北京亦庄高新科技测区
`;
    const blob = new Blob([sampleTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_bbox_vertices.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    fileStorageService.saveFile('mapdata', 'sample_bbox_vertices.txt', sampleTxt, 'text/plain').catch(() => {});
  };

  const handleDownloadSampleJson = () => {
    soundService.playClick();
    const sampleJson = {
      format: 'two_vertex_bbox',
      name: '北京亦庄高新科技测区',
      description: 'RTK高精工程选区 - 两对角顶点坐标定义',
      vertex1: {
        description: '西南角顶点 (SouthWest Corner)',
        lat: 39.780000,
        lon: 116.450000,
      },
      vertex2: {
        description: '东北角顶点 (NorthEast Corner)',
        lat: 39.920000,
        lon: 116.620000,
      },
      minZoom: 12,
      maxZoom: 16,
      author: 'RTK Engineering Survey Team',
      createdAt: new Date().toISOString(),
    };

    const content = JSON.stringify(sampleJson, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_bbox_vertices.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    fileStorageService.saveFile('mapdata', 'sample_bbox_vertices.json', content, 'application/json').catch(() => {});
  };

  // Custom file upload parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundService.playClick();
    setCustomFileError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        let minLat: number | null = null;
        let minLon: number | null = null;
        let maxLat: number | null = null;
        let maxLon: number | null = null;
        let regionTitle = file.name.replace(/\.[^/.]+$/, '');

        // 1. Try parsing JSON
        if (file.name.endsWith('.json') || text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          if (parsed.vertex1 && parsed.vertex2) {
            const v1 = parsed.vertex1;
            const v2 = parsed.vertex2;
            minLat = Math.min(Number(v1.lat), Number(v2.lat));
            maxLat = Math.max(Number(v1.lat), Number(v2.lat));
            minLon = Math.min(Number(v1.lon ?? v1.lng), Number(v2.lon ?? v2.lng));
            maxLon = Math.max(Number(v1.lon ?? v1.lng), Number(v2.lon ?? v2.lng));
          } else if (parsed.bbox && Array.isArray(parsed.bbox) && parsed.bbox.length >= 4) {
            const b = parsed.bbox;
            minLat = Math.min(Number(b[1]), Number(b[3]));
            maxLat = Math.max(Number(b[1]), Number(b[3]));
            minLon = Math.min(Number(b[0]), Number(b[2]));
            maxLon = Math.max(Number(b[0]), Number(b[2]));
          } else if (parsed.minLat !== undefined && parsed.maxLat !== undefined) {
            minLat = Number(parsed.minLat);
            maxLat = Number(parsed.maxLat);
            minLon = Number(parsed.minLon ?? parsed.minLng);
            maxLon = Number(parsed.maxLon ?? parsed.maxLng);
          }
          if (parsed.name) regionTitle = parsed.name;
        } else {
          // 2. Parse TXT / CSV line by line
          const lines = text.split('\n');
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) continue;

            const parts = line.split(/[,;\s\t]+/).map((s) => s.trim());
            if (parts.length >= 4) {
              const num1 = parseFloat(parts[0]);
              const num2 = parseFloat(parts[1]);
              const num3 = parseFloat(parts[2]);
              const num4 = parseFloat(parts[3]);

              if (!isNaN(num1) && !isNaN(num2) && !isNaN(num3) && !isNaN(num4)) {
                minLat = Math.min(num1, num3);
                maxLat = Math.max(num1, num3);
                minLon = Math.min(num2, num4);
                maxLon = Math.max(num2, num4);

                if (parts[4]) {
                  regionTitle = parts.slice(4).join(' ').trim();
                }
                break;
              }
            }
          }
        }

        if (
          minLat === null ||
          minLon === null ||
          maxLat === null ||
          maxLon === null ||
          isNaN(minLat) ||
          isNaN(minLon) ||
          isNaN(maxLat) ||
          isNaN(maxLon)
        ) {
          throw new Error('未在文件中识别到有效的两顶点对角线经纬度坐标，请参照格式样例文档。');
        }

        if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
          throw new Error('经纬度数值超出地球有效范围 (-90~90, -180~180)，请确认数据格式。');
        }

        setCustomBBox({
          minLat,
          minLon,
          maxLat,
          maxLon,
          fileName: file.name,
          description: regionTitle,
        });
        setCustomRegionName(regionTitle);
        setCustomFileError(null);

        await fileStorageService
          .saveFile('mapdata', file.name, text, file.type || 'text/plain')
          .catch((err) => console.warn('Save custom area file to mapdata error:', err));
      } catch (err: any) {
        setCustomFileError(err.message || '选区文件解析失败');
        setCustomBBox(null);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">地图离线下载与测区缓存管理</h2>
              <p className="text-[11px] text-slate-700">
                存储于 <span className="font-mono text-slate-900">com.rtkproject.files/mapdata</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={downloading}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification Banner */}
        {notificationMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notificationMsg}</span>
          </div>
        )}

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('download');
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'download'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            新建测区与概览下载
          </button>
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('manage');
            }}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'manage'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            已缓存区域 ({savedRegions.length})
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeTab === 'download' ? (
            <>
              {/* Current layer info banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-slate-700 block text-[11px]">当前离线下载底图图层</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {layerNameMap[currentLayer] || currentLayer}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-700 block text-[11px]">外业手持机底图存储目录</span>
                  <span className="font-mono font-medium text-blue-700 text-[11px]">.../mapdata/</span>
                </div>
              </div>

              {/* 4 Fully Decoupled Scope Modes (彻底脱钩的独立模式导航) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    下载模式与范围类型
                  </label>
                  <span className="text-[10px] text-blue-700 font-medium">
                    {scopeMode === 'world'
                      ? '🌐 宏观概览 (已与测区级别彻底脱钩)'
                      : scopeMode === 'radius'
                      ? '📍 现场工程高精测区'
                      : scopeMode === 'preset'
                      ? '🏛️ 行政工程区'
                      : '📐 自定义两顶点选区'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setScopeMode('radius');
                    }}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all cursor-pointer ${
                      scopeMode === 'radius'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-[11px] leading-tight">📍 测区半径</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">高精作业</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setScopeMode('world');
                    }}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all cursor-pointer ${
                      scopeMode === 'world'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold border border-indigo-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-[11px] leading-tight flex items-center justify-center gap-0.5">
                      <span>🌐 世界概览</span>
                    </div>
                    <div className="text-[9px] text-indigo-700 mt-0.5 font-bold">已脱钩/自定义</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setScopeMode('preset');
                    }}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all cursor-pointer ${
                      scopeMode === 'preset'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-[11px] leading-tight">🏛️ 行政区</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">5大工程区</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setScopeMode('custom_file');
                    }}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all cursor-pointer ${
                      scopeMode === 'custom_file'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-[11px] leading-tight">📐 自定义文件</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">两顶点格式</div>
                  </button>
                </div>
              </div>

              {/* =========================================================
                  PANEL 1: 现场测区周边半径 (0.5km ~ 10km, L12 ~ L18)
                  ========================================================= */}
              {scopeMode === 'radius' && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      测区作业半径覆盖
                    </span>
                    <span className="text-blue-600 font-bold font-mono">
                      半径 {surveyRadiusKm.toFixed(1)} km (覆盖 {(surveyRadiusKm * 2).toFixed(1)}km×{(surveyRadiusKm * 2).toFixed(1)}km)
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[0.5, 1.0, 2.0, 5.0, 10.0].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          soundService.playClick();
                          setSurveyRadiusKm(r);
                        }}
                        disabled={downloading}
                        className={`py-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                          surveyRadiusKm === r
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {r} km
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-700 pt-1">
                    <span>中心坐标: B:{effectiveCenterLat.toFixed(5)}°, L:{effectiveCenterLon.toFixed(5)}°</span>
                    <span className="text-slate-700">适用于现场放样与基建测绘</span>
                  </div>

                  {/* Survey Zoom Config */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        测区最小缩放级 (大视野)
                      </label>
                      <select
                        value={surveyMinZoom}
                        onChange={(e) => setSurveyMinZoom(Number(e.target.value))}
                        disabled={downloading}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[10, 11, 12, 13, 14].map((z) => (
                          <option key={z} value={z}>
                            Level {z} (全区概览)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        测区最大缩放级 (高精细度)
                      </label>
                      <select
                        value={surveyMaxZoom}
                        onChange={(e) => setSurveyMaxZoom(Number(e.target.value))}
                        disabled={downloading}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[14, 15, 16, 17, 18].map((z) => (
                          <option key={z} value={z}>
                            Level {z} {z >= 17 ? '(毫米超精细)' : '(清晰作业)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">测区名称</label>
                    <input
                      type="text"
                      value={surveyRegionName}
                      onChange={(e) => setSurveyRegionName(e.target.value)}
                      disabled={downloading}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="测区名称"
                    />
                  </div>
                </div>
              )}

              {/* =========================================================
                  PANEL 2: 世界与宏观区域概览 (彻底脱钩，支持自定义下载范围)
                  ========================================================= */}
              {scopeMode === 'world' && (
                <div className="space-y-3 bg-indigo-50/50 border border-indigo-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>世界与宏观区域底图 (已与测区级别彻底脱钩)</span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-300">
                      独立宏观 L{worldMinZoom}~L{worldMaxZoom} 级
                    </span>
                  </div>

                  {/* 1. 自定义下载范围选择器 (Define Download Range) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      定义下载范围:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          soundService.playClick();
                          setWorldScopeType('china');
                        }}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          worldScopeType === 'china'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[11px] font-bold">🇨🇳 中国全境及近海</div>
                        <div className={`text-[9px] mt-0.5 ${worldScopeType === 'china' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          推荐工程背景
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundService.playClick();
                          setWorldScopeType('global');
                        }}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          worldScopeType === 'global'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[11px] font-bold">🌐 全球全图</div>
                        <div className={`text-[9px] mt-0.5 ${worldScopeType === 'global' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          南北纬75°全覆盖
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundService.playClick();
                          setWorldScopeType('local_macro');
                        }}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          worldScopeType === 'local_macro'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[11px] font-bold">🗺️ 作业省域大区</div>
                        <div className={`text-[9px] mt-0.5 ${worldScopeType === 'local_macro' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          中心周边300km
                        </div>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          soundService.playClick();
                          setWorldScopeType('asia');
                        }}
                        className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                          worldScopeType === 'asia'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-[11px] font-bold">🌏 亚洲与西太平洋</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundService.playClick();
                          setWorldScopeType('custom');
                        }}
                        className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                          worldScopeType === 'custom'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-[11px] font-bold">⚙️ 手动输入经纬度范围</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. 手动经纬度微调（当选择自定义宏观范围时展开） */}
                  {worldScopeType === 'custom' && (
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-200 space-y-2">
                      <span className="font-bold text-slate-800 text-[11px] block">
                        自定义宏观经纬度边界 (WGS84十进制度数):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block">南纬 Min Lat (-75~85):</label>
                          <input
                            type="number"
                            step="0.5"
                            value={customMacroMinLat}
                            onChange={(e) => setCustomMacroMinLat(parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">北纬 Max Lat (-75~85):</label>
                          <input
                            type="number"
                            step="0.5"
                            value={customMacroMaxLat}
                            onChange={(e) => setCustomMacroMaxLat(parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">西经 Min Lon (-180~180):</label>
                          <input
                            type="number"
                            step="0.5"
                            value={customMacroMinLon}
                            onChange={(e) => setCustomMacroMinLon(parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">东经 Max Lon (-180~180):</label>
                          <input
                            type="number"
                            step="0.5"
                            value={customMacroMaxLon}
                            onChange={(e) => setCustomMacroMaxLon(parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. 独立宏观缩放级别档位 (安全 1~6 级，绝不触发内存溢出) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-800 font-bold">宏观概览级别 (独立 L1~L6):</span>
                      <span className="font-bold text-indigo-700 font-mono">
                        Level {worldMinZoom} ~ {worldMaxZoom}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { maxZ: 3, label: '极速 1-3级', tip: '洲际轮廓' },
                        { maxZ: 4, label: '轻量 1-4级', tip: '推荐标配' },
                        { maxZ: 5, label: '标准 1-5级', tip: '省市骨干' },
                        { maxZ: 6, label: '深度 1-6级', tip: '大区干道' },
                      ].map((item) => (
                        <button
                          key={item.maxZ}
                          type="button"
                          onClick={() => {
                            soundService.playClick();
                            setWorldMinZoom(1);
                            setWorldMaxZoom(item.maxZ);
                          }}
                          className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                            worldMaxZoom === item.maxZ
                              ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{item.label}</div>
                          <div className={`text-[9px] ${worldMaxZoom === item.maxZ ? 'text-indigo-100' : 'text-slate-500'}`}>
                            {item.tip}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">概览底图包命名</label>
                    <input
                      type="text"
                      value={worldRegionName}
                      onChange={(e) => setWorldRegionName(e.target.value)}
                      disabled={downloading}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="宏观底图包名称"
                    />
                  </div>

                  <p className="text-[11px] text-indigo-900 bg-indigo-100/60 border border-indigo-200 rounded-lg p-2 leading-relaxed">
                    ✨ <b>架构说明</b>: 世界宏观底图已与外业高精测区级别（12~18级）彻底解耦，采用专用安全算力计算，支持自主定义范围，可与局部高精测区瓦片无缝融合离线显示。
                  </p>
                </div>
              )}

              {/* =========================================================
                  PANEL 3: 常用工程行政区 (5 大工程区)
                  ========================================================= */}
              {scopeMode === 'preset' && (
                <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">常用测绘工程行政区</span>
                    <span className="text-emerald-700 font-bold">5 个精选重点工程区</span>
                  </div>

                  <div className="space-y-1.5">
                    {PRESET_ADMIN_REGIONS.map((region) => {
                      const isSelected = selectedPresetId === region.id;
                      return (
                        <div
                          key={region.id}
                          onClick={() => {
                            soundService.playClick();
                            setSelectedPresetId(region.id);
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50 border-blue-400 shadow-xs'
                              : 'bg-white border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{region.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {region.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 mt-0.5">{region.desc}</p>
                            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                              边界: [{region.minLat}°, {region.minLon}°] ~ [{region.maxLat}°, {region.maxLon}°]
                            </div>
                          </div>
                          <div className="shrink-0 ml-2">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Preset Zoom Config */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        行政区最小缩放级
                      </label>
                      <select
                        value={presetMinZoom}
                        onChange={(e) => setPresetMinZoom(Number(e.target.value))}
                        disabled={downloading}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[8, 9, 10, 11, 12].map((z) => (
                          <option key={z} value={z}>
                            Level {z} (大视野)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        行政区最大缩放级
                      </label>
                      <select
                        value={presetMaxZoom}
                        onChange={(e) => setPresetMaxZoom(Number(e.target.value))}
                        disabled={downloading}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[13, 14, 15, 16].map((z) => (
                          <option key={z} value={z}>
                            Level {z} (作业精细度)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">行政区底图包名称</label>
                    <input
                      type="text"
                      value={presetRegionName}
                      onChange={(e) => setPresetRegionName(e.target.value)}
                      disabled={downloading}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="行政区底图包名称"
                    />
                  </div>
                </div>
              )}

              {/* =========================================================
                  PANEL 4: 自定义两顶点选区文件 (TXT / JSON)
                  ========================================================= */}
              {scopeMode === 'custom_file' && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-slate-800">自定义两顶点选区文件</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSampleHelp(!showSampleHelp)}
                      className="text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{showSampleHelp ? '收起说明' : '格式说明与样例'}</span>
                    </button>
                  </div>

                  {/* Sample download */}
                  <div className="bg-white border border-blue-200 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">下载标准样例文档:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDownloadSampleTxt}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>两顶点TXT样例</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadSampleJson}
                          className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>标准JSON样例</span>
                        </button>
                      </div>
                    </div>

                    {showSampleHelp && (
                      <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
                        <div className="bg-slate-50 p-2 rounded-lg font-mono text-[10px] space-y-1">
                          <div className="text-slate-800 font-bold">● 格式1: 纯文本两顶点格式 (.txt / .csv)</div>
                          <div className="text-slate-500"># 西南角纬度,西南角经度,东北角纬度,东北角经度,测区名</div>
                          <div className="text-blue-700">39.780000,116.450000,39.920000,116.620000,北京亦庄高精测区</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg font-mono text-[10px] space-y-1">
                          <div className="text-slate-800 font-bold">● 格式2: JSON格式 (.json)</div>
                          <div className="text-slate-600">
                            {`{ "name": "测区A", "vertex1": { "lat": 39.78, "lon": 116.45 }, "vertex2": { "lat": 39.92, "lon": 116.62 } }`}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom File / Manual Mode Tabs */}
                  <div className="flex rounded-xl bg-slate-200/80 p-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playClick();
                        setCustomInputMode('upload');
                      }}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition ${
                        customInputMode === 'upload' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      <span>手机文件管理器选取</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playClick();
                        setCustomInputMode('manual');
                      }}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition ${
                        customInputMode === 'manual' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>直接输入两顶点坐标</span>
                    </button>
                  </div>

                  {customInputMode === 'upload' ? (
                    /* File Upload Trigger (100% Reliable Native Mobile Button) */
                    <div
                      onClick={() => {
                        soundService.playClick();
                        if (fileInputRef.current) {
                          fileInputRef.current.click();
                        }
                      }}
                      className="relative block border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/70 rounded-2xl p-4 text-center cursor-pointer transition-all shadow-2xs select-auto group"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="*/*,.txt,.json,.csv,.geojson,text/plain,application/json"
                        onChange={handleFileChange}
                        onClick={(e) => {
                          (e.target as HTMLInputElement).value = '';
                        }}
                        className="hidden"
                      />
                      <Upload className="w-7 h-7 mx-auto text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-slate-900 block text-xs">
                        {customBBox ? `已选选区文件: ${customBBox.description || customBBox.fileName}` : '选取对角两顶点文件 (.txt / .json / .csv)'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        自动镜像存入手持机目录 <span className="font-mono text-slate-700">com.rtkproject.files/mapdata</span>
                      </span>

                      {/* Prominent tactile action button for mobile touch screens */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundService.playClick();
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <FolderDown className="w-4 h-4" />
                          <span>点击打开手机文件选择器</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Manual Coordinate Inputs - Guarantees 100% usability even without file picker permissions */
                    <div className="bg-white border border-purple-200 rounded-2xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-900 flex items-center gap-1">
                          <PenTool className="w-3.5 h-3.5 text-purple-600" />
                          <span>输入两顶点对角经纬度 (WGS84 / CGCS2000)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setManualV1Lat('39.780000');
                            setManualV1Lon('116.450000');
                            setManualV2Lat('39.920000');
                            setManualV2Lon('116.620000');
                            setManualRegionTitle('北京亦庄高精测区');
                          }}
                          className="text-[10px] text-purple-700 hover:underline cursor-pointer"
                        >
                          填入标准样例
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-700 block">顶点1 (西南角)</span>
                          <input
                            type="text"
                            value={manualV1Lat}
                            onChange={(e) => setManualV1Lat(e.target.value)}
                            placeholder="纬度 Lat (如 39.78)"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                          <input
                            type="text"
                            value={manualV1Lon}
                            onChange={(e) => setManualV1Lon(e.target.value)}
                            placeholder="经度 Lon (如 116.45)"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-700 block">顶点2 (东北角)</span>
                          <input
                            type="text"
                            value={manualV2Lat}
                            onChange={(e) => setManualV2Lat(e.target.value)}
                            placeholder="纬度 Lat (如 39.92)"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                          <input
                            type="text"
                            value={manualV2Lon}
                            onChange={(e) => setManualV2Lon(e.target.value)}
                            placeholder="经度 Lon (如 116.62)"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={manualRegionTitle}
                          onChange={(e) => setManualRegionTitle(e.target.value)}
                          placeholder="测区名称"
                          className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={handleApplyManualVertices}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition whitespace-nowrap"
                        >
                          设定选区范围
                        </button>
                      </div>
                    </div>
                  )}

                  {customFileError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 text-rose-700 text-[11px]">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{customFileError}</span>
                    </div>
                  )}

                  {customBBox && (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          已成功加载自定义选区: {customBBox.description}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-mono">
                          {customBBox.fileName}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono text-[10px] bg-white/80 p-2 rounded-lg border border-emerald-200">
                        <div>
                          <span className="text-slate-700 font-sans font-bold">顶点1 (西南角):</span>
                          <br />
                          {customBBox.minLat.toFixed(6)}°, {customBBox.minLon.toFixed(6)}°
                        </div>
                        <div>
                          <span className="text-slate-700 font-sans font-bold">顶点2 (东北角):</span>
                          <br />
                          {customBBox.maxLat.toFixed(6)}°, {customBBox.maxLon.toFixed(6)}°
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom Zoom Config */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        最小缩放级
                      </label>
                      <select
                        value={customMinZoom}
                        onChange={(e) => setCustomMinZoom(Number(e.target.value))}
                        disabled={downloading}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[8, 9, 10, 11, 12, 13].map((z) => (
                          <option key={z} value={z}>
                            Level {z} (宏观)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        最大缩放级
                      </label>
                      <select
                        value={customMaxZoom}
                        onChange={(e) => setCustomMaxZoom(Number(e.target.value))}
                        disabled={downloading}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[13, 14, 15, 16, 17, 18].map((z) => (
                          <option key={z} value={z}>
                            Level {z} (精细度)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">选区底图包名称</label>
                    <input
                      type="text"
                      value={customRegionName}
                      onChange={(e) => setCustomRegionName(e.target.value)}
                      disabled={downloading}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="选区名称"
                    />
                  </div>
                </div>
              )}

              {/* Estimate Calculation Summary Card */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-slate-700 text-[11px]">预计瓦片数量</div>
                  <div className="text-lg font-bold text-blue-800 font-mono">
                    {displayTileCount.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-700">张</span>
                  </div>
                  <div className="text-[10px] text-slate-700 truncate max-w-[200px]" title={activeConfig.desc}>
                    {activeConfig.desc}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-700 text-[11px]">预估存储占用</div>
                  <div className="text-lg font-bold text-indigo-700 font-mono">
                    ~{estimatedSizeMb}{' '}
                    <span className="text-xs font-normal text-slate-700">MB</span>
                  </div>
                  <div className="text-[10px] text-slate-700">
                    缩放范围: L{activeConfig.minZoom} ~ L{activeConfig.maxZoom}
                  </div>
                </div>
              </div>

              {/* Progress Box while Downloading */}
              {downloading && (
                <div className="space-y-2 bg-blue-50 border border-blue-300 p-3 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-blue-900 font-medium">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      正在下载瓦片并存储至 mapdata...
                    </span>
                    <span className="font-mono">
                      {progress.current} / {progress.total} (
                      {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-200"
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {progress.failed > 0 && (
                    <div className="text-[11px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{progress.failed} 张瓦片因网络或源站防盗链跳过 (不影响离线浏览)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Start Button */}
              <button
                type="button"
                onClick={handleStartDownload}
                disabled={downloading || displayTileCount === 0}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition-all text-sm cursor-pointer ${
                  downloading || displayTileCount === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
                }`}
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在下载缓存 ({progress.current}/{progress.total})...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>开始下载离线底图并存入 mapdata</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* Tab 2: Manage Saved Regions */
            <div className="space-y-3">
              <input
                ref={tilepackInputRef}
                type="file"
                accept=".tilepack,.json"
                onChange={handleTilepackFileChange}
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                className="hidden"
              />

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>持久化瓦片包管理 (IndexedDB / PNG)</span>
                  </div>
                  <button
                    type="button"
                    disabled={importingTilepack}
                    onClick={() => tilepackInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold flex items-center gap-1 text-[11px] cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {importingTilepack ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>正在写入IndexedDB...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>从 mapdata 导入瓦片包</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed">
                  系统已升级为<b>直接保存 IndexedDB 数据与 PNG 瓦片包 (.tilepack)</b> 至手持机{' '}
                  <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-emerald-950">
                    /storage/emulated/0/com.rtkproject.files/mapdata/
                  </code>
                  。重装软件或不同设备间拷贝共享该文件夹后，可直接点击导入，无需联网反复下载！
                </p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">本地已保存离线底图包</span>
                <span className="text-slate-700 font-mono">
                  共计 {savedRegions.length} 个测区
                </span>
              </div>

              {savedRegions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <HardDrive className="w-8 h-8 mx-auto text-slate-400" />
                  <div className="font-bold text-slate-700">暂无离线底图缓存</div>
                  <div className="text-xs text-slate-700">
                    请在“新建测区与概览下载”中选择测区半径、常用行政区或世界概览进行离线缓存。
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedRegions.map((region) => (
                    <div
                      key={region.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            <span>{region.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-700 mt-0.5">
                            底图: <b className="text-slate-800">{region.layerName}</b> | 缩放级:{' '}
                            <b className="text-slate-800">L{region.minZoom}-L{region.maxZoom}</b>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
                            {region.tileCount} 瓦片
                          </span>
                          <div className="text-[10px] text-slate-700 mt-1 font-mono">
                            ~{(region.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-600 font-mono flex items-center justify-between border border-slate-100">
                        <span className="truncate">
                          存储文件: {region.name}_indexeddb_tiles.tilepack
                        </span>
                        <span className="text-slate-700 shrink-0 ml-2">
                          {new Date(region.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 flex-wrap">
                        <button
                          type="button"
                          disabled={isPacking === region.id}
                          onClick={() => handleExportTilePack(region)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 font-bold flex items-center gap-1 cursor-pointer text-[11px] disabled:opacity-50"
                        >
                          {isPacking === region.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>打包中...</span>
                            </>
                          ) : (
                            <>
                              <HardDrive className="w-3.5 h-3.5" />
                              <span>导出完整瓦片包(PNG)</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportPackage(region)}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <FolderDown className="w-3.5 h-3.5" />
                          <span>导出清单JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRegion(region.id, region.name)}
                          className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>清空全部已缓存底图与清单</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-700" />
            <span>本地离线瓦片引擎 (IndexedDB + Native Filesystem)</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
