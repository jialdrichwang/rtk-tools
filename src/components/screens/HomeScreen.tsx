import React, { useRef } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { forceExitApplication } from '../../App';
import {
  MapPin,
  Route,
  FolderGit2,
  Square,
  HardDrive,
  Activity,
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
  ExitAppIcon,
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
    {
      id: 'exit_app',
      title: '退出程序',
      IconComp: ExitAppIcon,
      badge: '安全退出',
    },
  ];

  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const handleItemClick = (id: string) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    soundService.playClick();
    if (id === 'exit_app') {
      setShowExitConfirm(true);
      return;
    }
    onNavigate(id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    startYRef.current = e.clientY;
    startScrollTopRef.current = scrollContainerRef.current?.scrollTop || 0;
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !scrollContainerRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    if (Math.abs(deltaY) > 5) {
      hasDraggedRef.current = true;
      scrollContainerRef.current.scrollTop = startScrollTopRef.current - deltaY;
    }
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#F8FAFC] text-slate-800 overflow-hidden">
      {/* 1. TOP PINNED: GPS Positioning & RTK Coordinate Ribbon */}
      <div className="shrink-0 p-3 pb-0">
        <div className="bg-[#E8FAF4] border border-[#A7EED4] rounded-xl px-3.5 py-2 min-h-[46px] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs sm:text-[13px] font-bold text-[#00875A] min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="bg-[#D3F9E5] px-1 py-0.5 rounded text-[#006644] font-extrabold text-[10px]">E</span>
              <span>{(rtkState.currentLon).toFixed(6)}°</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-[#D3F9E5] px-1 py-0.5 rounded text-[#006644] font-extrabold text-[10px]">N</span>
              <span>{(rtkState.currentLat).toFixed(6)}°</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-[#D3F9E5] px-1 py-0.5 rounded text-[#006644] font-extrabold text-[10px]">H</span>
              <span>{rtkState.currentAlt.toFixed(2)}m</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#00875A]/90 pl-1 border-l border-[#A7EED4]">
              <span>水平: <b>{rtkState.hrms.toFixed(3)}m</b></span>
              <span>高程: <b>{rtkState.vrms.toFixed(3)}m</b></span>
            </div>
          </div>

          <button
            onClick={() => soundService.playClick()}
            className="bg-[#E3FCEF] text-[#00875A] border border-[#57D9A3] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[#D3F9E5] transition cursor-pointer shrink-0 ml-auto sm:ml-0"
            title="RTK 定位解算状态"
          >
            <span className="w-2 h-2 rounded-full bg-[#00875A] animate-pulse" />
            <span className="whitespace-nowrap font-sans font-extrabold">
              {rtkState.solution === 'FIXED' ? 'RTK固定解' : rtkState.solution === 'FLOAT' ? 'RTK浮点解' : 'RTK单点解'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. MIDDLE SCROLLABLE: Content between GPS Info and Project Info (Counters + 九宫格 3-Column Grid) */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3 space-y-3 cursor-default active:cursor-grab select-none"
      >
        {/* Realtime Synchronized Ledger Counters (4 White Cards matching 首页.jpg) */}
        <div className="grid grid-cols-4 gap-2">
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

        {/* Main 3-Column Grid (九宫格) with Divider Lines matching 首页.jpg */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
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

            {/* Empty placeholders to fill the 3x3 table grid */}
            <div className="p-4 sm:p-5 flex flex-col items-center justify-center text-center bg-slate-50/20" />
            <div className="p-4 sm:p-5 flex flex-col items-center justify-center text-center bg-slate-50/20" />
          </div>
        </div>

        {/* Extra bottom padding to ensure user can smoothly scroll and see all the way below the 9-grid */}
        <div className="h-2" />
      </div>

      {/* 3. BOTTOM PINNED: Current Project Info Banner (工程信息头) & Active Recording */}
      <div className="shrink-0 p-3 pt-0 space-y-2 bg-[#F8FAFC]">
        {/* Current Project Info Banner */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
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

        {/* Active Track Recording Indicator Banner if recording */}
        {activeRecording.isRecording && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-2.5 shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div
              onClick={() => onNavigate('routes')}
              className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
            >
              <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
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
                <div className="text-[10px] font-mono text-rose-800 flex items-center gap-2 mt-0.5">
                  <span>⏱️ {formatSeconds(activeRecording.elapsedSeconds)}</span>
                  <span>•</span>
                  <span>
                    📍{' '}
                    {activeRecording.distance > 1000
                      ? `${(activeRecording.distance / 1000).toFixed(2)} km`
                      : `${activeRecording.distance.toFixed(1)} m`}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => stopTrackRecording(true)}
              title="结束并保存GPX航迹"
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 shrink-0 transition cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>停止</span>
            </button>
          </div>
        )}

        {/* Exit App Confirmation Dialog */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <ExitAppIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">退出测绘工程程序</h3>
                  <p className="text-xs text-slate-500 mt-0.5">当前项目与测量成果已实时自动持久化保存</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 my-4 text-xs space-y-1.5 text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">当前工程:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">{currentProject.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">点库规模:</span>
                  <span className="font-bold text-blue-700">{points.length} 个控制点/测量点</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">退出方式:</span>
                  <span className="text-emerald-700 font-bold">安全关闭释放硬件GPS</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  继续作业
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setShowExitConfirm(false);
                    forceExitApplication();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 transition cursor-pointer"
                >
                  确认退出
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
