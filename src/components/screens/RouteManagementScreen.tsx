import React, { useState, useEffect, useRef } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { TrackPoint, SurveyTrack } from '../../types';
import {
  Route as RouteIcon,
  Plus,
  Trash2,
  MapPin,
  ChevronRight,
  Play,
  Pause,
  Square,
  Sliders,
  FileDown,
  Clock,
  Navigation,
  FileSpreadsheet,
  Layers,
  Activity,
  CheckSquare,
  Square as UncheckedSquare,
  RotateCcw,
  FastForward,
  Eye,
  Check,
  X,
  Compass,
  Gauge,
  Calendar,
} from 'lucide-react';
import { calculateDistanceAndAzimuth, haversineDistance } from '../../utils/geodesy';
import {
  downloadFile,
  exportTrackToKML,
  exportTrackToGPX,
  exportTrackToCSV,
  exportTrackToDAT,
  exportTrackToTXT,
} from '../../utils/exportImport';
import { soundService } from '../../utils/sound';

interface RouteManagementScreenProps {
  onBack: () => void;
  onNavigateToMap: () => void;
}

export type RecordFrequency = '0.5s' | '1s' | '2s' | '5s' | '10s';
export type AutoSaveTimeTrigger = 'none' | '1m' | '5m' | '10m' | '30m' | '60m';
export type AutoSaveDistTrigger = 'none' | '50m' | '100m' | '500m' | '1000m';
export type RecordFileFormat = 'CSV' | 'KML' | 'GPX' | 'DAT' | 'TXT';

