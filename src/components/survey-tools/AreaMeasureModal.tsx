import React, { useState, useMemo } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { calculatePolygonArea, latLonToGauss, calculateDistanceAndAzimuth } from '../../utils/geodesy';
import {
  Maximize2,
  Plus,
  Trash2,
  X,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface AreaMeasureModalProps {
  onClose: () => void;
}

// 射线法判断点是否在多边形内部
function isPointInPolygon(point: { x: number; y: number }, vs: { x: number; y: number }[]) {
  if (vs.length < 3) return false;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x,
      yi = vs[i].y;
    const xj = vs[j].x,
      yj = vs[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const AreaMeasureModal: React.FC<AreaMeasureModalProps> = ({ onClose }) => {
  const { points, currentProject } = useSurveyData();
  const { rtkState } = useRTK();

  // 顶点序列列表
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>(
    points.slice(0, Math.min(5, points.length)).map((p) => p.id)
  );

  const selectedPoints = useMemo(() => {
    return selectedPointIds
      .map((id) => points.find((p) => p.id === id))
      .filter((p): p is typeof points[0] => !!p);
  }, [selectedPointIds, points]);

  // 当前 RTK 高斯平面坐标
  const currentGauss = useMemo(() => {
    return latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );
  }, [rtkState.currentLat, rtkState.currentLon, currentProject.centralMeridian, currentProject.coordSystem]);

  // 鞋带公式计算不规则面积与周长
  const areaResult = useMemo(() => {
    return calculatePolygonArea(selectedPoints.map((p) => ({ x: p.x, y: p.y })));
  }, [selectedPoints]);

  // 计算各边边长列表
  const edges = useMemo(() => {
    if (selectedPoints.length < 2) return [];
    const list = [];
    for (let i = 0; i < selectedPoints.length; i++) {
      const pA = selectedPoints[i];
      const pB = selectedPoints[(i + 1) % selectedPoints.length];
      const d = Math.hypot(pB.x - pA.x, pB.y - pA.y);
      list.push({
        from: pA.name,
        to: pB.name,
        dist: d,
      });
    }
    return list;
  }, [selectedPoints]);

  // 判定当前 RTK 点是否在不规则地块内部
  const isInside = useMemo(() => {
    if (selectedPoints.length < 3) return false;
    return isPointInPolygon(
      { x: currentGauss.x, y: currentGauss.y },
      selectedPoints.map((p) => ({ x: p.x, y: p.y }))
    );
  }, [selectedPoints, currentGauss]);

  // 现场 RTK 采集一个新界址拐角点
  const handleAddCurrentPoint = () => {
    soundService.playSuccess();
    const newPtId = `boundary_pt_${Date.now()}`;
    const syntheticPoint = {
      id: newPtId,
      name: `界址点 J${selectedPointIds.length + 1}`,
      code: 'JZD',
      lat: rtkState.currentLat,
      lon: rtkState.currentLon,
      elevation: rtkState.currentAlt,
      x: currentGauss.x,
      y: currentGauss.y,
      coordSystem: currentProject.coordSystem,
      createdAt: new Date().toISOString(),
    };

    points.push(syntheticPoint);
    setSelectedPointIds((prev) => [...prev, newPtId]);
  };

  // 删除顶点
  const handleRemovePoint = (id: string) => {
    soundService.playClick();
    setSelectedPointIds((prev) => prev.filter((i) => i !== id));
  };

  // 雷达与不规则外形几何投影画布
  const canvasProjection = useMemo(() => {
    if (selectedPoints.length === 0) return null;

    // 计算包围盒 Bounding Box
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    const allPts = [
      ...selectedPoints.map((p) => ({ x: p.x, y: p.y })),
      { x: currentGauss.x, y: currentGauss.y },
    ];

    allPts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const spanX = Math.max(maxX - minX, 10);
    const spanY = Math.max(maxY - minY, 10);

    const canvasW = 280;
    const canvasH = 190;
    const pad = 26;

    // 保持纵横比 1:1，防止不规则地块被拉伸变形
    const maxSpan = Math.max(spanX, spanY);
    const scale = Math.min((canvasW - pad * 2) / maxSpan, (canvasH - pad * 2) / maxSpan);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    // 高斯 X 为北(向上)，Y 为东(向右)
    const toCanvas = (gx: number, gy: number) => {
      const cx = canvasW / 2 + (gy - midY) * scale;
      const cy = canvasH / 2 - (gx - midX) * scale;
      return { x: cx, y: cy };
    };

    const polygonCoords = selectedPoints.map((p) => toCanvas(p.x, p.y));
    const currentPos = toCanvas(currentGauss.x, currentGauss.y);

    const pointsSvgStr = polygonCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return {
      canvasW,
      canvasH,
      polygonCoords,
      currentPos,
      pointsSvgStr,
      spanMeters: Math.round(maxSpan),
    };
  }, [selectedPoints, currentGauss]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">不规则外形地块面积测算</h2>
              <p className="text-[10px] text-slate-500">任意凹凸多边形 / 边长周长 / 亩·平方米高精换算</p>
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
          {/* 雷达与不规则外形几何地图画布 (Irregular Shape Radar Grid Canvas) */}
          {canvasProjection && (
            <div className="bg-slate-900 rounded-2xl p-3 text-white border border-slate-800 flex flex-col items-center relative overflow-hidden">
              <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  地块平面投影 (跨度: ~{canvasProjection.spanMeters}m)
                </span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    isInside ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isInside ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  {isInside ? '当前处于地块内部' : '当前处于地块外部'}
                </span>
              </div>

              {/* Graphical Polygon Canvas */}
              <div className="w-72 h-48 relative border border-slate-800 rounded-xl bg-slate-950/70 overflow-hidden flex items-center justify-center">
                {/* Engineering Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-40" />

                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Irregular polygon semi-transparent fill */}
                  {selectedPoints.length >= 3 && (
                    <polygon
                      points={canvasProjection.pointsSvgStr}
                      fill="#F59E0B"
                      fillOpacity="0.22"
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Edges if only 2 points */}
                  {selectedPoints.length === 2 && (
                    <line
                      x1={canvasProjection.polygonCoords[0].x}
                      y1={canvasProjection.polygonCoords[0].y}
                      x2={canvasProjection.polygonCoords[1].x}
                      y2={canvasProjection.polygonCoords[1].y}
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                    />
                  )}
                </svg>

                {/* Vertices Pins with Labels */}
                {canvasProjection.polygonCoords.map((pos, idx) => {
                  const pt = selectedPoints[idx];
                  return (
                    <div
                      key={pt.id}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                      style={{ left: pos.x, top: pos.y }}
                    >
                      <div className="w-4 h-4 rounded-full bg-amber-500 border border-white flex items-center justify-center text-[7px] font-black text-slate-900 shadow-xs">
                        {idx + 1}
                      </div>
                      <span className="text-[7px] font-mono text-amber-200 bg-slate-900/80 px-1 rounded whitespace-nowrap mt-0.5">
                        {pt.name}
                      </span>
                    </div>
                  );
                })}

                {/* Current RTK Mobile Location */}
                <div
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none transition-all duration-200"
                  style={{
                    left: canvasProjection.currentPos.x,
                    top: canvasProjection.currentPos.y,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute w-4 h-4 rounded-full bg-cyan-400 opacity-75" />
                    <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 border-2 border-white shadow-md flex items-center justify-center">
                      <div className="w-1 h-1 bg-white rounded-full" />
                    </div>
                  </div>
                  <span className="text-[7px] font-mono font-bold text-cyan-300 bg-slate-900/90 px-1 rounded mt-0.5 whitespace-nowrap">
                    我的位置
                  </span>
                </div>
              </div>

              {/* Status footer bar */}
              <div className="w-full flex justify-between items-center px-3 py-1.5 bg-slate-800/80 rounded-xl text-[11px] font-mono mt-2">
                <span className="text-slate-300">
                  边界拐角: <strong className="text-amber-400">{selectedPoints.length} 个界址点</strong>
                </span>
                <span className="text-slate-300">
                  封闭周长: <strong className="text-emerald-400">{areaResult.perimeter.toFixed(2)}m</strong>
                </span>
              </div>
            </div>
          )}

          {/* Area Measurement Result Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <span className="text-[11px] text-slate-500 block font-sans font-medium">
              测定不规则闭合总面积
            </span>
            <div className="text-3xl font-mono font-black text-amber-600 mt-0.5">
              {areaResult.areaMu.toFixed(3)}{' '}
              <span className="text-sm font-sans font-bold text-slate-600">亩</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 text-xs font-mono">
              <div className="bg-white border border-slate-200 rounded-xl p-2">
                <span className="text-slate-500 block text-[10px] font-sans">平方米 (m²):</span>
                <span className="text-slate-900 font-bold text-sm">
                  {areaResult.areaSqm.toFixed(2)}
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2">
                <span className="text-slate-500 block text-[10px] font-sans">公顷 (ha):</span>
                <span className="text-slate-900 font-bold text-sm">
                  {areaResult.areaHa.toFixed(4)}
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2">
                <span className="text-slate-500 block text-[10px] font-sans">闭合周长 (m):</span>
                <span className="text-blue-600 font-bold text-sm">
                  {areaResult.perimeter.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Point Selector and Boundary Points List */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  地块顶点轮廓 ({selectedPoints.length} 个点)
                </span>
                <span className="text-[10px] text-slate-500">
                  按顺时针/逆时针围合依次连接
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddCurrentPoint}
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>现场采点为顶点</span>
              </button>
            </div>

            {/* List of points */}
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
              {selectedPoints.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  暂无顶点，请在拐角处点击“现场采点为顶点”或从点库选取
                </div>
              ) : (
                selectedPoints.map((pt, idx) => {
                  const edge = edges[idx];
                  return (
                    <div
                      key={pt.id}
                      className="py-1.5 px-2.5 flex items-center justify-between text-xs font-mono hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 truncate">{pt.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          ({pt.x.toFixed(1)}, {pt.y.toFixed(1)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {edge && (
                          <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                            边长: {edge.dist.toFixed(2)}m
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemovePoint(pt.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition"
                          title="移除该顶点"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            RTK坐标: X={currentGauss.x.toFixed(2)} Y={currentGauss.y.toFixed(2)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition"
          >
            完成测算退出
          </button>
        </div>
      </div>
    </div>
  );
};
