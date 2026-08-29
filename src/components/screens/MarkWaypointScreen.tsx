import React, { useState, useEffect } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { useRTK } from '../../context/RTKContext';
import { CoordSystemType, AngleFormatType } from '../../types';
import {
  ddToDMS,
  dmsToDD,
  latLonToGauss,
  formatAngle,
} from '../../utils/geodesy';
import {
  Save,
  Crosshair,
  Sliders,
  Check,
  ChevronDown,
  Info,
  MapPin,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface MarkWaypointScreenProps {
  onBack: () => void;
  onSaved?: () => void;
  onOpenSevenParams?: () => void;
}

export const MarkWaypointScreen: React.FC<MarkWaypointScreenProps> = ({
  onBack,
  onSaved,
  onOpenSevenParams,
}) => {
  const { currentProject, points, addPoint, unitSettings } = useSurveyData();
  const { rtkState } = useRTK();

  // Next default point name e.g. "point 5"
  const defaultName = `point ${points.length + 1}`;
  const [pointName, setPointName] = useState(defaultName);
  const [pointCode, setPointCode] = useState('CP');
  const [pointColor, setPointColor] = useState('#2563eb');
  const [angleFormat, setAngleFormat] = useState<AngleFormatType>(unitSettings.angleFormat || 'dms');

  // DMS state for Lon & Lat
  const [lonDeg, setLonDeg] = useState(114);
  const [lonMin, setLonMin] = useState(16);
  const [lonSec, setLonSec] = useState(4.016);

  const [latDeg, setLatDeg] = useState(30);
  const [latMin, setLatMin] = useState(37);
  const [latSec, setLatSec] = useState(26.4854);

  // Decimal Degrees State
  const [decimalLon, setDecimalLon] = useState(rtkState.currentLon);
  const [decimalLat, setDecimalLat] = useState(rtkState.currentLat);

  const [elevation, setElevation] = useState(rtkState.currentAlt.toFixed(2));
  const [desc, setDesc] = useState('');
  const [coordSystem, setCoordSystem] = useState<CoordSystemType>(currentProject.coordSystem);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Color options
  const colorOptions = ['#2563eb', '#0284c7', '#059669', '#dc2626', '#7c3aed', '#d97706', '#475569'];

  // Initialize from current RTK position on mount
  useEffect(() => {
    handleFetchCurrentRTK();
  }, []);

  const handleFetchCurrentRTK = () => {
    soundService.playClick();
    const lonDms = ddToDMS(rtkState.currentLon);
    setLonDeg(lonDms.deg);
    setLonMin(lonDms.min);
    setLonSec(lonDms.sec);

    const latDms = ddToDMS(rtkState.currentLat);
    setLatDeg(latDms.deg);
    setLatMin(latDms.min);
    setLatSec(latDms.sec);

    setDecimalLon(rtkState.currentLon);
    setDecimalLat(rtkState.currentLat);
    setElevation(rtkState.currentAlt.toFixed(2));
  };

  // Compute Decimal Lat/Lon from inputs
  const currentLonDD =
    angleFormat === 'dms'
      ? dmsToDD(lonDeg, lonMin, lonSec)
      : decimalLon;

  const currentLatDD =
    angleFormat === 'dms'
      ? dmsToDD(latDeg, latMin, latSec)
      : decimalLat;

  // Calculate Gauss-Krüger Plane Coordinates (X North, Y East)
  const gauss = latLonToGauss(
    currentLatDD,
    currentLonDD,
    currentProject.centralMeridian,
    coordSystem
  );

  const handleSave = () => {
    if (!pointName.trim()) return;

    addPoint({
      name: pointName.trim(),
      code: pointCode.trim() || 'CP',
      lat: currentLatDD,
      lon: currentLonDD,
      elevation: parseFloat(elevation) || 0,
      x: gauss.x,
      y: gauss.y,
      coordSystem,
      desc: desc.trim(),
      color: pointColor,
      hrms: rtkState.hrms,
      vrms: rtkState.vrms,
      solutionType: rtkState.solution,
      satCount: rtkState.satsUsed,
      antennaHeight: rtkState.antennaHeight,
      projectId: currentProject.id,
    });

    setSaveSuccess(true);
    soundService.playSuccess();
    setTimeout(() => {
      if (onSaved) onSaved();
      else onBack();
    }, 300);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 overflow-y-auto relative pb-20">
      {/* Top Banner with Quick RTK Info */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-600 font-medium">
            RTK状态: <b className="text-emerald-700 font-mono">{rtkState.solution}</b> (HRMS: {rtkState.hrms.toFixed(3)}m)
          </span>
        </div>

        <button
          onClick={handleFetchCurrentRTK}
          id="btn-fetch-current-rtk"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>获取当前RTK坐标</span>
        </button>
      </div>

      <div className="p-4 space-y-3.5 max-w-xl mx-auto w-full">
        {/* Point Name & Color */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-tight">点名与编码</label>
            <div className="flex items-center gap-1.5">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPointColor(c)}
                  className={`w-5 h-5 rounded-full transition cursor-pointer ${
                    pointColor === c ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">点名 (Name)</span>
              <input
                type="text"
                id="input-point-name"
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                placeholder="例如 point 1"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">特征编码 (Code)</span>
              <input
                type="text"
                id="input-point-code"
                value={pointCode}
                onChange={(e) => setPointCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                placeholder="例如 CP / 道路 / 水准"
              />
            </div>
          </div>
        </div>

        {/* Angle Format & Lat/Lon Inputs */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-tight">空间经纬度坐标</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">格式:</span>
              <select
                value={angleFormat}
                onChange={(e) => setAngleFormat(e.target.value as AngleFormatType)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded px-2 py-1 focus:outline-hidden cursor-pointer"
              >
                <option value="dms">度分秒 (° ' ")</option>
                <option value="dd">十进制度 (°)</option>
                <option value="dm">度分 (° ')</option>
              </select>
            </div>
          </div>

          {/* DMS Format Inputs */}
          {angleFormat === 'dms' ? (
            <div className="space-y-3">
              {/* Longitude */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">经度 (Longitude - E)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={lonDeg}
                      onChange={(e) => setLonDeg(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 font-mono pr-6 focus:bg-white focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-2 text-slate-400 text-xs">°</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={lonMin}
                      onChange={(e) => setLonMin(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 font-mono pr-6 focus:bg-white focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-2 text-slate-400 text-xs">'</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.0001"
                      value={lonSec}
                      onChange={(e) => setLonSec(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 font-mono pr-6 focus:bg-white focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-2 text-slate-400 text-xs">"</span>
                  </div>
                </div>
              </div>

              {/* Latitude */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">纬度 (Latitude - N)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={latDeg}
                      onChange={(e) => setLatDeg(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 font-mono pr-6 focus:bg-white focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-2 text-slate-400 text-xs">°</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={latMin}
                      onChange={(e) => setLatMin(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 font-mono pr-6 focus:bg-white focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-2 text-slate-400 text-xs">'</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.0001"
                      value={latSec}
                      onChange={(e) => setLatSec(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 font-mono pr-6 focus:bg-white focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-2 text-slate-400 text-xs">"</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Decimal Degrees Inputs */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">经度 (DD)</span>
                <input
                  type="number"
                  step="0.00000001"
                  value={decimalLon}
                  onChange={(e) => setDecimalLon(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:bg-white focus:border-blue-500"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">纬度 (DD)</span>
                <input
                  type="number"
                  step="0.00000001"
                  value={decimalLat}
                  onChange={(e) => setDecimalLat(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Elevation */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">海拔大地高 (H - 米)</span>
            <input
              type="number"
              step="0.001"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
              placeholder="0.000"
            />
          </div>

          {/* Description */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">点位描述 (Description)</span>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              placeholder="请输入点位地物特征或备注信息"
            />
          </div>
        </div>

        {/* Coordinate System & Seven Parameters Setup */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-tight">投影与平面高斯坐标 (X / Y)</label>
            {onOpenSevenParams && (
              <button
                type="button"
                onClick={onOpenSevenParams}
                id="btn-open-seven-params"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 font-medium"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>七参数设置</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">基准坐标系:</span>
            <select
              value={coordSystem}
              onChange={(e) => setCoordSystem(e.target.value as CoordSystemType)}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 font-medium cursor-pointer"
            >
              <option value="CGCS2000">CGCS2000 (中国大地坐标系2000)</option>
              <option value="Beijing54">北京54 (Beijing 1954)</option>
              <option value="Xian80">西安80 (Xi'an 1980)</option>
              <option value="WGS84">WGS-84 (世界大地测量系统)</option>
            </select>
          </div>

          {/* Dynamic Calculated Plane Coordinates Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">北坐标 (X / North):</span>
              <span className="text-blue-700 font-bold text-sm">
                {gauss.x.toFixed(3)} m
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">东坐标 (Y / East):</span>
              <span className="text-indigo-700 font-bold text-sm">
                {gauss.y.toFixed(3)} m
              </span>
            </div>
            <div className="col-span-2 text-[10px] text-slate-500 pt-1.5 border-t border-slate-200 flex justify-between">
              <span>中央子午线 L0: <b className="text-slate-700">{currentProject.centralMeridian}°</b></span>
              <span>天线杆高: <b className="text-slate-700">{rtkState.antennaHeight.toFixed(2)}m</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-4 right-4 z-20">
        <button
          onClick={handleSave}
          id="btn-save-waypoint"
          title="保存航点到点库"
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-400 transition cursor-pointer"
        >
          {saveSuccess ? <Check className="w-7 h-7" /> : <Save className="w-7 h-7" />}
        </button>
      </div>
    </div>
  );
};
