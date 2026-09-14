import React, { useState } from 'react';
import { useRTK } from '../../context/RTKContext';
import { Gauge, X, AlertTriangle, CheckCircle2, Sliders, RefreshCw, Cpu } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface BarometerModalProps {
  onClose: () => void;
}

export const BarometerModal: React.FC<BarometerModalProps> = ({ onClose }) => {
  const { rtkState, hasBarometerSensor, setHasBarometerSensor, barometerSource, detectHardwareBarometer } = useRTK();
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<string | null>(null);

  // Approximate barometric altitude formula: h = 44330 * (1 - (P / 1013.25)^(1/5.255))
  const p0 = 1013.25;
  const currentPressure = hasBarometerSensor ? rtkState.pressure : null;
  const baroAlt = currentPressure ? 44330 * (1 - Math.pow(currentPressure / p0, 1 / 5.255)) : null;

  const handleDetectHardware = async () => {
    soundService.playClick();
    setIsDetecting(true);
    setDetectResult(null);
    try {
      const found = await detectHardwareBarometer();
      if (found) {
        soundService.playSuccess();
        setDetectResult('已成功直读原生硬件气压计 (Sensor.TYPE_PRESSURE)');
      } else {
        setDetectResult('未检测到内置硬件气压芯片，可开启仿真修正或外连传感器');
      }
    } catch {
      setDetectResult('检测气压传感器超时或当前机型不支持');
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center">
            <Gauge className="w-5 h-5 text-amber-600 mr-2" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">气压计与测高修正</h2>
              <span className="text-[10px] text-slate-500 block">Barometer & Atmospheric Correction</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          {/* Status Banner */}
          {!hasBarometerSensor ? (
            <div className="w-full bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs flex items-start mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 mr-2.5" />
              <div className="flex-1">
                <div className="font-bold flex items-center mb-1">
                  <span>气压传感器未配置</span>
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-200/80 text-[10px] font-semibold text-amber-800">
                    未检测到硬件
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-2">
                  当前移动终端或GNSS接收机硬件未检测到气压传感器配置，气压测高修正暂时不可用。
                </p>
                <div className="flex items-center flex-wrap">
                  <button
                    onClick={handleDetectHardware}
                    disabled={isDetecting}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer inline-flex items-center mr-2 mb-1 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isDetecting ? 'animate-spin' : ''}`} />
                    <span>{isDetecting ? '正在检测硬件...' : '检测硬件传感器'}</span>
                  </button>
                  <button
                    onClick={() => {
                      soundService.playClick();
                      setHasBarometerSensor(true);
                    }}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium text-[11px] cursor-pointer inline-flex items-center mb-1 transition"
                  >
                    <Sliders className="w-3 h-3 mr-1 text-slate-600" />
                    <span>开启配置/仿真</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-emerald-900 text-xs flex items-center justify-between mb-3">
              <div className="flex items-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mr-1.5" />
                <div>
                  <span className="font-semibold text-[11px] block">
                    {barometerSource === 'hardware' ? '硬件气压传感器 (Sensor.TYPE_PRESSURE) 在线' : '气压传感器已配置连接 (在线)'}
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    {barometerSource === 'hardware' ? '原生物理芯片实时遥测读取' : '气压高程自动参与测量高程差分修正'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  soundService.playClick();
                  setHasBarometerSensor(false);
                }}
                className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer ml-2 shrink-0"
              >
                重置
              </button>
            </div>
          )}

          {detectResult && (
            <div className="w-full p-2 mb-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-center">
              <Cpu className="w-3.5 h-3.5 mr-1.5 shrink-0 text-blue-600" />
              <span>{detectResult}</span>
            </div>
          )}

          {/* Pressure Value Display */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center mb-3">
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

          {/* Grid replaced with pure Flexbox rows for strict Android 7.0 compatibility */}
          <div className="w-full text-xs font-mono">
            <div className="flex mb-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 mr-1">
                <span className="text-[10px] text-slate-500 font-sans font-medium block">气压折算高程:</span>
                <span className="text-emerald-600 font-bold text-base block mt-0.5">
                  {baroAlt !== null ? `${baroAlt.toFixed(2)} m` : '-- m'}
                </span>
              </div>

              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 ml-1">
                <span className="text-[10px] text-slate-500 font-sans font-medium block">RTK大地高 H:</span>
                <span className="text-blue-600 font-bold text-base block mt-0.5">{rtkState.currentAlt.toFixed(2)} m</span>
              </div>
            </div>

            <div className="flex">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 mr-1">
                <span className="text-[10px] text-slate-500 font-sans font-medium block">环境温度:</span>
                <span className="text-slate-800 font-bold text-base block mt-0.5">
                  {hasBarometerSensor ? `${rtkState.temperature} °C` : '-- °C'}
                </span>
              </div>

              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 ml-1">
                <span className="text-[10px] text-slate-500 font-sans font-medium block">传感器来源:</span>
                <span className={`font-bold text-xs block mt-1 ${hasBarometerSensor ? 'text-emerald-600' : 'text-amber-700'}`}>
                  {barometerSource === 'hardware' ? '硬件物理芯片' : hasBarometerSensor ? '已校准工作' : '未配置'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={handleDetectHardware}
            disabled={isDetecting}
            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-lg cursor-pointer flex items-center hover:bg-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>重新扫描硬件</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
