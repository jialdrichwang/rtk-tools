import React, { useState, useRef, useEffect } from 'react';
import { useRTK } from '../../context/RTKContext';
import {
  Terminal,
  X,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  Zap,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface NmeaMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NmeaMonitorModal: React.FC<NmeaMonitorModalProps> = ({ isOpen, onClose }) => {
  const {
    rtkState,
    nmeaStream,
    clearNmeaStream,
    toggleNmeaPause,
    setSimulateFakeConnection,
  } = useRTK();

  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal to bottom if not paused
  useEffect(() => {
    if (!nmeaStream.isPaused && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [nmeaStream.messages, nmeaStream.isPaused]);

  if (!isOpen) return null;

  const handleCopy = () => {
    soundService.playSuccess();
    const text = nmeaStream.messages.join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFake = nmeaStream.isFakeConnection;

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col h-[90vh] max-h-[680px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">外置蓝牙 RTK 接收机 NMEA 实时报文终端</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold">
                  NMEA-0183 v4.10
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                设备: {rtkState.bluetoothDeviceName || '华测 i93 视觉RTK (默认直连)'} · 115200bps
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundService.playClick();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Health / Fake Connection Detector Bar (Requirement 5) */}
        <div
          className={`px-4 py-2 border-b flex items-center justify-between text-xs transition-colors ${
            isFake
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isFake ? 'bg-rose-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isFake ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
            </span>
            <span className="font-bold font-sans text-[11px]">
              {isFake
                ? '⚠️ 假连接警报：蓝牙已配对，但连续无 NMEA 差分数据流注入！'
                : '🟢 硬件连接正常：真实 NMEA 差分数据流持续流入 (正常连接)'}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span>频次: {isFake ? '0.0' : nmeaStream.hz.toFixed(1)} Hz</span>
            <span>吞吐: {isFake ? '0' : nmeaStream.bytesPerSec} B/s</span>
            <span>已接收: {nmeaStream.totalReceived} 帧</span>
          </div>
        </div>

        {/* RTK Solution & Telemetry Parameters Strip */}
        <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 grid grid-cols-4 gap-2 text-center text-xs font-mono">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-1.5">
            <div className="text-[10px] text-slate-400 font-sans">解算状态</div>
            <div className="text-emerald-400 font-black mt-0.5">
              {rtkState.solution === 'FIXED' ? '4 - RTK固定解' : rtkState.solution}
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-1.5">
            <div className="text-[10px] text-slate-400 font-sans">HRMS / VRMS</div>
            <div className="text-cyan-400 font-black mt-0.5">
              ±{(rtkState.hrms * 1000).toFixed(0)} / ±{(rtkState.vrms * 1000).toFixed(0)} mm
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-1.5">
            <div className="text-[10px] text-slate-400 font-sans">锁定卫星数</div>
            <div className="text-slate-200 font-black mt-0.5">
              {rtkState.satsUsed} / {rtkState.satsTracked} 颗
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-1.5">
            <div className="text-[10px] text-slate-400 font-sans">HDOP / 差分龄期</div>
            <div className="text-amber-400 font-black mt-0.5">
              {rtkState.hdop.toFixed(1)} / {rtkState.ageOfDiff.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Scrolling Terminal Window */}
        <div className="flex-1 p-3 font-mono text-[11px] leading-relaxed bg-slate-950 text-slate-200 overflow-y-auto space-y-1 select-text">
          {nmeaStream.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Cpu className="w-8 h-8 text-slate-600 animate-pulse" />
              <p>正在监听外置蓝牙 RTK 接收机 NMEA 串口数据流 ($GNGGA, $GNRMC, $GNVTG)...</p>
            </div>
          ) : (
            nmeaStream.messages.map((sentence, idx) => {
              const isGga = sentence.startsWith('$GNGGA');
              const isRmc = sentence.startsWith('$GNRMC');
              const isVtg = sentence.startsWith('$GNVTG');
              const isGsa = sentence.includes('GSA');

              return (
                <div
                  key={idx}
                  className={`px-1.5 py-0.5 rounded transition ${
                    isGga
                      ? 'text-emerald-300 hover:bg-emerald-950/40'
                      : isRmc
                      ? 'text-cyan-300 hover:bg-cyan-950/40'
                      : isVtg
                      ? 'text-amber-300 hover:bg-amber-950/40'
                      : isGsa
                      ? 'text-purple-300 hover:bg-purple-950/40'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="text-slate-600 select-none mr-2">[{idx + 1}]</span>
                  <span>{sentence}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Diagnosis & Fake Connection Warning Banner if triggered */}
        {isFake && (
          <div className="bg-rose-950/90 border-t border-rose-800 p-2.5 px-4 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px]">
              <div className="font-bold text-rose-300">假连接排查指引 (常见原因)：</div>
              <div>1. 蓝牙虽在手机已配对，但主机工作模式处于【静态测量】，需在手簿中切换为【移动站模式】。</div>
              <div>2. 蓝牙串口波特率不匹配 (默认 115200bps，部分老机型为 9600 或 38400)。</div>
              <div>3. 接收机电量不足或差分天线松动导致不发报文。</div>
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleNmeaPause}
              className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                nmeaStream.isPaused
                  ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {nmeaStream.isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>继续流转</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>暂停滚动</span>
                </>
              )}
            </button>

            <button
              onClick={clearNmeaStream}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清屏</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制报文'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Fake Connection Test Toggle */}
            <button
              onClick={() => setSimulateFakeConnection(!nmeaStream.simulateFakeConnection)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                nmeaStream.simulateFakeConnection
                  ? 'bg-rose-900/80 text-rose-200 border-rose-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
              }`}
              title="模拟接收机断流或假连接，用于测试诊断提示"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{nmeaStream.simulateFakeConnection ? '恢复真实数据' : '测试假连接'}</span>
            </button>

            <button
              onClick={() => {
                soundService.playClick();
                onClose();
              }}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold transition cursor-pointer shadow-xs"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
