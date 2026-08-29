import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { SevenParameters } from '../../types';
import { Sliders, Check, X, Info } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface SevenParamsModalProps {
  onClose: () => void;
}

export const SevenParamsModal: React.FC<SevenParamsModalProps> = ({ onClose }) => {
  const { currentProject, updateProject } = useSurveyData();

  const [params, setParams] = useState<SevenParameters>(
    currentProject.sevenParams || {
      dx: 0,
      dy: 0,
      dz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: 0,
    }
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    soundService.playClick();
    updateProject(currentProject.id, { sevenParams: params });
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">七参数坐标转换设置 (Bursa-Wolf)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-800 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 text-purple-600 mt-0.5" />
            <span>布尔莎七参数用于国家坐标系 (CGCS2000 / 北京54 / 西安80 / WGS84) 之间的大地基准严密三维空间转换。</span>
          </div>

          {/* Translation Parameters (m) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <span className="text-xs font-bold text-slate-800 block">平移参数 (Translations - 米)</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">ΔX (m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.dx}
                  onChange={(e) => setParams({ ...params, dx: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">ΔY (m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.dy}
                  onChange={(e) => setParams({ ...params, dy: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">ΔZ (m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.dz}
                  onChange={(e) => setParams({ ...params, dz: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Rotation Parameters (arc-seconds) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <span className="text-xs font-bold text-slate-800 block">旋转角参数 (Rotations - 角秒 ")</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Rx (")</label>
                <input
                  type="number"
                  step="0.0001"
                  value={params.rx}
                  onChange={(e) => setParams({ ...params, rx: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Ry (")</label>
                <input
                  type="number"
                  step="0.0001"
                  value={params.ry}
                  onChange={(e) => setParams({ ...params, ry: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Rz (")</label>
                <input
                  type="number"
                  step="0.0001"
                  value={params.rz}
                  onChange={(e) => setParams({ ...params, rz: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Scale Parameter */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">尺度比例因子 (Scale Ratio - ppm)</label>
            <input
              type="number"
              step="0.0001"
              value={params.scale}
              onChange={(e) => setParams({ ...params, scale: parseFloat(e.target.value) || 0 })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
              placeholder="0.0000"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : null}
            <span>保存参数</span>
          </button>
        </div>
      </div>
    </div>
  );
};
