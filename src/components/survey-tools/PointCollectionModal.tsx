import React, { useState, useEffect } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { latLonToGauss } from '../../utils/geodesy';
import { MapPin, CheckCircle2, RotateCw, X, Radio } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface PointCollectionModalProps {
  onClose: () => void;
}

export const PointCollectionModal: React.FC<PointCollectionModalProps> = ({ onClose }) => {
  const { currentProject, points, addPoint } = useSurveyData();
  const { rtkState } = useRTK();

  const [pointName, setPointName] = useState(`CP_${points.length + 1}`);
  const [pointCode, setPointCode] = useState('CONTROL_PT');
  const [antennaHeight, setAntennaHeight] = useState(rtkState.antennaHeight.toString());
  const [targetEpochs, setTargetEpochs] = useState(5); // 5 epochs averaging
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Accumulated readings
  const [accumLat, setAccumLat] = useState(0);
  const [accumLon, setAccumLon] = useState(0);
  const [accumAlt, setAccumAlt] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCollecting && currentEpoch < targetEpochs) {
      timer = setTimeout(() => {
        soundService.playClick();
        setAccumLat((prev) => prev + rtkState.currentLat);
        setAccumLon((prev) => prev + rtkState.currentLon);
        setAccumAlt((prev) => prev + rtkState.currentAlt);
        setCurrentEpoch((prev) => prev + 1);
      }, 1000);
    } else if (isCollecting && currentEpoch >= targetEpochs) {
      // Finished averaging!
      setIsCollecting(false);
      setIsDone(true);

      const finalLat = accumLat / targetEpochs;
      const finalLon = accumLon / targetEpochs;
      const finalAlt = (accumAlt / targetEpochs) - parseFloat(antennaHeight || '0');

      const gauss = latLonToGauss(
        finalLat,
        finalLon,
        currentProject.centralMeridian,
        currentProject.coordSystem
      );

      addPoint({
        name: pointName,
        code: pointCode,
        lat: finalLat,
        lon: finalLon,
        elevation: Math.round(finalAlt * 1000) / 1000,
        x: gauss.x,
        y: gauss.y,
        coordSystem: currentProject.coordSystem,
        desc: `${targetEpochs}历元平滑高精控制点`,
        color: '#f97316',
        hrms: rtkState.hrms * 0.7,
        vrms: rtkState.vrms * 0.7,
        solutionType: rtkState.solution,
        satCount: rtkState.satsUsed,
        antennaHeight: parseFloat(antennaHeight || '0'),
        projectId: currentProject.id,
      });
    }

    return () => clearTimeout(timer);
  }, [isCollecting, currentEpoch, targetEpochs, accumLat, accumLon, accumAlt, antennaHeight, currentProject, pointName, pointCode, rtkState, addPoint]);

  const handleStart = () => {
    soundService.playClick();
    setCurrentEpoch(0);
    setAccumLat(0);
    setAccumLon(0);
    setAccumAlt(0);
    setIsDone(false);
    setIsCollecting(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">平滑历元点采集 (Point Collection)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">采集点名</label>
              <input
                type="text"
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">特征编码</label>
              <input
                type="text"
                value={pointCode}
                onChange={(e) => setPointCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">天线高 (米)</label>
              <input
                type="number"
                step="0.01"
                value={antennaHeight}
                onChange={(e) => setAntennaHeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">平滑历元数</label>
              <select
                value={targetEpochs}
                onChange={(e) => setTargetEpochs(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value={3}>3 历元 (快速)</option>
                <option value={5}>5 历元 (标准控制点)</option>
                <option value={10}>10 历元 (高精基准点)</option>
                <option value={20}>20 历元 (超高精静态)</option>
              </select>
            </div>
          </div>

          {/* Epoch Progress Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>历元进度 ({currentEpoch} / {targetEpochs})</span>
              <span className="text-blue-600 font-mono font-bold">
                {Math.round((currentEpoch / targetEpochs) * 100)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${(currentEpoch / targetEpochs) * 100}%` }}
              />
            </div>

            {isDone ? (
              <div className="pt-2 text-xs text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>点位采集已平滑完成并自动存盘！</span>
              </div>
            ) : isCollecting ? (
              <div className="pt-2 text-xs text-amber-600 font-mono font-medium flex items-center justify-center gap-1.5 animate-pulse">
                <Radio className="w-4 h-4" />
                <span>平滑采样中... 请保持测杆垂直静止</span>
              </div>
            ) : (
              <div className="pt-2 text-[11px] text-slate-500">
                准备就绪，请对准水准气泡后点击开始
              </div>
            )}
          </div>

          {/* Action Button */}
          <div>
            {!isCollecting ? (
              <button
                onClick={handleStart}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition"
              >
                {isDone ? '再次采集点位' : '立即开始平滑采点'}
              </button>
            ) : (
              <button
                onClick={() => setIsCollecting(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                取消采集
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
