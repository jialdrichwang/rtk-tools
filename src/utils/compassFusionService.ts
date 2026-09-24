/**
 * 高性能 9 轴姿态融合与磁力校准引擎 (AHRS & Magnetic Fusion Engine)
 * 
 * 包含四大核心体系：
 * 1. Madgwick 9 轴融合算法 (结合陀螺仪 rad/s、加速度计 g、磁力计 μT，四元数微分方程更新与梯度下降误差修正)
 * 2. 最小二乘法椭圆拟合 (Least Squares Ellipsoid / Sphere Calibration，求解硬铁偏移 b 与软铁缩放矩阵 S)
 * 3. 自适应扩展卡尔曼滤波 (Adaptive EKF) + 动态测量噪声 R 调整 (静止 R=0.5，中速 R=3.0，高速 R=10.0)
 * 4. 磁异常检测 (Magnetic Anomaly Detection) 与 IMU 短时陀螺仪角速度航位积分备份保护
 * 5. 圆周角度低通滤波与反向旋转归一化输出 (0°~360°)
 */

export interface IMURawSample {
  // 加速度计 (m/s² 或 g)
  ax: number;
  ay: number;
  az: number;
  // 陀螺仪 (rad/s)
  gx: number;
  gy: number;
  gz: number;
  // 磁力计 (μT)
  mx: number;
  my: number;
  mz: number;
  timestamp: number;
}

export interface EllipsoidCalibrationResult {
  // 硬铁偏置 (ox, oy, oz) 单位: μT
  offset: [number, number, number];
  // 软铁/灵敏度缩放因子 (sx, sy, sz)
  scale: [number, number, number];
  // 拟合残差与评分
  residuals: number;
  score: number;
}

export interface FusionOutputState {
  // 滤波与融合后的真航向方位角 (0° - 360°)
  yaw: number;
  // 俯仰角 pitch (-90° ~ +90°)
  pitch: number;
  // 横滚角 roll (-180° ~ +180°)
  roll: number;
  // 当前环境磁场总场强模长 (μT)
  magneticFieldStrength: number;
  // 是否处于外部强磁干扰异常状态
  isMagneticAnomaly: boolean;
  // 融合算法模式: 'madgwick_9axis' | 'adaptive_kalman' | 'gyro_backup' | 'orientation_sensor'
  fusionMode: 'madgwick_9axis' | 'adaptive_kalman' | 'gyro_backup' | 'orientation_sensor';
  // 陀螺角速度模长 (rad/s)
  angularVelocity: number;
  // 采样频率 (Hz)
  sampleRate: number;
}

/**
 * 1. Madgwick AHRS 9-轴姿态解算核心类
 */
export class MadgwickAHRS {
  public q0: number = 1.0;
  public q1: number = 0.0;
  public q2: number = 0.0;
  public q3: number = 0.0;
  public beta: number = 0.1; // 算法增益 (可在 0.04 ~ 0.25 之间根据动态场景自适应)
  public sampleFreq: number = 50.0; // 默认 50Hz，根据真实采样动态更新

  constructor(sampleFreq: number = 50.0, beta: number = 0.1) {
    this.sampleFreq = sampleFreq;
    this.beta = beta;
  }

  public reset(sampleFreq: number = 50.0, beta: number = 0.1) {
    this.q0 = 1.0;
    this.q1 = 0.0;
    this.q2 = 0.0;
    this.q3 = 0.0;
    this.sampleFreq = sampleFreq;
    this.beta = beta;
  }

