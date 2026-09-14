import React, { useState, useMemo } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { calculatePolygonArea, latLonToGauss } from '../../utils/geodesy';
import {
  fileStorageService,
  generateSurveySequentialName,
  ENGINEERING_SURVEY_SUBPATHS,
} from '../../utils/fileStorageService';
import {
  Maximize2,
  Plus,
  Trash2,
  X,
  Compass,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Save,
  Check,
  Search,
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
  const { points, currentProject, addPoint } = useSurveyData();
  const { rtkState } = useRTK();

  // 顶点序列列表 (存储有序点 ID，允许按顺序形成闭合圈)
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>(
    points.slice(0, Math.min(5, points.length)).map((p) => p.id)
  );

  // 从文件/点库选取节点模态框状态
  const [isSelectFromFileOpen, setIsSelectFromFileOpen] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [checkedIdsForImport, setCheckedIdsForImport] = useState<string[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 解析当前已选点对象列表
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
    const nodeName = `界址点_J${selectedPointIds.length + 1}`;
    const savedPoint = addPoint({
      name: nodeName,
      code: 'JZD',
      lat: rtkState.currentLat,
      lon: rtkState.currentLon,
      elevation: rtkState.currentAlt,
      x: currentGauss.x,
      y: currentGauss.y,
      coordSystem: currentProject.coordSystem,
      desc: `面积测量现场界址点 J${selectedPointIds.length + 1}`,
      color: '#d97706',
      hrms: rtkState.hrms,
      vrms: rtkState.vrms,
      solutionType: rtkState.solution,
      satCount: rtkState.satsUsed,
      antennaHeight: rtkState.antennaHeight,
      projectId: currentProject.id,
    });

    setSelectedPointIds((prev) => [...prev, savedPoint.id]);
  };

  /**
   * 删除一个节点时，只从当前多边形拓扑序列中移除该位置的节点；
   * 点库中已测数据绝对不删除，移除后后续节点序号自动接上去 (1, 2, 3...)。
   */
  const handleRemoveNodeAt = (indexToRemove: number) => {
    soundService.playClick();
    setSelectedPointIds((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 确认从文件选择节点导入
  const handleConfirmImportNodes = () => {
    soundService.playSuccess();
    if (checkedIdsForImport.length > 0) {
      setSelectedPointIds((prev) => [...prev, ...checkedIdsForImport]);
    }
    setCheckedIdsForImport([]);
    setIsSelectFromFileOpen(false);
  };

  // 保存面积测量结果
  const handleSaveAreaMeasurement = async () => {
    soundService.playSuccess();
    // 命名规则: area measurementYYYYMMDD_0001
    const resultName = generateSurveySequentialName('area measurement', points.map((p) => p.name));

    const record = {
      resultName,
      surveyType: 'AREA_MEASUREMENT',
      areaMu: areaResult.areaMu,
      areaSqm: areaResult.areaSqm,
      areaHa: areaResult.areaHa,
      perimeter: areaResult.perimeter,
      nodesCount: selectedPoints.length,
      nodes: selectedPoints.map((p, idx) => ({
        sequenceIndex: idx + 1,
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        elevation: p.elevation,
        lat: p.lat,
        lon: p.lon,
      })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        distance: Math.round(e.dist * 1000) / 1000,
      })),
      timestamp: new Date().toISOString(),
      projectName: currentProject.name,
    };

    // 保存至: project/工程项目文件名/Engineering Surveying/area measurement/area measurement20260915_0001
    await fileStorageService.saveProjectFile(
      currentProject.name,
      ENGINEERING_SURVEY_SUBPATHS.AREA_MEASUREMENT,
      `${resultName}.json`,
      JSON.stringify(record, null, 2)
    );

    setSaveSuccessMsg(`已成功归档至: area measurement/${resultName}`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // 过滤可选点库点
  const filteredLibraryPoints = useMemo(() => {
    if (!fileSearchQuery.trim()) return points;
    const q = fileSearchQuery.toLowerCase();
    return points.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [points, fileSearchQuery]);

  // 雷达与几何投影画布
  const canvasProjection = useMemo(() => {
    if (selectedPoints.length === 0) return null;

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

    const rangeX = Math.max(maxX - minX, 10);
    const rangeY = Math.max(maxY - minY, 10);
    const maxDim = Math.max(rangeX, rangeY);

    const canvasW = 280;
    const canvasH = 200;
    const padding = 28;

    const scale = Math.min((canvasW - padding * 2) / maxDim, (canvasH - padding * 2) / maxDim);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const project = (x: number, y: number) => {
      return {
        px: canvasW / 2 + (y - centerY) * scale,
        py: canvasH / 2 - (x - centerX) * scale,
      };
    };

    const polyPoints = selectedPoints.map((p) => project(p.x, p.y));
    const rtkPos = project(currentGauss.x, currentGauss.y);

    return {
      canvasW,
      canvasH,
      polyPoints,
      rtkPos,
      scale,
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
              <h2 className="text-sm font-bold text-slate-900">面积测量与闭合多边形 (Area Measurement)</h2>
              <p className="text-[10px] text-slate-500">高斯投影鞋带公式 / 亩数计算 / 顺次闭合</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Canvas Map Preview */}
          {canvasProjection && (
            <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 flex flex-col items-center relative overflow-hidden shadow-inner">
              <div className="absolute top-2 left-3 flex items-center gap-2 z-10 text-[11px] font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>实时RTK位置</span>
                {isInside ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    在多边形内部
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    在外部
                  </span>
                )}
              </div>

              <svg
                width={canvasProjection.canvasW}
                height={canvasProjection.canvasH}
                className="overflow-visible select-none"
              >
                {/* Polygon boundary */}
                {canvasProjection.polyPoints.length >= 3 && (
                  <polygon
                    points={canvasProjection.polyPoints.map((pt) => `${pt.px},${pt.py}`).join(' ')}
                    fill="rgba(245, 158, 11, 0.18)"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                )}

                {/* Edges */}
                {canvasProjection.polyPoints.map((pt, i) => {
                  const nextPt =
                    canvasProjection.polyPoints[(i + 1) % canvasProjection.polyPoints.length];
                  return (
                    <line
                      key={i}
                      x1={pt.px}
                      y1={pt.py}
                      x2={nextPt.px}
                      y2={nextPt.py}
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  );
                })}

                {/* Nodes */}
                {canvasProjection.polyPoints.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.px} cy={pt.py} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    <text
                      x={pt.px + 7}
                      y={pt.py - 4}
                      fill="#fef3c7"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {i + 1}
                    </text>
                  </g>
                ))}

                {/* RTK Live Marker */}
                <circle
                  cx={canvasProjection.rtkPos.px}
                  cy={canvasProjection.rtkPos.py}
                  r="7"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </svg>

              <div className="w-full flex justify-between items-center px-3 py-1.5 bg-slate-900/90 rounded-xl text-[11px] font-mono mt-2">
                <span className="text-slate-400">
                  节点数: <strong className="text-amber-400">{selectedPoints.length}</strong>
                </span>
                <span className="text-slate-400">
                  周长: <strong className="text-emerald-400">{areaResult.perimeter.toFixed(2)}m</strong>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  地块节点轮廓 ({selectedPoints.length} 个节点)
                </span>
                <span className="text-[10px] text-slate-500">
                  按顺时针/逆时针围合依次连接，删除单个节点后序号自动顺延接上
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* 1. 从文件中选择节点入口 */}
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setIsSelectFromFileOpen(true);
                  }}
                  className="flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer shadow-2xs transition active:scale-95"
                  title="从项目文件/点库中多选节点加入面积测量"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>从文件中选择节点</span>
                </button>

                {/* 2. 现场采点为顶点 */}
                <button
                  type="button"
                  onClick={handleAddCurrentPoint}
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>现场采点</span>
                </button>
              </div>
            </div>

            {/* List of ordered nodes */}
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
              {selectedPoints.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  暂无节点，请点击“从文件中选择节点”或“现场采点”
                </div>
              ) : (
                selectedPoints.map((pt, idx) => {
                  const edge = edges[idx];
                  return (
                    <div
                      key={`${pt.id}-${idx}`}
                      className="py-1.5 px-2.5 flex items-center justify-between text-xs font-mono hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 序号：删除节点后自动接上去 */}
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">
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
                          onClick={() => handleRemoveNodeAt(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition"
                          title="只删除此节点，不影响原测量数据，序号自动接上"
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

          {/* Success Banner */}
          {saveSuccessMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={handleSaveAreaMeasurement}
            disabled={selectedPoints.length < 3}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition flex items-center gap-1.5 active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存面积测量成果</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition"
          >
            完成测算退出
          </button>
        </div>
      </div>

      {/* 从文件中选择节点 模态弹窗 */}
      {isSelectFromFileOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 z-60">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-scale-up">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">从文件中选择节点 (Select from File)</h3>
                  <p className="text-[10px] text-slate-500">
                    当前项目: {currentProject.name} (共 {points.length} 个点)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSelectFromFileOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  placeholder="搜索点名或编码..."
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
              {filteredLibraryPoints.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  没有匹配的点位数据
                </div>
              ) : (
                filteredLibraryPoints.map((p) => {
                  const isChecked = checkedIdsForImport.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="py-2 px-2 flex items-center justify-between hover:bg-blue-50/60 rounded-lg cursor-pointer transition text-xs font-mono select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCheckedIdsForImport((prev) => [...prev, p.id]);
                            } else {
                              setCheckedIdsForImport((prev) => prev.filter((id) => id !== p.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="truncate">
                          <span className="font-bold text-slate-800 block truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-400 block">
                            编码: {p.code} | X={p.x.toFixed(2)} Y={p.y.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">
                        {p.elevation.toFixed(2)}m
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">
                已选: <b className="text-blue-700">{checkedIdsForImport.length}</b> 个节点
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSelectFromFileOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImportNodes}
                  disabled={checkedIdsForImport.length === 0}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition"
                >
                  导入为地块节点
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
