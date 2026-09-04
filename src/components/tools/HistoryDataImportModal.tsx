import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  Database,
  Route,
  Map as MapIcon,
  Layers,
  FileText,
  Clock,
  Loader2,
  FolderOpen,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { offlineMapTileService } from '../../utils/offlineMapTileService';
import { fileStorageService, StoredFileInfo } from '../../utils/fileStorageService';
import { soundService } from '../../utils/sound';
import {
  parseImportPoints,
  parseTrackFromGPX,
  parseTrackFromKML,
} from '../../utils/exportImport';

interface HistoryDataImportModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export type ImportCategory = 'project' | 'point' | 'track' | 'map' | 'auto';

interface ParsedItem {
  type: 'project' | 'point' | 'track' | 'map';
  data: any;
  summary: string;
}

export const HistoryDataImportModal: React.FC<HistoryDataImportModalProps> = ({
  onClose,
}) => {
  const {
    currentProject,
    setCurrentProject,
    importPointsBatch,
    addTrack,
    addRoute,
  } = useSurveyData();

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<ImportCategory>('point');
  const [sourceType, setSourceType] = useState<'upload' | 'virtual_dir'>('upload');

  // Files in device virtual storage
  const [virtualFiles, setVirtualFiles] = useState<StoredFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // File loading state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string>('');
  const [fileRawContent, setFileRawContent] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chunk processing state (Low resource consumption engine)
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  // Cancellation and pause refs for async loop
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Load virtual files when virtual directory source is selected
  useEffect(() => {
    if (sourceType === 'virtual_dir') {
      loadVirtualDirectoryFiles();
    }
  }, [sourceType, selectedCategory]);

  const loadVirtualDirectoryFiles = async () => {
    setLoadingFiles(true);
    try {
      let targetDir: 'project' | 'point' | 'track' | 'mapdata' = 'point';
      if (selectedCategory === 'project') targetDir = 'project';
      else if (selectedCategory === 'point') targetDir = 'point';
      else if (selectedCategory === 'track') targetDir = 'track';
      else if (selectedCategory === 'map') targetDir = 'mapdata';

      const files = await fileStorageService.listFiles(targetDir);
      setVirtualFiles(files);
    } catch {
      setVirtualFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectVirtualFile = async (f: StoredFileInfo) => {
    soundService.playClick();
    setLoadedFileName(f.name);
    setIsAnalyzing(true);
    try {
      const content = await fileStorageService.readFile(f.folder, f.name);
      if (!content) {
        alert('无法读取该文件内容');
        setIsAnalyzing(false);
        return;
      }
      setFileRawContent(content);
      analyzeContent(content, f.name, selectedCategory);
    } catch (e: any) {
      alert(`读取失败: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundService.playClick();
    setLoadedFileName(file.name);
    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        alert('读取到空文件');
        setIsAnalyzing(false);
        return;
      }
      setFileRawContent(text);
      analyzeContent(text, file.name, selectedCategory);
      setIsAnalyzing(false);
    };
    reader.onerror = () => {
      alert('读取文件出错');
      setIsAnalyzing(false);
    };
    reader.readAsText(file);
  };

  // Content analyzer to classify and prepare parsedItems
  const analyzeContent = (text: string, filename: string, category: ImportCategory) => {
    const items: ParsedItem[] = [];
    const trimmed = text.trim();

    try {
      // Check if it's JSON
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const json = JSON.parse(trimmed);

        // 1. Project
        if (
          category === 'project' ||
          (category === 'auto' && json.coordSystem && (json.centralMeridian || json.name))
        ) {
          const proj = json.project || json;
          items.push({
            type: 'project',
            data: proj,
            summary: `工程信息: ${proj.name || '历史工程'} (${proj.coordSystem || 'CGCS2000'}, 中央子午线: ${proj.centralMeridian || 114}°)`,
          });
        }

        // 2. Points array in JSON
        if (
          category === 'point' ||
          (category === 'auto' && (Array.isArray(json) || Array.isArray(json.points)))
        ) {
          const pointList = Array.isArray(json) ? json : json.points || [];
          pointList.forEach((pt: any, i: number) => {
            items.push({
              type: 'point',
              data: pt,
              summary: `点位: ${pt.name || `P_${i + 1}`} (X:${pt.x ?? '-'}, Y:${pt.y ?? '-'})`,
            });
          });
        }

        // 3. Track in JSON
        if (
          category === 'track' ||
          (category === 'auto' && (json.points || json.tracks || json.format?.includes('TRACK')))
        ) {
          const tracksList = Array.isArray(json.tracks)
            ? json.tracks
            : json.points
            ? [json]
            : [];
          tracksList.forEach((tk: any, i: number) => {
            items.push({
              type: 'track',
              data: tk,
              summary: `航迹: ${tk.name || `航迹_${i + 1}`} (含 ${(tk.points || []).length} 个轨迹点)`,
            });
          });
        }

        // 4. Map Tilepack in JSON
        if (
          category === 'map' ||
          (category === 'auto' && (json.format === 'RTK_SURVEY_TILE_BUNDLE_V1' || json.tiles || json.regionName))
        ) {
          items.push({
            type: 'map',
            data: json,
            summary: `离线底图包: ${json.regionName || json.name || '底图包'} (瓦片数: ${json.tileCount || Object.keys(json.tiles || {}).length || 0})`,
          });
        }
      } else {
        // Not JSON: Text / XML / CASS / CSV / GPX / KML
        if (category === 'track' || (category === 'auto' && (trimmed.includes('<gpx') || trimmed.includes('<kml')))) {
          if (trimmed.includes('<gpx')) {
            const parsed = parseTrackFromGPX(trimmed);
            if (parsed) {
              items.push({
                type: 'track',
                data: parsed,
                summary: `GPX航迹: ${parsed.name} (${parsed.points?.length || 0}点)`,
              });
            }
          } else if (trimmed.includes('<kml')) {
            const parsed = parseTrackFromKML(trimmed);
            if (parsed) {
              items.push({
                type: 'track',
                data: parsed,
                summary: `KML航迹: ${parsed.name} (${parsed.points?.length || 0}点)`,
              });
            }
          }
        }

        // If not track, try parsing points (CSV, CASS, TXT)
        if (items.length === 0 && (category === 'point' || category === 'auto')) {
          const pts = parseImportPoints(trimmed);
          pts.forEach((pt, i) => {
            items.push({
              type: 'point',
              data: pt,
              summary: `点位: ${pt.name || `P_${i + 1}`} (X:${pt.x?.toFixed(2) ?? '-'}, Y:${pt.y?.toFixed(2) ?? '-'}, H:${pt.elevation?.toFixed(2) ?? '-'})`,
            });
          });
        }
      }
    } catch (e: any) {
      alert(`解析文件失败: ${e.message}`);
    }

    setParsedItems(items);
    setTotalCount(items.length);
    setCurrentIndex(0);
    setImportedCount(0);
    setErrorCount(0);
    setIsFinished(false);
    setImportLogs([`已解析文件【${filename}】，识别到 ${items.length} 条待导入数据项。`]);
  };

  // Start low-intensity chunked import with progress bar and pause control
  const startImport = async () => {
    if (parsedItems.length === 0) return;

    soundService.playClick();
    setIsProcessing(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;
    isProcessingRef.current = true;

    // Small batch size (e.g. 15 items per batch) to keep UI responsive and memory low
    const BATCH_SIZE = 15;
    let index = currentIndex;
    let success = importedCount;
    let errors = errorCount;

    setImportLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 开始执行低功耗分批导入 (每批 ${BATCH_SIZE} 条)...`,
    ]);

    while (index < parsedItems.length) {
      // Check for cancellation
      if (isCancelledRef.current) {
        setImportLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 导入已被用户中止。`]);
        break;
      }

      // Check for pause
      if (isPausedRef.current) {
        setImportLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ⏸️ 导入已暂停在第 ${index} 项，可随时点击【继续】。`,
        ]);
        setCurrentIndex(index);
        setImportedCount(success);
        setErrorCount(errors);
        setIsProcessing(false);
        return;
      }

      // Process current batch
      const batch = parsedItems.slice(index, index + BATCH_SIZE);
      const pointsToImport: any[] = [];

      for (const item of batch) {
        try {
          if (item.type === 'project') {
            // Update project settings
            setCurrentProject((prev) => ({
              ...prev,
              name: item.data.name || prev.name,
              coordSystem: item.data.coordSystem || prev.coordSystem,
              centralMeridian: item.data.centralMeridian || prev.centralMeridian,
            }));
            success++;
          } else if (item.type === 'point') {
            pointsToImport.push(item.data);
          } else if (item.type === 'track') {
            addTrack({
              id: `tk_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: item.data.name || `历史航迹_${Date.now()}`,
              points: item.data.points || [],
              distance: item.data.distance || 0,
              duration: item.data.duration || 0,
              startTime: item.data.startTime || new Date().toISOString(),
              endTime: item.data.endTime || new Date().toISOString(),
            });
            success++;
          } else if (item.type === 'map') {
            // Map tilepack package import
            const jsonStr = typeof item.data === 'string' ? item.data : JSON.stringify(item.data);
            await offlineMapTileService.importTileBundle(jsonStr);
            success++;
          }
        } catch {
          errors++;
        }
      }

      // Batch import points through context
      if (pointsToImport.length > 0) {
        const added = importPointsBatch(pointsToImport);
        success += added;
      }

      index += batch.length;
      setCurrentIndex(index);
      setImportedCount(success);
      setErrorCount(errors);

      // Add log entry every few batches to avoid log overflow
      if (index % (BATCH_SIZE * 2) === 0 || index >= parsedItems.length) {
        setImportLogs((prev) => [
          ...prev.slice(-40),
          `[${new Date().toLocaleTimeString()}] 已处理进度: ${index} / ${parsedItems.length} (${Math.round((index / parsedItems.length) * 100)}%)`,
        ]);
      }

      // Cooperative yielding (sleep 60ms) to ensure 60fps UI rendering and low CPU footprint
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    setIsProcessing(false);
    setIsFinished(true);
    soundService.playSuccess();
    setImportLogs((prev) => [
      ...prev,
      `🎉 [${new Date().toLocaleTimeString()}] 全部导入完成！成功入库: ${success} 项，异常: ${errors} 项。`,
    ]);
  };

  const handlePause = () => {
    soundService.playClick();
    setIsPaused(true);
    isPausedRef.current = true;
  };

  const handleResume = () => {
    soundService.playClick();
    setIsPaused(false);
    isPausedRef.current = false;
    startImport();
  };

  const handleCancel = () => {
    soundService.playClick();
    isCancelledRef.current = true;
    setIsProcessing(false);
    setIsPaused(false);
  };

  const handleReset = () => {
    soundService.playClick();
    setLoadedFileName('');
    setFileRawContent('');
    setParsedItems([]);
    setCurrentIndex(0);
    setTotalCount(0);
    setImportedCount(0);
    setErrorCount(0);
    setIsFinished(false);
    setImportLogs([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const progressPercent = totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">历史数据分类导入</h2>
              <p className="text-[10px] text-slate-500">
                支持分类导入 project / point / track / map，低强度平稳入库
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 1. Category selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>第一步：手动指定数据分类</span>
              <span className="text-[10px] font-normal text-slate-500">
                (请选择您即将导入的数据类型)
              </span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'point', label: '点库数据', icon: Database, color: 'text-blue-600' },
                { id: 'track', label: '航线航迹', icon: Route, color: 'text-teal-600' },
                { id: 'project', label: '工程信息', icon: FileText, color: 'text-indigo-600' },
                { id: 'map', label: '离线底图', icon: MapIcon, color: 'text-cyan-600' },
                { id: 'auto', label: '自动识别', icon: Layers, color: 'text-amber-600' },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    disabled={isProcessing}
                    onClick={() => {
                      soundService.playClick();
                      setSelectedCategory(cat.id as ImportCategory);
                      if (fileRawContent && loadedFileName) {
                        analyzeContent(fileRawContent, loadedFileName, cat.id as ImportCategory);
                      }
                    }}
                    className={`py-2 px-1 rounded-xl border text-center flex flex-col items-center gap-1 transition cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-500 text-amber-900 font-bold shadow-xs ring-1 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                    <span className="text-[11px] truncate w-full">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Source Type Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                第二步：选取数据文件
              </label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => setSourceType('upload')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    sourceType === 'upload' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  从设备上传/选取
                </button>
                <button
                  onClick={() => setSourceType('virtual_dir')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    sourceType === 'virtual_dir' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  从系统存储目录调入
                </button>
              </div>
            </div>

            {sourceType === 'upload' ? (
              <div
                onClick={() => {
                  soundService.playClick();
                  fileInputRef.current?.click();
                }}
                className="relative block rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-500 bg-amber-50/30 hover:bg-amber-50/70 p-4 flex flex-col items-center justify-center gap-2 text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs select-auto"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*,.csv,.txt,.dat,.json,.gpx,.kml,.tilepack,text/plain,text/csv,application/json"
                  onChange={handleFileUpload}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  disabled={isProcessing}
                  className="hidden"
                />
                <Upload className="w-7 h-7 text-amber-600" />
                <span className="text-slate-900 font-bold text-center block">
                  {loadedFileName ? `已选文件: ${loadedFileName} (点击更换)` : '选取历史数据文件 (.csv / .dat / .txt / .json / .gpx)'}
                </span>
                <span className="text-[10px] text-slate-500 font-normal text-center block">
                  支持格式: CASS DAT, CSV, TXT, GPX, KML, JSON, Tilepack
                </span>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={(e) => {
                    e.stopPropagation();
                    soundService.playClick();
                    fileInputRef.current?.click();
                  }}
                  className="mt-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>打开手机文件选择器</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span>当前浏览目录: <code className="font-mono text-slate-800">/com.rtkproject.files/{selectedCategory === 'map' ? 'mapdata' : selectedCategory}/</code></span>
                  <button
                    onClick={loadVirtualDirectoryFiles}
                    className="text-amber-700 hover:underline font-bold text-[10px] cursor-pointer"
                  >
                    刷新目录
                  </button>
                </div>
                {loadingFiles ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                    <span>正在检索存储文件...</span>
                  </div>
                ) : virtualFiles.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    该目录下暂无历史保存文件，可使用上方【从设备上传/选取】进行导入。
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                    {virtualFiles.map((f) => (
                      <div
                        key={f.name}
                        onClick={() => handleSelectVirtualFile(f)}
                        className={`p-2 px-3 flex items-center justify-between text-xs cursor-pointer hover:bg-amber-50/50 transition ${
                          loadedFileName === f.name ? 'bg-amber-50 font-bold text-amber-900' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {((f.size || 0) / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Progress Bar & Control Panel */}
          {parsedItems.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>低强度分批入库引擎</span>
                  </span>
                  <p className="text-[10px] text-slate-500">
                    已就绪: {totalCount} 项 | 成功: {importedCount} 项 | 失败: {errorCount} 项
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black font-mono text-amber-700">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Action Buttons: Play / Pause / Cancel */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {!isProcessing && !isFinished && (
                  <button
                    onClick={isPaused ? handleResume : startImport}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{isPaused ? '继续导入' : '开始低功耗分批导入'}</span>
                  </button>
                )}

                {isProcessing && (
                  <button
                    onClick={handlePause}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    <span>暂停导入</span>
                  </button>
                )}

                {isProcessing && (
                  <button
                    onClick={handleCancel}
                    className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Square className="w-3.5 h-3.5 fill-rose-700" />
                    <span>中止</span>
                  </button>
                )}

                {isFinished && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>重新选择</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. Import log console */}
          {importLogs.length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-700">实时入库日志：</span>
              <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[10px] space-y-1 max-h-32 overflow-y-auto border border-slate-800">
                {importLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Data Preview list */}
          {parsedItems.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>待导入数据项预览 (前6项)：</span>
                <span className="font-mono text-slate-500 text-[10px]">共 {parsedItems.length} 项</span>
              </div>
              <div className="text-[10px] font-mono text-slate-600 space-y-1 max-h-24 overflow-y-auto">
                {parsedItems.slice(0, 6).map((item, i) => (
                  <div key={i} className="truncate bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-amber-700 font-bold mr-1.5">[{item.type.toUpperCase()}]</span>
                    <span>{item.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
