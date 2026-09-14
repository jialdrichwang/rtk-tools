import React, { useState, useRef } from 'react';
import {
  Compass,
  Gauge,
  FileUp,
  FileDown,
  DownloadCloud,
  Crosshair,
  KeyRound,
  Database,
  Route,
  Layers,
  Wrench,
  FileSpreadsheet,
  FolderArchive,
  Terminal,
  Bluetooth,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { soundService } from '../../utils/sound';
import { useRTK } from '../../context/RTKContext';

interface CommonToolsScreenProps {
  onOpenCompass: () => void;
  onOpenBarometer: () => void;
  onOpenFileExport: () => void;
  onOpenFileImport: () => void;
  onOpenOfflineMap: () => void;
  onOpenGPSControl: () => void;
  onOpenActivation: () => void;
  onOpenPointLibrary?: () => void;
  onOpenExportTrack?: () => void;
  onOpenHistoryImport?: () => void;
  onOpenNmeaMonitor?: () => void;
  onOpenBluetooth?: () => void;
}

export const CommonToolsScreen: React.FC<CommonToolsScreenProps> = ({
  onOpenCompass,
  onOpenBarometer,
  onOpenFileExport,
  onOpenFileImport,
  onOpenOfflineMap,
  onOpenGPSControl,
  onOpenActivation,
  onOpenPointLibrary,
  onOpenExportTrack,
  onOpenHistoryImport,
  onOpenNmeaMonitor,
  onOpenBluetooth,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'data' | 'tool'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { hasBarometerSensor, rtkState } = useRTK();

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartScrollTopRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);

  const categories: { id: 'all' | 'data' | 'tool'; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'data', label: '工程数据' },
    { id: 'tool', label: '实用测量' },
  ];

  const dataTools = [
    {
      id: 'history_data_import',
      category: 'data',
      title: '历史数据导入',
      desc: '分类导入工程/点位/底图',
      icon: FolderArchive,
      badge: '分类导入',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      action: onOpenHistoryImport || (() => {}),
    },
    {
      id: 'point_library',
      category: 'data',
      title: '点库管理',
      desc: '工程点位全要素台账',
      icon: Database,
      badge: '工程点库',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      action: onOpenPointLibrary || (() => {}),
    },
    {
      id: 'import_points',
      category: 'data',
      title: '坐标导入',
      desc: 'CASS.dat/CSV/TXT',
      icon: FileUp,
      badge: 'CASS/CSV',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      action: onOpenFileImport,
    },
    {
      id: 'export_points',
      category: 'data',
      title: '点库导出',
      desc: 'CASS/CSV/KML/TXT',
      icon: FileDown,
      badge: '成果导出',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: onOpenFileExport,
    },
    {
      id: 'export_track',
      category: 'data',
      title: '航线航迹',
      desc: '实时轨迹与KML导出',
      icon: Route,
      badge: '轨迹台账',
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      action: onOpenExportTrack || (() => {}),
    },
  ];

  const utilityTools = [
    {
      id: 'compass',
      category: 'tool',
      title: '电子罗盘',
      desc: '方位角与磁场监测',
      icon: Compass,
      badge: '传感器',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      action: onOpenCompass,
    },
    {
      id: 'barometer',
      category: 'tool',
      title: '气压测高计',
      desc: '气压计高程修正',
      icon: Gauge,
      badge: hasBarometerSensor ? `${rtkState.pressure.toFixed(1)} hPa` : '未配置',
      color: hasBarometerSensor ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-50 border-slate-200',
      action: onOpenBarometer,
    },
    {
      id: 'offline_map',
      category: 'tool',
      title: '离线地图',
      desc: '底图缓存与外业预载',
      icon: DownloadCloud,
      badge: '瓦片预载',
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      action: onOpenOfflineMap,
    },
    {
      id: 'gps_switch',
      category: 'tool',
      title: '定位与CORS',
      desc: 'GNSS高精定位源',
      icon: Crosshair,
      badge: 'RTK设置',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      action: onOpenGPSControl,
    },
    {
      id: 'activation',
      category: 'tool',
      title: '仪器授权',
      desc: '序列号与CORS凭证',
      icon: KeyRound,
      badge: '系统授权',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      action: onOpenActivation,
    },
    {
      id: 'nmea_monitor',
      category: 'tool',
      title: 'NMEA报文',
      desc: '蓝牙数据流监听诊断',
      icon: Terminal,
      badge: '报文监控',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: onOpenNmeaMonitor || (() => {}),
    },
    {
      id: 'bluetooth_scanner',
      category: 'tool',
      title: '蓝牙RTK',
      desc: '配对华测/南方GNSS',
      icon: Bluetooth,
      badge: rtkState.mode === 'bluetooth_gnss' ? '已连接' : '搜索配对',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      action: onOpenBluetooth || (() => {}),
    },
  ];

  const filteredTools =
    activeCategory === 'data'
      ? dataTools
      : activeCategory === 'tool'
      ? utilityTools
      : [...dataTools, ...utilityTools];

  // Horizontal swipe between tabs
  const handleCategorySwipe = (direction: 'left' | 'right') => {
    const currentIndex = categories.findIndex((c) => c.id === activeCategory);
    if (direction === 'left' && currentIndex < categories.length - 1) {
      soundService.playClick();
      setActiveCategory(categories[currentIndex + 1].id);
    } else if (direction === 'right' && currentIndex > 0) {
      soundService.playClick();
      setActiveCategory(categories[currentIndex - 1].id);
    }
  };

  // Touch gesture & drag scroll handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartScrollTopRef.current = containerRef.current?.scrollTop || 0;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !containerRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;

    // Vertical drag scrolling
    if (Math.abs(deltaY) > 6 && Math.abs(deltaY) >= Math.abs(deltaX)) {
      hasMovedRef.current = true;
      containerRef.current.scrollTop = touchStartScrollTopRef.current - deltaY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

      // Detect deliberate horizontal swipe gesture (> 45px)
      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          handleCategorySwipe('left');
        } else {
          handleCategorySwipe('right');
        }
      }
    }
  };

  // Mouse drag scrolling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    touchStartYRef.current = e.clientY;
    touchStartScrollTopRef.current = containerRef.current?.scrollTop || 0;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaY = e.clientY - touchStartYRef.current;
    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
      containerRef.current.scrollTop = touchStartScrollTopRef.current - deltaY;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleToolClick = (toolAction: () => void) => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    soundService.playClick();
    toolAction();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 min-h-0 min-w-0 overflow-hidden select-none">
      {/* Top Header: Category Tabs + View Mode Toggle */}
      <div className="shrink-0 p-3 pb-2 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x py-0.5 no-scrollbar flex-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  soundService.playClick();
                  setActiveCategory(c.id);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Grid / List Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => {
                soundService.playClick();
                setViewMode('grid');
              }}
              title="九宫格排列"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                soundService.playClick();
                setViewMode('list');
              }}
              title="列表排列"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gestures hint bar */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
          <span>左右滑动切换分类 · 上下滑动浏览功能</span>
          <span>共 {filteredTools.length} 项</span>
        </div>
      </div>

      {/* Scrollable / Swipeable Tools Area (支持触摸滑动与惯性滚动) */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 p-3 overflow-y-auto touch-scroll-y custom-vertical-slider min-h-0"
      >
        {viewMode === 'grid' ? (
          /* 3-Column Grid Mode (九宫格风格 - 100% Android 7.0 Flexbox 兼容) */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="nine-grid-container flex flex-wrap w-full">
              {filteredTools.map((t, idx) => {
                const Icon = t.icon;
                const isRightEdge = idx % 3 === 2;
                const totalRows = Math.ceil(filteredTools.length / 3);
                const currentRow = Math.floor(idx / 3);
                const isBottomRow = currentRow === totalRows - 1;

                return (
                  <button
                    key={t.id}
                    id={`btn-tool-${t.id}`}
                    onClick={() => handleToolClick(t.action)}
                    className={`nine-grid-cell p-3 sm:p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 active:bg-blue-50/50 transition duration-150 cursor-pointer min-h-[105px] group ${
                      !isRightEdge ? 'border-r border-slate-200/80' : ''
                    } ${!isBottomRow ? 'border-b border-slate-200/80' : ''}`}
                    style={{
                      width: '33.333333%',
                      flex: '0 0 33.333333%',
                      maxWidth: '33.333333%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border ${t.color} mb-1.5 group-hover:scale-105 transition-transform shadow-2xs`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 leading-snug">
                      {t.title}
                    </span>
                    <span className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Vertical Single-Column List Mode (带滑动) */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
            {filteredTools.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  id={`btn-tool-${t.id}`}
                  onClick={() => handleToolClick(t.action)}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 active:bg-blue-50/60 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${t.color} shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                        {t.desc}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                      {t.badge}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Version Footer */}
        <div className="text-center text-xs font-mono text-slate-400 py-3 mt-4">
          <span className="tracking-widest font-semibold">v 1.0.26</span>
          <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
            RTK Engineering Surveyor Edition
          </div>
        </div>

        {/* Bottom spacer for smooth over-scrolling */}
        <div className="h-6" />
      </div>
    </div>
  );
};

