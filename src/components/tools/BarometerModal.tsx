import React from 'react';
import { useRTK } from '../../context/RTKContext';
import { Gauge, X, TrendingUp, CloudSun } from 'lucide-react';

interface BarometerModalProps {
  onClose: () => void;
}

export const BarometerModal: React.FC<BarometerModalProps> = ({ onClose }) => {
  const { rtkState } = useRTK();

  // Approximate barometric altitude formula: h = 44330 * (1 - (P / 1013.25)^(1/5.255))
  const p0 = 1013.25;
  const baroAlt = 44330 * (1 - Math.pow(rtkState.pressure / p0, 1 / 5.255));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">气压计与测高修正 (Barometer)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center space-y-4">
          {/* Pressure Value Display */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <span className="text-[11px] text-slate-500 block font-sans font-medium">实时大气压强 (Atmospheric Pressure)</span>
            <div className="text-4xl font-mono font-black text-amber-600 mt-1">
              {rtkState.pressure.toFixed(1)} <span className="text-sm font-sans font-bold text-slate-600">hPa</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              ≈ {(rtkState.pressure * 0.75006).toFixed(1)} mmHg (毫米汞柱)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full text-xs font-mono">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">气压折算高程:</span>
              <span className="text-emerald-600 font-bold text-base">{baroAlt.toFixed(2)} m</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">RTK大地高 H:</span>
              <span className="text-blue-600 font-bold text-base">{rtkState.currentAlt.toFixed(2)} m</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">环境温度:</span>
              <span className="text-slate-800 font-bold text-base">{rtkState.temperature} °C</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">气象状态:</span>
              <span className="text-amber-700 font-bold text-base">晴朗微风</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
