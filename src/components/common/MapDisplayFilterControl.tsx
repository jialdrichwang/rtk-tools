import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  ChevronDown,
  MapPin,
  Route,
  Search,
  Check,
  CheckSquare,
  Square,
  X,
  Filter,
} from 'lucide-react';
import { SurveyPoint, SurveyTrack } from '../../types';
import { soundService } from '../../utils/sound';

interface MapDisplayFilterControlProps {
  // Points
  points: SurveyPoint[];
  showPoints: boolean;
  selectedPointIds: string[];
  onToggleShowPoints: (show: boolean) => void;
  onSetSelectedPointIds: (ids: string[]) => void;

  // Tracks
  tracks: SurveyTrack[];
  showTracks: boolean;
  selectedTrackIds: string[];
  onToggleShowTracks: (show: boolean) => void;
  onSetSelectedTrackIds: (ids: string[]) => void;

  // Active recording track
  isLiveRecording?: boolean;
  liveRecordingPointCount?: number;
  showLiveRecording?: boolean;
  onToggleShowLiveRecording?: (show: boolean) => void;
}

export const MapDisplayFilterControl: React.FC<MapDisplayFilterControlProps> = ({
  points,
  showPoints,
  selectedPointIds,
  onToggleShowPoints,
  onSetSelectedPointIds,
  tracks,
  showTracks,
  selectedTrackIds,
  onToggleShowTracks,
  onSetSelectedTrackIds,
  isLiveRecording = false,
  liveRecordingPointCount = 0,
  showLiveRecording = true,
  onToggleShowLiveRecording,
}) => {
  const [openDropdown, setOpenDropdown] = useState<'none' | 'points' | 'tracks'>('none');
  const [pointSearch, setPointSearch] = useState('');
  const [trackSearch, setTrackSearch] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered points
  const filteredPoints = useMemo(() => {
    if (!pointSearch.trim()) return points;
    const query = pointSearch.trim().toLowerCase();
    return points.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.code && p.code.toLowerCase().includes(query)) ||
        (p.desc && p.desc.toLowerCase().includes(query))
    );
  }, [points, pointSearch]);

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (!trackSearch.trim()) return tracks;
    const query = trackSearch.trim().toLowerCase();
    return tracks.filter((t) => t.name.toLowerCase().includes(query));
  }, [tracks, trackSearch]);

  // Points quick actions
  const handleToggleMasterPoints = () => {
    soundService.playClick();
    if (showPoints) {
      // 一键全关航点
      onToggleShowPoints(false);
    } else {
      // 一键全开航点 (若当前全未选，则自动全选)
      onToggleShowPoints(true);
      if (selectedPointIds.length === 0 && points.length > 0) {
        onSetSelectedPointIds(points.map((p) => p.id));
      }
    }
  };

  const handleSelectAllPoints = () => {
    soundService.playClick();
    onToggleShowPoints(true);
    onSetSelectedPointIds(points.map((p) => p.id));
  };

  const handleDeselectAllPoints = () => {
    soundService.playClick();
    onSetSelectedPointIds([]);
  };

  const handleSelectOnlyThisPoint = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundService.playClick();
    onToggleShowPoints(true);
    onSetSelectedPointIds([id]);
  };

  const handleTogglePointItem = (id: string) => {
    soundService.playClick();
    if (selectedPointIds.includes(id)) {
      onSetSelectedPointIds(selectedPointIds.filter((pid) => pid !== id));
    } else {
      onSetSelectedPointIds([...selectedPointIds, id]);
      if (!showPoints) {
        onToggleShowPoints(true);
      }
    }
  };

  // Tracks quick actions
  const handleToggleMasterTracks = () => {
    soundService.playClick();
    if (showTracks) {
      // 一键全关航迹
      onToggleShowTracks(false);
    } else {
      // 一键全开航迹
      onToggleShowTracks(true);
      if (selectedTrackIds.length === 0 && tracks.length > 0) {
        onSetSelectedTrackIds(tracks.map((t) => t.id));
      }
    }
  };

  const handleSelectAllTracks = () => {
    soundService.playClick();
    onToggleShowTracks(true);
    onSetSelectedTrackIds(tracks.map((t) => t.id));
  };

  const handleDeselectAllTracks = () => {
    soundService.playClick();
    onSetSelectedTrackIds([]);
  };

  const handleSelectOnlyThisTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundService.playClick();
    onToggleShowTracks(true);
    onSetSelectedTrackIds([id]);
  };

  const handleToggleTrackItem = (id: string) => {
    soundService.playClick();
    if (selectedTrackIds.includes(id)) {
      onSetSelectedTrackIds(selectedTrackIds.filter((tid) => tid !== id));
    } else {
      onSetSelectedTrackIds([...selectedTrackIds, id]);
      if (!showTracks) {
        onToggleShowTracks(true);
      }
    }
  };

  // Calculated displayed count
  const displayedPointsCount = showPoints ? selectedPointIds.length : 0;
  const displayedTracksCount = showTracks ? selectedTrackIds.length : 0;

  return (
    <div ref={containerRef} className="relative z-20 flex items-center gap-1.5 select-none">
      {/* 1. 航点控制组 (Waypoint Switch & Dropdown) */}
      <div className="relative">
        <div
          className={`flex items-center rounded-xl border transition shadow-sm backdrop-blur-md ${
            showPoints && displayedPointsCount > 0
              ? 'bg-white/95 border-blue-200 text-slate-800'
              : 'bg-slate-100/90 border-slate-300 text-slate-500'
          }`}
        >
          {/* 一键全关 / 一键全显主开关按钮 */}
          <button
            type="button"
            onClick={handleToggleMasterPoints}
            id="btn-map-toggle-all-points"
            title={showPoints ? '点击一键全关航点显示' : '点击开启航点显示'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-50/80 active:scale-95 transition rounded-l-xl"
          >
            {showPoints && displayedPointsCount > 0 ? (
              <Eye className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-sans">航点</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                !showPoints
                  ? 'bg-slate-200 text-slate-600'
                  : displayedPointsCount === points.length && points.length > 0
                  ? 'bg-blue-100 text-blue-700'
                  : displayedPointsCount === 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {!showPoints ? '全关' : `${displayedPointsCount}/${points.length}`}
            </span>
          </button>

          {/* 分隔微线 */}
          <div className="w-[1px] h-4 bg-slate-200" />

          {/* 右端下拉展开按钮 (多选/单选) */}
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setOpenDropdown((prev) => (prev === 'points' ? 'none' : 'points'));
            }}
            id="btn-map-points-dropdown"
            title="下拉勾选单个或多个航点"
            className={`px-1.5 py-1.5 hover:bg-slate-100 active:scale-90 transition cursor-pointer rounded-r-xl ${
              openDropdown === 'points' ? 'text-blue-600 bg-blue-50' : 'text-slate-500'
            }`}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openDropdown === 'points' ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>
        </div>

        {/* 航点下拉选择面板 */}
        {openDropdown === 'points' && (
          <div className="absolute left-0 top-10 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-40 space-y-2.5 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>航点显示筛选</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (已选 {selectedPointIds.length} / 共 {points.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenDropdown('none')}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Search */}
            {points.length > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索点名、编码..."
                  value={pointSearch}
                  onChange={(e) => setPointSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                />
                {pointSearch && (
                  <button
                    type="button"
                    onClick={() => setPointSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Fast Action Buttons: 全选 / 全不选 / 一键全关 */}
            <div className="flex items-center justify-between text-[11px] font-medium pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllPoints}
                  className="px-2 py-0.8 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition cursor-pointer flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>全选</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllPoints}
                  className="px-2 py-0.8 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 transition cursor-pointer flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  <span>全不选</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleMasterPoints}
                className={`px-2 py-0.8 rounded font-bold transition cursor-pointer text-[10px] border ${
                  showPoints
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {showPoints ? '一键全关' : '一键开启'}
              </button>
            </div>

            {/* Point Checkbox List */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 divide-y divide-slate-50">
              {filteredPoints.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {points.length === 0 ? '暂无工程标定航点' : '未找到匹配的航点'}
                </div>
              ) : (
                filteredPoints.map((pt) => {
                  const isChecked = selectedPointIds.includes(pt.id);
                  const pinColor = pt.color || '#3b82f6';
                  return (
                    <div
                      key={pt.id}
                      onClick={() => handleTogglePointItem(pt.id)}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50/70 text-slate-900 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Custom styled checkbox */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Point color badge */}
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pinColor }}
                        />

                        {/* Name and Code */}
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-bold text-slate-900 mr-1.5">{pt.name}</span>
                          {pt.code && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                              {pt.code}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right action: "仅选" shortcut for instant single-select */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className="text-[10px] font-mono text-slate-400">
                          {pt.elevation.toFixed(1)}m
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleSelectOnlyThisPoint(pt.id, e)}
                          title="仅选此航点 (单选模式)"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-blue-600 hover:text-white text-slate-500 border border-slate-200 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          仅选
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom info banner */}
            {!showPoints && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-[10px] text-amber-800 flex items-center gap-1">
                <EyeOff className="w-3 h-3 text-amber-600 shrink-0" />
                <span>当前航点总开关已关闭，地图上所有航点已被隐藏。</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. 航迹控制组 (Track Switch & Dropdown) */}
      <div className="relative">
        <div
          className={`flex items-center rounded-xl border transition shadow-sm backdrop-blur-md ${
            showTracks && (displayedTracksCount > 0 || (isLiveRecording && showLiveRecording))
              ? 'bg-white/95 border-teal-200 text-slate-800'
              : 'bg-slate-100/90 border-slate-300 text-slate-500'
          }`}
        >
          {/* 一键全关 / 一键全显主开关按钮 */}
          <button
            type="button"
            onClick={handleToggleMasterTracks}
            id="btn-map-toggle-all-tracks"
            title={showTracks ? '点击一键全关航迹显示' : '点击开启航迹显示'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-50/80 active:scale-95 transition rounded-l-xl"
          >
            {showTracks && (displayedTracksCount > 0 || (isLiveRecording && showLiveRecording)) ? (
              <Route className="w-3.5 h-3.5 text-teal-600" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-sans">航迹</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                !showTracks
                  ? 'bg-slate-200 text-slate-600'
                  : displayedTracksCount === tracks.length && tracks.length > 0
                  ? 'bg-teal-100 text-teal-800'
                  : displayedTracksCount === 0 && !isLiveRecording
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {!showTracks ? '全关' : `${displayedTracksCount}/${tracks.length}`}
            </span>
          </button>

          {/* 分隔微线 */}
          <div className="w-[1px] h-4 bg-slate-200" />

          {/* 右端下拉展开按钮 (多选/单选) */}
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setOpenDropdown((prev) => (prev === 'tracks' ? 'none' : 'tracks'));
            }}
            id="btn-map-tracks-dropdown"
            title="下拉勾选单个或多个航迹"
            className={`px-1.5 py-1.5 hover:bg-slate-100 active:scale-90 transition cursor-pointer rounded-r-xl ${
              openDropdown === 'tracks' ? 'text-teal-600 bg-teal-50' : 'text-slate-500'
            }`}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openDropdown === 'tracks' ? 'rotate-180 text-teal-600' : ''
              }`}
            />
          </button>
        </div>

        {/* 航迹下拉选择面板 */}
        {openDropdown === 'tracks' && (
          <div className="absolute left-0 top-10 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-40 space-y-2.5 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Route className="w-3.5 h-3.5 text-teal-600" />
                <span>航迹显示筛选</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (已选 {selectedTrackIds.length} / 共 {tracks.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenDropdown('none')}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-[11px] font-medium pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllTracks}
                  className="px-2 py-0.8 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 transition cursor-pointer flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>全选</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllTracks}
                  className="px-2 py-0.8 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 transition cursor-pointer flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  <span>全不选</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleMasterTracks}
                className={`px-2 py-0.8 rounded font-bold transition cursor-pointer text-[10px] border ${
                  showTracks
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {showTracks ? '一键全关' : '一键开启'}
              </button>
            </div>

            {/* Special Item: Active Real-time Recording Track Toggle */}
            {isLiveRecording && onToggleShowLiveRecording && (
              <div
                onClick={() => {
                  soundService.playClick();
                  onToggleShowLiveRecording(!showLiveRecording);
                }}
                className={`flex items-center justify-between px-2 py-2 rounded-xl text-xs border transition cursor-pointer ${
                  showLiveRecording
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                      showLiveRecording
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {showLiveRecording && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <span>正在实时录制中航迹</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                  {liveRecordingPointCount} 点
                </span>
              </div>
            )}

            {/* Historical Tracks Checkbox List */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 divide-y divide-slate-50">
              {filteredTracks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {tracks.length === 0 ? '暂无保存的历史航迹文件' : '未找到匹配的航迹'}
                </div>
              ) : (
                filteredTracks.map((tk) => {
                  const isChecked = selectedTrackIds.includes(tk.id);
                  const trackColor = tk.color || '#0284c7';
                  return (
                    <div
                      key={tk.id}
                      onClick={() => handleToggleTrackItem(tk.id)}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isChecked
                          ? 'bg-teal-50/70 text-slate-900 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Custom styled checkbox */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                            isChecked
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Track color bar */}
                        <div
                          className="w-3 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: trackColor }}
                        />

                        {/* Name and stats */}
                        <div className="min-w-0 flex-1 truncate">
                          <div className="font-bold text-slate-900 truncate">{tk.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {tk.points.length} 点 | {tk.distance ? tk.distance.toFixed(1) : 0}m
                          </div>
                        </div>
                      </div>

                      {/* Right action: "仅选" shortcut for single-select */}
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnlyThisTrack(tk.id, e)}
                        title="仅选此航迹 (单选模式)"
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-teal-600 hover:text-white text-slate-500 border border-slate-200 transition opacity-0 group-hover:opacity-100 cursor-pointer shrink-0 ml-1"
                      >
                        仅选
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom info banner */}
            {!showTracks && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-[10px] text-amber-800 flex items-center gap-1">
                <EyeOff className="w-3 h-3 text-amber-600 shrink-0" />
                <span>当前航迹总开关已关闭，地图上所有航迹已被隐藏。</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
