package com.rtk.surveyapp;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int MANAGE_STORAGE_REQUEST_CODE = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Immediately request all Native Android GNSS, Sensors & Storage Permissions on App Startup
        checkAndRequestNativePermissions();

        // 2. Ensure /storage/emulated/0/com.rtkproject.files directory structure exists
        createAppStorageDirectories();

        // 3. Configure WebSettings without overriding Capacitor's BridgeWebChromeClient (preserves onShowFileChooser)
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebSettings settings = this.bridge.getWebView().getSettings();
                settings.setGeolocationEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setJavaScriptEnabled(true);
                try {
                    settings.setGeolocationDatabasePath(getFilesDir().getPath());
                } catch (Exception ignored) {}

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                }

                // 4. Expose AndroidBridge for complete exit & native Bluetooth querying
                this.bridge.getWebView().addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void exitApp() {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    finishAffinity(); // 彻底关闭所有界面
                                    // 延迟 100ms 销毁进程，确保 finish 指令已触达系统
                                    new android.os.Handler().postDelayed(new Runnable() {
                                        @Override
                                        public void run() {
                                            System.exit(0); // 彻底杀死进程
                                        }
                                    }, 100);
                                } catch (Exception e) {
                                    System.exit(0);
                                }
                            }
                        });
                    }

                    @JavascriptInterface
                    public String getBondedBluetoothDevices() {
                        try {
                            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                            if (adapter != null && adapter.isEnabled()) {
                                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                                JSONArray arr = new JSONArray();
                                if (bonded != null) {
                                    for (BluetoothDevice dev : bonded) {
                                        JSONObject obj = new JSONObject();
                                        obj.put("name", dev.getName() != null ? dev.getName() : "未知RTK设备");
                                        obj.put("mac", dev.getAddress());
                                        obj.put("type", "RTK");
                                        obj.put("paired", true);
                                        arr.put(obj);
                                    }
                                }
                                return arr.toString();
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                        return "[]";
                    }

                    @JavascriptInterface
                    public boolean isBluetoothEnabled() {
                        try {
                            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                            return adapter != null && adapter.isEnabled();
                        } catch (Exception e) {
                            return false;
                        }
                    }
                }, "AndroidBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        createAppStorageDirectories();
    }

    /**
     * Create the mandatory persistence directory tree under /storage/emulated/0/com.rtkproject.files:
     * - point/
     * - track/
     * - project/
     * - mapdata/
     */
    private void createAppStorageDirectories() {
        try {
            File externalRoot = Environment.getExternalStorageDirectory();
            if (externalRoot != null && externalRoot.canWrite()) {
                File appRoot = new File(externalRoot, "com.rtkproject.files");
                if (!appRoot.exists()) {
                    appRoot.mkdirs();
                }

                String[] subFolders = new String[]{"point", "track", "project", "mapdata", "mapdata/mapcache", "points", "tracks"};
                for (String folder : subFolders) {
                    File sub = new File(appRoot, folder);
                    if (!sub.exists()) {
                        sub.mkdirs();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Check and trigger Android System Native Dialog for Storage, Location & Sensors
     */
    private void checkAndRequestNativePermissions() {
        List<String> permissionsNeeded = new ArrayList<>();

        // High Precision Location
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        // Storage Permissions (READ & WRITE)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        // Android 13+ (API 33+) Media Permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
        }

        // Bluetooth Permissions for Android 12+ (API 31+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.BLUETOOTH_SCAN);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
        }

        // If any standard runtime permission is not yet granted, trigger Android Native OS Dialog immediately
        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsNeeded.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }

        // Android 11+ (API 30+) MANAGE_EXTERNAL_STORAGE check for direct access to /storage/emulated/0/com.rtkproject.files
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, MANAGE_STORAGE_REQUEST_CODE);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        startActivityForResult(intent, MANAGE_STORAGE_REQUEST_CODE);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            createAppStorageDirectories();
        }
    }
}
