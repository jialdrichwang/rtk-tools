import React, { useState } from 'react';
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
  const { hasBarometerSensor, rtkState } = useRTK();

  const dataTools = [
    {
      id: 'history_data_import',
      category: 'data',
      title: '历史数据导入',
      desc: '手动分类导入工程、点位、航迹、离线底图，低功耗进度管控',
      icon: FolderArchive,
      badge: '分类低耗导入',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      action: onOpenHistoryImport || (() => {}),
    },
    {
      id: 'point_library',
      category: 'data',
      title: '点库管理',
      desc: '工程点位全要素台账、检索与编辑',
      icon: Database,
      badge: '工程数据',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      action: onOpenPointLibrary || (() => {}),
    },
    {
      id: 'import_points',
      category: 'data',
      title: '坐标文件导入',
      desc: '支持南方CASS.dat、CSV、TXT导入',
      icon: FileUp,
      badge: 'CASS/CSV',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      action: onOpenFileImport,
    },
    {
      id: 'export_points',
      category: 'data',
      title: '点库成果导出',
      desc: '导出高精点位至CASS/CSV/KML/TXT',
      icon: FileDown,
      badge: '多格式导出',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: onOpenFileExport,
    },
    {
      id: 'export_track',
      category: 'data',
      title: '航线与航迹管理',
      desc: '外业实时录制台账与KML/GPX/CSV/DAT导出及转换',
      icon: Route,
      badge: '实时录制台账',
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      action: onOpenExportTrack || (() => {}),
    },
  ];

  const utilityTools = [
    {
      id: 'compass',
      category: 'tool',
      title: '电子罗盘',
      desc: '360°罗盘磁北、方位角与磁场监测',
      icon: Compass,
      badge: '传感器',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      action: onOpenCompass,
    },
    {
      id: 'barometer',
      category: 'tool',
      title: '气压测高计',
      desc: '实时大气压强与气压测高修正',
      icon: Gauge,
      badge: hasBarometerSensor ? `${rtkState.pressure.toFixed(1)} hPa` : '未配置',
      color: hasBarometerSensor ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-50 border-slate-200',
      action: onOpenBarometer,
    },
    {
      id: 'offline_map',
      category: 'tool',
      title: '地图离线下载',
      desc: '离线底图缓存与外业瓦片预载',
      icon: DownloadCloud,
      badge: 'GIS底图',
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      action: onOpenOfflineMap,
    },
    {
      id: 'gps_switch',
      category: 'tool',
      title: '定位模式与CORS',
      desc: 'GNSS高精定位源与模拟器配置',
      icon: Crosshair,
      badge: 'RTK设置',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      action: onOpenGPSControl,
    },
    {
      id: 'activation',
      category: 'tool',
      title: '仪器账号激活',
      desc: '设备序列号、CORS凭证与授权',
      icon: KeyRound,
      badge: '系统授权',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      action: onOpenActivation,
    },
    {
      id: 'nmea_monitor',
      category: 'tool',
      title: 'NMEA-0183 报文监控',
      desc: '外置蓝牙RTK数据流实时监听与假连接排查诊断',
      icon: Terminal,
      badge: '报文/假连接排查',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: onOpenNmeaMonitor || (() => {}),
    },
    {
      id: 'bluetooth_scanner',
      category: 'tool',
      title: '外置蓝牙 RTK 接收机',
      desc: '配对华测、南方、中海达等全系外置GNSS',
      icon: Bluetooth,
      badge: rtkState.mode === 'bluetooth_gnss' ? '已连接' : '配对搜索',
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

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 p-3.5 overflow-y-auto">
      {/* Category Filter Tabs */}
      <div className="flex items-center justify-between bg-white border border-slate-200/90 rounded-xl p-1 mb-3.5 shadow-2xs">
        <button
          onClick={() => {
            soundService.playClick();
            setActiveCategory('all');
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
            activeCategory === 'all'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          全部工具与数据 ({dataTools.length + utilityTools.length})
        </button>
        <button
          onClick={() => {
            soundService.playClick();
            setActiveCategory('data');
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
            activeCategory === 'data'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          工程数据管理 ({dataTools.length})
        </button>
        <button
          onClick={() => {
            soundService.playClick();
            setActiveCategory('tool');
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
            activeCategory === 'tool'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          常用测量工具 ({utilityTools.length})
        </button>
      </div>

      {/* Grid of Tools (Compact 1/2 Area) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {filteredTools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              id={`btn-tool-${t.id}`}
              onClick={() => {
                soundService.playClick();
                t.action();
              }}
              className="bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-blue-400 rounded-xl p-2 flex flex-col items-center justify-center text-center transition active:scale-95 shadow-2xs group cursor-pointer relative min-h-[68px]"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${t.color} mb-1 group-hover:scale-105 transition-transform shadow-2xs`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-900 group-hover:text-blue-600 leading-tight">
                  {t.title}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 mt-0.5 line-clamp-1 scale-95">
                {t.desc}
              </span>
              <span className="mt-1 text-[8px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200/80 line-clamp-1">
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Version Footer */}
      <div className="text-center text-xs font-mono text-slate-400 py-3 mt-auto">
        <span className="tracking-widest font-semibold">v 1.0.26</span>
        <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
          RTK Engineering Surveyor Edition
        </div>
      </div>
    </div>
  );
};
