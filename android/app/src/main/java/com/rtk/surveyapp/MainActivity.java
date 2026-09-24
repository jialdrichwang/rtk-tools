package com.rtk.surveyapp;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Process;
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

public class MainActivity extends BridgeActivity implements SensorEventListener {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int MANAGE_STORAGE_REQUEST_CODE = 1002;

    // High performance 9-axis sensor subsystem
    private SensorManager sensorManager;
    private Sensor accelerometerSensor;
    private Sensor magnetometerSensor;
    private Sensor gyroscopeSensor;
    private Sensor rotationVectorSensor;
    private HandlerThread sensorThread;
    private Handler sensorHandler;

    // Volatile sensor raw data buffers
    private final float[] latestAcc = new float[3];
    private final float[] latestGyro = new float[3];
    private final float[] latestMag = new float[3];
    private final float[] rotationMatrix = new float[9];
    private final float[] orientationAngles = new float[3];
    private volatile boolean hasAcc = false;
    private volatile boolean hasGyro = false;
    private volatile boolean hasMag = false;
    private volatile int sensorAccuracy = SensorManager.SENSOR_STATUS_ACCURACY_HIGH;

    // Native Madgwick AHRS state (Quaternion q0, q1, q2, q3)
    private float q0 = 1.0f, q1 = 0.0f, q2 = 0.0f, q3 = 0.0f;
    private float madgwickBeta = 0.12f;
    private long lastSensorTimestampNs = 0;
    private volatile float nativeComputedYaw = 0.0f;
    private volatile float nativePitch = 0.0f;
    private volatile float nativeRoll = 0.0f;
    private volatile float nativeFieldStrength = 48.0f;
    private volatile boolean isMagneticAnomaly = false;
    private volatile float sampleRateHz = 50.0f;
    private int sampleCount = 0;
    private long lastRateSampleTime = 0;

    // Calibration offsets
    private float hardIronOx = 0.0f, hardIronOy = 0.0f, hardIronOz = 0.0f;
    private float softIronSx = 1.0f, softIronSy = 1.0f, softIronSz = 1.0f;
    private float physicalCompassOffset = 0.0f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Immediately request all Native Android GNSS, Sensors & Storage Permissions on App Startup
        checkAndRequestNativePermissions();

        // 2. Ensure /storage/emulated/0/com.rtkproject.files directory structure exists
        createAppStorageDirectories();

        // 3. Initialize high-performance 9-axis sensor subsystem with dedicated URGENT_DISPLAY thread
        initSensorSubsystem();

        // 4. Configure WebSettings without overriding Capacitor's BridgeWebChromeClient (preserves onShowFileChooser)
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

                    @JavascriptInterface
                    public boolean ensureAppDirectories(String projectName) {
                        try {
                            createAppStorageDirectories(projectName != null && !projectName.trim().isEmpty() ? projectName.trim() : "project 1");
                            return true;
                        } catch (Exception e) {
                            e.printStackTrace();
                            return false;
                        }
                    }

                    // ====== High Performance 9-Axis Native Compass API ======
                    @JavascriptInterface
                    public String getNativeCompassStatus() {
                        try {
                            JSONObject obj = new JSONObject();
                            obj.put("yaw", (double) Math.round(nativeComputedYaw * 10.0f) / 10.0);
                            obj.put("pitch", (double) Math.round(nativePitch * 10.0f) / 10.0);
                            obj.put("roll", (double) Math.round(nativeRoll * 10.0f) / 10.0);
                            obj.put("fieldStrength", (double) Math.round(nativeFieldStrength * 10.0f) / 10.0);
                            obj.put("isAnomaly", isMagneticAnomaly);
                            obj.put("sampleRate", (double) Math.round(sampleRateHz * 10.0f) / 10.0);
                            obj.put("accuracy", sensorAccuracy);
                            obj.put("hasGyro", hasGyro);
                            obj.put("hasAcc", hasAcc);
                            obj.put("hasMag", hasMag);
                            // Raw buffers for JS Madgwick/Kalman verification
                            obj.put("ax", (double) latestAcc[0]);
                            obj.put("ay", (double) latestAcc[1]);
                            obj.put("az", (double) latestAcc[2]);
                            obj.put("gx", (double) latestGyro[0]);
                            obj.put("gy", (double) latestGyro[1]);
                            obj.put("gz", (double) latestGyro[2]);
                            obj.put("mx", (double) latestMag[0]);
                            obj.put("my", (double) latestMag[1]);
                            obj.put("mz", (double) latestMag[2]);
                            return obj.toString();
                        } catch (Exception e) {
                            return "{}";
                        }
                    }

