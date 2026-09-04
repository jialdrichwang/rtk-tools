import React from 'react';
import { useRTK } from '../../context/RTKContext';
import { Gauge, X, AlertTriangle, CheckCircle2, Sliders, RefreshCw } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface BarometerModalProps {
  onClose: () => void;
}

export const BarometerModal: React.FC<BarometerModalProps> = ({ onClose }) => {
  const { rtkState, hasBarometerSensor, setHasBarometerSensor } = useRTK();

  // Approximate barometric altitude formula: h = 44330 * (1 - (P / 1013.25)^(1/5.255))
  const p0 = 1013.25;
  const currentPressure = hasBarometerSensor ? rtkState.pressure : null;
  const baroAlt = currentPressure ? 44330 * (1 - Math.pow(currentPressure / p0, 1 / 5.255)) : null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">气压计与测高修正</h2>
              <span className="text-[10px] text-slate-500">Barometer & Atmospheric Correction</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center space-y-3.5">
          {/* Unconfigured Alert Banner */}
          {!hasBarometerSensor ? (
            <div className="w-full bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <span>气压传感器未配置</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-[10px] font-semibold text-amber-800">
                    未检测到硬件
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  当前移动终端或GNSS接收机硬件未检测到气压传感器配置，气压测高修正暂时不可用。
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      soundService.playClick();
                      setHasBarometerSensor(true);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer inline-flex items-center gap-1 transition"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>启用仿真/外置气压计配置</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-emerald-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-[11px]">气压传感器已配置连接 (在线)</span>
              </div>
              <button
                onClick={() => {
                  soundService.playClick();
                  setHasBarometerSensor(false);
                }}
                className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                重置为未配置
              </button>
            </div>
          )}

          {/* Pressure Value Display */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <span className="text-[11px] text-slate-500 block font-sans font-medium">实时大气压强 (Atmospheric Pressure)</span>
            <div className="text-4xl font-mono font-black text-amber-600 mt-1">
              {hasBarometerSensor && currentPressure !== null ? (
                <>
                  {currentPressure.toFixed(1)} <span className="text-sm font-sans font-bold text-slate-600">hPa</span>
                </>
              ) : (
                <span className="text-slate-400 text-3xl">--.- <span className="text-xs font-sans">hPa (未配置)</span></span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {hasBarometerSensor && currentPressure !== null ? (
                `≈ ${(currentPressure * 0.75006).toFixed(1)} mmHg (毫米汞柱)`
              ) : (
                '无气压计数据输入'
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full text-xs font-mono">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">气压折算高程:</span>
              <span className="text-emerald-600 font-bold text-base">
                {baroAlt !== null ? `${baroAlt.toFixed(2)} m` : '-- m'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">RTK大地高 H:</span>
              <span className="text-blue-600 font-bold text-base">{rtkState.currentAlt.toFixed(2)} m</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">环境温度:</span>
              <span className="text-slate-800 font-bold text-base">
                {hasBarometerSensor ? `${rtkState.temperature} °C` : '-- °C'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">传感器状态:</span>
              <span className={`font-bold text-xs ${hasBarometerSensor ? 'text-emerald-600' : 'text-amber-700'}`}>
                {hasBarometerSensor ? '已校准工作' : '未配置'}
              </span>
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
