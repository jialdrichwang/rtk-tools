import { SurveyPoint, SurveyTrack } from '../types';
import { fileStorageService } from './fileStorageService';

/**
 * Downloads a string content as a file to user's device and mirrors to native file storage
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
  subfolder: 'points' | 'tracks' | 'project' | 'mapdata' = 'points'
) {
  // 1. Auto-save to /storage/emulated/0/com.rtkproject.files/<subfolder>/
  fileStorageService.saveFile(subfolder, filename, content, mimeType).catch((err) => {
    console.warn('Auto-save to storage error:', err);
  });

  // 2. Trigger browser/device file download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Survey Points to CSV format
 */
export function exportPointsToCSV(points: SurveyPoint[]): string {
  const headers = ['点名(Name)', '编码(Code)', '北坐标X(m)', '东坐标Y(m)', '高程H(m)', '经度(Lon)', '纬度(Lat)', '坐标系(Sys)', '水平精度(HRMS)', '高程精度(VRMS)', '解状态(Solution)', '采集时间(Time)', '备注(Desc)'];
  const rows = points.map(p => [
    `"${p.name || ''}"`,
    `"${p.code || ''}"`,
    p.x.toFixed(3),
    p.y.toFixed(3),
    p.elevation.toFixed(3),
    p.lon.toFixed(8),
    p.lat.toFixed(8),
    p.coordSystem,
    (p.hrms || 0.01).toFixed(3),
    (p.vrms || 0.02).toFixed(3),
    p.solutionType || 'FIXED',
    p.createdAt || '',
    `"${p.desc || ''}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

/**
 * Export Survey Points to South CASS .dat format:
 * 点名,,东坐标Y,北坐标X,高程H
 */
export function exportPointsToCASS(points: SurveyPoint[]): string {
  return points.map(p => `${p.name},${p.code || ''},${p.y.toFixed(3)},${p.x.toFixed(3)},${p.elevation.toFixed(3)}`).join('\r\n');
}

/**
 * Export Survey Points to standard Survey TXT format:
 * 点名,X,Y,H,Code
 */
export function exportPointsToTXT(points: SurveyPoint[]): string {
  return points.map(p => `${p.name},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.elevation.toFixed(3)},${p.code || ''}`).join('\r\n');
}

/**
 * Export Survey Points to KML format (for Google Earth / GIS)
 */
export function exportPointsToKML(points: SurveyPoint[], title = 'RTK_Survey_Points'): string {
  const placemarks = points.map(p => `
    <Placemark>
      <name>${p.name}</name>
      <description><![CDATA[编码: ${p.code}<br>X: ${p.x}<br>Y: ${p.y}<br>H: ${p.elevation}m<br>时间: ${p.createdAt}]]></description>
      <Point>
        <coordinates>${p.lon},${p.lat},${p.elevation}</coordinates>
      </Point>
    </Placemark>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${title}</name>
    ${placemarks}
  </Document>
</kml>`;
}

/**
 * Export Track to KML format
 */
export function exportTrackToKML(track: SurveyTrack): string {
  const coords = track.points.map(pt => `${pt.lon},${pt.lat},${pt.elevation}`).join(' ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${track.name}</name>
    <Placemark>
      <name>${track.name} (总长: ${track.distance.toFixed(1)}m)</name>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * Export Track to GPX format (Standard GPS Exchange Format)
 */
export function exportTrackToGPX(track: SurveyTrack): string {
  const trkpts = track.points.map(pt => `
      <trkpt lat="${pt.lat.toFixed(8)}" lon="${pt.lon.toFixed(8)}">
        <ele>${pt.elevation.toFixed(3)}</ele>
        <time>${pt.time.includes('T') ? pt.time : new Date().toISOString()}</time>
        ${pt.speed ? `<speed>${pt.speed.toFixed(2)}</speed>` : ''}
      </trkpt>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RTK Surveyor" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${track.name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${track.name}</name>
    <trkseg>${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Export Track to CSV format
 */
export function exportTrackToCSV(track: SurveyTrack): string {
  const headers = ['序号(Index)', '纬度(Lat)', '经度(Lon)', '高程H(m)', '记录时间(Time)', '速度(m/s)'];
  const rows = track.points.map((pt, idx) => [
    idx + 1,
    pt.lat.toFixed(8),
    pt.lon.toFixed(8),
    pt.elevation.toFixed(3),
    `"${pt.time}"`,
    (pt.speed || 0).toFixed(2)
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

/**
 * Export Track to CASS .DAT format
 */
export function exportTrackToDAT(track: SurveyTrack): string {
  return track.points.map((pt, idx) => `TRK_${idx + 1},,${pt.lon.toFixed(8)},${pt.lat.toFixed(8)},${pt.elevation.toFixed(3)}`).join('\r\n');
}

/**
 * Export Track to TXT format
 */
export function exportTrackToTXT(track: SurveyTrack): string {
  return track.points.map((pt, idx) => `TRK_${idx + 1},${pt.lat.toFixed(8)},${pt.lon.toFixed(8)},${pt.elevation.toFixed(3)},${pt.time}`).join('\r\n');
}

/**
 * Parse Coordinate text, CSV, CASS, or JSON into partial SurveyPoints
 */
export function parseImportPoints(text: string): Partial<SurveyPoint>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Try parsing JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : [data];
      const res: Partial<SurveyPoint>[] = [];
      list.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          res.push({
            name: item.name || item.pointName || item.id || `P_${idx + 1}`,
            code: item.code || item.pointCode || 'IMP',
            x: typeof item.x === 'number' ? item.x : parseFloat(item.x) || 0,
            y: typeof item.y === 'number' ? item.y : parseFloat(item.y) || 0,
            lat: typeof item.lat === 'number' ? item.lat : parseFloat(item.lat) || 0,
            lon: typeof item.lon === 'number' ? item.lon : parseFloat(item.lon) || 0,
            elevation: typeof item.elevation === 'number' ? item.elevation : (parseFloat(item.h || item.elevation) || 0),
            desc: item.desc || item.notes || '',
            coordSystem: item.coordSystem || 'CGCS2000',
          });
        }
      });
      if (res.length > 0) return res;
    } catch {
      // Fall through to text parsing
    }
  }

  // 2. Line by line text / CASS / CSV parsing
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const result: Partial<SurveyPoint>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments or table headers
    if (line.startsWith('#') || line.startsWith('//')) continue;
    if (
      i === 0 &&
      (line.includes('点名') ||
        line.toLowerCase().includes('name') ||
        line.toLowerCase().includes('lat') ||
        line.includes('北坐标') ||
        line.includes('东坐标'))
    ) {
      continue;
    }

    // Support comma, semicolon, tab, or spaces
    let parts: string[];
    if (line.includes(',')) {
      parts = line.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (line.includes(';')) {
      parts = line.split(';').map((s) => s.trim());
    } else if (line.includes('\t')) {
      parts = line.split('\t').map((s) => s.trim());
    } else {
      parts = line.split(/\s+/).map((s) => s.trim());
    }

    if (parts.length >= 3) {
      const name = parts[0] || `PT_${i + 1}`;
      let code = '';
      let n1 = 0;
      let n2 = 0;
      let n3 = 0;

      // Handle South CASS format: Name,Code,Y,X,H (e.g. 1,,500000.12,3378000.45,45.6 or 1,JC1,500000.12,3378000.45,45.6)
      if (parts.length >= 5 && isNaN(parseFloat(parts[1]))) {
        code = parts[1];
        n1 = parseFloat(parts[2]);
        n2 = parseFloat(parts[3]);
        n3 = parseFloat(parts[4]) || 0;
      } else if (parts.length >= 4 && isNaN(parseFloat(parts[1]))) {
        code = parts[1];
        n1 = parseFloat(parts[2]);
        n2 = parseFloat(parts[3]);
        n3 = 0;
      } else {
        n1 = parseFloat(parts[1]);
        n2 = parseFloat(parts[2]);
        n3 = parts[3] ? parseFloat(parts[3]) : 0;
        if (parts[4] && isNaN(parseFloat(parts[4]))) {
          code = parts[4];
        }
      }

      if (!isNaN(n1) && !isNaN(n2)) {
        let x = 0;
        let y = 0;
        let lat = 0;
        let lon = 0;
        const elevation = isNaN(n3) ? 0 : n3;

        // Detect if coordinates are Lat/Lon
        if (n1 < 90 && n2 < 180 && n1 > -90 && n2 > -180) {
          // n1: Lat, n2: Lon
          lat = n1;
          lon = n2;
        } else if (n2 < 90 && n1 < 180 && n2 > -90 && n1 > -180) {
          // n1: Lon, n2: Lat
          lon = n1;
          lat = n2;
        } else {
          // Plane coordinates (X / Y or Y / X)
          // In China, Gauss-Kruger North X is typically 2~4 million (7 digits), East Y is typically 500,000 or zone+500,000 (6~8 digits)
          if (n1 > 1000000 && n2 < 1000000) {
            x = n1;
            y = n2;
          } else if (n2 > 1000000 && n1 < 1000000) {
            // South CASS: Y is first, X is second
            x = n2;
            y = n1;
          } else {
            x = n1;
            y = n2;
          }
        }

        result.push({
          name,
          code,
          x,
          y,
          lat,
          lon,
          elevation,
        });
      }
    }
  }

  return result;
}

