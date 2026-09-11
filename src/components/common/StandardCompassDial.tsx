import React from 'react';

interface StandardCompassDialProps {
  heading: number; // 0 to 360 degrees
  size?: number; // pixel diameter
  className?: string;
}

/**
 * Standard Rotating Heading Compass Dial (标准航向罗盘)
 * Strictly enforces 1:1 circular aspect ratio via SVG vector math to prevent any elliptical distortion.
 * Features:
 * - Pure circular SVG: viewBox="0 0 320 320" with preserveAspectRatio="xMidYMid meet"
 * - Cardinal directions (东、南、西、北) in bright yellow (#FFD700)
 * - Intercardinal directions (东北、东南、西南、西北) in distinct red badges (#DC2626)
 * - Slender tapered needle arrow with NS letters near center diamond expansion
 * - Fixed top collimation index touching 12 o'clock scale
 */
export const StandardCompassDial: React.FC<StandardCompassDialProps> = ({
  heading = 0,
  size = 280,
  className = '',
}) => {
  const cx = 160;
  const cy = 160;
  const outerR = 146;
  const ringInnerR = 116;

  // Generate ticks for 360 degrees
  const ticks = [];
  for (let d = 0; d < 360; d += 2) {
    const isMajor = d % 30 === 0;
    const isMedium = d % 10 === 0 && !isMajor;
    const isFive = d % 5 === 0 && !isMajor && !isMedium;

    const tickLen = isMajor ? 11 : isMedium ? 7.5 : isFive ? 5 : 3;
    const rad = ((d - 90) * Math.PI) / 180;
    const x1 = cx + (outerR - 2) * Math.cos(rad);
    const y1 = cy + (outerR - 2) * Math.sin(rad);
    const x2 = cx + (outerR - 2 - tickLen) * Math.cos(rad);
    const y2 = cy + (outerR - 2 - tickLen) * Math.sin(rad);

    ticks.push({
      deg: d,
      x1,
      y1,
      x2,
      y2,
      isMajor,
      isMedium,
      strokeWidth: isMajor ? 2 : isMedium ? 1.2 : 0.75,
      strokeColor: isMajor ? '#1E293B' : isMedium ? '#64748B' : '#94A3B8',
    });
  }

  // Major degree numbers and cardinal labels
  // 0: 北 (N), 90: 东 (E), 180: 南 (S), 270: 西 (W)
  const cardinalDegrees = [
    { deg: 0, label: '北', sub: 'N', isCardinal: true },
    { deg: 30, label: '30' },
    { deg: 45, label: '东北', isIntercardinal: true },
    { deg: 60, label: '60' },
    { deg: 90, label: '东', sub: 'E', isCardinal: true },
    { deg: 120, label: '120' },
    { deg: 135, label: '东南', isIntercardinal: true },
    { deg: 150, label: '150' },
    { deg: 180, label: '南', sub: 'S', isCardinal: true },
    { deg: 210, label: '210' },
    { deg: 225, label: '西南', isIntercardinal: true },
    { deg: 240, label: '240' },
    { deg: 270, label: '西', sub: 'W', isCardinal: true },
    { deg: 300, label: '300' },
    { deg: 315, label: '西北', isIntercardinal: true },
    { deg: 330, label: '330' },
  ];

  return (
    <div
      className={`relative shrink-0 aspect-square flex items-center justify-center select-none ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      <svg
        viewBox="0 0 320 320"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full drop-shadow-lg overflow-visible aspect-square"
      >
        <defs>
          <radialGradient id="stdDialFace" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#F8FAFC" />
            <stop offset="95%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </radialGradient>
          <radialGradient id="stdCenterHub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="85%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <filter id="stdDropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* 极细纯蓝外框 (Ultra-thin Blue Casing Ring - 彻底替换原先粗厚黑外框) */}
        <circle cx={cx} cy={cy} r={outerR} fill="url(#stdDialFace)" stroke="#2563EB" strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r={outerR - 2} fill="none" stroke="#60A5FA" strokeWidth="0.6" strokeDasharray="2 2" />

        {/* Inner concentric guidance circles */}
        <circle cx={cx} cy={cy} r={ringInnerR + 8} fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
        <circle cx={cx} cy={cy} r={ringInnerR - 22} fill="none" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />

        {/* Rotating Dial Group: Rotates by -heading so top 12 o'clock always aligns with current course */}
        <g
          id="standard-rotating-dial-plate"
          transform={`rotate(${-heading}, ${cx}, ${cy})`}
          className="transition-transform duration-100 ease-out"
        >
          {/* Subtle crosshairs aligned with dial */}
          <line x1={cx - ringInnerR + 10} y1={cy} x2={cx + ringInnerR - 10} y2={cy} stroke="#E2E8F0" strokeWidth="0.8" />
          <line x1={cx} y1={cy - ringInnerR + 10} x2={cx} y2={cy + ringInnerR - 10} stroke="#E2E8F0" strokeWidth="0.8" />

          {/* Scale Ticks */}
          {ticks.map((t) => (
            <line
              key={t.deg}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.strokeColor}
              strokeWidth={t.strokeWidth}
              strokeLinecap="round"
            />
          ))}

          {/* Scale Labels (东、南等汉字不加底色，纯文字清爽排布) */}
          {cardinalDegrees.map((item) => {
            const rad = ((item.deg - 90) * Math.PI) / 180;
            const textR = item.isCardinal ? ringInnerR - 1 : item.isIntercardinal ? ringInnerR - 3 : ringInnerR - 4;
            const x = cx + textR * Math.cos(rad);
            const y = cy + textR * Math.sin(rad);

            if (item.isCardinal) {
              // 正东、正南、正西、正北: 无底色纯汉字，北为正红 (#DC2626)，东、南、西为高对比度深石板色 (#0F172A)
              const isNorth = item.deg === 0;
              return (
                <g key={item.deg} transform={`translate(${x}, ${y}) rotate(${item.deg})`}>
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isNorth ? '#DC2626' : '#0F172A'}
                    fontSize="13"
                    fontWeight="900"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {item.label}
                  </text>
                </g>
              );
            }

            if (item.isIntercardinal) {
              // 东南、西南、东北、西北: 无底色纯文字，正红字色 (#DC2626)
              return (
                <g key={item.deg} transform={`translate(${x}, ${y}) rotate(${item.deg})`}>
                  <text
                    x="0"
                    y="0.5"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#DC2626"
                    fontSize="9.5"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {item.label}
                  </text>
                </g>
              );
            }

            // Normal numbers: 30, 60, 120, 150...
            return (
              <text
                key={item.deg}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${item.deg}, ${x}, ${y})`}
                fill="#64748B"
                fontSize="8.5"
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {item.label}
              </text>
            );
          })}
        </g>

        {/* Center Magnetic Pointer (North Red, South Slate with center pivot) */}
        {/* Needle NS letters moved closer to center diamond expansion as requested */}
        <g id="standard-center-needle" filter="url(#stdDropShadow)">
          {/* North Half: sharp slender red needle pointing up towards 12 o'clock */}
          <path
            d={`M${cx} 42 L${cx - 4.5} ${cy - 12} L${cx} ${cy - 6} L${cx + 4.5} ${cy - 12} Z`}
            fill="#EF4444"
            stroke="#DC2626"
            strokeWidth="0.8"
          />
          {/* North facet highlight */}
          <path
            d={`M${cx} 42 L${cx - 4.5} ${cy - 12} L${cx} ${cy - 6} Z`}
            fill="#DC2626"
          />

          {/* South Half: sharp slender slate needle pointing down towards 6 o'clock */}
          <path
            d={`M${cx} ${cy * 2 - 42} L${cx - 4.5} ${cy + 12} L${cx} ${cy + 6} L${cx + 4.5} ${cy + 12} Z`}
            fill="#94A3B8"
            stroke="#64748B"
            strokeWidth="0.8"
          />
          {/* South facet highlight */}
          <path
            d={`M${cx} ${cy * 2 - 42} L${cx - 4.5} ${cy + 12} L${cx} ${cy + 6} Z`}
            fill="#64748B"
          />

          {/* N & S letters placed near center diamond expansion area for clarity & beauty */}
          <text
            x={cx}
            y={cy - 22}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#FFFFFF"
            fontSize="9"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            N
          </text>
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#FFFFFF"
            fontSize="9"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            S
          </text>

          {/* Center Hub & Jewel Cap */}
          <circle cx={cx} cy={cy} r="10" fill="url(#stdCenterHub)" stroke="#E2E8F0" strokeWidth="1.8" />
          <circle cx={cx} cy={cy} r="4" fill="#EF4444" stroke="#DC2626" strokeWidth="1" />
          <circle cx={cx - 1.2} cy={cy - 1.2} r="1" fill="#FFFFFF" opacity="0.8" />
        </g>

        {/* Top Fixed Sighting Index Marker (12 o'clock collimation needle pointer) */}
        <g id="top-fixed-heading-index">
          {/* Slender sharp needle pointing directly down to touch the 12 o'clock scale */}
          <path
            d={`M${cx} ${cy - outerR} L${cx - 3.5} ${cy - outerR - 10} L${cx} ${cy - outerR - 7} L${cx + 3.5} ${cy - outerR - 10} Z`}
            fill="#2563EB"
            stroke="#1D4ED8"
            strokeWidth="0.8"
          />
          {/* Center alignment line */}
          <line
            x1={cx}
            y1={cy - outerR - 11}
            x2={cx}
            y2={cy - outerR + 2}
            stroke="#1D4ED8"
            strokeWidth="0.8"
          />
        </g>
      </svg>
    </div>
  );
};
