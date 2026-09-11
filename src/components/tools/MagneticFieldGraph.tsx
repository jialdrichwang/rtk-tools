import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Info, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface MagneticFieldGraphProps {
  currentField: number;
  heading?: number;
  onReset?: () => void;
}

export interface MagSample {
  time: number;
  x: number; // Red (红)
  y: number; // Blue (蓝)
  z: number; // Yellow (黄)
  val: number; // Scalar |B|
}

export const MagneticFieldGraph: React.FC<MagneticFieldGraphProps> = ({
  currentField,
  heading = 0,
  onReset,
}) => {
  // Generate XYZ vector components based on geomagnetism and heading
  const computeSample = (totalB: number, deg: number): { x: number; y: number; z: number; val: number } => {
    const rad = (deg * Math.PI) / 180;
    // Earth's magnetic dip angle ~54° in mid-latitudes
    const horizIntensity = totalB * Math.cos((54 * Math.PI) / 180);
    const vertIntensity = totalB * Math.sin((54 * Math.PI) / 180);

    // Microscopic jitter
    const jx = (Math.random() - 0.5) * 0.4;
    const jy = (Math.random() - 0.5) * 0.4;
    const jz = (Math.random() - 0.5) * 0.3;

    // X: East/West body component, Y: North/South body component, Z: Downward component
    const x = parseFloat((horizIntensity * Math.sin(rad) + jx).toFixed(1));
    const y = parseFloat((horizIntensity * Math.cos(rad) + jy).toFixed(1));
    const z = parseFloat((vertIntensity + jz).toFixed(1));
    const val = parseFloat(Math.sqrt(x * x + y * y + z * z).toFixed(1));

    return { x, y, z, val };
  };

  const [history, setHistory] = useState<MagSample[]>(() => {
    const init: MagSample[] = [];
    const now = Date.now();
    // 10-second history window with 500ms sample interval = 20 samples
    for (let i = 19; i >= 0; i--) {
      const pastHeading = heading + (Math.random() - 0.5) * 2;
      const sample = computeSample(currentField || 48.0, pastHeading);
      init.push({
        time: now - i * 500,
        ...sample,
      });
    }
    return init;
  });

  const [showExplanation, setShowExplanation] = useState(false);

  // Append new sample every 500ms to maintain a 10-second window (20 samples)
  useEffect(() => {
    const timer = setInterval(() => {
      setHistory((prev) => {
        const sample = computeSample(currentField, heading);
        const next = [...prev, { time: Date.now(), ...sample }];
        if (next.length > 20) {
          return next.slice(next.length - 20);
        }
        return next;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [currentField, heading]);

  // Statistical calculations
  const stats = useMemo(() => {
    if (history.length === 0) return { mean: 48.5, stdDev: 0.2, min: 48, max: 49 };
    const vals = history.map((h) => h.val);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { mean, stdDev, min, max };
  }, [history]);

  // Graph coordinate scaling
  // Y domain: -35 μT to +55 μT (height = 72px)
  const minY = -35;
  const maxY = 55;
  const graphH = 72;
  const graphW = 320;

  const getY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return graphH - ((clamped - minY) / (maxY - minY)) * graphH;
  };

  // Polyline points for X (Red), Y (Blue), Z (Yellow)
  const { pointsX, pointsY, pointsZ } = useMemo(() => {
    if (history.length < 2) return { pointsX: '', pointsY: '', pointsZ: '' };

    const ptsX: string[] = [];
    const ptsY: string[] = [];
    const ptsZ: string[] = [];

    history.forEach((item, idx) => {
      const x = (idx / (history.length - 1)) * graphW;
      ptsX.push(`${x.toFixed(1)},${getY(item.x).toFixed(1)}`);
      ptsY.push(`${x.toFixed(1)},${getY(item.y).toFixed(1)}`);
      ptsZ.push(`${x.toFixed(1)},${getY(item.z).toFixed(1)}`);
    });

    return {
      pointsX: ptsX.join(' '),
      pointsY: ptsY.join(' '),
      pointsZ: ptsZ.join(' '),
    };
  }, [history]);

  const lastPoint = history[history.length - 1] || {
    x: 0,
    y: 28,
    z: 39,
    val: currentField,
  };
  const lastX = graphW;
  const lastY_X = getY(lastPoint.x);
  const lastY_Y = getY(lastPoint.y);
  const lastY_Z = getY(lastPoint.z);

  // Reference lines
  const zeroY = getY(0);
  const ref40Y = getY(40);
  const refMinus20Y = getY(-20);

  // Stability evaluation
  const isHealthy = currentField >= 32 && currentField <= 58 && stats.stdDev < 2.5;
  const isDisturbed = currentField > 62 || stats.stdDev >= 3.5;

  return (
    <div className="w-full bg-slate-900 text-slate-100 rounded-2xl p-3 border border-slate-800 shadow-md font-sans">
      {/* Title & Diagnostic Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-200">磁力与时间曲线 (XYZ三轴 近10秒)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Axis Indicator Pills */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="inline-flex items-center gap-0.5 text-red-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              X轴(红)
            </span>
            <span className="inline-flex items-center gap-0.5 text-sky-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Y轴(蓝)
            </span>
            <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Z轴(黄)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setShowExplanation(!showExplanation);
            }}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer ml-1"
            title="查看磁力与地磁传感器区别科普"
          >
            <Info className="w-3 h-3" />
            <span>{showExplanation ? '收起科普' : '磁力区别?'}</span>
          </button>
        </div>
      </div>

      {/* Explanatory Dropdown / Card */}
      {showExplanation && (
        <div className="mt-2 p-2.5 bg-slate-800/90 rounded-xl border border-slate-700 text-[11px] text-slate-300 space-y-1.5 animate-in fade-in duration-150">
          <div className="font-bold text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>测绘问答：磁力传感器XYZ三轴与地磁合量的关系？</span>
          </div>
          <p className="leading-relaxed">
            <strong>1. 芯片物理三轴：</strong>手机硬件实为<strong>三轴霍尔磁力计</strong>（Magnetometer），红色X轴对应手机横向磁场，蓝色Y轴对应手机纵向航向磁场，黄色Z轴对应穿透屏幕的垂直地磁分量。
          </p>
          <p className="leading-relaxed">
            <strong>2. 地球磁场矢量：</strong>三轴分量满足矢量勾股定理：合量 <code className="text-cyan-300 font-mono">|B| = √(X² + Y² + Z²)</code>。地球天然总磁场强度在 <strong>30.0 ~ 60.0 μT</strong> 之间。
          </p>
          <p className="leading-relaxed">
            <strong>3. 实时判断原则：</strong>
            <br />
            • <strong>旋转手机时</strong>：红轴X与蓝轴Y呈正余弦平滑波动，黄轴Z基本恒定在 +35~+42 μT，说明磁环境健康无干扰。
            <br />
            • <strong>靠近钢筋/强电时</strong>：三轴同时剧烈突变，合量突破 60 μT，建议远离干扰源或切换至GPS航向！
          </p>
        </div>
      )}

      {/* Real-Time XYZ Values Bar */}
      <div className="grid grid-cols-4 gap-1 mt-2 text-center font-mono">
        <div className="bg-slate-950/70 border border-red-950/80 rounded-lg p-1">
          <div className="text-[9px] text-red-400 font-sans font-medium flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            X轴(红)
          </div>
          <div className="text-[11px] font-bold text-red-300 mt-0.5">
            {lastPoint.x > 0 ? `+${lastPoint.x.toFixed(1)}` : lastPoint.x.toFixed(1)} <span className="text-[8px] font-normal text-slate-400">μT</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-sky-950/80 rounded-lg p-1">
          <div className="text-[9px] text-sky-400 font-sans font-medium flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Y轴(蓝)
          </div>
          <div className="text-[11px] font-bold text-sky-300 mt-0.5">
            {lastPoint.y > 0 ? `+${lastPoint.y.toFixed(1)}` : lastPoint.y.toFixed(1)} <span className="text-[8px] font-normal text-slate-400">μT</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-amber-950/80 rounded-lg p-1">
          <div className="text-[9px] text-amber-400 font-sans font-medium flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Z轴(黄)
          </div>
          <div className="text-[11px] font-bold text-amber-300 mt-0.5">
            {lastPoint.z > 0 ? `+${lastPoint.z.toFixed(1)}` : lastPoint.z.toFixed(1)} <span className="text-[8px] font-normal text-slate-400">μT</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-1">
          <div className="text-[9px] text-emerald-400 font-sans font-medium">合量 |B|</div>
          <div
            className={`text-[11px] font-bold mt-0.5 ${
              isHealthy ? 'text-emerald-400' : isDisturbed ? 'text-rose-400' : 'text-amber-400'
            }`}
          >
            {currentField.toFixed(1)} <span className="text-[8px] font-normal text-slate-400">μT</span>
          </div>
        </div>
      </div>

      {/* SVG Time-Series Chart with XYZ Curves */}
      <div className="relative mt-2 w-full bg-slate-950 rounded-xl p-1 border border-slate-800 overflow-hidden">
        {/* Normal geomagnetic reference label */}
        <div className="absolute top-1 left-2 text-[9px] font-sans text-slate-400 pointer-events-none z-10 flex items-center gap-1">
          <span>三轴动态时序 (近10秒)</span>
        </div>

        <svg viewBox={`0 0 ${graphW} ${graphH}`} className="w-full h-18 overflow-visible">
          {/* Zero baseline (0 μT) */}
          <line
            x1="0"
            y1={zeroY}
            x2={graphW}
            y2={zeroY}
            stroke="#475569"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            strokeOpacity="0.7"
          />
          {/* Reference +40 μT */}
          <line
            x1="0"
            y1={ref40Y}
            x2={graphW}
            y2={ref40Y}
            stroke="#334155"
            strokeWidth="0.6"
            strokeDasharray="3 3"
          />
          {/* Reference -20 μT */}
          <line
            x1="0"
            y1={refMinus20Y}
            x2={graphW}
            y2={refMinus20Y}
            stroke="#334155"
            strokeWidth="0.6"
            strokeDasharray="3 3"
          />

          {/* Y Axis Grid Tick Labels */}
          <text x="2" y={ref40Y - 2} fill="#64748b" fontSize="6.5" opacity="0.8" fontFamily="monospace">
            +40
          </text>
          <text x="2" y={zeroY - 2} fill="#94a3b8" fontSize="6.5" opacity="0.9" fontFamily="monospace">
            0 μT
          </text>
          <text x="2" y={refMinus20Y + 7} fill="#64748b" fontSize="6.5" opacity="0.8" fontFamily="monospace">
            -20
          </text>

          {/* X Axis Polyline - RED (红) */}
          {pointsX && (
            <polyline
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsX}
            />
          )}

          {/* Y Axis Polyline - BLUE (蓝) */}
          {pointsY && (
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsY}
            />
          )}

          {/* Z Axis Polyline - YELLOW (黄) */}
          {pointsZ && (
            <polyline
              fill="none"
              stroke="#eab308"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsZ}
            />
          )}

          {/* Latest Point Markers & Pulses */}
          {/* X (Red) */}
          <circle cx={lastX} cy={lastY_X} r="2.5" fill="#ef4444" />
          <circle cx={lastX} cy={lastY_X} r="5" fill="#ef4444" opacity="0.3" className="animate-ping" />

          {/* Y (Blue) */}
          <circle cx={lastX} cy={lastY_Y} r="2.5" fill="#38bdf8" />
          <circle cx={lastX} cy={lastY_Y} r="5" fill="#38bdf8" opacity="0.3" className="animate-ping" />

          {/* Z (Yellow) */}
          <circle cx={lastX} cy={lastY_Z} r="2.5" fill="#eab308" />
          <circle cx={lastX} cy={lastY_Z} r="5" fill="#eab308" opacity="0.3" className="animate-ping" />
        </svg>
      </div>

      {/* Footer Info & Clean Baseline Reset (Testing Disturbance button completely removed per user request) */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>天然地磁标准: 30.0 ~ 60.0 μT</span>
        </div>

        {onReset && (
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              onReset();
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer flex items-center gap-1"
            title="恢复纯净天然地磁常值 (48μT)"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>基准复位</span>
          </button>
        )}
      </div>
    </div>
  );
};
