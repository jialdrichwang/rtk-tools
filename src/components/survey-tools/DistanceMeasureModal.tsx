import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { calculateDistanceAndAzimuth } from '../../utils/geodesy';
import { Ruler, X, ArrowRight } from 'lucide-react';

interface DistanceMeasureModalProps {
  onClose: () => void;
}

export const DistanceMeasureModal: React.FC<DistanceMeasureModalProps> = ({ onClose }) => {
  const { points } = useSurveyData();
  const [startPointId, setStartPointId] = useState<string>(points[0]?.id || '');
  const [endPointId, setEndPointId] = useState<string>(points[1]?.id || points[0]?.id || '');

  const p1 = points.find((p) => p.id === startPointId);
  const p2 = points.find((p) => p.id === endPointId);

  const calc = p1 && p2
    ? (() => {
        const { distance, azimuth, azimuthDms } = calculateDistanceAndAzimuth(p1.x, p1.y, p2.x, p2.y);
        const deltaH = p2.elevation - p1.elevation;
        const slopeDist = Math.sqrt(distance * distance + deltaH * deltaH);
        const slopePct = distance > 0 ? (deltaH / distance) * 100 : 0;

        return {
          planDist: distance,
          slopeDist: Math.round(slopeDist * 1000) / 1000,
          deltaH: Math.round(deltaH * 1000) / 1000,
          azimuth,
          azimuthDms,
          slopePct: Math.round(slopePct * 100) / 100,
        };
      })()
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-cyan-600" />
            <h2 className="text-sm font-bold text-slate-900">长度与高差测量 (Distance & Height Diff)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Select Points */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">起点 (P1)</label>
              <select
                value={startPointId}
                onChange={(e) => setStartPointId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
              >
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (H:{p.elevation}m)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">终点 (P2)</label>
              <select
                value={endPointId}
                onChange={(e) => setEndPointId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
              >
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (H:{p.elevation}m)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Display */}
          {calc && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <span className="text-[11px] text-slate-500 block font-medium">水平平距 (Planar Distance)</span>
                <span className="text-3xl font-mono font-black text-cyan-600">
                  {calc.planDist.toFixed(3)} <span className="text-sm font-sans">m</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">空间斜距 (3D Distance):</span>
                  <span className="text-slate-900 font-bold text-sm">{calc.slopeDist.toFixed(3)} m</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">高差 (ΔH = H2 - H1):</span>
                  <span className="text-emerald-600 font-bold text-sm">
                    {calc.deltaH >= 0 ? `+${calc.deltaH.toFixed(3)}` : `${calc.deltaH.toFixed(3)}`} m
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">坐标方位角 (Azimuth):</span>
                  <span className="text-amber-600 font-bold text-sm">{calc.azimuthDms}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">坡度百分比 (Grade %):</span>
                  <span className="text-purple-600 font-bold text-sm">{calc.slopePct}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
          >
            完成退出
          </button>
        </div>
      </div>
    </div>
  );
};
