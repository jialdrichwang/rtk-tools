import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { latLonToGauss, calculateLineStakeout } from '../../utils/geodesy';
import { GitCommit, Split, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface LineStakeoutModalProps {
  onClose: () => void;
  isEquidistant?: boolean;
}

export const LineStakeoutModal: React.FC<LineStakeoutModalProps> = ({
  onClose,
  isEquidistant = false,
}) => {
  const { points, currentProject } = useSurveyData();
  const { rtkState } = useRTK();

  const [startPointId, setStartPointId] = useState<string>(points[0]?.id || '');
  const [endPointId, setEndPointId] = useState<string>(points[1]?.id || points[0]?.id || '');
  const [interval, setInterval] = useState(20); // 20m interval for equidistant

  const p1 = points.find((p) => p.id === startPointId);
  const p2 = points.find((p) => p.id === endPointId);

  const currGauss = latLonToGauss(
    rtkState.currentLat,
    rtkState.currentLon,
    currentProject.centralMeridian,
    currentProject.coordSystem
  );

  const lineResult = p1 && p2
    ? calculateLineStakeout(p1.x, p1.y, p2.x, p2.y, currGauss.x, currGauss.y)
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEquidistant ? (
              <Split className="w-5 h-5 text-purple-600" />
            ) : (
              <GitCommit className="w-5 h-5 text-teal-600" />
            )}
            <h2 className="text-sm font-bold text-slate-900">
              {isEquidistant ? '等距放样 (Equidistant Stakeout)' : '直线放样 (Line Stakeout)'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Baseline selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">选择放样基准线 (起点至终点)</span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">起点 (A)</label>
                <select
                  value={startPointId}
                  onChange={(e) => setStartPointId(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
                >
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">终点 (B)</label>
                <select
                  value={endPointId}
                  onChange={(e) => setEndPointId(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
                >
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isEquidistant && (
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">等间距步长 (米)</label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(parseFloat(e.target.value) || 10)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Line Stakeout Real-time Results */}
          {lineResult && (
            <div className="space-y-3">
              {/* Chainage Mileage Big Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <span className="text-[11px] text-slate-500 block font-sans font-medium">当前投影里程 (Chainage Mileage)</span>
                <span className="text-3xl font-mono font-black text-teal-600">
                  K0+{lineResult.chainage.toFixed(3)}
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  总线长: {lineResult.totalLength}m
                </span>
              </div>

              {/* Offset Guidance */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-sans font-medium">法向偏距 (Offset)</span>
                  <div className="flex items-center gap-1 mt-1 text-slate-900 font-bold text-base">
                    {lineResult.offset >= 0 ? (
                      <ArrowRight className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      {lineResult.offset >= 0 ? '右偏 ' : '左偏 '}
                      {Math.abs(lineResult.offset).toFixed(3)}m
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-sans font-medium">对准状态</span>
                  <div
                    className={`mt-1 font-bold text-sm ${
                      Math.abs(lineResult.offset) <= 0.02
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {Math.abs(lineResult.offset) <= 0.02 ? '● 已在中线上' : '○ 需偏向微调'}
                  </div>
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
