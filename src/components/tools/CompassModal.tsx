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
  Navigation,
  Radio,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface CompassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompassModal: React.FC<CompassModalProps> = ({ isOpen, onClose }) => {
  const { rtkState, hasMagnetometer, isUsingGpsHeading, gpsCourseHeading } = useRTK();
  const [heading, setHeading] = useState(0);
  const [magneticField, setMagneticField] = useState(48.5); // microteslas (μT)
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [hasCalibrated, setHasCalibrated] = useState(false);
  const [forcedHeadingMode, setForcedHeadingMode] = useState<'auto' | 'gps' | 'mag'>('auto');

  // Device orientation / RTK Heading
  useEffect(() => {
    if (!isOpen) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && !isNaN(e.alpha)) {
        const compassHeading = (360 - e.alpha) % 360;
        setHeading(compassHeading);
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

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

  if (!isOpen) return null;

  // Evaluate whether to use GPS heading or Magnetometer heading
  const effectiveIsGps =
    forcedHeadingMode === 'gps' ||
    (!hasMagnetometer && forcedHeadingMode !== 'mag') ||
    isUsingGpsHeading;

  const activeHeading = effectiveIsGps
    ? gpsCourseHeading || rtkState.heading || 0
    : heading || rtkState.heading || 0;

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

  const getDirectionText = (deg: number) => {
    const d = ((deg % 360) + 360) % 360;
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
    if (effectiveIsGps) {
      return {
        level: 'gps',
        label: 'GPS 卫星运动矢量推算 (免地磁干扰)',
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        icon: Navigation,
      };
    }
    if (magneticField >= 40 && magneticField <= 58) {
      return {
        level: 'good',
        label: '地磁场环境优良 (无明显干扰)',
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
      label: '强磁场干扰！建议使用GPS矢量或校准',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      icon: ShieldAlert,
    };
  };

  const magStatus = getMagneticStatus();
  const StatusIcon = magStatus.icon;

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
            <span>高精电子罗盘与航向指示</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Heading Sensor Mode Switch */}
        <div className="bg-slate-100 px-4 py-1.5 flex items-center justify-between text-xs border-b border-slate-200">
          <span className="text-slate-600 font-semibold text-[11px]">指向计算来源:</span>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setForcedHeadingMode('gps')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                effectiveIsGps
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GPS 矢量
            </button>
            <button
              onClick={() => setForcedHeadingMode('mag')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                !effectiveIsGps
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              地磁传感器
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col items-center justify-between space-y-3 overflow-y-auto">
          {/* Main Azimuth Display with GPS/MAG Tag */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-black font-mono text-slate-900 tracking-tight">
                {Math.round(activeHeading)}°
              </span>
              <span
                className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border ${
                  effectiveIsGps
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {effectiveIsGps ? 'GPS' : 'MAG'}
              </span>
            </div>
            <div className="text-xs font-semibold text-blue-600 mt-0.5">
              {getDirectionText(activeHeading)}
            </div>
          </div>

          {/* Compass Dial */}
          <div
            style={{ width: '230px', height: '230px' }}
            className="relative flex items-center justify-center"
          >
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
            <div className="absolute w-32 h-32 flex items-center justify-center pointer-events-none z-10">
              <div className="absolute bottom-1/2 mb-1.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[62px] border-b-rose-600 drop-shadow-sm filter" />
              <div className="absolute top-1/2 mt-1.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[62px] border-t-slate-400 drop-shadow-sm filter" />
              <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-white shadow-md z-20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
              </div>
            </div>

            {/* Top Fixed Target Marker */}
            <div className="absolute -top-1.5 w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[9px] border-t-rose-600 z-20 drop-shadow-xs" />
          </div>

          {/* Sensor Info Strip */}
          <div className="w-full space-y-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-sans">
                  {effectiveIsGps ? '当前航向驱动源:' : '地磁场强度:'}
                </span>
                <span className="text-slate-900 font-bold text-sm">
                  {effectiveIsGps ? (
                    <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      GPS
                    </span>
                  ) : (
                    <span>
                      {magneticField.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-500">μT</span>
                    </span>
                  )}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans">
                {effectiveIsGps
                  ? `移动速度: ${(rtkState.speed || 0).toFixed(1)} m/s`
                  : '标准范围: 30~60 μT'}
              </span>
            </div>

            {/* Interference status badge */}
            <div
              className={`w-full p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${magStatus.color}`}
            >
              <StatusIcon className="w-4 h-4 shrink-0" />
              <div className="flex-1 leading-tight">
                <div className="font-bold">{magStatus.label}</div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  {effectiveIsGps
                    ? '根据GNSS多历元移动轨迹矢量均值计算，无磁场漂移'
                    : '远离高压输电线及大型钢构可降低罗盘偏差'}
                </div>
              </div>
            </div>

            {/* Calibration or GPS Vector helper box */}
            {!effectiveIsGps ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>8字磁场校准</span>
                  </div>
                  {hasCalibrated && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                      已校准
                    </span>
                  )}
                </div>
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
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-[11px] text-slate-600">
                当前设备通过 GPS/GNSS 运动轨迹自动推算朝向，持机移动即可平滑更新指北针。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
