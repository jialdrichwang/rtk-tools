import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileCode,
  FileUp,
  Download,
  Copy,
  Check,
  RotateCw,
  Route,
  Layers,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { SurveyTrack } from '../../types';
import { useSurveyData } from '../../context/SurveyDataContext';
import { soundService } from '../../utils/sound';
import { fileStorageService } from '../../utils/fileStorageService';
import {
  exportTrackToKML,
  exportTrackToGPX,
  exportTrackToCSV,
  exportTrackToDAT,
  exportTrackToTXT,
  parseTrackFromGPX,
  parseTrackFromKML,
  parseImportPoints,
  downloadFile,
  TrackExportFormat,
  convertTrackToFormat,
} from '../../utils/exportImport';

interface TrackFileConvertModalProps {
  isOpen?: boolean;
  onClose: () => void;
  initialTrack?: SurveyTrack | null;
}

export const TrackFileConvertModal: React.FC<TrackFileConvertModalProps> = ({
  onClose,
  initialTrack,
}) => {
  const { tracks, addTrack } = useSurveyData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Source selection: 'existing_track' | 'external_file' | 'text_paste'
  const [sourceMode, setSourceMode] = useState<'existing_track' | 'external_file' | 'text_paste'>(
    initialTrack ? 'existing_track' : 'external_file'
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    initialTrack ? initialTrack.id : tracks[0]?.id || ''
  );
  const [targetFormat, setTargetFormat] = useState<TrackExportFormat>('kml');

  // Converted track object
  const [currentTrack, setCurrentTrack] = useState<SurveyTrack | null>(initialTrack || null);
  const [convertedText, setConvertedText] = useState<string>('');
  const [convertedFilename, setConvertedFilename] = useState<string>('');
  const [convertedMime, setConvertedMime] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Text paste input
  const [rawTextInput, setRawTextInput] = useState('');

  // Update track when existing track selection changes
  useEffect(() => {
    if (sourceMode === 'existing_track' && selectedTrackId) {
      const found = tracks.find((t) => t.id === selectedTrackId);
      if (found) {
        setCurrentTrack(found);
        doConvert(found, targetFormat);
      }
    }
  }, [sourceMode, selectedTrackId, targetFormat]);

  // Execute format conversion
  const doConvert = (track: SurveyTrack, format: TrackExportFormat) => {
    try {
      const res = convertTrackToFormat(track, format);
      setConvertedText(res.content);
      setConvertedFilename(res.filename);
      setConvertedMime(res.mimeType);
      setStatusMessage({
        type: 'success',
        text: `已成功转换为【${format.toUpperCase()}】格式，包含 ${track.points.length} 个航迹点。`,
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `转换失败: ${e.message}`,
      });
    }
  };

  // Handle external file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundService.playClick();
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setStatusMessage({ type: 'error', text: '文件内容为空' });
        return;
      }
      parseRawTextToTrack(text, file.name.replace(/\.[^/.]+$/, ''));
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handlePasteParse = () => {
    if (!rawTextInput.trim()) {
      setStatusMessage({ type: 'error', text: '请先输入或粘贴文本内容' });
      return;
    }
    parseRawTextToTrack(rawTextInput, `粘贴航迹_${new Date().toLocaleTimeString()}`);
  };

  const parseRawTextToTrack = (text: string, baseName: string) => {
    try {
      let parsedTrack: Partial<SurveyTrack> | null = null;
      if (text.includes('<gpx')) {
        parsedTrack = parseTrackFromGPX(text);
      } else if (text.includes('<kml')) {
        parsedTrack = parseTrackFromKML(text);
      } else {
        // Try parsing coordinates as points and create a track
        const pts = parseImportPoints(text);
        if (pts.length > 0) {
          const trackPoints = pts.map((p, idx) => ({
            lat: p.lat || 30.624,
            lon: p.lon || 114.267,
            elevation: p.elevation || 0,
            time: new Date(Date.now() + idx * 1000).toISOString(),
            speed: 0,
          }));
          parsedTrack = {
            name: baseName,
            points: trackPoints,
            distance: 0,
            duration: trackPoints.length,
            startTime: trackPoints[0]?.time,
            endTime: trackPoints[trackPoints.length - 1]?.time,
          };
        }
      }

      if (parsedTrack && parsedTrack.points && parsedTrack.points.length > 0) {
        const fullTrack: SurveyTrack = {
          id: `tk_conv_${Date.now()}`,
          name: parsedTrack.name || baseName,
          points: parsedTrack.points,
          distance: parsedTrack.distance || 0,
          duration: parsedTrack.duration || 0,
          startTime: parsedTrack.startTime || new Date().toISOString(),
          endTime: parsedTrack.endTime || new Date().toISOString(),
        };
        setCurrentTrack(fullTrack);
        doConvert(fullTrack, targetFormat);
        soundService.playSuccess();
      } else {
        setStatusMessage({
          type: 'error',
          text: '未能在文件中识别出有效的航迹轨迹点 (需含经纬度/坐标点)。',
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `解析出错: ${e.message}`,
      });
    }
  };

  // Download converted file
  const handleDownload = async () => {
    if (!convertedText || !convertedFilename) return;
    soundService.playClick();
    downloadFile(convertedText, convertedFilename, convertedMime, 'tracks');
    // Save to virtual storage
    await fileStorageService.saveFile('track', convertedFilename, convertedText, convertedMime).catch(() => {});
    setStatusMessage({
      type: 'success',
      text: `已下载并保存至: /storage/emulated/0/com.rtkproject.files/track/${convertedFilename}`,
    });
  };

  // Copy converted text to clipboard
  const handleCopy = () => {
    if (!convertedText) return;
    navigator.clipboard.writeText(convertedText);
    soundService.playSuccess();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Direct import into project tracks
  const handleImportToProject = () => {
    if (!currentTrack) return;
    soundService.playClick();
    addTrack(currentTrack);
    soundService.playSuccess();
    setStatusMessage({
      type: 'success',
      text: `已成功将航迹【${currentTrack.name}】加入当前工程航迹库，可在地图中直接查看！`,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
              <RotateCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">航线与航迹文件格式转换</h2>
              <p className="text-[10px] text-slate-500">
                支持 KML / GPX / CSV / CASS .DAT / TXT 互相转换与无缝调入
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

        {/* Content */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* 1. Source selection tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              第一步：选择源数据
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => {
                  soundService.playClick();
                  setSourceMode('external_file');
                }}
                className={`py-1.5 rounded-lg transition cursor-pointer text-center ${
                  sourceMode === 'external_file' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                选取外部文件
              </button>
              <button
                onClick={() => {
                  soundService.playClick();
                  setSourceMode('existing_track');
                }}
                className={`py-1.5 rounded-lg transition cursor-pointer text-center ${
                  sourceMode === 'existing_track' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                从当前工程航迹
              </button>
              <button
                onClick={() => {
                  soundService.playClick();
                  setSourceMode('text_paste');
                }}
                className={`py-1.5 rounded-lg transition cursor-pointer text-center ${
                  sourceMode === 'text_paste' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                直接粘贴代码
              </button>
            </div>
          </div>

          {/* Source specific controls */}
          {sourceMode === 'external_file' && (
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-300 rounded-2xl p-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-teal-950 block">免调文件选择器 · 剪贴板快速解析</span>
                  <span className="text-[10px] text-slate-500">直接读取剪贴板中的 GPX / KML / CSV 文本</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    soundService.playClick();
                    try {
                      if (navigator.clipboard && navigator.clipboard.readText) {
                        const text = await navigator.clipboard.readText();
                        if (text && text.trim()) {
                          parseRawTextToTrack(text, `剪贴板航迹_${new Date().toLocaleTimeString()}`);
                          return;
                        }
                      }
                      setSourceMode('text_paste');
                      setStatusMessage({ type: 'error', text: '剪贴板为空，已为您打开文本框长按粘贴。' });
                    } catch {
                      setSourceMode('text_paste');
                      setStatusMessage({ type: 'error', text: '无法读取剪贴板，请长按粘贴代码。' });
                    }
                  }}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition"
                >
                  读取剪贴板
                </button>
              </div>

              <div
                className="relative block rounded-2xl border-2 border-dashed border-teal-400 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/70 p-4 flex flex-col items-center justify-center gap-2 text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs select-auto overflow-hidden group"
              >
                {/* Direct full-card native touch target without display:none */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  onChange={handleFileUpload}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                  style={{ fontSize: '100px' }}
                />
                <FileUp className="w-7 h-7 text-teal-600 pointer-events-none group-hover:scale-110 transition-transform" />
                <span className="text-slate-900 font-bold text-center block pointer-events-none">
                  {currentTrack ? `已载入航迹: ${currentTrack.name} (含 ${currentTrack.points.length} 点)` : '选取航线/航迹文件 (.kml / .gpx / .csv / .dat)'}
                </span>
                <span className="text-[10px] text-slate-500 font-normal text-center block pointer-events-none">
                  支持 Google Earth/奥维 (.kml), GPX (.gpx), CSV, 南方CASS (.dat)
                </span>
                <div className="mt-1 px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 pointer-events-none">
                  <FileUp className="w-4 h-4" />
                  <span>打开手机文件选择器</span>
                </div>
              </div>

              {/* Visible native file picker fallback */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>备用：系统原生选择框 (强兼容模式)</span>
                  <span className="text-[10px] text-teal-700">直接调取系统组件</span>
                </div>
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleFileUpload}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                />
              </div>
            </div>
          )}

          {sourceMode === 'existing_track' && (
            <div className="space-y-1">
              <span className="text-[11px] text-slate-600">选择要转换的已记录航迹：</span>
              {tracks.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  当前工程暂无记录的航迹，请使用【选取外部文件】或在地图录制航迹。
                </div>
              ) : (
                <select
                  value={selectedTrackId}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (含 {t.points.length} 点, 累计 {t.distance}m)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {sourceMode === 'text_paste' && (
            <div className="space-y-1.5">
              <textarea
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                rows={4}
                placeholder="粘贴 KML / GPX XML代码，或每行一个经纬度坐标（Lon,Lat,Alt）..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handlePasteParse}
                className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs"
              >
                解析并转换粘贴的内容
              </button>
            </div>
          )}

          {/* 2. Target Format selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              第二步：选择目标转换格式
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'kml', label: 'KML', sub: '奥维/Google' },
                { id: 'gpx', label: 'GPX', sub: '通用GPS' },
                { id: 'csv', label: 'CSV', sub: '表格' },
                { id: 'cass_dat', label: 'CASS', sub: '.DAT' },
                { id: 'txt', label: 'TXT', sub: '纯文本' },
              ].map((fmt) => {
                const isSelected = targetFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => {
                      soundService.playClick();
                      setTargetFormat(fmt.id as TrackExportFormat);
                      if (currentTrack) {
                        doConvert(currentTrack, fmt.id as TrackExportFormat);
                      }
                    }}
                    className={`py-2 px-1 rounded-xl border text-center flex flex-col items-center gap-0.5 cursor-pointer transition ${
                      isSelected
                        ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold shadow-xs ring-1 ring-teal-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs font-bold">{fmt.label}</span>
                    <span className="text-[9px] text-slate-400">{fmt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* 3. Conversion Preview and Actions */}
          {convertedText && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  转换结果预览 ({convertedFilename})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制文本</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载文件</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-[10px] text-slate-700 max-h-32 overflow-y-auto whitespace-pre">
                {convertedText.slice(0, 1000)}
                {convertedText.length > 1000 && '\n... (后续内容已省略显示)'}
              </div>

              {/* Extra button: Direct Import to Project */}
              <button
                onClick={handleImportToProject}
                className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
              >
                <Route className="w-4 h-4 text-emerald-600" />
                <span>将此转换航迹直接加入本工程航迹库 (可在地图查看)</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
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
