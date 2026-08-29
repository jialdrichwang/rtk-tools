import React, { useState } from 'react';
import { DownloadCloud, Check, X, HardDrive, Map } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface OfflineMapModalProps {
  onClose: () => void;
}

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({ onClose }) => {
  const [downloadingRegion, setDownloadingRegion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>(['湖北省-武汉市核心区']);

  const regions = [
    { id: 'wuhan_core', name: '湖北省-武汉市核心区', size: '142 MB', level: '1-18级卫星图' },
    { id: 'guangdong_gz', name: '广东省-广州市开发区', size: '185 MB', level: '1-18级卫星图' },
    { id: 'beijing_sub', name: '北京市-通州副中心', size: '120 MB', level: '1-18级卫星图' },
    { id: 'shanghai_pd', name: '上海市-浦东临港新片区', size: '160 MB', level: '1-18级卫星图' },
    { id: 'sichuan_cd', name: '四川省-成都市天府新区', size: '135 MB', level: '1-18级卫星图' },
  ];

  const handleDownload = (id: string, name: string) => {
    soundService.playClick();
    setDownloadingRegion(id);
    setDownloadProgress(10);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadingRegion(null);
          setDownloadedRegions((d) => [...d, name]);
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">离线底图缓存管理 (Offline Map)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Storage Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700 font-medium">手持机离线缓存空间:</span>
            </div>
            <span className="text-blue-600 font-mono font-bold">2.4 GB / 32 GB</span>
          </div>

          {/* Region list */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 block px-1">常用测绘外业区域包</span>
            {regions.map((r) => {
              const isDownloaded = downloadedRegions.includes(r.name);
              const isCurrent = downloadingRegion === r.id;

              return (
                <div
                  key={r.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-800">{r.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      大小: {r.size} | {r.level}
                    </div>
                  </div>

                  <div>
                    {isDownloaded ? (
                      <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>已离线</span>
                      </span>
                    ) : isCurrent ? (
                      <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
                        <div
                          className="bg-blue-600 h-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(r.id, r.name)}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                      >
                        下载
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
