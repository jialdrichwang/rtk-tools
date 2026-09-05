import React from 'react';
import { useRTK } from '../../context/RTKContext';
import {
  Crosshair,
  RotateCw,
  Gauge,
  Compass,
  Radio,
  Home,
  Map as MapIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface SideToolbarProps {
  currentScreen?: string;
  onNavigate?: (screen: any) => void;
  onHome?: () => void;
  onBack?: () => void;
  onOpenCompass?: () => void;
  onOpenBarometer?: () => void;
  onOpenNtrip?: () => void;
  onOpenGPSControl?: () => void;
}

export const SideToolbar: React.FC<SideToolbarProps> = ({
  currentScreen,
  onNavigate,
  onHome,
  onBack,
  onOpenCompass,
  onOpenBarometer,
  onOpenNtrip,
  onOpenGPSControl,
}) => {
  const { rtkState, toggleScreenRotation, setSolution } = useRTK();
  const [soundOn, setSoundOn] = React.useState(true);

  const toggleSound = () => {
    const next = soundService.toggle();
    setSoundOn(next);
  };

  const getCompassDir = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return '北';
    if (deg >= 22.5 && deg < 67.5) return '东北';
    if (deg >= 67.5 && deg < 112.5) return '东';
    if (deg >= 112.5 && deg < 157.5) return '东南';
    if (deg >= 157.5 && deg < 202.5) return '南';
    if (deg >= 202.5 && deg < 247.5) return '西南';
    if (deg >= 247.5 && deg < 292.5) return '西';
    return '西北';
  };

  return (
    <aside className="w-16 bg-white border-l border-slate-200 flex flex-col items-center py-2.5 px-1 gap-2 select-none shrink-0 shadow-xs overflow-y-auto max-h-full custom-vertical-slider">
      {/* 1. 地图 / 主页 导航 */}
      <button
        onClick={() => {
          soundService.playClick();
          if (currentScreen === 'map') {
            if (onHome) onHome();
            else if (onNavigate) onNavigate('home');
          } else {
            if (onNavigate) onNavigate('map');
          }
        }}
        id="btn-toolbar-map"
        title={currentScreen === 'map' ? '返回主页' : '打开GIS卫星地图'}
        className="w-13 h-13 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 flex flex-col items-center justify-center p-1 transition active:scale-95 cursor-pointer shadow-2xs group"
      >
        {currentScreen === 'map' ? (
          <Home className="w-5 h-5 text-blue-600 group-hover:scale-105 transition-transform" />
        ) : (
          <MapIcon className="w-5 h-5 text-purple-600 group-hover:scale-105 transition-transform" />
        )}
        <span className="text-[10px] font-bold text-slate-800 tracking-tight mt-0.5">
          {currentScreen === 'map' ? '主页' : '地图'}
        </span>
      </button>

      {/* 2. 定位模式切换 / 真机GPS */}
      <button
        onClick={() => {
          soundService.playClick();
          if (onOpenGPSControl) onOpenGPSControl();
          else if (onOpenNtrip) onOpenNtrip();
        }}
        id="btn-toolbar-gps"
        title="定位模式与高精差分设定"
        className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center p-1 border transition active:scale-95 cursor-pointer shadow-2xs ${
          rtkState.mode === 'real_gps'
            ? 'bg-[#E8FAF4] border-[#A7EED4] text-[#00875A]'
            : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
        }`}
      >
        <Crosshair className={`w-5 h-5 ${rtkState.mode === 'real_gps' ? 'text-[#00875A]' : 'text-blue-600'}`} />
        <span className="text-[9px] font-bold tracking-tighter mt-0.5">
          {rtkState.mode === 'real_gps' ? '真机GPS' : 'RTK模拟'}
        </span>
      </button>

      {/* 3. 180° 旋转屏幕 */}
      <button
        onClick={toggleScreenRotation}
        id="btn-toolbar-rotate"
        title="180° 翻转屏幕"
        className="w-13 h-13 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 flex flex-col items-center justify-center p-1 text-slate-700 transition active:scale-95 cursor-pointer shadow-2xs group"
      >
        <RotateCw className="w-5 h-5 text-slate-600 group-hover:rotate-45 transition-transform" />
        <span className="text-[9px] font-bold tracking-tighter mt-0.5 text-slate-800">
          180°翻转
        </span>
      </button>

      {/* 4. 蜂鸣提示音 开关 */}
      <button
        onClick={toggleSound}
        id="btn-toolbar-sound"
        title={soundOn ? '提示音已开 (点击关闭)' : '提示音已静音 (点击开启)'}
        className={`w-13 h-13 rounded-2xl border flex flex-col items-center justify-center p-1 transition active:scale-95 cursor-pointer shadow-2xs ${
          soundOn
            ? 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
            : 'bg-rose-50 border-rose-200 text-rose-600'
        }`}
      >
        {soundOn ? (
          <Volume2 className="w-5 h-5 text-[#00875A]" />
        ) : (
          <VolumeX className="w-5 h-5 text-rose-500" />
        )}
        <span className="text-[9px] font-bold tracking-tighter mt-0.5 text-slate-800">
          {soundOn ? '蜂鸣开' : '已静音'}
        </span>
      </button>

      {/* 5. 罗盘 (点击打开地质测绘罗盘) */}
      <button
        onClick={() => {
          soundService.playClick();
          if (onOpenCompass) onOpenCompass();
        }}
        id="btn-toolbar-compass"
        title="点击打开高精地质测绘罗盘"
        className="w-13 h-13 rounded-2xl bg-white hover:bg-blue-50/60 border border-slate-200/90 flex flex-col items-center justify-center p-1 text-slate-700 transition active:scale-95 cursor-pointer shadow-2xs group"
      >
        <div className="relative flex items-center justify-center">
          <Compass
            className="w-5 h-5 text-blue-600 transition-transform duration-300 group-hover:scale-110"
            style={{ transform: `rotate(${rtkState.heading}deg)` }}
          />
        </div>
        <span className="text-[9px] font-bold text-slate-800 leading-none mt-0.5">
          {getCompassDir(rtkState.heading)}
        </span>
        <span className="text-[8px] text-slate-500 font-mono scale-90 leading-tight">
          {Math.round(rtkState.heading)}°
        </span>
      </button>

      {/* 6. NTRIP / RTK 解算状态快捷徽标 */}
      <button
        onClick={() => {
          soundService.playClick();
          if (onOpenNtrip) onOpenNtrip();
        }}
        id="btn-toolbar-ntrip"
        title="NTRIP CORS 差分服务设置"
        className="w-13 h-13 rounded-xl bg-slate-50/80 hover:bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-1 text-slate-700 transition active:scale-95 cursor-pointer mt-auto shadow-2xs"
      >
        <Radio className="w-5 h-5 text-emerald-600" />
        <span className="text-[10px] font-mono font-bold text-emerald-700 mt-0.5">
          {rtkState.satsUsed}/{rtkState.satsTracked}
        </span>
      </button>
    </aside>
  );
};
