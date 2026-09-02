export type CoordSystemType = 'Beijing54' | 'CGCS2000' | 'WGS84' | 'Xian80';

export type ScreenType =
  | 'home'
  | 'mark_waypoint'
  | 'map'
  | 'waypoint_list'
  | 'common_tools'
  | 'routes'
  | 'tracks'
  | 'engineering_survey'
  | 'engineering_data'
  | 'project_manage';

export type AngleFormatType = 'dms' | 'dd' | 'dm';

export type RTKSolutionType = 'FIXED' | 'FLOAT' | 'SINGLE' | 'INVALID';

export interface SevenParameters {
  dx: number; // 平移 X (m)
  dy: number; // 平移 Y (m)
  dz: number; // 平移 Z (m)
  rx: number; // 旋转 X (角秒)
  ry: number; // 旋转 Y (角秒)
  rz: number; // 旋转 Z (角秒)
  scale: number; // 尺度因子 (ppm)
}

export interface SurveyPoint {
  id: string;
  name: string;
  code: string; // 编码 e.g. J1, 道路, 电杆
  lat: number; // 十进制度
  lon: number; // 十进制度
  elevation: number; // 海拔 (m)
  x: number; // 高斯平面北坐标 (m)
  y: number; // 高斯平面东坐标 (m)
  coordSystem: CoordSystemType;
  desc?: string;
  color?: string;
  iconType?: string;
  hrms?: number; // 水平精度 (m)
  vrms?: number; // 高程精度 (m)
  solutionType?: RTKSolutionType;
  satCount?: number;
  antennaHeight?: number;
  createdAt: string;
  projectId?: string;
}

export interface SurveyRoute {
  id: string;
  name: string;
  pointIds: string[];
  totalDistance: number;
  createdAt: string;
  desc?: string;
  color?: string;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  elevation: number;
  time: string;
  speed?: number;
}

export interface SurveyTrack {
  id: string;
  name: string;
  points: TrackPoint[];
  distance: number; // 米
  duration: number; // 秒
  startTime: string;
  endTime: string;
  color?: string;
}

export interface EngineeringProject {
  id: string;
  name: string;
  operator: string;
  coordSystem: CoordSystemType;
  centralMeridian: number; // 中央子午线 经度 e.g. 114
  projectionType: 'Gauss3' | 'Gauss6' | 'UTM';
  sevenParams: SevenParameters;
  createTime: string;
  pointCount: number;
  desc?: string;
}

export interface RTKState {
  isConnected: boolean;
  solution: RTKSolutionType;
  satsTracked: number;
  satsUsed: number;
  hrms: number;
  vrms: number;
  pdop: number;
  hdop: number;
  ageOfDiff: number;
  baseDistance: number; // km
  battery: number;
  currentLat: number;
  currentLon: number;
  currentAlt: number;
  heading: number; // 航向角 0-360
  speed: number; // m/s
  pressure: number; // 气压 hPa
  temperature: number; // °C
  mode: 'simulated' | 'real_gps' | 'ntrip_cors' | 'ip_location' | 'bluetooth_gnss';
  screenRotation: 0 | 180;
  antennaHeight: number; // 天线高 (m)
  realGpsStatus?: 'idle' | 'locating' | 'locked' | 'denied' | 'error';
  realGpsAccuracy?: number; // 真实GPS精度 (m)
  realGpsMessage?: string;
  realGpsFrequencyHz?: number; // 实际实时刷新率 (Hz)
  targetSamplingHz?: number; // 目标刷新率 (默认 4Hz，大于2Hz)
  ipCity?: string;
  bluetoothDeviceName?: string;
}

export interface UnitSettings {
  distanceUnit: 'm' | 'ft' | 'us_ft';
  angleFormat: AngleFormatType;
  coordDisplay: 'xy' | 'ne' | 'latlon';
  areaUnit: 'sqm' | 'mu' | 'ha' | 'sqft';
  pressureUnit: 'hpa' | 'mmhg';
  audioBeep: boolean;
  elevationDatum: 'ellipsoidal' | 'orthometric';
}

export interface SurveyLogRecord {
  id: string;
  pointName: string;
  pointCode: string;
  type: 'point_collect' | 'detail_survey' | 'stakeout' | 'line_measure' | 'slope_measure';
  x: number;
  y: number;
  h: number;
  lat: number;
  lon: number;
  hrms: number;
  vrms: number;
  solution: RTKSolutionType;
  antennaHeight: number;
  epochs: number;
  time: string;
  notes?: string;
}

export interface NtripConfig {
  ip: string;
  port: number;
  mountPoint: string;
  user: string;
  pass: string;
  autoConnect: boolean;
  sendGgaInterval: number;
}
