import React, { useState, useEffect, useRef } from 'react';
import { useRTK, BluetoothDeviceInfo } from '../../context/RTKContext';
import {
  Bluetooth,
  X,
  RefreshCw,
  Signal,
  CheckCircle2,
  Radio,
  Sliders,
  ShieldCheck,
  Cpu,
  Wifi,
  Terminal,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  Plus,
  Zap,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

const POPULAR_GNSS_DEVICES: BluetoothDeviceInfo[] = [
  {
    id: 'bt_chc_i93',
    name: 'CHC_i93_8932',
    brand: '华测导航 (CHCNAV)',
    model: 'i93 视觉RTK测量系统',
    mac: '74:D4:35:89:32:AF',
    rssi: -52,
    paired: true,
    status: 'idle',
    type: 'RTK',
  },
  {
    id: 'bt_south_galaxy_g7',
    name: 'SOUTH_G7_5510',
    brand: '南方测绘 (SOUTH)',
    model: '银河 G7 惯导RTK接收机',
    mac: 'AC:22:0B:55:10:8C',
    rssi: -61,
    paired: true,
    status: 'idle',
    type: 'RTK',
  },
  {
    id: 'bt_hitarget_v200',
    name: 'HiTarget_V200_1829',
    brand: '中海达 (Hi-Target)',
    model: 'V200 迷你小型GNSS接收机',
    mac: '18:93:D7:18:29:40',
    rssi: -68,
    paired: false,
    status: 'idle',
    type: 'RTK',
  },
  {
    id: 'bt_unistrong_g970',
    name: 'UniStrong_G970II',
    brand: '合众思壮 (UniStrong)',
    model: 'G970II 旗舰多星多频RTK',
    mac: '30:AE:A4:77:88:12',
    rssi: -74,
    paired: false,
    status: 'idle',
    type: 'RTK',
  },
  {
    id: 'bt_comnav_t300',
    name: 'ComNav_T300Plus',
    brand: '司南导航 (ComNav)',
    model: 'T300 Plus 测绘GNSS',
    mac: '88:4A:EA:20:19:6F',
    rssi: -79,
    paired: false,
    status: 'idle',
    type: 'RTK',
  },
  {
    id: 'bt_emlid_reach_rs3',
    name: 'Reach_RS3_4102',
    brand: 'Emlid',
    model: 'Reach RS3 倾斜补偿RTK',
    mac: '00:1A:7D:DA:71:02',
    rssi: -83,
    paired: false,
    status: 'idle',
    type: 'RTK',
  },
];

export const BluetoothScannerModal: React.FC = () => {
  const {
    showBluetoothModal,
    setShowBluetoothModal,
    connectBluetoothGNSS,
    rtkState,
    nmeaStream,
    clearNmeaStream,
    toggleNmeaPause,
    setSimulateFakeConnection,
  } = useRTK();

  const [activeTab, setActiveTab] = useState<'devices' | 'nmea'>('devices');
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>(POPULAR_GNSS_DEVICES);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<string>('115200');
  const [outputRate, setOutputRate] = useState<string>('5Hz');

  // Manual device addition state
  const [showAddModal, setShowAddModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMac, setCustomMac] = useState('');
  const [customBrand, setCustomBrand] = useState('自定义RTK');

  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // If connected, allow auto tab focus on NMEA
  useEffect(() => {
    if (showBluetoothModal) {
      handleScan();
      if (rtkState.mode === 'bluetooth_gnss') {
        setActiveTab('nmea');
      }
    }
  }, [showBluetoothModal]);

  // Auto-scroll NMEA terminal
  useEffect(() => {
    if (activeTab === 'nmea' && !nmeaStream.isPaused && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [nmeaStream.messages, activeTab, nmeaStream.isPaused]);

  // Scan handler: combines Android Native Bonded devices & presets (Requirement 5)
  const handleScan = () => {
    soundService.playClick();
    setIsScanning(true);

    let nativeBonded: BluetoothDeviceInfo[] = [];
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getBondedBluetoothDevices) {
        const rawJson = (window as any).AndroidBridge.getBondedBluetoothDevices();
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          nativeBonded = parsed.map((item: any, idx: number) => ({
            id: `native_bt_${idx}`,
            name: item.name || '系统配对GNSS',
            brand: '安卓系统已绑定设备',
            model: '已配对蓝牙串口/SPP',
            mac: item.mac || '00:11:22:33:44:55',
            rssi: -48,
            paired: true,
            status: 'idle' as const,
            type: 'RTK' as const,
          }));
        }
      }
    } catch (e) {
      console.warn('Querying native Bluetooth devices error:', e);
    }

    setTimeout(() => {
      setIsScanning(false);
      setDevices((prev) => {
        // Merge native bonded devices without duplicating MACs
        const existingMacs = new Set(nativeBonded.map((d) => d.mac));
        const filteredPresets = POPULAR_GNSS_DEVICES.filter((d) => !existingMacs.has(d.mac)).map((d) => ({
          ...d,
          rssi: Math.min(-45, Math.max(-90, d.rssi + Math.floor((Math.random() - 0.5) * 6))),
        }));
        return [...nativeBonded, ...filteredPresets];
      });
    }, 900);
  };

  const handleConnect = async (device: BluetoothDeviceInfo) => {
    soundService.playClick();
    setConnectingId(device.id);

    setTimeout(async () => {
      await connectBluetoothGNSS(device);
      setConnectingId(null);
      setActiveTab('nmea'); // Automatically transition to NMEA monitor on connection
    }, 600);
  };

  const handleAddCustomDevice = () => {
    if (!customName.trim()) return;
    soundService.playSuccess();
    const newDev: BluetoothDeviceInfo = {
      id: `custom_bt_${Date.now()}`,
      name: customName.trim(),
      brand: customBrand.trim() || '自定义RTK',
      model: '外置差分接收机',
      mac: customMac.trim() || 'AA:BB:CC:DD:EE:FF',
      rssi: -50,
      paired: true,
      status: 'idle',
      type: 'RTK',
    };
    setDevices((prev) => [newDev, ...prev]);
    setShowAddModal(false);
    setCustomName('');
    setCustomMac('');
    handleConnect(newDev);
  };

  const handleCopyNmea = () => {
    soundService.playSuccess();
    const text = nmeaStream.messages.join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showBluetoothModal) return null;

  const getRssiBadge = (rssi: number) => {
    if (rssi >= -60) return { label: '极强', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (rssi >= -75) return { label: '良好', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    return { label: '一般', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  };

  const isFake = nmeaStream.isFakeConnection;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">外置蓝牙 RTK 接收机配对与报文监控</h2>
              <p className="text-[10px] text-slate-500">
                兼容华测/南方/中海达/合众思壮全系 · 支持 NMEA-0183 差分流与假连接诊断
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBluetoothModal(false)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Port & Baud settings strip */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-indigo-950 font-semibold text-[11px]">串口波特率:</span>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              className="bg-white border border-indigo-200 rounded-md px-2 py-0.5 text-xs text-indigo-900 font-mono font-bold"
            >
              <option value="9600">9600</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200 (默认推荐)</option>
              <option value="230400">230400</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-indigo-950 font-semibold text-[11px]">NMEA频次:</span>
            <select
              value={outputRate}
              onChange={(e) => setOutputRate(e.target.value)}
              className="bg-white border border-indigo-200 rounded-md px-2 py-0.5 text-xs text-indigo-900 font-mono font-bold"
            >
              <option value="1Hz">1 Hz</option>
              <option value="2Hz">2 Hz</option>
              <option value="5Hz">5 Hz (高频推荐)</option>
              <option value="10Hz">10 Hz (极限)</option>
            </select>
          </div>
        </div>

        {/* Tab Switcher: Devices List vs NMEA Live Terminal */}
        <div className="flex items-center border-b border-slate-200 bg-slate-100 px-3 pt-1.5 gap-2 text-xs">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('devices');
            }}
            className={`px-3 py-1.5 rounded-t-xl font-bold flex items-center gap-1.5 transition cursor-pointer border-t border-x ${
              activeTab === 'devices'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            <span>发现附近设备 ({devices.length})</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('nmea');
            }}
            className={`px-3 py-1.5 rounded-t-xl font-bold flex items-center gap-1.5 transition cursor-pointer border-t border-x ${
              activeTab === 'nmea'
                ? 'bg-slate-900 text-cyan-300 border-slate-800 shadow-2xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>📡 NMEA-0183 报文监控</span>
            {rtkState.mode === 'bluetooth_gnss' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'devices' ? (
          /* Device List Tab */
          <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <span>GNSS 测绘接收机列表 ({devices.length})</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加自定义</span>
                </button>

                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? '正在搜寻...' : '重新搜索'}</span>
                </button>
              </div>
            </div>

            {/* Device Cards */}
            <div className="space-y-2">
              {devices.map((device) => {
                const rssiInfo = getRssiBadge(device.rssi);
                const isCurrentConnected =
                  rtkState.mode === 'bluetooth_gnss' && rtkState.bluetoothDeviceName?.includes(device.name);
                const isThisConnecting = connectingId === device.id;

                return (
                  <div
                    key={device.id}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2.5 ${
                      isCurrentConnected
                        ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400/40'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrentConnected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {device.name}
                          </span>
                          {device.paired && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold shrink-0">
                              已配对
                            </span>
                          )}
                          {device.brand.includes('系统') && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold shrink-0">
                              系统蓝牙
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">
                          {device.brand} · {device.model}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-400">
                          <span>MAC: {device.mac}</span>
                          <span>•</span>
                          <span
                            className={`px-1.5 py-0.2 rounded border text-[9px] font-sans font-bold ${rssiInfo.color}`}
                          >
                            {device.rssi} dBm ({rssiInfo.label})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isCurrentConnected ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setActiveTab('nmea')}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-black text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                            <span>报文</span>
                          </button>
                          <span className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>锁定</span>
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(device)}
                          disabled={isThisConnecting}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          {isThisConnecting ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>握手中...</span>
                            </>
                          ) : (
                            <>
                              <Bluetooth className="w-3 h-3" />
                              <span>配对直连</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Device Modal / Form */}
            {showAddModal && (
              <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl space-y-2 text-xs">
                <div className="font-bold text-indigo-950 flex items-center justify-between">
                  <span>手动录入接收机 (免扫描即刻连接)</span>
                  <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="设备名称 (如 CHC_i93)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="MAC地址 (如 74:D4:35:89:32:AF)"
                    value={customMac}
                    onChange={(e) => setCustomMac(e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px]"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddCustomDevice}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shadow-xs"
                  >
                    确认添加并连接
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>连接排查说明：</span>
              </div>
              <div>• 系统已自动读取 Android 系统蓝牙已配对设备，开机即能秒级握手。</div>
              <div>• 如列表未显示，请确认手簿/手机【设置-蓝牙】中是否已配对该RTK。</div>
            </div>
          </div>
        ) : (
          /* Live NMEA Telemetry Terminal Tab (Requirement 5) */
          <div className="bg-slate-950 text-slate-100 flex-1 flex flex-col min-h-[380px] overflow-hidden">
            {/* Fake Connection & Heartbeat Health Status Bar */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-xs transition-colors ${
                isFake
                  ? 'bg-rose-950/90 border-rose-800 text-rose-200'
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
                    ? '⚠️ 假连接警报：蓝牙已配对，但连续 3.0 秒无 NMEA 数据流入！'
                    : '🟢 硬件连接正常：真实 NMEA 差分流持续输入'}
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[10px]">
                <span>频次: {isFake ? '0.0' : nmeaStream.hz.toFixed(1)} Hz</span>
                <span>吞吐: {isFake ? '0' : nmeaStream.bytesPerSec} B/s</span>
                <span>已接收: {nmeaStream.totalReceived} 帧</span>
              </div>
            </div>

            {/* Solution Info Strip */}
            <div className="bg-slate-900 px-3.5 py-1.5 border-b border-slate-800 grid grid-cols-4 gap-2 text-center text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">解状态</span>
                <span className="text-emerald-400 font-black">
                  {rtkState.solution === 'FIXED' ? '4 - RTK固定' : rtkState.solution}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">中误差(H/V)</span>
                <span className="text-cyan-400 font-black">
                  ±{(rtkState.hrms * 1000).toFixed(0)}/±{(rtkState.vrms * 1000).toFixed(0)}mm
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">卫星(用/视)</span>
                <span className="text-slate-200 font-black">
                  {rtkState.satsUsed}/{rtkState.satsTracked}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">差分龄期</span>
                <span className="text-amber-400 font-black">{rtkState.ageOfDiff.toFixed(1)}s</span>
              </div>
            </div>

            {/* Terminal scrolling window */}
            <div className="flex-1 p-3 font-mono text-[11px] leading-relaxed bg-slate-950 text-slate-200 overflow-y-auto space-y-1 select-text">
              {nmeaStream.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Cpu className="w-8 h-8 text-slate-600 animate-pulse" />
                  <p>等待外置蓝牙 RTK 接收机发送 NMEA-0183 差分报文...</p>
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
                      className={`px-1.5 py-0.2 rounded transition ${
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

            {/* Terminal Actions Bar */}
            <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleNmeaPause}
                  className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition cursor-pointer ${
                    nmeaStream.isPaused
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {nmeaStream.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span>{nmeaStream.isPaused ? '继续' : '暂停'}</span>
                </button>

                <button
                  onClick={clearNmeaStream}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>清屏</span>
                </button>

                <button
                  onClick={handleCopyNmea}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? '已复制' : '复制'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSimulateFakeConnection(!nmeaStream.simulateFakeConnection)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                    nmeaStream.simulateFakeConnection
                      ? 'bg-rose-900 text-rose-200 border-rose-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                  title="模拟假连接以测试故障诊断报警"
                >
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>{nmeaStream.simulateFakeConnection ? '恢复数据流' : '模拟假连接'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => setShowBluetoothModal(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
