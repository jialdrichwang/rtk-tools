import React, { useState, useRef, useEffect } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { SurveyPoint } from '../../types';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Navigation,
  CheckSquare,
  Square,
  FileDown,
  FileUp,
  MapPin,
  Check,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface WaypointListScreenProps {
  onBack?: () => void;
  onNewPoint?: () => void;
  onAddPoint?: () => void;
  onSelectForStakeout?: (point: SurveyPoint) => void;
  onStakeoutPoint?: (point: SurveyPoint) => void;
  onOpenImport?: () => void;
  onOpenExport?: () => void;
}

export const WaypointListScreen: React.FC<WaypointListScreenProps> = ({
  onBack,
  onNewPoint,
  onAddPoint,
  onSelectForStakeout,
  onStakeoutPoint,
  onOpenImport,
  onOpenExport,
}) => {
  const { points, deletePoint, deletePoints, updatePoint } = useSurveyData();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [swipedPointId, setSwipedPointId] = useState<string | null>(null);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const listContainerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartScrollTopRef = useRef(0);
  const isDraggingListRef = useRef(false);
  const currentTouchRowIdRef = useRef<string | null>(null);

  const handleAdd = onAddPoint || onNewPoint || (() => {});
  const handleStakeout = onStakeoutPoint || onSelectForStakeout;

  const filtered = points.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.desc && p.desc.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggleSelect = (id: string) => {
    soundService.playClick();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    soundService.playClick();
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`确定删除选中的 ${selectedIds.length} 个航点？`)) {
      deletePoints(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleDeleteSingle = (id: string) => {
    if (window.confirm('确定删除该航点？')) {
      deletePoint(id);
      if (swipedPointId === id) setSwipedPointId(null);
    }
  };

  const handleStartEdit = (pt: SurveyPoint) => {
    setEditingPoint(pt);
    setEditName(pt.name);
    setEditCode(pt.code);
    setEditDesc(pt.desc || '');
  };

  const handleSaveEdit = () => {
    if (!editingPoint) return;
    updatePoint(editingPoint.id, {
      name: editName.trim() || editingPoint.name,
      code: editCode.trim(),
      desc: editDesc.trim(),
    });
    setEditingPoint(null);
    soundService.playSuccess();
  };

  // Row swipe gesture tracking for revealing quick actions (放样/编辑/删除)
  const handleRowTouchStart = (ptId: string, e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartScrollTopRef.current = listContainerRef.current?.scrollTop || 0;
    currentTouchRowIdRef.current = ptId;
    isDraggingListRef.current = true;
  };

  const handleRowTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingListRef.current || e.touches.length !== 1) return;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    const deltaX = e.touches[0].clientX - touchStartXRef.current;

    // If vertical scroll, scroll list
    if (Math.abs(deltaY) > 6 && Math.abs(deltaY) > Math.abs(deltaX) && listContainerRef.current) {
      listContainerRef.current.scrollTop = touchStartScrollTopRef.current - deltaY;
    }
  };

  const handleRowTouchEnd = (ptId: string, e: React.TouchEvent) => {
    if (!isDraggingListRef.current) return;
    isDraggingListRef.current = false;

    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

      // Swipe Left (> 40px, more horizontal than vertical) -> Reveal actions
      if (deltaX < -40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        setSwipedPointId(ptId);
      }
      // Swipe Right (> 40px) -> Close actions
      else if (deltaX > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        if (swipedPointId === ptId) {
          setSwipedPointId(null);
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-800 min-h-0 min-w-0 overflow-hidden select-none">
      {/* Search and Action Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索点名、编码或描述..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <button
          onClick={handleAdd}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>标定</span>
        </button>

        {onOpenImport && (
          <button
            onClick={() => {
              soundService.playClick();
              onOpenImport();
            }}
            title="导入外部坐标文件(CASS/CSV/TXT)"
            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-2xs cursor-pointer shrink-0"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>导入</span>
          </button>
        )}

        {onOpenExport && (
          <button
            onClick={() => {
              soundService.playClick();
              onOpenExport();
            }}
            title="导出点库成果(CASS/CSV/KML/TXT)"
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-2xs cursor-pointer shrink-0"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>导出</span>
          </button>
        )}

        {selectedIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xs cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除({selectedIds.length})</span>
          </button>
        )}
      </div>

      {/* Swipe & Gesture Hint Ribbon */}
      <div className="bg-blue-50/70 border-b border-blue-100 px-3 py-1 flex items-center justify-between text-[10px] text-blue-700 shrink-0">
        <span className="flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3 text-blue-600" />
          <span>支持左右滑动查看全坐标，单行向左滑动快捷放样与删除</span>
        </span>
        <span className="font-medium">共 {filtered.length} 点</span>
      </div>

      {/* Horizontal & Vertical Scrollable Table Area (100% Android 7.0 Flexbox Compatible) */}
      <div className="flex-1 min-h-0 overflow-x-auto touch-scroll-x flex flex-col">
        {/* Table Minimum Width Container to guarantee clean columns without wrapping */}
        <div className="min-w-[460px] flex-1 flex flex-col">
          {/* Table Header (Flexbox Android 7.0 Compatible) */}
          <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center shrink-0">
            <div className="w-8 shrink-0 flex items-center justify-center">
              <button onClick={handleSelectAll} className="cursor-pointer">
                {selectedIds.length === filtered.length && filtered.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
            <div className="flex-1 min-w-[100px] pl-2">点名 / 编码</div>
            <div className="w-28 shrink-0 text-right pr-3">北坐标 (X) / 高程</div>
            <div className="w-32 shrink-0 text-right pr-2">东坐标 (Y) / 操作</div>
          </div>

          {/* Point List Rows (支持上下滑动与触摸手势) */}
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto touch-scroll-y custom-vertical-slider divide-y divide-slate-100"
          >
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                暂无点位数据，点击右上角【标定】新建点位
              </div>
            ) : (
              filtered.map((pt) => {
                const isSelected = selectedIds.includes(pt.id);
                const isSwiped = swipedPointId === pt.id;

                return (
                  <div
                    key={pt.id}
                    onTouchStart={(e) => handleRowTouchStart(pt.id, e)}
                    onTouchMove={handleRowTouchMove}
                    onTouchEnd={(e) => handleRowTouchEnd(pt.id, e)}
                    className={`relative overflow-hidden transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Main Row Content */}
                    <div
                      className={`px-3 py-2.5 flex items-center text-xs transition-transform duration-200 ease-out ${
                        isSwiped ? '-translate-x-32' : 'translate-x-0'
                      }`}
                    >
                      {/* Select checkbox */}
                      <div className="w-8 shrink-0 flex items-center justify-center">
                        <button
                          onClick={() => handleToggleSelect(pt.id)}
                          className="cursor-pointer p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>

                      {/* Name & Code */}
                      <div
                        className="flex-1 min-w-[100px] pl-2 cursor-pointer"
                        onClick={() => handleStartEdit(pt)}
                      >
                        <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: pt.color || '#2563eb' }}
                          />
                          <span className="text-sm">{pt.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {pt.code ? `编码: ${pt.code}` : '无编码'}
                          {pt.desc && ` · ${pt.desc}`}
                        </div>
                      </div>

                      {/* North (X) & Elevation (H) */}
                      <div className="w-28 shrink-0 text-right font-mono pr-3">
                        <div className="text-slate-800 font-semibold">{pt.x.toFixed(3)}</div>
                        <div className="text-[10px] text-emerald-700 font-medium">H: {pt.elevation.toFixed(3)}m</div>
                      </div>

                      {/* East (Y) & Quick Action */}
                      <div className="w-32 shrink-0 text-right flex items-center justify-end gap-1.5 font-mono pr-1">
                        <div>
                          <div className="text-slate-800 font-semibold">{pt.y.toFixed(3)}</div>
                          <div className="text-[9.5px] text-slate-400 font-sans">{pt.coordSystem}</div>
                        </div>

                        {handleStakeout && (
                          <button
                            onClick={() => {
                              soundService.playClick();
                              handleStakeout(pt);
                            }}
                            title="快速放样此点"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg cursor-pointer shrink-0 shadow-2xs active:scale-95 transition"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Swiped Row Action Drawer (向左滑动展开的快捷按钮) */}
                    {isSwiped && (
                      <div className="absolute top-0 right-0 bottom-0 w-32 flex items-center bg-slate-800 text-white z-10">
                        {handleStakeout && (
                          <button
                            onClick={() => {
                              soundService.playClick();
                              handleStakeout(pt);
                            }}
                            className="flex-1 h-full bg-blue-600 hover:bg-blue-700 flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer"
                          >
                            <Navigation className="w-4 h-4 mb-0.5" />
                            <span>放样</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(pt)}
                          className="flex-1 h-full bg-slate-600 hover:bg-slate-700 flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 mb-0.5" />
                          <span>编辑</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(pt.id)}
                          className="flex-1 h-full bg-rose-600 hover:bg-rose-700 flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mb-0.5" />
                          <span>删除</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Edit Point Modal Dialog */}
      {editingPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">编辑航点信息</h3>
              <button
                onClick={() => setEditingPoint(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-2.5 text-xs">
              <div>
                <label className="text-slate-500 font-medium">点位名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-500 font-medium">点位编码</label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="如: JZ01, SP02"
                  className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-500 font-medium">特征描述</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="如: 围墙转角、控制桩"
                  className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-600 space-y-0.5 border border-slate-200/80">
                <div>X: {editingPoint.x.toFixed(4)}</div>
                <div>Y: {editingPoint.y.toFixed(4)}</div>
                <div>H: {editingPoint.elevation.toFixed(4)} m</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingPoint(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer statistics */}
      <div className="bg-slate-50 border-t border-slate-200 px-3.5 py-2 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <span className="font-medium">共计 {points.length} 个点位</span>
        <span className="font-mono">已选中 {selectedIds.length} 项</span>
      </div>
    </div>
  );
};

