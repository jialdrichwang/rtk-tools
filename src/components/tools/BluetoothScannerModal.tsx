import React, { useState, useEffect } from 'react';
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
  const { showBluetoothModal, setShowBluetoothModal, connectBluetoothGNSS, rtkState } = useRTK();
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>(POPULAR_GNSS_DEVICES);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<string>('115200');
  const [outputRate, setOutputRate] = useState<string>('5Hz');

  useEffect(() => {
    if (showBluetoothModal) {
      handleScan();
    }
  }, [showBluetoothModal]);

  const handleScan = () => {
    soundService.playClick();
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      // simulate slight RSSI variation
      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          rssi: Math.min(-45, Math.max(-90, d.rssi + Math.floor((Math.random() - 0.5) * 6))),
        }))
      );
    }, 1200);
  };

  const handleConnect = async (device: BluetoothDeviceInfo) => {
    soundService.playClick();
    setConnectingId(device.id);

    // Short simulated handshake delay
    setTimeout(async () => {
      await connectBluetoothGNSS(device);
      setConnectingId(null);
    }, 700);
  };

  if (!showBluetoothModal) return null;

  const getRssiBadge = (rssi: number) => {
    if (rssi >= -60) return { label: '极强', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (rssi >= -75) return { label: '良好', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    return { label: '一般', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">外置蓝牙 RTK 接收机配对与直连</h2>
              <p className="text-[10px] text-slate-500">免系统浏览器弹窗 · 兼容华测/南方/中海达等全系机型</p>
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
              <option value="5Hz">5 Hz (高频)</option>
              <option value="10Hz">10 Hz (极限)</option>
            </select>
          </div>
        </div>

        {/* Device List */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-600" />
              <span>发现附近 GNSS 测绘接收机 ({devices.length})</span>
            </span>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? '正在搜寻...' : '重新搜索'}</span>
            </button>
          </div>

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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {device.name}
                        </span>
                        {device.paired && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold shrink-0">
                            已配对
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {device.brand} · {device.model}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-400">
                        <span>MAC: {device.mac}</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-sans font-bold ${rssiInfo.color}`}>
                          {device.rssi} dBm ({rssiInfo.label})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isCurrentConnected ? (
                      <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>已锁定</span>
                      </span>
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

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>多厂商接收机自动解析协议：</span>
            </div>
            <div>• 支持标准 NMEA-0183 ($GNGGA, $GNRMC, $GNVTG, $GPGSA) 格式差分语句。</div>
            <div>• 开启RTK主机蓝牙后保持在10米范围内，系统将自动绑定并维持后台长连接。</div>
          </div>
        </div>

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
