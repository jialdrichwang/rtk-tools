import { CoordSystemType, AngleFormatType, SevenParameters } from '../types';

export interface Ellipsoid {
  a: number; // 长半轴 (m)
  f: number; // 扁率 1/f
}

export const ELLIPSOIDS: Record<CoordSystemType, Ellipsoid> = {
  CGCS2000: { a: 6378137.0, f: 1 / 298.257222101 },
  WGS84: { a: 6378137.0, f: 1 / 298.257223563 },
  Beijing54: { a: 6378245.0, f: 1 / 298.3 },
  Xian80: { a: 6378140.0, f: 1 / 298.257 },
};

/**
 * Calculates standard 3-degree or 6-degree central meridian given a longitude
 */
export function getRecommendedCentralMeridian(lon: number, is3Degree = true): number {
  if (is3Degree) {
    const zone = Math.round(lon / 3.0);
    return zone * 3.0;
  } else {
    const zone = Math.floor(lon / 6.0) + 1;
    return zone * 6.0 - 3.0;
  }
}

/**
 * Converts Decimal Degrees to DMS format { deg, min, sec, str }
 */
export function ddToDMS(dd: number): { deg: number; min: number; sec: number; str: string } {
  const sign = dd < 0 ? -1 : 1;
  const abs = Math.abs(dd);
  const deg = Math.floor(abs);
  const remMin = (abs - deg) * 60;
  const min = Math.floor(remMin);
  const sec = (remMin - min) * 60;

  const roundedSec = Math.round(sec * 10000) / 10000;
  const str = `${sign < 0 ? '-' : ''}${deg}°${min.toString().padStart(2, '0')}'${roundedSec.toFixed(4)}"`;
  return { deg: sign * deg, min, sec: roundedSec, str };
}

/**
 * Parses DMS numbers into decimal degrees
 */
export function dmsToDD(deg: number, min: number, sec: number): number {
  const sign = deg < 0 ? -1 : 1;
  const absDeg = Math.abs(deg);
  return sign * (absDeg + min / 60.0 + sec / 3600.0);
}

/**
 * Formats angle based on format type
 */
export function formatAngle(dd: number, format: AngleFormatType = 'dms'): string {
  if (format === 'dd') {
    return dd.toFixed(8) + '°';
  }
  if (format === 'dm') {
    const sign = dd < 0 ? '-' : '';
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    return `${sign}${deg}°${min.toFixed(5)}'`;
  }
  return ddToDMS(dd).str;
}

/**
 * Gauss-Krüger Forward Projection (Lat/Lon -> Plane X [North], Plane Y [East])
 * @param lat Latitude in decimal degrees
 * @param lon Longitude in decimal degrees
 * @param centralMeridian Central meridian in decimal degrees (e.g. 114)
 * @param sys Coordinate system ellipsoid
 * @param falseEasting Default 500000 (standard false easting)
 */
export function latLonToGauss(
  lat: number,
  lon: number,
  centralMeridian: number,
  sys: CoordSystemType = 'CGCS2000',
  falseEasting = 500000
): { x: number; y: number } {
  const ellip = ELLIPSOIDS[sys] || ELLIPSOIDS.CGCS2000;
  const a = ellip.a;
  const f = ellip.f;
  const e2 = 2 * f - f * f; // 第一偏心率平方
  const ePrime2 = e2 / (1 - e2); // 第二偏心率平方

  const radLat = (lat * Math.PI) / 180;
  const deltaLonRad = ((lon - centralMeridian) * Math.PI) / 180;

  const sinB = Math.sin(radLat);
  const cosB = Math.cos(radLat);
  const t = Math.tan(radLat);
  const eta2 = ePrime2 * cosB * cosB;

  // 卯酉圈曲率半径 N
  const N = a / Math.sqrt(1 - e2 * sinB * sinB);

  // 子午线弧长 X0
  const m0 = a * (1 - e2);
  const m2 = 1.5 * e2;
  const m4 = (15 / 8) * e2 * e2;
  const m6 = (35 / 16) * Math.pow(e2, 3);
  const m8 = (315 / 128) * Math.pow(e2, 4);

  const a0 = m0 * (1 + m2 + m4 + m6 + m8);
  const a2 = -0.5 * m0 * (m2 + (4 / 3) * m4 + 1.5 * m6 + (8 / 5) * m8);
  const a4 = 0.25 * m0 * (m4 / 3 + 0.6 * m6 + (5 / 7) * m8);
  const a6 = (-1 / 6) * m0 * (m6 / 5 + (2 / 7) * m8);

  const X0 =
    a0 * radLat +
    a2 * Math.sin(2 * radLat) +
    a4 * Math.sin(4 * radLat) +
    a6 * Math.sin(6 * radLat);

  const l = deltaLonRad;
  const l2 = l * l;
  const l3 = l2 * l;
  const l4 = l2 * l2;
  const l5 = l4 * l;
  const l6 = l3 * l3;

  // 高斯投影公式
  const x =
    X0 +
    (N / 2) * sinB * cosB * l2 +
    (N / 24) * sinB * Math.pow(cosB, 3) * (5 - t * t + 9 * eta2 + 4 * eta2 * eta2) * l4 +
    (N / 720) * sinB * Math.pow(cosB, 5) * (61 - 58 * t * t + Math.pow(t, 4)) * l6;

  const y =
    N * cosB * l +
    (N / 6) * Math.pow(cosB, 3) * (1 - t * t + eta2) * l3 +
    (N / 120) * Math.pow(cosB, 5) * (5 - 18 * t * t + Math.pow(t, 4) + 14 * eta2 - 58 * t * t * eta2) * l5 +
    falseEasting;

  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}