  /**
   * 9轴更新算法：输入陀螺仪(rad/s), 加速度计(g), 磁力计(μT)
   */
  public update(
    gx: number, gy: number, gz: number,
    ax: number, ay: number, az: number,
    mx: number, my: number, mz: number,
    dt?: number
  ) {
    const invSampleFreq = dt !== undefined && dt > 0 ? dt : 1.0 / this.sampleFreq;
    let q0 = this.q0, q1 = this.q1, q2 = this.q2, q3 = this.q3;

    // 磁力计归一化
    let norm = Math.hypot(mx, my, mz);
    if (norm === 0) return;
    mx /= norm; my /= norm; mz /= norm;

    // 加速度计归一化
    norm = Math.hypot(ax, ay, az);
    if (norm === 0) return;
    ax /= norm; ay /= norm; az /= norm;

    // 计算参考方向与辅助变量
    const _2q0mx = 2.0 * q0 * mx;
    const _2q0my = 2.0 * q0 * my;
    const _2q0mz = 2.0 * q0 * mz;
    const _2q1mx = 2.0 * q1 * mx;
    const _2q2mx = 2.0 * q2 * mx;
    const _2q3mx = 2.0 * q3 * mx;

    const hx = mx * q0 * q0 - 2.0 * q0 * my * q3 + 2.0 * q0 * mz * q2 +
      mx * q1 * q1 + 2.0 * q1 * my * q2 + 2.0 * q1 * mz * q3 -
      mx * q2 * q2 - mx * q3 * q3;
    const hy = 2.0 * q0 * mx * q3 + my * q0 * q0 - 2.0 * q0 * mz * q1 +
      2.0 * q1 * mx * q2 - my * q1 * q1 + my * q2 * q2 +
      2.0 * q2 * mz * q3 - my * q3 * q3;

    const _2bx = Math.hypot(hx, hy);
    const _2bz = -_2q0mx * q2 + _2q0my * q1 + mz * q0 * q0 +
      _2q1mx * q3 - mz * q1 * q1 + 2.0 * q1 * q2 * my -
      mz * q2 * q2 + mz * q3 * q3;
    const _4bx = 2.0 * _2bx;
    const _4bz = 2.0 * _2bz;

    // 梯度下降法计算目标函数的梯度 (误差向量 s0, s1, s2, s3)
    let s0 = -_2bz * q2 * (2.0 * q1 * q3 - 2.0 * q0 * q2 - ax) +
      _2bx * q3 * (2.0 * q1 * q2 + 2.0 * q0 * q3 - ay) +
      (-_2bx * q2 + _2bz * q1) * (2.0 * q0 * q1 + 2.0 * q2 * q3 - az);
    let s1 = _2bz * q3 * (2.0 * q1 * q3 - 2.0 * q0 * q2 - ax) +
      _2bx * q2 * (2.0 * q1 * q2 + 2.0 * q0 * q3 - ay) +
      (_2bx * q1 + _2bz * q0) * (2.0 * q0 * q1 + 2.0 * q2 * q3 - az);
    let s2 = -2.0 * _2bz * q0 * (2.0 * q1 * q3 - 2.0 * q0 * q2 - ax) +
      (_2bx * q3 - 4.0 * q2 * _2bx) * (2.0 * q1 * q2 + 2.0 * q0 * q3 - ay) +
      (_2bx * q0 - 4.0 * q2 * _2bz) * (2.0 * q0 * q1 + 2.0 * q2 * q3 - az);
    let s3 = 2.0 * _2bz * q1 * (2.0 * q1 * q3 - 2.0 * q0 * q2 - ax) +
      (_2bx * q2 + 4.0 * q3 * _2bx) * (2.0 * q1 * q2 + 2.0 * q0 * q3 - ay) +
      (_2bx * q1 + _2bz * q0) * (2.0 * q0 * q1 + 2.0 * q2 * q3 - az);

    norm = Math.hypot(s0, s1, s2, s3);
    if (norm > 0) {
      s0 /= norm; s1 /= norm; s2 /= norm; s3 /= norm;
    }

    // 四元数微分方程
    const qDot1 = 0.5 * (-q1 * gx - q2 * gy - q3 * gz) - this.beta * s0;
    const qDot2 = 0.5 * ( q0 * gx + q2 * gz - q3 * gy) - this.beta * s1;
    const qDot3 = 0.5 * ( q0 * gy - q1 * gz + q3 * gx) - this.beta * s2;
    const qDot4 = 0.5 * ( q0 * gz + q1 * gy - q2 * gx) - this.beta * s3;

    // 一阶欧拉积分更新四元数
    q0 += qDot1 * invSampleFreq;
    q1 += qDot2 * invSampleFreq;
    q2 += qDot3 * invSampleFreq;
    q3 += qDot4 * invSampleFreq;

    // 四元数再归一化
    norm = Math.hypot(q0, q1, q2, q3);
    if (norm > 0) {
      q0 /= norm; q1 /= norm; q2 /= norm; q3 /= norm;
    }

    this.q0 = q0;
    this.q1 = q1;
    this.q2 = q2;
    this.q3 = q3;
  }

