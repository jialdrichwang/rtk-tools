import React, { useState, useEffect } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { SurveyPoint } from '../../types';
import { latLonToGauss, calculateStakeoutGuidance } from '../../utils/geodesy';
import { Target, Navigation, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react';
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

  const targetPoint = points.find((p) => p.id === selectedPointId) || points[0];

  // Receiver Gauss Position
  const receiverGauss = latLonToGauss(
    rtkState.currentLat,
    rtkState.currentLon,
    currentProject.centralMeridian,
    currentProject.coordSystem
  );

  // Compute Stakeout Guidance
  const guidance = targetPoint
    ? calculateStakeoutGuidance(
        receiverGauss.x,
        receiverGauss.y,
        rtkState.currentAlt,
        targetPoint.x,
        targetPoint.y,
        targetPoint.elevation,
        rtkState.heading
      )
    : null;

  // Sound effects when close
  useEffect(() => {
    if (guidance) {
      if (guidance.distanceToTarget < 2.0) {
        soundService.playStakeoutProximity(guidance.distanceToTarget);
      }
    }
  }, [guidance?.distanceToTarget]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900">工程点放样 (Point Stakeout)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Target Point Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex-1 mr-3">
              <span className="text-[10px] font-semibold text-slate-500 block">放样目标点</span>
              <select
                value={selectedPointId}
                onChange={(e) => setSelectedPointId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 mt-1 cursor-pointer focus:border-blue-500 focus:outline-hidden"
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
          {guidance && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Radar Circle */}
              <div className="w-44 h-44 rounded-full border border-slate-300 relative flex items-center justify-center bg-white shadow-2xs">
                <div className="w-32 h-32 rounded-full border border-dashed border-slate-300" />
                <div className="w-16 h-16 rounded-full border border-slate-200" />
                <div className="w-4 h-4 rounded-full bg-rose-100 border border-rose-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                </div>

                {/* Target direction needle */}
                <div
                  className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
                  style={{ transform: `rotate(${guidance.relativeBearing}deg)` }}
                >
                  <div className="w-1 h-20 -top-2 absolute flex flex-col items-center">
                    <Navigation className="w-5 h-5 text-blue-600 fill-blue-600 animate-bounce" />
                  </div>
                </div>

                {/* Target Dot on radar */}
                {(() => {
                  const maxRadarDist = 15.0; // 15m scale
                  const scale = Math.min(1.0, guidance.distanceToTarget / maxRadarDist);
                  const radius = scale * 80;
                  const rad = (guidance.relativeBearing * Math.PI) / 180;
                  const dotX = radius * Math.sin(rad);
                  const dotY = -radius * Math.cos(rad);

                  return (
                    <div
                      className="absolute w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-[8px] font-bold text-white transition-all duration-300"
                      style={{
                        transform: `translate(${dotX}px, ${dotY}px)`,
                      }}
                    >
                      ★
                    </div>
                  );
                })()}
              </div>

              {/* Proximity Distance Big Display */}
              <div className="mt-3 text-center">
                <span className="text-[11px] text-slate-500 font-medium block">距目标点距离</span>
                <span
                  className={`text-3xl font-mono font-black ${
                    guidance.isAligned
                      ? 'text-emerald-600 animate-pulse'
                      : guidance.distanceToTarget < 1.0
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {guidance.distanceToTarget.toFixed(3)} <span className="text-sm">m</span>
                </span>
                {guidance.isAligned && (
                  <div className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1 mt-1">
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col items-center">
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col items-center">
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col items-center">
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
            <span className="text-[11px] text-slate-500 font-medium">模拟微调杆位 (步进0.5m):</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => nudgePosition(0.000005, 0)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                北↑
              </button>
              <button
                onClick={() => nudgePosition(-0.000005, 0)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                南↓
              </button>
              <button
                onClick={() => nudgePosition(0, -0.000005)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                西←
              </button>
              <button
                onClick={() => nudgePosition(0, 0.000005)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium cursor-pointer shadow-2xs"
              >
                东→
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
          >
            完成放样退出
          </button>
        </div>
      </div>
    </div>
  );
};
