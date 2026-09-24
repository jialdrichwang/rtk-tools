/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { RTKProvider, useRTK } from './context/RTKContext';
import { SurveyDataProvider, useSurveyData } from './context/SurveyDataContext';
import { TopStatusBar } from './components/layout/TopStatusBar';
import { SideToolbar } from './components/layout/SideToolbar';

// Screens
import { HomeScreen } from './components/screens/HomeScreen';
import { MarkWaypointScreen } from './components/screens/MarkWaypointScreen';
import { MapScreen } from './components/screens/MapScreen';
import { WaypointListScreen } from './components/screens/WaypointListScreen';
import { CommonToolsScreen } from './components/screens/CommonToolsScreen';
import { RouteManagementScreen } from './components/screens/RouteManagementScreen';
import { EngineeringSurveyScreen } from './components/screens/EngineeringSurveyScreen';
import { ProjectManagementScreen } from './components/screens/ProjectManagementScreen';

// Modals
import { PointStakeoutModal } from './components/survey-tools/PointStakeoutModal';
import { LineStakeoutModal } from './components/survey-tools/LineStakeoutModal';
import { AreaMeasureModal } from './components/survey-tools/AreaMeasureModal';
import { DistanceMeasureModal } from './components/survey-tools/DistanceMeasureModal';
import { SlopeMeasureModal } from './components/survey-tools/SlopeMeasureModal';
import { PointCollectionModal } from './components/survey-tools/PointCollectionModal';
import { DetailSurveyModal } from './components/survey-tools/DetailSurveyModal';
import { SevenParamsModal } from './components/survey-tools/SevenParamsModal';
import { SurveyRecordsModal } from './components/survey-tools/SurveyRecordsModal';
import { CompassModal } from './components/tools/CompassModal';
import { BarometerModal } from './components/tools/BarometerModal';
import { NtripSettingsModal } from './components/tools/NtripSettingsModal';
import { OfflineMapModal } from './components/tools/OfflineMapModal';
import { AccountActivationModal } from './components/tools/AccountActivationModal';
import { UnitSettingsModal } from './components/tools/UnitSettingsModal';
import { ExportImportModal } from './components/tools/ExportImportModal';
import { HistoryDataImportModal } from './components/tools/HistoryDataImportModal';
import { GpsPermissionPromptModal } from './components/tools/GpsPermissionPromptModal';
import { BluetoothScannerModal } from './components/tools/BluetoothScannerModal';
import { NmeaMonitorModal } from './components/tools/NmeaMonitorModal';
import { Save, AlertCircle, LogOut, CheckCircle2, X } from 'lucide-react';

import { App as CapApp } from '@capacitor/app';
import { ScreenType, SurveyPoint } from './types';
import { soundService } from './utils/sound';
import { nativePermissionService } from './utils/nativePermissionService';
import { fileStorageService } from './utils/fileStorageService';
import { backgroundTrackingService } from './utils/backgroundTrackingService';

import { ErrorBoundary } from './components/common/ErrorBoundary';

// Reliable app exit helper
export const forceExitApplication = () => {
  if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.exitApp === 'function') {
    (window as any).AndroidBridge.exitApp();
    return;
  }
  if (nativePermissionService.isNativePlatform()) {
    CapApp.exitApp().catch(() => {});
    return;
  }
  // On web/browser/preview iframe, never close the window to prevent blank white screen
  console.log('App exit requested on web/browser platform');
};

