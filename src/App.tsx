/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RTKProvider } from './context/RTKContext';
import { SurveyDataProvider } from './context/SurveyDataContext';
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

import { ScreenType, SurveyPoint } from './types';
import { soundService } from './utils/sound';
import { useRTK } from './context/RTKContext';

function MainLayout() {
  const { rtkState } = useRTK();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [screenStack, setScreenStack] = useState<ScreenType[]>([]);

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
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Dynamic Screen Views */}
          <div className="flex-1 flex flex-col overflow-hidden">
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
              />
            )}

            {currentScreen === 'waypoint_list' && (
              <WaypointListScreen
                onBack={handleBack}
                onAddPoint={() => navigateTo('mark_waypoint')}
                onStakeoutPoint={handleStakeoutPoint}
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
        <OfflineMapModal onClose={() => setActiveModal(null)} />
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
    </div>
  );
}

export default function App() {
  return (
    <RTKProvider>
      <SurveyDataProvider>
        <MainLayout />
      </SurveyDataProvider>
    </RTKProvider>
  );
}
