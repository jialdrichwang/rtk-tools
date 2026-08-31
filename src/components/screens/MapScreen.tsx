import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import {
  Layers,
  Crosshair,
  Plus,
  Compass,
  Check,
  Target,
  Smartphone,
  Cpu,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface MapScreenProps {
  onBack?: () => void;
  onOpenStakeout?: () => void;
  onOpenMarkWaypoint?: () => void;
}

export type MapLayerType =
  | 'bing_satellite'
  | 'bing_road'
  | 'baidu_street'
  | 'gaode_street'
  | 'gaode_satellite'
  | 'esri_satellite'
  | 'street'
  | 'terrain';

function getBingQuadKey(x: number, y: number, z: number): string {
  let quadKey = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadKey += digit.toString();
  }
  return quadKey;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  onBack,
  onOpenStakeout,
  onOpenMarkWaypoint,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const receiverMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const tracksLayerRef = useRef<L.LayerGroup | null>(null);

  const { points, routes, tracks } = useSurveyData();
  const { rtkState, updatePosition, toggleGPSMode, fetchRealGPSPosition } = useRTK();

  const rtkStateRef = useRef(rtkState);
  useEffect(() => {
    rtkStateRef.current = rtkState;
  }, [rtkState]);

  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    const saved = localStorage.getItem('rtk_map_layer');
    return (saved as MapLayerType) || 'bing_satellite';
  });

  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    localStorage.setItem('rtk_map_layer', mapLayer);
  }, [mapLayer]);

  // Toast auto dismiss
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center: [rtkState.currentLat, rtkState.currentLon],
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Create Layer Groups
    pointsLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    tracksLayerRef.current = L.layerGroup().addTo(map);

    // Receiver Marker with direction cone
    const receiverIcon = L.divIcon({
      className: 'custom-rtk-marker',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 15px; height: 15px; background: #0284c7; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(2,132,199,0.8);"></div>
          <div id="receiver-heading-arrow" style="position: absolute; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 14px solid #ef4444; top: -9px; transform-origin: center 26px; transform: rotate(${rtkState.heading}deg);"></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    receiverMarkerRef.current = L.marker([rtkState.currentLat, rtkState.currentLon], {
      icon: receiverIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    accuracyCircleRef.current = L.circle([rtkState.currentLat, rtkState.currentLon], {
      radius: Math.max(0.3, rtkState.hrms * 20),
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.18,
      weight: 1.5,
    }).addTo(map);

    // Map click handler respecting user's mode
    map.on('click', (e) => {
      const currentState = rtkStateRef.current;
      if (currentState.mode === 'simulated') {
        soundService.playClick();
        updatePosition(e.latlng.lat, e.latlng.lng);
        setToastMsg(`[仿真模式] 已更新测站坐标至地图点击处 (E ${e.latlng.lng.toFixed(6)}°, N ${e.latlng.lat.toFixed(6)}°)`);
      } else {
        setToastMsg('当前为【真机GPS传感器】模式，由机内硬件持续锁定。如需在地图上点击取点，请切换为【高精仿真接收机】');
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer dynamically (Bing, Baidu, Gaode, ArcGIS, OSM, Terrain)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    let newTileLayer: L.TileLayer;

    if (mapLayer === 'bing_satellite') {
      const CustomBingAerial = L.TileLayer.extend({
        getTileUrl: function (coords: L.Coords) {
          const qk = getBingQuadKey(coords.x, coords.y, coords.z);
          const sub = Math.abs((coords.x + coords.y) % 4);
          return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${qk}.jpeg?g=1`;
        },
      });
      newTileLayer = new (CustomBingAerial as any)('', {
        maxZoom: 19,
        attribution: '© 微软 Bing Maps 卫星影像',
      });
    } else if (mapLayer === 'bing_road') {
      const CustomBingRoad = L.TileLayer.extend({
        getTileUrl: function (coords: L.Coords) {
          const qk = getBingQuadKey(coords.x, coords.y, coords.z);
          const sub = Math.abs((coords.x + coords.y) % 4);
          return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/r${qk}.jpeg?g=1&mkt=zh-cn`;
        },
      });
      newTileLayer = new (CustomBingRoad as any)('', {
        maxZoom: 19,
        attribution: '© 微软 Bing Maps 道路地图',
      });
    } else if (mapLayer === 'baidu_street') {
      const CustomBaidu = L.TileLayer.extend({
        getTileUrl: function (coords: L.Coords) {
          const sub = Math.abs((coords.x + coords.y) % 4);
          return `https://maponline${sub}.bdimg.com/tile/?qt=vtile&x=${coords.x}&y=${coords.y}&z=${coords.z}&styles=pl&scaler=1&udt=20230519`;
        },
      });
      newTileLayer = new (CustomBaidu as any)('', {
        maxZoom: 18,
        attribution: '© 百度地图 Baidu Maps',
      });
    } else if (mapLayer === 'gaode_street') {
      newTileLayer = L.tileLayer(
        'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        {
          subdomains: ['1', '2', '3', '4'],
          maxZoom: 19,
          attribution: '© 高德地图 AutoNavi',
        }
      );
    } else if (mapLayer === 'gaode_satellite') {
      newTileLayer = L.tileLayer(
        'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        {
          subdomains: ['1', '2', '3', '4'],
          maxZoom: 19,
          attribution: '© 高德卫星影像 AutoNavi',
        }
      );
    } else if (mapLayer === 'esri_satellite') {
      newTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '© Esri ArcGIS World Imagery',
        }
      );
    } else if (mapLayer === 'street') {
      newTileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '© CartoDB / OSM',
        }
      );
    } else {
      newTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '© Esri World Topo',
        }
      );
    }

    newTileLayer.addTo(map);
    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  }, [mapLayer]);

  // Update receiver marker position & heading
  useEffect(() => {
    if (receiverMarkerRef.current && mapInstanceRef.current) {
      receiverMarkerRef.current.setLatLng([rtkState.currentLat, rtkState.currentLon]);
      const arrow = document.getElementById('receiver-heading-arrow');
      if (arrow) {
        arrow.style.transform = `rotate(${rtkState.heading}deg)`;
      }
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([rtkState.currentLat, rtkState.currentLon]);
      accuracyCircleRef.current.setRadius(Math.max(0.3, rtkState.hrms * 25));
    }
  }, [rtkState.currentLat, rtkState.currentLon, rtkState.heading, rtkState.hrms]);

  // Render Survey Points on Map
  useEffect(() => {
    if (!pointsLayerRef.current) return;
    pointsLayerRef.current.clearLayers();

    points.forEach((pt) => {
      const pinColor = pt.color || '#2563eb';
      const pointIcon = L.divIcon({
        className: 'custom-survey-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: rgba(15,23,42,0.9); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap; border: 1px solid ${pinColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
              ${pt.name}
            </div>
            <div style="width: 12px; height: 12px; background: ${pinColor}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 6px ${pinColor}; margin-top: 2px;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([pt.lat, pt.lon], { icon: pointIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #1e293b; min-width: 170px;">
          <div style="font-weight: bold; font-size: 13px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 4px;">
            ${pt.name} (${pt.code || '无编码'})
          </div>
          <div>北坐标 X: <b>${pt.x.toFixed(3)}</b> m</div>
          <div>东坐标 Y: <b>${pt.y.toFixed(3)}</b> m</div>
          <div>高程 H: <b>${pt.elevation.toFixed(3)}</b> m</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${pt.desc || '工程测点'}</div>
        </div>
      `);

      pointsLayerRef.current?.addLayer(marker);
    });
  }, [points]);

  // Render Routes and Tracks
  useEffect(() => {
    if (!routesLayerRef.current) return;
    routesLayerRef.current.clearLayers();

    routes.forEach((rt) => {
      const ptList = rt.pointIds
        .map((pid) => points.find((p) => p.id === pid))
        .filter((p): p is typeof points[0] => !!p);

      if (ptList.length >= 2) {
        const latlngs: [number, number][] = ptList.map((p) => [p.lat, p.lon]);
        const polyline = L.polyline(latlngs, {
          color: rt.color || '#f97316',
          weight: 4,
          dashArray: '6, 6',
          opacity: 0.85,
        });
        routesLayerRef.current?.addLayer(polyline);
      }
    });

    if (!tracksLayerRef.current) return;
    tracksLayerRef.current.clearLayers();

    tracks.forEach((tk) => {
      if (tk.points.length >= 2) {
        const latlngs: [number, number][] = tk.points.map((p) => [p.lat, p.lon]);
        const polyline = L.polyline(latlngs, {
          color: tk.color || '#0284c7',
          weight: 3,
          opacity: 0.9,
        });
        tracksLayerRef.current?.addLayer(polyline);
      }
    });
  }, [routes, tracks, points]);

  // Re-center on receiver / real GPS locate
  const handleRecenterOrLocate = async () => {
    soundService.playClick();
    if (rtkState.mode === 'real_gps') {
      setIsLocating(true);
      await fetchRealGPSPosition(true);
      setIsLocating(false);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([rtkState.currentLat, rtkState.currentLon], 19, {
        duration: 0.8,
      });
    }
  };

  const handleToggleMode = async () => {
    soundService.playClick();
    if (rtkState.mode === 'simulated') {
      setIsLocating(true);
      const success = await fetchRealGPSPosition(true);
      setIsLocating(false);
      if (success) {
        setToastMsg('已切换至【真机GPS传感器】模式，正在持续跟踪机内硬件定位');
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([rtkState.currentLat, rtkState.currentLon], 19);
        }
      } else {
        setToastMsg(rtkState.realGpsMessage || '获取真机GPS失败，请检查手机/平板定位权限');
      }
    } else {
      toggleGPSMode('simulated');
      setToastMsg('已切换至【高精仿真接收机】模式，可在地图上任意点击设点');
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const layerOptions: { id: MapLayerType; name: string; brand: string; tag: string }[] = [
    { id: 'bing_satellite', name: '必应高精卫星图', brand: 'Microsoft Bing', tag: '卫星' },
    { id: 'bing_road', name: '必应电子道路图', brand: 'Microsoft Bing', tag: '矢量' },
    { id: 'baidu_street', name: '百度地图矢量', brand: 'Baidu Maps', tag: '中国' },
    { id: 'gaode_street', name: '高德地图路网', brand: 'AutoNavi', tag: '矢量' },
    { id: 'gaode_satellite', name: '高德卫星影像', brand: 'AutoNavi', tag: '卫星' },
    { id: 'esri_satellite', name: 'ArcGIS全球卫星', brand: 'Esri Satellite', tag: '高清' },
    { id: 'street', name: 'OSM/Carto标准街道', brand: 'CartoDB/OSM', tag: '全球' },
    { id: 'terrain', name: '全球等高线地形', brand: 'ArcGIS Topo', tag: '等高' },
  ];

  const currentLayerInfo = layerOptions.find((l) => l.id === mapLayer) || layerOptions[0];

  return (
    <div className="flex-1 flex flex-col relative w-full h-full bg-slate-900 overflow-hidden select-none">
      {/* Top Coordinate & Sensor HUD Banner */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 px-3 py-2 flex items-center justify-between z-10 shadow-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
          <div>
            <span className="text-slate-500 mr-1 font-sans">E:</span>
            <span className="text-slate-900 font-bold">{rtkState.currentLon.toFixed(7)}°</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1 font-sans">N:</span>
            <span className="text-slate-900 font-bold">{rtkState.currentLat.toFixed(7)}°</span>
          </div>
          <div className="bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-emerald-700 font-medium">
            <span>H: {rtkState.hrms.toFixed(3)}m V: {rtkState.vrms.toFixed(3)}m</span>
          </div>
        </div>

        {/* GPS Sensor Mode Quick Toggle & Locate */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMode}
            id="btn-quick-gps-mode-toggle"
            title={rtkState.mode === 'real_gps' ? '当前为真机GPS传感器，点击切为仿真' : '当前为仿真模式，点击切换为真机GPS'}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs ${
              rtkState.mode === 'real_gps'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {isLocating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : rtkState.mode === 'real_gps' ? (
              <Smartphone className="w-3.5 h-3.5" />
            ) : (
              <Cpu className="w-3.5 h-3.5" />
            )}
            <span>{rtkState.mode === 'real_gps' ? '真机GPS' : '高精仿真'}</span>
          </button>

          <button
            onClick={handleRecenterOrLocate}
            id="btn-map-locate"
            title="居中定位到测站位置"
            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Mode Guidance Toast Banner */}
      {toastMsg && (
        <div className="absolute top-13 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-3.5 py-2 rounded-xl shadow-lg border border-slate-700/80 z-30 max-w-sm w-[90%] text-center backdrop-blur-md transition-all flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full relative z-0" />

      {/* Floating Right Map Controls (Layer switch, Zoom, Compass, Stakeout) */}
      <div className="absolute top-14 right-3 flex flex-col gap-2 z-10">
        {/* Compass widget */}
        <div
          title={`航向: ${Math.round(rtkState.heading)}°`}
          className="w-10 h-10 rounded-full bg-white/95 border border-slate-200 backdrop-blur-md flex items-center justify-center text-slate-800 shadow-md"
        >
          <Compass
            className="w-6 h-6 text-rose-500 transition-transform duration-200"
            style={{ transform: `rotate(${rtkState.heading}deg)` }}
          />
        </div>

        {/* Layer Selector */}
        <div className="relative">
          <button
            onClick={() => {
              soundService.playClick();
              setShowLayerPicker((prev) => !prev);
            }}
            id="btn-map-layer-toggle"
            title="切换底图图层 (微软必应/百度/高德/ArcGIS/OSM)"
            className="w-10 h-10 rounded-lg bg-white/95 border border-slate-200 hover:border-blue-400 backdrop-blur-md flex items-center justify-center text-slate-700 shadow-md cursor-pointer"
          >
            <Layers className="w-5 h-5 text-blue-600" />
          </button>

          {/* Layer Picker Dropdown */}
          {showLayerPicker && (
            <div className="absolute right-12 top-0 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 min-w-[200px] space-y-1.5 z-30">
              <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100">
                底图数据源选择
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
                {layerOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      soundService.playClick();
                      setMapLayer(opt.id);
                      setShowLayerPicker(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs transition cursor-pointer flex items-center justify-between ${
                      mapLayer === opt.id
                        ? 'bg-blue-50 text-blue-800 border border-blue-200 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{opt.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{opt.brand}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                        {opt.tag}
                      </span>
                      {mapLayer === opt.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Stakeout Shortcut */}
        {onOpenStakeout && (
          <button
            onClick={() => {
              soundService.playClick();
              onOpenStakeout();
            }}
            title="点位放样"
            className="w-10 h-10 rounded-lg bg-white/95 border border-slate-200 hover:border-rose-400 backdrop-blur-md flex items-center justify-center text-rose-600 shadow-md cursor-pointer"
          >
            <Target className="w-5 h-5" />
          </button>
        )}

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          id="btn-map-zoom-in"
          className="w-10 h-10 rounded-lg bg-white/95 border border-slate-200 hover:border-blue-400 backdrop-blur-md flex items-center justify-center text-xl font-bold text-slate-700 shadow-md cursor-pointer active:scale-95"
        >
          +
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          id="btn-map-zoom-out"
          className="w-10 h-10 rounded-lg bg-white/95 border border-slate-200 hover:border-blue-400 backdrop-blur-md flex items-center justify-center text-xl font-bold text-slate-700 shadow-md cursor-pointer active:scale-95"
        >
          -
        </button>
      </div>

      {/* Floating Bottom Quick Mark Button (+) */}
      {onOpenMarkWaypoint && (
        <div className="absolute bottom-5 inset-x-0 flex items-center justify-center pointer-events-none z-10">
          <button
            onClick={() => {
              soundService.playClick();
              onOpenMarkWaypoint();
            }}
            id="btn-map-quick-mark"
            title="标定采集当前点位"
            className="pointer-events-auto w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 border-2 border-white transition active:scale-90 cursor-pointer"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>
      )}

        {/* Bottom Mode & Layer Info Bar */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-700 pointer-events-none z-10 shadow-xs flex items-center gap-2">
          <span className="font-bold text-blue-600">{currentLayerInfo.name}</span>
          <span className="text-slate-300">|</span>
          <span className={rtkState.mode === 'real_gps' ? 'text-emerald-700 font-bold font-sans flex items-center gap-1' : 'text-amber-700 font-medium font-sans'}>
            {rtkState.mode === 'real_gps' ? `🛰️ 真机 ${(rtkState.realGpsFrequencyHz || 4.0).toFixed(1)}Hz 锁定` : '🕹️ 点击地图取点'}
          </span>
          <span className="text-slate-300">|</span>
          <span>标定: <b className="text-slate-900">{points.length}</b> 点</span>
        </div>
    </div>
  );
};
