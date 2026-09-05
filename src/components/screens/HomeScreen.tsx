import React from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
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
    <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto overscroll-y-contain touch-pan-y bg-[#F8FAFC] text-slate-800">
      {/* 1. Top Positioning & RTK Coordinate Ribbon (Spacious height to display all coordinates and accuracy metrics clearly without truncation) */}
      <div className="bg-[#E8FAF4] border border-[#A7EED4] rounded-xl px-3.5 py-2 min-h-[48px] mb-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-2xs shrink-0">
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
  );
};
