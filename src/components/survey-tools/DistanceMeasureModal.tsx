import React, { useState, useMemo } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { calculateDistanceAndAzimuth, latLonToGauss } from '../../utils/geodesy';
import { Ruler, X, Flag, Navigation, MapPin, Compass, Crosshair, ArrowRight } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface DistanceMeasureModalProps {
  onClose: () => void;
}

export const DistanceMeasureModal: React.FC<DistanceMeasureModalProps> = ({ onClose }) => {
  const { points, currentProject } = useSurveyData();
  const { rtkState } = useRTK();

  const [mode, setMode] = useState<'two_points' | 'dynamic_walk'>('dynamic_walk');
  const [startPointId, setStartPointId] = useState<string>(points[0]?.id || '');
  const [endPointId, setEndPointId] = useState<string>(points[1]?.id || points[0]?.id || '');

  // 标定起始位置 (RTK 实时坐标作为自定义起点)
  const [calibratedStart, setCalibratedStart] = useState<{
    lat: number;
    lon: number;
    alt: number;
    x: number;
    y: number;
    timeStr: string;
  } | null>(null);

  // 当前实时 RTK 高斯平面坐标
  const currentGauss = useMemo(() => {
    return latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );
  }, [rtkState.currentLat, rtkState.currentLon, currentProject.centralMeridian, currentProject.coordSystem]);

  // 标定当前位置为起点
  const handleCalibrateCurrentAsStart = () => {
    soundService.playSuccess();
    setCalibratedStart({
      lat: rtkState.currentLat,
      lon: rtkState.currentLon,
      alt: rtkState.currentAlt,
      x: currentGauss.x,
      y: currentGauss.y,
      timeStr: new Date().toLocaleTimeString(),
    });
  };

  const p1 = points.find((p) => p.id === startPointId);
  const p2 = points.find((p) => p.id === endPointId);

  // 两选点计算
  const twoPointsCalc = useMemo(() => {
    if (!p1 || !p2) return null;
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
  }, [p1, p2]);

  // 动态移动距离计算（从标定起点到当前实时 RTK 位置）
  const dynamicWalkCalc = useMemo(() => {
    const origin = calibratedStart
      ? { x: calibratedStart.x, y: calibratedStart.y, alt: calibratedStart.alt }
      : p1
      ? { x: p1.x, y: p1.y, alt: p1.elevation }
      : null;

    if (!origin) return null;

    const { distance, azimuth, azimuthDms } = calculateDistanceAndAzimuth(
      origin.x,
      origin.y,
      currentGauss.x,
      currentGauss.y
    );
    const deltaH = rtkState.currentAlt - origin.alt;
    const slopeDist = Math.sqrt(distance * distance + deltaH * deltaH);

    // 如果选了目标点 P2，计算剩余距离
    let remainDist = null;
    if (p2) {
      const rem = calculateDistanceAndAzimuth(currentGauss.x, currentGauss.y, p2.x, p2.y);
      remainDist = rem.distance;
    }

    return {
      movedPlanDist: distance,
      movedSlopeDist: slopeDist,
      deltaH,
      azimuthDms,
      azimuth,
      remainDist,
      originName: calibratedStart ? '标定起点' : p1?.name || '起点',
    };
  }, [calibratedStart, p1, p2, currentGauss, rtkState.currentAlt]);

  // 雷达网格画布渲染计算
  const radarView = useMemo(() => {
    // 确定参考原点 (标定起点 或 P1 或 当前位置)
    const originX = calibratedStart ? calibratedStart.x : p1 ? p1.x : currentGauss.x;
    const originY = calibratedStart ? calibratedStart.y : p1 ? p1.y : currentGauss.y;

    // 当前位置相对于原点 (米)
    const curDx = currentGauss.y - originY; // 东向偏差 (m)
    const curDy = currentGauss.x - originX; // 北向偏差 (m)

    // 目标点 P2 相对于原点 (米)
    const p2Dx = p2 ? p2.y - originY : 0;
    const p2Dy = p2 ? p2.x - originX : 0;

    // 自适应雷达范围
    const maxDist = Math.max(
      20,
      Math.hypot(curDx, curDy) * 1.35,
      p2 ? Math.hypot(p2Dx, p2Dy) * 1.35 : 0
    );

    const scale = 110 / maxDist; // 半径 110px 映射到 maxDist 米

    return {
      maxDist: Math.ceil(maxDist),
      curPos: { x: curDx * scale, y: -curDy * scale },
      targetPos: p2 ? { x: p2Dx * scale, y: -p2Dy * scale } : null,
      originPos: { x: 0, y: 0 },
    };
  }, [calibratedStart, p1, p2, currentGauss]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-100 text-cyan-700 rounded-lg">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">长度测量与雷达网格</h2>
              <p className="text-[10px] text-slate-500">标定起点实时测距 / 两个选点基准测量</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switch: 动态标定测距 vs 选点测距 */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setMode('dynamic_walk')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'dynamic_walk'
                ? 'bg-white text-cyan-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>现场标定移动测距 (实时)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('two_points')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'two_points'
                ? 'bg-white text-cyan-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>点库两选点测距 (基准)</span>
          </button>
        </div>

        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* 雷达网格支持视图 (Visual Radar Map Canvas) */}
          <div className="bg-slate-900 rounded-2xl p-3 text-white relative overflow-hidden border border-slate-800 flex flex-col items-center">
            <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>雷达网格 (半径: {radarView.maxDist}m)</span>
            </div>

            <div className="absolute top-2.5 right-3 flex items-center gap-2 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                RTK在线
              </span>
            </div>

            {/* Radar Grid Graphic */}
            <div className="w-56 h-56 relative my-1 flex items-center justify-center">
              {/* Outer circle and range circles */}
              <div className="absolute inset-0 rounded-full border border-slate-700/80" />
              <div className="absolute w-40 h-40 rounded-full border border-slate-800 border-dashed" />
              <div className="absolute w-24 h-24 rounded-full border border-slate-800" />

              {/* Crosshairs */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />
              <div className="absolute top-1 text-[9px] font-mono text-slate-500">N (北)</div>
              <div className="absolute right-1 text-[9px] font-mono text-slate-500">E (东)</div>

              {/* Distance scale text */}
              <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-500">
                环距: {(radarView.maxDist / 2).toFixed(1)}m
              </div>

              {/* Line connecting Origin to Current Position */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line
                  x1="112"
                  y1="112"
                  x2={112 + radarView.curPos.x}
                  y2={112 + radarView.curPos.y}
                  stroke="#06B6D4"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                {radarView.targetPos && (
                  <line
                    x1="112"
                    y1="112"
                    x2={112 + radarView.targetPos.x}
                    y2={112 + radarView.targetPos.y}
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                  />
                )}
              </svg>

              {/* Origin Point (0,0) - Red Flag / Start point */}
              <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-[10px]">
                  🚩
                </div>
                <span className="text-[9px] font-mono font-bold text-rose-300 mt-0.5 bg-slate-900/80 px-1 rounded">
                  起点
                </span>
              </div>

              {/* Target Point (P2) if configured */}
              {radarView.targetPos && (
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300"
                  style={{
                    left: 112 + radarView.targetPos.x,
                    top: 112 + radarView.targetPos.y,
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-amber-500 border border-white flex items-center justify-center text-[8px] font-bold text-slate-900">
                    P2
                  </div>
                  <span className="text-[8px] font-mono text-amber-300 mt-0.5 bg-slate-900/80 px-1 rounded">
                    {p2?.name}
                  </span>
                </div>
              )}

              {/* Current RTK Mobile Position */}
              <div
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-200"
                style={{
                  left: 112 + radarView.curPos.x,
                  top: 112 + radarView.curPos.y,
                }}
              >
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute w-5 h-5 rounded-full bg-cyan-400 opacity-60" />
                  <div
                    className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-md flex items-center justify-center transition-transform"
                    style={{ transform: `rotate(${rtkState.heading}deg)` }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-cyan-300 mt-0.5 bg-slate-900/90 px-1 rounded">
                  当前位置
                </span>
              </div>
            </div>

            {/* Radar status summary bar */}
            <div className="w-full flex justify-between items-center px-2 py-1.5 bg-slate-800/80 rounded-xl text-[11px] font-mono mt-1">
              <span className="text-slate-400">
                当前移动平距: <strong className="text-cyan-400 text-sm">{dynamicWalkCalc?.movedPlanDist.toFixed(3) || '0.000'}m</strong>
              </span>
              <span className="text-slate-400">
                方位角: <strong className="text-amber-300">{dynamicWalkCalc?.azimuthDms || '0°00\'00"'}</strong>
              </span>
            </div>
          </div>

          {/* Controls based on active mode */}
          {mode === 'dynamic_walk' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">现场起点标定</span>
                  <span className="text-[10px] text-slate-500">
                    {calibratedStart
                      ? `已于 ${calibratedStart.timeStr} 标定当前位置为起点`
                      : '尚未标定，默认以点库起点 P1 作为测距基准'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCalibrateCurrentAsStart}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>标定当前为起点 (P0)</span>
                </button>
              </div>

              {/* Big Distance Stat Cards */}
              {dynamicWalkCalc && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white border border-cyan-200 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] font-bold text-cyan-800 block">目前已移动水平平距</span>
                    <div className="text-2xl font-mono font-black text-cyan-600 mt-0.5">
                      {dynamicWalkCalc.movedPlanDist.toFixed(3)} <span className="text-xs font-sans">m</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      基准起点: {dynamicWalkCalc.originName}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-700 block">空间斜距 (3D) & 高差</span>
                    <div className="text-2xl font-mono font-black text-slate-800 mt-0.5">
                      {dynamicWalkCalc.movedSlopeDist.toFixed(3)} <span className="text-xs font-sans">m</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-600 block mt-1">
                      ΔH: {dynamicWalkCalc.deltaH >= 0 ? `+${dynamicWalkCalc.deltaH.toFixed(3)}` : dynamicWalkCalc.deltaH.toFixed(3)}m
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">点库两个选点标定测量</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">起点 (P1)</label>
                  <select
                    value={startPointId}
                    onChange={(e) => setStartPointId(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-cyan-500 focus:outline-hidden"
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
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:border-cyan-500 focus:outline-hidden"
                  >
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (H:{p.elevation}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {twoPointsCalc && (
                <div className="space-y-2 pt-1">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-500 font-medium block">两选点间水平平距</span>
                    <span className="text-3xl font-mono font-black text-cyan-600">
                      {twoPointsCalc.planDist.toFixed(3)} <span className="text-sm font-sans">m</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[10px] text-slate-500 block">空间斜距 (3D):</span>
                      <strong className="text-slate-900">{twoPointsCalc.slopeDist.toFixed(3)} m</strong>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[10px] text-slate-500 block">高差 (ΔH):</span>
                      <strong className="text-emerald-600">
                        {twoPointsCalc.deltaH >= 0 ? `+${twoPointsCalc.deltaH.toFixed(3)}` : twoPointsCalc.deltaH.toFixed(3)} m
                      </strong>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[10px] text-slate-500 block">坐标方位角:</span>
                      <strong className="text-amber-600">{twoPointsCalc.azimuthDms}</strong>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[10px] text-slate-500 block">坡度百分比:</span>
                      <strong className="text-purple-600">{twoPointsCalc.slopePct}%</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            RTK坐标: X={currentGauss.x.toFixed(2)} Y={currentGauss.y.toFixed(2)} H={rtkState.currentAlt.toFixed(2)}m
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition"
          >
            完成退出
          </button>
        </div>
      </div>
    </div>
  );
};