/**
 * Gauss-Krüger Inverse Projection (Plane X [North], Plane Y [East] -> Lat/Lon)
 */
export function gaussToLatLon(
  x: number,
  y: number,
  centralMeridian: number,
  sys: CoordSystemType = 'CGCS2000',
  falseEasting = 500000
): { lat: number; lon: number } {
  const ellip = ELLIPSOIDS[sys] || ELLIPSOIDS.CGCS2000;
  const a = ellip.a;
  const f = ellip.f;
  const e2 = 2 * f - f * f;
  const ePrime2 = e2 / (1 - e2);

  const yPrime = y - falseEasting;

  // 迭代求底点纬度 Bf
  let Bf = x / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * Math.pow(e2, 3)) / 256));
  for (let i = 0; i < 6; i++) {
    const sin2B = Math.sin(2 * Bf);
    const sin4B = Math.sin(4 * Bf);
    const sin6B = Math.sin(6 * Bf);
    const a0 = a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * Math.pow(e2, 3)) / 256);
    const a2 = a * ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * Math.pow(e2, 3)) / 1024);
    const a4 = a * ((15 * e2 * e2) / 256 + (45 * Math.pow(e2, 3)) / 1024);
    const a6 = a * ((35 * Math.pow(e2, 3)) / 3072);
    const X0 = a0 * Bf - a2 * sin2B + a4 * sin4B - a6 * sin6B;
    const diff = (x - X0) / a0;
    Bf += diff;
    if (Math.abs(diff) < 1e-12) break;
  }

  const sinBf = Math.sin(Bf);
  const cosBf = Math.cos(Bf);
  const t = Math.tan(Bf);
  const eta2 = ePrime2 * cosBf * cosBf;
  const Nf = a / Math.sqrt(1 - e2 * sinBf * sinBf);
  const Mf = (a * (1 - e2)) / Math.pow(1 - e2 * sinBf * sinBf, 1.5);

  const yRatio = yPrime / Nf;

  const latRad =
    Bf -
    ((t * Nf) / (2 * Mf)) * Math.pow(yRatio, 2) +
    ((t * Nf) / (24 * Mf)) * (5 + 3 * t * t + eta2 - 9 * eta2 * t * t) * Math.pow(yRatio, 4) -
    ((t * Nf) / (720 * Mf)) * (61 + 90 * t * t + 45 * Math.pow(t, 4)) * Math.pow(yRatio, 6);

  const lonRad =
    (1 / cosBf) * yRatio -
    (1 / (6 * cosBf)) * (1 + 2 * t * t + eta2) * Math.pow(yRatio, 3) +
    (1 / (120 * cosBf)) * (5 + 28 * t * t + 24 * Math.pow(t, 4) + 6 * eta2 + 8 * eta2 * t * t) * Math.pow(yRatio, 5);

  const lat = (latRad * 180) / Math.PI;
  const lon = centralMeridian + (lonRad * 180) / Math.PI;

  return { lat: Math.round(lat * 1e8) / 1e8, lon: Math.round(lon * 1e8) / 1e8 };
}

/**
 * Seven-Parameter Bursa-Wolf Transformation between coordinate datums
 */
export function applySevenParams(
  x: number,
  y: number,
  z: number,
  params: SevenParameters
): { x: number; y: number; z: number } {
  const m = 1.0 + params.scale * 1e-6;
  const rxRad = (params.rx / 3600.0) * (Math.PI / 180.0);
  const ryRad = (params.ry / 3600.0) * (Math.PI / 180.0);
  const rzRad = (params.rz / 3600.0) * (Math.PI / 180.0);

  const newX = params.dx + m * (x + rzRad * y - ryRad * z);
  const newY = params.dy + m * (-rzRad * x + y + rxRad * z);
  const newZ = params.dz + m * (ryRad * x - rxRad * y + z);

  return { x: newX, y: newY, z: newZ };
}

/**
 * Calculates planar distance and azimuth from Point A (x1, y1) to Point B (x2, y2)
 */
