import React from 'react';
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
  const surveyTools = [
    {
      id: 'point_collect',
      title: '点采集',
      desc: '平滑历元高精标定',
      icon: MapPin,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      action: onOpenPointCollect,
    },
    {
      id: 'detail_survey',
      title: '碎部测量',
      desc: '地物地貌快捷测绘',
      icon: Trees,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      action: onOpenDetailSurvey,
    },
    {
      id: 'point_stakeout',
      title: '点放样',
      desc: '目标点位雷达寻标',
      icon: Target,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      action: onOpenPointStakeout,
    },
    {
      id: 'equidistant_stakeout',
      title: '等距放样',
      desc: '线段定距桩位放样',
      icon: Split,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      action: onOpenEquidistantStakeout,
    },
    {
      id: 'line_stakeout',
      title: '直线放样',
      desc: '里程桩号与左/右偏距',
      icon: GitCommit,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      action: onOpenLineStakeout,
    },
    {
      id: 'area_measure',
      title: '面积测量',
      desc: '地块边界与亩数计算',
      icon: Maximize2,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      action: onOpenAreaMeasure,
    },
    {
      id: 'distance_measure',
      title: '长度测量',
      desc: '平距/斜距/高差测定',
      icon: Ruler,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      action: onOpenDistanceMeasure,
    },
    {
      id: 'slope_measure',
      title: '坡度测量',
      desc: '坡度比/坡比/倾角',
      icon: TrendingDown,
      color: 'text-sky-600 bg-sky-50 border-sky-200',
      action: onOpenSlopeMeasure,
    },
    {
      id: 'survey_records',
      title: '测量记录',
      desc: '外业成果流水台账',
      icon: FileSpreadsheet,
      color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
      action: onOpenSurveyRecords,
    },
    {
      id: 'unit_settings',
      title: '单位设置',
      desc: '角度/坐标/精度配置',
      icon: Settings2,
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      action: onOpenUnitSettings,
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 p-3.5 overflow-y-auto">
      {/* 10 Specialized Survey Tools Grid (Compact 1/2 Area) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {surveyTools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              id={`btn-survey-${t.id}`}
              onClick={() => {
                soundService.playClick();
                t.action();
              }}
              className="bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-blue-400 rounded-xl p-2 flex flex-col items-center justify-center text-center transition active:scale-95 shadow-2xs group cursor-pointer min-h-[66px]"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${t.color} mb-1 group-hover:scale-105 transition-transform shadow-2xs`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 group-hover:text-blue-600 leading-tight">
                {t.title}
              </span>
              <span className="text-[9px] text-slate-500 mt-0.5 line-clamp-1 scale-95">
                {t.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
