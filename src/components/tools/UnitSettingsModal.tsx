import React, { useState } from 'react';
import { Settings2, Check, X } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface UnitSettingsModalProps {
  onClose: () => void;
}

export const UnitSettingsModal: React.FC<UnitSettingsModalProps> = ({ onClose }) => {
  const [distUnit, setDistUnit] = useState('m');
  const [angleFormat, setAngleFormat] = useState('dms');
  const [pressureUnit, setPressureUnit] = useState('hPa');
  const [coordDisplay, setCoordDisplay] = useState('XYH');

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">度量衡与显示单位设置 (Units & Display)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          {/* Distance unit */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">长度与距离单位</label>
            <select
              value={distUnit}
              onChange={(e) => setDistUnit(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
            >
              <option value="m">公制米 (Meters - m / mm / km)</option>
              <option value="ft">美制英尺 (US Survey Feet - ft)</option>
              <option value="ift">国际英尺 (International Feet)</option>
            </select>
          </div>

          {/* Angle format */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">角度格式</label>
            <select
              value={angleFormat}
              onChange={(e) => setAngleFormat(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
            >
              <option value="dms">度分秒 (DDD°MM′SS.SS″)</option>
              <option value="deg">十进制度 (DDD.DDDDDD°)</option>
              <option value="gon">百分度 (Gons / Grads)</option>
              <option value="mil">密位 (Mils 6000)</option>
            </select>
          </div>

          {/* Coordinate order */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">坐标显示顺序</label>
            <select
              value={coordDisplay}
              onChange={(e) => setCoordDisplay(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
            >
              <option value="XYH">北, 东, 高程 (X, Y, H - 测绘标准)</option>
              <option value="YXH">东, 北, 高程 (Y, X, H - 数学笛卡尔)</option>
              <option value="NEZ">North, East, Elev (N, E, Z)</option>
            </select>
          </div>

          {/* Pressure unit */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">气压单位</label>
            <select
              value={pressureUnit}
              onChange={(e) => setPressureUnit(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 cursor-pointer font-mono focus:border-blue-500 focus:outline-hidden"
            >
              <option value="hPa">百帕 (hPa / mbar)</option>
              <option value="mmHg">毫米汞柱 (mmHg)</option>
              <option value="inHg">英寸汞柱 (inHg)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => {
              soundService.playClick();
              onClose();
            }}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};
