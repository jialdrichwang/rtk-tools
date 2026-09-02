import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Download,
  Upload,
  Settings,
  Shield,
  FileSpreadsheet,
  MapPin,
  Layers,
  Trash2,
} from 'lucide-react';
import {
  fileStorageService,
  StorageFolderInfo,
  StoredFileInfo,
} from '../../utils/fileStorageService';
import { useSurveyData } from '../../context/SurveyDataContext';
import { soundService } from '../../utils/sound';
import {
  exportPointsToCSV,
  exportPointsToCASS,
  exportPointsToKML,
  exportTrackToGPX,
  downloadFile,
} from '../../utils/exportImport';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({ isOpen, onClose }) => {
  const { points, tracks, projects, currentProject } = useSurveyData();
  const [folderStats, setFolderStats] = useState<StorageFolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<'point' | 'track' | 'project' | 'mapdata'>('point');
  const [fileList, setFileList] = useState<StoredFileInfo[]>([]);
  const [rootDir, setRootDir] = useState<string>(fileStorageService.getRootDir());
  const [isEditingRoot, setIsEditingRoot] = useState<boolean>(false);
  const [customRootInput, setCustomRootInput] = useState<string>(fileStorageService.getRootDir());
  const [permStatus, setPermStatus] = useState<string>('已授予存储读写权限');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  const loadData = async () => {
    const stats = await fileStorageService.getFolderStats();
    setFolderStats(stats);
    const files = await fileStorageService.listFiles(selectedFolder);
    setFileList(files);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      fileStorageService.checkAndRequestPermissions().then((res) => {
        setPermStatus(res.message);
      });
    }
  }, [isOpen, selectedFolder]);

  if (!isOpen) return null;

  const handleFolderClick = (folder: 'point' | 'track' | 'project' | 'mapdata') => {
    soundService.playClick();
    setSelectedFolder(folder);
  };

  const handleSaveCustomRoot = () => {
    if (!customRootInput.trim()) return;
    fileStorageService.setRootDir(customRootInput.trim());
    setRootDir(customRootInput.trim());
    setIsEditingRoot(false);
    setStatusMessage({ text: `保存主目录已更新，子目录自动维护`, type: 'success' });
    loadData();
  };

  const handleResetDefaultRoot = () => {
    fileStorageService.resetRootDir();
    setRootDir(fileStorageService.getRootDir());
    setCustomRootInput(fileStorageService.getRootDir());
    setIsEditingRoot(false);
    setStatusMessage({ text: `已恢复默认标准存储目录`, type: 'success' });
    loadData();
  };

  // Sync / Backup all current project points & tracks into storage
  const handleBackupCurrentData = async () => {
    soundService.playClick();
    try {
      // 1. Save point
      if (points.length > 0) {
        fileStorageService.saveFile('point', `${currentProject.name}_points.json`, JSON.stringify(points, null, 2), 'application/json').catch(() => {});
        const summaryTxt = points.map((p, idx) => 
          `${idx + 1},${p.name},${p.x.toFixed(4)},${p.y.toFixed(4)},${p.elevation.toFixed(4)},${p.code || 'GPS'},${p.createdAt}`
        ).join('\n');
        await fileStorageService.saveFile('point', `${currentProject.name}_point.txt`, summaryTxt);
      }
      // 2. Save tracks
      for (const trk of tracks) {
        const gpx = exportTrackToGPX(trk);
        await fileStorageService.saveFile('track', `${trk.name}.gpx`, gpx, 'application/gpx+xml');
        await fileStorageService.saveFile('track', `${trk.name}.json`, JSON.stringify(trk, null, 2), 'application/json');
      }
      // 3. Save project
      await fileStorageService.saveFile('project', `${currentProject.name}_工程配置.json`, JSON.stringify(currentProject, null, 2));

      soundService.playSuccess();
      setStatusMessage({ text: `位点及航迹已完整保存至 point/ 与 track/ 目录！`, type: 'success' });
      loadData();
    } catch (e: any) {
      setStatusMessage({ text: `同步备份出现异常: ${e.message}`, type: 'warn' });
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    soundService.playClick();
    await fileStorageService.deleteFile(selectedFolder, fileName);
    loadData();
  };

  const handleDownloadOrConvert = async (file: StoredFileInfo) => {
    soundService.playClick();
    const content = await fileStorageService.readFile(file.folder, file.name);
    if (!content) {
      setStatusMessage({ text: `读取文件 ${file.name} 失败`, type: 'warn' });
      return;
    }
    downloadFile(content, file.name, 'text/plain;charset=utf-8');
    setStatusMessage({ text: `文件 ${file.name} 已成功导出下载`, type: 'success' });
  };

  const getFolderIcon = (name: string) => {
    switch (name) {
      case 'point':
      case 'points': return <MapPin className="w-4 h-4 text-blue-600" />;
      case 'track':
      case 'tracks': return <FileSpreadsheet className="w-4 h-4 text-cyan-600" />;
      case 'project': return <FileText className="w-4 h-4 text-purple-600" />;
      default: return <Layers className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">文件系统与存储目录管理</h2>
              <p className="text-[10px] text-slate-500">数据永久留存 · 重装软件不丢失</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Path Setting Bar */}
        <div className="p-3 bg-slate-100/70 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>存储主路径 (外置存储根目录)：</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
              {permStatus}
            </span>
          </div>

          {!isEditingRoot ? (
            <div className="flex items-center justify-between bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="font-mono text-xs text-blue-700 font-bold truncate">
                {rootDir}
              </span>
              <button
                onClick={() => {
                  soundService.playClick();
                  setIsEditingRoot(true);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
              >
                <Settings className="w-3 h-3" />
                <span>自定义</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                value={customRootInput}
                onChange={(e) => setCustomRootInput(e.target.value)}
                className="w-full bg-white border border-blue-400 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="/storage/emulated/0/com.rtkprogect.files"
              />
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={handleResetDefaultRoot}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                >
                  恢复默认
                </button>
                <button
                  onClick={handleSaveCustomRoot}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  保存路径
                </button>
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-500">
            固定生成子目录：<span className="font-mono text-slate-700 font-semibold">point / track / project / mapdata</span>（系统底层同步支持，用于存放位点与航迹原生数据）
          </div>
        </div>

        {/* Content */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* 4 Fixed Subdirectory Tabs */}
          <div className="grid grid-cols-4 gap-1.5">
            {folderStats.map((item) => {
              const isSelected = selectedFolder === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleFolderClick(item.name)}
                  className={`p-2 rounded-xl border text-left transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 text-blue-900 ring-1 ring-blue-400/40 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {getFolderIcon(item.name)}
                    <span className="text-xs font-bold font-mono">/{item.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {item.count} 个文件
                  </span>
                </button>
              );
            })}
          </div>

          {/* Folder Details & File List */}
          <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span>/{selectedFolder} 文件夹内容列表</span>
              </div>
              <button
                onClick={loadData}
                className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>刷新</span>
              </button>
            </div>

            {fileList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                该目录下暂无成果文件，可点击下方【立即同步/备份当前工程】自动写入
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {fileList.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-mono text-slate-800 font-bold truncate">
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {file.size !== undefined && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`}
                        </span>
                      )}
                      <button
                        onClick={() => handleDownloadOrConvert(file)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                        title="导出 / 下载该文件"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="删除该文件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            onClick={handleBackupCurrentData}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>一键同步/备份至文件系统</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
