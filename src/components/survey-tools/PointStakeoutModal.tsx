import React, { useState, useEffect, useMemo } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { SurveyPoint } from '../../types';
import { latLonToGauss, calculateStakeoutGuidance } from '../../utils/geodesy';
import {
  Target,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  X,
  Compass,
  Crosshair,
  Layers,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface PointStakeoutModalProps {
  onClose: () => void;
  initialPoint?: SurveyPoint;
}

export const PointStakeoutModal: React.FC<PointStakeoutModalProps> = ({
  onClose,
  initialPoint,
}) => {
  const { points, currentProject } = useSurveyData();
  const { rtkState, nudgePosition } = useRTK();

  const [selectedPointId, setSelectedPointId] = useState<string>(
    initialPoint?.id || (points[0]?.id || '')
  );
  const [viewMode, setViewMode] = useState<'radar' | 'grid_map'>('radar');

  const targetPoint = points.find((p) => p.id === selectedPointId) || points[0];

  // Receiver Gauss Position
  const receiverGauss = useMemo(() => {
    return latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );
  }, [rtkState.currentLat, rtkState.currentLon, currentProject.centralMeridian, currentProject.coordSystem]);

  // Compute Stakeout Guidance
  const guidance = useMemo(() => {
    if (!targetPoint) return null;
    return calculateStakeoutGuidance(
      receiverGauss.x,
      receiverGauss.y,
      rtkState.currentAlt,
      targetPoint.x,
      targetPoint.y,
      targetPoint.elevation,
      rtkState.heading
    );
  }, [receiverGauss, rtkState.currentAlt, rtkState.heading, targetPoint]);

  // Sound effects when close
  useEffect(() => {
    if (guidance) {
      if (guidance.distanceToTarget < 2.0) {
        soundService.playStakeoutProximity(guidance.distanceToTarget);
      }
    }
  }, [guidance?.distanceToTarget]);

  // 雷达平面网格与相对坐标投影 (以目标点为中心或当前点为中心)
  const radarMap = useMemo(() => {
    if (!targetPoint || !guidance) return null;

    // 当前位置相对于目标点 (米)
    const dx = receiverGauss.y - targetPoint.y; // 东偏 (m)
    const dy = receiverGauss.x - targetPoint.x; // 北偏 (m)
    const dist = guidance.distanceToTarget;

    // 自动量程：在 15m, 5m, 1m 三档智能切换微距
    let maxDist = 15;
    if (dist < 1.0) maxDist = 1.5;
    else if (dist < 4.0) maxDist = 5.0;
    else if (dist > 15.0) maxDist = Math.max(30, dist * 1.3);

    const radiusPx = 80;
    const scale = radiusPx / maxDist;

    // 目标点在中心 (0,0)，当前点在 (dx * scale, -dy * scale)
    const curX = Math.max(-radiusPx, Math.min(radiusPx, dx * scale));
    const curY = Math.max(-radiusPx, Math.min(radiusPx, -dy * scale));

    return {
      maxDist,
      curX,
      curY,
      dx,
      dy,
    };
  }, [targetPoint, guidance, receiverGauss]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">工程点放样与雷达网格</h2>
              <p className="text-[10px] text-slate-500">动态靶向雷达 / 现场高差填挖厘米级导引</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Target Point Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex-1 mr-3">
              <span className="text-[10px] font-semibold text-slate-500 block">选择放样目标点</span>
              <select
                value={selectedPointId}
                onChange={(e) => setSelectedPointId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 mt-1 cursor-pointer focus:border-rose-500 focus:outline-hidden"
              >
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code || '无编码'}) - X:{p.x.toFixed(2)} Y:{p.y.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            {targetPoint && (
              <div className="text-right text-xs font-mono">
                <span className="text-slate-500 block text-[10px] font-sans font-medium">设计高程</span>
                <span className="text-blue-700 font-bold">{targetPoint.elevation.toFixed(3)}m</span>
              </div>
            )}
          </div>

          {/* Radar Visualizer and Guidance */}
          {guidance && radarMap && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden text-white">
              {/* Top radar status indicators */}
              <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-rose-400" />
                  雷达网格 (量程: {radarMap.maxDist.toFixed(1)}m)
                </span>
                <span className="text-emerald-400 font-bold">
                  {guidance.isAligned ? '★ 精准到位' : guidance.distanceToTarget < 1.0 ? '接近目标' : '正在导引'}
                </span>
              </div>

              {/* Radar Circle */}
              <div className="w-48 h-48 rounded-full border border-slate-700 relative flex items-center justify-center bg-slate-950/80 shadow-inner my-1">
                {/* Crosshairs */}
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />
                <div className="absolute top-1 text-[8px] font-mono text-slate-500">N (北)</div>
                <div className="absolute right-1 text-[8px] font-mono text-slate-500">E (东)</div>

                {/* Range Rings */}
                <div className="w-36 h-36 rounded-full border border-dashed border-slate-800" />
                <div className="w-24 h-24 rounded-full border border-slate-800" />
                <div className="w-12 h-12 rounded-full border border-slate-700/60" />

                {/* Target Pin in Center (0,0) */}
                <div className="absolute z-10 w-6 h-6 rounded-full bg-rose-600/30 border-2 border-rose-500 flex items-center justify-center animate-pulse">
                  <Target className="w-3.5 h-3.5 text-rose-400" />
                </div>

                {/* Target needle direction relative to heading */}
                <div
                  className="absolute inset-0 flex items-center justify-center transition-transform duration-200 pointer-events-none"
                  style={{ transform: `rotate(${guidance.relativeBearing}deg)` }}
                >
                  <div className="w-1 h-24 -top-2 absolute flex flex-col items-center">
                    <Navigation className="w-5 h-5 text-rose-500 fill-rose-500" />
                  </div>
                </div>

                {/* Receiver Position Dot on Radar */}
                <div
                  className="absolute z-20 flex flex-col items-center transition-all duration-200"
                  style={{
                    transform: `translate(${radarMap.curX}px, ${radarMap.curY}px)`,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute w-4 h-4 rounded-full bg-cyan-400 opacity-75" />
                    <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 border-2 border-white shadow-md flex items-center justify-center">
                      <div className="w-1 h-1 bg-white rounded-full" />
                    </div>
                  </div>
                  <span className="text-[7px] font-mono text-cyan-300 bg-slate-900/90 px-0.5 rounded mt-0.5 whitespace-nowrap">
                    我
                  </span>
                </div>
              </div>

              {/* Proximity Distance Big Display */}
              <div className="mt-2 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">距放样目标点距离</span>
                <span
                  className={`text-3xl font-mono font-black ${
                    guidance.isAligned
                      ? 'text-emerald-400 animate-pulse'
                      : guidance.distanceToTarget < 1.0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {guidance.distanceToTarget.toFixed(3)} <span className="text-sm font-sans">m</span>
                </span>
                {guidance.isAligned && (
                  <div className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1 mt-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>已精准到位 (容差 &le; 2cm)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Movement Guidance Arrows (Forward/Back, Left/Right, Fill/Cut) */}
          {guidance && (
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              {/* Forward/Back */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-sans font-medium">
                  {guidance.forward >= 0 ? '向前 (Forward)' : '向后 (Backward)'}
                </span>
                <div className="flex items-center gap-1 mt-1 text-slate-900 font-bold text-sm">
                  {guidance.forward >= 0 ? (
                    <ArrowUp className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{Math.abs(guidance.forward).toFixed(3)}m</span>
                </div>
              </div>

              {/* Left/Right */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-sans font-medium">
                  {guidance.right >= 0 ? '向右 (Right)' : '向左 (Left)'}
                </span>
                <div className="flex items-center gap-1 mt-1 text-slate-900 font-bold text-sm">
                  {guidance.right >= 0 ? (
                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowLeft className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{Math.abs(guidance.right).toFixed(3)}m</span>
                </div>
              </div>

              {/* Delta H (Fill/Cut) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-sans font-medium">
                  {guidance.deltaH >= 0 ? '填高 (Fill +)' : '挖深 (Cut -)'}
                </span>
                <div className="flex items-center gap-1 mt-1 text-blue-700 font-bold text-sm">
                  <span>{guidance.deltaH >= 0 ? `+${guidance.deltaH.toFixed(3)}` : `${guidance.deltaH.toFixed(3)}`}m</span>
                </div>
              </div>
            </div>
          )}

          {/* Simulator Joystick for quick movement testing */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-medium">微调模拟测试 (步进0.5m):</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => nudgePosition(0.000005, 0)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                北↑
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(-0.000005, 0)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                南↓
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(0, -0.000005)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                西←
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(0, 0.000005)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                东→
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            高斯: X={receiverGauss.x.toFixed(2)} Y={receiverGauss.y.toFixed(2)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition"
          >
            完成放样退出
          </button>
        </div>
      </div>
    </div>
  );
};