export function calculateDistanceAndAzimuth(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { distance: number; azimuth: number; azimuthDms: string } {
  const dx = x2 - x1; // 北坐标差
  const dy = y2 - y1; // 东坐标差
  const distance = Math.sqrt(dx * dx + dy * dy);

  let angleRad = Math.atan2(dy, dx);
  let azimuthDeg = (angleRad * 180) / Math.PI;
  if (azimuthDeg < 0) azimuthDeg += 360;

  return {
    distance: Math.round(distance * 1000) / 1000,
    azimuth: Math.round(azimuthDeg * 1000) / 1000,
    azimuthDms: ddToDMS(azimuthDeg).str,
  };
}

/**
 * Haversine Great Circle Distance on Sphere (meters)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates Area of 2D Polygon using Gauss's Area Formula (Shoelace formula) in m²
 */
export function calculatePolygonArea(points: Array<{ x: number; y: number }>): {
  areaSqm: number;
  areaMu: number;
  areaHa: number;
  perimeter: number;
} {
  if (points.length < 3) {
    return { areaSqm: 0, areaMu: 0, areaHa: 0, perimeter: 0 };
  }

  let area = 0;
  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    area += p1.y * p2.x - p2.y * p1.x;
    const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    perimeter += dist;
  }

  const absArea = Math.abs(area) / 2.0;
  const areaMu = absArea * 0.0015; // 1 m² = 0.0015 亩
  const areaHa = absArea / 10000; // 1 公顷 = 10000 m²

  return {
    areaSqm: Math.round(absArea * 100) / 100,
    areaMu: Math.round(areaMu * 1000) / 1000,
    areaHa: Math.round(areaHa * 10000) / 10000,
    perimeter: Math.round(perimeter * 100) / 100,
  };
}

/**
 * Stakeout calculation from current position to target point
 */
export interface StakeoutGuidance {
  distanceToTarget: number;
  deltaX: number; // 北向偏差
  deltaY: number; // 东向偏差
  deltaH: number; // 高程偏差 (填/挖)
  forward: number; // 沿当前航向前/后 (m)
  right: number; // 沿当前航向右/左 (m)
  targetAzimuth: number; // 目标方位角
  relativeBearing: number; // 相对当前航向的夹角 (-180 ~ +180)
  isAligned: boolean; // 是否在0.02m放样容差内
}

export function calculateStakeoutGuidance(
  currX: number,
  currY: number,
  currH: number,
  targetX: number,
  targetY: number,
  targetH: number,
  headingDeg: number = 0
): StakeoutGuidance {
  const dx = targetX - currX; // 北
  const dy = targetY - currY; // 东
  const dh = targetH - currH; // 高程

  const dist = Math.sqrt(dx * dx + dy * dy);

  let targetAzimuth = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (targetAzimuth < 0) targetAzimuth += 360;

  let relBearing = targetAzimuth - headingDeg;
  while (relBearing > 180) relBearing -= 360;
  while (relBearing < -180) relBearing += 360;

  // 投影到机头坐标系 (Forward / Right)
  const headingRad = (headingDeg * Math.PI) / 180;
  const forward = dx * Math.cos(headingRad) + dy * Math.sin(headingRad);
  const right = -dx * Math.sin(headingRad) + dy * Math.cos(headingRad);

  return {
    distanceToTarget: Math.round(dist * 1000) / 1000,
    deltaX: Math.round(dx * 1000) / 1000,
    deltaY: Math.round(dy * 1000) / 1000,
    deltaH: Math.round(dh * 1000) / 1000,
    forward: Math.round(forward * 1000) / 1000,
    right: Math.round(right * 1000) / 1000,
    targetAzimuth: Math.round(targetAzimuth * 10) / 10,
    relativeBearing: Math.round(relBearing * 10) / 10,
    isAligned: dist <= 0.02, // 2厘米精度容差
  };
}

/**
 * Line stakeout: projects current position onto line segment AB
 * Returns chainage mileage (里程) and normal offset (偏距 左/右)
 */
export function calculateLineStakeout(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  px: number,
  py: number,
  startChainage = 0
): {
  chainage: number;
  offset: number; // 正为右偏，负为左偏
  projX: number;
  projY: number;
  totalLength: number;
} {
  const lineDx = x2 - x1;
  const lineDy = y2 - y1;
  const length = Math.sqrt(lineDx * lineDx + lineDy * lineDy);

  if (length === 0) {
    return { chainage: startChainage, offset: 0, projX: x1, projY: y1, totalLength: 0 };
  }

  // 矢量点乘
  const u = ((px - x1) * lineDx + (py - y1) * lineDy) / (length * length);
  const projX = x1 + u * lineDx;
  const projY = y1 + u * lineDy;

  // 叉乘求左/右偏
  const cross = lineDx * (py - y1) - lineDy * (px - x1);
  const offset = (cross / length);

  const chainage = startChainage + u * length;

  return {
    chainage: Math.round(chainage * 1000) / 1000,
    offset: Math.round(offset * 1000) / 1000,
    projX: Math.round(projX * 1000) / 1000,
    projY: Math.round(projY * 1000) / 1000,
    totalLength: Math.round(length * 1000) / 1000,
  };
}
