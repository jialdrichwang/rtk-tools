import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Layers,
  Crosshair,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Navigation,
  Check,
  Compass,
  MapPin,
  Activity,
  Gauge,
  Satellite,
  Radio,
  Route,
} from 'lucide-react';
import { TrackPoint, SurveyTrack } from '../../types';
import { MapLayerType, getMapTileUrl } from '../../utils/mapTileUrls';
import { transformWgs84ToLayer } from '../../utils/geodesy';
import { offlineMapTileService } from '../../utils/offlineMapTileService';
import { soundService } from '../../utils/sound';

export const MAP_LAYER_OPTIONS: {
  id: MapLayerType;
  name: string;
  category: string;
  desc: string;
}[] = [
  { id: 'bing_satellite', name: '微软必应卫星', category: '卫星影像', desc: '高分辨率实景影像' },
  { id: 'gaode_street', name: '高德矢量路网', category: '标准街道', desc: '国内最新道路与地名' },
  { id: 'gaode_satellite', name: '高德卫星影像', category: '卫星影像', desc: '高德遥感实景' },
  { id: 'tianditu_satellite', name: '国家天地图', category: '卫星影像', desc: '国家地理测绘公共底图' },
  { id: 'esri_satellite', name: 'ArcGIS 卫星', category: '卫星影像', desc: 'Esri 全球实景遥感' },
  { id: 'street', name: 'Carto 街道图', category: '标准街道', desc: '清爽矢量测绘道路' },
  { id: 'terrain', name: '等高线地形图', category: '地形等高', desc: '高程与地貌轮廓' },
  { id: 'offline_grid', name: '测绘工程网格', category: '工程底图', desc: '暗黑无图层坐标网格' },
];

// Reusable Cached TileLayer supporting com.rtkproject.files/mapdata/ and offline tile cache
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords: L.Coords, done: (error: Error | null, tile: HTMLImageElement) => void) {
    const tile = document.createElement('img');
    const layerId = this.options.layerId || 'bing_satellite';

    L.DomEvent.on(tile, 'load', L.Util.bind((this as any)._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.Util.bind((this as any)._tileOnError, this, done, tile));

    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }

    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    offlineMapTileService.getMapDataTileUrl(layerId, coords.z, coords.x, coords.y).then((localTileUrl) => {
      if (localTileUrl) {
        tile.src = localTileUrl;
      } else {
        const netUrl = this.getTileUrl(coords);
        tile.src = netUrl;

        fetch(netUrl, { mode: 'cors' })
          .then((res) => (res.ok ? res.blob() : null))
          .then((blob) => {
            if (blob && blob.size > 100) {
              offlineMapTileService.cacheBrowsedTile(layerId, coords.z, coords.x, coords.y, blob);
            }
          })
          .catch(() => {});
      }
    }).catch(() => {
      tile.src = this.getTileUrl(coords);
    });

    return tile;
  },
});

