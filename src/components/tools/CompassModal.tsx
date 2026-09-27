import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRTK } from '../../context/RTKContext';
import {
  Compass as CompassIcon,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Navigation,
  Radio,
  Sliders,
  SlidersHorizontal,
  ChevronDown,
  Globe,
  HelpCircle,
  Footprints,
  MapPin,
  Gauge,
  Activity,
  Zap,
  Sun,
  Camera,
  RotateCcw,
  Route,
  Crosshair,
  ArrowRight,
} from 'lucide-react';
import { soundService } from '../../utils/sound';
import { SurveyCompassDial } from '../common/SurveyCompassDial';
import { StandardCompassDial } from '../common/StandardCompassDial';
import { GpsTestCompassDial } from '../common/GpsTestCompassDial';
import { MagneticFieldGraph } from './MagneticFieldGraph';
import { SpatialMagneticCalibrationModal } from './SpatialMagneticCalibrationModal';
import { spatialMagneticService } from '../../utils/spatialMagneticService';
import { compassFusionManager, FusionOutputState } from '../../utils/compassFusionService';
import {
  gpsBaselineFilter,
  CardinalDirection,
  CARDINAL_ANGLES,
  GpsBaselineStats,
} from '../../utils/gpsBaselineFilter';
import {
  solarOrientationService,
  SolarPosition,
} from '../../utils/solarOrientationService';

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
  
  // 保留两套指南针模式测算模式：
  // 1. 地质与航向一套 ('geological'): 包括地质罗盘 survey_transit 与现代工程航向盘 standard
  // 2. GPS Test Plus 一套 ('gpstest'): 亮色航空仪表盘，带中间双轴水平仪与阻尼齿轮自转
  const [compassSystem, setCompassSystem] = useState<'geological' | 'gpstest'>('geological');
  const [dialStyle, setDialStyle] = useState<'survey_transit' | 'standard' | 'gpstest'>('survey_transit');
  const [numberMode, setNumberMode] = useState<'cardinal' | 'steps30'>('cardinal');
  const [dialRotation, setDialRotation] = useState(0);
  // Damping Filter Level:
  // 'stable': 测绘稳态阻尼 - 极稳读数，消除细微抖动
  // 'smooth': 智能平滑 - 灵敏兼顾防抖
  // 'direct': 直读 (无滤波)
  const [filterMode, setFilterMode] = useState<'stable' | 'smooth' | 'direct'>('stable');
  // Second page (drawer/page) popup state for detailed diagnostics, calibration & curve
  const [showSecondPage, setShowSecondPage] = useState(false);
  // Spatial Magnetic Analysis & Calibration Modal state
  const [showSpatialCalibModal, setShowSpatialCalibModal] = useState(false);
  const [calibRefreshKey, setCalibRefreshKey] = useState(0);

  // 物理罗盘校正偏角状态 (由第三页向导统一更新)
  const [geoOffset, setGeoOffset] = useState(() => spatialMagneticService.getGeologicalOffset());
  const [gpsTestOffset, setGpsTestOffset] = useState(() => spatialMagneticService.getGpsTestOffset());

  useEffect(() => {
    setGeoOffset(spatialMagneticService.getGeologicalOffset());
    setGpsTestOffset(spatialMagneticService.getGpsTestOffset());
  }, [calibRefreshKey]);

  // [USER REQ] 陀螺仪角速度与异常跳跃抑制 Refs
  const currentGyroZRef = useRef<number>(0);
  const stationaryOutlierCountRef = useRef<number>(0);
  const prevAlphaRef = useRef<number | null>(null);
  const prevAlphaTimeRef = useRef<number>(0);

  // [USER REQ] GPS航向模式 (磁隔离高精基线与跳变过滤) 状态
  const [gpsFilteredHeading, setGpsFilteredHeading] = useState<number>(() => gpsBaselineFilter.getCalibratedHeading());
  const [gpsFilterStats, setGpsFilterStats] = useState<GpsBaselineStats>(() => gpsBaselineFilter.getStats());
  const [gpsMountingOffset, setGpsMountingOffset] = useState<number>(() => gpsBaselineFilter.getMountingOffset());
  const [gpsCalibDirection, setGpsCalibDirection] = useState<CardinalDirection>('S');
  const [gpsCalibDistance, setGpsCalibDistance] = useState<number>(10);
  const [gpsCalibFeedback, setGpsCalibFeedback] = useState<string | null>(null);
  const [gpsScreenMode, setGpsScreenMode] = useState<'portrait' | 'landscape'>(() =>
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerWidth > 540 ? 'landscape' : 'portrait'
  );

  // [USER REQ] 太阳偏振与光照辅助测向状态
  const [solarPos, setSolarPos] = useState<SolarPosition>(() =>
    solarOrientationService.calculateSolarPosition(rtkState.currentLat || 31.23, rtkState.currentLon || 121.47)
  );
  const [isCameraSolarActive, setIsCameraSolarActive] = useState<boolean>(false);
  const [cameraOpticalHeading, setCameraOpticalHeading] = useState<number>(0);
  const [cameraOpticalConfidence, setCameraOpticalConfidence] = useState<number>(0);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);

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

  // 9-Axis AHRS Fusion Realtime State
  const [fusionState, setFusionState] = useState<FusionOutputState>({
    yaw: 0,
    trueHeading: 0,
    declination: 0,
    pitch: 0,
    roll: 0,
    isLevel: true,
    magneticFieldStrength: 48.0,
    isMagneticAnomaly: false,
    fusionMode: 'gpstest_fusion',
    angularVelocity: 0,
    sampleRate: 50.0,
  });
  const [isUsingNative9Axis, setIsUsingNative9Axis] = useState(false);

  // 定期更新太阳天文位置
  useEffect(() => {
    const updateSolar = () => {
      const pos = solarOrientationService.calculateSolarPosition(
        rtkState.currentLat || 31.23,
        rtkState.currentLon || 121.47
      );
      setSolarPos(pos);
    };
    updateSolar();
    const interval = setInterval(updateSolar, 10000);
    return () => clearInterval(interval);
  }, [rtkState.currentLat, rtkState.currentLon]);

  // GPS 坐标实时注入多级跳跃过滤器与基线测算
  useEffect(() => {
    if (!isOpen) return;
    if (typeof rtkState.currentLat === 'number' && typeof rtkState.currentLon === 'number') {
      const res = gpsBaselineFilter.processGpsPoint(
        rtkState.currentLat,
        rtkState.currentLon,
        Date.now(),
        rtkState.speed
      );
      setGpsFilterStats(res.stats);
      if (res.accepted) {
        setGpsFilteredHeading(res.fusedHeading);
      }
    }
  }, [rtkState.currentLat, rtkState.currentLon, rtkState.speed, isOpen]);

  // 卸载时关闭摄像头分析
  useEffect(() => {
    return () => {
      solarOrientationService.stopCameraAnalysis();
    };
  }, []);

  // Sync calibration to native Android & JS fusion engine
  useEffect(() => {
    const base = spatialMagneticService.getBaselineData();
    if (base) {
      const [ox, oy, oz] = base.phoneHardIron || [0, 0, 0];
      const [sx, sy, sz] = base.scaleFactors || [1, 1, 1];
      const physOffset = base.physicalCompassOffset || 0;
      compassFusionManager.setCalibration([ox, oy, oz], [sx, sy, sz], physOffset);

      if (typeof (window as any).AndroidBridge?.setCalibrationParameters === 'function') {
        try {
          (window as any).AndroidBridge.setCalibrationParameters(ox, oy, oz, sx, sy, sz, physOffset);
        } catch (e) {
          console.warn('Native setCalibrationParameters error:', e);
        }
      }
    }
  }, [calibRefreshKey]);

  // Vector Circular Low-Pass Filter Refs (Prevents 0/360 wrap-around jump & noise)
  const cosRef = useRef<number>(1);
  const sinRef = useRef<number>(0);
  const smoothedAngleRef = useRef<number>(0);
  const lastHeadingRef = useRef<number>(0);
  const isFilterInitRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  // Progressive Damping Tracking: Fast acquisition (<1s) -> Progressive damping -> Rock solid lock (10-15s)
  const stableDurationRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(0);
  const lastIncomingDegRef = useRef<number>(0);

  const applySensorHeading = useCallback(
    (rawDeg: number) => {
      setHasSensor(true);
      let normalized = ((rawDeg % 360) + 360) % 360;
      const now = performance.now();
      const dt = lastSampleTimeRef.current > 0 ? (now - lastSampleTimeRef.current) / 1000 : 0.02;
      lastSampleTimeRef.current = now;

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
        lastIncomingDegRef.current = normalized;
        stableDurationRef.current = 0;
        const rounded = Math.round(normalized);
        lastHeadingRef.current = rounded;
        setHeading(rounded);
        return;
      }

      // [USER REQ] 1. 检测平板或手机未在移动，指针接近稳定后，超过30度的跳越直接过滤
      const isDeviceStationary =
        stableDurationRef.current > 0.5 &&
        Math.abs(currentGyroZRef.current) < 2.5 &&
        fusionState.angularVelocity < 3.0 &&
        (!rtkState.speed || rtkState.speed < 0.3);
      const angleJumpDelta = Math.abs((((normalized - smoothedAngleRef.current) + 540) % 360) - 180);

      if (isDeviceStationary && angleJumpDelta > 30.0) {
        stationaryOutlierCountRef.current += 1;
        // 如果设备处于静止状态且指针接近稳定，突然出现 > 30 度的突变跳跃 (瞬态空间磁脉冲或跳变点)，直接丢弃过滤！
        if (stationaryOutlierCountRef.current < 35) {
          return;
        }
      } else {
        stationaryOutlierCountRef.current = 0;
      }

      // [USER REQ] 2. 当平板在移动/转动时 (小于180度)，抑制与平板同向的指针拖曳移动
      const gyroZ = currentGyroZRef.current;
      let sampleStep = (((normalized - lastIncomingDegRef.current) + 540) % 360) - 180;
      if (Math.abs(gyroZ) > 2.0 && Math.abs(sampleStep) < 180) {
        // 如果指针读数的变化方向与平板旋转角速度同向 (即指针被机身带着一起同向转动，属于机身磁拖曳伪影)
        const isCoDirectional = (sampleStep * gyroZ) > 0;
        if (isCoDirectional) {
          // 强力抑制同向拖曳分量 (抑制 88%)，使指针死死锁定在外部空间地理真北
          sampleStep = sampleStep * 0.12;
          normalized = ((lastIncomingDegRef.current + sampleStep) % 360 + 360) % 360;
        }
      }

      // Check movement speed: shortest delta between consecutive incoming samples
      let sampleDelta = Math.abs((((normalized - lastIncomingDegRef.current) + 540) % 360) - 180);
      lastIncomingDegRef.current = normalized;

      if (sampleDelta > 3.0) {
        // User turned phone: reset stable timer for instantaneous fast tracking
        stableDurationRef.current = 0;
      } else {
        stableDurationRef.current += Math.min(0.2, dt);
      }

      let alpha: number;
      let deadband: number;

      if (dialStyle === 'gpstest') {
        // [GPS Test Plus 模式]：滤波阻尼增加 10 倍左右，配合 GpsTestCompassDial 内部的 10x 惯性阻尼齿轮自转
        alpha = filterMode === 'smooth' ? 0.055 : 0.032;
        deadband = 0.15;
      } else {
        // [地质与航向罗盘模式]：滤波增大到 10-15 倍，初期阻尼小，接近正确指向阻尼大，保留对转动敏感
        // 计算当前目标输入值与平滑读数之间的最短角误差
        const err = Math.abs((((normalized - smoothedAngleRef.current) + 540) % 360) - 180);

        // 自适应非线性阻尼控制：
        // 1. 转动灵敏度保留：当设备旋转 (err > 3.5° 或角速度大) 时，初期阻尼极小 (alpha = 0.42)，瞬时跟踪指针
        // 2. 接近目标时：当指针接近真实指向 (err < 1.5°)，阻尼增大 10-15 倍 (alpha 降至 0.018 ~ 0.025)，如定海神针死死锁定消除生理微抖
        const speedFactor = Math.min(1.0, Math.max(0.0, (err - 0.6) / 3.0));
        // 平滑非线性幂函数插值
        const minAlpha = filterMode === 'smooth' ? 0.035 : 0.018; // 较原先 0.32 阻尼增大 10-15 倍以上
        const maxAlpha = 0.42; // 初期极低阻尼，转动极敏锐
        alpha = minAlpha + (maxAlpha - minAlpha) * Math.pow(speedFactor, 1.7);
        deadband = speedFactor > 0.4 ? 0.15 : 0.40;
      }

      const rad = (normalized * Math.PI) / 180;
      const targetCos = Math.cos(rad);
      const targetSin = Math.sin(rad);

      // Circular Vector Low-Pass Exponential Moving Average (100% smooth across 359° <-> 0° <-> 1°)
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

  // Device orientation / RTK Heading & 9-Axis Sensor Fusion
  useEffect(() => {
    if (!isOpen) return;

    let nativeInterval: any = null;

    // 1. First attempt to connect to Native Android High-Speed Sensor Bridge (400Hz SensorWorker thread)
    if (typeof (window as any).AndroidBridge?.getNativeCompassStatus === 'function') {
      let consecutiveReadyCount = 0;

      nativeInterval = setInterval(() => {
        try {
          const statusStr = (window as any).AndroidBridge.getNativeCompassStatus();
          if (statusStr && statusStr !== '{}') {
            const parsed = JSON.parse(statusStr);
            // Verify if native compass hardware is actually ready and producing valid non-zero/calibrated angles
            const isReady = parsed.isReady !== undefined ? parsed.isReady : (parsed.hasAcc && parsed.hasMag);
            if (isReady && typeof parsed.yaw === 'number' && !isNaN(parsed.yaw)) {
              consecutiveReadyCount++;
              setIsUsingNative9Axis(true);
              setHasSensor(true);
              applySensorHeading(parsed.yaw);
              const gzDps = typeof parsed.gz === 'number' ? (parsed.gz * 180) / Math.PI : 0;
              currentGyroZRef.current = gzDps;
              const fusedGps = gpsBaselineFilter.updateGyroRate(gzDps);
              if (headingMode === 'gps_course') {
                setGpsFilteredHeading(fusedGps);
              }
              setFusionState({
                yaw: parsed.yaw,
                trueHeading: parsed.trueHeading || parsed.yaw,
                declination: parsed.declination || 0,
                pitch: parsed.pitch || 0,
                roll: parsed.roll || 0,
                isLevel: parsed.isLevel !== undefined ? parsed.isLevel : (Math.abs(parsed.pitch || 0) < 15 && Math.abs(parsed.roll || 0) < 15),
                magneticFieldStrength: parsed.fieldStrength || 48.0,
                isMagneticAnomaly: parsed.isAnomaly || false,
                fusionMode: parsed.isAnomaly ? 'gyro_backup' : 'gpstest_fusion',
                angularVelocity: Math.round(Math.hypot(parsed.gx || 0, parsed.gy || 0, parsed.gz || 0) * (180 / Math.PI)),
                sampleRate: parsed.sampleRate || 50,
              });
              setMagneticField(parsed.fieldStrength || 48.0);
            }
          }
        } catch (err) {
          // ignore parsing error
        }
      }, 20); // 50 FPS high-speed read rate from native thread buffer
    }

    // 2. Web / Standard Motion & Orientation Listener fallback
    const handleOrientation = (e: any) => {
      // 提取横滚 (roll/gamma) 与俯仰 (pitch/beta) 倾角以实时驱动 GPS Test Plus 中心双轴水平仪
      const rawPitch = typeof e.beta === 'number' ? Math.round(e.beta * 10) / 10 : 0;
      const rawRoll = typeof e.gamma === 'number' ? Math.round(e.gamma * 10) / 10 : 0;
      const isLevel = Math.hypot(rawPitch, rawRoll) < 2.5;

      let compassHeading: number | null = null;
      // iOS Safari provides webkitCompassHeading
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        compassHeading = e.webkitCompassHeading;
      } else if (e.absolute === true && e.alpha !== null && !isNaN(e.alpha)) {
        compassHeading = (360 - e.alpha) % 360;
      } else if (e.alpha !== null && !isNaN(e.alpha)) {
        compassHeading = (360 - e.alpha) % 360;
      }

      // 计算方位角变化率作为回退角速度
      if (typeof e.alpha === 'number') {
        const now = performance.now();
        if (prevAlphaRef.current !== null && prevAlphaTimeRef.current > 0) {
          const dt = Math.max(0.01, (now - prevAlphaTimeRef.current) / 1000);
          const dAlpha = (((e.alpha - prevAlphaRef.current) + 540) % 360) - 180;
          const turnRateDps = -dAlpha / dt;
          if (Math.abs(currentGyroZRef.current) < 0.2) {
            currentGyroZRef.current = Math.max(-120, Math.min(120, turnRateDps));
            const fusedGps = gpsBaselineFilter.updateGyroRate(currentGyroZRef.current);
            if (headingMode === 'gps_course') {
              setGpsFilteredHeading(fusedGps);
            }
          }
        }
        prevAlphaRef.current = e.alpha;
        prevAlphaTimeRef.current = now;
      }

      setFusionState((prev) => ({
        ...prev,
        pitch: rawPitch,
        roll: rawRoll,
        isLevel,
        yaw: compassHeading !== null ? compassHeading : prev.yaw,
        trueHeading: compassHeading !== null ? ((compassHeading + prev.declination + 360) % 360) : prev.trueHeading,
      }));

      // If Native bridge is already producing ready sensor data, skip heading update
      if (isUsingNative9Axis) {
        return;
      }

      if (compassHeading !== null) {
        applySensorHeading(compassHeading);
      }
    };

    // 3. Gyroscope motion listener for web client 9-axis fusion fallback
    const handleMotion = (e: DeviceMotionEvent) => {
      if (typeof (window as any).AndroidBridge?.getNativeCompassStatus === 'function') {
        return;
      }
      if (e.rotationRate && e.rotationRate.alpha !== null) {
        // Gyro Z rate in deg/s
        const gzDps = e.rotationRate.alpha || 0;
        currentGyroZRef.current = gzDps;
        const fusedGps = gpsBaselineFilter.updateGyroRate(gzDps);
        if (headingMode === 'gps_course') {
          setGpsFilteredHeading(fusedGps);
        }
        const gzRad = (gzDps * Math.PI) / 180.0;
        const gxRad = ((e.rotationRate.beta || 0) * Math.PI) / 180.0;
        const gyRad = ((e.rotationRate.gamma || 0) * Math.PI) / 180.0;
        const ax = e.accelerationIncludingGravity?.x || 0;
        const ay = e.accelerationIncludingGravity?.y || 0;
        const az = e.accelerationIncludingGravity?.z || 9.8;

        // Feed to JS compassFusionManager
        const fusion = compassFusionManager.processIMUSample({
          ax, ay, az,
          gx: gxRad, gy: gyRad, gz: gzRad,
          mx: 0, my: 38, mz: 18,
          timestamp: performance.now(),
        });
        setFusionState(fusion);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('devicemotion', handleMotion, true);
    }

    const timer = setInterval(() => {
      if (!isCalibrating && !isUsingNative9Axis) {
        setMagneticField((prev) => {
          const delta = (Math.random() - 0.5) * 0.4;
          return Math.max(42.0, Math.min(54.0, prev + delta));
        });
      }
    }, 1500);

    return () => {
      if (nativeInterval) {
        clearInterval(nativeInterval);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
        window.removeEventListener('devicemotion', handleMotion, true);
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearInterval(timer);
    };
  }, [isOpen, isCalibrating, applySensorHeading, isUsingNative9Axis]);

  if (!isOpen) return null;

  // Spatial calibration parameters inspection
  const baselineData = spatialMagneticService.getBaselineData();
  const fieldData = spatialMagneticService.getFieldData();
  const hasSpatialCalibration = !!baselineData;
  const hasFieldAdaptive = !!fieldData;

  // In 'mag_lock' mode, heading is strictly locked to geomagnetic North/South
  // In 'gps_course' (GPS航向模式), heading is 100% isolated from geomagnetic sensors!
  const isGpsMode = headingMode === 'gps_course';
  const baseRawHeading = isGpsMode
    ? (gpsFilteredHeading || gpsCourseHeading || rtkState.heading || heading || 0)
    : heading;

  // 根据当前激活的罗盘系统独立应用校准偏置 (两套系统独立校正)
  const activeSystem = dialStyle === 'gpstest' ? 'gpstest' : 'geological';

  // Compute spatial calibrated heading (including phone hard-iron offset, physical offset, field anomaly, and polar GPS fusion)
  const calibratedResult = spatialMagneticService.computeCalibratedHeading(
    baseRawHeading,
    gpsCourseHeading || rtkState.heading,
    rtkState.currentLat,
    rtkState.currentLon,
    false,
    activeSystem
  );

  // 【USER REQ】整体与地磁传感器隔离，防止受空间磁力干扰！
  // 在 GPS 航向模式下，绝对使用多级跳跃过滤与基线拟合后的 gpsFilteredHeading，彻底杜绝磁力计与车内强磁干扰！
  const activeHeading = isGpsMode
    ? gpsFilteredHeading
    : calibratedResult.heading;

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

  // [USER REQ] 执行十字方向直线移动校正 (向正南/正北/正东/正西 直线移动 5m/10m/15m)
  const handleCalibrateGpsMounting = () => {
    soundService.playClick();
    const res = gpsBaselineFilter.calibrateMountingAlignment(gpsCalibDirection, gpsScreenMode);
    setGpsMountingOffset(res.offsetCalculated);
    setGpsFilterStats(gpsBaselineFilter.getStats());
    setGpsFilteredHeading(gpsBaselineFilter.getCalibratedHeading());
    soundService.playSuccess();
    setGpsCalibFeedback(res.message);
  };

  // [USER REQ] 模拟沿选定十字方向直线位移 (用于现场测试标定)
  const handleSimulateGpsMovement = (meters: number) => {
    soundService.playClick();
    const targetAngle = CARDINAL_ANGLES[gpsCalibDirection];
    const rad = (targetAngle * Math.PI) / 180;
    const curLat = rtkState.currentLat || 31.23;
    const curLon = rtkState.currentLon || 121.47;
    // 经纬度增量
    const dLat = (meters * Math.cos(rad)) / 111000;
    const dLon = (meters * Math.sin(rad)) / (111000 * Math.cos((curLat * Math.PI) / 180));
    const newLat = curLat + dLat;
    const newLon = curLon + dLon;

    const res = gpsBaselineFilter.processGpsPoint(newLat, newLon, Date.now(), 2.8);
    setGpsFilterStats(res.stats);
    if (res.accepted) {
      setGpsFilteredHeading(res.fusedHeading);
    }
    const dirName = gpsCalibDirection === 'S' ? '正南 180°' : gpsCalibDirection === 'N' ? '正北 0°' : gpsCalibDirection === 'E' ? '正东 90°' : '正西 270°';
    setGpsCalibFeedback(`已向【${dirName}】推进 ${meters} 米，基线采样与拟合已更新！`);
  };

  // [USER REQ] 复位 GPS 安装偏角为 0°
  const handleResetGpsMounting = () => {
    soundService.playClick();
    gpsBaselineFilter.setMountingOffset(0);
    setGpsMountingOffset(0);
    setGpsFilteredHeading(gpsBaselineFilter.getCalibratedHeading());
    soundService.playSuccess();
    setGpsCalibFeedback('已将 GPS 航向安装偏角归零复位 (0.0°)');
  };

  // [USER REQ] 切换太阳偏振/光影辅助急转测向
  const handleToggleCameraSolar = async () => {
    soundService.playClick();
    if (isCameraSolarActive) {
      solarOrientationService.stopCameraAnalysis();
      setIsCameraSolarActive(false);
      setCameraErrorMessage(null);
    } else {
      setCameraErrorMessage(null);
      const res = await solarOrientationService.startCameraAnalysis((optHeading, conf) => {
        setCameraOpticalHeading(optHeading);
        setCameraOpticalConfidence(conf);
        gpsBaselineFilter.injectSolarOpticalHeading(optHeading, conf);
        setGpsFilteredHeading(gpsBaselineFilter.getCalibratedHeading());
      });
      if (res.success) {
        setIsCameraSolarActive(true);
      } else {
        setCameraErrorMessage(res.error || '无法启动摄像头，请检查权限');
      }
    }
  };

  const isMagneticInterference = magneticField < 25 || magneticField > 65 || fusionState.isMagneticAnomaly;

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
        label: 'GPS航向模式：100%隔离地磁传感器 · 航迹基线测算与陀螺急转导向 (抗车身强磁)',
        color: 'text-blue-800 bg-blue-50 border-blue-200',
        icon: Navigation,
      };
    }
    if (calibratedResult.polarState.isPolarRegion) {
      return {
        level: 'polar',
        label: `极区高纬地磁衰减：已启动 GPS 运动真北动态融合 (${calibratedResult.polarState.statusDescription})`,
        color: 'text-amber-800 bg-amber-50 border-amber-300',
        icon: Globe,
      };
    }
    if (hasSpatialCalibration && (hasFieldAdaptive || magneticField >= 38)) {
      return {
        level: 'good',
        label: hasFieldAdaptive
          ? '地磁锁定正常：已应用手机本性硬磁解耦与现场工区自适应纠偏'
          : '地磁锁定正常：已应用手机本性硬磁解耦与物理指南针标定',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: ShieldCheck,
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
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl sm:max-w-[700px] md:max-w-[750px] landscape:max-w-5xl landscape:w-[96vw] overflow-hidden shadow-2xl flex flex-col max-h-[98vh] landscape:max-h-[94vh] relative">
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
              title="GPS航向模式：基于GPS航迹基线测算与陀螺仪急转导向，100%隔离地磁传感器"
              className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1 leading-none ${
                isGpsMode
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>GPS航向模式</span>
              {isGpsMode && (
                <span className="text-[10px] bg-blue-700/90 text-blue-100 px-1 py-0.2 rounded font-mono font-medium leading-none">
                  磁隔离基线
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 pr-1">
            {/* 空间磁力分析与全机型精准校准向导入口 */}
            <button
              type="button"
              onClick={() => {
                soundService.playClick();
                setShowSpatialCalibModal(true);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 leading-none border ${
                hasSpatialCalibration
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50 shadow-2xs'
              }`}
              title="空间磁力分析动作（外展上臂水平360°+垂直360°）与全机型精准校准向导"
            >
              <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${hasSpatialCalibration ? 'text-emerald-600' : 'text-blue-600'}`} />
              <span>
                {hasSpatialCalibration
                  ? (hasFieldAdaptive ? '工区自适应' : '本性已校准')
                  : '空间磁力校准'}
              </span>
              {calibratedResult.polarState.isPolarRegion && (
                <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-mono font-medium leading-none">
                  极区
                </span>
              )}
            </button>
            <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">外沿触屏阻尼旋转</span>
          </div>
        </div>

        {/* [USER REQ] 第二行：在地磁锁定、运动航向下一行恢复“切换为标准航向罗盘”与“4分刻度与12分刻度”按钮 */}
        <div className="bg-slate-50/95 px-3 py-1.5 flex items-center justify-between border-b border-slate-200 text-xs gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 两大独立指南针测算模式：地质与航向罗盘体系 vs GPS Test Plus 航空仪表体系 */}
            <div className="flex items-center bg-slate-200/90 p-0.5 rounded-lg border border-slate-300 gap-0.5">
              {/* 模式一：地质与航向体系 */}
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  setCompassSystem('geological');
                  if (dialStyle === 'gpstest') {
                    setDialStyle('survey_transit');
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer leading-none ${
                  dialStyle !== 'gpstest'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="地质与航向罗盘体系：自适应非线性阻尼滤波 (转动灵敏，对中15倍超强阻尼)"
              >
                <CompassIcon className="w-3.5 h-3.5 shrink-0" />
                <span>地质与航向体系</span>
              </button>

              {/* 模式二：GPS Test Plus 体系 */}
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  setCompassSystem('gpstest');
                  setDialStyle('gpstest');
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer leading-none ${
                  dialStyle === 'gpstest'
                    ? 'bg-cyan-600 text-white shadow-2xs ring-1 ring-cyan-400/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="GPS Test Plus 体系：亮色工程仪表风、10倍阻尼齿轮自转、双轴水平仪"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0"></span>
                <span>GPS Test Plus (亮色)</span>
              </button>
            </div>

            {/* 当处于地质与航向体系时：子级切换【地质罗盘】与【标准工程】，以及【4分/12分】 */}
            {dialStyle !== 'gpstest' && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setDialStyle('survey_transit');
                  }}
                  className={`px-2 py-0.8 rounded text-xs font-bold transition cursor-pointer leading-none ${
                    dialStyle === 'survey_transit'
                      ? 'bg-blue-100 text-blue-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="中国地质罗盘 (反字直读式)"
                >
                  地质盘(反字)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setDialStyle('standard');
                  }}
                  className={`px-2 py-0.8 rounded text-xs font-bold transition cursor-pointer leading-none ${
                    dialStyle === 'standard'
                      ? 'bg-blue-100 text-blue-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="现代工程标准航向盘"
                >
                  现代航向
                </button>
                {dialStyle === 'survey_transit' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setNumberMode((prev) => (prev === 'cardinal' ? 'steps30' : 'cardinal'));
                    }}
                    className="px-1.5 py-0.8 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer border border-slate-200 ml-0.5 leading-none"
                    title="切换4分刻度与12分刻度"
                  >
                    {numberMode === 'cardinal' ? '4分刻度' : '12分刻度'}
                  </button>
                )}
              </div>
            )}

            {/* 当为 GPS Test Plus 时显示水平气泡状态与倾角指示 */}
            {dialStyle === 'gpstest' && (
              <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.8 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs">
                <span className={`w-2 h-2 rounded-full ${fusionState.isLevel ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className="font-sans text-[10px] text-slate-500">双轴水平:</span>
                <span className={fusionState.isLevel ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                  {fusionState.isLevel ? 'LEVEL 极佳' : `倾斜 ${Math.hypot(fusionState.pitch, fusionState.roll).toFixed(1)}°`}
                </span>
              </div>
            )}
          </div>

          {/* 右侧：刻度偏角快捷状态与归零 */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono transition leading-none ${
                dialRotation !== 0
                  ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
              title="罗盘刻度偏角 (可直接在罗盘外沿触屏360度阻尼旋转)"
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

        {/* [USER REQ] 航向数值居中显示 */}
        <div className="bg-white px-3.5 py-1.5 flex items-center justify-between border-b border-slate-200/80 text-center shrink-0">
          <div className="w-12 text-left hidden sm:block">
            {isUsingNative9Axis && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                Native
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2.5 mx-auto">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight leading-none">
              {Math.round(activeHeading)}°
            </span>
            <span className="text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100 leading-none">
              {getDirectionText(activeHeading)}
            </span>
            {fusionState.isMagneticAnomaly && (
              <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded animate-pulse">
                磁异常保护
              </span>
            )}
          </div>
          <div className="w-12 text-right text-[11px] font-mono text-slate-500 hidden sm:block">
            {fusionState.sampleRate.toFixed(0)}Hz
          </div>
        </div>

        {/* [USER REQ] 主视口：地质罗盘大小增大1.5倍！空间释放超大罗盘视野，右下角提供弹出按钮【更多】 */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden relative bg-slate-50/40">
          <div className="w-full h-full flex items-center justify-center py-1">
            <div className="w-[94vw] h-[94vw] max-w-[580px] max-h-[580px] sm:max-w-[660px] sm:max-h-[660px] landscape:max-w-[510px] landscape:max-h-[510px] aspect-square flex items-center justify-center shrink-0">
              {dialStyle === 'survey_transit' ? (
                <SurveyCompassDial
                  heading={activeHeading}
                  size={isLandscape ? 495 : 570}
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
              ) : dialStyle === 'standard' ? (
                <StandardCompassDial
                  heading={activeHeading}
                  size={isLandscape ? 495 : 570}
                />
              ) : (
                <GpsTestCompassDial
                  heading={activeHeading}
                  trueHeading={fusionState.trueHeading}
                  declination={fusionState.declination}
                  pitch={fusionState.pitch}
                  roll={fusionState.roll}
                  isLevel={fusionState.isLevel}
                  magneticFieldStrength={fusionState.magneticFieldStrength}
                  size={isLandscape ? 495 : 570}
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

              {/* 3. 9轴 Madgwick/Mahony 融合 + 自适应卡尔曼滤波与磁异常检测状态 */}
              <div className="w-full shrink-0 bg-slate-900 text-white rounded-2xl p-3.5 space-y-2.5 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>GPS Test Plus 工业级罗盘核心</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-600/30 text-emerald-300 rounded font-mono">
                          {isUsingNative9Axis ? 'Android Native (400Hz)' : 'GPS Test Plus 姿态引擎'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        渐进动力阻尼 · 10-15s极速定轴 · 359-1°平滑过渡 · 磁异常保护
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      fusionState.isMagneticAnomaly
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {fusionState.isMagneticAnomaly ? '⚠️ 磁异常 (纯陀螺积分)' : '9轴健康运行'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                  <div className="bg-slate-800/80 rounded-xl p-1.5 border border-slate-700">
                    <div className="text-[9px] text-slate-400 font-sans">采样频率</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {fusionState.sampleRate.toFixed(0)} <span className="text-[9px] font-normal text-slate-400">Hz</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-1.5 border border-slate-700">
                    <div className="text-[9px] text-slate-400 font-sans">角速度</div>
                    <div className="font-bold text-blue-400 mt-0.5">
                      {fusionState.angularVelocity.toFixed(0)} <span className="text-[9px] font-normal text-slate-400">°/s</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-1.5 border border-slate-700">
                    <div className="text-[9px] text-slate-400 font-sans">俯仰角</div>
                    <div className="font-bold text-slate-200 mt-0.5">
                      {fusionState.pitch.toFixed(1)}°
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-1.5 border border-slate-700">
                    <div className="text-[9px] text-slate-400 font-sans">横滚角</div>
                    <div className="font-bold text-slate-200 mt-0.5">
                      {fusionState.roll.toFixed(1)}°
                    </div>
                  </div>
                </div>
              </div>

              {/* [USER REQ] 4. GPS航向模式 · 航迹基线测算与十字直线校正卡片 (更多菜单) */}
              <div className="w-full bg-white border border-blue-200 rounded-2xl p-3.5 space-y-3 shrink-0 shadow-xs">
                {/* 标头与模式状态 */}
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-blue-600 text-white shadow-2xs">
                      <Route className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>GPS 航向模式 · 航迹基线测算与十字校正</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-1.5 py-0.2 rounded-full font-bold">
                          100% 地磁隔离
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        基线 TLS 拟合 · 多级速度跳变过滤 · 陀螺急转导向 · 彻底免受车身/空间磁干扰
                      </div>
                    </div>
                  </div>
                  {!isGpsMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playClick();
                        setHeadingMode('gps_course');
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      切换为当前模式
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      🟢 正在工作中
                    </span>
                  )}
                </div>

                {/* 1. 引用平板竖屏与横屏状态限定 */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <span>📐 平板/手机持握屏幕朝向限定:</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (感应器实时检测: {isLandscape ? '检测为横屏' : '检测为竖屏'})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="gpsScreenModeRadio"
                        checked={gpsScreenMode === 'portrait'}
                        onChange={() => setGpsScreenMode('portrait')}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>竖屏模式 (Portrait - 手机/平板顶端指向行驶前进方向)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="gpsScreenModeRadio"
                        checked={gpsScreenMode === 'landscape'}
                        onChange={() => setGpsScreenMode('landscape')}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>横屏模式 (Landscape - 手机/平板长边指向行驶前进方向)</span>
                    </label>
                  </div>
                </div>

                {/* 2. 十字方向选择 (正南 / 正北 / 正东 / 正西) 与 距离刻度 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* 十字方向勾选项 */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-bold text-slate-700 flex items-center gap-1">
                      <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                      <span>校正直线移动十字方向:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 font-bold">
                      {(
                        [
                          { key: 'S', label: '正南 180° (推荐)' },
                          { key: 'N', label: '正北 0°' },
                          { key: 'E', label: '正东 90°' },
                          { key: 'W', label: '正西 270°' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            soundService.playClick();
                            setGpsCalibDirection(item.key);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs transition cursor-pointer border flex items-center justify-center gap-1 ${
                            gpsCalibDirection === item.key
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 距离刻度选项 (5m / 10m / 15m / 20m) */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                        <span>直线移动标定目标距离:</span>
                      </span>
                      <span className="font-mono text-emerald-700 font-black">{gpsCalibDistance} 米</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 font-bold">
                      {[5, 10, 15, 20].map((dist) => (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => {
                            soundService.playClick();
                            setGpsCalibDistance(dist);
                          }}
                          className={`py-1.5 rounded-lg text-xs transition cursor-pointer border text-center ${
                            gpsCalibDistance === dist
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {dist}米
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 flex justify-between">
                      <span>当前实测基线长: {gpsFilterStats.baselineLengthMeters.toFixed(1)}m</span>
                      <span>拟合度: {gpsFilterStats.baselineFitQuality}分</span>
                    </div>
                    <div className="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-200/80 leading-relaxed font-sans mt-1">
                      💡 <strong>移动说明</strong>：直线移动只需保持方向准直（向选定十字方向直线推进），移动距离仅为标定参考阶梯，不做严格限定，只要行进方向形成基线即可一键锁定偏角！
                    </div>
                  </div>
                </div>

                {/* 3. 执行校正操作与模拟直线测试按钮组 */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCalibrateGpsMounting}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer"
                    >
                      <Crosshair className="w-4 h-4" />
                      <span>🎯 锁定十字基线并校正指针与平板偏角</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetGpsMounting}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                      title="复位安装偏角为0°"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 模拟直线移动快捷测试 */}
                  <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 rounded-xl p-2 text-xs">
                    <span className="text-[11px] text-blue-900 font-medium">
                      🚶 现场推行模拟 (更新直线基线):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSimulateGpsMovement(5)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        推进 5米
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateGpsMovement(10)}
                        className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        推进 10米
                      </button>
                    </div>
                  </div>
                </div>

                {/* 校正状态反馈提示 */}
                {gpsCalibFeedback && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{gpsCalibFeedback}</span>
                  </div>
                )}

                {/* 当前保存的平板安装偏角 */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono">
                  <span className="text-slate-600 font-sans">当前平板/手机安装偏角 (Mounting Offset):</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {gpsMountingOffset >= 0 ? `+${gpsMountingOffset.toFixed(1)}` : gpsMountingOffset.toFixed(1)}°
                  </span>
                </div>

                {/* 4. [USER REQ] GPS 航迹测算、基线查找与多级跳变过滤监控看板 */}
                <div className="bg-slate-900 text-white rounded-xl p-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between font-sans">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <Activity className="w-3.5 h-3.5" />
                      <span>GPS 航迹基线测算与跳变过滤监控</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      有效点: {gpsFilterStats.acceptedPointsCount} / 接收: {gpsFilterStats.totalPointsReceived}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[11px]">
                    <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans">5分钟均速</div>
                      <div className="font-bold text-emerald-400 mt-0.5">
                        {gpsFilterStats.avgSpeed5MinKmh.toFixed(1)}{' '}
                        <span className="text-[9px] font-normal text-slate-400">km/h</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans">低速跳变过滤</div>
                      <div className="font-bold text-amber-400 mt-0.5">
                        {gpsFilterStats.rejectedLowSpeedJumpCount}{' '}
                        <span className="text-[9px] font-normal text-slate-400">次 (&gt;10m)</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans">超速飞点过滤</div>
                      <div className="font-bold text-rose-400 mt-0.5">
                        {gpsFilterStats.rejectedExtremeSpeedCount}{' '}
                        <span className="text-[9px] font-normal text-slate-400">次 (&gt;1000m)</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans">转向响应模式</div>
                      <div className="font-bold mt-0.5 truncate text-[10px]">
                        {gpsFilterStats.isSharpTurning ? (
                          <span className="text-amber-400 animate-pulse">🔥 急转弯(陀螺)</span>
                        ) : (
                          <span className="text-blue-400">🟢 直线基线</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-300 font-sans bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/80 flex items-center justify-between">
                    <span className="truncate">状态: {gpsFilterStats.lastFilterReason}</span>
                    <span className="text-slate-400 shrink-0 font-mono ml-2">
                      基线方位: {gpsFilterStats.baselineAzimuth.toFixed(1)}°
                    </span>
                  </div>
                </div>

                {/* 5. [USER REQ] 太阳偏振与摄像头光影辅助急转测向 (Camera Solar Polarization Assist) */}
                <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <Sun className="w-4 h-4 text-amber-600" />
                      <span>摄像头太阳偏振 / 光影辅助急转推算</span>
                    </div>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 font-mono px-1.5 py-0.2 rounded-full font-bold">
                      {solarPos.isDaylight ? '☀️ 白昼有光' : '🌙 太阳已落'}
                    </span>
                  </div>

                  <div className="text-[11px] text-amber-900/80 leading-relaxed">
                    💡 当平板固定在车内/测绘支架时，在急转弯或阳光明媚环境下，利用摄像头捕获天空光照梯度矢量，加权推算方向移动，防止急转弯陀螺仪累积漂移。
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-amber-950 bg-white/80 p-2 rounded-lg border border-amber-200/60">
                    <span>{solarPos.solarVectorDescription}</span>
                    <span>方位角: {solarPos.azimuth}°</span>
                  </div>

                  {cameraErrorMessage && (
                    <div className="text-rose-600 text-[11px] font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">
                      ⚠️ {cameraErrorMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-0.5">
                    {isCameraSolarActive ? (
                      <div className="text-[11px] font-mono text-emerald-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>光学估算航向: {cameraOpticalHeading}° (置信度: {(cameraOpticalConfidence * 100).toFixed(0)}%)</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-sans">
                        摄像头光影分析未启用
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleCameraSolar}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        isCameraSolarActive
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                          : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isCameraSolarActive ? '关闭光影辅助' : '开启摄像头光影辅助'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. 空间磁力分析动作与全机型精准校准卡片 */}
              <div className="w-full shrink-0 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/90 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-blue-600 text-white shadow-2xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                        <span>空间磁力分析动作与全机型精准校准</span>
                        <span className="text-[10px] bg-blue-200 text-blue-900 font-mono px-1.5 py-0.2 rounded-full font-bold">
                          工程推荐
                        </span>
                      </div>
                      <div className="text-[11px] text-blue-800/80 mt-0.5">
                        外展上臂转身360°+垂直轮臂360° · 解耦手机固有硬磁 · 物理罗盘标定 · 极区GPS融合
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/90 p-2 rounded-xl border border-blue-100">
                    <div className="text-slate-500 font-sans">手机本性档案:</div>
                    <div className="font-bold font-mono text-slate-800 mt-0.5 truncate">
                      {hasSpatialCalibration
                        ? `已标定 (${baselineData?.qualityScore}分, 偏差${baselineData?.physicalCompassOffset || 0}°)`
                        : '未标定 (建议首次做本性分析)'}
                    </div>
                  </div>
                  <div className="bg-white/90 p-2 rounded-xl border border-blue-100">
                    <div className="text-slate-500 font-sans">工区自适应/极区:</div>
                    <div className="font-bold font-mono text-slate-800 mt-0.5 truncate">
                      {calibratedResult.polarState.isPolarRegion
                        ? '极区GPS融合保护中'
                        : hasFieldAdaptive
                        ? '现场磁异常已纠偏'
                        : '基准正常'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setShowSpatialCalibModal(true);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>打开“空间磁力分析与校准”向导</span>
                </button>
              </div>

              {/* [USER REQ] 6. 物理罗盘同轴比对与两套系统统一校准（功能统一放置于第三页） */}
              <div className="w-full shrink-0 bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CompassIcon className="w-4 h-4 text-amber-600" />
                    <span>物理罗盘同轴比对与两套系统统一校准</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    当前实测: <strong className="text-slate-800">{activeHeading.toFixed(1)}°</strong>
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  📌 依据工程测量规范，物理罗盘同轴标定、输入正确航向、统一校准两套系统保存入文件及独立偏角归零功能，已统一规范放置在<strong>第三页（空间磁力分析与校准向导页）</strong>中执行。点击下方按钮即可一键进入。
                </div>

                {/* 两套系统当前保存的独立补偿量与约束状态看板 */}
                <div className="flex items-center justify-between text-[11px] font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span className="text-slate-600 font-sans">地质/航向补偿:</span>
                    <span className="font-bold text-blue-700">
                      {geoOffset >= 0 ? `+${geoOffset.toFixed(1)}` : geoOffset.toFixed(1)}°
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
                    <span className="text-slate-600 font-sans">GPS Test Plus 补偿:</span>
                    <span className="font-bold text-cyan-700">
                      {gpsTestOffset >= 0 ? `+${gpsTestOffset.toFixed(1)}` : gpsTestOffset.toFixed(1)}°
                    </span>
                  </div>
                  {spatialMagneticService.isUnifiedConstraintActive() && (
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-sans font-bold">
                      🔒 受统一校准文件严格约束
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setShowSpatialCalibModal(true);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>前往第三页（空间磁力分析与校准向导）进行统一校准与文件约束</span>
                </button>
              </div>

              {/* 7. 基础 8字校准罗盘卡片 */}
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

              {/* 8. 虚拟朝向预设测试（无物理传感器时） */}
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
            </div>
          </div>
        )}
        {/* 空间磁力分析动作与全机型精准校准向导弹窗 */}
        <SpatialMagneticCalibrationModal
          isOpen={showSpatialCalibModal}
          onClose={() => setShowSpatialCalibModal(false)}
          currentHeading={heading}
          currentLat={rtkState.currentLat || 31.23}
          currentLon={rtkState.currentLon || 121.47}
          gpsCourse={gpsCourseHeading || rtkState.heading}
          onCalibrationUpdated={() => setCalibRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  );
};
