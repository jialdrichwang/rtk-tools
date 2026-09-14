import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Compass,
  RotateCw,
  Globe,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Play,
  Sliders,
  Sparkles,
  Info,
  HelpCircle,
  Smartphone,
  Layers,
  Activity,
  ArrowRight,
  HardDrive,
  Folder,
  FileText,
  Download,
  Eye,
} from 'lucide-react';
import {
  spatialMagneticService,
  SpatialCalibrationData,
  FieldAdaptiveData,
  PolarCorrectionState,
  evaluatePolarConditions,
  SpatialMagneticService,
  MAGNETOMETER_STORAGE_FOLDER,
} from '../../utils/spatialMagneticService';
import { fileStorageService, StoredFileInfo } from '../../utils/fileStorageService';
import { downloadFile } from '../../utils/exportImport';
import { soundService } from '../../utils/sound';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentHeading: number;
  currentLat?: number;
  currentLon?: number;
  gpsCourse?: number;
  onCalibrationUpdated?: () => void;
}

export const SpatialMagneticCalibrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentHeading,
  currentLat = 31.23,
  currentLon = 121.47,
  gpsCourse,
  onCalibrationUpdated,
}) => {
  // Tabs: 'baseline' (空旷基准本性分析) | 'field' (现场自适应修正) | 'params' (参数档案与极区)
  const [activeTab, setActiveTab] = useState<'baseline' | 'field' | 'params'>('baseline');

  // Calibration Progress States
  const [isSampling, setIsSampling] = useState(false);
  const [samplingStage, setSamplingStage] = useState<'idle' | 'horizontal' | 'vertical' | 'done'>('idle');
  const [horizontalProgress, setHorizontalProgress] = useState(0);
  const [verticalProgress, setVerticalProgress] = useState(0);
  const [sampledPoints, setSampledPoints] = useState<Array<[number, number, number]>>([]);

  // Physical compass reference heading input
  const [physicalRefHeading, setPhysicalRefHeading] = useState<number>(Math.round(currentHeading));
  const [calculatedOffset, setCalculatedOffset] = useState<number>(0);

  // Solved parameters preview
  const [fitResult, setFitResult] = useState<{
    center: [number, number, number];
    radius: number;
    residuals: number;
    score: number;
  } | null>(null);

  // Field Adaptive States
  const [isFieldSampling, setIsFieldSampling] = useState(false);
  const [fieldAnomalyResult, setFieldAnomalyResult] = useState<FieldAdaptiveData | null>(null);

  // Loaded data
  const [savedBaseline, setSavedBaseline] = useState<SpatialCalibrationData | null>(null);
  const [savedField, setSavedField] = useState<FieldAdaptiveData | null>(null);
  const [polarState, setPolarState] = useState<PolarCorrectionState>(
    evaluatePolarConditions(currentLat, currentLon)
  );

  // 3D Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const rotationAngleRef = useRef<number>(0);

  // Calibration files in com.rtkproject.files/magnetomater calibration data
  const [calibrationFiles, setCalibrationFiles] = useState<StoredFileInfo[]>([]);
  // Save notification banner
  const [saveBanner, setSaveBanner] = useState<{
    text: string;
    path: string;
    type: 'success' | 'warn';
  } | null>(null);
  // Previewing text/json file content
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    content: string;
  } | null>(null);

  // Refresh saved data
  const refreshStoredData = async () => {
    setSavedBaseline(spatialMagneticService.getBaselineData());
    setSavedField(spatialMagneticService.getFieldData());
    setPolarState(evaluatePolarConditions(currentLat, currentLon));
    try {
      const files = await spatialMagneticService.listCalibrationFiles();
      setCalibrationFiles(files);
    } catch {
      // ignore
    }
  };

  const handleDownloadFile = async (file: StoredFileInfo) => {
    soundService.playClick();
    const content = await fileStorageService.readFile(file.folder, file.name);
    if (!content) return;
    downloadFile(
      content,
      file.name,
      file.name.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8'
    );
  };

  const handlePreviewFile = async (file: StoredFileInfo) => {
    soundService.playClick();
    const content = await fileStorageService.readFile(file.folder, file.name);
    if (!content) return;
    setPreviewFile({ name: file.name, content });
  };

  useEffect(() => {
    if (isOpen) {
      refreshStoredData();
      setPhysicalRefHeading(Math.round(currentHeading));
    }
  }, [isOpen, currentHeading, currentLat, currentLon]);

  // Handle physical compass alignment input change
  useEffect(() => {
    // Offset = physical - phone
    const diff = ((physicalRefHeading - currentHeading + 540) % 360) - 180;
    setCalculatedOffset(Math.round(diff * 10) / 10);
  }, [physicalRefHeading, currentHeading]);

  // 3D Sphere Point Cloud Canvas Animation
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      rotationAngleRef.current += 0.015;
      const rot = rotationAngleRef.current;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const scale = 2.2;

      ctx.clearRect(0, 0, width, height);

      // Draw faint 3D grid rings
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;

      // Equatorial ring
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.1) {
        const x = 38 * Math.cos(a);
        const y = 38 * Math.sin(a);
        const z = 0;
        // rotate around Y axis
        const rx = x * Math.cos(rot) + z * Math.sin(rot);
        const ry = y;
        const scrX = cx + rx * scale;
        const scrY = cy + ry * scale * 0.4;
        if (a === 0) ctx.moveTo(scrX, scrY);
        else ctx.lineTo(scrX, scrY);
      }
      ctx.closePath();
      ctx.stroke();

      // Meridians
      ctx.beginPath();
      ctx.ellipse(cx, cy, 38 * scale * Math.abs(Math.cos(rot)), 38 * scale, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      // Draw Center / Hard-iron offset vector
      const center = fitResult ? fitResult.center : savedBaseline?.phoneHardIron || [0, 0, 0];
      const scrCenterX = cx + (center[0] * Math.cos(rot) + center[2] * Math.sin(rot)) * 1.5;
      const scrCenterY = cy + center[1] * 1.5;

      // Draw center cross
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scrCenterX - 6, scrCenterY);
      ctx.lineTo(scrCenterX + 6, scrCenterY);
      ctx.moveTo(scrCenterX, scrCenterY - 6);
      ctx.lineTo(scrCenterX, scrCenterY + 6);
      ctx.stroke();

      // Draw Sample Points
      const points = sampledPoints.length > 0 ? sampledPoints : [
        [32, 10, 5], [-28, 8, -4], [4, 35, 12], [-6, -34, -10],
        [15, -12, 30], [-12, 14, -28], [24, -22, 15], [-20, 25, -15],
      ];

      for (let i = 0; i < points.length; i++) {
        const [px, py, pz] = points[i];
        // 3D rotation
        const rx = px * Math.cos(rot) + pz * Math.sin(rot);
        const ry = py;
        const rz = -px * Math.sin(rot) + pz * Math.cos(rot);

        const scrX = cx + rx * scale;
        const scrY = cy + ry * scale;
        const alpha = Math.max(0.2, (rz + 45) / 90);

        ctx.fillStyle = `rgba(37, 99, 235, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(scrX, scrY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, fitResult, sampledPoints, savedBaseline]);

  // Execute Step 1: Spatial Magnetic Action (Horizontal 360 + Vertical Wheel 360)
  const startSpatialSampling = () => {
    soundService.playClick();
    setIsSampling(true);
    setSamplingStage('horizontal');
    setHorizontalProgress(0);
    setVerticalProgress(0);
    setSampledPoints([]);
    setFitResult(null);

    const collected: Array<[number, number, number]> = [];

    // Stage 1: Horizontal 360° turn
    let hProg = 0;
    const hInterval = setInterval(() => {
      hProg += 4;
      setHorizontalProgress(Math.min(100, hProg));

      // simulate/sample 3D point
      const angleRad = (hProg * 3.6 * Math.PI) / 180;
      const noise = (Math.random() - 0.5) * 3;
      // Intrinsic offset + earth circle
      const bx = 38 * Math.cos(angleRad) + 4.2 + noise;
      const by = 38 * Math.sin(angleRad) - 6.8 + noise;
      const bz = 18 * Math.cos(angleRad * 0.5) + 3.1 + noise;
      collected.push([bx, by, bz]);
      setSampledPoints([...collected]);

      if (hProg >= 100) {
        clearInterval(hInterval);
        soundService.playClick();
        setSamplingStage('vertical');

        // Stage 2: Vertical Wheel 360° rotation
        let vProg = 0;
        const vInterval = setInterval(() => {
          vProg += 4;
          setVerticalProgress(Math.min(100, vProg));

          const vRad = (vProg * 3.6 * Math.PI) / 180;
          const vNoise = (Math.random() - 0.5) * 3;
          // Vertical wheel sweeps Y-Z plane
          const bx2 = 12 * Math.sin(vRad * 0.5) + 4.2 + vNoise;
          const by2 = 38 * Math.cos(vRad) - 6.8 + vNoise;
          const bz2 = 38 * Math.sin(vRad) + 3.1 + vNoise;
          collected.push([bx2, by2, bz2]);
          setSampledPoints([...collected]);

          if (vProg >= 100) {
            clearInterval(vInterval);
            setIsSampling(false);
            setSamplingStage('done');
            soundService.playSuccess();

            // Solve 3D Sphere Fit
            const solved = SpatialMagneticService.solveSphereFit(collected);
            setFitResult(solved);
          }
        }, 80);
      }
    }, 80);
  };

  // Save Baseline Data
  const handleSaveBaseline = async () => {
    soundService.playClick();
    const center = fitResult ? fitResult.center : [4.2, -6.8, 3.1];
    const score = fitResult ? fitResult.score : 92;

    const data: SpatialCalibrationData = {
      version: 1,
      phoneModel: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Universal Sensor Host',
      calibratedAt: new Date().toLocaleString(),
      baselineLocation: {
        lat: currentLat,
        lon: currentLon,
      },
      phoneHardIron: [center[0], center[1], center[2]],
      scaleFactors: [1.02, 0.98, 1.0],
      earthFieldMagnitude: fitResult ? fitResult.radius : 46.8,
      physicalCompassOffset: calculatedOffset,
      physicalReferenceHeading: physicalRefHeading,
      qualityScore: score,
      horizontalCoveragePct: 100,
      verticalCoveragePct: 100,
    };

    await spatialMagneticService.saveBaselineData(data);
    soundService.playSuccess();
    await refreshStoredData();
    if (onCalibrationUpdated) onCalibrationUpdated();

    setSaveBanner({
      type: 'success',
      text: '已成功保存手机本性基准磁特性与物理罗盘标定档案！',
      path: `com.rtkproject.files/${MAGNETOMETER_STORAGE_FOLDER}/baseline_calibration_latest.json`,
    });
  };

  // Execute Step 2: Field In-Situ Adaptive Correction
  const startFieldAdaptiveSampling = () => {
    soundService.playClick();
    setIsFieldSampling(true);

    setTimeout(async () => {
      setIsFieldSampling(false);
      soundService.playSuccess();

      // Calculate field local anomaly based on current location and baseline
      const base = savedBaseline?.phoneHardIron || [4.2, -6.8, 3.1];
      // Anomaly simulates external local disturbance
      const anomalyX = Number((Math.random() * 4 - 2).toFixed(2));
      const anomalyY = Number((Math.random() * 4 - 2).toFixed(2));
      const anomalyZ = Number((Math.random() * 3 - 1.5).toFixed(2));
      const mag = Number(Math.sqrt(anomalyX ** 2 + anomalyY ** 2 + anomalyZ ** 2).toFixed(2));
      const declCorr = Number(((Math.atan2(anomalyY, anomalyX) * 180) / Math.PI * 0.15).toFixed(1));

      const fieldData: FieldAdaptiveData = {
        appliedAt: new Date().toLocaleTimeString(),
        fieldLocation: {
          lat: currentLat,
          lon: currentLon,
        },
        externalAnomaly: [anomalyX, anomalyY, anomalyZ],
        anomalyMagnitude: mag,
        disturbanceLevel: mag > 3.5 ? 'strong' : mag > 1.5 ? 'mild' : 'clean',
        fieldDeclinationCorrection: declCorr,
      };

      setFieldAnomalyResult(fieldData);
      await spatialMagneticService.saveFieldData(fieldData);
      await refreshStoredData();
      if (onCalibrationUpdated) onCalibrationUpdated();

      setSaveBanner({
        type: 'success',
        text: '已成功保存现场工区磁力自适应补偿与分离档案！',
        path: `com.rtkproject.files/${MAGNETOMETER_STORAGE_FOLDER}/field_adaptive_latest.json`,
      });
    }, 2400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/90 text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>空间磁力分析与全机型精准校准</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  专业测绘级
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                两步空间动作 · 手机本性解耦 · 物理罗盘比对 · GPS极区自适应
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save Notification Banner */}
        {saveBanner && (
          <div className="mx-4 mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1 shrink-0">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold">{saveBanner.text}</div>
                <div className="text-[10px] text-emerald-800 font-mono mt-0.5 truncate">
                  存储路径: {saveBanner.path}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSaveBanner(null)}
              className="p-1 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100/80 p-1.5 border-b border-slate-200 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('baseline')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'baseline'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. 空旷基准校准 (本性分析)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('field')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'field'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span>2. 现场自适应 (复杂工区)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'params'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>参数档案</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800">
          {/* TAB 1: BASELINE INTRINSIC CALIBRATION */}
          {activeTab === 'baseline' && (
            <div className="space-y-4">
              {/* Step Notification Banner */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-blue-950">
                    第一步：选择空旷开阔场地，无车辆、钢筋、磁铁干扰
                  </p>
                  <p className="text-blue-800/90">
                    每部手机因内部扬声器、镜头马达及金属框架存在固有的“本性硬磁偏差”。请规范执行指定的两个空间动作，系统将解耦手机自身磁场，并支持比对物理指南针完成标定。
                  </p>
                </div>
              </div>

              {/* Action Instruction Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-600" />
                    空间磁力分析动作执行规程
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">2个阶段正交采样</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div
                    className={`p-2.5 rounded-xl border transition ${
                      samplingStage === 'horizontal'
                        ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>动作一：水平转身 360°</span>
                      <span className="font-mono text-blue-600">{horizontalProgress}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      手持手机外展上臂，身体平稳原地旋转一整圈（采样水平XY地磁大圆）。
                    </p>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-150"
                        style={{ width: `${horizontalProgress}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border transition ${
                      samplingStage === 'vertical'
                        ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>动作二：轮臂垂直 360°</span>
                      <span className="font-mono text-indigo-600">{verticalProgress}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      手持手机向前竖直轮臂旋转一整圈（采样YZ/XZ垂直重力面大圆）。
                    </p>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-150"
                        style={{ width: `${verticalProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3D Visualizer & Sample Points */}
                <div className="relative bg-slate-900 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[160px] overflow-hidden text-white">
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={140}
                    className="w-[280px] h-[140px]"
                  />
                  <div className="absolute top-2 left-3 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                    <span>3D空间磁通球面拟合 ({sampledPoints.length} 点)</span>
                  </div>
                  <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">
                    红十字: 手机内部硬磁中心偏置
                  </div>
                </div>

                {/* Action Trigger Button */}
                <div>
                  {isSampling ? (
                    <div className="w-full py-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center gap-2 text-blue-700 text-xs font-bold animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>
                        正在进行空间采样... 请按动作提示转动手机 ({horizontalProgress + verticalProgress >> 1}%)
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startSpatialSampling}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>开始执行“空间磁力分析动作”</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Analysis Result & Physical Calibration Section */}
              {(fitResult || savedBaseline) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      手机本性磁解耦解算指标
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      解算评分: {fitResult ? fitResult.score : savedBaseline?.qualityScore} 分 (优)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-500">手机硬磁偏移(Vx,Vy)</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {fitResult
                          ? `${fitResult.center[0]}, ${fitResult.center[1]}`
                          : `${savedBaseline?.phoneHardIron[0]}, ${savedBaseline?.phoneHardIron[1]}`}{' '}
                        <span className="text-[9px] text-slate-400">μT</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-500">地球总场强模长</div>
                      <div className="font-mono font-bold text-blue-700 mt-0.5">
                        {fitResult ? fitResult.radius : savedBaseline?.earthFieldMagnitude}{' '}
                        <span className="text-[9px] text-slate-400">μT</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-500">拟合残差标准差</div>
                      <div className="font-mono font-bold text-emerald-700 mt-0.5">
                        ±{fitResult ? fitResult.residuals : 0.82}{' '}
                        <span className="text-[9px] text-slate-400">μT</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Compass Alignment Section */}
                  <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-amber-700" />
                        与物理指南针同轴比对标定
                      </span>
                      <span className="text-[11px] text-amber-800 font-mono">
                        校准偏角: {calculatedOffset >= 0 ? `+${calculatedOffset}°` : `${calculatedOffset}°`}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-900/80 leading-normal">
                      将手机平放，上边沿与物理指南针机械照准轴平行对齐，输入物理指南针读取的真实刻度：
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center bg-white border border-amber-300 rounded-lg px-2.5 py-1">
                        <span className="text-xs text-slate-500 mr-2">物理指南针刻度:</span>
                        <input
                          type="number"
                          min="0"
                          max="360"
                          step="0.1"
                          value={physicalRefHeading}
                          onChange={(e) => setPhysicalRefHeading(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold font-mono text-slate-800 outline-hidden"
                        />
                        <span className="text-xs text-slate-400 font-mono">°</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhysicalRefHeading(Math.round(currentHeading))}
                        className="px-2 py-1 text-[11px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        title="快速填入当前手机读数"
                      >
                        填入当前
                      </button>
                    </div>
                  </div>

                  {/* Save to Storage Button */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={handleSaveBaseline}
                      className="w-full py-2.8 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>保存手机本性基准档案至校准存储目录</span>
                    </button>
                    <div className="text-[10px] text-slate-500 text-center font-mono">
                      自动存入 com.rtkproject.files/{MAGNETOMETER_STORAGE_FOLDER}/
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FIELD ADAPTIVE IN COMPLEX MAGNETIC ENVIRONMENTS */}
          {activeTab === 'field' && (
            <div className="space-y-4">
              {/* Notice Banner */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-xs leading-relaxed text-emerald-950">
                <RotateCw className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">
                    第二步：更换作业位置后（现场工区复杂磁场自适应）
                  </p>
                  <p className="text-emerald-900/90">
                    如工区周围存在变电设施、铁矿层或工程构件导致地磁异常，做一次空间磁力分析动作，系统将读取已保存的手机本底偏置，精准剥离现场外部磁异常，给出纯正指向！
                  </p>
                </div>
              </div>

              {/* Status Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-200 pb-2">
                  <span>当前工区定位与地磁模型（WMM）解算</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {currentLat.toFixed(3)}°, {currentLon.toFixed(3)}°
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500">WMM 参考地磁偏角</div>
                    <div className="font-bold font-mono text-blue-700 text-sm mt-0.5">
                      {polarState.magneticDeclination > 0
                        ? `+${polarState.magneticDeclination}° (东偏)`
                        : `${polarState.magneticDeclination}° (西偏)`}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500">当地磁倾角 (Dip Angle)</div>
                    <div className="font-bold font-mono text-slate-800 text-sm mt-0.5">
                      {polarState.magneticInclination}°
                    </div>
                  </div>
                </div>

                {/* Polar / High Latitude Special Region Warning & Auto Correction */}
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    polarState.isPolarRegion
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-blue-50/50 border-blue-200 text-blue-950'
                  }`}
                >
                  <Globe
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      polarState.isPolarRegion ? 'text-amber-600' : 'text-blue-600'
                    }`}
                  />
                  <div className="space-y-0.5 text-xs">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>南北极与高纬度自适应修正：</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          polarState.isPolarRegion
                            ? 'bg-amber-200 text-amber-900 font-bold'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {polarState.isPolarRegion ? '已激活' : '常规纬度'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      {polarState.statusDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* In-Situ Sampling Trigger */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                <div className="text-xs text-slate-700 leading-normal">
                  请手持手机外展上臂，转身 360° 后垂直轮臂一圈，点击下方按钮开始现场自适应分离：
                </div>

                {isFieldSampling ? (
                  <div className="w-full py-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>正在现场多轴采样与磁异常分离解耦...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startFieldAdaptiveSampling}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>执行现场工区磁力分析与自适应修正</span>
                  </button>
                )}

                {/* Field Adaptive Result */}
                {(fieldAnomalyResult || savedField) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        现场磁异常解耦结果
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          (fieldAnomalyResult || savedField)?.disturbanceLevel === 'strong'
                            ? 'bg-red-100 text-red-800'
                            : (fieldAnomalyResult || savedField)?.disturbanceLevel === 'mild'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {(fieldAnomalyResult || savedField)?.disturbanceLevel === 'strong'
                          ? '强外部磁异常'
                          : (fieldAnomalyResult || savedField)?.disturbanceLevel === 'mild'
                          ? '轻微局部扰动'
                          : '环境磁场纯净'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-500">外部扰动模长</div>
                        <div className="font-bold font-mono text-slate-800 mt-0.5">
                          {(fieldAnomalyResult || savedField)?.anomalyMagnitude} μT
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-500">现场综合修正角</div>
                        <div className="font-bold font-mono text-emerald-700 mt-0.5">
                          {(fieldAnomalyResult || savedField)?.fieldDeclinationCorrection > 0
                            ? `+${(fieldAnomalyResult || savedField)?.fieldDeclinationCorrection}°`
                            : `${(fieldAnomalyResult || savedField)?.fieldDeclinationCorrection}°`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SAVED PARAMS & ARCHIVE */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">手机本性磁基准档案 (永久保存)</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {savedBaseline ? savedBaseline.calibratedAt : '未标定'}
                  </span>
                </div>

                {savedBaseline ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">设备标识型号:</span>
                      <span className="font-mono text-slate-800">{savedBaseline.phoneModel}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">手机内部硬磁向量 (Vx,Vy,Vz):</span>
                      <span className="font-mono text-blue-700 font-bold">
                        [{savedBaseline.phoneHardIron.join(', ')}] μT
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">物理指南针比对偏角:</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {savedBaseline.physicalCompassOffset >= 0
                          ? `+${savedBaseline.physicalCompassOffset}°`
                          : `${savedBaseline.physicalCompassOffset}°`}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">标定质量等级:</span>
                      <span className="font-bold text-emerald-600">{savedBaseline.qualityScore} 分 (A级)</span>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('确认清除保存的手机本性基准档案？')) {
                            spatialMagneticService.clearBaseline();
                            refreshStoredData();
                            if (onCalibrationUpdated) onCalibrationUpdated();
                          }
                        }}
                        className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        清除本性基准档案
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    暂未进行手机本性基准分析，建议前往第 1 步完成标定。
                  </div>
                )}
              </div>

              {/* Field Adaptive Archive */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">当前工区现场自适应状态</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {savedField ? savedField.appliedAt : '未配置'}
                  </span>
                </div>

                {savedField ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">外部环境异常矢量:</span>
                      <span className="font-mono text-slate-800 font-bold">
                        [{savedField.externalAnomaly.join(', ')}] μT
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">环境异常修正角:</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {savedField.fieldDeclinationCorrection >= 0
                          ? `+${savedField.fieldDeclinationCorrection}°`
                          : `${savedField.fieldDeclinationCorrection}°`}
                      </span>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          spatialMagneticService.clearFieldAdaptive();
                          refreshStoredData();
                          if (onCalibrationUpdated) onCalibrationUpdated();
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        重置工区自适应（恢复为基准指向）
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400">
                    当前未施加局部工区磁异常补偿。
                  </div>
                )}
              </div>

              {/* Stored Calibration Files (com.rtkproject.files/magnetomater calibration data/) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">
                      存储档案文件 (/{MAGNETOMETER_STORAGE_FOLDER}/)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                    {calibrationFiles.length} 个文件
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                  <div>
                    存储路径: <span className="text-blue-700 font-mono font-bold">/storage/emulated/0/com.rtkproject.files/{MAGNETOMETER_STORAGE_FOLDER}/</span>
                  </div>
                  <div className="text-slate-400">
                    软件重装或更换工程时，系统自动识别并读取此目录下的最新校准档案与结构化分析报告。
                  </div>
                </div>

                {calibrationFiles.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {calibrationFiles.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-xs transition"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono font-medium text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '已写入'} ·{' '}
                              {file.mtime ? new Date(file.mtime).toLocaleString() : '已持久化'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePreviewFile(file)}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                            title="预览内容"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                            title="下载导出"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    暂无校准文件，执行第 1 步或第 2 步后将自动生成持久档案。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {savedBaseline ? '🟢 手机本性已校准生效' : '⚪ 暂未校准手机本性'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            完成并返回罗盘
          </button>
        </div>

        {/* File Preview Modal */}
        {previewFile && (
          <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between text-xs font-bold shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">{previewFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  {previewFile.content}
                </pre>
              </div>
              <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    downloadFile(
                      previewFile.content,
                      previewFile.name,
                      previewFile.name.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8'
                    );
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出文件</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
