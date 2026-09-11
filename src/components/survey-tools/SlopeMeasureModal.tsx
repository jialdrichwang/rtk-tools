import React, { useState, useMemo } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { calculateDistanceAndAzimuth, latLonToGauss } from '../../utils/geodesy';
import { TrendingDown, X, Compass, ArrowUp, ArrowDown } from 'lucide-react';

interface SlopeMeasureModalProps {
  onClose: () => void;
}

export const SlopeMeasureModal: React.FC<SlopeMeasureModalProps> = ({ onClose }) => {
  const { points, currentProject } = useSurveyData();
  const { rtkState } = useRTK();

  const [topPointId, setTopPointId] = useState<string>(points[0]?.id || '');
  const [bottomPointId, setBottomPointId] = useState<string>(points[1]?.id || points[0]?.id || '');

  const p1 = points.find((p) => p.id === topPointId);
  const p2 = points.find((p) => p.id === bottomPointId);

  const currGauss = useMemo(() => {
    return latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );
  }, [rtkState.currentLat, rtkState.currentLon, currentProject.centralMeridian, currentProject.coordSystem]);

  const calc = useMemo(() => {
    if (!p1 || !p2) return null;
    const { distance } = calculateDistanceAndAzimuth(p1.x, p1.y, p2.x, p2.y);
    const deltaH = p1.elevation - p2.elevation; // 坡顶到坡底高差
    const absDeltaH = Math.abs(deltaH);

    const slopePct = distance > 0 ? (absDeltaH / distance) * 100 : 0;
    const slopeAngle = distance > 0 ? (Math.atan(absDeltaH / distance) * 180) / Math.PI : 0;
    const ratioN = absDeltaH > 0 ? distance / absDeltaH : 0;

    // 当前位置相对于坡底的高差
    const curDeltaH = rtkState.currentAlt - p2.elevation;

    return {
      distance,
      deltaH,
      absDeltaH,
      slopePct: Math.round(slopePct * 100) / 100,
      slopeAngle: Math.round(slopeAngle * 100) / 100,
      ratioStr: ratioN > 0 ? `1 : ${ratioN.toFixed(2)}` : '平坡',
      ratioN,
      curDeltaH,
    };
  }, [p1, p2, rtkState.currentAlt]);

  // 坡面剖面网格投影画布参数
  const profileGraphic = useMemo(() => {
    if (!calc || calc.distance <= 0) return null;

    const canvasW = 260;
    const canvasH = 150;
    const pad = 24;

    const maxW = calc.distance;
    const maxH = Math.max(calc.absDeltaH, 1);

    const scaleX = (canvasW - pad * 2) / maxW;
    const scaleY = (canvasH - pad * 2) / Math.max(maxH, maxW * 0.4);

    // 坡底位于左下方，坡顶位于右上方
    const bottomPos = { x: pad, y: canvasH - pad };
    const topPos = { x: canvasW - pad, y: pad };

    return {
      canvasW,
      canvasH,
      bottomPos,
      topPos,
      scaleX,
      scaleY,
    };
  }, [calc]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">边坡坡度测量与剖面网格</h2>
              <p className="text-[10px] text-slate-500">坡比 1:m / 倾角 / 水平平距与立面高差</p>
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
          {/* Select Points */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">坡顶点 (Top Point)</label>
              <select
                value={topPointId}
                onChange={(e) => setTopPointId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
              >
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (H:{p.elevation.toFixed(2)}m)
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
                    {p.name} (H:{p.elevation.toFixed(2)}m)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 边坡剖面工程网格 (Slope Cross-Section Grid) */}
          {profileGraphic && (
            <div className="bg-slate-900 rounded-2xl p-3 text-white border border-slate-800 flex flex-col items-center relative overflow-hidden">
              <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  边坡剖面网格 (水平平距: {calc?.distance.toFixed(2)}m)
                </span>
                <span className="text-blue-400 font-bold">边坡比: {calc?.ratioStr}</span>
              </div>

              {/* Graphic Profile Canvas */}
              <div className="w-64 h-40 relative border border-slate-800 rounded-xl bg-slate-950/70 overflow-hidden flex items-center justify-center">
                {/* Background grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-40" />

                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Fill Polygon under slope */}
                  <polygon
                    points={`${profileGraphic.bottomPos.x},${profileGraphic.bottomPos.y} ${profileGraphic.topPos.x},${profileGraphic.bottomPos.y} ${profileGraphic.topPos.x},${profileGraphic.topPos.y}`}
                    fill="#3B82F6"
                    fillOpacity="0.12"
                  />

                  {/* Slope Face Line */}
                  <line
                    x1={profileGraphic.bottomPos.x}
                    y1={profileGraphic.bottomPos.y}
                    x2={profileGraphic.topPos.x}
                    y2={profileGraphic.topPos.y}
                    stroke="#3B82F6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Horizontal Run Base line */}
                  <line
                    x1={profileGraphic.bottomPos.x}
                    y1={profileGraphic.bottomPos.y}
                    x2={profileGraphic.topPos.x}
                    y2={profileGraphic.bottomPos.y}
                    stroke="#64748B"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Vertical Rise line */}
                  <line
                    x1={profileGraphic.topPos.x}
                    y1={profileGraphic.bottomPos.y}
                    x2={profileGraphic.topPos.x}
                    y2={profileGraphic.topPos.y}
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                </svg>

                {/* Bottom Point Label */}
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
                  style={{ left: profileGraphic.bottomPos.x, top: profileGraphic.bottomPos.y }}
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[7px] font-bold text-slate-900">
                    底
                  </div>
                  <span className="text-[7px] font-mono text-emerald-300 bg-slate-900/80 px-1 rounded">
                    坡底
                  </span>
                </div>

                {/* Top Point Label */}
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
                  style={{ left: profileGraphic.topPos.x, top: profileGraphic.topPos.y }}
                >
                  <div className="w-4 h-4 rounded-full bg-blue-500 border border-white flex items-center justify-center text-[7px] font-bold text-slate-900">
                    顶
                  </div>
                  <span className="text-[7px] font-mono text-blue-300 bg-slate-900/80 px-1 rounded">
                    坡顶
                  </span>
                </div>

                {/* Vertical delta text */}
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-emerald-400 bg-slate-900/90 px-1 rounded"
                  style={{
                    left: profileGraphic.topPos.x - 22,
                    top: (profileGraphic.bottomPos.y + profileGraphic.topPos.y) / 2,
                  }}
                >
                  ΔH={calc?.absDeltaH.toFixed(2)}m
                </div>

                {/* Current RTK elevation marker */}
                <div className="absolute bottom-1 left-2 text-[8px] font-mono text-cyan-400 bg-slate-900/80 px-1.5 py-0.5 rounded">
                  当前RTK高程: {rtkState.currentAlt.toFixed(2)}m
                </div>
              </div>

              {/* Status summary bar */}
              <div className="w-full flex justify-between items-center px-3 py-1.5 bg-slate-800/80 rounded-xl text-[11px] font-mono mt-2">
                <span className="text-slate-300">
                  坡度倾角: <strong className="text-amber-400">{calc?.slopeAngle}°</strong>
                </span>
                <span className="text-slate-300">
                  百分比: <strong className="text-emerald-400">{calc?.slopePct}%</strong>
                </span>
              </div>
            </div>
          )}

          {/* Detailed Measurement Cards */}
          {calc && (
            <div className="space-y-2">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] text-slate-500 block font-medium">边坡坡度比 (Slope Ratio 1:m)</span>
                <span className="text-3xl font-mono font-black text-blue-600 mt-0.5 block">
                  {calc.ratioStr}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-sans block">水平投影平距 (Run):</span>
                  <strong className="text-slate-900 text-sm">{calc.distance.toFixed(3)} m</strong>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-sans block">垂直落差高差 (Rise):</span>
                  <strong className="text-emerald-600 text-sm">{calc.absDeltaH.toFixed(3)} m</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            高斯: X={currGauss.x.toFixed(2)} Y={currGauss.y.toFixed(2)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition"
          >
            完成退出
          </button>
        </div>
      </div>
    </div>
  );
};
