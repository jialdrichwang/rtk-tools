import React from 'react';

export interface BaselineFrequencyBarProps {
  /**
   * Effective locked GPS signal sampling rate in Hz (0 to 10+ Hz)
   */
  hz?: number;
  /**
   * Direct control of green (accepted) block count (0 to 6)
   */
  greenCount?: number;
  /**
   * Direct control of red (rejected) block count (0 to 6)
   */
  redCount?: number;
  /**
   * Optional prefix label text (default: 'GPS采样指示')
   */
  prefixLabel?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
  vertical?: boolean;
}

/**
 * GPS采样指示 · 方块灯 (GPS Sampling Indicator Sync Blink Blocks)
 *
 * 【用户核心要求】:
 * 1. 命名为“GPS采样指示”，与“GPS航向模式 磁隔离基线”在同一行显示；
 * 2. 通过方块灯直观了解采样点下发及采信情况；
 * 3. 红绿同频闪动，不是流动的！红绿同开同关，只是红绿的个数区别，用于估计GPS指南针工作有效状态；
 * 4. 包含 6 个方块灯:
 *    - 采信状态良好 (如 >= 6Hz 或高采信): 6 绿 0 红 (全绿同频闪动)
 *    - 出现偶发跳点或滤波丢弃: X 绿 Y 红 (红绿完全同步、同开同关闪动，红绿灯数量直观区分)
 *    - 无有效采样下发 (0Hz 或全过滤): 0 绿 6 红 (全红同频同步警告)
 */
export const BaselineFrequencyBar: React.FC<BaselineFrequencyBarProps> = ({
  hz = 0,
  greenCount,
  redCount,
  prefixLabel,
  className = '',
  size = 'md',
  showLabel = false,
  labelPosition = 'right',
  vertical = false,
}) => {
  const roundedHz = Math.max(0, Math.round(hz * 10) / 10);

  // 计算红绿方块灯数量 (0 - 6)
  let finalGreenCount: number;
  let finalRedCount: number;

  if (greenCount !== undefined) {
    finalGreenCount = Math.max(0, Math.min(6, greenCount));
    finalRedCount = redCount !== undefined ? Math.max(0, Math.min(6, redCount)) : 6 - finalGreenCount;
  } else {
    // 基于采样有效频率 (Hz) 推算有效采信与过滤比例
    if (roundedHz >= 5.5) {
      finalGreenCount = 6;
    } else if (roundedHz >= 4.5) {
      finalGreenCount = 5;
    } else if (roundedHz >= 3.5) {
      finalGreenCount = 4;
    } else if (roundedHz >= 2.5) {
      finalGreenCount = 3;
    } else if (roundedHz >= 1.5) {
      finalGreenCount = 2;
    } else if (roundedHz >= 0.5) {
      finalGreenCount = 1;
    } else {
      finalGreenCount = 0;
    }
    finalRedCount = 6 - finalGreenCount;
  }

  // 方块灯尺寸适配
  const blockDimensions =
    size === 'xs'
      ? 'w-1.5 h-1.5 rounded-[0.5px]'
      : size === 'sm'
      ? 'w-2 h-2 rounded-[0.8px]'
      : size === 'lg'
      ? 'w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[1.5px]'
      : 'w-2.5 h-2.5 sm:w-2.8 sm:h-2.8 rounded-[1px]';

  const gapClass = size === 'xs' ? 'gap-0.5' : size === 'sm' ? 'gap-1' : 'gap-1.5';

  return (
    <div
      className={`inline-flex items-center ${
        vertical ? 'flex-col' : 'flex-row'
      } ${
        labelPosition === 'top' || labelPosition === 'bottom' ? 'flex-col gap-1' : 'gap-1.5'
      } select-none ${className}`}
      title={`GPS采样指示: 采信 ${finalGreenCount} 绿灯 / 过滤 ${finalRedCount} 红灯 · 采样率 ${roundedHz.toFixed(1)}Hz · 红绿同频同开同关同步闪动`}
    >
      {prefixLabel && (
        <span className="text-[10px] font-mono text-slate-300 whitespace-nowrap">
          {prefixLabel}
        </span>
      )}

      {showLabel && (labelPosition === 'left' || labelPosition === 'top') && (
        <span className="text-[10px] font-mono font-bold text-slate-300 whitespace-nowrap">
          {roundedHz.toFixed(1)}Hz
        </span>
      )}

      {/* 6 个方块灯：红绿同频同开同关同步闪动 (非流动流水式，完全同步同开同关) */}
      <div className={`flex ${vertical ? 'flex-col-reverse' : 'flex-row'} items-center ${gapClass}`}>
        {Array.from({ length: 6 }).map((_, idx) => {
          const isGreen = idx < finalGreenCount;
          return (
            <div
              key={idx}
              className={`${blockDimensions} ${
                isGreen
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.95)]'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.95)]'
              } animate-gps-sync-blink`}
              style={{
                // 严格保证同频同开同关，杜绝任何流动错开延时
                animationDelay: '0ms',
              }}
            />
          );
        })}
      </div>

      {showLabel && (labelPosition === 'right' || labelPosition === 'bottom') && (
        <span className="text-[10px] font-mono font-bold text-slate-300 whitespace-nowrap">
          {roundedHz.toFixed(1)}Hz
        </span>
      )}
    </div>
  );
};
