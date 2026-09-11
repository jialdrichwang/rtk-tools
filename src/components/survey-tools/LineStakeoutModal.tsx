import React, { useState, useMemo } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { latLonToGauss, calculateLineStakeout, calculateDistanceAndAzimuth } from '../../utils/geodesy';
import { GitCommit, Split, ArrowLeft, ArrowRight, X, Compass, Navigation, MapPin } from 'lucide-react';
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

  const currGauss = useMemo(() => {
    return latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );
  }, [rtkState.currentLat, rtkState.currentLon, currentProject.centralMeridian, currentProject.coordSystem]);

  const lineResult = useMemo(() => {
    if (!p1 || !p2) return null;
    return calculateLineStakeout(p1.x, p1.y, p2.x, p2.y, currGauss.x, currGauss.y);
  }, [p1, p2, currGauss]);

  // 基准线总长与方位角
  const baselineInfo = useMemo(() => {
    if (!p1 || !p2 || p1.id === p2.id) return null;
    return calculateDistanceAndAzimuth(p1.x, p1.y, p2.x, p2.y);
  }, [p1, p2]);

  // 等距放样桩点列表计算 (加入严格安全防护防止除以0或DOM爆炸卡死)
  const equidistantStakes = useMemo(() => {
    if (!p1 || !p2 || p1.id === p2.id || !baselineInfo || baselineInfo.distance <= 0) return [];
    const safeInterval = Math.max(0.5, Number(interval) || 20);
    const count = Math.min(Math.floor(baselineInfo.distance / safeInterval), 200);
    const stakes = [];
    const totalDist = baselineInfo.distance;

    // 起点
    stakes.push({ chainage: 0, label: 'K0+000', x: p1.x, y: p1.y });

    for (let i = 1; i <= count; i++) {
      const dist = i * safeInterval;
      if (dist >= totalDist) break;
      const ratio = dist / totalDist;
      const sx = p1.x + (p2.x - p1.x) * ratio;
      const sy = p1.y + (p2.y - p1.y) * ratio;
      stakes.push({
        chainage: dist,
        label: `K0+${dist.toFixed(0).padStart(3, '0')}`,
        x: sx,
        y: sy,
      });
    }

    // 终点
    if (totalDist > 0 && Math.abs(count * safeInterval - totalDist) > 0.05) {
      stakes.push({ chainage: totalDist, label: `K0+${totalDist.toFixed(1)}`, x: p2.x, y: p2.y });
    }
    return stakes;
  }, [p1, p2, baselineInfo, interval]);

  // 雷达与工程网格坐标映射计算
  const radarGrid = useMemo(() => {
    if (!p1 || !p2 || p1.id === p2.id) return null;

    // 基准坐标系：以 P1 为原点 (0,0)
    // 旋转基准线使 P1 -> P2 沿 Y 轴向上 (里程方向为向上，左右偏差为横轴)
    const baseDx = p2.y - p1.y; // 东偏
    const baseDy = p2.x - p1.x; // 北偏
    const baseLength = Math.hypot(baseDx, baseDy);
    if (baseLength <= 0.001) return null;

    // 单位沿线向量与法向量
    const uX = baseDx / baseLength;
    const uY = baseDy / baseLength;

    // 当前位置相对于 P1
    const curDx = currGauss.y - p1.y;
    const curDy = currGauss.x - p1.x;

    // 投影里程 (沿着基准线方向)
    const curChainage = curDx * uX + curDy * uY;
    // 偏距 (正右负左)
    const curOffset = curDx * (-uY) + curDy * uX;

    // 画布缩放：宽度 260px，高度 200px
    const maxDimension = Math.max(baseLength, 40, Math.abs(curOffset) * 2.5);
    const scale = 170 / maxDimension;

    // 起点位于画布底部居中 (130, 180)，终点位于上方
    const canvasOrigin = { x: 130, y: 180 };
    const p1Pos = { x: canvasOrigin.x, y: canvasOrigin.y };
    const p2Pos = { x: canvasOrigin.x, y: canvasOrigin.y - baseLength * scale };

    // 当前位置在画布上的坐标
    const curPos = {
      x: canvasOrigin.x + curOffset * scale,
      y: canvasOrigin.y - curChainage * scale,
    };

    // 垂足在基准线上的投影坐标
    const projPos = {
      x: canvasOrigin.x,
      y: canvasOrigin.y - curChainage * scale,
    };

    return {
      p1Pos,
      p2Pos,
      curPos,
      projPos,
      curChainage,
      curOffset,
      baseLength,
      scale,
      canvasOrigin,
    };
  }, [p1, p2, currGauss]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
              {isEquidistant ? <Split className="w-5 h-5" /> : <GitCommit className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEquidistant ? '等距放样与雷达网格 (Equidistant)' : '直线放样与雷达网格 (Line Stakeout)'}
              </h2>
              <p className="text-[10px] text-slate-500">基准线投影里程 / 垂直偏距实时导引</p>
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
          {/* 雷达与基准线工程网格画布 (Radar Engineering Grid) */}
          {radarGrid && (
            <div className="bg-slate-900 rounded-2xl p-3 text-white relative overflow-hidden border border-slate-800 flex flex-col items-center">
              <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1 px-1">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-teal-400" />
                  基准线网格 (总长: {radarGrid.baseLength.toFixed(2)}m)
                </span>
                <span className="text-teal-400 font-bold">
                  {isEquidistant ? `步长: ${interval}m (${equidistantStakes.length}桩)` : '连续直线'}
                </span>
              </div>

              {/* Graphic Canvas Area */}
              <div className="w-64 h-52 relative border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden flex items-center justify-center">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:20px_20px] opacity-40" />

                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Baseline (A -> B) */}
                  <line
                    x1={radarGrid.p1Pos.x}
                    y1={radarGrid.p1Pos.y}
                    x2={radarGrid.p2Pos.x}
                    y2={radarGrid.p2Pos.y}
                    stroke="#14B8A6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Offset Projection Line from Current Position to Baseline */}
                  <line
                    x1={radarGrid.curPos.x}
                    y1={radarGrid.curPos.y}
                    x2={radarGrid.projPos.x}
                    y2={radarGrid.projPos.y}
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Equidistant Stake Marks along baseline */}
                  {isEquidistant &&
                    equidistantStakes.map((stk, idx) => {
                      const sy = radarGrid.canvasOrigin.y - stk.chainage * radarGrid.scale;
                      return (
                        <g key={idx}>
                          <circle cx={radarGrid.canvasOrigin.x} cy={sy} r="3" fill="#A855F7" />
                          <line
                            x1={radarGrid.canvasOrigin.x - 5}
                            y1={sy}
                            x2={radarGrid.canvasOrigin.x + 5}
                            y2={sy}
                            stroke="#D8B4FE"
                            strokeWidth="1"
                          />
                        </g>
                      );
                    })}
                </svg>

                {/* Point A (Start) */}
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
                  style={{ left: radarGrid.p1Pos.x, top: radarGrid.p1Pos.y }}
                >
                  <div className="w-4 h-4 rounded-full bg-teal-500 border border-white flex items-center justify-center text-[8px] font-bold text-slate-900">
                    A
                  </div>
                  <span className="text-[8px] font-mono text-teal-300 bg-slate-900/80 px-1 rounded">
                    起点(K0+000)
                  </span>
                </div>

                {/* Point B (End) */}
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
                  style={{ left: radarGrid.p2Pos.x, top: radarGrid.p2Pos.y }}
                >
                  <div className="w-4 h-4 rounded-full bg-teal-500 border border-white flex items-center justify-center text-[8px] font-bold text-slate-900">
                    B
                  </div>
                  <span className="text-[8px] font-mono text-teal-300 bg-slate-900/80 px-1 rounded">
                    终点
                  </span>
                </div>

                {/* Current RTK Position Dot */}
                <div
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-200"
                  style={{ left: radarGrid.curPos.x, top: radarGrid.curPos.y }}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute w-5 h-5 rounded-full bg-cyan-400 opacity-75" />
                    <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-md flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  </div>
                  <span className="text-[8px] font-mono font-bold text-cyan-300 mt-0.5 bg-slate-900/90 px-1 rounded whitespace-nowrap">
                    我的位置
                  </span>
                </div>
              </div>

              {/* Status footer bar */}
              <div className="w-full flex justify-between items-center px-3 py-1.5 bg-slate-800/80 rounded-xl text-[11px] font-mono mt-2">
                <span className="text-slate-300">
                  投影里程:{' '}
                  <strong className="text-teal-400 text-sm">
                    K0+{radarGrid.curChainage.toFixed(3)}
                  </strong>
                </span>
                <span className="text-slate-300">
                  偏距:{' '}
                  <strong
                    className={`text-sm ${
                      Math.abs(radarGrid.curOffset) < 0.05 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {radarGrid.curOffset >= 0
                      ? `偏右 ${radarGrid.curOffset.toFixed(3)}m`
                      : `偏左 ${Math.abs(radarGrid.curOffset).toFixed(3)}m`}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* 起终点重合提示 */}
          {p1 && p2 && p1.id === p2.id && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
              <span className="font-bold">提示：</span>
              <span>起点与终点不能为同一个点，请选择不同的测点以构建基准线。</span>
            </div>
          )}

          {/* Baseline selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 block">放样基准线 (起点至终点)</span>
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  const tmp = startPointId;
                  setStartPointId(endPointId);
                  setEndPointId(tmp);
                }}
                className="text-[11px] text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-lg cursor-pointer transition flex items-center gap-1 font-sans"
              >
                <span>起终点互换</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">起点 (A)</label>
                <select
                  value={startPointId}
                  onChange={(e) => setStartPointId(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-teal-500 focus:outline-hidden"
                >
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code || '无编码'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">终点 (B)</label>
                <select
                  value={endPointId}
                  onChange={(e) => setEndPointId(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-teal-500 focus:outline-hidden"
                >
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code || '无编码'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isEquidistant && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-semibold text-slate-500">等间距步长 (米)</label>
                  <span className="text-[10px] font-mono text-purple-700 font-bold">
                    共规划 {equidistantStakes.length} 个等距桩点
                  </span>
                </div>
                <input
                  type="number"
                  min="0.5"
                  step="1"
                  value={interval}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setInterval(isNaN(val) || val <= 0 ? 10 : val);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-purple-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Line Stakeout Guidance Cards */}
          {lineResult && (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 font-sans font-medium block">
                  横向偏距导引
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {lineResult.offset >= 0 ? (
                    <ArrowRight className="w-4 h-4 text-amber-600" />
                  ) : (
                    <ArrowLeft className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="text-base font-bold text-slate-900">
                    {lineResult.offset >= 0 ? '向右' : '向左'} {Math.abs(lineResult.offset).toFixed(3)}m
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 font-sans font-medium block">
                  基线设计总长
                </span>
                <div className="text-base font-bold text-teal-700 mt-1">
                  {baselineInfo?.distance.toFixed(3) || '0.000'} m
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            高斯投影: X={currGauss.x.toFixed(2)} Y={currGauss.y.toFixed(2)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition"
          >
            完成退出
          </button>
        </div>
      </div>
    </div>
  );
};
