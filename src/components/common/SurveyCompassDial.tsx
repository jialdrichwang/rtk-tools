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
}

/**
 * Authentic Geological and Surveying Compass Dial
 * Matches 指南针new.jpg:
 * 1. 罗盘刻度触摸旋转 (Touch-rotatable dial)
 * 2. 罗盘外沿顶部红三角，表示前进方向 (Red triangle at top outer rim for forward heading)
 * 3. 右手边触摸弧线，两端各表示顺逆转180° (Touch arc slider on right side, -180° to +180°)
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
}) => {
  const [internalRotation, setInternalRotation] = useState(0);
  const currentRotation = controlledRotation !== undefined ? controlledRotation : internalRotation;

  const updateRotation = useCallback(
    (rot: number) => {
      // Clamp rotation between -180 and +180
      const clamped = Math.max(-180, Math.min(180, Math.round(rot * 10) / 10));
      if (controlledRotation === undefined) {
        setInternalRotation(clamped);
      }
      onRotationChange?.(clamped);
    },
    [controlledRotation, onRotationChange]
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingArc = useRef(false);
  const isDraggingDial = useRef(false);
  const dialDragStart = useRef<{ pointerAngle: number; initialRotation: number }>({
    pointerAngle: 0,
    initialRotation: 0,
  });

  // SVG Geometry Settings
  const cx = 195;
  const cy = 215;
  const outerR = 152;
  const ringInnerR = 118;
  const boxInnerR = 94;

  // Arc Slider Geometry (Right-Hand Touch Arc)
  // An elegant circular arc on the right of the compass dial matching 指南针new.jpg
  const arcCenter = { x: 260, y: 215 };
  const arcRadius = 168;
  const arcMinAngle = -62; // top: -180°
  const arcMaxAngle = 62;  // bottom: +180°

  // Calculate coordinates along arc for a given dial rotation (-180° to +180°)
  const rotationToArcAngle = (rot: number) => {
    const fraction = (rot - (-180)) / 360; // 0 (top) to 1 (bottom)
    return arcMinAngle + fraction * (arcMaxAngle - arcMinAngle);
  };

  const currentArcAngle = rotationToArcAngle(currentRotation);
  const thumbRad = (currentArcAngle * Math.PI) / 180;
  const thumbX = arcCenter.x + arcRadius * Math.cos(thumbRad);
  const thumbY = arcCenter.y + arcRadius * Math.sin(thumbRad);

  // Arc path string
  const startRad = (arcMinAngle * Math.PI) / 180;
  const endRad = (arcMaxAngle * Math.PI) / 180;
  const arcStartX = arcCenter.x + arcRadius * Math.cos(startRad);
  const arcStartY = arcCenter.y + arcRadius * Math.sin(startRad);
  const arcEndX = arcCenter.x + arcRadius * Math.cos(endRad);
  const arcEndY = arcCenter.y + arcRadius * Math.sin(endRad);
  const arcPath = `M ${arcStartX} ${arcStartY} A ${arcRadius} ${arcRadius} 0 0 1 ${arcEndX} ${arcEndY}`;

  // Formula for dial degrees: 0° is bottom (北), 180° is top (南)
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

    if (d === 0 || d === 360) {
      showLabel = true;
      labelText = '360';
      isCardinal = true;
    } else if (d === 90) {
      showLabel = true;
      labelText = '90';
      isCardinal = true;
    } else if (d === 180) {
      showLabel = true;
      labelText = '180';
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

  // Pointer interaction for Right-Side Touch Arc
  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 460;
    const y = ((clientY - rect.top) / rect.height) * 420;
    return { x, y };
  };

  const handleArcPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingArc.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const updateFromArcPointer = (clientX: number, clientY: number) => {
      const { x, y } = getSvgCoordinates(clientX, clientY);
      const angleRad = Math.atan2(y - arcCenter.y, x - arcCenter.x);
      const angleDeg = (angleRad * 180) / Math.PI;
      const clampedAngle = Math.max(arcMinAngle, Math.min(arcMaxAngle, angleDeg));
      const fraction = (clampedAngle - arcMinAngle) / (arcMaxAngle - arcMinAngle);
      const newRot = -180 + fraction * 360;
      updateRotation(newRot);
    };

    updateFromArcPointer(e.clientX, e.clientY);

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingArc.current) return;
      updateFromArcPointer(ev.clientX, ev.clientY);
    };

    const handlePointerUp = () => {
      isDraggingArc.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Pointer interaction for Touching and Rotating the Dial Directly
  const handleDialPointerDown = (e: React.PointerEvent) => {
    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
    if (x > 335) return; // Right side is reserved for arc slider

    e.preventDefault();
    isDraggingDial.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const startAngle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    dialDragStart.current = {
      pointerAngle: startAngle,
      initialRotation: currentRotation,
    };

    const handleDialMove = (ev: PointerEvent) => {
      if (!isDraggingDial.current) return;
      const coords = getSvgCoordinates(ev.clientX, ev.clientY);
      const currentAngle = (Math.atan2(coords.y - cy, coords.x - cx) * 180) / Math.PI;
      let delta = currentAngle - dialDragStart.current.pointerAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      let targetRot = dialDragStart.current.initialRotation + delta;
      if (targetRot > 180) targetRot = 180;
      if (targetRot < -180) targetRot = -180;
      updateRotation(targetRot);
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
  // Points to geomagnetic heading on the dial:
  // The needle points to degree `heading` on the dial.
  // When dial is rotated by `currentRotation`, degree `heading` is at:
  // screenAngle(heading) + currentRotation
  const needleAngleDeg = (getScreenAngle(heading) * 180) / Math.PI + currentRotation;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg
        ref={svgRef}
        viewBox="0 0 460 420"
        style={{ width: `${size}px`, height: `${(size * 420) / 460}px`, maxWidth: '100%', maxHeight: '74vh' }}
        className="drop-shadow-lg touch-none"
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

        {/* 1. Forward Heading Red Triangle at 12 o'clock outer rim (罗盘外沿顶部有一个红三角，表示前进方向) */}
        {showForwardMarker && (
          <g id="forward-heading-pointer" className="cursor-default" title="前进方向标志 (Forward Direction)">
            {/* Extended Red Triangular Pointer pointing straight down to outer circle */}
            <polygon
              points={`${cx - 7},16 ${cx + 7},16 ${cx},60`}
              fill="#DC2626"
              stroke="#991B1B"
              strokeWidth="0.8"
            />
            {/* Left highlight facet */}
            <polygon
              points={`${cx - 7},16 ${cx},16 ${cx},60`}
              fill="#EF4444"
            />
            {/* Top subtle border cap */}
            <rect x={cx - 7} y="13" width="14" height="3" rx="1" fill="#B91C1C" />
          </g>
        )}

        {/* 2. Rotatable Dial Group (罗盘刻度触摸旋转) */}
        <g
          id="rotatable-compass-dial"
          transform={`rotate(${currentRotation}, ${cx}, ${cy})`}
          onPointerDown={handleDialPointerDown}
          className="cursor-grab active:cursor-grabbing transition-transform duration-75 ease-out"
        >
          {/* Dial Baseplate */}
          <circle cx={cx} cy={cy} r={outerR + 5} fill="#FFFFFF" stroke="#334155" strokeWidth="2.2" />
          <circle cx={cx} cy={cy} r={outerR} fill="url(#compassPlate)" stroke="#94A3B8" strokeWidth="1" />

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
                  fontSize={t.isCardinal ? '15' : '8'}
                  fontWeight={t.isCardinal ? '900' : 'bold'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  transform={`rotate(${t.rotation}, ${t.labelX}, ${t.labelY})`}
                >
                  {t.labelText}
                </text>
              )}
            </g>
          ))}

          {/* 4 Cardinal Directions Yellow Badge Boxes */}
          {/* 南 (180°) - Top */}
          <rect x={cx - 13} y={cy - ringInnerR + 2} width="26" height="23" fill="#FEF08A" stroke="#475569" strokeWidth="1.2" />
          <text x={cx} y={cy - ringInnerR + 13} textAnchor="middle" dominantBaseline="central" fill="#0F172A" fontSize="13" fontWeight="bold">
            南
          </text>
          <text x={cx} y={cy - ringInnerR + 32} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="11" fontWeight="extrabold">
            S
          </text>

          {/* 北 (360° / 0°) - Bottom */}
          <rect x={cx - 13} y={cy + ringInnerR - 25} width="26" height="23" fill="#FEF08A" stroke="#475569" strokeWidth="1.2" />
          <text x={cx} y={cy + ringInnerR - 14} textAnchor="middle" dominantBaseline="central" fill="#0F172A" fontSize="13" fontWeight="bold">
            北
          </text>
          <text x={cx} y={cy + ringInnerR - 33} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="11" fontWeight="extrabold">
            N
          </text>

          {/* 東 (90°) - Left */}
          <rect x={cx - ringInnerR + 2} y={cy - 12} width="23" height="24" fill="#FEF08A" stroke="#475569" strokeWidth="1.2" />
          <text x={cx - ringInnerR + 13.5} y={cy} textAnchor="middle" dominantBaseline="central" fill="#0F172A" fontSize="13" fontWeight="bold">
            東
          </text>
          <text x={cx - ringInnerR + 32} y={cy} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="11" fontWeight="extrabold">
            E
          </text>

          {/* 西 (270°) - Right */}
          <rect x={cx + ringInnerR - 25} y={cy - 12} width="23" height="24" fill="#FEF08A" stroke="#475569" strokeWidth="1.2" />
          <text x={cx + ringInnerR - 13.5} y={cy} textAnchor="middle" dominantBaseline="central" fill="#0F172A" fontSize="13" fontWeight="bold">
            西
          </text>
          <text x={cx + ringInnerR - 32} y={cy} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="11" fontWeight="extrabold">
            W
          </text>

          {/* 4 Quadrants: 東南, 西南, 東北, 西北 in Pink Boxes */}
          {/* 東南 (Top-Left, ~135°) */}
          {(() => {
            const rad = getScreenAngle(135);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#FCA5A5" stroke="#991B1B" strokeWidth="1" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#991B1B" fontSize="10" fontWeight="bold">
                  東南
                </text>
              </g>
            );
          })()}

          {/* 西南 (Top-Right, ~225°) */}
          {(() => {
            const rad = getScreenAngle(225);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#FCA5A5" stroke="#991B1B" strokeWidth="1" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#991B1B" fontSize="10" fontWeight="bold">
                  西南
                </text>
              </g>
            );
          })()}

          {/* 東北 (Bottom-Left, ~045°) */}
          {(() => {
            const rad = getScreenAngle(45);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#FCA5A5" stroke="#991B1B" strokeWidth="1" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#991B1B" fontSize="10" fontWeight="bold">
                  東北
                </text>
              </g>
            );
          })()}

          {/* 西北 (Bottom-Right, ~315°) */}
          {(() => {
            const rad = getScreenAngle(315);
            const x = cx + ((ringInnerR + boxInnerR) / 2) * Math.cos(rad);
            const y = cy + ((ringInnerR + boxInnerR) / 2) * Math.sin(rad);
            const rot = (rad * 180) / Math.PI + 90;
            return (
              <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
                <rect x="-16" y="-10" width="32" height="20" fill="#FCA5A5" stroke="#991B1B" strokeWidth="1" />
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fill="#991B1B" fontSize="10" fontWeight="bold">
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

        {/* 3. Dynamic Magnetic Needle (南北指针指向地磁南北) */}
        {/* Needle indicates geomagnetic North/South relative to the dial face */}
        <g transform={`rotate(${needleAngleDeg}, ${cx}, ${cy})`} className="transition-transform duration-100 ease-out pointer-events-none">
          {/* Blue Needle Tail (Points to South / Opposite direction, length ~88px) */}
          <path
            d={`M${cx} ${cy - 3.5} L${cx - 88} ${cy} L${cx} ${cy + 3.5} Z`}
            fill="#0284C7"
            stroke="#0369A1"
            strokeWidth="0.8"
          />
          <path
            d={`M${cx} ${cy} L${cx - 88} ${cy} L${cx} ${cy + 3.5} Z`}
            fill="#38BDF8"
          />

          {/* Red Needle Pointer (Pointing to North / Azimuth) */}
          {/* Stem */}
          <path
            d={`M${cx} ${cy - 5} L${cx + 80} ${cy - 1.5} L${cx + 80} ${cy + 1.5} L${cx} ${cy + 5} Z`}
            fill="#DC2626"
          />
          <path
            d={`M${cx} ${cy} L${cx + 80} ${cy - 1.5} L${cx + 80} ${cy} Z`}
            fill="#EF4444"
          />

          {/* Extended Red Arrowhead (Length ~70px, tip extends right to graduation rim at cx+150) */}
          <path
            d={`M${cx + 78} ${cy - 8} L${cx + 150} ${cy} L${cx + 88} ${cy} Z`}
            fill="#EF4444"
            stroke="#DC2626"
            strokeWidth="0.7"
          />
          <path
            d={`M${cx + 78} ${cy + 8} L${cx + 150} ${cy} L${cx + 88} ${cy} Z`}
            fill="#B91C1C"
            stroke="#991B1B"
            strokeWidth="0.7"
          />
          <line
            x1={cx + 88}
            y1={cy}
            x2={cx + 150}
            y2={cy}
            stroke="#FFFFFF"
            strokeWidth="0.8"
            strokeOpacity="0.85"
          />

          {/* Center Needle Pivot */}
          <circle cx={cx} cy={cy} r="10" fill="#0F172A" stroke="#E2E8F0" strokeWidth="2" />
          <path d={`M${cx} ${cy - 7.5} A 7.5 7.5 0 0 1 ${cx} ${cy + 7.5} Z`} fill="#DC2626" />
          <path d={`M${cx} ${cy - 7.5} A 7.5 7.5 0 0 0 ${cx} ${cy + 7.5} Z`} fill="#0284C7" />
          <circle cx={cx} cy={cy} r="3" fill="#F8FAFC" />
        </g>

        {/* 4. Right-Hand Touch Arc & Slider (右手边触摸弧线，两头顶各表示刻度盘顺逆转180) */}
        <g id="right-hand-touch-arc">
          {/* Top Label: 罗盘-180° (Clickable to rotate to -180°) */}
          <g
            className="cursor-pointer group active:opacity-75"
            onClick={() => updateRotation(-180)}
            title="点击快速逆转180°"
          >
            <text
              x="400"
              y="38"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#16A34A"
              fontSize="13"
              fontWeight="bold"
              className="group-hover:fill-emerald-700 transition-colors"
            >
              罗盘-180°
            </text>
          </g>

          {/* Touch Arc Curve (Solid black curved track) */}
          {/* Wide invisible hit area for easy finger grabbing */}
          <path
            d={arcPath}
            fill="none"
            stroke="transparent"
            strokeWidth="36"
            onPointerDown={handleArcPointerDown}
            className="cursor-pointer"
          />
          {/* Visible arc stroke */}
          <path
            d={arcPath}
            fill="none"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinecap="round"
            onPointerDown={handleArcPointerDown}
            className="cursor-pointer pointer-events-none"
          />

          {/* Bottom Label: 罗盘+180° (Clickable to rotate to +180°) */}
          <g
            className="cursor-pointer group active:opacity-75"
            onClick={() => updateRotation(180)}
            title="点击快速顺转180°"
          >
            <text
              x="400"
              y="396"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#16A34A"
              fontSize="13"
              fontWeight="bold"
              className="group-hover:fill-emerald-700 transition-colors"
            >
              罗盘+180°
            </text>
          </g>

          {/* Amber Golden Slider Thumb (🟡 Draggable along the touch arc) */}
          <g
            id="arc-slider-thumb"
            transform={`translate(${thumbX}, ${thumbY})`}
            onPointerDown={handleArcPointerDown}
            onDoubleClick={() => updateRotation(0)}
            className="cursor-grab active:cursor-grabbing group"
            title="按住上下滑动旋转刻度盘，双击归零"
          >
            {/* Extended invisible touch hit area */}
            <circle cx="0" cy="0" r="22" fill="transparent" />

            {/* Amber/Yellow Circular Thumb Button matching 指南针new.jpg */}
            <circle
              cx="0"
              cy="0"
              r="13"
              fill="#F59E0B"
              stroke="#D97706"
              strokeWidth="2"
              className="group-hover:fill-amber-400 group-hover:stroke-amber-600 transition-all shadow-md group-active:scale-110"
            />
            {/* Center grip line/indicator */}
            <line x1="-5" y1="0" x2="5" y2="0" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="0" cy="0" r="1.5" fill="#78350F" />
          </g>
        </g>
      </svg>

      {/* Rotation Status Bar with Quick Reset Button */}
      <div className="flex items-center gap-2 mt-1 text-xs">
        <span className="text-slate-500 font-mono">
          刻度偏角: <b className="text-slate-800 font-bold">{currentRotation > 0 ? `+${currentRotation}` : currentRotation}°</b>
        </span>
        {currentRotation !== 0 && (
          <button
            onClick={() => updateRotation(0)}
            className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-300 transition cursor-pointer shadow-2xs"
            title="刻度盘旋转归零"
          >
            归零
          </button>
        )}
      </div>
    </div>
  );
};
