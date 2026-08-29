import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { latLonToGauss } from '../../utils/geodesy';
import { Trees, Zap, Check, X, MapPin } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface DetailSurveyModalProps {
  onClose: () => void;
}

export const DetailSurveyModal: React.FC<DetailSurveyModalProps> = ({ onClose }) => {
  const { currentProject, points, addPoint } = useSurveyData();
  const { rtkState } = useRTK();
  const [pointIndex, setPointIndex] = useState(points.length + 1);
  const [lastLoggedName, setLastLoggedName] = useState<string | null>(null);

  // Common surveyor feature shortcuts
  const featureCodes = [
    { code: '道路', label: '道路/中线', color: '#f97316' },
    { code: '坎顶', label: '坎顶/坎底', color: '#eab308' },
    { code: '房角', label: '建筑物房角', color: '#8b5cf6' },
    { code: '检查井', label: '雨水/污水井', color: '#06b6d4' },
    { code: '电杆', label: '电杆/路灯', color: '#ef4444' },
    { code: '行道树', label: '树木/绿植', color: '#10b981' },
    { code: '消火栓', label: '消防栓', color: '#ec4899' },
    { code: '围墙', label: '围墙角点', color: '#64748b' },
  ];

  const handleQuickLog = (code: string, color: string) => {
    soundService.playClick();
    const gauss = latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );

    const name = `碎部_${pointIndex}`;
    addPoint({
      name,
      code,
      lat: rtkState.currentLat,
      lon: rtkState.currentLon,
      elevation: rtkState.currentAlt,
      x: gauss.x,
      y: gauss.y,
      coordSystem: currentProject.coordSystem,
      desc: `碎部测量快捷采集 [${code}]`,
      color,
      hrms: rtkState.hrms,
      vrms: rtkState.vrms,
      solutionType: rtkState.solution,
      satCount: rtkState.satsUsed,
      antennaHeight: rtkState.antennaHeight,
      projectId: currentProject.id,
    });

    setLastLoggedName(name);
    setPointIndex((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trees className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">碎部特征快捷测量 (Detail Mapping)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Current RTK Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] font-sans font-medium">待采点名:</span>
              <span className="text-slate-900 font-bold">碎部_{pointIndex}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px] font-sans font-medium">高程:</span>
              <span className="text-emerald-600 font-bold">{rtkState.currentAlt.toFixed(2)}m</span>
            </div>
          </div>

          {/* Feature Shortcuts Grid (1-click point recording) */}
          <div className="grid grid-cols-2 gap-2.5">
            {featureCodes.map((f) => (
              <button
                key={f.code}
                onClick={() => handleQuickLog(f.code, f.color)}
                className="p-3 bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 hover:border-emerald-500/60 rounded-xl flex items-center gap-2.5 transition text-left cursor-pointer shadow-xs"
              >
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: f.color }}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">{f.code}</div>
                  <div className="text-[10px] text-slate-500">{f.label}</div>
                </div>
              </button>
            ))}
          </div>

          {lastLoggedName && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-700 font-mono flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>已成功采入: <b>{lastLoggedName}</b></span>
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