function MainLayout() {
  const { rtkState, fetchRealGPSPosition, setShowBluetoothModal } = useRTK();
  const { currentProject, points, tracks, activeRecording, appendTrackPoint } = useSurveyData();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [screenStack, setScreenStack] = useState<ScreenType[]>([]);

  // Exit App and Engineering Survey confirmation dialog states
  const [showExitAppDialog, setShowExitAppDialog] = useState(false);
  const [showExitSurveyConfirm, setShowExitSurveyConfirm] = useState(false);
  const [pendingTargetScreen, setPendingTargetScreen] = useState<ScreenType | null>(null);
  const [exitSurveyToast, setExitSurveyToast] = useState<string | null>(null);
  const [isSavingOnExit, setIsSavingOnExit] = useState(false);

  // Persistent track point logger loop when recording in background (Screen-off resilient)
  const rtkStateRef = useRef(rtkState);
  useEffect(() => {
    rtkStateRef.current = rtkState;
  }, [rtkState]);

  useEffect(() => {
    if (!activeRecording.isRecording) return;

    const logCurrentPoint = () => {
      const state = rtkStateRef.current;
      appendTrackPoint(state.currentLat, state.currentLon, state.currentAlt, state.speed);
    };

    backgroundTrackingService.start(logCurrentPoint);
    const timer = setInterval(logCurrentPoint, 1000);

    return () => {
      backgroundTrackingService.stop(logCurrentPoint);
      clearInterval(timer);
    };
  }, [activeRecording.isRecording, appendTrackPoint]);

  // Automatic Native System Permissions (Location & Storage) and directory initialization on app startup
  useEffect(() => {
    // 1. Immediately initialize persistent directories (/storage/emulated/0/com.rtkproject.files/)
    fileStorageService.initDirectories().catch(() => {});

    // 2. Request all required native permissions (Location + Storage)
    if (nativePermissionService.isNativePlatform()) {
      nativePermissionService.requestAllPermissions().then((status) => {
        if (status.locationGranted) {
          fetchRealGPSPosition(false);
        }
        // Ensure directories are created after permission is granted
        fileStorageService.initDirectories().catch(() => {});
      });
    } else {
      // In web/PWA mode, ensure directory structures are initialized
      fileStorageService.checkAndRequestPermissions().catch(() => {});
    }
  }, [fetchRealGPSPosition]);

  // Active Modals state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [exportImportTab, setExportImportTab] = useState<'export' | 'import'>('export');
  const [selectedPointForStakeout, setSelectedPointForStakeout] = useState<SurveyPoint | undefined>();

  // Navigation handlers with Engineering Survey exit interceptor
  const navigateTo = (screen: ScreenType) => {
    soundService.playClick();
    if (currentScreen === 'engineering_survey' && screen !== 'engineering_survey') {
      setPendingTargetScreen(screen);
      setShowExitSurveyConfirm(true);
      return;
    }
    setScreenStack((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
  };

  const handleBack = () => {
    soundService.playClick();
    if (currentScreen === 'engineering_survey') {
      const target = screenStack.length > 0 ? screenStack[screenStack.length - 1] : 'home';
      setPendingTargetScreen(target);
      setShowExitSurveyConfirm(true);
      return;
    }
    if (screenStack.length > 0) {
      const prev = screenStack[screenStack.length - 1];
      setScreenStack((s) => s.slice(0, -1));
      setCurrentScreen(prev);
    } else {
      setShowExitAppDialog(true);
    }
  };

  const handleHome = () => {
    soundService.playClick();
    if (currentScreen === 'engineering_survey') {
      setPendingTargetScreen('home');
      setShowExitSurveyConfirm(true);
      return;
    }
    setScreenStack([]);
    setCurrentScreen('home');
  };

  const handleStakeoutPoint = (point: SurveyPoint) => {
    setSelectedPointForStakeout(point);
    setActiveModal('point_stakeout');
  };

  const handleOpenExport = () => {
    setExportImportTab('export');
    setActiveModal('export_import');
  };

  const handleOpenImport = () => {
    setExportImportTab('import');
    setActiveModal('export_import');
  };

  // Exit Engineering Survey actions
  const handleSaveAndExitSurvey = async () => {
    setIsSavingOnExit(true);
    soundService.playSuccess();
    try {
      const projName = currentProject?.name || 'project 1';
      if (Array.isArray(points) && points.length > 0) {
        await fileStorageService.saveProjectFile(projName, 'points', 'points.json', JSON.stringify(points, null, 2));
      }
      if (Array.isArray(tracks) && tracks.length > 0) {
        await fileStorageService.saveProjectFile(projName, 'tracks', 'tracks.json', JSON.stringify(tracks, null, 2));
      }
      setExitSurveyToast(`已成功保存当前工程【${projName}】测量数据！`);
      setTimeout(() => setExitSurveyToast(null), 2500);
    } catch (e) {
      console.warn('Error saving data before exiting survey:', e);
    } finally {
      setIsSavingOnExit(false);
      setShowExitSurveyConfirm(false);
      const target = pendingTargetScreen || 'home';
      setPendingTargetScreen(null);
      if (target === 'home') {
        setScreenStack([]);
        setCurrentScreen('home');
      } else {
        if (screenStack.length > 0) {
          setScreenStack((s) => s.slice(0, -1));
        }
        setCurrentScreen(target);
      }
    }
  };

  const handleDiscardAndExitSurvey = () => {
    soundService.playClick();
    setShowExitSurveyConfirm(false);
    const target = pendingTargetScreen || 'home';
    setPendingTargetScreen(null);
    if (target === 'home') {
      setScreenStack([]);
      setCurrentScreen('home');
    } else {
      if (screenStack.length > 0) {
        setScreenStack((s) => s.slice(0, -1));
      }
      setCurrentScreen(target);
    }
  };

  // Exit App actions
  const handleSaveAndExitApp = async () => {
    setIsSavingOnExit(true);
    soundService.playSuccess();
    try {
      const projName = currentProject?.name || 'project 1';
      if (Array.isArray(points) && points.length > 0) {
        await fileStorageService.saveProjectFile(projName, 'points', 'points.json', JSON.stringify(points, null, 2));
      }
      if (Array.isArray(tracks) && tracks.length > 0) {
        await fileStorageService.saveProjectFile(projName, 'tracks', 'tracks.json', JSON.stringify(tracks, null, 2));
      }
    } catch (e) {
      console.warn('Error saving before exit app:', e);
    } finally {
      setIsSavingOnExit(false);
      setShowExitAppDialog(false);
      forceExitApplication();
    }
  };

  const handleDirectExitApp = () => {
    soundService.playClick();
    setShowExitAppDialog(false);
    forceExitApplication();
  };

  // Expose global handler for Android WebView's onBackPressed and Capacitor App backButton
  useEffect(() => {
    const handleBackAction = () => {
      // 1. If modal is open, close modal
      if (activeModal) {
        setActiveModal(null);
        return true;
      }

      // 2. If exit dialogs are open, close them
      if (showExitAppDialog) {
        setShowExitAppDialog(false);
        return true;
      }
      if (showExitSurveyConfirm) {
        setShowExitSurveyConfirm(false);
        return true;
      }

      // 3. If in engineering survey, trigger prompt
      if (currentScreen === 'engineering_survey') {
        const target = screenStack.length > 0 ? screenStack[screenStack.length - 1] : 'home';
        setPendingTargetScreen(target);
        setShowExitSurveyConfirm(true);
        return true;
      }

      // 4. If inside a sub-screen, go back
      if (currentScreen !== 'home') {
        handleBack();
        return true;
      }

      // 5. In home screen: open Exit App confirmation dialog
      setShowExitAppDialog(true);
      return true;
    };

    (window as any).handleAndroidBackPressed = handleBackAction;

    // Listen to Capacitor native backButton events (Android physical/gesture back)
    let backButtonListener: any = null;
    if (nativePermissionService.isNativePlatform()) {
      try {
        CapApp.addListener('backButton', () => {
          handleBackAction();
        })
          .then((handle) => {
            backButtonListener = handle;
          })
          .catch(() => {});
      } catch {}
    }

    // Safe popstate handler: only navigate back or close modal, never trigger force exit
    const handlePopState = () => {
      if (activeModal) {
        setActiveModal(null);
      } else if (currentScreen !== 'home') {
        handleBack();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      delete (window as any).handleAndroidBackPressed;
      window.removeEventListener('popstate', handlePopState);
      if (backButtonListener && typeof backButtonListener.remove === 'function') {
        backButtonListener.remove();
      }
    };
  }, [activeModal, currentScreen, screenStack]);

  return (
    <div className="h-screen w-screen bg-[#F1F5F9] text-slate-800 flex flex-col overflow-hidden font-sans select-none">
      {/* Handheld RTK Controller Shell Container */}
      <div
        className="flex-1 flex flex-col max-w-5xl w-full mx-auto shadow-xl relative border-x border-slate-200 bg-white overflow-hidden transition-transform duration-500"
        style={{
          transform: rtkState.screenRotation === 180 ? 'rotate(180deg)' : 'none',
        }}
      >
        {/* Top Status Bar */}
        <TopStatusBar
          currentScreen={currentScreen}
          onBack={handleBack}
          onOpenNtrip={() => setActiveModal('ntrip_settings')}
        />

        {/* Middle Body Area: Content + Side Toolbar */}
        <div className="flex-1 flex overflow-hidden relative min-h-0 min-w-0">
          {/* Main Dynamic Screen Views */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
            {currentScreen === 'home' && (
              <HomeScreen
                onNavigate={navigateTo}
                onOpenExportModal={handleOpenExport}
              />
            )}

            {currentScreen === 'mark_waypoint' && (
              <MarkWaypointScreen
                onBack={handleBack}
                onSaved={() => {
                  soundService.playSuccess();
                  setCurrentScreen('waypoint_list');
                }}
              />
            )}

            {currentScreen === 'map' && (
              <MapScreen
                onBack={handleBack}
                onOpenStakeout={() => setActiveModal('point_stakeout')}
                onOpenMarkWaypoint={() => navigateTo('mark_waypoint')}
                onOpenOfflineMap={() => setActiveModal('offline_map')}
              />
            )}

            {currentScreen === 'waypoint_list' && (
              <WaypointListScreen
                onBack={handleBack}
                onAddPoint={() => navigateTo('mark_waypoint')}
                onStakeoutPoint={handleStakeoutPoint}
                onOpenImport={handleOpenImport}
                onOpenExport={handleOpenExport}
              />
            )}

            {(currentScreen === 'common_tools' || currentScreen === 'engineering_data') && (
              <CommonToolsScreen
                onOpenCompass={() => setActiveModal('compass')}
                onOpenBarometer={() => setActiveModal('barometer')}
                onOpenFileExport={handleOpenExport}
                onOpenFileImport={handleOpenImport}
                onOpenOfflineMap={() => setActiveModal('offline_map')}
                onOpenGPSControl={() => setActiveModal('ntrip_settings')}
                onOpenActivation={() => setActiveModal('activation')}
                onOpenPointLibrary={() => navigateTo('waypoint_list')}
                onOpenExportTrack={() => navigateTo('tracks')}
                onOpenHistoryImport={() => setActiveModal('history_data_import')}
                onOpenNmeaMonitor={() => setActiveModal('nmea_monitor')}
                onOpenBluetooth={() => setShowBluetoothModal(true)}
              />
            )}

            {(currentScreen === 'routes' || currentScreen === 'tracks') && (
              <RouteManagementScreen
                onBack={handleBack}
                onNavigateToMap={() => setCurrentScreen('map')}
              />
            )}

            {currentScreen === 'engineering_survey' && (
              <EngineeringSurveyScreen
                onOpenPointCollect={() => setActiveModal('point_collection')}
                onOpenDetailSurvey={() => setActiveModal('detail_survey')}
                onOpenPointStakeout={() => {
                  setSelectedPointForStakeout(undefined);
                  setActiveModal('point_stakeout');
                }}
                onOpenAreaMeasure={() => setActiveModal('area_measure')}
                onOpenDistanceMeasure={() => setActiveModal('distance_measure')}
                onOpenEquidistantStakeout={() => setActiveModal('equidistant_stakeout')}
                onOpenLineStakeout={() => setActiveModal('line_stakeout')}
                onOpenSlopeMeasure={() => setActiveModal('slope_measure')}
                onOpenSurveyRecords={() => setActiveModal('survey_records')}
                onOpenUnitSettings={() => setActiveModal('units')}
              />
            )}

            {currentScreen === 'project_manage' && (
              <ProjectManagementScreen
                onBack={handleBack}
                onOpenSevenParams={() => setActiveModal('seven_params')}
              />
            )}
          </div>

          {/* Right Handheld Quick Side Toolbar */}
          <SideToolbar
            currentScreen={currentScreen}
            onNavigate={navigateTo}
            onHome={handleHome}
            onBack={handleBack}
            onOpenNtrip={() => setActiveModal('ntrip_settings')}
            onOpenCompass={() => setActiveModal('compass')}
            onOpenGPSControl={() => setActiveModal('ntrip_settings')}
          />
        </div>
      </div>

      {/* Global Modals for Survey & Engineering Tools */}
      {activeModal === 'point_stakeout' && (
        <PointStakeoutModal
          onClose={() => setActiveModal(null)}
          initialPoint={selectedPointForStakeout}
        />
      )}

      {activeModal === 'line_stakeout' && (
        <LineStakeoutModal
          onClose={() => setActiveModal(null)}
          isEquidistant={false}
        />
      )}

      {activeModal === 'equidistant_stakeout' && (
        <LineStakeoutModal
          onClose={() => setActiveModal(null)}
          isEquidistant={true}
        />
      )}

      {activeModal === 'area_measure' && (
        <AreaMeasureModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'distance_measure' && (
        <DistanceMeasureModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'slope_measure' && (
        <SlopeMeasureModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'point_collection' && (
        <PointCollectionModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'detail_survey' && (
        <DetailSurveyModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'seven_params' && (
        <SevenParamsModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'survey_records' && (
        <SurveyRecordsModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'compass' && (
        <CompassModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'barometer' && (
        <BarometerModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'ntrip_settings' && (
        <NtripSettingsModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'offline_map' && (
        <OfflineMapModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          centerLat={rtkState.currentLat}
          centerLon={rtkState.currentLon}
        />
      )}

      {activeModal === 'activation' && (
        <AccountActivationModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'units' && (
        <UnitSettingsModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'export_import' && (
        <ExportImportModal
          initialTab={exportImportTab}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'history_data_import' && (
        <HistoryDataImportModal onClose={() => setActiveModal(null)} />
      )}

      {/* External Bluetooth RTK GNSS Scanner Modal */}
      <BluetoothScannerModal />

      {/* NMEA-0183 Telemetry & Fake Connection Diagnosis Modal */}
      {activeModal === 'nmea_monitor' && (
        <NmeaMonitorModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* GPS Permission Request & Diagnostic Prompt Modal */}
      <GpsPermissionPromptModal />

      {/* Engineering Survey Exit Prompt Modal */}
      {showExitSurveyConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99998] select-none">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
                <h3 className="text-sm font-bold text-slate-800">工程测量工作 - 退出提示</h3>
              </div>
              <button
                onClick={() => setShowExitSurveyConfirm(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col">
              <p className="text-xs text-slate-700 leading-relaxed mb-3">
                您即将退出【工程测量】工作模式。退出前建议保存并归档当前工程测量成果。
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs font-mono text-slate-600">
                <div className="flex items-center mb-1">
                  <span className="text-slate-500 font-sans font-medium mr-1.5">当前工程名:</span>
                  <span className="font-bold text-slate-900 font-sans">{currentProject?.name || 'project 1'}</span>
                </div>
                <div className="flex items-center mb-1">
                  <span className="text-slate-500 font-sans font-medium mr-1.5">归档主目录:</span>
                  <span className="text-[11px] text-blue-700">com.rtkproject.files/project/{currentProject?.name || 'project 1'}/</span>
                </div>
                <div className="flex items-center">
                  <span className="text-slate-500 font-sans font-medium mr-1.5">待归档点位:</span>
                  <span className="font-bold text-emerald-600 font-sans">{Array.isArray(points) ? points.length : 0} 个坐标成果</span>
                </div>
              </div>

              <div className="flex flex-col">
                <button
                  onClick={handleSaveAndExitSurvey}
                  disabled={isSavingOnExit}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center mb-2 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>{isSavingOnExit ? '正在保存归档...' : '保存工程数据并退出'}</span>
                </button>

                <div className="flex">
                  <button
                    onClick={handleDiscardAndExitSurvey}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer mr-2 transition"
                  >
                    直接退出
                  </button>
                  <button
                    onClick={() => setShowExitSurveyConfirm(false)}
                    className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition"
                  >
                    取消并留在此页
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global App Exit Confirmation Dialog */}
      {showExitAppDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] select-none">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center">
                <LogOut className="w-5 h-5 text-red-500 mr-2" />
                <h3 className="text-sm font-bold text-slate-800">退出测绘精灵系统</h3>
              </div>
              <button
                onClick={() => setShowExitAppDialog(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col">
              <p className="text-xs text-slate-700 leading-relaxed mb-3">
                您确定要退出测绘精灵应用程序吗？建议在退出前保存当前工程所有测量数据。
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 text-xs">
                <div className="flex items-center mb-1">
                  <span className="text-slate-500 mr-1.5">当前工程:</span>
                  <span className="font-bold text-slate-800">{currentProject?.name || 'project 1'}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  保存至: com.rtkproject.files/project/{currentProject?.name || 'project 1'}/
                </div>
              </div>

              <div className="flex flex-col">
                <button
                  onClick={handleSaveAndExitApp}
                  disabled={isSavingOnExit}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center mb-2 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>{isSavingOnExit ? '正在保存归档...' : '保存工程数据并退出'}</span>
                </button>

                <div className="flex">
                  <button
                    onClick={handleDirectExitApp}
                    className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold cursor-pointer mr-2 transition"
                  >
                    直接退出程序
                  </button>
                  <button
                    onClick={() => setShowExitAppDialog(false)}
                    className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Survey Save Toast */}
      {exitSurveyToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100000] bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-1.5 text-white" />
          <span>{exitSurveyToast}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="RTK 核心系统已保护">
      <RTKProvider>
        <SurveyDataProvider>
          <ErrorBoundary fallbackTitle="RTK 主视图保护">
            <MainLayout />
          </ErrorBoundary>
        </SurveyDataProvider>
      </RTKProvider>
    </ErrorBoundary>
  );
}
