import React, { useState } from 'react';
import { useRTK } from '../../context/RTKContext';
import { Radio, Check, X, ShieldCheck, RefreshCw, Smartphone, Wifi, Bluetooth, ExternalLink, Sliders } from 'lucide-react';
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
    fetchRealGPSPosition,
    fetchIpLocationPosition,
    connectBluetoothGNSS,
    openStandaloneWindow,
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
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
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
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 block">定位数据源 (Positioning Source)</label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                rtkState.mode === 'real_gps'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : rtkState.mode === 'ip_location'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : rtkState.mode === 'bluetooth_gnss'
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {rtkState.mode === 'real_gps'
                  ? '真机GPS传感器'
                  : rtkState.mode === 'ip_location'
                  ? '免权限 IP 网络定位'
                  : rtkState.mode === 'bluetooth_gnss'
                  ? '外置蓝牙 RTK 接收机'
                  : '高精仿真 (地图自由取点)'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  toggleGPSMode('simulated');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rtkState.mode === 'simulated'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>高精仿真接收机</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  toggleGPSMode('ip_location');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rtkState.mode === 'ip_location'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span className="flex items-center gap-1">
                  <span>免权限 IP 定位</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  toggleGPSMode('real_gps');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rtkState.mode === 'real_gps'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>真机 GPS 芯片</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  toggleGPSMode('bluetooth_gnss');
                }}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rtkState.mode === 'bluetooth_gnss'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>外置蓝牙 RTK</span>
              </button>
            </div>

            {/* Real GPS Sensor Status Diagnostic & High Rate Control Details */}
            {rtkState.mode === 'real_gps' && (
              <div className="mt-2 p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between text-blue-900 font-semibold">
                  <span>物理传感器状态:</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
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

                <div className="flex items-center justify-between text-[11px] border-t border-blue-200/60 pt-1.5 font-mono">
                  <span className="text-blue-900 font-sans">实时物理刷新率:</span>
                  <span className="font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded border border-blue-300">
                    {(rtkState.realGpsFrequencyHz || 4.0).toFixed(1)} Hz (&gt;2Hz 高速)
                  </span>
                </div>

                {rtkState.realGpsAccuracy !== undefined && (
                  <div className="text-[11px] text-blue-800 font-mono flex items-center justify-between">
                    <span className="font-sans">原生传感器精度:</span>
                    <span>±{rtkState.realGpsAccuracy.toFixed(1)} 米</span>
                  </div>
                )}

                {/* Sampling Frequency Buttons */}
                <div className="space-y-1 pt-1 border-t border-blue-200/60">
                  <div className="text-[10px] font-bold text-blue-900 uppercase">
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
                            ? 'bg-blue-600 border-blue-700 text-white shadow-2xs'
                            : 'bg-white/90 border-blue-300 text-blue-900 hover:bg-blue-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-1.5 border-t border-blue-200/60 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      fetchRealGPSPosition(true);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>发起系统授权</span>
                  </button>

                  <button
                    type="button"
                    onClick={openStandaloneWindow}
                    className="py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>独立窗口打开</span>
                  </button>
                </div>
              </div>
            )}

            {/* IP Location Status Details */}
            {rtkState.mode === 'ip_location' && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between text-emerald-900 font-semibold">
                  <span>免权限基站定位状态:</span>
                  <span className="text-emerald-700 font-bold">免授权已就绪</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {rtkState.realGpsMessage || '通过网络基站/IP免权限解析地理经纬度。'}
                </div>
                {rtkState.ipCity && (
                  <div className="text-[11px] font-mono text-emerald-900">
                    解析地点: <b>{rtkState.ipCity}</b>
                  </div>
                )}
                <button
                  type="button"
                  onClick={fetchIpLocationPosition}
                  className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>刷新 IP 网络基站经纬度</span>
                </button>
              </div>
            )}

            {/* Bluetooth GNSS Status Details */}
            {rtkState.mode === 'bluetooth_gnss' && (
              <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between text-indigo-900 font-semibold">
                  <span>外置蓝牙 RTK 接收机:</span>
                  <span className="text-indigo-700 font-bold">
                    {rtkState.bluetoothDeviceName || '未连接'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {rtkState.realGpsMessage || '通过 Web Bluetooth 串口直接接收外置 RTK 接收机 NMEA 差分流。'}
                </div>
                <button
                  type="button"
                  onClick={connectBluetoothGNSS}
                  className="w-full py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>搜索并配对外置 RTK 接收机</span>
                </button>
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
