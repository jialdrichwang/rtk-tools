import React, { useState, useRef, useCallback } from 'react';

export type CompassNumberMode = 'cardinal' | 'steps30' | 'all';

interface SurveyCompassDialProps {
  heading?: number; // 0 to 360 degrees (geomagnetic / GPS heading)
  className?: string;
  size?: number;
  numberMode?: CompassNumberMode;
  dialRotation?: number; // optional controlled rotation (-180 to +180)
  onRotationChange?: (rotationDeg: number) => void;
  showForwardMarker?: boolean;
  filterMode?: 'stable' | 'smooth' | 'direct';
  onToggleFilter?: () => void;
}

/**
 * Authentic Geological and Surveying Compass Dial
 * Matches Chinese Geological Compass:
 * 1. 罗盘外沿触屏360度循环旋转 (Touch-rotatable dial outer rim, infinite 360° cycle)
 * 2. 罗盘外沿顶部红三角，表示前进方向 (Red triangle at top outer rim for forward heading)
 * 3. 测绘滤波选项置于右上角原 罗盘-180 位置
 * 4. 南北指针指向地磁南北 (Needle points towards geomagnetic North/South on dial)
 * 5. 180 at top, 360 at bottom, 90 at left, 270 at right (geological transit scale)
 */
export const SurveyCompassDial: React.FC<SurveyCompassDialProps> = ({
  heading = 308,
  className = '',
  size = 370,
  numberMode = 'cardinal',
  dialRotation: controlledRotation,
  onRotationChange,
  showForwardMarker = true,
  filterMode = 'stable',
  onToggleFilter,
}) => {
  const [internalRotation, setInternalRotation] = useState(0);
  const currentRotation = controlledRotation !== undefined ? controlledRotation : internalRotation;
  const currentRotationRef = useRef(currentRotation);
  currentRotationRef.current = currentRotation;

  const updateRotation = useCallback(
    (rot: number) => {
      // Continuous 360° cyclic rotation: normalize into -180° to +180°
      let normalized = rot;
      while (normalized > 180) normalized -= 360;
      while (normalized <= -180) normalized += 360;
      const rounded = Math.round(normalized * 10) / 10;
      if (controlledRotation === undefined) {
        setInternalRotation(rounded);
      }
      onRotationChange?.(rounded);
    },
    [controlledRotation, onRotationChange]
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingDial = useRef(false);
  const lastAngleRef = useRef<number>(0);

  // SVG Geometry Settings
  const cx = 195;
  const cy = 215;
  const outerR = 152;
  const ringInnerR = 118;
  const boxInnerR = 94;

  // Dial degrees formula matching Authentic Chinese Geological Transit:
  // 180° is TOP (12 o'clock, 南 S)
  // 90° is LEFT (9 o'clock, 東 E)
  // 360° is BOTTOM (6 o'clock, 北 N)
  // 270° is RIGHT (3 o'clock, 西 W)
  // When forward sight is aimed at azimuth H, the magnetic North needle tip (red N) directly reads H on this scale!
  const getScreenAngle = (deg: number) => (deg - 270) * (Math.PI / 180);

  // Generate ticks for dial scale
  const ticks = [];
  for (let d = 0; d < 360; d += 1) {
    const isMajor = d % 10 === 0;
    const isMedium = d % 5 === 0 && !isMajor;
    const rad = getScreenAngle(d);

    const r1 = outerR;
    const r2 = isMajor ? outerR - 14 : isMedium ? outerR - 9 : outerR - 5.5;

    const x1 = cx + r1 * Math.cos(rad);
    const y1 = cy + r1 * Math.sin(rad);
    const x2 = cx + r2 * Math.cos(rad);
    const y2 = cy + r2 * Math.sin(rad);

    let showLabel = false;
    let labelText = '';
    let isCardinal = false;

    if (d === 180) {
      showLabel = true;
      labelText = '180';
      isCardinal = true;
    } else if (d === 90) {
      showLabel = true;
      labelText = '90';
      isCardinal = true;
    } else if (d === 0 || d === 360) {
      showLabel = true;
      labelText = '360';
      isCardinal = true;
    } else if (d === 270) {
      showLabel = true;
      labelText = '270';
      isCardinal = true;
    } else if (numberMode === 'steps30' && d % 30 === 0) {
      showLabel = true;
      labelText = String(d);
    } else if (numberMode === 'all' && isMajor) {
      showLabel = true;
      labelText = String(d).padStart(3, '0');
    }

    ticks.push({
      d,
      isMajor,
      x1,
      y1,
      x2,
      y2,
      showLabel,
      labelText,
      isCardinal,
      labelX: cx + (outerR - 22) * Math.cos(rad),
      labelY: cy + (outerR - 22) * Math.sin(rad),
      rotation: isCardinal ? 0 : (rad * 180) / Math.PI + 90,
    });
  }

  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 460;
    const y = ((clientY - rect.top) / rect.height) * 420;
    return { x, y };
  };

  // Pointer interaction: 罗盘外沿触屏360度循环旋转
  const handleDialPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingDial.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
    lastAngleRef.current = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;

    const handleDialMove = (ev: PointerEvent) => {
      if (!isDraggingDial.current) return;
      const coords = getSvgCoordinates(ev.clientX, ev.clientY);
      const currentAngle = (Math.atan2(coords.y - cy, coords.x - cx) * 180) / Math.PI;
      let delta = currentAngle - lastAngleRef.current;
      // Handle the -180/180 radian wrap-around gracefully
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngleRef.current = currentAngle;

      updateRotation(currentRotationRef.current + delta);
    };

    const handleDialUp = () => {
      isDraggingDial.current = false;
      window.removeEventListener('pointermove', handleDialMove);
      window.removeEventListener('pointerup', handleDialUp);
    };

    window.addEventListener('pointermove', handleDialMove);
    window.addEventListener('pointerup', handleDialUp);
  };

  // Needle Angle Calculation:
  // Decoupled from dial rotation!
  // Base needle orientation is pointing straight UP to 12 o'clock (toward Magnetic North at heading 0°).
  // When forward direction is at azimuth `heading`, Magnetic North is at screen angle `-heading`.
  // When user rotates the dial, the dial turns independently while the magnetic needle remains locked to North/South!
  const needleAngleDeg = -heading;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg
        ref={svgRef}
        viewBox="0 0 460 420"
        style={{ width: `${size}px`, height: `${(size * 420) / 460}px`, maxWidth: '100%', maxHeight: '74vh' }}
        className="drop-shadow-lg touch-none overflow-visible"
      >
        <defs>
          <radialGradient id="compassPlate" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="85%" stopColor="#FAFAFA" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </radialGradient>
          <filter id="dialShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* 1. Rotatable Dial Group (罗盘刻度触摸旋转，与指针完全脱离关联) */}
        <g
          id="rotatable-compass-dial"
          transform={`rotate(${currentRotation}, ${cx}, ${cy})`}
          onPointerDown={handleDialPointerDown}
          className="cursor-grab active:cursor-grabbing transition-transform duration-75 ease-out"
        >
          {/* Dial Baseplate */}
          <circle cx={cx} cy={cy} r={outerR + 5} fill="#FFFFFF" stroke="#334155" strokeWidth="2.2" />
          <circle cx={cx} cy={cy} r={outerR} fill="url(#compassPlate)" stroke="#94A3B8" strokeWidth="1" />

          {/* 罗盘外沿触屏360度旋转触控感应环 (Outer Rim Touch Ring for 360° Cyclic Rotation) */}
          <circle
            cx={cx}
            cy={cy}
            r={outerR + 10}
            fill="transparent"
            stroke="#0284C7"
            strokeWidth="24"
            strokeOpacity="0.01"
            className="cursor-grab active:cursor-grabbing"
          />

          {/* Inner concentric rings */}
          <circle cx={cx} cy={cy} r={ringInnerR} fill="none" stroke="#475569" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={boxInnerR} fill="none" stroke="#64748B" strokeWidth="1.2" />

          {/* Scale Ticks & Numbers */}
          {ticks.map((t) => (
            <g key={`tick-${t.d}`}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#1E293B"
                strokeWidth={t.isMajor ? 1.6 : t.isMedium ? 1.1 : 0.7}
              />
              {t.showLabel && (
                <text
                  x={t.labelX}
                  y={t.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#0F172A"
                  fontSize={t.isCardinal ? '16' : '8'}
                  fontWeight={t.isCardinal ? '900' : 'bold'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  transform={`rotate(${t.rotation}, ${t.labelX}, ${t.labelY})`}
                >
                  {t.labelText}
                </text>
              )}
            </g>
          ))}

          {/* 4 Cardinal Directions Yellow Badge Boxes matching 中国地质罗盘: 东南西北用正黄 */}
          {/* 南 (180°) - Top (12 o'clock) */}
          <rect x={cx - 13} y={cy - ringInnerR + 2} width="26" height="23" fill="#FFE500" stroke="#854D0E" strokeWidth="1.2" rx="1" />
          <text x={cx} y={cy - ringInnerR + 13} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="13" fontWeight="900">
            南
          </text>
          <text x={cx} y={cy - ringInnerR + 32} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="11" fontWeight="900">
            S
          </text>

          {/* 北 (360° / 0°) - Bottom (6 o'clock) */}
          <rect x={cx - 13} y={cy + ringInnerR - 25} width="26" height="23" fill="#FFE500" stroke="#854D0E" strokeWidth="1.2" rx="1" />
          <text x={cx} y={cy + ringInnerR - 14} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="13" fontWeight="900">
            北
          </text>
          <text x={cx} y={cy + ringInnerR - 33} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="11" fontWeight="900">
            N
          </text>

          {/* 東 (90°) - Left (9 o'clock) */}
          <rect x={cx - ringInnerR + 2} y={cy - 12} width="23" height="24" fill="#FFE500" stroke="#854D0E" strokeWidth="1.2" rx="1" />
          <text x={cx - ringInnerR + 13.5} y={cy} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="13" fontWeight="900">
            東
          </text>
          <text x={cx - ringInnerR + 32} y={cy} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="11" fontWeight="900">
            E
          </text>

          {/* 西 (270°) - Right (3 o'clock) */}
          <rect x={cx + ringInnerR - 25} y={cy - 12} width="23" height="24" fill="#FFE500" stroke="#854D0E" strokeWidth="1.2" rx="1" />
          <text x={cx + ringInnerR - 13.5} y={cy} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="13" fontWeight="900">
            西
          </text>
          <text x={cx + ringInnerR - 32} y={cy} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize="11" fontWeight="900">
            W
          </text>

          {/* 4 Quadrants: 东南、西南、东北、西北用正红字底 (纯正红色背景，纯白粗体文字) */}
          {/* 東南 (Top-Left, 135°, between 180 南 and 90 東) */}
          {(() => {
            const rad = getScreenAngle(135);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#DC2626" stroke="#991B1B" strokeWidth="1" rx="1.5" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" fontSize="10.5" fontWeight="900">
                  東南
                </text>
              </g>
            );
          })()}

          {/* 西南 (Top-Right, 225°, between 180 南 and 270 西) */}
          {(() => {
            const rad = getScreenAngle(225);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#DC2626" stroke="#991B1B" strokeWidth="1" rx="1.5" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" fontSize="10.5" fontWeight="900">
                  西南
                </text>
              </g>
            );
          })()}

          {/* 東北 (Bottom-Left, 45°, between 360 北 and 90 東) */}
          {(() => {
            const rad = getScreenAngle(45);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#DC2626" stroke="#991B1B" strokeWidth="1" rx="1.5" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" fontSize="10.5" fontWeight="900">
                  東北
                </text>
              </g>
            );
          })()}

          {/* 西北 (Bottom-Right, 315°, between 360 北 and 270 西) */}
          {(() => {
            const rad = getScreenAngle(315);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#DC2626" stroke="#991B1B" strokeWidth="1" rx="1.5" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" fontSize="10.5" fontWeight="900">
                  西北
                </text>
              </g>
            );
          })()}

          {/* Crosshairs */}
          <line x1={cx - boxInnerR + 20} y1={cy} x2={cx + boxInnerR - 20} y2={cy} stroke="#0F172A" strokeWidth="1.8" />
          <line x1={cx} y1={cy - boxInnerR + 20} x2={cx} y2={cy + boxInnerR - 20} stroke="#0F172A" strokeWidth="1.8" />
          <line x1={cx} y1={cy - 24} x2={cx} y2={cy + 24} stroke="#DC2626" strokeWidth="2" />
        </g>

        {/* 3. Dynamic Magnetic Needle with Synchronously Rotating N and S Letters */}
        <g
          id="magnetic-needle"
          transform={`rotate(${needleAngleDeg}, ${cx}, ${cy})`}
          className="transition-transform duration-150 ease-out pointer-events-none"
        >
          {/* Blue Needle Tail (Points to South / 6 o'clock in base orientation) */}
          {/* South Stem */}
          <path
            d={`M${cx - 5} ${cy} L${cx - 2} ${cy + 78} L${cx + 2} ${cy + 78} L${cx + 5} ${cy} Z`}
            fill="#0284C7"
          />
          <path
            d={`M${cx} ${cy} L${cx + 2} ${cy + 78} L${cx + 5} ${cy} Z`}
            fill="#38BDF8"
          />

          {/* Extended Blue Arrowhead (Tip reaches outer graduation rim at cy + 144) */}
          <path
            d={`M${cx - 9} ${cy + 76} L${cx} ${cy + 144} L${cx} ${cy + 86} Z`}
            fill="#38BDF8"
            stroke="#0284C7"
            strokeWidth="0.7"
          />
          <path
            d={`M${cx + 9} ${cy + 76} L${cx} ${cy + 144} L${cx} ${cy + 86} Z`}
            fill="#0369A1"
            stroke="#075985"
            strokeWidth="0.7"
          />
          {/* White center ridge line for South pointer */}
          <line
            x1={cx}
            y1={cy + 86}
            x2={cx}
            y2={cy + 144}
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeOpacity="0.9"
          />

          {/* 指针S字母向中心移动，靠近针尖膨大部 (移至 cy + 82，清晰美观不遮挡尖端) */}
          <g transform={`translate(${cx}, ${cy + 82})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#0284C7"
              stroke="#FFFFFF"
              strokeWidth="2.8"
              paintOrder="stroke"
              fontSize="14"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              S
            </text>
          </g>

          {/* Red Needle Pointer (Pointing to North / 12 o'clock in base orientation) */}
          {/* North Stem */}
          <path
            d={`M${cx - 5} ${cy} L${cx - 2} ${cy - 78} L${cx + 2} ${cy - 78} L${cx + 5} ${cy} Z`}
            fill="#DC2626"
          />
          <path
            d={`M${cx} ${cy} L${cx + 2} ${cy - 78} L${cx + 5} ${cy} Z`}
            fill="#EF4444"
          />

          {/* Extended Red Arrowhead (Tip reaches outer graduation rim at cy - 144) */}
          <path
            d={`M${cx - 9} ${cy - 76} L${cx} ${cy - 144} L${cx} ${cy - 86} Z`}
            fill="#EF4444"
            stroke="#DC2626"
            strokeWidth="0.7"
          />
          <path
            d={`M${cx + 9} ${cy - 76} L${cx} ${cy - 144} L${cx} ${cy - 86} Z`}
            fill="#B91C1C"
            stroke="#991B1B"
            strokeWidth="0.7"
          />
          {/* White center ridge line for precise optical sighting */}
          <line
            x1={cx}
            y1={cy - 86}
            x2={cx}
            y2={cy - 144}
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeOpacity="0.9"
          />

          {/* 指针N字母向中心移动，靠近针尖膨大部 (移至 cy - 82，清晰美观不遮挡尖端) */}
          <g transform={`translate(${cx}, ${cy - 82})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#DC2626"
              stroke="#FFFFFF"
              strokeWidth="2.8"
              paintOrder="stroke"
              fontSize="14"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              N
            </text>
          </g>

          {/* Center Needle Pivot & Jewel Bearing */}
          <circle cx={cx} cy={cy} r="10" fill="#0F172A" stroke="#E2E8F0" strokeWidth="2" />
          <path d={`M${cx - 7} ${cy} A 7 7 0 0 1 ${cx + 7} ${cy} Z`} fill="#DC2626" />
          <path d={`M${cx - 7} ${cy} A 7 7 0 0 0 ${cx + 7} ${cy} Z`} fill="#0284C7" />
          <circle cx={cx} cy={cy} r="3" fill="#FFFFFF" />
        </g>

        {/* 3. Forward Heading Pointer at 12 o'clock outer rim (置于刻度盘上方渲染，绝不被表盘底色遮挡切平针尖) */}
        {showForwardMarker && (
          <g id="forward-heading-pointer" className="cursor-default pointer-events-none" filter="url(#dialShadow)">
            <title>前进方向指针 (Forward Sighting Direction)</title>
            {/* Forward text badge moved strictly to the right side of the needle arrow (右侧独立徽标，不遮挡箭头) */}
            <g id="forward-text-label" transform={`translate(${cx + 26}, 18)`} className="pointer-events-auto">
              <rect
                x="0"
                y="-11"
                width="56"
                height="18"
                rx="4"
                fill="#FEF2F2"
                stroke="#F87171"
                strokeWidth="1"
              />
              <text
                x="28"
                y="1.5"
                textAnchor="middle"
                fill="#DC2626"
                fontSize="9.5"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                letterSpacing="0.5"
              >
                前进方向
              </text>
            </g>

            {/* Slender ultra-sharp needle-like arrow body (顶部与底部双向锐利细尖针样结构，顶部针尖绝无任何横向平切与遮挡) */}
            {/* Left facet: from top sharp apex at (cx, 6) tapering down via wing (cx-5, 23) to bottom sharp apex at (cx, 63.5) */}
            <path
              d={`M${cx} 6 L${cx - 5} 23 L${cx - 1.2} 26 L${cx} 63.5 Z`}
              fill="#DC2626"
              stroke="#991B1B"
              strokeWidth="0.6"
              strokeLinejoin="miter"
              strokeMiterlimit="10"
            />
            {/* Right facet: from top sharp apex at (cx, 6) tapering down via wing (cx+5, 23) to bottom sharp apex at (cx, 63.5) */}
            <path
              d={`M${cx} 6 L${cx + 5} 23 L${cx + 1.2} 26 L${cx} 63.5 Z`}
              fill="#EF4444"
              stroke="#DC2626"
              strokeWidth="0.6"
              strokeLinejoin="miter"
              strokeMiterlimit="10"
            />
            {/* Center optical sighting ridge line extending directly between the two sharp needle tips */}
            <line
              x1={cx}
              y1={6}
              x2={cx}
              y2={63.5}
              stroke="#FFFFFF"
              strokeWidth="0.8"
              strokeOpacity="0.95"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* 4. 测绘滤波选项 (移至原 罗盘-180° 位置，去除右侧滑杆与罗盘-180文字) */}
        {onToggleFilter && (
          <g
            id="survey-filter-mode-button"
            className="cursor-pointer select-none group"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFilter();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
          >
            <title>点击切换测绘滤波算法 (极稳 / 平滑 / 直读)</title>
            {/* Pill button matching 罗盘-180° location */}
            <rect
              x="326"
              y="18"
              width="128"
              height="36"
              rx="12"
              fill={filterMode === 'stable' ? '#F5F3FF' : filterMode === 'smooth' ? '#EEF2FF' : '#F8FAFC'}
              stroke={filterMode === 'stable' ? '#C084FC' : filterMode === 'smooth' ? '#818CF8' : '#CBD5E1'}
              strokeWidth="1.5"
              filter="url(#dialShadow)"
              className="group-hover:stroke-purple-600 transition-colors"
            />
            {/* Mode indicator dot */}
            <circle
              cx="342"
              cy="36"
              r="4.5"
              fill={filterMode === 'stable' ? '#7C3AED' : filterMode === 'smooth' ? '#4F46E5' : '#64748B'}
            />
            {/* Filter mode label text */}
            <text
              x="392"
              y="36.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill={filterMode === 'stable' ? '#6D28D9' : filterMode === 'smooth' ? '#4338CA' : '#334155'}
              fontSize="11.5"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {filterMode === 'stable' ? '🛡️ 测绘极稳滤波' : filterMode === 'smooth' ? '✨ 智能平滑' : '⚡ 直读滤波'}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
