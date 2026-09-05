import React from 'react';

/**
 * High-fidelity, handcrafted SVG illustrated icons matching 首页.jpg
 */

// 1. 标定航点: Blue circular location pin with airplane taking off inside
export const WaypointMarkIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="pinGrad" x1="20" y1="10" x2="80" y2="85" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#42A5F5" />
        <stop offset="50%" stopColor="#1E88E5" />
        <stop offset="100%" stopColor="#1565C0" />
      </linearGradient>
      <radialGradient id="pinInner" cx="50" cy="42" r="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#E3F2FD" />
        <stop offset="100%" stopColor="#BBDEFB" />
      </radialGradient>
      <filter id="pinShadow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#0D47A1" floodOpacity="0.25" />
      </filter>
    </defs>
    {/* Map Pin Body */}
    <g filter="url(#pinShadow)">
      <path
        d="M50 12C32.327 12 18 26.327 18 44C18 64.5 45 88 50 90C55 88 82 64.5 82 44C82 26.327 67.673 12 50 12Z"
        fill="url(#pinGrad)"
      />
      {/* White Inner Circle Rim */}
      <circle cx="50" cy="42" r="23" fill="white" />
      <circle cx="50" cy="42" r="20" fill="url(#pinInner)" />
      {/* Airplane Silhouette */}
      <path
        d="M50 29L52.5 37L63 41.5V44.5L52.5 42L52 49L55 52V54L50 52.5L45 54V52L48 49L47.5 42L37 44.5V41.5L47.5 37L50 29Z"
        fill="#1565C0"
      />
    </g>
  </svg>
);

// 2. 航点管理: Notepad clipboard with clip, paper lines, and green pencil
export const WaypointManageIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <filter id="clipShadow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#78350F" floodOpacity="0.2" />
      </filter>
      <linearGradient id="boardGrad" x1="20" y1="16" x2="80" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <g filter="url(#clipShadow)">
      {/* Wooden / Tan Board */}
      <rect x="22" y="14" width="46" height="66" rx="6" fill="url(#boardGrad)" />
      <rect x="23" y="15" width="44" height="64" rx="5" stroke="#B45309" strokeWidth="1.5" />
      {/* White Paper Sheet */}
      <rect x="26" y="22" width="38" height="54" rx="3" fill="#FFFFFF" />
      {/* Paper horizontal lines */}
      <line x1="31" y1="32" x2="59" y2="32" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="31" y1="40" x2="59" y2="40" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="31" y1="48" x2="59" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="31" y1="56" x2="59" y2="56" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="31" y1="64" x2="50" y2="64" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
      {/* Metallic Binder Clip on Top */}
      <rect x="36" y="10" width="18" height="10" rx="2" fill="#475569" />
      <rect x="38" y="12" width="14" height="4" rx="1" fill="#94A3B8" />
      {/* Realistic Green Pencil tilted */}
      <g transform="translate(48, 28) rotate(32)">
        {/* Pencil eraser */}
        <rect x="0" y="0" width="7" height="6" rx="1" fill="#F43F5E" />
        {/* Metal band */}
        <rect x="0" y="6" width="7" height="3" fill="#CBD5E1" />
        {/* Green body */}
        <rect x="0" y="9" width="7" height="36" fill="#10B981" />
        <rect x="2" y="9" width="3" height="36" fill="#059669" />
        {/* Wood tip */}
        <path d="M0 45L3.5 54L7 45Z" fill="#FED7AA" />
        {/* Graphite tip */}
        <path d="M2 50L3.5 54L5 50Z" fill="#1E293B" />
      </g>
    </g>
  </svg>
);

// 3. 航线与航迹: Map canvas with start pin, curved dashed path, and 3D blue airplane
export const RouteTrackIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <filter id="routeShadow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0284C7" floodOpacity="0.2" />
      </filter>
      <linearGradient id="mapTileGrad" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="100%" stopColor="#BAE6FD" />
      </linearGradient>
    </defs>
    <g filter="url(#routeShadow)">
      {/* Light Blue Map Surface */}
      <rect x="16" y="16" width="68" height="68" rx="8" fill="url(#mapTileGrad)" />
      {/* Subtle map road grid */}
      <path d="M16 48H84" stroke="#93C5FD" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M48 16V84" stroke="#93C5FD" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Dashed Flight Curve */}
      <path
        d="M26 68C28 45 42 36 68 28"
        stroke="#1E293B"
        strokeWidth="2.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      {/* Start Waypoint Pin */}
      <circle cx="26" cy="68" r="6" fill="#EF4444" />
      <circle cx="26" cy="68" r="2.5" fill="#FFFFFF" />
      {/* Intermediate waypoint dot */}
      <circle cx="26" cy="50" r="4" fill="#0F172A" />
      <circle cx="26" cy="50" r="1.5" fill="#FFFFFF" />
      {/* Soaring 3D Blue Airplane */}
      <g transform="translate(68, 28) rotate(-24)">
        {/* Airplane body */}
        <path
          d="M0 -15L4 -5L18 0V4L4 1L3 10L7 14V16L0 14L-7 16V14L-3 10L-4 1L-18 4V0L-4 -5L0 -15Z"
          fill="#0284C7"
        />
        {/* Highlight wing */}
        <path d="M0 -15L2 -5L14 0V2L2 0L0 -15Z" fill="#38BDF8" />
        <circle cx="0" cy="-7" r="1.5" fill="#FFFFFF" />
      </g>
    </g>
  </svg>
);