interface TrackRecordingMapProps {
  currentLat: number;
  currentLon: number;
  currentAlt: number;
  heading: number;
  speed: number;
  hrms: number;
  solutionType?: string;
  isRecording: boolean;
  recordedPoints: TrackPoint[];
  recordedDistance: number;
  recordingSeconds: number;
  allTracks?: SurveyTrack[];
  focusedTrack?: SurveyTrack | null;
  expanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

export const TrackRecordingMap: React.FC<TrackRecordingMapProps> = ({
  currentLat,
  currentLon,
  currentAlt,
  heading,
  speed,
  hrms,
  solutionType = 'RTK_FIXED',
  isRecording,
  recordedPoints,
  recordedDistance,
  recordingSeconds,
  allTracks = [],
  focusedTrack = null,
  expanded = false,
  onToggleExpand,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const receiverMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const liveTrackLayerRef = useRef<L.LayerGroup | null>(null);
  const historicalTracksLayerRef = useRef<L.LayerGroup | null>(null);

  // Map layer selection with local storage persistence
  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    const saved = localStorage.getItem('rtk_map_layer');
    return (saved as MapLayerType) || 'bing_satellite';
  });

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showHistoryTracks, setShowHistoryTracks] = useState(true);
  const [isFollowMode, setIsFollowMode] = useState(true);

  // Coordinate offset transformer based on active map layer
  const getDisplayLatLng = (lat: number, lon: number): [number, number] => {
    const transformed = transformWgs84ToLayer(lat, lon, mapLayer);
    return [transformed.lat, transformed.lon];
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const initPos = getDisplayLatLng(currentLat, currentLon);

    const map = L.map(mapContainerRef.current, {
      center: initPos,
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Create Layers
    historicalTracksLayerRef.current = L.layerGroup().addTo(map);
    liveTrackLayerRef.current = L.layerGroup().addTo(map);

    // Live Receiver Marker with heading arrow
    const receiverIcon = L.divIcon({
      className: 'custom-track-receiver',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 16px; height: 16px; background: #0284c7; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(2,132,199,0.9);"></div>
          <div id="track-receiver-heading-arrow" style="position: absolute; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 14px solid #ef4444; top: -9px; transform-origin: center 26px; transform: rotate(${heading}deg);"></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    receiverMarkerRef.current = L.marker(initPos, {
      icon: receiverIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    accuracyCircleRef.current = L.circle(initPos, {
      radius: Math.max(0.3, hrms * 20),
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.15,
      weight: 1.5,
    }).addTo(map);

    // Disable auto follow if user manually drags map
    map.on('dragstart', () => {
      setIsFollowMode(false);
    });

    // Invalidate size after layout mounts
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Manage Tile Layer Switching
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    if (mapLayer === 'offline_grid') {
      if (mapContainerRef.current) {
        mapContainerRef.current.style.backgroundColor = '#0f172a';
        mapContainerRef.current.style.backgroundImage =
          'radial-gradient(rgba(56, 189, 248, 0.25) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)';
        mapContainerRef.current.style.backgroundSize = '20px 20px, 40px 40px, 40px 40px';
      }
      return;
    }

    if (mapContainerRef.current) {
      mapContainerRef.current.style.backgroundImage = 'none';
      mapContainerRef.current.style.backgroundColor = '#f1f5f9';
    }

    const CustomLayer = CachedTileLayer.extend({
      getTileUrl: function (coords: L.Coords) {
        return getMapTileUrl(mapLayer, coords.x, coords.y, coords.z);
      },
    });

    const newLayer = new (CustomLayer as any)('', {
      layerId: mapLayer,
      maxZoom: 19,
      minZoom: 3,
    });

    newLayer.addTo(map);
    newLayer.bringToBack();
    tileLayerRef.current = newLayer;

    // Save selection
    localStorage.setItem('rtk_map_layer', mapLayer);
  }, [mapLayer]);

  // 3. Update Receiver Position & Heading
  useEffect(() => {
    const displayPos = getDisplayLatLng(currentLat, currentLon);
    if (receiverMarkerRef.current) {
      receiverMarkerRef.current.setLatLng(displayPos);
      const arrow = document.getElementById('track-receiver-heading-arrow');
      if (arrow) {
        arrow.style.transform = `rotate(${heading}deg)`;
      }
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng(displayPos);
      accuracyCircleRef.current.setRadius(Math.max(0.3, hrms * 20));
    }

    if (isFollowMode && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(displayPos, { animate: true, duration: 0.3 });
    }
  }, [currentLat, currentLon, heading, hrms, isFollowMode, mapLayer]);

  // 4. Render Active Live Track (Real-time Polyline + Start Pin + Breadcrumbs)
  useEffect(() => {
    if (!liveTrackLayerRef.current) return;
    liveTrackLayerRef.current.clearLayers();

    // Render active recording points
    if (recordedPoints.length >= 1) {
      const latlngs: [number, number][] = recordedPoints.map((pt) =>
        getDisplayLatLng(pt.lat, pt.lon)
      );

      // Start Point Marker
      const startPt = recordedPoints[0];
      const startDisplayPos = getDisplayLatLng(startPt.lat, startPt.lon);
      const startIcon = L.divIcon({
        className: 'track-start-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 900; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.4); border: 1px solid white;">
              🚩 起点
            </div>
            <div style="width: 8px; height: 8px; background: #10b981; border: 1.5px solid white; border-radius: 50%; margin-top: 1px;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
      const startMarker = L.marker(startDisplayPos, { icon: startIcon });
      startMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; color: #1e293b;">
          <b style="color: #059669;">航迹起点</b><br/>
          时间: ${startPt.time || 'N/A'}<br/>
          坐标: E ${startPt.lon.toFixed(6)}°, N ${startPt.lat.toFixed(6)}°<br/>
          高程: ${startPt.elevation?.toFixed(2) || 0}m
        </div>
      `);
      liveTrackLayerRef.current.addLayer(startMarker);

      // Main Track Polyline (with outer glow effect)
      if (latlngs.length >= 2) {
        // Outer halo
        const haloPolyline = L.polyline(latlngs, {
          color: '#ffffff',
          weight: 6,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        });
        liveTrackLayerRef.current.addLayer(haloPolyline);

        // Core vivid line
        const corePolyline = L.polyline(latlngs, {
          color: isRecording ? '#0284c7' : '#f59e0b',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });
        liveTrackLayerRef.current.addLayer(corePolyline);
      }
    }
  }, [recordedPoints, isRecording, mapLayer]);

  // 5. Render Historical / Other Project Tracks
  useEffect(() => {
    if (!historicalTracksLayerRef.current) return;
    historicalTracksLayerRef.current.clearLayers();

    if (!showHistoryTracks && !focusedTrack) return;

    const tracksToRender = focusedTrack ? [focusedTrack] : allTracks;

    tracksToRender.forEach((tk) => {
      if (tk.points && tk.points.length >= 2) {
        const latlngs: [number, number][] = tk.points.map((p) =>
          getDisplayLatLng(p.lat, p.lon)
        );

        const isHighlighted = focusedTrack?.id === tk.id;
        const color = isHighlighted ? '#ec4899' : tk.color || '#64748b';

        const polyline = L.polyline(latlngs, {
          color,
          weight: isHighlighted ? 4 : 2.5,
          opacity: isHighlighted ? 0.95 : 0.6,
          dashArray: isHighlighted ? undefined : '5, 5',
        });

        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; color: #1e293b; min-width: 140px;">
            <b style="font-size: 12px; color: #0284c7;">${tk.name}</b>
            <div style="margin-top: 3px;">点数: <b>${tk.points.length}</b> 点</div>
            <div>航程: <b>${tk.distance ? tk.distance.toFixed(1) : 0} m</b></div>
            <div>创建: {tk.startTime || 'N/A'}</div>
          </div>
        `);

        historicalTracksLayerRef.current?.addLayer(polyline);
      }
    });
  }, [allTracks, focusedTrack, showHistoryTracks, mapLayer]);

  // Handle Fit Track Bounds
  const handleFitTrackBounds = () => {
    soundService.playClick();
    const map = mapInstanceRef.current;
    if (!map) return;

    let pointsToFit: TrackPoint[] = [];

    if (recordedPoints.length >= 2) {
      pointsToFit = recordedPoints;
    } else if (focusedTrack && focusedTrack.points.length >= 2) {
      pointsToFit = focusedTrack.points;
    } else if (allTracks.length > 0) {
      const withPoints = allTracks.find((t) => t.points.length >= 2);
      if (withPoints) pointsToFit = withPoints.points;
    }

    if (pointsToFit.length >= 2) {
      const latlngs = pointsToFit.map((p) => getDisplayLatLng(p.lat, p.lon));
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
      setIsFollowMode(false);
    } else {
      // Zoom to current receiver
      const pos = getDisplayLatLng(currentLat, currentLon);
      map.setView(pos, 19);
    }
  };

  // Center on Receiver
  const handleCenterOnReceiver = () => {
    soundService.playClick();
    const map = mapInstanceRef.current;
    if (!map) return;
    const pos = getDisplayLatLng(currentLat, currentLon);
    map.flyTo(pos, 19, { duration: 0.6 });
    setIsFollowMode(true);
  };

  // Zoom Controls
  const handleZoomIn = () => {
    soundService.playClick();
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    soundService.playClick();
    mapInstanceRef.current?.zoomOut();
  };

  // Format Duration helper
  const formatSecs = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentLayerName =
    MAP_LAYER_OPTIONS.find((l) => l.id === mapLayer)?.name || '微软必应卫星';

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900 transition-all duration-300 ${
        expanded ? 'h-[65vh] sm:h-[72vh]' : 'h-64 sm:h-80'
      } ${className}`}
    >
      {/* 1. Underlying Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* 2. Top-Left Live Recording Status & Telemetry HUD */}
      <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex flex-col gap-1.5 max-w-[70%]">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/70 rounded-xl px-2.5 py-1.5 shadow-lg text-white font-mono flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isRecording ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
            }`}
          />
          <div className="flex flex-col text-[11px] leading-tight">
            <span className="font-bold font-sans text-xs text-slate-100 flex items-center gap-1">
              {isRecording ? '实时航迹录制中' : '航迹地图监控'}
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40">
                {currentLayerName}
              </span>
            </span>
            <span className="text-slate-300 text-[10px] flex items-center gap-2 pt-0.5">
              <span>⏱️ {formatSecs(recordingSeconds)}</span>
              <span>📍 {recordedPoints.length} 点</span>
              <span>
                📏{' '}
                {recordedDistance > 1000
                  ? `${(recordedDistance / 1000).toFixed(2)} km`
                  : `${recordedDistance.toFixed(1)} m`}
              </span>
            </span>
          </div>
        </div>

        {/* Speed & RTK Solution Badge */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 rounded-lg px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1 shadow-xs">
            <Gauge className="w-3 h-3 text-emerald-400" />
            <span>{(speed * 3.6).toFixed(1)} km/h</span>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 rounded-lg px-2 py-0.5 text-[10px] font-mono text-blue-300 font-bold flex items-center gap-1 shadow-xs">
            <Radio className="w-3 h-3 text-blue-400" />
            <span>{solutionType}</span>
          </div>
        </div>
      </div>

      {/* 3. Top-Right Map Controls Group */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5 items-end">
        {/* Layer Selector Trigger Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setShowLayerMenu(!showLayerMenu);
            }}
            id="btn-track-map-layer"
            className="w-8 h-8 rounded-xl bg-white/95 hover:bg-white text-slate-800 shadow-md border border-slate-200 flex items-center justify-center cursor-pointer transition active:scale-95"
            title="切换地图图层 (卫星/路网/天地图)"
          >
            <Layers className="w-4 h-4 text-blue-600" />
          </button>

          {/* Layer Selection Dropdown Menu */}
          {showLayerMenu && (
            <div className="absolute right-0 top-9.5 w-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-2 z-50 text-xs">
              <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>底图图层支持</span>
                </span>
                <span className="text-[10px] text-slate-400">8款测绘底图</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 p-0.5">
                {MAP_LAYER_OPTIONS.map((layer) => {
                  const isSelected = mapLayer === layer.id;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => {
                        soundService.playClick();
                        setMapLayer(layer.id);
                        setShowLayerMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                          : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs">{layer.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {layer.desc}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Toggle Historical Project Tracks on Map */}
        {allTracks.length > 0 && (
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setShowHistoryTracks(!showHistoryTracks);
            }}
            id="btn-toggle-history-tracks"
            className={`w-8 h-8 rounded-xl shadow-md border flex items-center justify-center cursor-pointer transition active:scale-95 ${
              showHistoryTracks
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white/95 text-slate-700 border-slate-200'
            }`}
            title={showHistoryTracks ? '隐藏工程已存航迹' : '在地图显示工程已存航迹'}
          >
            {showHistoryTracks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        )}

        {/* Toggle Expand / Collapse Map View */}
        {onToggleExpand && (
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              onToggleExpand();
              setTimeout(() => {
                mapInstanceRef.current?.invalidateSize();
              }, 200);
            }}
            id="btn-toggle-map-expand"
            className="w-8 h-8 rounded-xl bg-white/95 hover:bg-white text-slate-800 shadow-md border border-slate-200 flex items-center justify-center cursor-pointer transition active:scale-95"
            title={expanded ? '收起地图为分屏' : '展开大图全屏监控'}
          >
            {expanded ? <Minimize2 className="w-4 h-4 text-slate-700" /> : <Maximize2 className="w-4 h-4 text-slate-700" />}
          </button>
        )}

        {/* Zoom In & Zoom Out Buttons */}
        <div className="flex flex-col bg-white/95 rounded-xl border border-slate-200 shadow-md overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer active:bg-slate-200"
            title="放大地图"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-px bg-slate-200 w-full" />
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer active:bg-slate-200"
            title="缩小地图"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Bottom-Right Quick Action Floating Buttons */}
      <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5">
        {/* Fit Bounds to Track */}
        {(recordedPoints.length >= 2 || (focusedTrack && focusedTrack.points.length >= 2)) && (
          <button
            type="button"
            onClick={handleFitTrackBounds}
            id="btn-fit-track-bounds"
            className="px-2.5 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-800 shadow-md border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
            title="全景适应整条航迹"
          >
            <Route className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-[11px]">全景适应</span>
          </button>
        )}

        {/* Center / Follow Receiver Button */}
        <button
          type="button"
          onClick={handleCenterOnReceiver}
          id="btn-center-receiver"
          className={`px-2.5 py-1.5 rounded-xl shadow-md border text-xs font-bold flex items-center gap-1 cursor-pointer transition active:scale-95 ${
            isFollowMode
              ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30'
              : 'bg-white/95 text-slate-800 border-slate-200 hover:bg-white'
          }`}
          title="居中锁定测站位置"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span className="text-[11px]">{isFollowMode ? '已锁定定位' : '居中定位'}</span>
        </button>
      </div>

      {/* 5. Bottom-Left Current Coordinate Tag */}
      <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
        <div className="bg-slate-950/75 backdrop-blur-xs px-2 py-0.5 rounded-md border border-slate-800 text-[9.5px] font-mono text-slate-300 shadow-xs">
          E {currentLon.toFixed(6)}° N {currentLat.toFixed(6)}° H {currentAlt.toFixed(1)}m
        </div>
      </div>
    </div>
  );
};