                    @JavascriptInterface
                    public void setCalibrationParameters(float ox, float oy, float oz, float sx, float sy, float sz, float physicalOffset) {
                        hardIronOx = ox;
                        hardIronOy = oy;
                        hardIronOz = oz;
                        softIronSx = sx != 0 ? sx : 1.0f;
                        softIronSy = sy != 0 ? sy : 1.0f;
                        softIronSz = sz != 0 ? sz : 1.0f;
                        physicalCompassOffset = physicalOffset;
                    }

                    @JavascriptInterface
                    public float getGeomagneticDeclination(float lat, float lon, float alt) {
                        try {
                            long timeMillis = System.currentTimeMillis();
                            GeomagneticField geoField = new GeomagneticField(lat, lon, alt, timeMillis);
                            return geoField.getDeclination();
                        } catch (Exception e) {
                            return 0.0f;
                        }
                    }

                    @JavascriptInterface
                    public void setSensorSamplingSpeed(int speedMode) {
                        // 0: FASTEST (2500us ~ 400Hz), 1: GAME (20ms ~ 50Hz), 2: UI (60ms ~ 16Hz)
                        restartSensorListeners(speedMode);
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
        createAppStorageDirectories("project 1");
        registerSensorListeners(SensorManager.SENSOR_DELAY_FASTEST);
    }

