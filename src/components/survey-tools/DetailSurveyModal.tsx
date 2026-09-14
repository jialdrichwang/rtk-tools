import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { latLonToGauss } from '../../utils/geodesy';
import {
  fileStorageService,
  generateSurveySequentialName,
  ENGINEERING_SURVEY_SUBPATHS,
} from '../../utils/fileStorageService';
import { Trees, Check, X, Plus, Sparkles } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface DetailSurveyModalProps {
  onClose: () => void;
}

interface FeatureShortcut {
  prefix: string;
  code: string;
  label: string;
  color: string;
}

export const DetailSurveyModal: React.FC<DetailSurveyModalProps> = ({ onClose }) => {
  const { currentProject, points, addPoint } = useSurveyData();
  const { rtkState } = useRTK();
  const [lastLoggedName, setLastLoggedName] = useState<string | null>(null);
  const [customFeatureName, setCustomFeatureName] = useState('');

  // Fixed standard surveyor feature definitions matching user specifications
  const featureCodes: FeatureShortcut[] = [
    { prefix: 'road', code: 'ROAD', label: '道路 (road)', color: '#f97316' },
    { prefix: 'corner_of_the_room', code: 'BUILDING_CORNER', label: '房角 (corner_of_the_room)', color: '#8b5cf6' },
    { prefix: 'utility_pole', code: 'POLE', label: '电杆 (utility_pole)', color: '#ef4444' },
    { prefix: 'Fence_', code: 'FENCE', label: '围墙 (Fence_)', color: '#64748b' },
    { prefix: 'manhole', code: 'MANHOLE', label: '检查井 (manhole)', color: '#06b6d4' },
    { prefix: 'tree', code: 'TREE', label: '行道树 (tree)', color: '#10b981' },
    { prefix: 'hydrant', code: 'HYDRANT', label: '消火栓 (hydrant)', color: '#ec4899' },
    { prefix: 'ridge', code: 'RIDGE', label: '坎顶/坎底 (ridge)', color: '#eab308' },
  ];

  const handleQuickLog = (feature: FeatureShortcut | { prefix: string; code: string; label: string; color: string }) => {
    soundService.playClick();
    const gauss = latLonToGauss(
      rtkState.currentLat,
      rtkState.currentLon,
      currentProject.centralMeridian,
      currentProject.coordSystem
    );

    // Generate prefix + YYYYMMDD_0001, 0002...
    const pointName = generateSurveySequentialName(
      feature.prefix,
      points.map((p) => p.name)
    );

    const savedPoint = addPoint({
      name: pointName,
      code: feature.code,
      lat: rtkState.currentLat,
      lon: rtkState.currentLon,
      elevation: rtkState.currentAlt,
      x: gauss.x,
      y: gauss.y,
      coordSystem: currentProject.coordSystem,
      desc: `碎部测量 [${feature.label}]`,
      color: feature.color,
      hrms: rtkState.hrms,
      vrms: rtkState.vrms,
      solutionType: rtkState.solution,
      satCount: rtkState.satsUsed,
      antennaHeight: rtkState.antennaHeight,
      projectId: currentProject.id,
    });

    // Save to: project/工程项目文件名/Engineering Surveying/Detail Surveying/<pointName>
    fileStorageService.saveProjectFile(
      currentProject.name,
      ENGINEERING_SURVEY_SUBPATHS.DETAIL_SURVEYING,
      `${pointName}.json`,
      JSON.stringify(savedPoint, null, 2)
    ).catch(() => {});

    setLastLoggedName(pointName);
  };

  const handleLogCustomFeature = () => {
    const cleanName = customFeatureName.trim();
    if (!cleanName) return;

    handleQuickLog({
      prefix: cleanName,
      code: 'CUSTOM_DETAIL',
      label: `自定义碎部(${cleanName})`,
      color: '#3b82f6',
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trees className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">碎部特征测量 (Detail Surveying)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Current RTK Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] font-sans font-medium">上次采集点:</span>
              <span className="text-emerald-700 font-bold">{lastLoggedName || '待采第一点'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px] font-sans font-medium">当前RTK高程:</span>
              <span className="text-blue-600 font-bold">{rtkState.currentAlt.toFixed(2)}m</span>
            </div>
          </div>

          {/* Custom Feature Name Input */}
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>自定义碎部名 (Custom Feature Name)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customFeatureName}
                onChange={(e) => setCustomFeatureName(e.target.value)}
                placeholder="例如: curb, pipe, ditch..."
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleLogCustomFeature}
                disabled={!customFeatureName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>采集自定义</span>
              </button>
            </div>
            <p className="text-[10px] text-blue-600/80">
              命名规则: {customFeatureName.trim() || '自定义名'}YYYYMMDD_0001, 0002...
            </p>
          </div>

          {/* Standard Feature Shortcuts Grid (1-click point recording) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight block">
              标准碎部特征快速采集 (点击直接记录):
            </span>
            <div className="grid grid-cols-2 gap-2">
              {featureCodes.map((f) => (
                <button
                  key={f.prefix}
                  onClick={() => handleQuickLog(f)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 hover:border-emerald-500/60 rounded-xl flex items-center gap-2 transition text-left cursor-pointer shadow-xs"
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: f.color }}
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-800 block truncate">{f.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {f.prefix}YYYYMMDD_...
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {lastLoggedName && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-700 font-mono flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>已成功采入: <b>{lastLoggedName}</b></span>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">自动归档路径:</span><br />
            <code className="text-[10px] text-blue-700 break-all">
              project/{currentProject.name}/Engineering Surveying/Detail Surveying/
            </code>
          </div>
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
