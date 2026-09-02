import React from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import {
  MapPin,
  ListOrdered,
  Route,
  Globe2,
  Wrench,
  FolderGit2,
  Crosshair,
  Square,
  HardDrive,
  Activity,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface HomeScreenProps {
  onNavigate: (screen: any) => void;
  onOpenExportModal?: () => void;
  onOpenStorageModal?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onOpenStorageModal }) => {
  const {
    currentProject,
    points,
    routes,
    tracks,
    activeRecording,
    stopTrackRecording,
  } = useSurveyData();
  const { rtkState } = useRTK();

  const menuItems = [
    {
      id: 'mark_waypoint',
      title: '标定航点',
      desc: '新建点位与GNSS采集',
      icon: MapPin,
      badge: `${points.length} 个点`,
      topColor: 'bg-blue-500',
      bgColor: '#47beee',
      textColor: '#000000',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-blue-400',
    },
    {
      id: 'waypoint_list',
      title: '航点管理',
      desc: '点库查阅与坐标编辑',
      icon: ListOrdered,
      badge: `${points.length} 点`,
      topColor: 'bg-indigo-500',
      bgColor: '#34a8d4',
      textColor: '#000000',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-indigo-400',
    },
    {
      id: 'routes',
      title: '航线与航迹',
      desc: '实时在线录制与放样台账',
      icon: Route,
      badge: `${routes.length}条规划 / ${tracks.length}条实录`,
      topColor: 'bg-teal-500',
      bgColor: '#3a9ee3',
      textColor: '#090909',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-teal-400',
    },
    {
      id: 'map',
      title: '卫星地图',
      desc: 'GIS底图与全景观测',
      icon: Globe2,
      badge: '卫星 / 矢量',
      topColor: 'bg-sky-500',
      bgColor: '#48aeea',
      textColor: '#050505',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-sky-400',
    },
    {
      id: 'engineering_survey',
      title: '工程测量',
      desc: '放样/面积/测距/坡度',
      icon: Crosshair,
      badge: '10种测量',
      topColor: 'bg-rose-500',
      bgColor: '#2dbfed',
      textColor: '#0e0e0f',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-rose-400',
    },
    {
      id: 'project_manage',
      title: '工程项目',
      desc: '坐标系与七参数管理',
      icon: FolderGit2,
      badge: currentProject.coordSystem,
      topColor: 'bg-purple-500',
      bgColor: '#34a8d4',
      textColor: '#040404',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-purple-400',
    },
    {
      id: 'common_tools',
      title: '常用工具',
      desc: '点库/导入导出/罗盘/气压',
      icon: Wrench,
      badge: '数据与工具',
      topColor: 'bg-amber-500',
      bgColor: '#3a9ee3',
      textColor: '#0a0909',
      iconBg: 'bg-white/20 text-slate-900 border-white/30',
      borderHover: 'hover:border-amber-400',
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
    <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-[#F1F5F9] text-slate-800 relative">
      {/* Current Project Info Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 mb-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-1 h-7 rounded-full bg-blue-600 shrink-0" />
          <div className="truncate">
            <div className="text-xs font-bold text-slate-900 truncate">
              {currentProject.name}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium">
              <span>基准: <b className="text-slate-700 font-semibold">{currentProject.coordSystem}</b></span>
              <span className="text-slate-300">|</span>
              <span>中央子午线 L0: <b className="text-slate-700 font-semibold">{currentProject.centralMeridian}°</b></span>
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
              <HardDrive className="w-4 h-4 text-blue-600" />
            </button>
          )}
          <button
            onClick={() => onNavigate('project_manage')}
            className="text-xs bg-blue-50/60 hover:bg-blue-100 text-blue-600 border border-blue-200 hover:border-blue-300 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0"
          >
            切换项目
          </button>
        </div>
      </div>

      {/* Responsive Grid Menu (Compact 1/2 Area for Higher Concentration) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`btn-menu-${item.id}`}
              onClick={() => handleItemClick(item.id)}
              style={{ backgroundColor: item.bgColor }}
              className={`group hover:opacity-95 active:opacity-90 border border-black/10 ${item.borderHover} rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all duration-150 active:scale-95 shadow-2xs relative overflow-hidden cursor-pointer min-h-[66px]`}
            >
              {/* Top Accent Color Bar */}
              <div
                className={`absolute top-0 inset-x-0 h-0.5 ${item.topColor} transition`}
              />

              {/* Compact Icon Container */}
              <div
                style={{ width: '32px', height: '32px' }}
                className={`rounded-lg flex items-center justify-center border ${item.iconBg} mb-1 shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {/* Title */}
              <span
                style={{ color: item.textColor }}
                className="text-[11px] font-bold tracking-tight leading-tight"
              >
                {item.title}
              </span>

              {/* Description / Subtitle */}
              <span className="text-[9px] text-slate-800/85 mt-0.5 line-clamp-1 font-medium scale-95">
                {item.desc}
              </span>

              {/* Compact Badge */}
              {item.badge && (
                <span className="mt-1 text-[8px] px-1.5 py-0.2 rounded-full bg-white/50 text-slate-900 border border-black/10 font-sans font-medium backdrop-blur-2xs line-clamp-1">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* Background Active Track Recording Indicator Banner (Requirement 4)        */}
      {/* ------------------------------------------------------------------------- */}
      {activeRecording.isRecording && (
        <div className="mt-3 bg-rose-50 border-2 border-rose-300 rounded-2xl p-3 shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            onClick={() => onNavigate('routes')}
            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
          >
            {/* Red Blinking Indicator Dot with Pulse Ring */}
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

          {/* Quick Stop Button */}
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

      {/* Handheld Device Quick Coordinate & Accuracy Bar */}
      <div className="mt-3.5 bg-white border border-slate-200/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-mono shadow-xs">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          <div className="flex items-center gap-2">
            <span>E: <b className="text-slate-900 font-bold">{(rtkState.currentLon).toFixed(7)}°</b></span>
            <span>N: <b className="text-slate-900 font-bold">{(rtkState.currentLat).toFixed(7)}°</b></span>
            <span>H: <b className="text-slate-900 font-bold">{rtkState.currentAlt.toFixed(2)}m</b></span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <div className="flex items-center gap-2 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <span>H: <b className="font-bold">{rtkState.hrms.toFixed(3)}m</b></span>
            <span>V: <b className="font-bold">{rtkState.vrms.toFixed(3)}m</b></span>
          </div>
        </div>

        <button
          onClick={() => {
            soundService.playClick();
          }}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-sans font-bold shrink-0 border flex items-center gap-1 cursor-default transition ${
            rtkState.solution === 'FIXED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-amber-50 text-amber-700 border-amber-300'
          }`}
        >
          <span>{rtkState.solution === 'FIXED' ? '●' : '○'}</span>
          <span>{rtkState.solution === 'FIXED' ? 'RTK固定解' : '浮点/单点解'}</span>
        </button>
      </div>
    </div>
  );
};