/**
 * Parse CSV format to SurveyPoints
 */
export function parseCSVToPoints(text: string, coordSystem = 'CGCS2000' as any): SurveyPoint[] {
  const parsed = parseImportPoints(text);
  return parsed.map((p, idx) => ({
    id: `csv_pt_${Date.now()}_${idx}`,
    name: p.name || `P_${idx + 1}`,
    code: p.code || 'CSV',
    lat: p.lat || 0,
    lon: p.lon || 0,
    elevation: p.elevation || 0,
    x: p.x || 0,
    y: p.y || 0,
    coordSystem: (p.coordSystem || coordSystem),
    createdAt: new Date().toLocaleTimeString(),
  }));
}

/**
 * Parse South CASS format to SurveyPoints
 */
export function parseCASSToPoints(text: string, coordSystem = 'CGCS2000' as any): SurveyPoint[] {
  const parsed = parseImportPoints(text);
  return parsed.map((p, idx) => ({
    id: `cass_pt_${Date.now()}_${idx}`,
    name: p.name || `CASS_${idx + 1}`,
    code: p.code || 'CASS',
    lat: p.lat || 0,
    lon: p.lon || 0,
    elevation: p.elevation || 0,
    x: p.x || 0,
    y: p.y || 0,
    coordSystem: (p.coordSystem || coordSystem),
    createdAt: new Date().toLocaleTimeString(),
  }));
}

