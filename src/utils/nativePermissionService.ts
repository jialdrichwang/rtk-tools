import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem } from '@capacitor/filesystem';

export interface NativePermissionStatus {
  isNative: boolean;
  platform: 'android' | 'ios' | 'web';
  locationPermission: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';
  storagePermission?: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';
}

export const nativePermissionService = {
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  },

  getPlatform(): 'android' | 'ios' | 'web' {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
  },

  /**
   * Request native storage permissions directly through Android OS Dialogs.
   */
  async requestStoragePermission(): Promise<'granted' | 'denied' | 'unknown'> {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return 'granted';

    try {
      const res = await Filesystem.requestPermissions();
      if (res && res.publicStorage === 'granted') {
        return 'granted';
      }
      return 'denied';
    } catch (e) {
      console.warn('Filesystem requestPermissions error:', e);
      return 'unknown';
    }
  },

  /**
   * Check native storage permissions without prompting.
   */
  async checkStoragePermission(): Promise<'granted' | 'denied' | 'unknown'> {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return 'granted';

    try {
      const res = await Filesystem.checkPermissions();
      if (res && res.publicStorage === 'granted') {
        return 'granted';
      }
      return 'denied';
    } catch (e) {
      return 'unknown';
    }
  },

  /**
   * Request native system permissions directly through Android/iOS OS Dialogs.
   * This operates independently of browser security sandboxes when packaged as APK/App.
   */
  async requestLocationPermission(): Promise<NativePermissionStatus> {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';

    try {
      if (isNative) {
        // Direct Native OS Permission Request (Android ActivityCompat / iOS CLLocationManager)
        const status = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
        return {
          isNative: true,
          platform,
          locationPermission: status.location as any,
        };
      } else {
        // Fallback for Web/Browser
        if (navigator.permissions && navigator.permissions.query) {
          const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          return {
            isNative: false,
            platform: 'web',
            locationPermission: perm.state as any,
          };
        }
        return {
          isNative: false,
          platform: 'web',
          locationPermission: 'unknown',
        };
      }
    } catch (e) {
      console.warn('Native permission request caught:', e);
      return {
        isNative,
        platform,
        locationPermission: 'unknown',
      };
    }
  },

  /**
   * Request all essential permissions (Location and Storage) on startup
   */
  async requestAllPermissions(): Promise<{ locationGranted: boolean; storageGranted: boolean }> {
    const locStatus = await this.requestLocationPermission();
    const storageStatus = await this.requestStoragePermission();
    return {
      locationGranted: locStatus.locationPermission === 'granted',
      storageGranted: storageStatus === 'granted',
    };
  },

  /**
   * Check current location permission without prompting
   */
  async checkLocationPermission(): Promise<NativePermissionStatus> {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';

    try {
      if (isNative) {
        const status = await Geolocation.checkPermissions();
        return {
          isNative: true,
          platform,
          locationPermission: status.location as any,
        };
      } else {
        if (navigator.permissions && navigator.permissions.query) {
          const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          return {
            isNative: false,
            platform: 'web',
            locationPermission: perm.state as any,
          };
        }
        return {
          isNative: false,
          platform: 'web',
          locationPermission: 'unknown',
        };
      }
    } catch (e) {
      return {
        isNative,
        platform,
        locationPermission: 'unknown',
      };
    }
  },

  /**
   * Directly get current position using Native Geolocation Plugin
   */
  async getNativeCurrentPosition(options?: { enableHighAccuracy?: boolean; timeout?: number }) {
    if (Capacitor.isNativePlatform()) {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 10000,
        maximumAge: 1000,
      });
    } else {
      return new Promise<any>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: 1000,
        });
      });
    }
  },
};