// 4. 卫星地图: 3D realistic earth globe with continents and atmosphere
export const SatelliteMapIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="globeSphere" cx="40" cy="36" r="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="45%" stopColor="#0284C7" />
        <stop offset="85%" stopColor="#0369A1" />
        <stop offset="100%" stopColor="#075985" />
      </radialGradient>
      <filter id="globeGlow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0284C7" floodOpacity="0.3" />
      </filter>
    </defs>
    <g filter="url(#globeGlow)">
      {/* Outer Atmosphere Glow */}
      <circle cx="50" cy="50" r="38" fill="url(#globeSphere)" />
      {/* Clip path for globe continents */}
      <clipPath id="globeClip">
        <circle cx="50" cy="50" r="38" />
      </clipPath>
      <g clipPath="url(#globeClip)">
        {/* Continents (Green land masses) */}
        {/* Eurasia / Asia continent */}
        <path
          d="M38 24C44 22 55 24 64 28C72 32 75 42 70 48C65 54 58 52 52 50C46 48 44 40 40 38C36 36 34 28 38 24Z"
          fill="#10B981"
        />
        {/* Africa continent */}
        <path
          d="M35 44C40 42 46 48 45 58C44 66 38 72 34 70C30 68 30 58 32 50C33 46 34 44 35 44Z"
          fill="#059669"
        />
        {/* Australia / Islands */}
        <circle cx="68" cy="64" r="5" fill="#10B981" />
        <circle cx="76" cy="58" r="2.5" fill="#34D399" />
        <circle cx="58" cy="68" r="2" fill="#34D399" />
        {/* Lat/Lon grid lines overlay */}
        <ellipse cx="50" cy="50" rx="38" ry="18" stroke="#E0F2FE" strokeWidth="1" strokeOpacity="0.4" fill="none" />
        <ellipse cx="50" cy="50" rx="38" ry="32" stroke="#E0F2FE" strokeWidth="1" strokeOpacity="0.4" fill="none" />
        <ellipse cx="50" cy="50" rx="18" ry="38" stroke="#E0F2FE" strokeWidth="1" strokeOpacity="0.4" fill="none" />
        <line x1="12" y1="50" x2="88" y2="50" stroke="#E0F2FE" strokeWidth="1.2" strokeOpacity="0.4" />
        {/* Specular White Atmosphere Arc */}
        <path
          d="M20 28C28 20 40 16 54 18"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
      </g>
    </g>
  </svg>
);

// 5. 工程测量: Yellow and black agricultural / engineering tractor
export const EngineeringSurveyIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <filter id="tractorShadow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.25" />
      </filter>
      <linearGradient id="tractorYellow" x1="30" y1="30" x2="70" y2="70" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <g filter="url(#tractorShadow)">
      {/* Tractor Cabin Frame */}
      <path d="M42 34H60L58 54H38L42 34Z" fill="#38BDF8" fillOpacity="0.7" />
      <path d="M40 32H62L60 54H36L40 32Z" stroke="#F59E0B" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Roof Canopy */}
      <rect x="36" y="28" width="28" height="5" rx="2" fill="url(#tractorYellow)" />
      {/* Exhaust Pipe */}
      <rect x="68" y="32" width="3" height="18" fill="#475569" />
      <path d="M68 32C68 30 72 30 72 32" stroke="#475569" strokeWidth="2" fill="none" />
      {/* Front Engine Hood */}
      <path d="M58 44H74L76 58H58V44Z" fill="url(#tractorYellow)" />
      {/* Engine Grille */}
      <line x1="74" y1="46" x2="74" y2="56" stroke="#1E293B" strokeWidth="2" />
      {/* Big Rear Wheel */}
      <circle cx="38" cy="64" r="16" fill="#1E293B" />
      <circle cx="38" cy="64" r="14" stroke="#0F172A" strokeWidth="3" />
      {/* Rear Wheel Yellow Rim */}
      <circle cx="38" cy="64" r="8" fill="#F59E0B" />
      <circle cx="38" cy="64" r="3" fill="#1E293B" />
      {/* Wheel Treads */}
      <path d="M38 48V52M38 76V80M22 64H26M50 64H54" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      {/* Front Smaller Wheel */}
      <circle cx="72" cy="68" r="10" fill="#1E293B" />
      <circle cx="72" cy="68" r="5" fill="#F59E0B" />
      <circle cx="72" cy="68" r="2" fill="#1E293B" />
    </g>
  </svg>
);

