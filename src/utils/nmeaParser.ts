/**
 * Professional Survey-Grade NMEA-0183 Sentence Parser
 * Decodes GNSS RTK telemetry streams from external Bluetooth receivers,
 * AndroidBridge serial SPP interfaces, or virtual mock pipes.
 */

import { RTKSolutionType } from '../types';

export interface ParsedNmeaResult {
  sentenceType: 'GGA' | 'RMC' | 'GSA' | 'GST' | 'VTG' | 'OTHER';
  raw: string;
  timestamp: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  solution?: RTKSolutionType;
  satsUsed?: number;
  satsTracked?: number;
  hdop?: number;
  pdop?: number;
  vdop?: number;
  hrms?: number;
  vrms?: number;
  speed?: number; // m/s
  heading?: number; // degrees
  ageOfDiff?: number;
  baseStationId?: string;
}

/**
 * Converts NMEA coordinate format (DDMM.MMMMM or DDDMM.MMMMM) to decimal degrees
 */
export function parseNmeaCoordToDecimal(valStr: string, dirStr: string, isLon: boolean): number | undefined {
  if (!valStr || !dirStr) return undefined;
  const num = parseFloat(valStr);
  if (isNaN(num)) return undefined;

  const degDigits = isLon ? 3 : 2;
  const degrees = Math.floor(num / 100);
  const minutes = num - degrees * 100;
  let dec = degrees + minutes / 60;

  const dir = dirStr.trim().toUpperCase();
  if (dir === 'S' || dir === 'W') {
    dec = -dec;
  }
  return dec;
}

/**
 * Parses a single NMEA sentence
 */
export function parseNmeaSentence(sentence: string): ParsedNmeaResult | null {
  if (!sentence || !sentence.startsWith('$')) return null;

  // Strip optional trailing checksum (*XX) and whitespace
  const clean = sentence.trim().replace(/\r|\n/g, '');
  const starIndex = clean.indexOf('*');
  const payload = starIndex >= 0 ? clean.slice(1, starIndex) : clean.slice(1);
  const parts = payload.split(',');

  const tag = parts[0]?.toUpperCase() || '';
  const now = Date.now();

  // GGA: Global Positioning System Fix Data
  // $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
  if (tag.endsWith('GGA')) {
    const lat = parseNmeaCoordToDecimal(parts[2], parts[3], false);
    const lon = parseNmeaCoordToDecimal(parts[4], parts[5], true);
    const qual = parseInt(parts[6] || '0', 10);
    const sats = parseInt(parts[7] || '0', 10);
    const hdop = parseFloat(parts[8] || '0');
    const alt = parseFloat(parts[9] || '0');
    const age = parseFloat(parts[13] || '0');
    const baseId = parts[14] || '';

    let sol: RTKSolutionType = 'SINGLE';
    let defaultHrms = 1.2;
    let defaultVrms = 2.4;

    switch (qual) {
      case 4: // RTK Fixed
        sol = 'FIXED';
        defaultHrms = 0.008;
        defaultVrms = 0.015;
        break;
      case 5: // RTK Float
        sol = 'FLOAT';
        defaultHrms = 0.045;
        defaultVrms = 0.085;
        break;
      case 2: // DGPS
        sol = 'DGPS';
        defaultHrms = 0.45;
        defaultVrms = 0.9;
        break;
      case 1: // Single
        sol = 'SINGLE';
        defaultHrms = 1.5;
        defaultVrms = 3.0;
        break;
      default:
        sol = 'SINGLE';
        break;
    }

    return {
      sentenceType: 'GGA',
      raw: sentence,
      timestamp: now,
      latitude: lat,
      longitude: lon,
      altitude: isNaN(alt) ? undefined : alt,
      solution: sol,
      satsUsed: isNaN(sats) ? undefined : sats,
      hdop: isNaN(hdop) ? undefined : hdop,
      hrms: defaultHrms,
      vrms: defaultVrms,
      ageOfDiff: isNaN(age) ? undefined : age,
      baseStationId: baseId || undefined,
    };
  }

  // RMC: Recommended Minimum Specific GNSS Data
  // $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
  if (tag.endsWith('RMC')) {
    const lat = parseNmeaCoordToDecimal(parts[3], parts[4], false);
    const lon = parseNmeaCoordToDecimal(parts[5], parts[6], true);
    const speedKnots = parseFloat(parts[7] || '0');
    const trackAngle = parseFloat(parts[8] || '0');

    // 1 knot = 0.514444 m/s
    const speedMps = !isNaN(speedKnots) ? speedKnots * 0.514444 : undefined;
    const heading = !isNaN(trackAngle) ? trackAngle : undefined;

    return {
      sentenceType: 'RMC',
      raw: sentence,
      timestamp: now,
      latitude: lat,
      longitude: lon,
      speed: speedMps !== undefined ? Math.round(speedMps * 10) / 10 : undefined,
      heading: heading !== undefined ? Math.round(heading * 10) / 10 : undefined,
    };
  }

  // VTG: Course over ground and Ground speed
  // $GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48
  if (tag.endsWith('VTG')) {
    const trackTrue = parseFloat(parts[1] || '0');
    const speedKmh = parseFloat(parts[7] || '0');
    const speedMps = !isNaN(speedKmh) ? speedKmh / 3.6 : undefined;
    const heading = !isNaN(trackTrue) ? trackTrue : undefined;

    return {
      sentenceType: 'VTG',
      raw: sentence,
      timestamp: now,
      speed: speedMps !== undefined ? Math.round(speedMps * 10) / 10 : undefined,
      heading: heading !== undefined ? Math.round(heading * 10) / 10 : undefined,
    };
  }

  // GSA: GNSS DOP and Active Satellites
  // $GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1*39
  if (tag.endsWith('GSA')) {
    const pdop = parseFloat(parts[parts.length - 3] || '0');
    const hdop = parseFloat(parts[parts.length - 2] || '0');
    const vdop = parseFloat(parts[parts.length - 1] || '0');

    // Count satellite PRNs
    let satsCount = 0;
    for (let i = 3; i <= 14; i++) {
      if (parts[i] && parts[i].trim()) satsCount++;
    }

    return {
      sentenceType: 'GSA',
      raw: sentence,
      timestamp: now,
      pdop: isNaN(pdop) ? undefined : pdop,
      hdop: isNaN(hdop) ? undefined : hdop,
      vdop: isNaN(vdop) ? undefined : vdop,
      satsUsed: satsCount > 0 ? satsCount : undefined,
    };
  }

  // GST: GNSS Pseudorange Noise Statistics (Survey HRMS / VRMS)
  // $GPGST,024603.00,3.2,6.6,6.1,47.3,0.012,0.015,0.024*71
  if (tag.endsWith('GST')) {
    const latStd = parseFloat(parts[6] || '0');
    const lonStd = parseFloat(parts[7] || '0');
    const altStd = parseFloat(parts[8] || '0');

    const hrms = !isNaN(latStd) && !isNaN(lonStd) ? Math.hypot(latStd, lonStd) : undefined;
    const vrms = !isNaN(altStd) ? altStd : undefined;

    return {
      sentenceType: 'GST',
      raw: sentence,
      timestamp: now,
      hrms: hrms !== undefined ? Math.round(hrms * 1000) / 1000 : undefined,
      vrms: vrms !== undefined ? Math.round(vrms * 1000) / 1000 : undefined,
    };
  }

  return {
    sentenceType: 'OTHER',
    raw: sentence,
    timestamp: now,
  };
}