/**
 * Parse SurveyTrack from GPX XML text
 */
export function parseTrackFromGPX(xmlText: string): Partial<SurveyTrack> | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const trkpts = Array.from(doc.querySelectorAll('trkpt'));
    if (trkpts.length === 0) return null;

    const points = trkpts.map((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '0');
      const lon = parseFloat(pt.getAttribute('lon') || '0');
      const ele = parseFloat(pt.querySelector('ele')?.textContent || '0');
      const time = pt.querySelector('time')?.textContent || new Date().toISOString();
      const speed = parseFloat(pt.querySelector('speed')?.textContent || '0');
      return { lat, lon, elevation: isNaN(ele) ? 0 : ele, time, speed: isNaN(speed) ? 0 : speed };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lon) && (p.lat !== 0 || p.lon !== 0));

    const name = doc.querySelector('trk > name')?.textContent || doc.querySelector('name')?.textContent || `GPX航迹_${Date.now()}`;
    return {
      name,
      points,
      distance: 0,
      duration: 0,
      startTime: points[0]?.time || new Date().toISOString(),
      endTime: points[points.length - 1]?.time || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Parse SurveyTrack from KML XML text
 */
export function parseTrackFromKML(xmlText: string): Partial<SurveyTrack> | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const coordEl = doc.querySelector('coordinates');
    if (!coordEl || !coordEl.textContent) return null;

    const rawCoords = coordEl.textContent.trim().split(/\s+/);
    const points = rawCoords.map((c, idx) => {
      const parts = c.split(',');
      const lon = parseFloat(parts[0] || '0');
      const lat = parseFloat(parts[1] || '0');
      const ele = parseFloat(parts[2] || '0');
      return {
        lat,
        lon,
        elevation: isNaN(ele) ? 0 : ele,
        time: new Date(Date.now() + idx * 1000).toISOString(),
      };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lon) && (p.lat !== 0 || p.lon !== 0));

    const name = doc.querySelector('Placemark > name')?.textContent || doc.querySelector('name')?.textContent || `KML航迹_${Date.now()}`;
    return {
      name,
      points,
      distance: 0,
      duration: 0,
      startTime: points[0]?.time || new Date().toISOString(),
      endTime: points[points.length - 1]?.time || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Convert a track to a specific format string
 */
export type TrackExportFormat = 'kml' | 'gpx' | 'csv' | 'cass_dat' | 'txt';

export function convertTrackToFormat(track: SurveyTrack, format: TrackExportFormat): { content: string; filename: string; mimeType: string } {
  switch (format) {
    case 'kml':
      return {
        content: exportTrackToKML(track),
        filename: `${track.name}.kml`,
        mimeType: 'application/vnd.google-earth.kml+xml',
      };
    case 'gpx':
      return {
        content: exportTrackToGPX(track),
        filename: `${track.name}.gpx`,
        mimeType: 'application/gpx+xml',
      };
    case 'csv':
      return {
        content: exportTrackToCSV(track),
        filename: `${track.name}.csv`,
        mimeType: 'text/csv;charset=utf-8',
      };
    case 'cass_dat':
      return {
        content: exportTrackToDAT(track),
        filename: `${track.name}.dat`,
        mimeType: 'text/plain;charset=utf-8',
      };
    case 'txt':
    default:
      return {
        content: exportTrackToTXT(track),
        filename: `${track.name}.txt`,
        mimeType: 'text/plain;charset=utf-8',
      };
  }
}