// 6. 工程项目: Hand catching/receiving falling shiny gold coins
export const ProjectManageIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <filter id="handShadow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#B45309" floodOpacity="0.25" />
      </filter>
      <linearGradient id="goldCoin" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="60%" stopColor="#EAB308" />
        <stop offset="100%" stopColor="#CA8A04" />
      </linearGradient>
    </defs>
    <g filter="url(#handShadow)">
      {/* Falling Gold Coins with dynamic tilt */}
      <g transform="translate(56, 16) rotate(-15)">
        <ellipse cx="0" cy="0" rx="8" ry="4.5" fill="url(#goldCoin)" stroke="#A16207" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="#FDE047" />
      </g>
      <g transform="translate(42, 24) rotate(20)">
        <ellipse cx="0" cy="0" rx="9" ry="5" fill="url(#goldCoin)" stroke="#A16207" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="6" ry="3" fill="#FDE047" />
      </g>
      <g transform="translate(68, 28) rotate(-35)">
        <ellipse cx="0" cy="0" rx="7.5" ry="4" fill="url(#goldCoin)" stroke="#A16207" strokeWidth="1" />
      </g>
      <g transform="translate(52, 38) rotate(5)">
        <ellipse cx="0" cy="0" rx="10" ry="5.5" fill="url(#goldCoin)" stroke="#A16207" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="6.5" ry="3" fill="#FDE047" />
      </g>
      <g transform="translate(38, 42) rotate(-10)">
        <ellipse cx="0" cy="0" rx="8" ry="4.5" fill="url(#goldCoin)" stroke="#A16207" strokeWidth="1" />
      </g>
      <g transform="translate(64, 44) rotate(25)">
        <ellipse cx="0" cy="0" rx="8" ry="4.5" fill="url(#goldCoin)" stroke="#A16207" strokeWidth="1" />
      </g>

      {/* Outstretched Hand & Arm with red cuff */}
      {/* Red sleeve cuff */}
      <path d="M78 62L88 65V78L78 75Z" fill="#DC2626" />
      <rect x="75" y="60" width="4" height="17" rx="1.5" fill="#FFFFFF" />
      {/* Palm & Fingers */}
      <path
        d="M75 62C68 62 60 60 52 58C46 56 40 56 36 60C34 62 36 66 40 67L54 70C60 71 68 72 75 74V62Z"
        fill="#FBCFE8"
      />
      <path
        d="M75 62C66 61 58 59 48 56C42 54 35 56 32 60C30 63 32 67 36 68L56 72C64 73 70 74 75 74"
        stroke="#F472B6"
        strokeWidth="1.5"
      />
    </g>
  </svg>
);

// 7. 常用工具: Wooden handle hammer and chrome adjustable wrench crossed
export const CommonToolsIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <filter id="toolShadow" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1E293B" floodOpacity="0.25" />
      </filter>
      <linearGradient id="hammerHandle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#D97706" />
        <stop offset="50%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
      <linearGradient id="wrenchChrome" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#E2E8F0" />
        <stop offset="50%" stopColor="#94A3B8" />
        <stop offset="100%" stopColor="#64748B" />
      </linearGradient>
    </defs>
    <g filter="url(#toolShadow)">
      {/* Hammer (tilted left-down to right-up) */}
      <g transform="translate(50, 50) rotate(-45) translate(-50, -50)">
        {/* Wooden Handle */}
        <rect x="46" y="24" width="8" height="54" rx="3" fill="url(#hammerHandle)" />
        {/* Metal Claw Hammer Head */}
        <path
          d="M34 20H66V26H56V28H44V26H34V20Z"
          fill="#64748B"
        />
        {/* Striking Face */}
        <rect x="62" y="19" width="7" height="8" rx="1.5" fill="#94A3B8" />
        {/* Curved Claw */}
        <path d="M34 20C30 18 24 22 22 28C24 26 28 24 34 25V20Z" fill="#94A3B8" />
      </g>

      {/* Chrome Wrench (tilted right-down to left-up) */}
      <g transform="translate(50, 50) rotate(45) translate(-50, -50)">
        {/* Wrench Handle */}
        <rect x="46" y="24" width="8" height="54" rx="3" fill="url(#wrenchChrome)" />
        {/* Handle hanging hole */}
        <circle cx="50" cy="72" r="2.5" fill="#F1F5F9" />
        {/* Open-end Wrench Head */}
        <path
          d="M38 16C38 10 62 10 62 16C62 24 56 26 56 28H44C44 26 38 24 38 16Z"
          fill="url(#wrenchChrome)"
        />
        {/* Wrench Jaw Cutout */}
        <path d="M45 12L50 18L55 12V20H45V12Z" fill="#F1F5F9" />
      </g>
    </g>
  </svg>
);
