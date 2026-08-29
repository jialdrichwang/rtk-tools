import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { calculateDistanceAndAzimuth } from '../../utils/geodesy';
import { TrendingDown, X } from 'lucide-react';

interface SlopeMeasureModalProps {
  onClose: () => void;
}

export const SlopeMeasureModal: React.FC<SlopeMeasureModalProps> = ({ onClose }) => {
  const { points } = useSurveyData();
  const [topPointId, setTopPointId] = useState<string>(points[0]?.id || '');
  const [bottomPointId, setBottomPointId] = useState<string>(points[1]?.id || points[0]?.id || '');

  const p1 = points.find((p) => p.id === topPointId);
  const p2 = points.find((p) => p.id === bottomPointId);

  const calc = p1 && p2
    ? (() => {
        const { distance } = calculateDistanceAndAzimuth(p1.x, p1.y, p2.x, p2.y);
        const deltaH = p2.elevation - p1.elevation;
        const absDeltaH = Math.abs(deltaH);

        const slopePct = distance > 0 ? (absDeltaH / distance) * 100 : 0;
        const slopeAngle = distance > 0 ? (Math.atan(absDeltaH / distance) * 180) / Math.PI : 0;
        const ratioN = absDeltaH > 0 ? distance / absDeltaH : 0;

        return {
          distance,
          deltaH,
          slopePct: Math.round(slopePct * 100) / 100,
          slopeAngle: Math.round(slopeAngle * 100) / 100,
          ratioStr: ratioN > 0 ? `1 : ${ratioN.toFixed(2)}` : '平坡',
        };
      })()
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">边坡坡度测量 (Slope Measurement)</h2>
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
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">坡顶点 (Top Point)</label>
              <select
                value={topPointId}
                onChange={(e) => setTopPointId(e.target.value)}
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
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">坡底点 (Bottom Point)</label>
              <select
                value={bottomPointId}
                onChange={(e) => setBottomPointId(e.target.value)}
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
                <span className="text-[11px] text-slate-500 block font-sans font-medium">边坡坡度比 (Slope Ratio 1:m)</span>
                <span className="text-3xl font-mono font-black text-blue-600">
                  {calc.ratioStr}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">坡度百分比 (Gradient %):</span>
                  <span className="text-emerald-600 font-bold text-sm">{calc.slopePct}%</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">坡度倾角 (Slope Angle):</span>
                  <span className="text-amber-600 font-bold text-sm">{calc.slopeAngle}°</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">水平平距 (Run):</span>
                  <span className="text-slate-900 font-bold text-sm">{calc.distance.toFixed(3)} m</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-sans font-medium block">垂直高差 (Rise):</span>
                  <span className="text-blue-600 font-bold text-sm">{Math.abs(calc.deltaH).toFixed(3)} m</span>
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
