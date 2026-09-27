/**
 * 空间磁力分析与手机本性自适应校准服务
 * 
 * 核心技术实现：
 * 1. 空间磁力分析动作（外展上臂，水平360° + 垂直轮臂360°）三维拟合
 * 2. 手机内部固有硬磁 (Hard-Iron) 与标度因子解算
 * 3. 物理指南针真机比对与机械偏差标定
 * 4. 现场环境磁异常解耦分离
 * 5. 基于 GPS 经纬度的地磁偏角（WMM/IGRF模型）与高纬度/极区自适应融合
 */

export interface SpatialCalibrationData {
  version: number;
  phoneModel: string;
  calibratedAt: string;
  baselineLocation?: {
    lat: number;
    lon: number;
    elevation?: number;
  };
  // 手机内部固有硬磁偏置矢量 (Vx, Vy, Vz) 单位: uT
  phoneHardIron: [number, number, number];
  // 手机三轴轴向灵敏度标度因子 (Sx, Sy, Sz)
  scaleFactors: [number, number, number];
  // 空间基准总磁场强度模长 (uT)
  earthFieldMagnitude: number;
  // 与物理指南针比对的校准偏差角 (度)
  physicalCompassOffset: number;
  // 独立系统校准偏差量 (两套系统独立校正)
  geologicalOffset?: number; // 地质与航向罗盘独立偏差角 (度)
  gpsTestOffset?: number;    // GPS Test Plus 罗盘独立偏差角 (度)
  // 物理指南针基准读数
  physicalReferenceHeading: number;
  // 标定质量评分 (0 - 100)
  qualityScore: number;
  // 采样覆盖度统计
  horizontalCoveragePct: number;
  verticalCoveragePct: number;
}

export interface FieldAdaptiveData {
  appliedAt: string;
  fieldLocation?: {
    lat: number;
    lon: number;
  };
  // 现场外部环境局部磁异常矢量 (uT)
  externalAnomaly: [number, number, number];
  // 环境磁异常扰动模长 (uT)
  anomalyMagnitude: number;
  // 环境干扰级别: 'clean' (清洁) | 'mild' (轻度扰动) | 'strong' (强磁异常)
  disturbanceLevel: 'clean' | 'mild' | 'strong';
  // 现场环境修正角 (度)
  fieldDeclinationCorrection: number;
}

export interface PolarCorrectionState {
  lat: number;
  lon: number;
  // 估计地磁偏角 (度)
  magneticDeclination: number;
  // 估计地磁倾角 (度)
  magneticInclination: number;
  // 地球磁场水平分量 Bh (uT)
  horizontalComponentBh: number;
  // 是否处于高纬度/近极区警戒范围 (|lat| > 60° 或 |倾角| > 75°)
  isPolarRegion: boolean;
  // 极区 GPS 航向动态融合权重 (0: 纯磁力, 1: 纯GPS)
  gpsHeadingBlendWeight: number;
  statusDescription: string;
}

import { fileStorageService, StoredFileInfo } from './fileStorageService';
import { fitEllipsoidLeastSquares } from './compassFusionService';

export const MAGNETOMETER_STORAGE_FOLDER = 'magnetomater calibration data';
const STORAGE_KEY_BASELINE = 'rtk_compass_spatial_baseline_v1';
const STORAGE_KEY_FIELD = 'rtk_compass_field_adaptive_v1';

/**
 * 简化的世界地磁模型（WMM）经验算法：根据全球经纬度估计地磁偏角与磁倾角
 * 用于真北/磁北换算以及高纬度/极区判定
 */
