import React, { useState, useRef } from 'react';
import {
  MapPin,
  Trees,
  Target,
  Maximize2,
  Ruler,
  Split,
  GitCommit,
  TrendingDown,
  FileSpreadsheet,
  Settings2,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface EngineeringSurveyScreenProps {
  onOpenPointCollect: () => void;
  onOpenDetailSurvey: () => void;
  onOpenPointStakeout: () => void;
  onOpenAreaMeasure: () => void;
  onOpenDistanceMeasure: () => void;
  onOpenEquidistantStakeout: () => void;
  onOpenLineStakeout: () => void;
  onOpenSlopeMeasure: () => void;
  onOpenSurveyRecords: () => void;
  onOpenUnitSettings: () => void;
}

type SurveyCategory = 'all' | 'collect' | 'stakeout' | 'measure' | 'manage';

export const EngineeringSurveyScreen: React.FC<EngineeringSurveyScreenProps> = ({
  onOpenPointCollect,
  onOpenDetailSurvey,
  onOpenPointStakeout,
  onOpenAreaMeasure,
  onOpenDistanceMeasure,
  onOpenEquidistantStakeout,
  onOpenLineStakeout,
  onOpenSlopeMeasure,
  onOpenSurveyRecords,
  onOpenUnitSettings,
}) => {
  const [activeCategory, setActiveCategory] = useState<SurveyCategory>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartScrollTopRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);

  const categories: { id: SurveyCategory; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'collect', label: '采点测图' },
    { id: 'stakeout', label: '放样测设' },
    { id: 'measure', label: '几何测算' },
    { id: 'manage', label: '台账配置' },
  ];

  const surveyTools = [
    {
      id: 'point_collect',
      category: 'collect',
      title: '点采集',
      desc: '平滑历元高精标定',
      badge: '采点',
      icon: MapPin,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      action: onOpenPointCollect,
    },
    {
      id: 'detail_survey',
      category: 'collect',
      title: '碎部测量',
      desc: '地物地貌快捷测绘',
      badge: '测图',
      icon: Trees,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      action: onOpenDetailSurvey,
    },
    {
      id: 'point_stakeout',
      category: 'stakeout',
      title: '点放样',
      desc: '目标点位雷达寻标',
      badge: '放样',
      icon: Target,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      action: onOpenPointStakeout,
    },
    {
      id: 'line_stakeout',
      category: 'stakeout',
      title: '直线放样',
      desc: '里程桩号与左/右偏距',
      badge: '定桩',
      icon: GitCommit,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      action: onOpenLineStakeout,
    },
    {
      id: 'equidistant_stakeout',
      category: 'stakeout',
      title: '等距放样',
      desc: '线段定距桩位放样',
      badge: '等距',
      icon: Split,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      action: onOpenEquidistantStakeout,
    },
    {
      id: 'area_measure',
      category: 'measure',
      title: '面积测量',
      desc: '地块边界与亩数计算',
      badge: '面积',
      icon: Maximize2,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      action: onOpenAreaMeasure,
    },
    {
      id: 'distance_measure',
      category: 'measure',
      title: '长度测量',
      desc: '平距/斜距/高差测定',
      badge: '测距',
      icon: Ruler,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      action: onOpenDistanceMeasure,
    },
    {
      id: 'slope_measure',
      category: 'measure',
      title: '坡度测量',
      desc: '坡度比/坡比/倾角',
      badge: '坡度',
      icon: TrendingDown,
      color: 'text-sky-600 bg-sky-50 border-sky-200',
      action: onOpenSlopeMeasure,
    },
    {
      id: 'survey_records',
      category: 'manage',
      title: '测量记录',
      desc: '外业成果流水台账',
      badge: '台账',
      icon: FileSpreadsheet,
      color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
      action: onOpenSurveyRecords,
    },
    {
      id: 'unit_settings',
      category: 'manage',
      title: '单位设置',
      desc: '角度/坐标/精度配置',
      badge: '参数',
      icon: Settings2,
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      action: onOpenUnitSettings,
    },
  ];

  const filteredTools =
    activeCategory === 'all'
      ? surveyTools
      : surveyTools.filter((t) => t.category === activeCategory);

  // Handle Horizontal Swipe to switch category
  const handleCategorySwipe = (direction: 'left' | 'right') => {
    const currentIndex = categories.findIndex((c) => c.id === activeCategory);
    if (direction === 'left' && currentIndex < categories.length - 1) {
      soundService.playClick();
      setActiveCategory(categories[currentIndex + 1].id);
    } else if (direction === 'right' && currentIndex > 0) {
      soundService.playClick();
      setActiveCategory(categories[currentIndex - 1].id);
    }
  };

  // Touch gesture & drag scroll handling (兼容 Android 7.0 WebView)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartScrollTopRef.current = containerRef.current?.scrollTop || 0;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !containerRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;

    // Vertical drag scrolling
    if (Math.abs(deltaY) > 6 && Math.abs(deltaY) >= Math.abs(deltaX)) {
      hasMovedRef.current = true;
      containerRef.current.scrollTop = touchStartScrollTopRef.current - deltaY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

      // Detect deliberate horizontal swipe gesture (> 45px, more horizontal than vertical)
      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          handleCategorySwipe('left');
        } else {
          handleCategorySwipe('right');
        }
      }
    }
  };

  // Mouse drag scrolling for desktop/simulator
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    touchStartYRef.current = e.clientY;
    touchStartScrollTopRef.current = containerRef.current?.scrollTop || 0;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaY = e.clientY - touchStartYRef.current;
    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
      containerRef.current.scrollTop = touchStartScrollTopRef.current - deltaY;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleToolClick = (toolAction: () => void) => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    soundService.playClick();
    toolAction();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 min-h-0 min-w-0 overflow-hidden select-none">
      {/* Top Header: Swipeable Category Tabs + View Mode Toggle */}
      <div className="shrink-0 p-3 pb-2 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          {/* Category Tabs (Horizontally Scrollable / Tap to Switch) */}
          <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x py-0.5 no-scrollbar flex-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  soundService.playClick();
                  setActiveCategory(c.id);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Grid / List Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => {
                soundService.playClick();
                setViewMode('grid');
              }}
              title="九宫格排列"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                soundService.playClick();
                setViewMode('list');
              }}
              title="列表排列"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gestures hint bar */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
          <span>左右滑动切换分类 · 上下滑动浏览功能</span>
          <span>共 {filteredTools.length} 项</span>
        </div>
      </div>

      {/* Scrollable / Swipeable Tools Area (支持触摸滑动与惯性滚动) */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 p-3 overflow-y-auto touch-scroll-y custom-vertical-slider min-h-0"
      >
        {viewMode === 'grid' ? (
          /* 3-Column Grid Mode (九宫格风格 - 100% Android 7.0 Flexbox 兼容) */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="nine-grid-container flex flex-wrap w-full">
              {filteredTools.map((t, idx) => {
                const Icon = t.icon;
                const isRightEdge = idx % 3 === 2;
                const totalRows = Math.ceil(filteredTools.length / 3);
                const currentRow = Math.floor(idx / 3);
                const isBottomRow = currentRow === totalRows - 1;

                return (
                  <button
                    key={t.id}
                    id={`btn-survey-${t.id}`}
                    onClick={() => handleToolClick(t.action)}
                    className={`nine-grid-cell p-3 sm:p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 active:bg-blue-50/50 transition duration-150 cursor-pointer min-h-[105px] group ${
                      !isRightEdge ? 'border-r border-slate-200/80' : ''
                    } ${!isBottomRow ? 'border-b border-slate-200/80' : ''}`}
                    style={{
                      width: '33.333333%',
                      flex: '0 0 33.333333%',
                      maxWidth: '33.333333%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border ${t.color} mb-1.5 group-hover:scale-105 transition-transform shadow-2xs`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 leading-snug">
                      {t.title}
                    </span>
                    <span className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Vertical Single-Column List Mode (带滑动) */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
            {filteredTools.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  id={`btn-survey-${t.id}`}
                  onClick={() => handleToolClick(t.action)}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 active:bg-blue-50/60 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${t.color} shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                        {t.desc}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                      {t.badge}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom spacer for smooth over-scrolling */}
        <div className="h-6" />
      </div>
    </div>
  );
};

