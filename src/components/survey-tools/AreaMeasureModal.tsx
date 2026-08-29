import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { calculatePolygonArea, latLonToGauss } from '../../utils/geodesy';
import { Maximize2, Plus, Trash2, X, Check } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface AreaMeasureModalProps {
  onClose: () => void;
}

export const AreaMeasureModal: React.FC<AreaMeasureModalProps> = ({ onClose }) => {
  const { points, currentProject } = useSurveyData();
  const { rtkState } = useRTK();

  const [selectedPointIds, setSelectedPointIds] = useState<string[]>(
    points.slice(0, 4).map((p) => p.id)
  );

  const selectedPoints = selectedPointIds
    .map((id) => points.find((p) => p.id === id))
    .filter((p): p is typeof points[0] => !!p);

  const areaResult = calculatePolygonArea(selectedPoints.map((p) => ({ x: p.x, y: p.y })));

  const handleAddCurrentPoint = () => {
    soundService.playClick();
    const gauss = latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );

    // Create temp point
    const newPtId = `tmp_pt_${Date.now()}`;
    const syntheticPoint = {
      id: newPtId,
      name: `界址点_${selectedPointIds.length + 1}`,
      code: 'JZD',
      lat: rtkState.currentLat,
      lon: rtkState.currentLon,
      elevation: rtkState.currentAlt,
      x: gauss.x,
      y: gauss.y,
      coordSystem: currentProject.coordSystem,
      createdAt: '',
    };

    points.push(syntheticPoint);
    setSelectedPointIds((prev) => [...prev, newPtId]);
  };

  const handleRemovePoint = (id: string) => {
    soundService.playClick();
    setSelectedPointIds((prev) => prev.filter((i) => i !== id));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">地块面积测量 (Area Calculation)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Main Area Results Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <span className="text-[11px] text-slate-500 block font-sans font-medium">测定闭合总面积</span>
            <div className="text-3xl font-mono font-black text-amber-600 mt-1">
              {areaResult.areaMu.toFixed(3)} <span className="text-sm font-sans font-bold text-slate-600">亩</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] font-sans font-medium">平方米 (m²):</span>
                <span className="text-slate-900 font-bold">{areaResult.areaSqm.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-sans font-medium">公顷 (ha):</span>
                <span className="text-slate-900 font-bold">{areaResult.areaHa.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-sans font-medium">周长 (m):</span>
                <span className="text-blue-600 font-bold">{areaResult.perimeter.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Point Selector and List */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                地块顶点边界 ({selectedPoints.length} 个点)
              </span>
              <button
                onClick={handleAddCurrentPoint}
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>采点作为顶点</span>
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto divide-y divide-slate-200">
              {selectedPoints.map((pt, idx) => (
                <div
                  key={pt.id}
                  className="py-1.5 px-2 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-amber-700 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-slate-900 font-bold">{pt.name}</span>
                    <span className="text-slate-500 text-[10px]">({pt.code})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">
                      X:{pt.x.toFixed(1)} Y:{pt.y.toFixed(1)}
                    </span>
                    <button
                      onClick={() => handleRemovePoint(pt.id)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
          >
            完成测算退出
          </button>
        </div>
      </div>
    </div>
  );
};
