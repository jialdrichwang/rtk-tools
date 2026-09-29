import React, { useRef, useMemo, useEffect, useState } from 'react';

export interface GpsTestCompassDialProps {
  heading: number; // 0 to 360 degrees (Magnetic Heading)
  pitch?: number;  // -90 to +90 degrees (Device Pitch)
  roll?: number;   // -180 to +180 degrees (Device Roll)
  trueHeading?: number; // 0 to 360 degrees (True North Heading)
  declination?: number; // Geomagnetic declination
  magneticFieldStrength?: number; // Field strength in μT
  size?: number;   // Pixel diameter
  className?: string;
  isLevel?: boolean;
  isGpsMode?: boolean;
}

/**
 * GPS Test Plus 1:1 风格工业级罗盘刻度盘 - 亮色工程模式 (Light Mode Aviation Instrument)
 * 
 * 1. 经典亮色工程仪器风：高质感拉丝航空铝/不锈钢银色双层表圈，纯净象牙白高反差刻度盘底。
 * 2. 阻尼齿轮自转物理系统 (Inertial Damped Gear Engine)：模拟 10 倍阻尼的高精度流体阻尼齿轮转子，
 *    旋转平稳自转，平滑消震，无高频抖动，359° <-> 0° <-> 1° 最短路径连续转动。
 * 3. 完整生效的双轴水平泡与倾角仪 (Dual-Axis Bubble Level & Pitch/Roll Inclinometer)：
 *    中心同轴十字瞄准分划板、2°/5°/10° 同心刻度环、翡翠绿 LEVEL 靶心指示与动态液体气泡。
 * 4. 经典 GPS Test Plus 3D 棱形红蓝磁针与 12 点钟顶置固定琥珀黄照准觇标 (Lubber Line)。
 * 5. 亮色 HUD 数字化平显仪表：MAG 磁北、TRUE 真北、TILT 倾角、FIELD 场强、DECL 偏角。
 */
