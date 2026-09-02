import React, { useState, useEffect } from 'react';
import { useRTK } from '../../context/RTKContext';
import {
  Radio,
  Satellite,
  RotateCcw,
  Maximize,
  Minimize,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface TopStatusBarProps {
  title?: string;
  currentScreen?: string;
  onBack?: () => void;
  showBack?: boolean;
  onOpenNtrip?: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  title,
  currentScreen,
  onBack,
  showBack = false,
  onOpenNtrip,
}) => {
  const { rtkState, setSolution, toggleScreenRotation } = useRTK();
  const [timeStr, setTimeStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    soundService.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch((err) => {
        console.warn('Fullscreen request denied or not supported:', err);
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const getScreenTitle = (screen?: string) => {
    switch (screen) {
      case 'home': return '主页';
      case 'mark_waypoint': return '标定航点';
      case 'map': return 'GIS卫星地图';
      case 'waypoint_list': return '航点管理';
      case 'common_tools': return '常用工具';
      case 'routes':
      case 'tracks': return '航线与航迹管理';
      case 'engineering_survey': return '工程测量';
      case 'engineering_data': return '工程数据';
      case 'project_manage': return '工程项目管理';
      default: return title || 'RTK 测量工具箱';
    }
  };

  const displayTitle = title || getScreenTitle(currentScreen);
  const shouldShowBack = showBack || (currentScreen && currentScreen !== 'home');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getSolutionBadge = () => {
    switch (rtkState.solution) {
      case 'FIXED':
        return { label: '固定解', color: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-400' };
      case 'FLOAT':
        return { label: '浮点解', color: 'bg-amber-100 text-amber-800', border: 'border-amber-400' };
      case 'SINGLE':
        return { label: '单点解', color: 'bg-blue-100 text-blue-800', border: 'border-blue-400' };
      default:
        return { label: '未定位', color: 'bg-rose-100 text-rose-800', border: 'border-rose-400' };
    }
  };

  const badge = getSolutionBadge();

  // Cycle solution on badge click for quick testing
  const handleCycleSolution = () => {
    const solutions: Array<'FIXED' | 'FLOAT' | 'SINGLE' | 'INVALID'> = ['FIXED', 'FLOAT', 'SINGLE', 'INVALID'];
    const nextIdx = (solutions.indexOf(rtkState.solution) + 1) % solutions.length;
    setSolution(solutions[nextIdx]);
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 select-none shadow-xs shrink-0">
      {/* Top micro telemetry bar */}
      <div className="flex items-center justify-between text-[11px] font-mono tracking-tight text-slate-500 bg-slate-50 border-b border-slate-200/80 px-3 py-1">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNtrip}
            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
            title="CORS差分连接"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>NTRIP</span>
          </button>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-slate-700">
            <Satellite className="w-3 h-3 text-blue-600" />
            <span className="font-semibold">{rtkState.satsUsed}/{rtkState.satsTracked}颗</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-mono">
            PDOP: {rtkState.pdop.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-slate-600 text-[11px]">差分龄期: {rtkState.ageOfDiff}s</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-900 font-bold font-mono">{timeStr}</span>
        </div>
      </div>

      {/* Main Title bar */}
      <div className="flex items-center justify-between px-3.5 py-2">
        <div className="flex items-center gap-2.5">
          {shouldShowBack && (
            <button
              onClick={onBack}
              id="btn-back"
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">‹</span>
              <span>返回</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              Δ
            </div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">{displayTitle}</h1>
          </div>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-2">
          {/* Positioning Source Indicator */}
          <button
            onClick={onOpenNtrip}
            id="btn-top-gps-mode-badge"
            title="点击切换定位源与CORS差分设定（真机GPS / IP网络免权限 / 外置蓝牙RTK）"
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
              rtkState.mode === 'real_gps'
                ? rtkState.realGpsStatus === 'denied'
                  ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 animate-pulse'
                  : rtkState.realGpsStatus === 'locating'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : rtkState.mode === 'ip_location'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : rtkState.mode === 'bluetooth_gnss'
                ? 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <span>
              {rtkState.mode === 'real_gps'
                ? rtkState.realGpsStatus === 'denied'
                  ? '⚠️ 定位需授权'
                  : rtkState.realGpsStatus === 'locating'
                  ? '🛰️ 搜星中...'
                  : `🛰️ 真机 ${(rtkState.realGpsFrequencyHz || 4.0).toFixed(1)}Hz`
                : rtkState.mode === 'ip_location'
                ? '🌐 网络基站'
                : rtkState.mode === 'bluetooth_gnss'
                ? '📡 蓝牙RTK'
                : '🕹️ 仿真'}
            </span>
          </button>

          {/* RTK Solution Button (clickable to cycle in simulation) */}
          <button
            onClick={handleCycleSolution}
            title="点击切换RTK解算状态（模拟测试）"
            id="btn-rtk-solution-badge"
            className={`px-2 py-0.5 rounded text-xs font-bold tracking-wider cursor-pointer border ${badge.border} ${badge.color} transition active:scale-95 shadow-xs`}
          >
            ● {badge.label}
          </button>

          {/* Fullscreen toggle for field survey */}
          <button
            onClick={toggleFullscreen}
            id="btn-toggle-fullscreen"
            title={isFullscreen ? '退出全屏' : '全屏作业模式 (沉浸式)'}
            className={`p-1.5 rounded-md border transition cursor-pointer ${
              isFullscreen
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Rotate Screen toggle */}
          <button
            onClick={toggleScreenRotation}
            id="btn-rotate-screen"
            title="180° 旋转屏幕"
            className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
