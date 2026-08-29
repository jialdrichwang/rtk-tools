import React, { useState } from 'react';
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
  MapPin,
  Check,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface WaypointListScreenProps {
  onBack?: () => void;
  onNewPoint?: () => void;
  onAddPoint?: () => void;
  onSelectForStakeout?: (point: SurveyPoint) => void;
  onStakeoutPoint?: (point: SurveyPoint) => void;
}

export const WaypointListScreen: React.FC<WaypointListScreenProps> = ({
  onBack,
  onNewPoint,
  onAddPoint,
  onSelectForStakeout,
  onStakeoutPoint,
}) => {
  const { points, deletePoint, deletePoints, updatePoint } = useSurveyData();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);

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

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-800 overflow-hidden">
      {/* Search and Action Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
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
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建标定</span>
        </button>

        {selectedIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除({selectedIds.length})</span>
          </button>
        )}
      </div>

      {/* Table Header */}
      <div className="bg-slate-100/70 px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider grid grid-cols-12 items-center">
        <div className="col-span-1 flex items-center">
          <button onClick={handleSelectAll} className="cursor-pointer">
            {selectedIds.length === filtered.length && filtered.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
        <div className="col-span-3">点名 / 编码</div>
        <div className="col-span-4 text-right">北坐标 (X) / 高程</div>
        <div className="col-span-4 text-right">东坐标 (Y) / 放样</div>
      </div>

      {/* Point List Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            暂无点位数据，点击右上角【新建标定】采集点位
          </div>
        ) : (
          filtered.map((pt) => {
            const isSelected = selectedIds.includes(pt.id);
            return (
              <div
                key={pt.id}
                className={`px-3 py-2.5 grid grid-cols-12 items-center text-xs transition ${
                  isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="col-span-1 flex items-center">
                  <button
                    onClick={() => handleToggleSelect(pt.id)}
                    className="cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="col-span-3 overflow-hidden pr-1">
                  <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: pt.color || '#2563eb' }}
                    />
                    <span>{pt.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {pt.code || '无编码'}
                  </span>
                </div>

                <div className="col-span-4 text-right font-mono pr-2">
                  <div className="text-slate-800 font-semibold">{pt.x.toFixed(3)}</div>
                  <div className="text-[10px] text-emerald-700 font-medium">H: {pt.elevation.toFixed(3)}m</div>
                </div>

                <div className="col-span-4 text-right flex items-center justify-end gap-2 font-mono">
                  <div>
                    <div className="text-slate-800 font-semibold">{pt.y.toFixed(3)}</div>
                    <div className="text-[10px] text-slate-400 font-sans">{pt.coordSystem}</div>
                  </div>

                  {handleStakeout && (
                    <button
                      onClick={() => {
                        soundService.playClick();
                        handleStakeout(pt);
                      }}
                      title="放样此点"
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-md cursor-pointer ml-1 shadow-2xs"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer statistics */}
      <div className="bg-slate-50 border-t border-slate-200 px-3.5 py-2 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium">共计 {points.length} 个点位</span>
        <span className="font-mono">已选中 {selectedIds.length} 项</span>
      </div>
    </div>
  );
};
