/**
 * Map Tile URL Resolver & Coordinate Conversion Helpers
 * Decoupled from MapScreen and OfflineMapModal to prevent circular dependencies.
 */

export type MapLayerType =
  | 'offline_grid'
  | 'baidu_street'
  | 'baidu_satellite'
  | 'bing_satellite'
  | 'bing_road'
  | 'gaode_street'
  | 'gaode_satellite'
  | 'tianditu_satellite'
  | 'esri_satellite'
  | 'street'
  | 'terrain';

export function getBingQuadKey(x: number, y: number, z: number): string {
  let quadKey = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadKey += digit.toString();
  }
  return quadKey;
}

// Convert standard Leaflet EPSG:3857 tile coordinates to Baidu Tile Grid Coordinates
export function getBaiduTileCoords(x: number, y: number, z: number): { bx: number; by: number; bz: number } {
  const zoomOffset = Math.pow(2, z - 1);
  const bx = x - zoomOffset;
  const by = zoomOffset - y - 1;
  return { bx, by, bz: z };
}

// Helper to compute raw tile URL for any layer
export function getMapTileUrl(layerId: string, x: number, y: number, z: number): string {
  if (layerId === 'bing_satellite') {
    const qk = getBingQuadKey(x, y, z);
    const sub = Math.abs((x + y) % 4);
    return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${qk}.jpeg?g=1`;
  }
  if (layerId === 'bing_road') {
    const qk = getBingQuadKey(x, y, z);
    const sub = Math.abs((x + y) % 4);
    return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/r${qk}.jpeg?g=1&mkt=zh-cn`;
  }
  if (layerId === 'baidu_street') {
    const { bx, by, bz } = getBaiduTileCoords(x, y, z);
    const sub = Math.abs((x + y) % 4);
    return `https://maponline${sub}.bdimg.com/tile/?qt=vtile&x=${bx}&y=${by}&z=${bz}&styles=pl&scaler=1&udt=20230519`;
  }
  if (layerId === 'baidu_satellite') {
    const { bx, by, bz } = getBaiduTileCoords(x, y, z);
    const sub = Math.abs((x + y) % 4);
    return `https://maponline${sub}.bdimg.com/tile/?qt=vtile&x=${bx}&y=${by}&z=${bz}&styles=scl&scaler=1&udt=20230519`;
  }
  if (layerId === 'gaode_street') {
    const sub = (Math.abs(x + y) % 4) + 1;
    return `https://webrd0${sub}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`;
  }
  if (layerId === 'gaode_satellite') {
    const sub = (Math.abs(x + y) % 4) + 1;
    return `https://webst0${sub}.is.autonavi.com/appmaptile?style=6&x=${x}&y=${y}&z=${z}`;
  }
  if (layerId === 'tianditu_satellite') {
    const sub = Math.abs(x + y) % 8;
    return `https://t${sub}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&tk=2b0de4726c5990263f35fe99fbfd0f3a`;
  }
  if (layerId === 'esri_satellite') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  if (layerId === 'terrain') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`;
  }
  // Default street (CartoDB)
  const sub = ['a', 'b', 'c', 'd'][Math.abs(x + y) % 4];
  return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
}
