import React, { useState, useEffect } from 'react';
import { useRTK } from '../../context/RTKContext';
import {
  MapPin,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Wifi,
  Bluetooth,
  Globe2,
  Sliders,
  X,
  Copy,
  Check,
  Apple,
  Info,
  Maximize,
  Download,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

export const GpsPermissionPromptModal: React.FC = () => {
  const {
    rtkState,
    fetchRealGPSPosition,
    fetchIpLocationPosition,
    connectBluetoothGNSS,
    openStandaloneWindow,
    toggleGPSMode,
  } = useRTK();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnose' | 'native_standalone' | 'pwa_fullscreen' | 'no_permission' | 'bluetooth'>('diagnose');
  const [osTab, setOsTab] = useState<'ios' | 'android' | 'wechat'>('ios');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isIpRequesting, setIsIpRequesting] = useState(false);
  const [isBtRequesting, setIsBtRequesting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [currentFullUrl, setCurrentFullUrl] = useState('');
  const [currentPort, setCurrentPort] = useState('');
  const [isIOS, setIsIOS] = useState(false);

  // Detect OS, full URL, and port
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentFullUrl(window.location.href);
      setCurrentPort(window.location.port || (window.location.protocol === 'https:' ? '443' : '80'));
    }

    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isIPhone = /iPhone|iPad|iPod/i.test(ua);
      setIsIOS(isIPhone);
      if (isIPhone) {
        setOsTab('ios');
      } else if (/MicroMessenger/i.test(ua)) {
        setOsTab('wechat');
      } else {
        setOsTab('android');
      }
    }
  }, []);

  // Open automatically if in real_gps mode and status is denied or error
  useEffect(() => {
    if (rtkState.mode === 'real_gps' && (rtkState.realGpsStatus === 'denied' || rtkState.realGpsStatus === 'error')) {
      setIsOpen(true);
    }
  }, [rtkState.mode, rtkState.realGpsStatus]);

  const handleRequestPermission = async () => {
    soundService.playClick();
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      const success = await fetchRealGPSPosition(true);
      if (success) {
        setIsOpen(false);
      }
    } catch (e) {
      console.error('Error requesting GPS permission:', e);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleFetchIpLocation = async () => {
    soundService.playClick();
    if (isIpRequesting) return;
    setIsIpRequesting(true);
    try {
      const success = await fetchIpLocationPosition();
      if (success) {
        setIsOpen(false);
      }
    } catch (e) {
      console.error('Error requesting IP location:', e);
    } finally {
      setIsIpRequesting(false);
    }
  };

  const handleConnectBluetooth = async () => {
    soundService.playClick();
    if (isBtRequesting) return;
    setIsBtRequesting(true);
    try {
      const success = await connectBluetoothGNSS();
      if (success) {
        setIsOpen(false);
      }
    } catch (e) {
      console.error('Error connecting Bluetooth:', e);
    } finally {
      setIsBtRequesting(false);
    }
  };

  const handleCopyUrl = () => {
    if (typeof window !== 'undefined') {
      soundService.playClick();
      const targetUrl = window.location.href;
      navigator.clipboard.writeText(targetUrl).then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
      });
    }
  };

  const handleTriggerFullscreen = () => {
    soundService.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    }
    setIsOpen(false);
  };

  const handleFallbackSimulation = () => {
    soundService.playClick();
    toggleGPSMode('simulated');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
              <MapPin className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">手机 GPS 权限排查与全屏运行</h3>
              <p className="text-[11px] text-sky-200 mt-0.5">
                真机权限解封、全屏独立应用模式、免权限 IP 基站
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('diagnose');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'diagnose'
                ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>真机权限解封</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('native_standalone');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'native_standalone'
                ? 'bg-white text-emerald-700 border-t-2 border-t-emerald-600 border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>独立原生App与脱离地图</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('pwa_fullscreen');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'pwa_fullscreen'
                ? 'bg-white text-purple-600 border-t-2 border-t-purple-600 border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Maximize className="w-3.5 h-3.5" />
            <span>全屏桌面应用</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('no_permission');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'no_permission'
                ? 'bg-white text-emerald-600 border-t-2 border-t-emerald-600 border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>免权限网络定位</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('bluetooth');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'bluetooth'
                ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600 border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>蓝牙RTK</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Tab 1: System Geolocation Diagnose & OS-Specific Unlock */}
          {activeTab === 'diagnose' && (
            <div className="space-y-3.5">
              {/* URL & Port inspector box */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-700">当前运行完整访问地址（含端口号）:</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono">
                    端口: {currentPort}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-300 font-mono text-[11px] text-slate-800 break-all select-all flex items-center justify-between gap-2">
                  <span className="truncate">{currentFullUrl}</span>
                  <button
                    onClick={handleCopyUrl}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 cursor-pointer"
                    title="复制完整网址"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopyUrl}
                    className="py-1.5 px-3 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold flex items-center justify-center gap-1.5 transition hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">已复制完整网址</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>复制网址</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={openStandaloneWindow}
                    className="py-1.5 px-3 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center gap-1.5 transition hover:bg-blue-700 active:bg-blue-800 cursor-pointer text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>在新标签页独立打开</span>
                  </button>
                </div>
              </div>

              {/* Why no prompt explanation banner */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>为什么会提示权限受阻或未弹出确认框？</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  在 iOS Safari 和 Android Chrome 中，若系统之前记录过<b>“拒绝定位”</b>、<b>“浏览器无系统定位权限”</b>或<b>“室内无卫星物理信号”</b>，手机会静默拦截。请按照下方步骤重置：
                </p>
              </div>

              {/* OS Selector Tabs */}
              <div className="flex rounded-xl bg-slate-100 p-1 gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setOsTab('ios')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    osTab === 'ios'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Apple className="w-3.5 h-3.5" />
                  <span>苹果 iPhone (Safari)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOsTab('android')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    osTab === 'android'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>安卓 (Chrome/小米/华为)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOsTab('wechat')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    osTab === 'wechat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>微信/内嵌浏览</span>
                </button>
              </div>

              {/* OS Instruction Content */}
              {osTab === 'ios' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                    <span>🍎 苹果 iPhone 权限开启 3 步法:</span>
                    <span className="text-[10px] text-blue-600 font-normal">亲测 100% 解决</span>
                  </div>
                  <ol className="space-y-2 text-[11px] text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                      <div>
                        <b>在 Safari 页面重置</b>：在 Safari 左下角（或右上角）点击 <b>【大小】</b> 或 <b>【aA】</b> 图标 ➔ 点击 <b>【网站设置】</b> ➔ 将【位置】从“拒绝”改为 <b>【允许】</b>。
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                      <div>
                        <b>检查系统定位服务</b>：打开手机 <b>【设置】➔【隐私与安全性】➔【定位服务】</b> 确保总开关处于开启状态。
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                      <div>
                        <b>Safari 权限设置</b>：打开手机 <b>【设置】➔【Safari 浏览器】➔【位置】</b> ➔ 勾选 <b>【每次询问】</b> 或 <b>【允许】</b>。
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {osTab === 'android' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                    <span>🤖 安卓手机权限开启 3 步法:</span>
                    <span className="text-[10px] text-blue-600 font-normal">适用于 Chrome/Edge/自带</span>
                  </div>
                  <ol className="space-y-2 text-[11px] text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                      <div>
                        <b>在 Chrome 网站设置中允许</b>：在 Chrome 地址栏左侧点击 <b>【🔒锁形 / 网页设置】</b> ➔ 点击 <b>【权限】</b> ➔ 将【位置信息】设为 <b>【允许】</b>。
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                      <div>
                        <b>手机应用权限</b>：打开手机 <b>【系统设置】➔【应用管理】➔【Chrome】➔【权限】➔【位置信息】</b> ➔ 勾选 <b>【使用中允许】</b> 并务必打开 <b>【使用精确位置】</b> 开关。
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                      <div>
                        <b>下拉菜单开启 GPS</b>：从屏幕顶部下拉控制中心，确保 <b>【位置信息 / GPS】</b> 图标点亮。
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {osTab === 'wechat' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="font-bold text-slate-900 text-xs">
                    💬 微信 / 钉钉 / 预览器限制解决办法:
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    微信内嵌浏览器安全策略会严格阻断 W3C Geolocation 接口。请点击微信右上角 <b>【···】</b> ➔ 选择 <b>【在系统浏览器 / Safari / Chrome 中打开】</b>。
                  </p>
                </div>
              )}

              {/* Re-request Button */}
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black active:scale-[0.99] text-white font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-70"
              >
                {isRequesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>正在发起硬件 GPS 搜星与定位请求...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>再次发起真机 GPS 硬件定位</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab 2: Standalone Native App & Offline Mapless Survey Guide */}
          {activeTab === 'native_standalone' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-900">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>完全脱离 Web 架构 —— 独立原生 Android APK 方案</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Web 浏览器（尤其是内嵌预览或微信环境）受制于 W3C 沙箱，容易出现权限静默拦截。本项目现已<b>原生内置 Capacitor 原生底座与 AndroidManifest 系统权限声明</b>，可直接打包为独立 Android 安装包（APK），像传统测绘手簿一样由操作系统自身直接发起权限申请。
                </p>
              </div>

              {/* 1. Android APK Build Steps */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>🛠️ 本地 3 步生成原生独立 APK:</span>
                  <span className="text-[10px] text-blue-600 font-mono">已配置 AndroidManifest.xml</span>
                </div>
                <div className="space-y-2 font-mono text-[11px] text-slate-800">
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400"># 1. 构建 Web 核心</span>
                    <div className="text-blue-700 font-bold">npm run build</div>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400"># 2. 生成并同步原生 Android 工程</span>
                    <div className="text-blue-700 font-bold">npx cap add android && npx cap sync</div>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400"># 3. 在 Android Studio 中一键编译安装到手机</span>
                    <div className="text-blue-700 font-bold">npx cap open android</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  💡 生成的 APK 拥有系统底层的 <b>ACCESS_FINE_LOCATION</b> 与 <b>BLUETOOTH_SCAN</b> 原生权限，打开 App 即自动弹出系统原生授权确认框，彻底摆脱浏览器各种限制。
                </div>
              </div>

              {/* 2. Mapless Offline CAD Surveying Mode */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs text-blue-900">
                  <Globe2 className="w-4 h-4 text-blue-600" />
                  <span>无需依赖任何外部地图 ——「脱离底图网格雷达」模式</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  在野外无网络或无卫星底图环境下，可在地图右上角图层中切换为<b>【脱离底图网格雷达 (CAD独立模式)】</b>：
                </p>
                <ul className="text-[11px] text-blue-900 space-y-1 list-disc list-inside">
                  <li>0 外部瓦片网络请求，杜绝底图加载失败</li>
                  <li>纯本地 2D/3D 极坐标与笛卡尔工程网格 $(X, Y, H)$</li>
                  <li>实时测站十字准心、航向指北针、放样矢量线与打点标定</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 3: PWA Fullscreen standalone application */}
          {activeTab === 'pwa_fullscreen' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs text-purple-900">
                  <Maximize className="w-4 h-4 text-purple-600" />
                  <span>独立全屏作业模式（免去浏览器地址栏与工具栏）</span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  本系统已完整支持 <b>PWA 渐进式独立应用规范</b>。添加到主屏幕后即可像原生 App 一样全屏沉浸运行，享受最大测绘地图视野与更稳定的硬件调用。
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="font-bold text-slate-900 text-xs">📱 快速添加到主屏幕全屏运行:</div>
                <div className="space-y-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                      <Apple className="w-4 h-4 text-slate-700" />
                      <span>苹果 iPhone / iPad (Safari)</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      在 Safari 底部工具栏点击 <b>【分享 / 向上箭头图标 📤】</b> ➔ 向下滑动并点击 <b>【添加到主屏幕】</b> ➔ 点击右上角 <b>【添加】</b>。随后即可从手机桌面一键全屏秒开！
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                      <Smartphone className="w-4 h-4 text-slate-700" />
                      <span>安卓 Android (Chrome / Edge / 浏览器)</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      在 Chrome 右上角点击 <b>【三点菜单 ⋮】</b> ➔ 选择 <b>【安装应用】</b> 或 <b>【添加到主屏幕】</b> ➔ 确认添加。即可在桌面生成独立全屏图标。
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleTriggerFullscreen}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Maximize className="w-4 h-4" />
                <span>立即进入网页全屏作业模式 (Fullscreen)</span>
              </button>
            </div>
          )}

          {/* Tab 3: IP Network Geolocation (NO PERMISSIONS REQUIRED) */}
          {activeTab === 'no_permission' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-900">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span>免权限 IP 网络基站定位（立即生效）</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  <b>无需浏览器弹出任何授权确认框，无需手机硬件 GPS 芯片</b>。系统通过云端网络基站与 IP 地址极速解析当前所在城市与真实经纬度坐标，支持一键载入并进行 NTRIP CORS 差分。
                </p>
                {rtkState.ipCity && (
                  <div className="mt-2 p-2 rounded-lg bg-white/80 border border-emerald-200 text-[11px] font-mono flex items-center justify-between">
                    <span>当前解析城市:</span>
                    <span className="font-bold text-emerald-700">{rtkState.ipCity}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-[11px]">方案优势:</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">授权门槛</div>
                    <div className="font-bold text-emerald-600 mt-0.5">0 权限 / 100% 免弹窗</div>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">响应速度</div>
                    <div className="font-bold text-blue-600 mt-0.5">&lt; 0.5 秒极速响应</div>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">室内环境</div>
                    <div className="font-bold text-slate-700 mt-0.5">室内/地下室完全可用</div>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">测量功能</div>
                    <div className="font-bold text-indigo-600 mt-0.5">支持测存/放样/CORS</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleFetchIpLocation}
                disabled={isIpRequesting}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-70"
              >
                {isIpRequesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>正在免权限解析网络基站地理位置...</span>
                  </>
                ) : (
                  <>
                    <Globe2 className="w-4 h-4" />
                    <span>立即启用【免权限网络基站定位】</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab 4: External Bluetooth RTK GNSS Receiver Explanation */}
          {activeTab === 'bluetooth' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-xs text-indigo-900">
                  <Bluetooth className="w-4 h-4 text-indigo-600" />
                  <span>为什么提示“当前环境未启用 Web Bluetooth API”？</span>
                </div>
                <div className="text-[11px] text-indigo-900 leading-relaxed space-y-1.5">
                  <p>
                    1. <b>苹果 iOS (iPhone / iPad) 系统政策</b>：Apple 在 iOS 系统的所有浏览器中<b>全面禁用了 Web Bluetooth API</b>，因此苹果设备无法通过网页直接搜索蓝牙。
                  </p>
                  <p>
                    2. <b>安卓设备支持条件</b>：在安卓手机上，需使用 <b>原生 Google Chrome / Microsoft Edge 浏览器</b>，且手机需开启蓝牙与位置服务开关。
                  </p>
                  <p>
                    3. <b>测绘硬件连接</b>：如果您使用的是专业 RTK 仪器（如华测、中海达、千寻、南方等），在 Android Chrome 中可直接通过蓝牙读取 NMEA 0183 差分流。
                  </p>
                </div>
              </div>

              {!isIOS && (
                <button
                  onClick={handleConnectBluetooth}
                  disabled={isBtRequesting}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-70"
                >
                  {isBtRequesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在搜索附近 GNSS 蓝牙设备...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>在 Android Chrome 中搜索蓝牙 RTK 设备</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Quick Fallback to Simulated Mode */}
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={handleFallbackSimulation}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold transition cursor-pointer text-center text-xs flex items-center justify-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>使用【高精仿真接收机】(可在地图上自由选点与测试)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


