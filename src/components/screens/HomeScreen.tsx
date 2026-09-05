import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import {
  MapPin,
  Route,
  FolderGit2,
  Square,
  HardDrive,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { soundService } from '../../utils/sound';
import {
  WaypointMarkIcon,
  WaypointManageIcon,
  RouteTrackIcon,
  SatelliteMapIcon,
  EngineeringSurveyIcon,
  ProjectManageIcon,
  CommonToolsIcon,
} from '../common/SurveyIconArt';

interface HomeScreenProps {
  onNavigate: (screen: any) => void;
  onOpenExportModal?: () => void;
  onOpenStorageModal?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onOpenStorageModal }) => {
  const {
    currentProject,
    projects,
    points,
    routes,
    tracks,
    activeRecording,
    stopTrackRecording,
  } = useSurveyData();
  const { rtkState } = useRTK();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  // Update scroll ratio on container scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    setCanScroll(maxScroll > 10);
    if (maxScroll > 0) {
      setScrollRatio(Math.min(1, Math.max(0, scrollTop / maxScroll)));
    } else {
      setScrollRatio(0);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  // Vertical slider thumb drag logic
  const handleSliderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingSlider(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const updateScrollFromPointer = (clientY: number) => {
      if (!sliderTrackRef.current || !scrollContainerRef.current) return;
      const rect = sliderTrackRef.current.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
      const maxScroll = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTop = ratio * maxScroll;
      setScrollRatio(ratio);
    };

    updateScrollFromPointer(e.clientY);

    const handlePointerMove = (ev: PointerEvent) => {
      updateScrollFromPointer(ev.clientY);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      setIsDraggingSlider(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const scrollToBottom = () => {
    soundService.playClick();
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  const scrollToTop = () => {
    soundService.playClick();
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // 7 Main Menu Items corresponding to 首页.jpg
  const menuItems = [
    {
      id: 'mark_waypoint',
      title: '标定航点',
      IconComp: WaypointMarkIcon,
      badge: `${points.length} 点`,
    },
    {
      id: 'waypoint_list',
      title: '航点管理',
      IconComp: WaypointManageIcon,
      badge: `${points.length} 点库`,
    },
    {
      id: 'routes',
      title: '航线与航迹',
      IconComp: RouteTrackIcon,
      badge: `${routes.length}航线/${tracks.length}航迹`,
    },
    {
      id: 'map',
      title: '卫星地图',
      IconComp: SatelliteMapIcon,
      badge: 'GIS遥感底图',
    },
    {
      id: 'engineering_survey',
      title: '工程测量',
      IconComp: EngineeringSurveyIcon,
      badge: '放样/测距/面积',
    },
    {
      id: 'project_manage',
      title: '工程项目',
      IconComp: ProjectManageIcon,
      badge: currentProject.coordSystem,
    },
    {
      id: 'common_tools',
      title: '常用工具',
      IconComp: CommonToolsIcon,
      badge: '坐标/罗盘/数据',
    },
  ];

  const handleItemClick = (id: string) => {
    soundService.playClick();
    onNavigate(id);
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex relative overflow-hidden bg-[#F8FAFC] text-slate-800">
      {/* Main Scrollable Content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto custom-vertical-slider"
      >
        {/* 1. Top Positioning & RTK Coordinate Ribbon (Fixed Height: h-10 min-h-[40px] max-h-[40px] to strictly prevent page jitter) */}
        <div className="bg-[#E8FAF4] border border-[#A7EED4] rounded-xl px-3 h-10 min-h-[40px] max-h-[40px] mb-3 flex items-center justify-between gap-2 shadow-2xs overflow-hidden shrink-0">
          <div className="flex items-center gap-x-2.5 font-mono text-xs font-bold text-[#00875A] truncate min-w-0">
            <span className="truncate">E: {(rtkState.currentLon).toFixed(6)}°</span>
            <span className="truncate">N: {(rtkState.currentLat).toFixed(6)}°</span>
            <span className="truncate">H: {rtkState.currentAlt.toFixed(1)}m</span>
            <span className="text-[#57D9A3] hidden md:inline">|</span>
            <div className="hidden sm:flex items-center gap-2 text-[#00875A] shrink-0">
              <span>H: {rtkState.hrms.toFixed(2)}m</span>
              <span>V: {rtkState.vrms.toFixed(2)}m</span>
            </div>
          </div>

          <button
            onClick={() => soundService.playClick()}
            className="bg-[#E3FCEF] text-[#00875A] border border-[#57D9A3] px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[#D3F9E5] transition cursor-pointer shrink-0 h-6.5"
            title="RTK 定位解算状态"
          >
            <span className="w-2 h-2 rounded-full bg-[#00875A] animate-pulse" />
            <span className="whitespace-nowrap">{rtkState.solution === 'FIXED' ? 'RTK固定解' : rtkState.solution === 'FLOAT' ? 'RTK浮点解' : 'RTK单点解'}</span>
          </button>
        </div>

      {/* 2. Realtime Synchronized Ledger Counters (4 White Cards matching 首页.jpg) */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {/* Card 1: 航点数 */}
        <button
          onClick={() => {
            soundService.playClick();
            onNavigate('waypoint_list');
          }}
          className="bg-white hover:bg-blue-50/50 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-center cursor-pointer transition text-center shadow-xs group active:scale-98"
          title="点击查阅航点管理台账"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600">
            <MapPin className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>航点数</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-700 mt-1 leading-none">
            {points.length}
          </div>
          <span className="text-[9px] text-blue-500 font-medium mt-1">点库全要素</span>
        </button>

        {/* Card 2: 航迹数 */}
        <button
          onClick={() => {
            soundService.playClick();
            onNavigate('routes');
          }}
          className="bg-white hover:bg-emerald-50/50 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-center cursor-pointer transition text-center shadow-xs group active:scale-98"
          title="点击查阅航迹实录列表"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <Activity className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span>航迹数</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 mt-1 leading-none">
            {tracks.length}
          </div>
          <span className="text-[9px] text-emerald-500 font-medium mt-1">实录轨迹</span>
        </button>

        {/* Card 3: 规划数 */}
        <button
          onClick={() => {
            soundService.playClick();
            onNavigate('routes');
          }}
          className="bg-white hover:bg-cyan-50/50 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-center cursor-pointer transition text-center shadow-xs group active:scale-98"
          title="点击查阅航线设计与规划"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-600">
            <Route className="w-3.5 h-3.5 text-cyan-600 group-hover:scale-110 transition-transform" />
            <span>规划数</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-700 mt-1 leading-none">
            {routes.length}
          </div>
          <span className="text-[9px] text-cyan-500 font-medium mt-1">设计规划</span>
        </button>

        {/* Card 4: 工程数 */}
        <button
          onClick={() => {
            soundService.playClick();
            onNavigate('project_manage');
          }}
          className="bg-white hover:bg-purple-50/50 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-center cursor-pointer transition text-center shadow-xs group active:scale-98"
          title="点击查阅工程项目列表"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-purple-600">
            <FolderGit2 className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
            <span>工程数</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-purple-700 mt-1 leading-none">
            {projects.length}
          </div>
          <span className="text-[9px] text-purple-500 font-medium mt-1">本地项目</span>
        </button>
      </div>

      {/* 3. Main 3-Column Grid with Divider Lines matching 首页.jpg */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden mb-3">
        <div className="grid grid-cols-3 divide-x divide-y divide-slate-200/80">
          {menuItems.map((item) => {
            const IconComponent = item.IconComp;
            return (
              <button
                key={item.id}
                id={`btn-menu-${item.id}`}
                onClick={() => handleItemClick(item.id)}
                className="group relative p-4 sm:p-5 flex flex-col items-center justify-center text-center hover:bg-slate-50/80 active:bg-slate-100 transition-all duration-150 cursor-pointer min-h-[110px] sm:min-h-[125px]"
              >
                {/* Illustrated 3D Icon */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-2 group-hover:scale-106 transition-transform duration-200 ease-out">
                  <IconComponent className="w-full h-full object-contain filter drop-shadow-sm" />
                </div>

                {/* Title */}
                <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                  {item.title}
                </span>

                {/* Subtle description tag */}
                <span className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-1">
                  {item.badge}
                </span>
              </button>
            );
          })}

          {/* Empty placeholders to fill the 3x3 table grid if needed */}
          <div className="p-4 sm:p-5 flex flex-col items-center justify-center text-center bg-slate-50/20" />
          <div className="p-4 sm:p-5 flex flex-col items-center justify-center text-center bg-slate-50/20" />
        </div>
      </div>

      {/* 4. Current Project Info Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 mb-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-1 h-6 rounded-full bg-blue-600 shrink-0" />
          <div className="truncate">
            <div className="text-xs font-bold text-slate-900 truncate">
              当前工程: {currentProject.name}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium">
              <span>基准: <b className="text-slate-700 font-semibold">{currentProject.coordSystem}</b></span>
              <span className="text-slate-300">|</span>
              <span>L0: <b className="text-slate-700 font-semibold">{currentProject.centralMeridian}°</b></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenStorageModal && (
            <button
              onClick={onOpenStorageModal}
              title="外置存储目录与文件管理"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            </button>
          )}
          <button
            onClick={() => onNavigate('project_manage')}
            className="text-[11px] bg-blue-50/80 hover:bg-blue-100 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
          >
            切换工程
          </button>
        </div>
      </div>

      {/* 5. Background Active Track Recording Indicator Banner */}
      {activeRecording.isRecording && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3 shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            onClick={() => onNavigate('routes')}
            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
          >
            <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-950 truncate">
                  航迹记录中: {activeRecording.name}
                </span>
                <span className="text-[9px] bg-rose-200 text-rose-800 font-mono font-bold px-1.5 py-0.2 rounded">
                  GPX
                </span>
              </div>
              <div className="text-[11px] font-mono text-rose-800 flex items-center gap-3 mt-0.5">
                <span>⏱️ {formatSeconds(activeRecording.elapsedSeconds)}</span>
                <span>•</span>
                <span>
                  📍{' '}
                  {activeRecording.distance > 1000
                    ? `${(activeRecording.distance / 1000).toFixed(2)} km`
                    : `${activeRecording.distance.toFixed(1)} m`}
                </span>
                <span>•</span>
                <span>{activeRecording.points.length} 历元点</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              stopTrackRecording(true);
            }}
            title="结束并保存GPX航迹"
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>停止记录</span>
          </button>
        </div>
      )}
      </div>

      {/* Right Side Vertical Slider Bar (纵向滑块，防止常用工具被遮挡) */}
      <div className="w-7 bg-slate-100/90 border-l border-slate-200/80 flex flex-col items-center py-2 px-0.5 select-none shrink-0 z-10 shadow-xs">
        {/* Quick Scroll To Top */}
        <button
          onClick={scrollToTop}
          title="回滚到顶部"
          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer mb-1"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        {/* Vertical Slider Track */}
        <div
          ref={sliderTrackRef}
          onPointerDown={handleSliderPointerDown}
          title="按住上下滑动或点击快速滚动，直达常用工具"
          className="flex-1 w-3 bg-slate-200 rounded-full relative cursor-pointer flex items-center justify-center touch-none group hover:bg-slate-300/80 transition-colors"
        >
          {/* Subtle track center groove line */}
          <div className="absolute inset-y-1 w-0.5 bg-slate-300 rounded-full" />

          {/* Draggable Slider Thumb */}
          <div
            style={{
              top: `calc(${scrollRatio * 100}% - ${scrollRatio * 24}px)`,
            }}
            className={`absolute left-0 w-3 h-6 rounded-full transition-all duration-75 shadow-xs flex items-center justify-center ${
              isDraggingSlider
                ? 'bg-blue-600 ring-2 ring-blue-300 scale-110'
                : 'bg-slate-500 group-hover:bg-blue-600'
            }`}
          >
            {/* Grip ridges */}
            <div className="w-1.5 h-2 flex flex-col justify-between items-center opacity-80">
              <span className="w-full h-0.5 bg-white rounded-full" />
              <span className="w-full h-0.5 bg-white rounded-full" />
            </div>
          </div>
        </div>

        {/* Quick Scroll To Bottom (常用工具) */}
        <button
          onClick={scrollToBottom}
          title="快速滑到底部：常用工具"
          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer mt-1"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
