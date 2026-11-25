import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

function addDirRecursive(zip: JSZip, fsDir: string, zipPrefix: string, exclude: Set<string>): void {
  if (!fs.existsSync(fsDir)) return;
  const entries = fs.readdirSync(fsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;
    const fullPath = path.join(fsDir, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirRecursive(zip, fullPath, zipPath, exclude);
    } else if (entry.isFile()) {
      const data = fs.readFileSync(fullPath);
      zip.file(zipPath, data);
    }
  }
}

export async function generateAndroidCapacitorZip(
  projectRoot: string,
  defaultLanServerUrl: string,
): Promise<Buffer> {
  const zip = new JSZip();

  // 1. Include compiled dist/ if present, AND include full web source so user can rebuild or sync anytime
  const distDir = path.join(projectRoot, 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

  const pkgJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const androidPackageJson = {
    name: 'apex-gp-lan-motogp-android',
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx server.ts',
      build: 'vite build',
      'cap:sync': 'npx cap sync android',
      'apk:debug': 'npm run build && npx cap sync android && cd android && ./gradlew assembleDebug',
    },
    dependencies: {
      ...pkgJson.dependencies,
      '@capacitor/core': '^6.2.0',
      '@capacitor/android': '^6.2.0',
    },
    devDependencies: {
      ...pkgJson.devDependencies,
      '@capacitor/cli': '^6.2.0',
    },
  };
  zip.file('package.json', JSON.stringify(androidPackageJson, null, 2));

  // Copy source files for full reproducibility
  addDirRecursive(zip, path.join(projectRoot, 'src'), 'src', new Set(['node_modules']));
  addDirRecursive(zip, path.join(projectRoot, 'public'), 'public', new Set());
  addDirRecursive(zip, path.join(projectRoot, 'server'), 'server', new Set());
  for (const rootFile of ['index.html', 'tsconfig.json', 'vite.config.ts', 'server.ts', 'metadata.json']) {
    const p = path.join(projectRoot, rootFile);
    if (fs.existsSync(p)) {
      zip.file(rootFile, fs.readFileSync(p));
    }
  }

  // Copy compiled web bundle directly into Android assets if dist/ exists
  if (hasDist) {
    addDirRecursive(zip, distDir, 'dist', new Set());
    addDirRecursive(zip, distDir, 'android/app/src/main/assets/public', new Set());
  }

  // 2. Capacitor Config (allows cleartext ws:// LAN connections + embeds default LAN server hint)
  const capacitorConfig = `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apexgp.lanmotogp',
  appName: 'APEX GP LAN MotoGP',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0b0f17',
  },
};

export default config;
`;
  zip.file('capacitor.config.ts', capacitorConfig);
  zip.file(
    'android/app/src/main/assets/capacitor.config.json',
    JSON.stringify(
      {
        appId: 'com.apexgp.lanmotogp',
        appName: 'APEX GP LAN MotoGP',
        webDir: 'dist',
        server: {
          androidScheme: 'http',
          cleartext: true,
        },
        android: {
          allowMixedContent: true,
          backgroundColor: '#0b0f17',
        },
      },
      null,
      2,
    ),
  );

  // 3. Complete Android Studio / Gradle Project Scaffold
  zip.file(
    'android/settings.gradle',
    `include ':app'
project(':app').projectDir = new File('app')
`,
  );

  zip.file(
    'android/build.gradle',
    `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.5.2'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`,
  );

  zip.file(
    'android/gradle.properties',
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
`,
  );

  zip.file(
    'android/app/build.gradle',
    `apply plugin: 'com.android.application'

android {
    namespace "com.apexgp.lanmotogp"
    compileSdk 34

    defaultConfig {
        applicationId "com.apexgp.lanmotogp"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.webkit:webkit:1.11.0'
    implementation 'androidx.core:core:1.13.1'
}
`,
  );

  zip.file(
    'android/app/src/main/AndroidManifest.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <uses-feature android:glEsVersion="0x00020000" android:required="true" />

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="sensorLandscape"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
  );

  // Self-contained hardware-accelerated WebView Activity that loads the bundled assets
  // via WebViewAssetLoader so ES modules, WebGL2, and ws:// LAN WebSockets work out of the box
  // even without running npx cap sync!
  zip.file(
    'android/app/src/main/java/com/apexgp/lanmotogp/MainActivity.java',
    `package com.apexgp.lanmotogp;

import android.annotation.SuppressLint;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUI();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("appassets.androidplatform.net".equals(url.getHost())) {
                    String path = url.getPath();
                    if (path == null || path.equals("/")) {
                        return assetLoader.shouldInterceptRequest(Uri.parse("https://appassets.androidplatform.net/public/index.html"));
                    }
                    return assetLoader.shouldInterceptRequest(Uri.parse("https://appassets.androidplatform.net/public" + path));
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        String defaultLan = ${JSON.stringify(defaultLanServerUrl)};
        webView.evaluateJavascript(
            "if (!localStorage.getItem('apexgp_lan_url') && " + ${JSON.stringify(defaultLanServerUrl ? 'true' : 'false')} + ") { localStorage.setItem('apexgp_lan_url', " + ${JSON.stringify(defaultLanServerUrl)} + "); }",
            null
        );
        webView.loadUrl("https://appassets.androidplatform.net/public/index.html");
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }
}
`,
  );

  zip.file(
    'android/app/src/main/res/values/strings.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">APEX GP LAN MotoGP</string>
</resources>
`,
  );

  zip.file(
    'android/app/src/main/res/values/styles.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>
`,
  );

  // 4. One-command build script & GitHub Actions APK CI workflow
  zip.file(
    'build-apk.sh',
    `#!/usr/bin/env bash
set -euo pipefail
echo "[1/3] Installing npm dependencies & building production WebGL bundle..."
npm install
npm run build
mkdir -p android/app/src/main/assets/public
cp -r dist/* android/app/src/main/assets/public/

echo "[2/3] Building Android Debug APK via Gradle..."
cd android
gradle assembleDebug

echo "[3/3] APK ready at: android/app/build/outputs/apk/debug/app-debug.apk"
`,
  );

  zip.file(
    '.github/workflows/build-apk.yml',
    `name: Build Android APK
on:
  workflow_dispatch:
  push:
    branches: [ main ]

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Build Web Bundle
        run: |
          npm install
          npm run build
          mkdir -p android/app/src/main/assets/public
          cp -r dist/* android/app/src/main/assets/public/
      - name: Setup Gradle & Build APK
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'
      - name: Assemble Debug APK
        working-directory: android
        run: gradle assembleDebug
      - name: Upload Downloadable APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: apex-gp-lan-motogp-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
`,
  );

  zip.file(
    'BUILD_APK.md',
    `# APEX GP // LAN MotoGP — Android APK Build Guide

This bundle contains a complete, landscape-locked, WebGL2 + LAN WebSocket Android project.

## Option A: Build APK Locally with Android Studio
1. Open the \`android/\` folder in **Android Studio**.
2. Wait for Gradle sync to finish.
3. Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
4. Install \`android/app/build/outputs/apk/debug/app-debug.apk\` onto your Android phone.

## Option B: Build APK via Command Line
\`\`\`bash
npm install
npm run build
cp -r dist/* android/app/src/main/assets/public/
cd android && gradle assembleDebug
\`\`\`

## Option C: Cloud APK Build (No Local Android Studio Needed)
Push this folder to a GitHub repo — \`.github/workflows/build-apk.yml\` automatically builds and attaches \`apex-gp-lan-motogp-apk\` (\`app-debug.apk\`) for download under **Actions**.

## Playing LAN Multiplayer on Android
1. Start the game server on your PC on the same Wi-Fi network: \`npm install && npm run dev\`
2. Note the PC's LAN IPv4 address (shown in the LAN Multiplayer modal, e.g. \`${defaultLanServerUrl || 'ws://192.168.1.50:3000/ws'}\`).
3. On your Android phone, open **LAN Multiplayer**, enter the PC's LAN Server URL if needed, and join the Room Code!
`,
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buf;
}
