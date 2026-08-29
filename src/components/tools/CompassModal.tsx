import React, { useState, useEffect } from 'react';
import { useRTK } from '../../context/RTKContext';
import {
  Compass as CompassIcon,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface CompassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompassModal: React.FC<CompassModalProps> = ({ isOpen, onClose }) => {
  const { rtkState } = useRTK();
  const [heading, setHeading] = useState(0);
  const [magneticField, setMagneticField] = useState(48.5); // microteslas (μT)
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [hasCalibrated, setHasCalibrated] = useState(false);

  // Device orientation / RTK Heading
  useEffect(() => {
    if (!isOpen) return;

    // Use device orientation if available on Android/iOS
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        // alpha is 0 to 360
        const compassHeading = (360 - e.alpha) % 360;
        setHeading(compassHeading);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    // Minor natural magnetic fluctuation simulation
    const timer = setInterval(() => {
      if (!isCalibrating) {
        setMagneticField((prev) => {
          const delta = (Math.random() - 0.5) * 0.4;
          return Math.max(42.0, Math.min(54.0, prev + delta));
        });
      }
    }, 1500);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      clearInterval(timer);
    };
  }, [isOpen, isCalibrating]);

  // Fallback to rtkState heading when alpha is default
  const activeHeading = heading || rtkState.heading || 0;

  // Handle 8-figure calibration
  const startCalibration = () => {
    soundService.playClick();
    setIsCalibrating(true);
    setCalibrationProgress(0);

    const interval = setInterval(() => {
      setCalibrationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCalibrating(false);
          setHasCalibrated(true);
          setMagneticField(46.8);
          soundService.playSuccess();
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  if (!isOpen) return null;

  const getDirectionText = (deg: number) => {
    const d = (deg % 360 + 360) % 360;
    if (d >= 337.5 || d < 22.5) return '正北 (N)';
    if (d >= 22.5 && d < 67.5) return '东北 (NE)';
    if (d >= 67.5 && d < 112.5) return '正东 (E)';
    if (d >= 112.5 && d < 157.5) return '东南 (SE)';
    if (d >= 157.5 && d < 202.5) return '正南 (S)';
    if (d >= 202.5 && d < 247.5) return '西南 (SW)';
    if (d >= 247.5 && d < 292.5) return '正西 (W)';
    return '西北 (NW)';
  };

  // Determine magnetic interference status
  const getMagneticStatus = () => {
    if (magneticField >= 40 && magneticField <= 58) {
      return {
        level: 'good',
        label: '磁场环境优良 (无明显干扰)',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: CheckCircle2,
      };
    }
    if ((magneticField >= 32 && magneticField < 40) || (magneticField > 58 && magneticField <= 72)) {
      return {
        level: 'warn',
        label: '存在轻度磁场波动',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: AlertTriangle,
      };
    }
    return {
      level: 'danger',
      label: '强磁场干扰！建议旋转校准',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      icon: ShieldAlert,
    };
  };

  const magStatus = getMagneticStatus();
  const StatusIcon = magStatus.icon;

  // Degrees ticks generation (every 5 degrees, major label every 30 degrees)
  const ticks = Array.from({ length: 72 }).map((_, i) => {
    const deg = i * 5;
    const isMajor = deg % 30 === 0;
    const isMedium = deg % 10 === 0 && !isMajor;
    return { deg, isMajor, isMedium };
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <CompassIcon className="w-4 h-4 text-blue-600" />
            <span>高精电子罗盘与磁场监测</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col items-center justify-between space-y-3.5 overflow-y-auto">
          {/* Main Azimuth Display */}
          <div className="text-center">
            <div className="text-3xl font-black font-mono text-slate-900 tracking-tight">
              {Math.round(activeHeading)}°
            </div>
            <div className="text-xs font-semibold text-blue-600 mt-0.5">
              {getDirectionText(activeHeading)}
            </div>
          </div>

          {/* Compass Dial with 1-360° Detailed Scale */}
          <div className="relative w-56 h-56 flex items-center justify-center">
            {/* Outer Graduation Ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-slate-300 transition-transform duration-150 ease-out bg-slate-50 shadow-inner"
              style={{ transform: `rotate(${-activeHeading}deg)` }}
            >
              {ticks.map(({ deg, isMajor, isMedium }) => (
                <div
                  key={deg}
                  className="absolute inset-0 flex justify-center"
                  style={{ transform: `rotate(${deg}deg)` }}
                >
                  <div
                    className={`w-0.5 ${
                      isMajor
                        ? 'h-3.5 bg-slate-800'
                        : isMedium
                        ? 'h-2 bg-slate-400'
                        : 'h-1.5 bg-slate-300'
                    }`}
                  />
                  {isMajor && (
                    <span
                      className="absolute top-4 text-[9px] font-mono font-bold text-slate-700 select-none"
                      style={{
                        transform: `rotate(${-deg}deg)`,
                      }}
                    >
                      {deg === 0 ? (
                        <span className="text-rose-600 font-extrabold text-[10px]">北</span>
                      ) : deg === 90 ? (
                        <span className="text-blue-600 font-extrabold text-[10px]">东</span>
                      ) : deg === 180 ? (
                        <span className="text-slate-800 font-extrabold text-[10px]">南</span>
                      ) : deg === 270 ? (
                        <span className="text-blue-600 font-extrabold text-[10px]">西</span>
                      ) : (
                        deg
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Fixed Center Direction Pointer */}
            <div className="absolute w-28 h-28 flex items-center justify-center pointer-events-none z-10">
              {/* North Needle */}
              <div className="absolute top-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[40px] border-b-rose-600 drop-shadow-sm" />
              {/* South Needle */}
              <div className="absolute bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[40px] border-t-slate-400 drop-shadow-sm" />
              {/* Center Pivot */}
              <div className="w-5 h-5 rounded-full bg-slate-800 border-2 border-white shadow-md z-20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
              </div>
            </div>

            {/* Top Fixed Target Marker */}
            <div className="absolute -top-1 w-2.5 h-2.5 bg-rose-600 transform rotate-45 z-20 shadow-xs" />
          </div>

          {/* Magnetic Field Strength & Interference Status */}
          <div className="w-full space-y-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-sans">地磁场强度:</span>
                <span className="text-slate-900 font-bold text-sm">
                  {magneticField.toFixed(1)} <span className="text-xs font-normal text-slate-500">μT</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans">正常范围: 30~60 μT</span>
            </div>

            {/* Interference status badge */}
            <div
              className={`w-full p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${magStatus.color}`}
            >
              <StatusIcon className="w-4 h-4 shrink-0" />
              <div className="flex-1 leading-tight">
                <div className="font-bold">{magStatus.label}</div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  远离高压输电线、变压器及大型金属结构可降低偏差
                </div>
              </div>
            </div>

            {/* 8-figure Calibration Instruction Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>消除磁场干扰与传感器校准</span>
                </div>
                {hasCalibrated && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                    已校准
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                手持平板或手薄沿水平进行“8”字形缓慢翻转旋转两圈，可消除机身积聚的杂散磁场，恢复电子罗盘出厂精度。
              </p>

              {isCalibrating ? (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-bold text-blue-700">
                    <span>正在执行8字校准... 请翻转设备</span>
                    <span>{calibrationProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${calibrationProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={startCalibration}
                  className="w-full mt-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>立即执行 8字磁场校准</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
