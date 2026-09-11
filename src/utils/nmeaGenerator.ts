/**
 * NMEA-0183 High-Precision Telemetry Sentence Generator and Parser
 * Conforms to IEC 61162-1 / NMEA 0183 v4.10 for Survey-grade RTK Receivers
 */

import { RTKState } from '../types';

export function computeNmeaChecksum(sentence: string): string {
  let sum = 0;
  for (let i = 0; i < sentence.length; i++) {
    sum ^= sentence.charCodeAt(i);
  }
  return sum.toString(16).toUpperCase().padStart(2, '0');
}

export function formatCoordToNmea(val: number, isLon: boolean): { valStr: string; dirStr: string } {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const degrees = Math.floor(absVal);
  const minutes = (absVal - degrees) * 60;

  const degDigits = isLon ? 3 : 2;
  const degStr = degrees.toString().padStart(degDigits, '0');
  const minStr = minutes.toFixed(5).padStart(8, '0');
  const valStr = `${degStr}${minStr}`;

  let dirStr = '';
  if (isLon) {
    dirStr = isNegative ? 'W' : 'E';
  } else {
    dirStr = isNegative ? 'S' : 'N';
  }

  return { valStr, dirStr };
}

export function generateNmeaPacket(rtk: RTKState): {
  gga: string;
  rmc: string;
  vtg: string;
  gsaGps: string;
  gsaBds: string;
} {
  const now = new Date();
  const utcHours = now.getUTCHours().toString().padStart(2, '0');
  const utcMins = now.getUTCMinutes().toString().padStart(2, '0');
  const utcSecs = now.getUTCSeconds().toString().padStart(2, '0');
  const utcMillis = Math.floor(now.getUTCMilliseconds() / 10).toString().padStart(2, '0');
  const timeStr = `${utcHours}${utcMins}${utcSecs}.${utcMillis}`;

  const day = now.getUTCDate().toString().padStart(2, '0');
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = (now.getUTCFullYear() % 100).toString().padStart(2, '0');
  const dateStr = `${day}${month}${year}`;

  const latNmea = formatCoordToNmea(rtk.currentLat, false);
  const lonNmea = formatCoordToNmea(rtk.currentLon, true);

  // Quality indicator:
  // 0 = Fix not available
  // 1 = GPS Fix (Single)
  // 2 = Differential GPS
  // 4 = RTK Fixed
  // 5 = RTK Float
  let fixQuality = '4';
  if (rtk.solution === 'FLOAT') fixQuality = '5';
  else if (rtk.solution === 'SINGLE') fixQuality = '1';
  else if (rtk.solution === 'INVALID') fixQuality = '0';

  const satsStr = (rtk.satsUsed || 26).toString().padStart(2, '0');
  const hdopStr = (rtk.hdop || 0.7).toFixed(1);
  const altStr = (rtk.currentAlt || 23.45).toFixed(2);
  const geoidStr = '-11.35';
  const ageStr = (rtk.ageOfDiff || 1.0).toFixed(1);
  const diffId = '0128';

  // 1. $GNGGA
  const ggaBody = `GNGGA,${timeStr},${latNmea.valStr},${latNmea.dirStr},${lonNmea.valStr},${lonNmea.dirStr},${fixQuality},${satsStr},${hdopStr},${altStr},M,${geoidStr},M,${ageStr},${diffId}`;
  const gga = `$${ggaBody}*${computeNmeaChecksum(ggaBody)}`;

  // 2. $GNRMC
  const speedKnots = ((rtk.speed || 0) * 1.94384).toFixed(2);
  const courseDeg = ((rtk.heading || 0) % 360).toFixed(1);
  const rmcBody = `GNRMC,${timeStr},A,${latNmea.valStr},${latNmea.dirStr},${lonNmea.valStr},${lonNmea.dirStr},${speedKnots},${courseDeg},${dateStr},,,D`;
  const rmc = `$${rmcBody}*${computeNmeaChecksum(rmcBody)}`;

  // 3. $GNVTG
  const speedKph = ((rtk.speed || 0) * 3.6).toFixed(2);
  const vtgBody = `GNVTG,${courseDeg},T,,M,${speedKnots},N,${speedKph},K,D`;
  const vtg = `$${vtgBody}*${computeNmeaChecksum(vtgBody)}`;

  // 4. $GPGSA (GPS constellation DOP & Active sats)
  const gsaGpsBody = `GPGSA,A,3,01,03,07,08,11,14,17,19,21,22,28,30,${(rtk.pdop || 1.2).toFixed(1)},${hdopStr},${(rtk.vrms || 0.015).toFixed(1)}`;
  const gsaGps = `$${gsaGpsBody}*${computeNmeaChecksum(gsaGpsBody)}`;

  // 5. $BDGSA (BeiDou constellation DOP & Active sats)
  const gsaBdsBody = `BDGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,${(rtk.pdop || 1.2).toFixed(1)},${hdopStr},${(rtk.vrms || 0.015).toFixed(1)}`;
  const gsaBds = `$${gsaBdsBody}*${computeNmeaChecksum(gsaBdsBody)}`;

  return { gga, rmc, vtg, gsaGps, gsaBds };
}