export const GpsTestCompassDial: React.FC<GpsTestCompassDialProps> = ({
  heading = 0,
  pitch = 0,
  roll = 0,
  trueHeading,
  declination = 0,
  magneticFieldStrength = 48.0,
  size = 360,
  className = '',
  isLevel,
  isGpsMode = false,
}) => {
  // SVG 空间坐标系定义 (360x360 纯圆设计)
  const cx = 180;
  const cy = 180;
  const outerR = 172;
  const bezelR = 162;
  const dialR = 148;
  const innerR = 104;
  const centerBubbleR = 46;

  // ==========================================
  // 1. 阻尼齿轮物理惯性自转引擎 (10x Damped Gear Motion)
  // ==========================================
  const [gearAngle, setGearAngle] = useState(-heading);
  const gearAngleRef = useRef(-heading);
  const gearVelocityRef = useRef(0);
  const lastTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  // 目标盘面角度为 -heading (罗盘逆时针旋转以使 12 点钟照准觇标指向当前前进方向)
  const targetAngleRef = useRef(-heading);
  targetAngleRef.current = -heading;

  useEffect(() => {
    let active = true;

    const animateGear = (time: number) => {
      if (!active) return;
      const dt = Math.min(0.05, Math.max(0.005, (time - lastTimeRef.current) / 1000));
      lastTimeRef.current = time;

      const current = gearAngleRef.current;
      const target = targetAngleRef.current;

      // 计算最短路径角误差 (-180 到 +180)
      let delta = (((target - current) + 540) % 360) - 180;

      // 机械阻尼齿轮动力学参数 (增加 10 倍阻尼粘滞感，自转平滑如机械精密罗经)
      // k: 恢复力矩刚度; c: 粘滞摩擦阻尼系数
      const k = 42.0; // 弹簧力矩
      const c = 12.5; // 阻尼系数 (10倍厚重阻尼感，消除所有抖动与过冲)

      // 二阶弹簧阻尼加速度
      const accel = k * delta - c * gearVelocityRef.current;
      gearVelocityRef.current += accel * dt;
      gearAngleRef.current += gearVelocityRef.current * dt;

      // 当误差极小且速度接近 0 时平稳微调
      if (Math.abs(delta) < 0.05 && Math.abs(gearVelocityRef.current) < 0.1) {
        gearAngleRef.current = target;
        gearVelocityRef.current = 0;
      }

      setGearAngle(gearAngleRef.current);
      rafIdRef.current = requestAnimationFrame(animateGear);
    };

    lastTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(animateGear);

    return () => {
      active = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // ==========================================
  // 2. 双轴水平气泡实时物理运动与阻尼解算
  // ==========================================
  // 横滚 roll 驱动 X 轴位移，俯仰 pitch 驱动 Y 轴位移
  // 真实液体气泡物理：手机上抬(pitch > 0) -> 气泡向屏幕上方浮动(负 Y 方向)
  // 手机右倾(roll > 0) -> 气泡向屏幕右侧浮动(正 X 方向)
  const maxBubbleOffset = centerBubbleR - 11;
  const bubblePxX = Math.max(-maxBubbleOffset, Math.min(maxBubbleOffset, roll * 1.55));
  const bubblePxY = Math.max(-maxBubbleOffset, Math.min(maxBubbleOffset, -pitch * 1.55));
  const tiltMagnitude = Math.hypot(pitch, roll);
  const deviceIsLevel = isLevel !== undefined ? isLevel : tiltMagnitude < 2.5;

  // ==========================================
  // 3. 刻度线几何生成 (每 2° 一细刻度，每 10° 一中刻度，每 30° 一粗刻度)
  // ==========================================
  const ticks = useMemo(() => {
    const list = [];
    for (let deg = 0; deg < 360; deg += 2) {
      const isMajor30 = deg % 30 === 0;
      const isMedium10 = deg % 10 === 0 && !isMajor30;
      const isFine2 = !isMajor30 && !isMedium10;

      const tickLen = isMajor30 ? 12 : isMedium10 ? 8 : 4;
      const rad = ((deg - 90) * Math.PI) / 180;
      const x1 = cx + dialR * Math.cos(rad);
      const y1 = cy + dialR * Math.sin(rad);
      const x2 = cx + (dialR - tickLen) * Math.cos(rad);
      const y2 = cy + (dialR - tickLen) * Math.sin(rad);

      list.push({
        deg,
        x1, y1, x2, y2,
        isMajor30,
        isMedium10,
        isFine2,
      });
    }
    return list;
  }, [cx, cy, dialR]);

  // 4. 方位文字与刻度读数配置
  const markings = [
    { deg: 0, label: 'N', isNorth: true, isCardinal: true },
    { deg: 30, label: '30' },
    { deg: 45, label: 'NE', isSubCardinal: true },
    { deg: 60, label: '60' },
    { deg: 90, label: 'E', isCardinal: true },
    { deg: 120, label: '120' },
    { deg: 135, label: 'SE', isSubCardinal: true },
    { deg: 150, label: '150' },
    { deg: 180, label: 'S', isCardinal: true },
    { deg: 210, label: '210' },
    { deg: 225, label: 'SW', isSubCardinal: true },
    { deg: 240, label: '240' },
    { deg: 270, label: 'W', isCardinal: true },
    { deg: 300, label: '300' },
    { deg: 315, label: 'NW', isSubCardinal: true },
    { deg: 330, label: '330' },
  ];

  const computedTrue = trueHeading !== undefined ? trueHeading : ((heading + declination + 360) % 360);

  return (
    <div
      className={`relative shrink-0 aspect-square flex items-center justify-center select-none ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    >
      <svg
        viewBox="0 0 360 360"
        className="w-full h-full overflow-visible drop-shadow-xl"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* 亮色工程模式：拉丝航空铝/精密不锈钢金属表圈渐变 */}
          <radialGradient id="lightBezelGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#F1F5F9" />
            <stop offset="85%" stopColor="#E2E8F0" />
            <stop offset="94%" stopColor="#CBD5E1" />
            <stop offset="98%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </radialGradient>

          {/* 纯净象牙白罗盘底盘渐变 */}
          <radialGradient id="lightDialGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="82%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </radialGradient>

          {/* 水平仪底盘柔和渐变 */}
          <radialGradient id="levelPlateGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="75%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </radialGradient>

          {/* 经典朱红北针 3D 立体渐变 */}
          <linearGradient id="needleNorthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="45%" stopColor="#EF4444" />
            <stop offset="55%" stopColor="#F87171" />
            <stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>

          {/* 经典深蓝银灰南针 3D 立体渐变 */}
          <linearGradient id="needleSouthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="45%" stopColor="#64748B" />
            <stop offset="55%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* 翡翠绿水平荧光滤镜 */}
          <filter id="emeraldLevelGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 琥珀黄觇标阴影 */}
          <filter id="markerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 1. 外层航空仪器高质感拉丝金属表圈 (Outer Polished Bezel) */}
        <circle cx={cx} cy={cy} r={outerR} fill="url(#lightBezelGrad)" stroke="#94A3B8" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={outerR - 4} fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.9" />
        
        {/* 表圈微刻度装饰槽 */}
        <circle cx={cx} cy={cy} r={bezelR} fill="none" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
        
        {/* 内层纯净象牙白主表盘底盘 */}
        <circle cx={cx} cy={cy} r={dialR + 4} fill="url(#lightDialGrad)" stroke="#64748B" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={dialR + 3} fill="none" stroke="#38BDF8" strokeWidth="0.8" opacity="0.6" />

        {/* 2. 阻尼齿轮自转罗盘刻度盘 (Inertial Rotating Compass Rose) */}
        <g transform={`rotate(${gearAngle} ${cx} ${cy})`}>
          {/* 刻度线组 */}
          <g>
            {ticks.map((t) => (
              <line
                key={t.deg}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isMajor30 ? '#0F172A' : t.isMedium10 ? '#0284C7' : '#64748B'}
                strokeWidth={t.isMajor30 ? 2.4 : t.isMedium10 ? 1.5 : 0.9}
                strokeLinecap="round"
                opacity={t.isFine2 ? 0.75 : 1}
              />
            ))}
          </g>

          {/* 同心内环精密分割圈 */}
          <circle cx={cx} cy={cy} r={dialR - 15} fill="none" stroke="#CBD5E1" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#94A3B8" strokeWidth="1.2" />

          {/* 刻度数值与方位文字标注 */}
          {markings.map((m) => {
            const rad = ((m.deg - 90) * Math.PI) / 180;
            const rText = m.isNorth ? dialR - 26 : m.isCardinal ? dialR - 25 : m.isSubCardinal ? dialR - 23 : dialR - 24;
            const tx = cx + rText * Math.cos(rad);
            const ty = cy + rText * Math.sin(rad);

            if (m.isNorth) {
              return (
                <g key={m.deg}>
                  {/* 北方向外尖角高亮鲜红三角标 */}
                  <polygon
                    points={`${cx},${cy - dialR + 1} ${cx - 7},${cy - dialR + 13} ${cx + 7},${cy - dialR + 13}`}
                    fill="#DC2626"
                  />
                  <text
                    x={tx}
                    y={ty + 4}
                    fill="#DC2626"
                    fontSize="18"
                    fontWeight="900"
                    fontFamily="monospace, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none tracking-wider"
                  >
                    N
                  </text>
                </g>
              );
            }

            if (m.isCardinal) {
              return (
                <text
                  key={m.deg}
                  x={tx}
                  y={ty + 2}
                  fill="#0284C7"
                  fontSize="16"
                  fontWeight="800"
                  fontFamily="monospace, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="select-none"
                >
                  {m.label}
                </text>
              );
            }

            if (m.isSubCardinal) {
              return (
                <text
                  key={m.deg}
                  x={tx}
                  y={ty + 2}
                  fill="#475569"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="monospace, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="select-none"
                >
                  {m.label}
                </text>
              );
            }

            return (
              <text
                key={m.deg}
                x={tx}
                y={ty + 2}
                fill="#334155"
                fontSize="10"
                fontWeight="700"
                fontFamily="monospace, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
                className="select-none"
              >
                {m.label}
              </text>
            );
          })}
        </g>

        {/* 3. 经典 GPS Test Plus 磁针 (Classic Dual Needle) */}
        {/* 指向绝对正北 (在旋转盘面上始终保持纵向基准指向) */}
        <g pointerEvents="none">
          {/* 北针 (North Needle - 3D 棱面艳红) */}
          <polygon
            points={`${cx},${cy - dialR + 18} ${cx - 5.5},${cy - centerBubbleR - 3} ${cx},${cy - centerBubbleR + 4} ${cx + 5.5},${cy - centerBubbleR - 3}`}
            fill="url(#needleNorthGrad)"
            stroke="#991B1B"
            strokeWidth="0.8"
            filter="drop-shadow(0 2px 2px rgba(0,0,0,0.15))"
          />
          {/* 北针高光棱脊线 */}
          <line
            x1={cx}
            y1={cy - dialR + 18}
            x2={cx}
            y2={cy - centerBubbleR + 4}
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeOpacity="0.9"
          />

          {/* 南针 (South Needle - 3D 棱面银灰蓝) */}
          <polygon
            points={`${cx},${cy + dialR - 18} ${cx - 5.5},${cy + centerBubbleR + 3} ${cx},${cy + centerBubbleR - 4} ${cx + 5.5},${cy + centerBubbleR + 3}`}
            fill="url(#needleSouthGrad)"
            stroke="#334155"
            strokeWidth="0.8"
            filter="drop-shadow(0 2px 2px rgba(0,0,0,0.12))"
          />
          {/* 南针高光棱脊线 */}
          <line
            x1={cx}
            y1={cy + dialR - 18}
            x2={cx}
            y2={cy + centerBubbleR - 4}
            stroke="#F8FAFC"
            strokeWidth="1.2"
            strokeOpacity="0.8"
          />
        </g>

        {/* 4. 中心双轴水平泡 & 倾角仪 (Dual-Axis Bubble Level & Pitch/Roll Inclinometer) */}
        <g>
          {/* 水平仪底盘 */}
          <circle
            cx={cx}
            cy={cy}
            r={centerBubbleR}
            fill="url(#levelPlateGrad)"
            stroke={deviceIsLevel ? '#10B981' : '#94A3B8'}
            strokeWidth={deviceIsLevel ? 2.2 : 1.5}
            className="transition-colors duration-300"
          />

          {/* 同心倾斜参考圆环 (2°, 5°, 10°) */}
          <circle cx={cx} cy={cy} r={centerBubbleR * 0.3} fill="none" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="2 2" />
          <circle cx={cx} cy={cy} r={centerBubbleR * 0.65} fill="none" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="2 2" />

          {/* 十字分划板瞄准标尺线 */}
          <line x1={cx - centerBubbleR + 4} y1={cy} x2={cx + centerBubbleR - 4} y2={cy} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={cx} y1={cy - centerBubbleR + 4} x2={cx} y2={cy + centerBubbleR - 4} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />

          {/* 中心水平靶心圈 (2.5度容差区) */}
          <circle
            cx={cx}
            cy={cy}
            r="9"
            fill="none"
            stroke={deviceIsLevel ? '#10B981' : '#64748B'}
            strokeWidth={deviceIsLevel ? 2 : 1.2}
            filter={deviceIsLevel ? 'url(#emeraldLevelGlow)' : undefined}
            className="transition-colors duration-300"
          />

          {/* 实时动态浮动液体气泡 (Moving Liquid Level Bubble) */}
          <g
            transform={`translate(${cx + bubblePxX} ${cy + bubblePxY})`}
            style={{ transition: 'transform 60ms cubic-bezier(0.1, 0.9, 0.2, 1)' }}
          >
            {/* 气泡外圈阴影与本体 */}
            <circle
              r="7.5"
              fill={deviceIsLevel ? '#10B981' : tiltMagnitude < 6 ? '#F59E0B' : '#EF4444'}
              fillOpacity={0.88}
              stroke="#FFFFFF"
              strokeWidth="1.2"
              filter={deviceIsLevel ? 'url(#emeraldLevelGlow)' : undefined}
            />
            {/* 气泡液体反光高光点 */}
            <circle cx="-2" cy="-2" r="2.5" fill="#FFFFFF" fillOpacity={0.85} />
          </g>

          {/* 水平平衡徽标 (LEVEL) */}
          {deviceIsLevel && (
            <g>
              <rect
                x={cx - 24}
                y={cy + centerBubbleR + 5}
                width="48"
                height="14"
                rx="7"
                fill="#10B981"
                className="animate-pulse"
              />
              <text
                x={cx}
                y={cy + centerBubbleR + 15}
                fill="#FFFFFF"
                fontSize="8.5"
                fontWeight="900"
                fontFamily="monospace, sans-serif"
                textAnchor="middle"
                className="select-none tracking-wider"
              >
                LEVEL
              </text>
            </g>
          )}
        </g>

        {/* 5. 顶置固定基准照准觇标 (Fixed Lubber Index at 12 o'clock) */}
        {/* 指向当前手机设备正前方的实际航向 */}
        <g pointerEvents="none" filter="url(#markerShadow)">
          {/* 醒目琥珀黄顶置箭头 */}
          <polygon
            points={`${cx},${cy - dialR - 1} ${cx - 8},${cy - outerR + 5} ${cx + 8},${cy - outerR + 5}`}
            fill="#F59E0B"
            stroke="#D97706"
            strokeWidth="1.2"
          />
          <line
            x1={cx}
            y1={cy - outerR + 4}
            x2={cx}
            y2={cy - dialR + 1}
            stroke="#FFFFFF"
            strokeWidth="1.8"
          />
        </g>

        {/* 6. 亮色 HUD 数字化平显仪表 (Aviation Telemetry HUD) */}
        {/* 左上角：磁北与真北航向 */}
        <g className="text-left font-mono" pointerEvents="none">
          <rect x="8" y="10" width="76" height="46" rx="8" fill="#FFFFFF" fillOpacity="0.88" stroke="#E2E8F0" strokeWidth="1" />
          <text x="14" y="24" fill="#64748B" fontSize="9" fontWeight="700">MAG 磁北</text>
          <text x="14" y="41" fill="#0F172A" fontSize="16" fontWeight="900">{Math.round(heading)}°</text>
          <text x="14" y="51" fill="#0284C7" fontSize="8.5" fontWeight="700">TRUE {Math.round(computedTrue)}°</text>
        </g>

        {/* 右上角：俯仰与横滚角度 */}
        <g className="text-right font-mono" pointerEvents="none">
          <rect x="276" y="10" width="76" height="46" rx="8" fill="#FFFFFF" fillOpacity="0.88" stroke="#E2E8F0" strokeWidth="1" />
          <text x="346" y="24" fill="#64748B" fontSize="9" fontWeight="700" textAnchor="end">TILT 倾角</text>
          <text x="346" y="38" fill={Math.abs(pitch) > 10 ? '#DC2626' : '#0F172A'} fontSize="10.5" fontWeight="800" textAnchor="end">
            P: {pitch > 0 ? `+${pitch.toFixed(1)}` : pitch.toFixed(1)}°
          </text>
          <text x="346" y="50" fill={Math.abs(roll) > 10 ? '#DC2626' : '#0F172A'} fontSize="10.5" fontWeight="800" textAnchor="end">
            R: {roll > 0 ? `+${roll.toFixed(1)}` : roll.toFixed(1)}°
          </text>
        </g>

        {/* 左下角：地磁场强 */}
        <g className="text-left font-mono" pointerEvents="none">
          <rect x="8" y="304" width="76" height="46" rx="8" fill="#FFFFFF" fillOpacity="0.88" stroke="#E2E8F0" strokeWidth="1" />
          <text x="14" y="318" fill="#64748B" fontSize="9" fontWeight="700">FIELD 场强</text>
          <text x="14" y="336" fill="#059669" fontSize="13" fontWeight="900">
            {magneticFieldStrength.toFixed(1)}
          </text>
          <text x="54" y="336" fill="#64748B" fontSize="9" fontWeight="600">μT</text>
          <text x="14" y="346" fill={magneticFieldStrength < 25 || magneticFieldStrength > 65 ? '#DC2626' : '#10B981'} fontSize="8" fontWeight="700">
            {magneticFieldStrength < 25 || magneticFieldStrength > 65 ? '● 强磁干扰' : '● 地磁健康'}
          </text>
        </g>

        {/* 右下角：磁偏角 */}
        <g className="text-right font-mono" pointerEvents="none">
          <rect x="276" y="304" width="76" height="46" rx="8" fill="#FFFFFF" fillOpacity="0.88" stroke="#E2E8F0" strokeWidth="1" />
          <text x="346" y="318" fill="#64748B" fontSize="9" fontWeight="700" textAnchor="end">DECL 偏角</text>
          <text x="346" y="336" fill="#D97706" fontSize="13" fontWeight="900" textAnchor="end">
            {declination > 0 ? `+${declination.toFixed(1)}` : declination.toFixed(1)}°
          </text>
          <text x="346" y="346" fill="#64748B" fontSize="8" fontWeight="600" textAnchor="end">
            {declination >= 0 ? '东偏 (E)' : '西偏 (W)'}
          </text>
        </g>
      </svg>
    </div>
  );
};
