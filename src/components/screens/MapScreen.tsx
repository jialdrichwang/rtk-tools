import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import {
  Layers,
  Crosshair,
  Plus,
  Compass,
  Navigation,
  MapPin,
  Route as RouteIcon,
  Check,
  Target,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface MapScreenProps {
  onBack?: () => void;
  onOpenStakeout?: () => void;
  onOpenMarkWaypoint?: () => void;
}

type MapLayerType = 'satellite' | 'street' | 'terrain';

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
  const { rtkState, updatePosition } = useRTK();

  const [mapLayer, setMapLayer] = useState<MapLayerType>('satellite');
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix leaflet default marker icon asset paths
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

    // Initial Satellite Tile Layer
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c', 'd'],
      }
    );
    satLayer.addTo(map);
    tileLayerRef.current = satLayer;

    // Create Layer Groups
    pointsLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    tracksLayerRef.current = L.layerGroup().addTo(map);

    // Receiver Marker with direction cone
    const receiverIcon = L.divIcon({
      className: 'custom-rtk-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 14px; height: 14px; background: #0284c7; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(2,132,199,0.8);"></div>
          <div id="receiver-heading-arrow" style="position: absolute; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 12px solid #ef4444; top: -8px; transform-origin: center 24px; transform: rotate(${rtkState.heading}deg);"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
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

    // Map click to set simulator location
    map.on('click', (e) => {
      soundService.playClick();
      updatePosition(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Smoothly update Tile Layer without affecting overlay layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    let newTileLayer: L.TileLayer;
    if (mapLayer === 'satellite') {
      newTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      );
    } else if (mapLayer === 'street') {
      // Standard vector street tiles (High performance CartoDB Voyager / OSM)
      newTileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 20,
          subdomains: 'abcd',
        }
      );
    } else {
      // Terrain / Topo
      newTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
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

      marker.on('click', () => {
        setSelectedPointId(pt.id);
      });

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

  // Re-center on receiver
  const handleRecenter = () => {
    soundService.playClick();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([rtkState.currentLat, rtkState.currentLon], 19, {
        duration: 0.8,
      });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const getLayerLabel = (layer: MapLayerType) => {
    switch (layer) {
      case 'satellite': return '卫星影像';
      case 'street': return '平面矢量';
      case 'terrain': return '地形等高';
    }
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-full bg-slate-900 overflow-hidden select-none">
      {/* Top Coordinate HUD Banner */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 px-3.5 py-2 flex items-center justify-between z-10 shadow-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
          <div>
            <span className="text-slate-500 mr-1 font-sans">经度 E:</span>
            <span className="text-slate-900 font-bold">{rtkState.currentLon.toFixed(7)}°</span>
          </div>
          <div>
            <span className="text-slate-500 mr-1 font-sans">纬度 N:</span>
            <span className="text-slate-900 font-bold">{rtkState.currentLat.toFixed(7)}°</span>
          </div>
          <div className="bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-emerald-700 font-medium">
            <span>H: {rtkState.hrms.toFixed(3)}m V: {rtkState.vrms.toFixed(3)}m</span>
          </div>
        </div>

        {/* Locate Re-center button */}
        <button
          onClick={handleRecenter}
          id="btn-map-locate"
          title="居中定位到RTK接收机"
          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-95 cursor-pointer ml-2"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

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
            title="切换底图图层"
            className="w-10 h-10 rounded-lg bg-white/95 border border-slate-200 hover:border-blue-400 backdrop-blur-md flex items-center justify-center text-slate-700 shadow-md cursor-pointer"
          >
            <Layers className="w-5 h-5 text-blue-600" />
          </button>

          {/* Layer Picker Dropdown */}
          {showLayerPicker && (
            <div className="absolute right-12 top-0 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[130px] space-y-1 z-20">
              {(['satellite', 'street', 'terrain'] as MapLayerType[]).map((layer) => (
                <button
                  key={layer}
                  onClick={() => {
                    soundService.playClick();
                    setMapLayer(layer);
                    setShowLayerPicker(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    mapLayer === layer
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{getLayerLabel(layer)}</span>
                  {mapLayer === layer && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
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

      {/* Bottom info chip */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-700 pointer-events-none z-10 shadow-xs flex items-center gap-1.5">
        <span className="font-bold text-blue-600">{getLayerLabel(mapLayer)}</span>
        <span className="text-slate-300">|</span>
        <span>已标定: <b className="text-slate-900">{points.length}</b> 点</span>
        <span className="text-slate-300">|</span>
        <span>H: <b className="text-emerald-700">{rtkState.currentAlt.toFixed(2)}m</b></span>
      </div>
    </div>
  );
};