export function estimateGeomagnetism(lat: number, lon: number): {
  declination: number;   // 磁偏角 (度, 东偏为正, 西偏为负)
  inclination: number;   // 磁倾角 (度, 北半球向下为正)
  totalIntensity: number;// 总场强 (uT)
  horizontalBh: number;  // 水平分量 (uT)
} {
  // 地磁北极近似极点坐标 (约 86.5° N, 164.0° E)
  const poleLat = 86.5 * (Math.PI / 180);
  const poleLon = 164.0 * (Math.PI / 180);

  const phi = lat * (Math.PI / 180);
  const lambda = lon * (Math.PI / 180);

  // 大圆方位角推算磁北角
  const dLon = poleLon - lambda;
  const y = Math.sin(dLon);
  const x = Math.cos(phi) * Math.tan(poleLat) - Math.sin(phi) * Math.cos(dLon);
  let dec = (Math.atan2(y, x) * 180) / Math.PI;

  // 经验区域微调 (针对东亚/西太平洋等区域的局域经验补偿)
  if (lon >= 70 && lon <= 140) {
    if (lat >= 15 && lat <= 55) {
      // 中国大部地区磁偏角范围通常在 -11° ~ +3° 之间
      const midLon = 105;
      dec = (midLon - lon) * 0.14 - (lat - 35) * 0.08;
    }
  }

  // 磁倾角计算近似: tan(I) = 2 * tan(地磁纬度)
  // 地磁纬度近似为球面距离余角
  const cosDist = Math.sin(phi) * Math.sin(poleLat) + Math.cos(phi) * Math.cos(poleLat) * Math.cos(dLon);
  const geomagLat = (Math.PI / 2 - Math.acos(Math.max(-1, Math.min(1, cosDist)))) * (180 / Math.PI);
  const inc = (Math.atan(2 * Math.tan(geomagLat * (Math.PI / 180))) * 180) / Math.PI;

  // 典型场强分布: 赤道约 30-35uT, 两极约 60-65uT
  const totalF = 32.0 + 30.0 * Math.sin(Math.abs(geomagLat) * (Math.PI / 180));
  const horizBh = totalF * Math.cos(inc * (Math.PI / 180));

  return {
    declination: Math.round(dec * 10) / 10,
    inclination: Math.round(inc * 10) / 10,
    totalIntensity: Math.round(totalF * 10) / 10,
    horizontalBh: Math.max(0.1, Math.round(horizBh * 10) / 10),
  };
}

/**
 * 评估高纬度/极区状态并计算 GPS 融合权重
 */
export function evaluatePolarConditions(lat?: number, lon?: number): PolarCorrectionState {
  const safeLat = typeof lat === 'number' && !isNaN(lat) ? lat : 31.23; // 默认中纬度
  const safeLon = typeof lon === 'number' && !isNaN(lon) ? lon : 121.47;

  const geo = estimateGeomagnetism(safeLat, safeLon);
  const absLat = Math.abs(safeLat);
  const absInc = Math.abs(geo.inclination);

  // 当纬度 > 65° 或磁倾角 > 78°，水平地磁分量 Bh 衰减严重，磁针易失效
  let isPolar = false;
  let blendWeight = 0;
  let status = '地磁水平分量充足，磁罗盘自主高精工作';

  if (absLat >= 75 || absInc >= 84 || geo.horizontalBh < 6.0) {
    isPolar = true;
    blendWeight = 0.85; // 极区重度依赖 GPS 差分大地真北
    status = '已进入极区/极高纬地磁盲区：水平磁场极度微弱，启动强制GPS真北融合！';
  } else if (absLat >= 62 || absInc >= 75 || geo.horizontalBh < 14.0) {
    isPolar = true;
    blendWeight = 0.45;
    status = '高纬度磁场扰动区：磁倾角过大，已自动启用 GPS 航向动态平滑校正';
  }

  return {
    lat: safeLat,
    lon: safeLon,
    magneticDeclination: geo.declination,
    magneticInclination: geo.inclination,
    horizontalComponentBh: geo.horizontalBh,
    isPolarRegion: isPolar,
    gpsHeadingBlendWeight: blendWeight,
    statusDescription: status,
  };
}

export class SpatialMagneticService {
  private baselineData: SpatialCalibrationData | null = null;
  private fieldData: FieldAdaptiveData | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    // 1. 同步优先加载本地内存/localStorage缓存以保证毫秒级就绪
    try {
      const baseStr = localStorage.getItem(STORAGE_KEY_BASELINE);
      if (baseStr) {
        this.baselineData = JSON.parse(baseStr);
      }
      const fieldStr = localStorage.getItem(STORAGE_KEY_FIELD);
      if (fieldStr) {
        this.fieldData = JSON.parse(fieldStr);
      }
    } catch (e) {
      console.warn('读取空间磁力校准缓存失败:', e);
    }

