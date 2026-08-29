import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RTKState, RTKSolutionType, NtripConfig } from '../types';
import { soundService } from '../utils/sound';

interface RTKContextType {
  rtkState: RTKState;
  setSolution: (solution: RTKSolutionType) => void;
  toggleGPSMode: (mode: 'simulated' | 'real_gps' | 'ntrip_cors') => void;
  toggleScreenRotation: () => void;
  updatePosition: (lat: number, lon: number, alt?: number) => void;
  nudgePosition: (deltaLat: number, deltaLon: number) => void;
  setAntennaHeight: (height: number) => void;
  setHeading: (heading: number) => void;
  ntripConfig: NtripConfig;
  setNtripConfig: (config: NtripConfig) => void;
  isNtripConnected: boolean;
  connectNtrip: () => Promise<boolean>;
  disconnectNtrip: () => void;
}

const defaultNtripConfig: NtripConfig = {
  ip: 'rtk.ntrip.qxwz.com',
  port: 8001,
  mountPoint: 'RTCM32_GGB',
  user: 'surveyor_demo',
  pass: 'rtk88888',
  autoConnect: true,
  sendGgaInterval: 1,
};

const initialRTKState: RTKState = {
  isConnected: true,
  solution: 'FIXED',
  satsTracked: 32,
  satsUsed: 26,
  hrms: 0.008,
  vrms: 0.015,
  pdop: 1.15,
  hdop: 0.68,
  ageOfDiff: 1.0,
  baseDistance: 2.34,
  battery: 92,
  currentLat: 30.62402372,
  currentLon: 114.26778222,
  currentAlt: 23.45,
  heading: 182.5,
  speed: 0.0,
  pressure: 993.8,
  temperature: 26.5,
  mode: 'simulated',
  screenRotation: 0,
  antennaHeight: 2.0,
};

const RTKContext = createContext<RTKContextType | undefined>(undefined);

export const RTKProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rtkState, setRtkState] = useState<RTKState>(() => {
    const saved = localStorage.getItem('rtk_toolkit_state');
    if (saved) {
      try {
        return { ...initialRTKState, ...JSON.parse(saved) };
      } catch {
        return initialRTKState;
      }
    }
    return initialRTKState;
  });

  const [ntripConfig, setNtripConfig] = useState<NtripConfig>(() => {
    const saved = localStorage.getItem('rtk_ntrip_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultNtripConfig;
      }
    }
    return defaultNtripConfig;
  });

  const [isNtripConnected, setIsNtripConnected] = useState(true);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('rtk_toolkit_state', JSON.stringify(rtkState));
  }, [rtkState]);

  useEffect(() => {
    localStorage.setItem('rtk_ntrip_config', JSON.stringify(ntripConfig));
  }, [ntripConfig]);

  // Real Geolocation Hook when in real_gps mode
  useEffect(() => {
    if (rtkState.mode !== 'real_gps') return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRtkState((prev) => ({
          ...prev,
          currentLat: pos.coords.latitude,
          currentLon: pos.coords.longitude,
          currentAlt: pos.coords.altitude || prev.currentAlt,
          heading: pos.coords.heading !== null && !isNaN(pos.coords.heading) ? pos.coords.heading : prev.heading,
          speed: pos.coords.speed || 0,
          hrms: Math.max(0.008, (pos.coords.accuracy || 5) / 100), // Scaled for RTK
        }));
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [rtkState.mode]);

  // Device orientation / compass
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && !isNaN(e.alpha)) {
        // alpha gives rotation around z axis (0 to 360)
        let heading = 360 - e.alpha;
        if (heading < 0) heading += 360;
        if (heading >= 360) heading -= 360;
        setRtkState((prev) => ({ ...prev, heading: Math.round(heading * 10) / 10 }));
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Subtle real-time GNSS jitter & satellite drift simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setRtkState((prev) => {
        // Small realistic micro-jitter
        const jitterLat = (Math.random() - 0.5) * 0.00000004;
        const jitterLon = (Math.random() - 0.5) * 0.00000004;
        const jitterAlt = (Math.random() - 0.5) * 0.002;
        const jitterPressure = (Math.random() - 0.5) * 0.05;

        // Random sat drift
        const deltaSats = Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const newUsed = Math.min(30, Math.max(18, prev.satsUsed + deltaSats));

        return {
          ...prev,
          currentLat: prev.mode === 'simulated' ? prev.currentLat + jitterLat : prev.currentLat,
          currentLon: prev.mode === 'simulated' ? prev.currentLon + jitterLon : prev.currentLon,
          currentAlt: Math.round((prev.currentAlt + jitterAlt) * 1000) / 1000,
          pressure: Math.round((prev.pressure + jitterPressure) * 10) / 10,
          satsUsed: newUsed,
          ageOfDiff: prev.solution === 'FIXED' ? Math.round((0.8 + Math.random() * 0.4) * 10) / 10 : 3.5,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const setSolution = useCallback((solution: RTKSolutionType) => {
    soundService.playStatusAlert(solution === 'FIXED');
    setRtkState((prev) => ({
      ...prev,
      solution,
      hrms: solution === 'FIXED' ? 0.008 : solution === 'FLOAT' ? 0.045 : solution === 'SINGLE' ? 1.25 : 15.0,
      vrms: solution === 'FIXED' ? 0.015 : solution === 'FLOAT' ? 0.08 : solution === 'SINGLE' ? 2.5 : 25.0,
    }));
  }, []);

  const toggleGPSMode = useCallback((mode: 'simulated' | 'real_gps' | 'ntrip_cors') => {
    setRtkState((prev) => ({ ...prev, mode }));
  }, []);

  const toggleScreenRotation = useCallback(() => {
    soundService.playClick();
    setRtkState((prev) => ({
      ...prev,
      screenRotation: prev.screenRotation === 0 ? 180 : 0,
    }));
  }, []);

  const updatePosition = useCallback((lat: number, lon: number, alt?: number) => {
    setRtkState((prev) => ({
      ...prev,
      currentLat: lat,
      currentLon: lon,
      currentAlt: alt !== undefined ? alt : prev.currentAlt,
    }));
  }, []);

  const nudgePosition = useCallback((deltaLat: number, deltaLon: number) => {
    setRtkState((prev) => ({
      ...prev,
      currentLat: prev.currentLat + deltaLat,
      currentLon: prev.currentLon + deltaLon,
    }));
  }, []);

  const setAntennaHeight = useCallback((height: number) => {
    setRtkState((prev) => ({ ...prev, antennaHeight: height }));
  }, []);

  const setHeading = useCallback((heading: number) => {
    setRtkState((prev) => ({ ...prev, heading }));
  }, []);

  const connectNtrip = useCallback(async () => {
    setIsNtripConnected(false);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsNtripConnected(true);
    setSolution('FIXED');
    return true;
  }, [setSolution]);

  const disconnectNtrip = useCallback(() => {
    setIsNtripConnected(false);
    setSolution('SINGLE');
  }, [setSolution]);

  return (
    <RTKContext.Provider
      value={{
        rtkState,
        setSolution,
        toggleGPSMode,
        toggleScreenRotation,
        updatePosition,
        nudgePosition,
        setAntennaHeight,
        setHeading,
        ntripConfig,
        setNtripConfig,
        isNtripConnected,
        connectNtrip,
        disconnectNtrip,
      }}
    >
      {children}
    </RTKContext.Provider>
  );
};

export const useRTK = () => {
  const context = useContext(RTKContext);
  if (!context) {
    throw new Error('useRTK must be used within RTKProvider');
  }
  return context;
};
