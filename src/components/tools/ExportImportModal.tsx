import React, { useRef, useState, useEffect } from 'react';
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
  Copy,
  Check,
  ClipboardPaste,
} from 'lucide-react';
import {
  downloadFile,
  exportPointsToCSV,
  exportPointsToCASS,
  exportPointsToKML,
  exportPointsToTXT,
  parseImportPoints,
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
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [manualText, setManualText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importedPreview, setImportedPreview] = useState<any[]>([]);
  const [lastExport, setLastExport] = useState<{
    filename: string;
    content: string;
    count: number;
    path: string;
    copied?: boolean;
  } | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleExportFinished = async (content: string, filename: string, mimeType: string) => {
    downloadFile(content, filename, mimeType, 'points');
    await fileStorageService.saveFile('point', filename, content, mimeType).catch(() => {});
    setLastExport({
      filename,
      content,
      count: points.length,
      path: `/storage/emulated/0/com.rtkproject.files/point/${filename}`,
    });
  };

  // Export CSV
  const handleExportCSV = async () => {
    soundService.playClick();
    const csv = exportPointsToCSV(points);
    const filename = `${currentProject.name}_点库坐标成果.csv`;
    await handleExportFinished(csv, filename, 'text/csv;charset=utf-8');
  };

  // Export CASS .DAT
  const handleExportCASS = async () => {
    soundService.playClick();
    const dat = exportPointsToCASS(points);
    const filename = `${currentProject.name}_南方CASS.dat`;
    await handleExportFinished(dat, filename, 'text/plain;charset=utf-8');
  };

  // Export KML
  const handleExportKML = async () => {
    soundService.playClick();
    const kml = exportPointsToKML(points, currentProject.name);
    const filename = `${currentProject.name}_奥维与谷歌.kml`;
    await handleExportFinished(kml, filename, 'application/vnd.google-earth.kml+xml');
  };

  // Export TXT
  const handleExportTXT = async () => {
    soundService.playClick();
    const content = exportPointsToTXT(points);
    const filename = `${currentProject.name}_点位坐标.txt`;
    await handleExportFinished(content, filename, 'text/plain;charset=utf-8');
  };

  const handleCopyExportText = () => {
    if (!lastExport) return;
    navigator.clipboard.writeText(lastExport.content);
    soundService.playSuccess();
    setLastExport((prev) => (prev ? { ...prev, copied: true } : null));
    setTimeout(() => {
      setLastExport((prev) => (prev ? { ...prev, copied: false } : null));
    }, 2500);
  };

  // Execute Import
  const executeImport = (text: string, sourceLabel: string) => {
    try {
      const parsed = parseImportPoints(text);
      if (parsed.length > 0) {
        const added = importPointsBatch(parsed);
        soundService.playSuccess();
        setImportedPreview(parsed.slice(0, 5));
        setImportStatus({
          type: 'success',
          message: `从【${sourceLabel}】成功解析并导入 ${added} 个点位到当前点库！`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: '未识别到有效的坐标行，请检查格式（如: 点名,X,Y,H 或 点名,,Y,X,H）。',
        });
      }
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `导入失败: ${err.message || '文件解析错误'}`,
      });
    }
  };

  // File Import handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setImportStatus({ type: 'error', message: '读取到空文件' });
        return;
      }
      executeImport(content, file.name);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleManualTextImport = () => {
    if (!manualText.trim()) {
      setImportStatus({ type: 'error', message: '请先粘贴或输入坐标文本' });
      return;
    }
    executeImport(manualText, '手动输入文本');
  };

  // 突破 WebView 限制：一键从剪贴板读取
  const handleReadFromClipboard = async () => {
    soundService.playClick();
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setManualText(text);
          executeImport(text, '系统剪贴板');
          return;
        }
      }
      setImportMode('text');
      setImportStatus({
        type: 'error',
        message: '剪贴板为空或系统权限限制，请切换至下方“直接粘贴文本”长按粘贴即可。',
      });
    } catch (e) {
      setImportMode('text');
      setImportStatus({
        type: 'error',
        message: '浏览器未授予剪贴板读取权限，已自动为您打开文本框，请在输入框内长按粘贴。',
      });
    }
  };

  // 载入工程测绘样板数据
  const handleLoadSampleData = () => {
    soundService.playSuccess();
    const sample = `DK1,3389120.450,512340.670,42.350,控制点
DK2,3389165.890,512388.120,43.120,控制点
K0+000,3389200.000,512400.000,43.500,放样起点
K0+020,3389218.790,512406.840,43.850,放样桩
K0+040,3389237.580,512413.680,44.200,放样桩
J1,3389280.120,512430.500,45.000,界址点
J2,3389310.450,512410.200,45.300,界址点
J3,3389295.600,512370.800,44.900,界址点`;
    setManualText(sample);
    executeImport(sample, '工程测量示范样板');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
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
            <span>点库成果导出</span>
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

        <div className="p-4 space-y-4 overflow-y-auto">
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
                  <span className="text-[10px] text-slate-500">AutoCAD / CASS成图</span>
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

              {lastExport && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      已成功导出 {lastExport.count} 个坐标成果！
                    </span>
                    <button
                      onClick={handleCopyExportText}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      {lastExport.copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>已复制到剪贴板</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>复制成果文本</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-emerald-800 font-mono break-all">
                    文件已保存至: <span className="font-bold">{lastExport.path}</span>
                  </div>
                  <div className="bg-white/90 border border-emerald-200 rounded-xl p-2 font-mono text-[10px] text-slate-700 max-h-24 overflow-y-auto whitespace-pre">
                    {lastExport.content.split('\n').slice(0, 6).join('\n')}
                    {lastExport.content.split('\n').length > 6 && '\n... (后续行已省略)'}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                <div className="font-bold text-slate-700">导出说明：</div>
                <div>• 点击上方任意格式，自动下载并持久化镜像至手机 <code>/com.rtkproject.files/point/</code> 目录。</div>
                <div>• 如浏览器拦截自动下载，可直接点击“复制成果文本”并在其它软件中粘贴使用。</div>
              </div>
            </div>
          )}

          {/* TAB 2: Import */}
          {activeTab === 'import' && (
            <div className="space-y-3">
              {/* 突破 WebView 限制的快速免选文件通道 */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <ClipboardPaste className="w-4 h-4 text-emerald-600" />
                    <span>免文件选择器 · 快速穿透导入</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    突破WebView限制
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  在微信、QQ或文件管理器中复制坐标内容后，点击下方按钮即可一键读取入库：
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleReadFromClipboard}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>一键从剪贴板读取</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleData}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <span>载入工程示范样板</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-800">
                  常规文件导入方式
                </span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    onClick={() => setImportMode('file')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      importMode === 'file' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    文件选取/拖拽
                  </button>
                  <button
                    onClick={() => setImportMode('text')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      importMode === 'text' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    直接粘贴文本
                  </button>
                </div>
              </div>

              {importMode === 'file' ? (
                <div className="space-y-2">
                  <div
                    className="relative block rounded-2xl border-2 border-dashed border-emerald-400 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 p-4 flex flex-col items-center justify-center gap-2 text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs select-auto overflow-hidden group"
                  >
                    {/* Direct full-card native touch target without display:none */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      accept="*/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                      style={{ fontSize: '100px' }}
                    />
                    <FileUp className="w-7 h-7 text-emerald-600 pointer-events-none group-hover:scale-110 transition-transform" />
                    <span className="text-slate-900 font-bold text-center block pointer-events-none">选取坐标成果文件 (.dat / .csv / .txt / .json)</span>
                    <span className="text-[10px] text-slate-500 font-normal text-center block pointer-events-none">
                      支持南方CASS (.dat), 标准CSV表格, TXT文本, JSON
                    </span>
                    <div className="mt-1 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 pointer-events-none">
                      <FileUp className="w-4 h-4" />
                      <span>打开手机文件选择器</span>
                    </div>
                  </div>

                  {/* Visible native file picker fallback */}
                  <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
                    <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>备用：系统原生选择框 (强兼容模式)</span>
                      <span className="text-[10px] text-emerald-700">直接调取系统组件</span>
                    </div>
                    <input
                      type="file"
                      accept="*/*"
                      onChange={handleFileChange}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    rows={5}
                    placeholder="在此粘贴坐标文本，支持下列格式：&#10;1,3378120.500,500120.300,45.200,JC1&#10;或 南方CASS格式:&#10;1,,500120.300,3378120.500,45.200"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <button
                    onClick={handleManualTextImport}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>解析并导入输入的坐标文本</span>
                  </button>
                </div>
              )}

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
                <div>3. <b>经纬度WGS84:</b> 点名,纬度Lat,经度Lon,高程 (自动转为高斯平面X/Y)</div>
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