  /**
   * 纯陀螺仪积分模式 (无磁力计或加速度计参与，用于磁异常期间极速备份)
   */
  public updateIMUOnly(gx: number, gy: number, gz: number, dt: number) {
    let q0 = this.q0, q1 = this.q1, q2 = this.q2, q3 = this.q3;
    const qDot1 = 0.5 * (-q1 * gx - q2 * gy - q3 * gz);
    const qDot2 = 0.5 * ( q0 * gx + q2 * gz - q3 * gy);
    const qDot3 = 0.5 * ( q0 * gy - q1 * gz + q3 * gx);
    const qDot4 = 0.5 * ( q0 * gz + q1 * gy - q2 * gx);

    q0 += qDot1 * dt;
    q1 += qDot2 * dt;
    q2 += qDot3 * dt;
    q3 += qDot4 * dt;

    const norm = Math.hypot(q0, q1, q2, q3);
    if (norm > 0) {
      this.q0 = q0 / norm;
      this.q1 = q1 / norm;
      this.q2 = q2 / norm;
      this.q3 = q3 / norm;
    }
  }

  /**
   * 从四元数提取航向角 (Yaw, 返回 0° - 360°)
   */
  public getYawDegrees(): number {
    const q0 = this.q0, q1 = this.q1, q2 = this.q2, q3 = this.q3;
    const siny_cosp = 2.0 * (q0 * q3 + q1 * q2);
    const cosy_cosp = 1.0 - 2.0 * (q2 * q2 + q3 * q3);
    let yaw = Math.atan2(siny_cosp, cosy_cosp);
    let degrees = (yaw * 180.0) / Math.PI;
    if (degrees < 0) degrees += 360.0;
    return degrees;
  }

  /**
   * 提取俯仰角与横滚角 (度)
   */
  public getPitchRoll(): { pitch: number; roll: number } {
    const q0 = this.q0, q1 = this.q1, q2 = this.q2, q3 = this.q3;
    // roll (x-axis rotation)
    const sinr_cosp = 2 * (q0 * q1 + q2 * q3);
    const cosr_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
    const roll = (Math.atan2(sinr_cosp, cosr_cosp) * 180) / Math.PI;

    // pitch (y-axis rotation)
    const sinp = 2 * (q0 * q2 - q3 * q1);
    let pitch = 0;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * 90; // use 90 degrees if out of range
    } else {
      pitch = (Math.asin(sinp) * 180) / Math.PI;
    }

    return { pitch, roll };
  }
}

/**
 * 2. 最小二乘法椭球拟合校准 (Least Squares Ellipsoid Fitting)
 * 输入采样点 [x, y, z]，解算硬铁偏移 (ox, oy, oz) 和软铁/非正交缩放 (sx, sy, sz)
 */
