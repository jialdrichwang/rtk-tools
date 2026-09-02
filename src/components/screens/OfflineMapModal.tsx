import React, { useState, useEffect } from 'react';
import { Download, HardDrive, Trash2, CheckCircle2, AlertTriangle, Loader2, Layers, RefreshCw, X } from 'lucide-react';
import { offlineMapTileService, CacheRegionMeta } from '../../utils/offlineMapTileService';
import { MapLayerType } from './MapScreen';

interface OfflineMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerLat: number;
  centerLon: number;
  currentLayer: MapLayerType;
  getTileUrlFunction: (layerId: string, x: number, y: number, z: number) => string;
}

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  isOpen,
  onClose,
  centerLat,
  centerLon,
  currentLayer,
  getTileUrlFunction,
}) => {
  const [radiusKm, setRadiusKm] = useState<number>(1.0);
  const [minZoom, setMinZoom] = useState<number>(12);
  const [maxZoom, setMaxZoom] = useState<number>(16);
  const [regionName, setRegionName] = useState<string>('当前测区离线底图');
  const [downloading, setDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ total: number; current: number; failed: number }>({
    total: 0,
    current: 0,
    failed: 0,
  });
  const [savedRegions, setSavedRegions] = useState<CacheRegionMeta[]>([]);
  const [activeTab, setActiveTab] = useState<'download' | 'manage'>('download');

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
      setRegionName(`测区_${centerLat.toFixed(4)}_${centerLon.toFixed(4)}`);
    }
  }, [isOpen, centerLat, centerLon]);

  if (!isOpen) return null;

  // Estimated tile calculation
  const estimatedTiles = offlineMapTileService.calculateTilesForRadius(
    centerLat,
    centerLon,
    radiusKm,
    minZoom,
    maxZoom
  );
  const estimatedSizeMb = ((estimatedTiles.length * 25) / 1024).toFixed(1); // avg 25kb per tile

  const handleStartDownload = async () => {
    if (currentLayer === 'offline_grid') {
      alert('当前处于脱离底图模式，无需下载瓦片！请切换至卫星图或矢量图层后再下载离线缓存。');
      return;
    }

    setDownloading(true);
    const total = estimatedTiles.length;
    let current = 0;
    let failed = 0;
    let totalSizeBytes = 0;

    setProgress({ total, current: 0, failed: 0 });

    for (const tile of estimatedTiles) {
      const tileKey = offlineMapTileService.getTileKey(currentLayer, tile.z, tile.x, tile.y);
      const url = getTileUrlFunction(currentLayer, tile.x, tile.y, tile.z);

      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          totalSizeBytes += blob.size;
          await offlineMapTileService.saveTileBlob(tileKey, blob);
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }

      current++;
      setProgress({ total, current, failed });
    }

    // Save region meta
    const newMeta: CacheRegionMeta = {
      id: 'region_' + Date.now(),
      name: regionName || '未命名测区',
      layerId: currentLayer,
      layerName: layerNameMap[currentLayer] || currentLayer,
      centerLat,
      centerLon,
      radiusKm,
      minZoom,
      maxZoom,
      tileCount: current - failed,
      sizeBytes: totalSizeBytes,
      createdAt: Date.now(),
    };

    await offlineMapTileService.saveRegionMeta(newMeta);
    await loadSavedRegions();
    setDownloading(false);
    setActiveTab('manage');
  };

  const handleDeleteRegion = async (id: string) => {
    if (confirm('确认删除该测区离线缓存数据？')) {
      await offlineMapTileService.deleteRegion(id);
      await loadSavedRegions();
    }
  };

  const handleClearAll = async () => {
    if (confirm('警告：将清空手机本地缓存的所有离线卫星及矢量地图瓦片，是否继续？')) {
      await offlineMapTileService.clearAllCache();
      await loadSavedRegions();
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <HardDrive className="w-5 h-5" />
            <span>小范围测区离线地图缓存</span>
          </div>
          <button
            onClick={onClose}
            disabled={downloading}
            className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/60 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('download')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'download'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            新建测区缓存
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'manage'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            已缓存区域 ({savedRegions.length})
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'download' ? (
            <>
              {/* Info summary */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>目标测区中心点:</span>
                  <span className="font-mono text-slate-200">
                    B:{centerLat.toFixed(5)}° / L:{centerLon.toFixed(5)}°
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>当前下载图层:</span>
                  <span className="font-semibold text-emerald-400">
                    {layerNameMap[currentLayer] || currentLayer}
                  </span>
                </div>
              </div>

              {/* Form settings */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    测区名称
                  </label>
                  <input
                    type="text"
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    disabled={downloading}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                    <span>缓存半径范围</span>
                    <span className="text-emerald-400 font-bold">{radiusKm.toFixed(1)} km</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 1.0, 2.0, 5.0].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRadiusKm(r)}
                        disabled={downloading}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          radiusKm === r
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {r} km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      最小缩放级 (全局)
                    </label>
                    <select
                      value={minZoom}
                      onChange={(e) => setMinZoom(Number(e.target.value))}
                      disabled={downloading}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {[10, 11, 12, 13, 14].map((z) => (
                        <option key={z} value={z}>
                          Level {z} (大视野)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      最大缩放级 (高精)
                    </label>
                    <select
                      value={maxZoom}
                      onChange={(e) => setMaxZoom(Number(e.target.value))}
                      disabled={downloading}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {[14, 15, 16, 17, 18].map((z) => (
                        <option key={z} value={z}>
                          Level {z} {z >= 17 ? '(超精细毫米级)' : '(清晰)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Estimate box */}
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="text-slate-400">预计瓦片数量</div>
                  <div className="text-base font-bold text-emerald-400">
                    {estimatedTiles.length}{' '}
                    <span className="text-xs font-normal text-slate-400">张</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400">预计占用存储</div>
                  <div className="text-base font-bold text-cyan-400">
                    ~{estimatedSizeMb}{' '}
                    <span className="text-xs font-normal text-slate-400">MB</span>
                  </div>
                </div>
              </div>

              {/* Download progress */}
              {downloading && (
                <div className="space-y-2 bg-slate-800/80 p-3 rounded-xl border border-emerald-500/50">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      正在下载离线瓦片...
                    </span>
                    <span className="font-mono">
                      {progress.current} / {progress.total} (
                      {progress.total > 0
                        ? Math.round((progress.current / progress.total) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-150"
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {progress.failed > 0 && (
                    <div className="text-[10px] text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      部分边缘或无网络瓦片已跳过 ({progress.failed} 张)
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleStartDownload}
                disabled={downloading || estimatedTiles.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all text-sm"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    下载离线瓦片中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    开始下载并缓存至手机
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              {savedRegions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs space-y-2">
                  <HardDrive className="w-8 h-8 mx-auto text-slate-600" />
                  <p>暂无已下载的本地离线测区地图</p>
                  <p className="text-[11px] text-slate-500">
                    在有 WiFi 或网络良好时下载，野外无信号即可直接调阅！
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {savedRegions.map((reg) => (
                      <div
                        key={reg.id}
                        className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            {reg.name}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3">
                            <span className="text-emerald-400">{reg.layerName}</span>
                            <span>半径: {reg.radiusKm}km</span>
                            <span>
                              缩放: L{reg.minZoom}-L{reg.maxZoom}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {reg.tileCount} 张瓦片 ·{' '}
                            {reg.sizeBytes > 0
                              ? (reg.sizeBytes / (1024 * 1024)).toFixed(2) + ' MB'
                              : '已缓存'}{' '}
                            · {new Date(reg.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteRegion(reg.id)}
                          className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all"
                          title="删除该测区缓存"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={handleClearAll}
                      className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      清空全部本地地图缓存
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
