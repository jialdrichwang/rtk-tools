import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sliders,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { soundService } from '../../utils/sound';
import { SurveyCompassDial } from '../common/SurveyCompassDial';
import { StandardCompassDial } from '../common/StandardCompassDial';
import { MagneticFieldGraph } from './MagneticFieldGraph';
import { Footprints, MapPin, Gauge } from 'lucide-react';

interface CompassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompassModal: React.FC<CompassModalProps> = ({ isOpen, onClose }) => {
  const { rtkState, gpsCourseHeading, gpsSamplingStats, stepSimulateMovement } = useRTK();
  // Default to 0° (Magnetic North) or realistic azimuth
  const [heading, setHeading] = useState(0);
  const [hasSensor, setHasSensor] = useState(false);
  const [magneticField, setMagneticField] = useState(48.5); // microteslas (μT)
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [hasCalibrated, setHasCalibrated] = useState(false);
  // Default strictly to 'mag_lock' (地磁南北锁定)
  const [headingMode, setHeadingMode] = useState<'mag_lock' | 'gps_course'>('mag_lock');
  const [dialStyle, setDialStyle] = useState<'survey_transit' | 'standard'>('survey_transit');
  const [numberMode, setNumberMode] = useState<'cardinal' | 'steps30'>('cardinal');
  const [dialRotation, setDialRotation] = useState(0);
  // Damping Filter Level:
  // 'stable': 测绘稳态阻尼 (alpha = 0.08, deadband = 0.45°) - 极稳读数，消除细微抖动
  // 'smooth': 智能平滑 (alpha = 0.16, deadband = 0.28°) - 灵敏兼顾防抖
  // 'direct': 直读 (无滤波)
  const [filterMode, setFilterMode] = useState<'stable' | 'smooth' | 'direct'>('stable');
  // Second page (drawer/page) popup state for detailed diagnostics, calibration & curve
  const [showSecondPage, setShowSecondPage] = useState(false);