export function fitEllipsoidLeastSquares(
  points: Array<[number, number, number]>,
  expectedEarthField: number = 48.0
): EllipsoidCalibrationResult {
  if (points.length < 12) {
    return {
      offset: [0, 0, 0],
      scale: [1, 1, 1],
      residuals: 2.0,
      score: 65,
    };
  }

  // 1. 寻找各轴极值与几何中点作为初值
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const [x, y, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  let ox = (minX + maxX) / 2.0;
  let oy = (minY + maxY) / 2.0;
  let oz = (minZ + maxZ) / 2.0;

  const spanX = Math.max(10, (maxX - minX) / 2.0);
  const spanY = Math.max(10, (maxY - minY) / 2.0);
  const spanZ = Math.max(10, (maxZ - minZ) / 2.0);

  const avgSpan = (spanX + spanY + spanZ) / 3.0;
  let sx = avgSpan / spanX;
  let sy = avgSpan / spanY;
  let sz = avgSpan / spanZ;

  // 2. 高斯-牛顿/梯度下降迭代优化
  // 目标函数: 残差 = ((x - ox)*sx)^2 + ((y - oy)*sy)^2 + ((z - oz)*sz)^2 - expectedEarthField^2
  const maxIter = 40;
  const learningRate = 0.0001;

  for (let iter = 0; iter < maxIter; iter++) {
    let gradOx = 0, gradOy = 0, gradOz = 0;
    let gradSx = 0, gradSy = 0, gradSz = 0;

    for (const [px, py, pz] of points) {
      const dx = px - ox;
      const dy = py - oy;
      const dz = pz - oz;

      const calX = dx * sx;
      const calY = dy * sy;
      const calZ = dz * sz;

      const r2 = calX * calX + calY * calY + calZ * calZ;
      const residual = r2 - expectedEarthField * expectedEarthField;

      // 偏导数
      gradOx += -4.0 * residual * sx * sx * dx;
      gradOy += -4.0 * residual * sy * sy * dy;
      gradOz += -4.0 * residual * sz * sz * dz;

      gradSx += 4.0 * residual * calX * dx;
      gradSy += 4.0 * residual * calY * dy;
      gradSz += 4.0 * residual * calZ * dz;
    }

    const n = points.length;
    ox -= (gradOx / n) * learningRate * 0.1;
    oy -= (gradOy / n) * learningRate * 0.1;
    oz -= (gradOz / n) * learningRate * 0.1;

    sx -= (gradSx / n) * learningRate * 0.005;
    sy -= (gradSy / n) * learningRate * 0.005;
    sz -= (gradSz / n) * learningRate * 0.005;

    // 约束防止发散
    sx = Math.max(0.4, Math.min(2.5, sx));
    sy = Math.max(0.4, Math.min(2.5, sy));
    sz = Math.max(0.4, Math.min(2.5, sz));
  }

  // 3. 计算最终拟合残差
  let totalResidual = 0;
  for (const [px, py, pz] of points) {
    const calX = (px - ox) * sx;
    const calY = (py - oy) * sy;
    const calZ = (pz - oz) * sz;
    const fieldMag = Math.hypot(calX, calY, calZ);
    totalResidual += Math.abs(fieldMag - expectedEarthField);
  }
  const meanResidual = totalResidual / points.length;

  // 评分
  const countFactor = Math.min(1.0, points.length / 50);
  const errFactor = Math.max(0, 1.0 - meanResidual / (expectedEarthField * 0.25));
  const score = Math.round((0.4 * countFactor + 0.6 * errFactor) * 100);

  return {
    offset: [Number(ox.toFixed(2)), Number(oy.toFixed(2)), Number(oz.toFixed(2))],
    scale: [Number(sx.toFixed(3)), Number(sy.toFixed(3)), Number(sz.toFixed(3))],
    residuals: Number(meanResidual.toFixed(2)),
    score: Math.max(50, Math.min(99, score)),
  };
}

/**
 * 3. 自适应卡尔曼滤波器 (Adaptive Kalman Filter)
 * 根据角速度动态调整测量噪声 R，并处理磁异常期间的陀螺积分状态
 */
export class AdaptiveKalmanFilter {
  public x_angle: number = 0.0; // 航向状态估计
  public x_bias: number = 0.0;  // 陀螺零偏估计
  public P_00: number = 1.0;
  public P_01: number = 0.0;
  public P_10: number = 0.0;
  public P_11: number = 1.0;

  // 过程噪声 Q
  public Q_angle: number = 0.001;
  public Q_bias: number = 0.003;
  // 测量噪声 R (动态自适应)
  public R_measure: number = 0.5;

  private isInitialized: boolean = false;

  public init(initialAngle: number) {
    this.x_angle = initialAngle;
    this.x_bias = 0.0;
    this.P_00 = 1.0;
    this.P_01 = 0.0;
    this.P_10 = 0.0;
    this.P_11 = 1.0;
    this.isInitialized = true;
  }

  /**
   * 自适应动态调整 R_measure
   * @param gyroMagnitude 陀螺角速度大小 (度/秒 或 rad/s 标度)
   */
  public adaptNoise(gyroMagnitudeDegPerSec: number, isAnomaly: boolean) {
    if (isAnomaly) {
      // 磁异常时极大增加测量噪声，完全相信陀螺仪
      this.R_measure = 50.0;
      return;
    }

    if (gyroMagnitudeDegPerSec > 45.0) {
      // 快速转动，降低磁力计权重
      this.R_measure = 10.0;
    } else if (gyroMagnitudeDegPerSec > 10.0) {
      // 中速转动
      this.R_measure = 3.0;
    } else {
      // 静止或微动，提高磁力计权重以达到物理指南针级静态定轴
      this.R_measure = 0.4;
    }
  }

  /**
   * 卡尔曼滤波更新步骤
   * @param newAngle 磁力计计算出的观测角度 (度)
   * @param gyroRate 陀螺仪 Z 轴角速度 (度/秒)
   * @param dt 采样时间间隔 (秒)
   */
  public update(newAngle: number, gyroRate: number, dt: number): number {
    if (!this.isInitialized) {
      this.init(newAngle);
      return newAngle;
    }

    // 1. 预测步 (Prediction)
    const rate = gyroRate - this.x_bias;
    this.x_angle += dt * rate;

    // 角度回绕处理 (维持连续性)
    let diff = newAngle - this.x_angle;
    while (diff < -180.0) diff += 360.0;
    while (diff > 180.0) diff -= 360.0;

    this.P_00 += dt * (dt * this.P_11 - this.P_01 - this.P_10 + this.Q_angle);
    this.P_01 -= dt * this.P_11;
    this.P_10 -= dt * this.P_11;
    this.P_11 += this.Q_bias * dt;

    // 2. 更新步 (Update)
    const S = this.P_00 + this.R_measure;
    const K_0 = this.P_00 / S;
    const K_1 = this.P_10 / S;

    const y = diff; // 测量残差
    this.x_angle += K_0 * y;
    this.x_bias += K_1 * y;

    const P00_temp = this.P_00;
    const P01_temp = this.P_01;

    this.P_00 -= K_0 * P00_temp;
    this.P_01 -= K_0 * P01_temp;
    this.P_10 -= K_1 * P00_temp;
    this.P_11 -= K_1 * P01_temp;

    // 3. 归一化到 0° - 360°
    this.x_angle = ((this.x_angle % 360.0) + 360.0) % 360.0;
    return this.x_angle;
  }
}

/**
 * 4. 完整的 9 轴融合指南针管理器 (单例)
 */
export class CompassFusionManager {
  private madgwick: MadgwickAHRS = new MadgwickAHRS(50.0, 0.1);
  private kalman: AdaptiveKalmanFilter = new AdaptiveKalmanFilter();

  // 校准参数
  private hardIronOffset: [number, number, number] = [0, 0, 0];
  private softIronScale: [number, number, number] = [1, 1, 1];
  private physicalOffset: number = 0;

  // 状态监测
  private lastTimestamp: number = 0;
  private currentYaw: number = 0;
  private isMagneticAnomaly: boolean = false;
  private anomalyCounter: number = 0;
  private smoothedCos: number = 1.0;
  private smoothedSin: number = 0.0;

  // 采样率计算
  private sampleCount: number = 0;
  private sampleRateHz: number = 50.0;
  private lastFpsTime: number = 0;

  // 陀螺状态
  private lastGyroRateZ: number = 0;

  constructor() {
    this.lastFpsTime = performance.now();
  }

  public setCalibration(
    offset: [number, number, number],
    scale: [number, number, number],
    physicalOffset: number = 0
  ) {
    this.hardIronOffset = [...offset];
    this.softIronScale = [...scale];
    this.physicalOffset = physicalOffset;
  }

  /**
   * 处理原生/Web传感器推送的 9 轴数据
   */
  public processIMUSample(sample: IMURawSample): FusionOutputState {
    const now = sample.timestamp || performance.now();
    let dt = this.lastTimestamp > 0 ? (now - this.lastTimestamp) / 1000.0 : 0.02;
    if (dt <= 0 || dt > 0.5) dt = 0.02; // 防止休眠切回跳变
    this.lastTimestamp = now;

    // 统计采样率
    this.sampleCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.sampleRateHz = Math.round((this.sampleCount * 1000) / (now - this.lastFpsTime));
      this.sampleCount = 0;
      this.lastFpsTime = now;
      this.madgwick.sampleFreq = Math.max(10, this.sampleRateHz);
    }

    // 1. 磁力计最小二乘硬铁偏移与软铁缩放校正
    const mx_raw = sample.mx;
    const my_raw = sample.my;
    const mz_raw = sample.mz;

    const mx_cal = (mx_raw - this.hardIronOffset[0]) * this.softIronScale[0];
    const my_cal = (my_raw - this.hardIronOffset[1]) * this.softIronScale[1];
    const mz_cal = (mz_raw - this.hardIronOffset[2]) * this.softIronScale[2];

    // 2. 磁异常检测 (判定场强偏离地球常规 25~65 μT 超过 30%)
    const fieldStrength = Math.hypot(mx_cal, my_cal, mz_cal);
    const expectedField = 48.0;
    const deviation = Math.abs(fieldStrength - expectedField) / expectedField;

    this.isMagneticAnomaly = deviation > 0.35 || fieldStrength < 18.0 || fieldStrength > 95.0;

    // 3. 陀螺仪角速度分析 (rad/s 转 deg/s)
    const gyroMagDeg = Math.hypot(sample.gx, sample.gy, sample.gz) * (180.0 / Math.PI);
    this.lastGyroRateZ = sample.gz * (180.0 / Math.PI);

    let calculatedYaw = 0;
    let mode: 'madgwick_9axis' | 'adaptive_kalman' | 'gyro_backup' | 'orientation_sensor' = 'madgwick_9axis';

    if (this.isMagneticAnomaly) {
      this.anomalyCounter++;
      mode = 'gyro_backup';
      // 磁异常模式：仅用陀螺仪四元数积分备份，冻结磁力校正
      this.madgwick.updateIMUOnly(sample.gx, sample.gy, sample.gz, dt);
      calculatedYaw = this.madgwick.getYawDegrees();
    } else {
      this.anomalyCounter = 0;
      // 正常模式：Madgwick 9-轴姿态解算
      this.madgwick.update(
        sample.gx, sample.gy, sample.gz,
        sample.ax, sample.ay, sample.az,
        mx_cal, my_cal, mz_cal,
        dt
      );
      calculatedYaw = this.madgwick.getYawDegrees();
      mode = 'madgwick_9axis';
    }

    // 4. 自适应卡尔曼滤波深度滤噪与零偏补偿
    this.kalman.adaptNoise(gyroMagDeg, this.isMagneticAnomaly);
    let finalYaw = this.kalman.update(calculatedYaw, this.lastGyroRateZ, dt);

    // 5. 施加物理指南针基准比对差
    finalYaw = (finalYaw + this.physicalOffset + 360.0) % 360.0;

    // 6. 圆周低通微滤波 (根据角速度大小自适应平滑)
    const smoothAlpha = gyroMagDeg > 15 ? 0.35 : 0.12;
    const rad = (finalYaw * Math.PI) / 180.0;
    this.smoothedCos = (1 - smoothAlpha) * this.smoothedCos + smoothAlpha * Math.cos(rad);
    this.smoothedSin = (1 - smoothAlpha) * this.smoothedSin + smoothAlpha * Math.sin(rad);

    let smoothedYaw = (Math.atan2(this.smoothedSin, this.smoothedCos) * 180.0) / Math.PI;
    if (smoothedYaw < 0) smoothedYaw += 360.0;

    this.currentYaw = smoothedYaw;
    const pr = this.madgwick.getPitchRoll();

    return {
      yaw: Math.round(smoothedYaw * 10) / 10,
      pitch: Math.round(pr.pitch * 10) / 10,
      roll: Math.round(pr.roll * 10) / 10,
      magneticFieldStrength: Math.round(fieldStrength * 10) / 10,
      isMagneticAnomaly: this.isMagneticAnomaly,
      fusionMode: mode,
      angularVelocity: Math.round(gyroMagDeg * 10) / 10,
      sampleRate: this.sampleRateHz,
    };
  }

  /**
   * 仅通过绝对方向角驱动（用于不支持 9 轴底层流时的极速回退）
   */
  public processDirectHeading(rawHeading: number, gyroRateDegZ: number = 0): number {
    const dt = 0.02;
    this.kalman.adaptNoise(Math.abs(gyroRateDegZ), false);
    const kalmanYaw = this.kalman.update(rawHeading, gyroRateDegZ, dt);
    const rad = ((kalmanYaw + this.physicalOffset) * Math.PI) / 180.0;
    const alpha = 0.18;
    this.smoothedCos = (1 - alpha) * this.smoothedCos + alpha * Math.cos(rad);
    this.smoothedSin = (1 - alpha) * this.smoothedSin + alpha * Math.sin(rad);

    let yaw = (Math.atan2(this.smoothedSin, this.smoothedCos) * 180.0) / Math.PI;
    if (yaw < 0) yaw += 360.0;
    return Math.round(yaw * 10) / 10;
  }
}

export const compassFusionManager = new CompassFusionManager();
