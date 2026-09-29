import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import 'leaflet/dist/leaflet.css';
import './index.css';

// 确保在 Android WebView 或任意外部脚本执行环境中，全局 isGpsMode 均有定义，防止 ReferenceError
if (typeof window !== 'undefined') {
  (window as any).isGpsMode = false;
  (window as any).headingMode = 'mag_lock';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="RTK 测量系统保护层">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
