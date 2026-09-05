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
import { SurveyCompassDial } from '../common/SurveyCompassDial';

interface CompassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompassModal: React.FC<CompassModalProps> = ({ isOpen, onClose }) => {
  const { rtkState, hasMagnetometer, isUsingGpsHeading, gpsCourseHeading } = useRTK();
  const [heading, setHeading] = useState(247);
  const [magneticField, setMagneticField] = useState(48.5); // microteslas (μT)
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [hasCalibrated, setHasCalibrated] = useState(false);
  const [forcedHeadingMode, setForcedHeadingMode] = useState<'auto' | 'gps' | 'mag'>('auto');
  const [dialStyle, setDialStyle] = useState<'survey_transit' | 'standard'>('survey_transit');
  const [numberMode, setNumberMode] = useState<'cardinal' | 'steps30'>('cardinal');

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
    ? gpsCourseHeading || rtkState.heading || 247
    : heading || rtkState.heading || 247;

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md sm:max-w-[490px] overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <CompassIcon className="w-4 h-4 text-blue-600" />
            <span>高精地质测绘罗盘与电子航向</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Heading Sensor Mode & Dial Style Switch */}
        <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between text-xs border-b border-slate-200 gap-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDialStyle(dialStyle === 'survey_transit' ? 'standard' : 'survey_transit')}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              {dialStyle === 'survey_transit' ? '📐 地质罗盘' : '🧭 标准航向盘'}
            </button>

            {dialStyle === 'survey_transit' && (
              <button
                onClick={() => setNumberMode(numberMode === 'cardinal' ? 'steps30' : 'cardinal')}
                title="切换刻度数字密度"
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs hover:bg-blue-100 transition cursor-pointer"
              >
                {numberMode === 'cardinal' ? '🎯 360/90/180/270 (精简大字)' : '🔢 30°细分刻度'}
              </button>
            )}
          </div>

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
              地磁传感
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3.5 flex-1 flex flex-col items-center justify-between space-y-2.5 overflow-y-auto">
          {/* Main Azimuth Display */}
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
            <div className="text-xs font-bold text-blue-600 mt-0.5">
              {getDirectionText(activeHeading)}
            </div>
          </div>

          {/* Compass Dial Area: Uses Authentic Geological Survey Compass matching 指南针new.jpg */}
          {dialStyle === 'survey_transit' ? (
            <div className="w-full flex items-center justify-center py-1">
              <SurveyCompassDial heading={activeHeading} size={370} numberMode={numberMode} showForwardMarker={true} />
            </div>
          ) : (
            /* Standard Rotating Dial */
            <div
              style={{ width: '280px', height: '280px' }}
              className="relative flex items-center justify-center my-1"
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
          )}

          {/* Sensor Info Strip */}
          <div className="w-full space-y-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-sans">
                  {effectiveIsGps ? '航向驱动源:' : '地磁场强度:'}
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
                  : '自然环境基准'}
              </span>
            </div>

            {/* Environmental Magnetic Field Status */}
            <div className={`rounded-xl p-2 border text-xs flex items-center gap-2 ${magStatus.color}`}>
              <StatusIcon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-medium leading-tight">{magStatus.label}</span>
            </div>
          </div>

          {/* Calibration Action */}
          <div className="w-full pt-1">
            {isCalibrating ? (
              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex justify-between text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    请握持设备在空中做 8 字形慢速旋转...
                  </span>
                  <span>{calibrationProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${calibrationProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={startCalibration}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>8字校准罗盘</span>
                </button>
                <button
                  onClick={() => {
                    soundService.playClick();
                    onClose();
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
