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
  const { activeRecording, appendTrackPoint } = useSurveyData();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [screenStack, setScreenStack] = useState<ScreenType[]>([]);

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

  // Navigation handlers
  const navigateTo = (screen: ScreenType) => {
    soundService.playClick();
    setScreenStack((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
  };

  const handleBack = () => {
    soundService.playClick();
    if (screenStack.length > 0) {
      const prev = screenStack[screenStack.length - 1];
      setScreenStack((s) => s.slice(0, -1));
      setCurrentScreen(prev);
    } else {
      setCurrentScreen('home');
    }
  };

  const handleHome = () => {
    soundService.playClick();
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

  // Double back press exit state
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const lastBackPressTimeRef = useRef(0);
  const exitTimerRef = useRef<any>(null);

  // Expose global handler for Android WebView's onBackPressed and Capacitor App backButton
  useEffect(() => {
    const handleBackAction = () => {
      // 1. If modal is open, close modal
      if (activeModal) {
        setActiveModal(null);
        return true; // handled
      }

      // 2. If inside a sub-screen, go back
      if (currentScreen !== 'home') {
        handleBack();
        return true; // handled
      }

      // 3. In home screen: check double back press
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        // Double pressed within 2s -> trigger immediate full exit
        forceExitApplication();
        return false;
      }

      // First press: prompt user
      lastBackPressTimeRef.current = now;
      setShowExitPrompt(true);
      soundService.playClick();
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        setShowExitPrompt(false);
      }, 2000);
      return true; // handled, waiting for second back press
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
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
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

      {/* Double back exit toast prompt */}
      {showExitPrompt && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-xs pointer-events-none flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>再按一次返回键退出程序</span>
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