  // Viewport landscape orientation state to adapt layout dynamically for horizontal mobile & tablets
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight && window.innerWidth > 540 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth > 540);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Vector Circular Low-Pass Filter Refs (Prevents 0/360 wrap-around jump & noise)
  const cosRef = useRef<number>(1);
  const sinRef = useRef<number>(0);
  const smoothedAngleRef = useRef<number>(0);
  const lastHeadingRef = useRef<number>(0);
  const isFilterInitRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  const applySensorHeading = useCallback(
    (rawDeg: number) => {
      setHasSensor(true);
      const normalized = ((rawDeg % 360) + 360) % 360;

      if (filterMode === 'direct') {
        const rounded = Math.round(normalized);
        lastHeadingRef.current = rounded;
        setHeading(rounded);
        return;
      }

      if (!isFilterInitRef.current) {
        isFilterInitRef.current = true;
        const rad = (normalized * Math.PI) / 180;
        cosRef.current = Math.cos(rad);
        sinRef.current = Math.sin(rad);
        smoothedAngleRef.current = normalized;
        const rounded = Math.round(normalized);
        lastHeadingRef.current = rounded;
        setHeading(rounded);
        return;
      }

      // Weights based on filter mode
      const alpha = filterMode === 'stable' ? 0.08 : 0.16;
      const deadband = filterMode === 'stable' ? 0.45 : 0.28;

      const rad = (normalized * Math.PI) / 180;
      const targetCos = Math.cos(rad);
      const targetSin = Math.sin(rad);

      // Circular Vector Low-Pass Exponential Moving Average
      cosRef.current = (1 - alpha) * cosRef.current + alpha * targetCos;
      sinRef.current = (1 - alpha) * sinRef.current + alpha * targetSin;

      let deg = (Math.atan2(sinRef.current, cosRef.current) * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      smoothedAngleRef.current = deg;

      // Deadband filter: ignore microscopic jitter to keep number steady for reading
      const diff = Math.abs((((deg - lastHeadingRef.current) + 540) % 360) - 180);
      if (diff >= deadband) {
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const rounded = Math.round(smoothedAngleRef.current);
            lastHeadingRef.current = rounded;
            setHeading(rounded);
          });
        }
      }
    },
    [filterMode]
  );

  const setManualPresetHeading = (val: number) => {
    const rad = (val * Math.PI) / 180;
    cosRef.current = Math.cos(rad);
    sinRef.current = Math.sin(rad);
    smoothedAngleRef.current = val;
    lastHeadingRef.current = val;
    setHeading(val);
  };

  // Device orientation / RTK Heading
  useEffect(() => {
    if (!isOpen) return;

    const handleOrientation = (e: any) => {
      // iOS Safari provides webkitCompassHeading
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        applySensorHeading(e.webkitCompassHeading);
        return;
      }
      // Chrome/Android absolute orientation
      if (e.absolute === true && e.alpha !== null && !isNaN(e.alpha)) {
        const compassHeading = (360 - e.alpha) % 360;
        applySensorHeading(compassHeading);
        return;
      }
      // Standard orientation fallback
      if (e.alpha !== null && !isNaN(e.alpha)) {
        const compassHeading = (360 - e.alpha) % 360;
        applySensorHeading(compassHeading);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
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
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearInterval(timer);
    };
  }, [isOpen, isCalibrating, applySensorHeading]);

  if (!isOpen) return null;

  // In 'mag_lock' mode, heading is strictly locked to geomagnetic North/South
  // and does NOT follow GPS motion course!
  const isGpsMode = headingMode === 'gps_course';
  const activeHeading = isGpsMode
    ? (gpsCourseHeading || rtkState.heading || heading || 0)
    : heading;

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
    if (isGpsMode) {
      return {
        level: 'gps',
        label: 'GPS 卫星运动矢量推算 (跟随移动方向)',
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        icon: Navigation,
      };
    }
    if (magneticField >= 40 && magneticField <= 58) {
      return {
        level: 'good',
        label: '地磁场锁定正常：指针红端指北，蓝端指南',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: CheckCircle2,
      };
    }
    if ((magneticField >= 32 && magneticField < 40) || (magneticField > 58 && magneticField <= 72)) {
      return {
        level: 'warn',
        label: '存在轻度地磁波动，仍保持物理南北指向',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: AlertTriangle,
      };
    }
    return {
      level: 'danger',
      label: '强磁场干扰！建议8字校准罗盘',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      icon: ShieldAlert,
    };
  };

  const magStatus = getMagneticStatus();
  const StatusIcon = magStatus.icon;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg sm:max-w-[530px] landscape:max-w-5xl landscape:w-[96vw] overflow-hidden shadow-2xl flex flex-col max-h-[96vh] landscape:max-h-[92vh] relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0">
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

        {/* [USER REQ] 第一页：地磁锁定与运动航向占高为一文字行 */}
        <div className="bg-slate-100/95 px-3 py-1 flex items-center justify-between text-xs border-b border-slate-200 shrink-0 leading-none">
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs leading-none">
            <button
              type="button"
              onClick={() => {
                soundService.playClick();
                setHeadingMode('mag_lock');
              }}
              title="地磁南北锁定：指针严格锁定地球磁北和磁南"
              className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1 leading-none ${
                !isGpsMode
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CompassIcon className="w-3.5 h-3.5 shrink-0" />
              <span>地磁锁定</span>
              {!isGpsMode && (
                <span className="text-[10px] bg-emerald-700/90 text-emerald-100 px-1 py-0.2 rounded font-mono font-medium leading-none">
                  已锁定
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                soundService.playClick();
                setHeadingMode('gps_course');
              }}
              title="仅在行进中根据GPS运动矢量推算前进航迹"
              className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1 leading-none ${
                isGpsMode
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>运动航向</span>
              {isGpsMode && (
                <span className="text-[10px] bg-blue-700/90 text-blue-100 px-1 py-0.2 rounded font-mono font-medium leading-none">
                  GPS航迹
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 pr-1">
            <span>外沿触屏360°旋转</span>
          </div>
        </div>

        {/* 顶部航向度数与偏角快捷状态指示栏 */}
        <div className="bg-white px-3.5 py-1.5 flex items-center justify-between border-b border-slate-200/80 text-xs sm:text-sm gap-2 shrink-0">
          {/* 左侧：航向度数与主方位 */}
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight leading-none">
              {Math.round(activeHeading)}°
            </span>
            <span className="text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 leading-none">
              {getDirectionText(activeHeading)}
            </span>
          </div>

          {/* 右侧：刻度偏角快捷状态与归零 */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* 刻度偏角 */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono transition ${
                dialRotation !== 0
                  ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="罗盘刻度偏角 (可直接在罗盘外沿触屏360度循环旋转)"
            >
              <span className="font-sans text-[11px] text-slate-500 font-normal">刻度偏角:</span>
              <span>{dialRotation > 0 ? `+${dialRotation.toFixed(1)}°` : `${dialRotation.toFixed(1)}°`}</span>
              {dialRotation !== 0 && (
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setDialRotation(0);
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-white hover:bg-blue-100 text-blue-600 border border-blue-200 cursor-pointer font-sans ml-0.5"
                  title="点击重置刻度偏角为 0°"
                >
                  归零
                </button>
              )}
            </div>
          </div>
        </div>

        {/* [USER REQ] 主视口：空间释放，罗盘尺寸大大增加！右下角提供弹出按钮【更多】 */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden relative bg-slate-50/40">
          <div className="w-full h-full flex items-center justify-center py-1">
            <div className="w-[90vw] h-[90vw] max-w-[400px] max-h-[400px] sm:max-w-[440px] sm:max-h-[440px] landscape:max-w-[340px] landscape:max-h-[340px] aspect-square flex items-center justify-center shrink-0">
              {dialStyle === 'survey_transit' ? (
                <SurveyCompassDial
                  heading={activeHeading}
                  size={isLandscape ? 330 : 380}
                  numberMode={numberMode}
                  showForwardMarker={true}
                  dialRotation={dialRotation}
                  onRotationChange={setDialRotation}
                  filterMode={filterMode}
                  onToggleFilter={() => {
                    soundService.playClick();
                    setFilterMode((prev) => (prev === 'stable' ? 'smooth' : prev === 'smooth' ? 'direct' : 'stable'));
                  }}
                />
              ) : (
                <StandardCompassDial
                  heading={activeHeading}
                  size={isLandscape ? 330 : 380}
                />
              )}
            </div>
          </div>

          {/* [USER REQ] 右下角弹出按钮：“更多” */}
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setShowSecondPage(true);
            }}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/35 flex items-center gap-1.5 cursor-pointer transition hover:shadow-xl"
            title="展开第二栏：XYZ磁力时间曲线、环境磁场与测绘校准"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>更多</span>
          </button>
        </div>

        {/* [USER REQ] 弹出式第二栏：单占一整页，增加“收回”按钮收回第二栏 */}
        {showSecondPage && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col animate-in fade-in duration-150">
            {/* 顶栏与收回按钮 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="font-bold text-sm text-slate-800">详细测绘工具与地磁监测 (第二栏)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  setShowSecondPage(false);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="收回第二栏，返回超大罗盘"
              >
                <ChevronDown className="w-4 h-4" />
                <span>收回</span>
              </button>
            </div>

            {/* 第二栏单页详细内容列表 (已按要求移除刻度偏角微调与设置、切换为标准航向盘、切换为主象限刻度) */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 min-h-0">
              {/* 1. 磁力与时间曲线 (XYZ三轴 近10秒) */}
              <div className="w-full shrink-0">
                <MagneticFieldGraph
                  currentField={magneticField}
                  heading={activeHeading}
                  onReset={() => setMagneticField(48.5)}
                />
              </div>

              {/* 2. 环境磁场健康状态 */}
              <div className="w-full shrink-0">
                <div className={`rounded-2xl p-3 border text-xs flex items-center gap-2.5 ${magStatus.color}`}>
                  <StatusIcon className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-medium leading-relaxed">{magStatus.label}</span>
                </div>
              </div>

              {/* 4. GPS 运动航迹采样 (若处于运动航向模式) */}
              {isGpsMode && (
                <div className="w-full bg-blue-50/80 border border-blue-200 rounded-2xl p-3 space-y-2 text-xs shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900">
                      <Footprints className="w-4 h-4 text-blue-600" />
                      <span>GPS 信号移动采样航向推算</span>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        gpsSamplingStats.isMoving
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {gpsSamplingStats.isMoving ? '🟢 移动采样中' : '🟡 驻留 (锁定末次航向)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="bg-white/90 border border-blue-100 rounded-xl p-2">
                      <div className="text-[10px] text-slate-500 font-sans">采样点数</div>
                      <div className="font-black text-slate-800 text-sm mt-0.5">
                        {gpsSamplingStats.sampleCount} <span className="text-[10px] font-normal">pts</span>
                      </div>
                    </div>
                    <div className="bg-white/90 border border-blue-100 rounded-xl p-2">
                      <div className="text-[10px] text-slate-500 font-sans">累积位移</div>
                      <div className="font-black text-blue-700 text-sm mt-0.5">
                        {gpsSamplingStats.displacementMeters.toFixed(1)} <span className="text-[10px] font-normal">m</span>
                      </div>
                    </div>
                    <div className="bg-white/90 border border-blue-100 rounded-xl p-2">
                      <div className="text-[10px] text-slate-500 font-sans">采样航速</div>
                      <div className="font-black text-emerald-700 text-sm mt-0.5">
                        {gpsSamplingStats.currentSpeedMps.toFixed(1)} <span className="text-[10px] font-normal">m/s</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-blue-800/80 truncate">
                      {gpsSamplingStats.statusText}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepSimulateMovement(1.2)}
                      className="px-2.5 py-1.2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      title="模拟行走一步 (位移1.2m)"
                    >
                      <Footprints className="w-3.5 h-3.5" />
                      <span>步进移动 (+1.2m)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. 8字校准罗盘卡片 */}
              <div className="w-full shrink-0">
                {isCalibrating ? (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        请握持设备在空中做 8 字形慢速旋转...
                      </span>
                      <span>{calibrationProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${calibrationProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startCalibration}
                    className="w-full py-2.8 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span>进行 8 字形罗盘校准</span>
                  </button>
                )}
              </div>

              {/* 6. 虚拟朝向预设测试（无物理传感器时） */}
              {!hasSensor && !isGpsMode && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shrink-0">
                  <span className="text-xs text-slate-500 mr-1">测试朝向:</span>
                  {[
                    { label: '正北 0°', val: 0 },
                    { label: '正东 90°', val: 90 },
                    { label: '正南 180°', val: 180 },
                    { label: '正西 270°', val: 270 },
                    { label: '西北 308°', val: 308 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setManualPresetHeading(preset.val)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                        heading === preset.val
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 底部收回操作按钮 */}
              <div className="pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setShowSecondPage(false);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>收回第二栏 (返回大罗盘)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
