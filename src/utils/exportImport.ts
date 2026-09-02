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
  // 1. Auto-save to /storage/emulated/0/com.rtkprogect.files/<subfolder>/
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
 * Parse Coordinate text or CSV file into partial SurveyPoints
 */
export function parseImportPoints(text: string): Partial<SurveyPoint>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const result: Partial<SurveyPoint>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip header line if detected
    if (i === 0 && (line.includes('点名') || line.includes('Name') || line.toLowerCase().includes('lat'))) {
      continue;
    }

    const parts = line.split(/[,;\t ]+/);
    if (parts.length >= 3) {
      const name = parts[0] || `PT_${i + 1}`;
      
      // Check if parts[1] is a number or code
      let code = '';
      let n1 = parseFloat(parts[1]);
      let n2 = parseFloat(parts[2]);
      let n3 = parts[3] ? parseFloat(parts[3]) : 0;

      if (isNaN(n1) && parts.length >= 4) {
        code = parts[1];
        n1 = parseFloat(parts[2]);
        n2 = parseFloat(parts[3]);
        n3 = parts[4] ? parseFloat(parts[4]) : 0;
      }

      if (!isNaN(n1) && !isNaN(n2)) {
        // Detect if coordinate is Lat/Lon (e.g. 30.xxx, 114.xxx) or Gauss (e.g. 3389000, 500000)
        let x = 0;
        let y = 0;
        let lat = 0;
        let lon = 0;
        const elevation = isNaN(n3) ? 0 : n3;

        if (n1 < 90 && n2 < 180 && n1 > -90 && n2 > -180) {
          // It's Lat/Lon
          lat = n1;
          lon = n2;
        } else if (n2 < 90 && n1 < 180 && n2 > -90 && n1 > -180) {
          // Lon/Lat
          lon = n1;
          lat = n2;
        } else {
          // Plane coordinates (X / Y or Y / X)
          if (n1 > 1000000 && n2 < 1000000) {
            // n1 is X (North), n2 is Y (East)
            x = n1;
            y = n2;
          } else if (n2 > 1000000 && n1 < 1000000) {
            // n2 is X (North), n1 is Y (East)
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
    lat: p.lat || 30.5285,
    lon: p.lon || 114.3985,
    elevation: p.elevation || 0,
    x: p.x || 3378000 + idx * 10,
    y: p.y || 500000 + idx * 10,
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
    lat: p.lat || 30.5285,
    lon: p.lon || 114.3985,
    elevation: p.elevation || 0,
    x: p.x || 3378000 + idx * 10,
    y: p.y || 500000 + idx * 10,
    coordSystem: (p.coordSystem || coordSystem),
    createdAt: new Date().toLocaleTimeString(),
  }));
}