    @Override
    public void onPause() {
        super.onPause();
        unregisterSensorListeners();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sensorThread != null) {
            sensorThread.quitSafely();
            sensorThread = null;
        }
    }

    /**
     * Initialize high-speed sensor hardware with a dedicated background thread running
     * at THREAD_PRIORITY_URGENT_DISPLAY priority.
     */
    private void initSensorSubsystem() {
        try {
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                magnetometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
                gyroscopeSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
                rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);

                // Start dedicated background sensor event thread
                sensorThread = new HandlerThread("SensorFusionWorker", Process.THREAD_PRIORITY_URGENT_DISPLAY);
                sensorThread.start();
                sensorHandler = new Handler(sensorThread.getLooper());

                registerSensorListeners(SensorManager.SENSOR_DELAY_FASTEST);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private synchronized void registerSensorListeners(int delayMode) {
        if (sensorManager == null || sensorHandler == null) return;
        unregisterSensorListeners();

        try {
            // Gyroscope is critical for high-speed dynamic tracking (up to 200-400Hz)
            if (gyroscopeSensor != null) {
                // Request 2500 microseconds (400Hz) sampling if hardware supports
                boolean registered = sensorManager.registerListener(this, gyroscopeSensor, 2500, sensorHandler);
                if (!registered) {
                    sensorManager.registerListener(this, gyroscopeSensor, delayMode, sensorHandler);
                }
            }
            if (accelerometerSensor != null) {
                sensorManager.registerListener(this, accelerometerSensor, delayMode, sensorHandler);
            }
            if (magnetometerSensor != null) {
                sensorManager.registerListener(this, magnetometerSensor, delayMode, sensorHandler);
            }
            if (rotationVectorSensor != null) {
                sensorManager.registerListener(this, rotationVectorSensor, delayMode, sensorHandler);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private synchronized void unregisterSensorListeners() {
        if (sensorManager != null) {
            try {
                sensorManager.unregisterListener(this);
            } catch (Exception ignored) {}
        }
    }

    private void restartSensorListeners(int speedMode) {
        int delay = SensorManager.SENSOR_DELAY_FASTEST;
        if (speedMode == 1) delay = SensorManager.SENSOR_DELAY_GAME;
        else if (speedMode == 2) delay = SensorManager.SENSOR_DELAY_UI;
        registerSensorListeners(delay);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            sensorAccuracy = accuracy;
        }
    }

    /**
     * Native Real-time 9-Axis Sensor Fusion & Madgwick AHRS Loop
     */
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.values == null) return;

        final long nowNs = event.timestamp > 0 ? event.timestamp : System.nanoTime();
        final int sensorType = event.sensor.getType();

        if (sensorType == Sensor.TYPE_ACCELEROMETER) {
            latestAcc[0] = event.values[0];
            latestAcc[1] = event.values[1];
            latestAcc[2] = event.values[2];
            hasAcc = true;
        } else if (sensorType == Sensor.TYPE_GYROSCOPE) {
            latestGyro[0] = event.values[0];
            latestGyro[1] = event.values[1];
            latestGyro[2] = event.values[2];
            hasGyro = true;
        } else if (sensorType == Sensor.TYPE_MAGNETIC_FIELD) {
            latestMag[0] = event.values[0];
            latestMag[1] = event.values[1];
            latestMag[2] = event.values[2];
            hasMag = true;
        } else if (sensorType == Sensor.TYPE_ROTATION_VECTOR) {
            // Backup orientation matrix
            try {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
                SensorManager.getOrientation(rotationMatrix, orientationAngles);
            } catch (Exception ignored) {}
        }

        // Sampling rate tracking
        sampleCount++;
        long currentTimeMs = System.currentTimeMillis();
        if (currentTimeMs - lastRateSampleTime >= 1000) {
            sampleRateHz = (float) (sampleCount * 1000.0 / Math.max(1, currentTimeMs - lastRateSampleTime));
            sampleCount = 0;
            lastRateSampleTime = currentTimeMs;
        }

        // Only compute when we have valid sensor measurements
        if (!hasAcc || !hasMag) return;

        float dt = lastSensorTimestampNs > 0 ? (float) ((nowNs - lastSensorTimestampNs) * 1.0e-9) : 0.02f;
        if (dt <= 0.0f || dt > 0.5f) dt = 0.02f;
        lastSensorTimestampNs = nowNs;

        // Apply Hard-iron & Soft-iron calibration
        float mx = (latestMag[0] - hardIronOx) * softIronSx;
        float my = (latestMag[1] - hardIronOy) * softIronSy;
        float mz = (latestMag[2] - hardIronOz) * softIronSz;

        // Magnetic field strength & anomaly check
        float fieldStrength = (float) Math.sqrt(mx * mx + my * my + mz * mz);
        nativeFieldStrength = fieldStrength;
        float expectedField = 48.0f;
        float deviation = Math.abs(fieldStrength - expectedField) / expectedField;
        isMagneticAnomaly = deviation > 0.35f || fieldStrength < 18.0f || fieldStrength > 95.0f;

        float ax = latestAcc[0];
        float ay = latestAcc[1];
        float az = latestAcc[2];

        float gx = latestGyro[0];
        float gy = latestGyro[1];
        float gz = latestGyro[2];

        // If anomaly or no gyro, fallback or pure gyro integration
        if (isMagneticAnomaly && hasGyro) {
            // Pure gyro quaternion integration (freeze magnetometer correction during anomaly)
            float qDot1 = 0.5f * (-q1 * gx - q2 * gy - q3 * gz);
            float qDot2 = 0.5f * ( q0 * gx + q2 * gz - q3 * gy);
            float qDot3 = 0.5f * ( q0 * gy - q1 * gz + q3 * gx);
            float qDot4 = 0.5f * ( q0 * gz + q1 * gy - q2 * gx);
            q0 += qDot1 * dt;
            q1 += qDot2 * dt;
            q2 += qDot3 * dt;
            q3 += qDot4 * dt;
            float norm = (float) Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
            if (norm > 0) {
                q0 /= norm; q1 /= norm; q2 /= norm; q3 /= norm;
            }
        } else {
            // Native Madgwick 9-Axis AHRS Fusion Algorithm
            float norm;
            float hx, hy, _2bx, _2bz, _4bx, _4bz;
            float _2q0mx, _2q0my, _2q0mz, _2q1mx, _2q2mx, _2q3mx;
            float s0, s1, s2, s3;
            float qDot1, qDot2, qDot3, qDot4;

            norm = (float) Math.sqrt(mx * mx + my * my + mz * mz);
            if (norm == 0.0f) return;
            mx /= norm; my /= norm; mz /= norm;

            norm = (float) Math.sqrt(ax * ax + ay * ay + az * az);
            if (norm == 0.0f) return;
            ax /= norm; ay /= norm; az /= norm;

            _2q0mx = 2.0f * q0 * mx; _2q0my = 2.0f * q0 * my; _2q0mz = 2.0f * q0 * mz;
            _2q1mx = 2.0f * q1 * mx; _2q2mx = 2.0f * q2 * mx; _2q3mx = 2.0f * q3 * mx;

            hx = mx * q0 * q0 - 2.0f * q0 * my * q3 + 2.0f * q0 * mz * q2 +
                 mx * q1 * q1 + 2.0f * q1 * my * q2 + 2.0f * q1 * mz * q3 -
                 mx * q2 * q2 - mx * q3 * q3;
            hy = 2.0f * q0 * mx * q3 + my * q0 * q0 - 2.0f * q0 * mz * q1 +
                 2.0f * q1 * mx * q2 - my * q1 * q1 + my * q2 * q2 +
                 2.0f * q2 * mz * q3 - my * q3 * q3;

            _2bx = (float) Math.sqrt(hx * hx + hy * hy);
            _2bz = -_2q0mx * q2 + _2q0my * q1 + mz * q0 * q0 +
                   _2q1mx * q3 - mz * q1 * q1 + 2.0f * q1 * q2 * my -
                   mz * q2 * q2 + mz * q3 * q3;
            _4bx = 2.0f * _2bx;
            _4bz = 2.0f * _2bz;

            // Gradient descent algorithm
            s0 = -_2bz * q2 * (2.0f * q1 * q3 - 2.0f * q0 * q2 - ax) +
                  _2bx * q3 * (2.0f * q1 * q2 + 2.0f * q0 * q3 - ay) +
                 (-_2bx * q2 + _2bz * q1) * (2.0f * q0 * q1 + 2.0f * q2 * q3 - az);
            s1 = _2bz * q3 * (2.0f * q1 * q3 - 2.0f * q0 * q2 - ax) +
                 _2bx * q2 * (2.0f * q1 * q2 + 2.0f * q0 * q3 - ay) +
                 (_2bx * q1 + _2bz * q0) * (2.0f * q0 * q1 + 2.0f * q2 * q3 - az);
            s2 = -2.0f * _2bz * q0 * (2.0f * q1 * q3 - 2.0f * q0 * q2 - ax) +
                 (_2bx * q3 - 4.0f * q2 * _2bx) * (2.0f * q1 * q2 + 2.0f * q0 * q3 - ay) +
                 (_2bx * q0 - 4.0f * q2 * _2bz) * (2.0f * q0 * q1 + 2.0f * q2 * q3 - az);
            s3 = 2.0f * _2bz * q1 * (2.0f * q1 * q3 - 2.0f * q0 * q2 - ax) +
                 (_2bx * q2 + 4.0f * q3 * _2bx) * (2.0f * q1 * q2 + 2.0f * q0 * q3 - ay) +
                 (_2bx * q1 + _2bz * q0) * (2.0f * q0 * q1 + 2.0f * q2 * q3 - az);

            norm = (float) Math.sqrt(s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3);
            if (norm > 0.0f) {
                s0 /= norm; s1 /= norm; s2 /= norm; s3 /= norm;
            }

            qDot1 = 0.5f * (-q1 * gx - q2 * gy - q3 * gz) - madgwickBeta * s0;
            qDot2 = 0.5f * ( q0 * gx + q2 * gz - q3 * gy) - madgwickBeta * s1;
            qDot3 = 0.5f * ( q0 * gy - q1 * gz + q3 * gx) - madgwickBeta * s2;
            qDot4 = 0.5f * ( q0 * gz + q1 * gy - q2 * gx) - madgwickBeta * s3;

            q0 += qDot1 * dt;
            q1 += qDot2 * dt;
            q2 += qDot3 * dt;
            q3 += qDot4 * dt;

            norm = (float) Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
            if (norm > 0.0f) {
                q0 /= norm; q1 /= norm; q2 /= norm; q3 /= norm;
            }
        }

        // Extract Euler yaw, pitch, roll
        float siny_cosp = 2.0f * (q0 * q3 + q1 * q2);
        float cosy_cosp = 1.0f - 2.0f * (q2 * q2 + q3 * q3);
        float yawRad = (float) Math.atan2(siny_cosp, cosy_cosp);
        float yawDeg = (float) (yawRad * 180.0 / Math.PI);
        if (yawDeg < 0) yawDeg += 360.0f;

        // Apply physical offset
        yawDeg = (yawDeg + physicalCompassOffset + 360.0f) % 360.0f;
        nativeComputedYaw = yawDeg;

        // Roll & Pitch
        float sinr_cosp = 2.0f * (q0 * q1 + q2 * q3);
        float cosr_cosp = 1.0f - 2.0f * (q1 * q1 + q2 * q2);
        nativeRoll = (float) (Math.atan2(sinr_cosp, cosr_cosp) * 180.0 / Math.PI);

        float sinp = 2.0f * (q0 * q2 - q3 * q1);
        if (Math.abs(sinp) >= 1.0f) {
            nativePitch = Math.copySign(90.0f, sinp);
        } else {
            nativePitch = (float) (Math.asin(sinp) * 180.0 / Math.PI);
        }
    }

    /**
     * Create the mandatory persistence directory tree under /storage/emulated/0/com.rtkproject.files:
     * - magnetometer calibration data/
     * - mapdata/
     * - project/
     *     └── <projectName>/ (e.g. project 1)
     *           ├── points/
     *           ├── tracks/
     *           └── Engineering Surveying/
     *                 ├── project point collection/
     *                 ├── Detail Surveying/
     *                 ├── Point layout results/
     *                 ├── Isometric setting-out results/
     *                 ├── Linear setting-out results/
     *                 ├── area measurement/
     *                 ├── distance measurement/
     *                 └── slope measurement/
     */
    private void createAppStorageDirectories() {
        createAppStorageDirectories("project 1");
    }

    private void createAppStorageDirectories(String projectName) {
        try {
            File externalRoot = Environment.getExternalStorageDirectory();
            if (externalRoot != null && externalRoot.canWrite()) {
                File appRoot = new File(externalRoot, "com.rtkproject.files");
                if (!appRoot.exists()) {
                    appRoot.mkdirs();
                }

                // 1. Ensure top-level folders
                String[] topFolders = new String[]{
                    "magnetometer calibration data",
                    "mapdata",
                    "mapdata/mapcache",
                    "project",
                    "point",
                    "track",
                    "points",
                    "tracks"
                };
                for (String folder : topFolders) {
                    File sub = new File(appRoot, folder);
                    if (!sub.exists()) {
                        sub.mkdirs();
                    }
                }

                // 2. Ensure project folder and all sub-folders (especially for Android 7.0)
                String targetProj = (projectName != null && !projectName.trim().isEmpty()) ? projectName.trim() : "project 1";
                String[] projSubDirs = new String[]{
                    "project/" + targetProj,
                    "project/" + targetProj + "/points",
                    "project/" + targetProj + "/tracks",
                    "project/" + targetProj + "/Engineering Surveying",
                    "project/" + targetProj + "/Engineering Surveying/project point collection",
                    "project/" + targetProj + "/Engineering Surveying/Detail Surveying",
                    "project/" + targetProj + "/Engineering Surveying/Point layout results",
                    "project/" + targetProj + "/Engineering Surveying/Isometric setting-out results",
                    "project/" + targetProj + "/Engineering Surveying/Linear setting-out results",
                    "project/" + targetProj + "/Engineering Surveying/area measurement",
                    "project/" + targetProj + "/Engineering Surveying/distance measurement",
                    "project/" + targetProj + "/Engineering Surveying/slope measurement",
                    // Also create legacy/alias capitalized result subdirs for broad compatibility
                    "project/" + targetProj + "/Engineering Surveying/Area measurement result",
                    "project/" + targetProj + "/Engineering Surveying/Length measurement result",
                    "project/" + targetProj + "/Engineering Surveying/Slope measurement results"
                };

                for (String dirPath : projSubDirs) {
                    File dir = new File(appRoot, dirPath);
                    if (!dir.exists()) {
                        dir.mkdirs();
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
