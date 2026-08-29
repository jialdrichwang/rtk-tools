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
  Activity,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface HomeScreenProps {
  onNavigate: (screen: any) => void;
  onOpenExportModal?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { currentProject, points, routes, tracks } = useSurveyData();
  const { rtkState } = useRTK();

  const menuItems = [
    {
      id: 'mark_waypoint',
      title: '标定航点',
      desc: '新建点位与GNSS采集',
      icon: MapPin,
      badge: `${points.length} 个点`,
      topColor: 'bg-blue-500',
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
      borderHover: 'hover:border-blue-400',
    },
    {
      id: 'waypoint_list',
      title: '航点管理',
      desc: '点库查阅与坐标编辑',
      icon: ListOrdered,
      badge: `${points.length} 点`,
      topColor: 'bg-indigo-500',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      borderHover: 'hover:border-indigo-400',
    },
    {
      id: 'routes',
      title: '航线与航迹',
      desc: '实时在线录制与放样台账',
      icon: Route,
      badge: `${routes.length}条规划 / ${tracks.length}条实录`,
      topColor: 'bg-teal-500',
      iconBg: 'bg-teal-50 text-teal-600 border-teal-100',
      borderHover: 'hover:border-teal-400',
    },
    {
      id: 'map',
      title: '卫星地图',
      desc: 'GIS底图与全景观测',
      icon: Globe2,
      badge: '卫星 / 矢量',
      topColor: 'bg-sky-500',
      iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
      borderHover: 'hover:border-sky-400',
    },
    {
      id: 'engineering_survey',
      title: '工程测量',
      desc: '放样/面积/测距/坡度',
      icon: Crosshair,
      badge: '10种测量',
      topColor: 'bg-rose-500',
      iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
      borderHover: 'hover:border-rose-400',
    },
    {
      id: 'project_manage',
      title: '工程项目',
      desc: '坐标系与七参数管理',
      icon: FolderGit2,
      badge: currentProject.coordSystem,
      topColor: 'bg-purple-500',
      iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
      borderHover: 'hover:border-purple-400',
    },
    {
      id: 'common_tools',
      title: '常用工具',
      desc: '点库/导入导出/罗盘/气压',
      icon: Wrench,
      badge: '数据与工具',
      topColor: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      borderHover: 'hover:border-amber-400',
    },
  ];

  const handleItemClick = (id: string) => {
    soundService.playClick();
    onNavigate(id);
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-[#F1F5F9] text-slate-800">
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

        <button
          onClick={() => onNavigate('project_manage')}
          className="text-xs bg-blue-50/60 hover:bg-blue-100 text-blue-600 border border-blue-200 hover:border-blue-300 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0"
        >
          切换项目
        </button>
      </div>

      {/* Responsive Grid Menu */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`btn-menu-${item.id}`}
              onClick={() => handleItemClick(item.id)}
              className={`group bg-white hover:bg-slate-50/80 active:bg-slate-100 border border-slate-200 ${item.borderHover} rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-150 active:scale-98 shadow-xs relative overflow-hidden cursor-pointer min-h-[130px]`}
            >
              {/* Top Accent Color Bar */}
              <div
                className={`absolute top-0 inset-x-0 h-1 ${item.topColor} transition`}
              />

              {/* Icon Container */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border ${item.iconBg} mb-2.5 shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Title */}
              <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 tracking-tight">
                {item.title}
              </span>

              {/* Description / Subtitle */}
              <span className="text-[10px] text-slate-400 mt-1 line-clamp-1 font-medium">
                {item.desc}
              </span>

              {/* Badge */}
              {item.badge && (
                <span className="mt-2 text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 font-sans font-medium">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

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