export const RouteManagementScreen: React.FC<RouteManagementScreenProps> = ({
  onBack,
  onNavigateToMap,
}) => {
  const { routes, points, tracks, addRoute, deleteRoute, addTrack, deleteTrack } = useSurveyData();
  const { rtkState } = useRTK();

  const [activeTab, setActiveTab] = useState<'record' | 'files' | 'planned'>('record');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<TrackPoint[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedDistance, setRecordedDistance] = useState(0);

  // Settings for recording parameters
  const [frequency, setFrequency] = useState<RecordFrequency>('1s');
  const [autoSaveTime, setAutoSaveTime] = useState<AutoSaveTimeTrigger>('none');
  const [autoSaveDist, setAutoSaveDist] = useState<AutoSaveDistTrigger>('none');
  const [saveFormat, setSaveFormat] = useState<RecordFileFormat>('CSV');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Selected file ids for batch deletion
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);

  // Planned Route Creation
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [routeDesc, setRouteDesc] = useState('');

  // Track Replay Modal State
  const [replayTrack, setReplayTrack] = useState<SurveyTrack | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 5 | 10>(2);

  // Recording Timer Loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      const intervalMs =
        frequency === '0.5s' ? 500 :
        frequency === '1s' ? 1000 :
        frequency === '2s' ? 2000 :
        frequency === '5s' ? 5000 : 10000;

      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + intervalMs / 1000);

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const newPt: TrackPoint = {
          lat: rtkState.currentLat,
          lon: rtkState.currentLon,
          elevation: rtkState.currentAlt,
          time: timeStr,
          speed: rtkState.speed,
        };

        setRecordedPoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const distInc = haversineDistance(last.lat, last.lon, newPt.lat, newPt.lon);
            setRecordedDistance((d) => d + distInc);
          }
          return [...prev, newPt];
        });
      }, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isRecording, frequency, rtkState.currentLat, rtkState.currentLon, rtkState.currentAlt, rtkState.speed]);

  // Check auto-save distance/time trigger
  useEffect(() => {
    if (!isRecording || recordedPoints.length < 2) return;

    let timeLimitSec = 0;
    if (autoSaveTime === '1m') timeLimitSec = 60;
    else if (autoSaveTime === '5m') timeLimitSec = 300;
    else if (autoSaveTime === '10m') timeLimitSec = 600;
    else if (autoSaveTime === '30m') timeLimitSec = 1800;
    else if (autoSaveTime === '60m') timeLimitSec = 3600;

    let distLimitMeters = 0;
    if (autoSaveDist === '50m') distLimitMeters = 50;
    else if (autoSaveDist === '100m') distLimitMeters = 100;
    else if (autoSaveDist === '500m') distLimitMeters = 500;
    else if (autoSaveDist === '1000m') distLimitMeters = 1000;

    const timeTriggered = timeLimitSec > 0 && recordingSeconds >= timeLimitSec;
    const distTriggered = distLimitMeters > 0 && recordedDistance >= distLimitMeters;

    if (timeTriggered || distTriggered) {
      saveCurrentRecordedRoute(true);
    }
  }, [recordingSeconds, recordedDistance, isRecording]);

  // Replay animation timer
  useEffect(() => {
    let replayTimer: NodeJS.Timeout;
    if (isReplaying && replayTrack && replayTrack.points.length > 0) {
      const stepInterval = Math.max(80, 500 / replaySpeed);
      replayTimer = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= replayTrack.points.length - 1) {
            setIsReplaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, stepInterval);
    }
    return () => clearInterval(replayTimer);
  }, [isReplaying, replayTrack, replaySpeed]);

  const handleStartRecording = () => {
    soundService.playClick();
    setRecordedPoints([]);
    setRecordingSeconds(0);
    setRecordedDistance(0);
    setIsRecording(true);
  };

  const saveCurrentRecordedRoute = (isAutoChunk = false) => {
    if (recordedPoints.length < 2) return;

    const now = new Date();
    const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const trackName = isAutoChunk
      ? `自动分段航线_${dateTag}`
      : `实测航线航迹_${dateTag}`;

    const newTrack = addTrack({
      name: trackName,
      points: [...recordedPoints],
      distance: Math.round(recordedDistance * 10) / 10,
      duration: Math.round(recordingSeconds),
      startTime: recordedPoints[0].time,
      endTime: recordedPoints[recordedPoints.length - 1].time,
      color: '#0284c7',
    });

    // Auto export file if configured
    if (saveFormat === 'CSV') {
      const csv = exportTrackToCSV(newTrack);
      downloadFile(csv, `${trackName}.csv`, 'text/csv;charset=utf-8');
    } else if (saveFormat === 'KML') {
      const kml = exportTrackToKML(newTrack);
      downloadFile(kml, `${trackName}.kml`, 'application/vnd.google-earth.kml+xml');
    } else if (saveFormat === 'GPX') {
      const gpx = exportTrackToGPX(newTrack);
      downloadFile(gpx, `${trackName}.gpx`, 'application/gpx+xml');
    } else if (saveFormat === 'DAT') {
      const dat = exportTrackToDAT(newTrack);
      downloadFile(dat, `${trackName}.dat`, 'text/plain;charset=utf-8');
    } else if (saveFormat === 'TXT') {
      const txt = exportTrackToTXT(newTrack);
      downloadFile(txt, `${trackName}.txt`, 'text/plain;charset=utf-8');
    }

    soundService.playSuccess();

    if (isAutoChunk) {
      setRecordedPoints([]);
      setRecordingSeconds(0);
      setRecordedDistance(0);
    }
  };

  const handleStopRecording = () => {
    soundService.playClick();
    setIsRecording(false);
    saveCurrentRecordedRoute(false);
  };

  const handleExportTrackFile = (track: SurveyTrack, fmt: RecordFileFormat) => {
    soundService.playClick();
    if (fmt === 'CSV') {
      const content = exportTrackToCSV(track);
      downloadFile(content, `${track.name}.csv`, 'text/csv;charset=utf-8');
    } else if (fmt === 'KML') {
      const content = exportTrackToKML(track);
      downloadFile(content, `${track.name}.kml`, 'application/vnd.google-earth.kml+xml');
    } else if (fmt === 'GPX') {
      const content = exportTrackToGPX(track);
      downloadFile(content, `${track.name}.gpx`, 'application/gpx+xml');
    } else if (fmt === 'DAT') {
      const content = exportTrackToDAT(track);
      downloadFile(content, `${track.name}.dat`, 'text/plain;charset=utf-8');
    } else {
      const content = exportTrackToTXT(track);
      downloadFile(content, `${track.name}.txt`, 'text/plain;charset=utf-8');
    }
  };

  const handleDeleteSelectedTracks = () => {
    if (selectedTrackIds.length === 0) return;
    if (window.confirm(`确定批量删除选中的 ${selectedTrackIds.length} 个航线/航迹记录文件？\n此操作不可恢复。`)) {
      soundService.playClick();
      selectedTrackIds.forEach((id) => deleteTrack(id));
      setSelectedTrackIds([]);
    }
  };

  const toggleSelectAllTracks = () => {
    if (selectedTrackIds.length === tracks.length) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(tracks.map((t) => t.id));
    }
  };

  const toggleSelectTrack = (id: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleOpenReplay = (track: SurveyTrack) => {
    soundService.playClick();
    setReplayTrack(track);
    setReplayIndex(0);
    setIsReplaying(true);
  };

  const handleCreatePlannedRoute = () => {
    if (!routeName.trim() || selectedPointIds.length < 2) return;

    let totalDist = 0;
    for (let i = 0; i < selectedPointIds.length - 1; i++) {
      const p1 = points.find((p) => p.id === selectedPointIds[i]);
      const p2 = points.find((p) => p.id === selectedPointIds[i + 1]);
      if (p1 && p2) {
        const { distance } = calculateDistanceAndAzimuth(p1.x, p1.y, p2.x, p2.y);
        totalDist += distance;
      }
    }

    addRoute({
      name: routeName.trim(),
      pointIds: selectedPointIds,
      totalDistance: Math.round(totalDist * 10) / 10,
      desc: routeDesc.trim(),
      color: '#f97316',
    });

    soundService.playSuccess();
    setRouteName('');
    setSelectedPointIds([]);
    setRouteDesc('');
    setShowAddRouteModal(false);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 overflow-hidden select-none">
      {/* Sub Header Tabs */}
      <div className="bg-white border-b border-slate-200 px-3 pt-2 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('record');
            }}
            id="tab-btn-record"
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'record'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>实时在线录制</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('files');
            }}
            id="tab-btn-files"
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'files'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>航线记录台账</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
              {tracks.length}
            </span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('planned');
            }}
            id="tab-btn-planned"
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'planned'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span>规划放样航线</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
              {routes.length}
            </span>
          </button>
        </div>

        {activeTab === 'record' && (
          <button
            onClick={() => {
              soundService.playClick();
              setShowSettingsModal(true);
            }}
            id="btn-open-record-settings"
            className="flex items-center gap-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg font-medium cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>记录参数</span>
          </button>
        )}

        {activeTab === 'planned' && (
          <button
            onClick={() => {
              soundService.playClick();
              setShowAddRouteModal(true);
            }}
            id="btn-add-planned-route"
            className="flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg font-medium shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建规划</span>
          </button>
        )}
      </div>

      {/* TAB 1: Real-time Route / Track Recording & Parameter Status */}
      {activeTab === 'record' && (
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
          {/* Main Recording Console */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-300'
                  }`}
                />
                <span className="text-sm font-bold text-slate-900">
                  {isRecording ? '正在实时录制高精航线/航迹...' : '实时航线记录器 (待机就绪)'}
                </span>
              </div>
              <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                {formatDuration(recordingSeconds)}
              </span>
            </div>

            {/* Live stats metrics */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">已录点数:</span>
                <span className="text-slate-900 font-bold text-sm">{recordedPoints.length} 点</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">累计航程:</span>
                <span className="text-blue-700 font-bold text-sm">{recordedDistance.toFixed(1)} m</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">当前航速:</span>
                <span className="text-emerald-700 font-bold text-sm">{(rtkState.speed * 3.6).toFixed(1)} km/h</span>
              </div>
            </div>

            {/* Current GNSS Position info */}
            <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono text-slate-600">
              <div>
                E: <b className="text-slate-900">{rtkState.currentLon.toFixed(7)}°</b> N: <b className="text-slate-900">{rtkState.currentLat.toFixed(7)}°</b>
              </div>
              <div>
                H: <b className="text-slate-900">{rtkState.currentAlt.toFixed(2)}m</b>
              </div>
            </div>

            {/* Current Parameter Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-600 pt-0.5">
              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                频率: <b className="text-blue-600">{frequency}</b>
              </span>
              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                输出格式: <b className="text-emerald-600">{saveFormat}</b>
              </span>
              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                时间分段: <b className="text-slate-700">{autoSaveTime === 'none' ? '不切分' : autoSaveTime}</b>
              </span>
              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                距离分段: <b className="text-slate-700">{autoSaveDist === 'none' ? '不切分' : autoSaveDist}</b>
              </span>
            </div>

            {/* Action buttons */}
            {isRecording ? (
              <button
                onClick={handleStopRecording}
                id="btn-stop-recording"
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer active:scale-98 transition"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>停止录制并保存成果 ({saveFormat})</span>
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                id="btn-start-recording"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer active:scale-98 transition"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>开始实时在线录制</span>
              </button>
            )}
          </div>

          {/* Quick instructions guide */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>功能与参数说明</span>
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-600">
              • <b>多维度参数配置</b>：支持采样频率（0.5s至10s）、时间分段（1m至60m）、距离分段（50m至1000m）。<br/>
              • <b>5 种行业标准格式</b>：直接生成并导出 CSV、Google/奥维 KML、GPX、南方CASS .DAT 与 TXT 文件。<br/>
              • <b>台账管理与回放</b>：可在【航线记录台账】中进行全选、批量删除、单条管理及一键动画回放。
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: Recorded Route / Track Files Ledger & Management */}
      {activeTab === 'files' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* File management top action bar */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAllTracks}
                className="flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium cursor-pointer"
              >
                {selectedTrackIds.length === tracks.length && tracks.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <UncheckedSquare className="w-4 h-4 text-slate-400" />
                )}
                <span>全选 ({selectedTrackIds.length}/{tracks.length})</span>
              </button>
            </div>

            {selectedTrackIds.length > 0 && (
              <button
                onClick={handleDeleteSelectedTracks}
                className="flex items-center gap-1 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>批量删除 ({selectedTrackIds.length})</span>
              </button>
            )}
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto space-y-2.5">
            {tracks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                <div>暂无航线/航迹记录文件，切换至【实时在线录制】开始外业作业</div>
              </div>
            ) : (
              tracks.map((tk) => {
                const isSelected = selectedTrackIds.includes(tk.id);
                return (
                  <div
                    key={tk.id}
                    className={`bg-white border rounded-xl p-3 space-y-2 shadow-xs transition ${
                      isSelected ? 'border-blue-400 bg-blue-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggleSelectTrack(tk.id)}
                          className="cursor-pointer text-slate-400 hover:text-blue-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <UncheckedSquare className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{tk.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            时间: {tk.startTime} ~ {tk.endTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenReplay(tk)}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 flex items-center gap-1 cursor-pointer transition"
                          title="在地图上回放轨迹"
                        >
                          <Play className="w-3 h-3 fill-blue-600 text-blue-600" />
                          <span>回放轨迹</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`确定删除航线记录文件【${tk.name}】？`)) {
                              soundService.playClick();
                              deleteTrack(tk.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="删除文件"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 block text-[9px]">测点数:</span>
                        <span className="text-slate-800 font-bold">{tk.points.length} 点</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">累计距离:</span>
                        <span className="text-blue-700 font-bold">{tk.distance} m</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">记录历时:</span>
                        <span className="text-slate-800 font-bold">{formatDuration(tk.duration)}</span>
                      </div>
                    </div>

                    {/* Export Formats & Map View Bar */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">导出:</span>
                        {(['CSV', 'KML', 'GPX', 'DAT', 'TXT'] as RecordFileFormat[]).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => handleExportTrackFile(tk, fmt)}
                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 text-[10px] font-bold border border-slate-200 cursor-pointer transition"
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={onNavigateToMap}
                        className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5 text-[11px] cursor-pointer"
                      >
                        <span>在地图查看</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Planned Routes for Staking */}
      {activeTab === 'planned' && (
        <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
          {routes.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-2">
              <RouteIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <div>暂无规划航线，点击右上角【新建规划】从点库生成放样路径</div>
            </div>
          ) : (
            routes.map((rt) => (
              <div
                key={rt.id}
                className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
                      <RouteIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{rt.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        创建时间: {rt.createdAt}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm(`确定删除规划航线【${rt.name}】？`)) {
                        soundService.playClick();
                        deleteRoute(rt.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Point badges */}
                <div className="flex flex-wrap items-center gap-1.5 py-1">
                  {rt.pointIds.map((pid, idx) => {
                    const pt = points.find((p) => p.id === pid);
                    return (
                      <React.Fragment key={pid}>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-medium">
                          {pt ? pt.name : pid}
                        </span>
                        {idx < rt.pointIds.length - 1 && (
                          <span className="text-slate-400 text-xs">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Bottom stats */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-mono text-slate-500">
                  <span>总长度: <b className="text-blue-700 font-bold">{rt.totalDistance}m</b></span>
                  <button
                    onClick={onNavigateToMap}
                    className="text-blue-600 hover:text-blue-700 font-sans font-semibold flex items-center gap-0.5 text-[11px] cursor-pointer"
                  >
                    <span>地图放样</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Recording Parameters Configuration Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>航线与航迹记录参数配置</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Frequency Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                采样记录频率 (间隔时长)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['0.5s', '1s', '2s', '5s', '10s'] as RecordFrequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                      frequency === f
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 block">
                0.5秒/次(2Hz高精), 1秒/次(标准), 2秒/5秒/10秒(长距巡线)
              </span>
            </div>

            {/* Auto Save Distance Trigger */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                按距离自动保存分段条件
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['none', '50m', '100m', '500m', '1000m'] as AutoSaveDistTrigger[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setAutoSaveDist(d)}
                    className={`py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer text-center ${
                      autoSaveDist === d
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {d === 'none' ? '不按距离' : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Save Time Trigger */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                按时间自动保存分段条件
              </label>
              <div className="grid grid-cols-6 gap-1">
                {(['none', '1m', '5m', '10m', '30m', '60m'] as AutoSaveTimeTrigger[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAutoSaveTime(t)}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer text-center ${
                      autoSaveTime === t
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'none' ? '不按时间' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Save Format */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                默认保存文件格式 (5种行业格式)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['CSV', 'KML', 'GPX', 'DAT', 'TXT'] as RecordFileFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSaveFormat(fmt)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                      saveFormat === fmt
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                soundService.playClick();
                setShowSettingsModal(false);
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              确认并应用参数
            </button>
          </div>
        </div>
      )}

      {/* Track Replay Animation Modal */}
      {replayTrack && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  轨迹回放：{replayTrack.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsReplaying(false);
                  setReplayTrack(null);
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current point info during replay */}
            {replayTrack.points[replayIndex] && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1.5">
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>进度: 点 {replayIndex + 1} / {replayTrack.points.length}</span>
                  <span>时间: {replayTrack.points[replayIndex].time}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    经度: <b className="text-slate-900">{replayTrack.points[replayIndex].lon.toFixed(7)}°</b>
                  </div>
                  <div>
                    纬度: <b className="text-slate-900">{replayTrack.points[replayIndex].lat.toFixed(7)}°</b>
                  </div>
                  <div>
                    高程: <b className="text-blue-700">{replayTrack.points[replayIndex].elevation.toFixed(2)}m</b>
                  </div>
                  <div>
                    速度: <b className="text-emerald-700">{((replayTrack.points[replayIndex].speed || 0) * 3.6).toFixed(1)} km/h</b>
                  </div>
                </div>
              </div>
            )}

            {/* Slider progress */}
            <div>
              <input
                type="range"
                min={0}
                max={Math.max(0, replayTrack.points.length - 1)}
                value={replayIndex}
                onChange={(e) => {
                  setReplayIndex(parseInt(e.target.value));
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    soundService.playClick();
                    setIsReplaying(!isReplaying);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isReplaying ? '暂停' : '播放'}</span>
                </button>

                <button
                  onClick={() => {
                    soundService.playClick();
                    setReplayIndex(0);
                    setIsReplaying(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs cursor-pointer"
                  title="重新回放"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Speed Buttons */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <span className="text-slate-400 mr-0.5">倍速:</span>
                {([1, 2, 5, 10] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setReplaySpeed(spd)}
                    className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                      replaySpeed === spd
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setReplayTrack(null);
                  onNavigateToMap();
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 cursor-pointer"
              >
                在全屏地图中观察
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Planned Route Modal */}
      {showAddRouteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-blue-600" />
                <span>新建点库规划放样航线</span>
              </h3>
              <button
                onClick={() => setShowAddRouteModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">航线名称</label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="例如: 1号路中线放样轴线"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                选择途径点位 (按点击顺序连接, 至少2个点)
              </label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1.5">
                {points.map((pt) => {
                  const isSelected = selectedPointIds.includes(pt.id);
                  const orderIdx = selectedPointIds.indexOf(pt.id);
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        soundService.playClick();
                        setSelectedPointIds((prev) =>
                          prev.includes(pt.id)
                            ? prev.filter((id) => id !== pt.id)
                            : [...prev, pt.id]
                        );
                      }}
                      className={`w-full p-2 rounded-lg flex items-center justify-between text-xs border text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{pt.name}</span>
                        <span className="text-[10px] text-slate-400 ml-2">({pt.code})</span>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {orderIdx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddRouteModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreatePlannedRoute}
                disabled={!routeName.trim() || selectedPointIds.length < 2}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                创建航线
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
