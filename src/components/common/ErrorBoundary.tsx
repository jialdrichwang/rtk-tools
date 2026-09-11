import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      // Clear potentially corrupted RTK state caches
      localStorage.removeItem('rtk_toolkit_state');
      localStorage.removeItem('rtk_current_screen');
      localStorage.removeItem('rtk_active_recording');
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  private handleRecover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || '未知系统运行时异常';

      return (
        <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans select-none">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {this.props.fallbackTitle || 'RTK 系统运行保护已激活'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  已拦截潜在的白屏异常，保障测量数据安全
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5 font-mono text-[11px]">
              <div className="text-slate-400 flex items-center justify-between">
                <span>异常代码信息:</span>
                <span className="text-[10px] text-rose-400">Crash Prevented</span>
              </div>
              <div className="text-rose-300 break-all max-h-24 overflow-y-auto leading-relaxed">
                {errorMessage}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={this.handleRecover}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>尝试立即恢复运行</span>
              </button>

              <button
                onClick={this.handleResetCache}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-[0.99] text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>重置临时状态缓存并刷新</span>
              </button>
            </div>

            <div className="text-[11px] text-center text-slate-400 leading-normal pt-2 border-t border-slate-700/60">
              提示：您的工程项目与实测点位库存储在持久化数据库中，不会丢失。
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
