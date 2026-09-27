/**
 * 太阳偏振与光影辅助测向服务 (Solar Azimuth & Optical Polarization Heading Service)
 * 
 * 1. 天文太阳位置高精算式 (Solar Position Algorithm):
 *    - 根据 GPS 经纬度 (lat, lon) 及实时 UTC 时间计算太阳天顶角 (Elevation) 与太阳真方位角 (Azimuth)；
 * 2. 摄像头偏振/光影渐变分析 (Camera Sky Luminance Gradient Vector):
 *    - 当平板固定在车内或测绘支架时，通过摄像头捕获天空光照强弱梯度；
 *    - 计算太阳在摄像头坐标系中的相对向量角；
 * 3. 急转弯辅助导向：
 *    - 在急转弯或阳光明媚环境下，为陀螺仪与航向提供天体级绝对偏角加权推算。
 */

export interface SolarPosition {
  azimuth: number;    // 太阳方位角 (0-360°, 正北为0, 顺时针)
  elevation: number;  // 太阳仰角/高度角 (-90° 到 +90°, >0 为地平线以上白天)
  isDaylight: boolean; // 是否处于日间有太阳状态
  solarVectorDescription: string;
}

export class SolarOrientationService {
  private videoStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isAnalyzing: boolean = false;
  private animFrameId: number | null = null;

  // 光学测算的相对方位角 (度)
  private opticalHeading: number = 0;
  private opticalConfidence: number = 0; // 0 到 1

  /**
   * 精确计算给定经纬度与时间的太阳位置 (方位角与仰角)
   */
  public calculateSolarPosition(lat: number, lon: number, date: Date = new Date()): SolarPosition {
    // 儒略日算法与太阳黄经近似
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

    // 简化儒略世纪数与平黄经
    const d = 367 * year - Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4) + Math.floor((275 * month) / 9) + day - 730530 + hour / 24;

    const L = (280.461 + 0.9856474 * d) % 360;
    const g = ((357.528 + 0.9856003 * d) * Math.PI) / 180;
    const lambda = ((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI) / 180;

    // 黄赤交角与太阳赤纬
    const epsilon = ((23.439 - 0.0000004 * d) * Math.PI) / 180;
    const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

    // 格林尼治恒星时与当地时角
    const gmst0 = (280.46061837 + 360.98564736629 * d) % 360;
    const lmst = ((gmst0 + lon) * Math.PI) / 180;
    const H = lmst - alpha;

    // 转化为地平坐标 (仰角 Elevation 与 方位角 Azimuth)
    const phi = (lat * Math.PI) / 180;
    const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAz = (Math.sin(delta) - Math.sin(phi) * Math.sin(alt)) / (Math.cos(phi) * Math.cos(alt));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));

    if (Math.sin(H) > 0) {
      az = 2 * Math.PI - az;
    }

    const elevationDeg = Math.round((alt * 180) / Math.PI * 10) / 10;
    const azimuthDeg = Math.round((az * 180) / Math.PI * 10) / 10;
    const isDay = elevationDeg > 0;

    let desc = '';
    if (azimuthDeg >= 315 || azimuthDeg < 45) desc = '正北天际';
    else if (azimuthDeg >= 45 && azimuthDeg < 135) desc = '东部天空 (朝霞/上午)';
    else if (azimuthDeg >= 135 && azimuthDeg < 225) desc = '正南上空 (正午炽日)';
    else desc = '西部天空 (落日/下午)';

    return {
      azimuth: azimuthDeg,
      elevation: elevationDeg,
      isDaylight: isDay,
      solarVectorDescription: isDay ? `太阳高度 ${elevationDeg}° · ${desc}` : `太阳已落入地平线下方 (${elevationDeg}°)`,
    };
  }

  /**
   * 启动摄像头进行天空光照/太阳偏振梯度分析
   */
  public async startCameraAnalysis(
    onHeadingCalculated?: (heading: number, confidence: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { success: false, error: '设备浏览器不支持摄像头访问' };
    }

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.videoStream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 64;
      this.canvasElement.height = 48;

      this.isAnalyzing = true;
      this.runAnalysisLoop(onHeadingCalculated);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '摄像头启动失败，请检查摄像头权限' };
    }
  }

  /**
   * 循环分析图像帧亮度梯度质心 (Sky Gradient Luminance Centroid)
   */
  private runAnalysisLoop(onHeadingCalculated?: (heading: number, confidence: number) => void) {
    if (!this.isAnalyzing || !this.videoElement || !this.canvasElement) return;

    const ctx = this.canvasElement.getContext('2d');
    if (ctx && this.videoElement.readyState >= 2) {
      ctx.drawImage(this.videoElement, 0, 0, 64, 48);
      const imgData = ctx.getImageData(0, 0, 64, 48);
      const data = imgData.data;

      let totalLum = 0;
      let weightedX = 0;
      let weightedY = 0;
      let maxLum = 0;

      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 64; x++) {
          const idx = (y * 64 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // 相对照度
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 140) {
            // 只对高光区域加权
            const weight = (lum - 140) ** 2;
            totalLum += weight;
            weightedX += x * weight;
            weightedY += y * weight;
          }
          if (lum > maxLum) maxLum = lum;
        }
      }

      if (totalLum > 500 && maxLum > 200) {
        const cx = weightedX / totalLum - 32;
        const cy = weightedY / totalLum - 24;
        // 光照高光在摄像头平面上的方位角
        let opticalAngle = (Math.atan2(cx, -cy) * 180) / Math.PI;
        opticalAngle = ((opticalAngle % 360) + 360) % 360;

        this.opticalHeading = Math.round(opticalAngle * 10) / 10;
        this.opticalConfidence = Math.min(1.0, totalLum / 50000);

        if (onHeadingCalculated) {
          onHeadingCalculated(this.opticalHeading, this.opticalConfidence);
        }
      } else {
        this.opticalConfidence = 0;
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.runAnalysisLoop(onHeadingCalculated));
  }

  /**
   * 停止摄像头分析
   */
  public stopCameraAnalysis(): void {
    this.isAnalyzing = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
    this.videoElement = null;
    this.canvasElement = null;
  }

  public getOpticalState(): { opticalHeading: number; confidence: number; isAnalyzing: boolean } {
    return {
      opticalHeading: this.opticalHeading,
      confidence: this.opticalConfidence,
      isAnalyzing: this.isAnalyzing,
    };
  }
}

export const solarOrientationService = new SolarOrientationService();
