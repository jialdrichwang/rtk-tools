import React, { useRef, useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import {
  FolderArchive,
  FileDown,
  FileUp,
  X,
  FileSpreadsheet,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Upload,
} from 'lucide-react';
import {
  downloadFile,
  exportPointsToCSV,
  exportPointsToCASS,
  exportPointsToKML,
  parseCSVToPoints,
  parseCASSToPoints,
} from '../../utils/exportImport';
import { soundService } from '../../utils/sound';
import { fileStorageService } from '../../utils/fileStorageService';

interface ExportImportModalProps {
  onClose: () => void;
  initialTab?: 'export' | 'import';
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  onClose,
  initialTab = 'export',
}) => {
  const { points, importPointsBatch, currentProject } = useSurveyData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importedPreview, setImportedPreview] = useState<any[]>([]);

  // Export CSV
  const handleExportCSV = async () => {
    soundService.playClick();
    const csv = exportPointsToCSV(points);
    const filename = `${currentProject.name}_点库坐标成果.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
    await fileStorageService.saveFile('point', filename, csv, 'text/csv;charset=utf-8').catch(() => {});
  };

  // Export CASS .DAT
  const handleExportCASS = async () => {
    soundService.playClick();
    const dat = exportPointsToCASS(points);
    const filename = `${currentProject.name}_南方CASS.dat`;
    downloadFile(dat, filename, 'text/plain;charset=utf-8');
    await fileStorageService.saveFile('point', filename, dat, 'text/plain;charset=utf-8').catch(() => {});
  };

  // Export KML
  const handleExportKML = async () => {
    soundService.playClick();
    const kml = exportPointsToKML(points);
    const filename = `${currentProject.name}_奥维与谷歌.kml`;
    downloadFile(kml, filename, 'application/vnd.google-earth.kml+xml');
    await fileStorageService.saveFile('point', filename, kml, 'application/vnd.google-earth.kml+xml').catch(() => {});
  };

  // Export TXT
  const handleExportTXT = async () => {
    soundService.playClick();
    const content = points.map((p) => `${p.name},${p.x.toFixed(4)},${p.y.toFixed(4)},${p.elevation.toFixed(4)},${p.code || ''}`).join('\r\n');
    const filename = `${currentProject.name}_点位坐标.txt`;
    downloadFile(content, filename, 'text/plain;charset=utf-8');
    await fileStorageService.saveFile('point', filename, content, 'text/plain;charset=utf-8').catch(() => {});
  };

  // File Import handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) {
          setImportStatus({ type: 'error', message: '读取到空文件' });
          return;
        }

        let parsed: any[] = [];
        if (file.name.endsWith('.dat') || file.name.endsWith('.txt')) {
          parsed = parseCASSToPoints(content, currentProject.coordSystem);
        } else {
          parsed = parseCSVToPoints(content, currentProject.coordSystem);
        }

        if (parsed.length > 0) {
          importPointsBatch(parsed);
          soundService.playSuccess();
          setImportedPreview(parsed.slice(0, 5));
          setImportStatus({
            type: 'success',
            message: `成功解析并导入 ${parsed.length} 个点位到当前点库！`,
          });
        } else {
          setImportStatus({
            type: 'error',
            message: '文件未识别到有效的坐标行，请检查文件格式（点名,X,Y,H 或 点名,,Y,X,H）。',
          });
        }
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: `导入失败: ${err.message || '文件解析错误'}`,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">成果文件导入与导出</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 p-1">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('export');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>点库导出到文件</span>
          </button>
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('import');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>坐标文件导入到点库</span>
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: Export */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  当前工程：<b className="text-blue-600">{currentProject.name}</b>
                </span>
                <span className="text-slate-500 font-mono">共 {points.length} 个测点</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleExportCSV}
                  className="p-3 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-400 rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer shadow-xs group text-center"
                >
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">标准 CSV 表格</span>
                  <span className="text-[10px] text-slate-500">Excel / WPS / 通用</span>
                </button>

                <button
                  onClick={handleExportCASS}
                  className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-400 rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer shadow-xs group text-center"
                >
                  <FileDown className="w-6 h-6 text-blue-600 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">南方 CASS .DAT</span>
                  <span className="text-[10px] text-slate-500">南方测绘/成图软件</span>
                </button>

                <button
                  onClick={handleExportKML}
                  className="p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-400 rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer shadow-xs group text-center"
                >
                  <MapPin className="w-6 h-6 text-amber-600 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">Google / 奥维 KML</span>
                  <span className="text-[10px] text-slate-500">卫星地图 / GIS图层</span>
                </button>

                <button
                  onClick={handleExportTXT}
                  className="p-3 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-400 rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer shadow-xs group text-center"
                >
                  <FileText className="w-6 h-6 text-purple-600 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">纯文本 TXT 坐标</span>
                  <span className="text-[10px] text-slate-500">点名,X,Y,H,编码</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                <div className="font-bold text-slate-700">导出格式说明：</div>
                <div>• 点击上方任意格式，即可直接生成并下载对应格式文件到设备。</div>
                <div>• 南方CASS格式支持直接在AutoCAD/CASS中通过“展野外测站点平面图”调入。</div>
              </div>
            </div>
          )}

          {/* TAB 2: Import */}
          {activeTab === 'import' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 block">
                选择外部成果文件 (.dat / .csv / .txt)
              </span>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.txt,.dat"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-slate-50 hover:bg-emerald-50/40 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-bold text-slate-700 cursor-pointer transition shadow-xs"
              >
                <FileUp className="w-6 h-6 text-emerald-600" />
                <span className="text-slate-900 mt-1">点击选取坐标文件导入</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  支持南方CASS (.dat), 标准CSV表格, TXT文本
                </span>
              </button>

              {importStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                    importStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {importStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              {importedPreview.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                  <div className="text-[11px] font-bold text-slate-700">导入点位预览 (前5条)：</div>
                  <div className="text-[10px] font-mono text-slate-600 space-y-0.5">
                    {importedPreview.map((pt, i) => (
                      <div key={i} className="truncate">
                        {pt.name}: X={pt.x?.toFixed(3)}, Y={pt.y?.toFixed(3)}, H={pt.elevation?.toFixed(3)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-blue-900">支持文件格式规范：</div>
                <div>1. <b>南方CASS DAT:</b> 点号,,Y坐标,X坐标,高程 (如 1,,500123.456,3345678.123,45.67)</div>
                <div>2. <b>标准CSV/TXT:</b> 点名,X,Y,H,编码 或 点名,北坐标,东坐标,高程</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
