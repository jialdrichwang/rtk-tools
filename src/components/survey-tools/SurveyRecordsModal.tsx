import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { FileSpreadsheet, Trash2, X, FileDown, Search } from 'lucide-react';
import { downloadFile, exportPointsToCSV } from '../../utils/exportImport';

interface SurveyRecordsModalProps {
  onClose: () => void;
}

export const SurveyRecordsModal: React.FC<SurveyRecordsModalProps> = ({ onClose }) => {
  const { surveyLogs, clearSurveyLogs, points } = useSurveyData();
  const [search, setSearch] = useState('');

  const filteredLogs = surveyLogs.filter(
    (l) =>
      l.pointName.toLowerCase().includes(search.toLowerCase()) ||
      l.pointCode.toLowerCase().includes(search.toLowerCase()) ||
      l.time.includes(search)
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">外业测量流水记录台账 (Survey Records)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action / Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索点名、时间、编码..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => {
              const csv = exportPointsToCSV(points);
              downloadFile(csv, `RTK测量成果表_${Date.now()}.csv`, 'text/csv;charset=utf-8');
            }}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>导出成果CSV</span>
          </button>

          {surveyLogs.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('确定清空所有测量记录日志？')) {
                  clearSurveyLogs();
                }
              }}
              className="p-1.5 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-600 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              暂无测量流水记录，点采集与测量完成后自动登记在此
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase border-b border-slate-200 sticky top-0 font-sans font-semibold">
                <tr>
                  <th className="px-3 py-2">点名/编码</th>
                  <th className="px-3 py-2 text-right">北坐标 (X)</th>
                  <th className="px-3 py-2 text-right">东坐标 (Y)</th>
                  <th className="px-3 py-2 text-right">高程 (H)</th>
                  <th className="px-3 py-2 text-center">解状态</th>
                  <th className="px-3 py-2">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900">{log.pointName}</div>
                      <div className="text-[10px] text-slate-500">{log.pointCode}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">{log.x.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-slate-800">{log.y.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-bold">{log.h.toFixed(3)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        {log.solution}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-500 font-sans">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>总计: {filteredLogs.length} 条记录</span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