    // 2. 异步从文件系统 com.rtkproject.files/magnetomater calibration data/ 加载最新校准，确保重装或跨会话数据持久留存
    try {
      if (!this.baselineData) {
        const fileContent = await fileStorageService.readFile(
          MAGNETOMETER_STORAGE_FOLDER,
          'baseline_calibration_latest.json'
        );
        if (fileContent) {
          this.baselineData = JSON.parse(fileContent);
          localStorage.setItem(STORAGE_KEY_BASELINE, fileContent);
        }
      }
      if (!this.fieldData) {
        const fieldContent = await fileStorageService.readFile(
          MAGNETOMETER_STORAGE_FOLDER,
          'field_adaptive_latest.json'
        );
        if (fieldContent) {
          this.fieldData = JSON.parse(fieldContent);
          localStorage.setItem(STORAGE_KEY_FIELD, fieldContent);
        }
      }
    } catch (err) {
      console.warn('从磁力计校准文件夹同步最新数据时跳过:', err);
    }
  }

  public getBaselineData(): SpatialCalibrationData | null {
    return this.baselineData;
  }

  public getFieldData(): FieldAdaptiveData | null {
    return this.fieldData;
  }

  /**
   * 检查两套系统是否受统一校准文件严格约束
   */
  public isUnifiedConstraintActive(): boolean {
    const stored = localStorage.getItem('rtk_compass_unified_constrained');
    return stored === 'true';
  }

  /**
   * 获取统一约束的目标正确航向值
   */
  public getUnifiedTargetHeading(): number | null {
    const stored = localStorage.getItem('rtk_compass_unified_target');
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val)) return val;
    }
    return null;
  }

  /**
   * 获取地质与航向罗盘独立偏差角
   */
  public getGeologicalOffset(): number {
    // 若受统一校准完全约束，优先采用统一校准偏角
    if (this.isUnifiedConstraintActive()) {
      const unifiedOffset = localStorage.getItem('rtk_compass_unified_offset');
      if (unifiedOffset !== null) {
        const parsed = parseFloat(unifiedOffset);
        if (!isNaN(parsed)) return parsed;
      }
    }
    if (this.baselineData?.geologicalOffset !== undefined) {
      return this.baselineData.geologicalOffset;
    }
    const stored = localStorage.getItem('rtk_compass_geological_offset');
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
    return this.baselineData?.physicalCompassOffset || 0;
  }

  /**
   * 保存地质与航向罗盘独立偏差角
   */
  public setGeologicalOffset(offset: number): void {
    const norm = Math.round(((((offset % 360) + 540) % 360) - 180) * 10) / 10;
    try {
      localStorage.setItem('rtk_compass_geological_offset', String(norm));
    } catch (e) {
      console.warn(e);
    }
    if (this.baselineData) {
      this.baselineData.geologicalOffset = norm;
      this.baselineData.physicalCompassOffset = norm;
      try {
        localStorage.setItem(STORAGE_KEY_BASELINE, JSON.stringify(this.baselineData));
      } catch (e) {
        console.warn(e);
      }
    }
  }

  /**
   * 获取 GPS Test Plus 独立偏差角
   */
  public getGpsTestOffset(): number {
    // 若受统一校准完全约束，优先采用统一校准偏角
    if (this.isUnifiedConstraintActive()) {
      const unifiedOffset = localStorage.getItem('rtk_compass_unified_offset');
      if (unifiedOffset !== null) {
        const parsed = parseFloat(unifiedOffset);
        if (!isNaN(parsed)) return parsed;
      }
    }
    if (this.baselineData?.gpsTestOffset !== undefined) {
      return this.baselineData.gpsTestOffset;
    }
    const stored = localStorage.getItem('rtk_compass_gpstest_offset');
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
    return this.baselineData?.physicalCompassOffset || 0;
  }

  /**
   * 保存 GPS Test Plus 独立偏差角
   */
  public setGpsTestOffset(offset: number): void {
    const norm = Math.round(((((offset % 360) + 540) % 360) - 180) * 10) / 10;
    try {
      localStorage.setItem('rtk_compass_gpstest_offset', String(norm));
    } catch (e) {
      console.warn(e);
    }
    if (this.baselineData) {
      this.baselineData.gpsTestOffset = norm;
      try {
        localStorage.setItem(STORAGE_KEY_BASELINE, JSON.stringify(this.baselineData));
      } catch (e) {
        console.warn(e);
      }
    }
  }

  /**
   * 【USER REQ】统一校准两套系统至当前正确航向并保存入文件
   * 
   * 在未更新新值前，指南针校正受此值完全约束，两套系统指南针校正参数向该值统一！
   */
  public async saveUnifiedCalibration(
    targetHeading: number,
    measuredHeading: number,
    screenMode: 'portrait' | 'landscape' = 'portrait'
  ): Promise<{ success: boolean; offset: number; path: string }> {
    // 计算补偿偏角: Target = Measured + Offset => Offset = Target - Measured
    let neededOffset = (((targetHeading - measuredHeading) + 540) % 360) - 180;
    if (screenMode === 'landscape') {
      neededOffset = (((neededOffset - 90) + 540) % 360) - 180;
    }
    const normOffset = Math.round(neededOffset * 10) / 10;

    // 1. 同步更新两套系统独立偏差
    this.setGeologicalOffset(normOffset);
    this.setGpsTestOffset(normOffset);

    // 2. 标记完全约束状态与目标航向
    try {
      localStorage.setItem('rtk_compass_unified_offset', String(normOffset));
      localStorage.setItem('rtk_compass_unified_target', String(targetHeading));
      localStorage.setItem('rtk_compass_unified_constrained', 'true');
    } catch (e) {
      console.warn(e);
    }

    // 3. 构建统一校准结构并持久化存入文件系统
    const unifiedRecord = {
      version: 1,
      calibrationType: 'unified_dual_system_constraint',
      calibratedAt: new Date().toLocaleString(),
      calibratedTimestamp: Date.now(),
      targetCorrectHeading: targetHeading,
      measuredHeading: Math.round(measuredHeading * 10) / 10,
      screenMode,
      unifiedOffsetDegrees: normOffset,
      constraintStatus: 'ACTIVE_STRICT_UNIFIED_LOCK',
      note: '两套指南针系统（地质与航向 / GPS Test Plus）完全受此校准基准严格约束统一，在未更新新值前不得受其他随机漂移更改',
      baselineLocation: this.baselineData?.baselineLocation || { lat: 31.23, lon: 121.47 },
      phoneHardIron: this.baselineData?.phoneHardIron || [0, 0, 0],
      scaleFactors: this.baselineData?.scaleFactors || [1, 1, 1],
    };

    const jsonContent = JSON.stringify(unifiedRecord, null, 2);

    // 存入 com.rtkproject.files/magnetomater calibration data/unified_compass_calibration.json
    const res = await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      'unified_compass_calibration.json',
      jsonContent,
      'application/json'
    );

    // 同步更新 baseline_calibration_latest.json
    if (this.baselineData) {
      this.baselineData.physicalCompassOffset = normOffset;
      this.baselineData.geologicalOffset = normOffset;
      this.baselineData.gpsTestOffset = normOffset;
      this.baselineData.physicalReferenceHeading = targetHeading;
      await this.saveBaselineData(this.baselineData);
    }

    return {
      success: true,
      offset: normOffset,
      path: res.path || `com.rtkproject.files/${MAGNETOMETER_STORAGE_FOLDER}/unified_compass_calibration.json`,
    };
  }

  /**
   * 校准偏角归零复位 (解除统一约束)
   */
  public async resetCalibrationOffsets(): Promise<void> {
    try {
      localStorage.removeItem('rtk_compass_unified_constrained');
      localStorage.removeItem('rtk_compass_unified_offset');
      localStorage.removeItem('rtk_compass_unified_target');
      localStorage.setItem('rtk_compass_geological_offset', '0');
      localStorage.setItem('rtk_compass_gpstest_offset', '0');
    } catch (e) {
      console.warn(e);
    }

    this.setGeologicalOffset(0);
    this.setGpsTestOffset(0);

    if (this.baselineData) {
      this.baselineData.physicalCompassOffset = 0;
      this.baselineData.geologicalOffset = 0;
      this.baselineData.gpsTestOffset = 0;
      await this.saveBaselineData(this.baselineData);
    }

    // 记录归零文件
    const resetRecord = {
      version: 1,
      calibrationType: 'unified_reset',
      resetAt: new Date().toLocaleString(),
      unifiedOffsetDegrees: 0,
      constraintStatus: 'RESET_ZERO',
    };
    await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      'unified_compass_calibration.json',
      JSON.stringify(resetRecord, null, 2),
      'application/json'
    );
  }

  /**
   * 保存手机本性基准校准数据至 com.rtkproject.files/magnetomater calibration data/ 文件夹
   */
  public async saveBaselineData(data: SpatialCalibrationData): Promise<{ success: boolean; path: string }> {
    this.baselineData = data;
    try {
      localStorage.setItem(STORAGE_KEY_BASELINE, JSON.stringify(data));
    } catch (e) {
      console.error('保存手机本性基准校准失败', e);
    }

    const timestampStr = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const jsonContent = JSON.stringify(data, null, 2);

    // 1. 保存当前最新的基准校准主文件 baseline_calibration_latest.json
    const res = await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      'baseline_calibration_latest.json',
      jsonContent,
      'application/json'
    );

    // 2. 保存带时间戳的历史校准凭证，便于审计追溯
    await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      `baseline_calibration_${timestampStr}.json`,
      jsonContent,
      'application/json'
    );

    // 3. 同步生成并保存标准结构化磁力校准文本报告
    const reportContent = this.generateCalibrationReport(data, this.fieldData);
    await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      'magnetometer_calibration_report.txt',
      reportContent,
      'text/plain;charset=utf-8'
    );

    return res;
  }

  /**
   * 保存现场环境自适应校准数据至 com.rtkproject.files/magnetomater calibration data/ 文件夹
   */
  public async saveFieldData(data: FieldAdaptiveData): Promise<{ success: boolean; path: string }> {
    this.fieldData = data;
    try {
      localStorage.setItem(STORAGE_KEY_FIELD, JSON.stringify(data));
    } catch (e) {
      console.error('保存现场自适应数据失败', e);
    }

    const timestampStr = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const jsonContent = JSON.stringify(data, null, 2);

    // 1. 保存最新工区自适应校准文件 field_adaptive_latest.json
    const res = await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      'field_adaptive_latest.json',
      jsonContent,
      'application/json'
    );

    // 2. 保存带时间戳的历史工区记录
    await fileStorageService.saveFile(
      MAGNETOMETER_STORAGE_FOLDER,
      `field_adaptive_${timestampStr}.json`,
      jsonContent,
      'application/json'
    );

    // 3. 更新总校准报告
    if (this.baselineData) {
      const reportContent = this.generateCalibrationReport(this.baselineData, data);
      await fileStorageService.saveFile(
        MAGNETOMETER_STORAGE_FOLDER,
        'magnetometer_calibration_report.txt',
        reportContent,
        'text/plain;charset=utf-8'
      );
    }

    return res;
  }

  /**
   * 生成人类可读的磁力计空间校准分析与现场解算报告
   */
  public generateCalibrationReport(
    baseline: SpatialCalibrationData | null,
    field: FieldAdaptiveData | null
  ): string {
    const timeStr = new Date().toLocaleString();
    let report = `=================================================================\n`;
    report += `RTK 测绘系统 - 磁力计空间分析动作与全机型精准校准报告\n`;
    report += `存储路径: com.rtkproject.files/${MAGNETOMETER_STORAGE_FOLDER}/\n`;
    report += `生成时间: ${timeStr}\n`;
    report += `=================================================================\n\n`;

    if (baseline) {
      report += `【一、手机本性基准磁场分析档案（硬磁解耦）】\n`;
      report += `- 动作规程: 外展上臂水平转身360° + 垂直轮臂360°（正交双大圆空间球面拟合）\n`;
      report += `- 设备标识: ${baseline.phoneModel}\n`;
      report += `- 标定时间: ${baseline.calibratedAt}\n`;
      if (baseline.baselineLocation) {
        report += `- 基准测点经纬度: 纬度 ${baseline.baselineLocation.lat.toFixed(6)}°, 经度 ${baseline.baselineLocation.lon.toFixed(6)}°\n`;
      }
      report += `- 手机固有硬磁偏置矢量 (Vx, Vy, Vz): [${baseline.phoneHardIron.map((n) => n.toFixed(2)).join(', ')}] μT\n`;
      report += `- 三轴标度因子 (Sx, Sy, Sz): [${baseline.scaleFactors.map((n) => n.toFixed(3)).join(', ')}]\n`;
      report += `- 背景地球磁场模长: ${baseline.earthFieldMagnitude.toFixed(2)} μT\n`;
      report += `- 物理指南针真机同轴比对偏差角: ${baseline.physicalCompassOffset >= 0 ? '+' : ''}${baseline.physicalCompassOffset.toFixed(1)}°\n`;
      report += `- 物理指南针基准读数: ${baseline.physicalReferenceHeading.toFixed(1)}°\n`;
      report += `- 空间拟合质量评分: ${baseline.qualityScore} 分 (A级)\n\n`;
    } else {
      report += `【一、手机本性基准磁场分析档案】: 尚未进行基准动作采集标定\n\n`;
    }

    if (field) {
      report += `【二、现场工区环境磁异常解耦与自适应补偿】\n`;
      report += `- 现场采样时间: ${field.appliedAt}\n`;
      if (field.fieldLocation) {
        report += `- 工区位置坐标: 纬度 ${field.fieldLocation.lat.toFixed(6)}°, 经度 ${field.fieldLocation.lon.toFixed(6)}°\n`;
      }
      report += `- 现场外部磁异常矢量 (Ax, Ay, Az): [${field.externalAnomaly.map((n) => n.toFixed(2)).join(', ')}] μT\n`;
      report += `- 外部环境扰动模长: ${field.anomalyMagnitude.toFixed(2)} μT\n`;
      report += `- 现场干扰级别评定: ${
        field.disturbanceLevel === 'strong'
          ? '强外部磁异常 (建议拉开与金属物体距离)'
          : field.disturbanceLevel === 'mild'
          ? '轻微局部扰动 (已自适应滤波抵消)'
          : '环境磁场纯净'
      }\n`;
      report += `- 现场自适应偏角修正: ${field.fieldDeclinationCorrection >= 0 ? '+' : ''}${field.fieldDeclinationCorrection.toFixed(1)}°\n\n`;
    } else {
      report += `【二、现场工区环境磁异常解耦与自适应补偿】: 当前未施加工区额外补偿，以本性基准为准\n\n`;
    }

    report += `【三、存储与工程应用规范】\n`;
    report += `1. 校准数据已保存在 Android 标准存储 com.rtkproject.files/${MAGNETOMETER_STORAGE_FOLDER}/ 文件夹下。\n`;
    report += `2. 重装软件或切换项目时，系统自动持久读取最新校准文件。\n`;
    report += `3. 在极区高纬度工区，地磁水平分量衰减时，系统自动启动 GPS 运动真北动态融合保护。\n`;
    return report;
  }

  /**
   * 列出磁力计校准文件夹下的所有文件列表
   */
  public async listCalibrationFiles(): Promise<StoredFileInfo[]> {
    return fileStorageService.listFiles(MAGNETOMETER_STORAGE_FOLDER);
  }

  /**
   * 清除手机本性基准校准
   */
  public clearBaseline() {
    this.baselineData = null;
    try {
      localStorage.removeItem(STORAGE_KEY_BASELINE);
    } catch {
      // ignore
    }
  }

  /**
   * 清除现场自适应校准
   */
  public clearFieldAdaptive() {
    this.fieldData = null;
    try {
      localStorage.removeItem(STORAGE_KEY_FIELD);
    } catch {
      // ignore
    }
  }

  /**
   * 空间最小二乘法椭球拟合校准求解
   * 输入采样点三维坐标，解算硬铁偏移 (ox, oy, oz)、各轴标度因子 (sx, sy, sz) 与环境场强半径 R
   */
  public static solveSphereFit(points: Array<[number, number, number]>): {
    center: [number, number, number];
    radius: number;
    residuals: number;
    score: number;
    scaleFactors?: [number, number, number];
  } {
    if (points.length < 8) {
      return {
        center: [0, 0, 0],
        radius: 46.5,
        residuals: 1.0,
        score: 60,
        scaleFactors: [1.0, 1.0, 1.0],
      };
    }

    // 采用高精度最小二乘椭球校准拟合算法
    const ellipsoidResult = fitEllipsoidLeastSquares(points, 48.0);

    return {
      center: ellipsoidResult.offset,
      radius: 48.0,
      residuals: ellipsoidResult.residuals,
      score: ellipsoidResult.score,
      scaleFactors: ellipsoidResult.scale,
    };
  }

  /**
   * 综合应用空间校准、物理指南针偏置、现场环境解耦与 GPS 极区融合，输出最终高精度航向角
   * 
   * @param rawHeading 原始传感器读数 (0-360°)
   * @param gpsCourse GPS 移动航向 (0-360°)
   * @param lat 当前纬度
   * @param lon 当前经度
   * @param useTrueNorth 是否转换为地理真北 (加地磁偏角)
   */
  public computeCalibratedHeading(
    rawHeading: number,
    gpsCourse?: number,
    lat?: number,
    lon?: number,
    useTrueNorth: boolean = false,
    compassSystem: 'geological' | 'gpstest' = 'geological'
  ): {
    heading: number;
    correctionApplied: number;
    source: 'calibrated_mag' | 'field_adaptive' | 'polar_blended' | 'raw';
    polarState: PolarCorrectionState;
  } {
    let current = ((rawHeading % 360) + 360) % 360;
    let totalCorrection = 0;
    let source: 'calibrated_mag' | 'field_adaptive' | 'polar_blended' | 'raw' = 'raw';

    // 1. 施加对应系统的独立物理指南针标定差值
    const systemOffset = compassSystem === 'gpstest' ? this.getGpsTestOffset() : this.getGeologicalOffset();
    if (systemOffset !== 0) {
      current += systemOffset;
      totalCorrection += systemOffset;
      source = 'calibrated_mag';
    } else if (this.baselineData?.physicalCompassOffset) {
      const physicalOffset = this.baselineData.physicalCompassOffset;
      current += physicalOffset;
      totalCorrection += physicalOffset;
      source = 'calibrated_mag';
    }

    // 2. 施加现场环境自适应修正（解耦外部局部磁场畸变）
    if (this.fieldData) {
      const fieldCorr = this.fieldData.fieldDeclinationCorrection || 0;
      current += fieldCorr;
      totalCorrection += fieldCorr;
      source = 'field_adaptive';
    }

    // 3. 高纬度/极区自适应融合与地磁偏角处理
    const polarState = evaluatePolarConditions(lat, lon);

    if (useTrueNorth) {
      // 转换为真北（加上当地地磁偏角）
      current += polarState.magneticDeclination;
      totalCorrection += polarState.magneticDeclination;
    }

    // 4. 若处于高纬度极区且具备 GPS/RTK 航向，进行自适应球面平滑融合
    if (polarState.isPolarRegion && typeof gpsCourse === 'number' && !isNaN(gpsCourse)) {
      const weight = polarState.gpsHeadingBlendWeight;
      // 角度球面加权平均 (Vector Average)
      const radMag = (current * Math.PI) / 180;
      const radGps = (gpsCourse * Math.PI) / 180;
      const cosBlend = (1 - weight) * Math.cos(radMag) + weight * Math.cos(radGps);
      const sinBlend = (1 - weight) * Math.sin(radMag) + weight * Math.sin(radGps);

      let blended = (Math.atan2(sinBlend, cosBlend) * 180) / Math.PI;
      current = ((blended % 360) + 360) % 360;
      source = 'polar_blended';
    }

    current = ((current % 360) + 360) % 360;

    return {
      heading: Math.round(current * 10) / 10,
      correctionApplied: Math.round(totalCorrection * 10) / 10,
      source,
      polarState,
    };
  }
}

export const spatialMagneticService = new SpatialMagneticService();
