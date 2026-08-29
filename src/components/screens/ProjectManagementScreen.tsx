import React, { useState } from 'react';
import { useSurveyData } from '../../context/SurveyDataContext';
import { CoordSystemType, EngineeringProject } from '../../types';
import {
  FolderGit2,
  Plus,
  Check,
  Sliders,
  Edit2,
  Trash2,
  MapPin,
  Calendar,
  User,
  Globe,
  FileText,
  X,
} from 'lucide-react';
import { soundService } from '../../utils/sound';

interface ProjectManagementScreenProps {
  onBack: () => void;
  onOpenSevenParams: () => void;
}

export const ProjectManagementScreen: React.FC<ProjectManagementScreenProps> = ({
  onBack,
  onOpenSevenParams,
}) => {
  const { currentProject, projects, points, switchProject, addProject, deleteProject, updateProject } =
    useSurveyData();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<EngineeringProject | null>(null);

  // Form fields for create/edit
  const [projName, setProjName] = useState('');
  const [operator, setOperator] = useState('测量工程师');
  const [coordSystem, setCoordSystem] = useState<CoordSystemType>('CGCS2000');
  const [centralMeridian, setCentralMeridian] = useState(114.0);
  const [desc, setDesc] = useState('');

  const handleOpenAddModal = () => {
    soundService.playClick();
    setProjName('');
    setOperator('测量工程师');
    setCoordSystem('CGCS2000');
    setCentralMeridian(114.0);
    setDesc('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (p: EngineeringProject) => {
    soundService.playClick();
    setEditingProject(p);
    setProjName(p.name);
    setOperator(p.operator);
    setCoordSystem(p.coordSystem);
    setCentralMeridian(p.centralMeridian);
    setDesc(p.desc || '');
  };

  const handleCreateProject = () => {
    if (!projName.trim()) return;
    soundService.playSuccess();

    addProject({
      name: projName.trim(),
      operator: operator.trim(),
      coordSystem,
      centralMeridian,
      projectionType: 'Gauss3',
      sevenParams: { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, scale: 0 },
      desc: desc.trim(),
    });

    setShowAddModal(false);
    setProjName('');
  };

  const handleSaveEditProject = () => {
    if (!editingProject || !projName.trim()) return;
    soundService.playSuccess();

    updateProject(editingProject.id, {
      name: projName.trim(),
      operator: operator.trim(),
      coordSystem,
      centralMeridian,
      desc: desc.trim(),
    });

    setEditingProject(null);
  };

  const handleDeleteProj = (p: EngineeringProject) => {
    if (projects.length <= 1) {
      alert('系统中至少需保留一个工程项目，无法删除所有项目。');
      return;
    }

    if (window.confirm(`确定删除工程项目【${p.name}】？\n此操作不可恢复。`)) {
      soundService.playClick();
      deleteProject(p.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-800 overflow-hidden select-none">
      {/* Top action bar */}
      <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-bold">工程项目管理</span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-semibold">
            共 {projects.length} 个工程
          </span>
        </div>

        <button
          onClick={handleOpenAddModal}
          id="btn-new-project"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs cursor-pointer active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>新建工程</span>
        </button>
      </div>

      {/* Projects List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {projects.map((p) => {
          const isActive = p.id === currentProject.id;
          return (
            <div
              key={p.id}
              className={`border rounded-2xl p-3.5 space-y-2.5 transition shadow-xs ${
                isActive
                  ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    <FolderGit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                      {isActive && (
                        <span className="px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                          <span>当前作业工程</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {p.operator}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        {isActive ? points.length : p.pointCount || 0} 点
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                    title="编辑工程信息"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteProj(p)}
                    disabled={projects.length <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                    title="删除工程"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {!isActive && (
                    <button
                      onClick={() => {
                        soundService.playClick();
                        switchProject(p.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer border border-blue-200 transition"
                    >
                      切换激活
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of details */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">参考坐标系:</span>
                  <span className="text-slate-900 font-bold">{p.coordSystem}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">中央子午线 L0:</span>
                  <span className="text-blue-700 font-bold">{p.centralMeridian}°</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">高斯投影:</span>
                  <span className="text-slate-800 font-bold">3°分带</span>
                </div>
              </div>

              {p.desc && (
                <p className="text-[11px] text-slate-500 bg-white/60 p-1.5 rounded border border-slate-100 italic">
                  {p.desc}
                </p>
              )}

              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {p.createTime}
                </span>
                {isActive && (
                  <button
                    onClick={onOpenSevenParams}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>设置转换七参数</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-blue-600" />
                <span>新建测绘工程项目</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">工程名称</label>
              <input
                type="text"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                placeholder="例如: 某标段公路路基放样测绘"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">负责人 / 测量员</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">中央子午线 (°)</label>
                <input
                  type="number"
                  step="0.5"
                  value={centralMeridian}
                  onChange={(e) => setCentralMeridian(parseFloat(e.target.value) || 114)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">参考椭球 / 坐标系</label>
              <select
                value={coordSystem}
                onChange={(e) => setCoordSystem(e.target.value as CoordSystemType)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 cursor-pointer focus:bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value="CGCS2000">CGCS2000 (国家2000大地坐标系)</option>
                <option value="Beijing54">北京54 (Beijing 1954)</option>
                <option value="Xian80">西安80 (Xi'an 1980)</option>
                <option value="WGS84">WGS-84 (GPS全球大地坐标系)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">工程备注</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="填写工程相关要求或描述..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!projName.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                立即创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>编辑工程项目属性</span>
              </h3>
              <button
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">工程名称</label>
              <input
                type="text"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">负责人</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">中央子午线 (°)</label>
                <input
                  type="number"
                  step="0.5"
                  value={centralMeridian}
                  onChange={(e) => setCentralMeridian(parseFloat(e.target.value) || 114)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">坐标系</label>
              <select
                value={coordSystem}
                onChange={(e) => setCoordSystem(e.target.value as CoordSystemType)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 cursor-pointer focus:bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value="CGCS2000">CGCS2000 (国家2000大地坐标系)</option>
                <option value="Beijing54">北京54 (Beijing 1954)</option>
                <option value="Xian80">西安80 (Xi'an 1980)</option>
                <option value="WGS84">WGS-84 (GPS全球基准)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">工程备注</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setEditingProject(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditProject}
                disabled={!projName.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
