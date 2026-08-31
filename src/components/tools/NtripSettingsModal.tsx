import React, { useState } from 'react';
import { useRTK } from '../../context/RTKContext';
import { Radio, Check, X, ShieldCheck, RefreshCw, Smartphone } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface NtripSettingsModalProps {
  onClose: () => void;
}

export const NtripSettingsModal: React.FC<NtripSettingsModalProps> = ({ onClose }) => {
  const {
    rtkState,
    toggleGPSMode,
    setSolution,
    ntripConfig,
    setNtripConfig,
    isNtripConnected,
    connectNtrip,
    disconnectNtrip,
    setTargetSamplingHz,
  } = useRTK();

  const [ip, setIp] = useState(ntripConfig.ip);
  const [port, setPort] = useState(ntripConfig.port.toString());
  const [mountPoint, setMountPoint] = useState(ntripConfig.mountPoint);
  const [user, setUser] = useState(ntripConfig.user);
  const [pass, setPass] = useState(ntripConfig.pass);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSaveAndConnect = async () => {
    soundService.playClick();
    setIsConnecting(true);
    setNtripConfig({
      ...ntripConfig,
      ip,
      port: parseInt(port) || 8001,
      mountPoint,
      user,
      pass,
    });
    await connectNtrip();
    setIsConnecting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">定位源与 NTRIP CORS 差分配置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Position Source Mode Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 block">定位数据源 (Positioning Source)</label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                rtkState.mode === 'real_gps'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {rtkState.mode === 'real_gps' ? '机内真机GNSS传感器' : '高精仿真 (可点击地图取点)'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  toggleGPSMode('simulated');
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rtkState.mode === 'simulated'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>高精仿真接收机</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  toggleGPSMode('real_gps');
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rtkState.mode === 'real_gps'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>真机GPS传感器</span>
              </button>
            </div>

            {/* Real GPS Sensor Status Diagnostic & High Rate Control Details */}
            {rtkState.mode === 'real_gps' && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between text-emerald-900 font-semibold">
                  <span>硬件传感器状态:</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {rtkState.realGpsStatus === 'locked'
                      ? '已锁定真机GNSS'
                      : rtkState.realGpsStatus === 'locating'
                      ? '定位搜星中...'
                      : rtkState.realGpsStatus === 'denied'
                      ? '权限受限'
                      : '就绪'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {rtkState.realGpsMessage || '已连接手机/平板原生定位服务，并过滤地图点击篡改。'}
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-emerald-200/60 pt-1.5 font-mono">
                  <span className="text-emerald-900 font-sans">实时物理刷新率:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                    {(rtkState.realGpsFrequencyHz || 4.0).toFixed(1)} Hz (&gt;2Hz 高速)
                  </span>
                </div>

                {rtkState.realGpsAccuracy !== undefined && (
                  <div className="text-[11px] text-emerald-800 font-mono flex items-center justify-between">
                    <span className="font-sans">原生传感器精度:</span>
                    <span>±{rtkState.realGpsAccuracy.toFixed(1)} 米</span>
                  </div>
                )}

                {/* Sampling Frequency Buttons */}
                <div className="space-y-1 pt-1 border-t border-emerald-200/60">
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">
                    硬件数据采集刷新率设定 (&gt;2Hz):
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { hz: 2.5, label: '2.5 Hz' },
                      { hz: 4.0, label: '4.0 Hz (标准)' },
                      { hz: 5.0, label: '5.0 Hz (推荐)' },
                      { hz: 10.0, label: '10 Hz (极限)' },
                    ].map((item) => (
                      <button
                        key={item.hz}
                        type="button"
                        onClick={() => setTargetSamplingHz(item.hz)}
                        className={`py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                          (rtkState.targetSamplingHz || 4.0) === item.hz
                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs'
                            : 'bg-white/90 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick RTK Solution Quality Override */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              解状态模拟切换 (Solution Quality)
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['FIXED', 'FLOAT', 'SINGLE', 'INVALID'] as const).map((sol) => (
                <button
                  key={sol}
                  type="button"
                  onClick={() => setSolution(sol)}
                  className={`py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                    rtkState.solution === sol
                      ? sol === 'FIXED'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : sol === 'FLOAT'
                        ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xs'
                        : sol === 'SINGLE'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-rose-600 border-rose-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {sol === 'FIXED' ? '固定解' : sol === 'FLOAT' ? '浮点解' : sol === 'SINGLE' ? '单点解' : '无效解'}
                </button>
              ))}
            </div>
          </div>

          {/* NTRIP CORS Parameters */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">NTRIP CORS 账号配置</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isNtripConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isNtripConnected ? '已连接差分源' : '未连接'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">CORS 服务器 IP/域名</label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">端口 (Port)</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">挂载点 (MountPoint)</label>
              <input
                type="text"
                value={mountPoint}
                onChange={(e) => setMountPoint(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">用户账号 (Username)</label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">密码 (Password)</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={disconnectNtrip}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
          >
            断开差分
          </button>
          <button
            onClick={handleSaveAndConnect}
            disabled={isConnecting}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>保存并连接</span>
          </button>
        </div>
      </div>
    </div>
  );
};
