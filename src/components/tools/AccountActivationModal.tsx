import React, { useState } from 'react';
import { ShieldCheck, Check, X, KeyRound, Cpu, Award } from 'lucide-react';
import { soundService } from '../../utils/sound';

interface AccountActivationModalProps {
  onClose: () => void;
}

export const AccountActivationModal: React.FC<AccountActivationModalProps> = ({ onClose }) => {
  const [authCode, setAuthCode] = useState('RTK-SURVEY-8888-9999-OK');
  const [deviceSn] = useState('CH-RTK-900A-SN882103');
  const [isActivated, setIsActivated] = useState(true);

  const handleActivate = () => {
    soundService.playClick();
    setIsActivated(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 z-50 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">测量手薄授权与设备激活</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Status Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-800">
                {isActivated ? '永久专业工程测量版已激活' : '试用版 (剩余7天)'}
              </div>
              <div className="text-[11px] text-slate-500">支持RTK全功能放样、多星多频高精差分</div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">主板序列号 (SN):</span>
              <span className="text-slate-800 font-bold">{deviceSn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">GNSS 固件版本:</span>
              <span className="text-slate-800 font-bold">v3.4.2-RTKPRO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">授权到期日:</span>
              <span className="text-emerald-600 font-bold">永久有效 (Permanent)</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">输入更新激活码</label>
            <input
              type="text"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <button
            onClick={handleActivate}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
          >
            校验并更新授权
          </button>
        </div>

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
