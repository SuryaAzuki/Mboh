import React, { useEffect, useState } from 'react';

interface AndroidApkModalProps {
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ onClose }) => {
  const [lanUrl, setLanUrl] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/lan-info')
      .then((r) => r.json())
      .then((data: { interfaces?: Array<{ wsUrl: string }> }) => {
        if (data.interfaces && data.interfaces[0]) {
          setLanUrl(data.interfaces[0].wsUrl);
        }
      })
      .catch(() => {});
  }, []);

  const downloadHref = `/api/android-bundle.zip${lanUrl ? `?lanUrl=${encodeURIComponent(lanUrl)}` : ''}`;

  const handleDownload = () => {
    setDownloading(true);
    window.setTimeout(() => setDownloading(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Android APK Export"
    >
      <div className="w-full max-w-xl bg-[#0d131f] border border-slate-700 rounded-xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-wide text-white">
              Android APK Export
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Downloadable Android Studio / Gradle APK Project + Landscape WebGL2 Wrapper
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Android Export"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs leading-relaxed">
            <strong className="text-amber-300">Note on APK Compilation:</strong> This cloud runtime does
            not include the Android SDK/Gradle toolchain to compile a signed binary <code className="text-slate-100">.apk</code>{' '}
            in-container. Downloading below gives you the complete, pre-configured Android project
            (<code className="text-slate-100">MainActivity.java</code>,{' '}
            <code className="text-slate-100">AndroidManifest.xml</code> with cleartext LAN WebSocket &amp; sensorLandscape,{' '}
            <code className="text-slate-100">build.gradle</code>, compiled web bundle, and a GitHub Actions{' '}
            <code className="text-slate-100">build-apk.yml</code> workflow) ready to output{' '}
            <code className="text-emerald-300">app-debug.apk</code> in one command.
          </div>

          <div>
            <label htmlFor="apk-lan-url" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Default Host LAN WebSocket URL (Optional)
            </label>
            <input
              id="apk-lan-url"
              type="text"
              value={lanUrl}
              onChange={(e) => setLanUrl(e.target.value)}
              placeholder="ws://192.168.1.50:3000/ws"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
            />
          </div>

          <a
            href={downloadHref}
            download="ApexGP-LAN-MotoGP-Android-APK-Project.zip"
            onClick={handleDownload}
            className="block w-full text-center py-3.5 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-sm shadow-lg transition-colors"
          >
            {downloading ? 'Preparing Android ZIP...' : 'Download Android APK Project (.zip)'}
          </a>

          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 text-xs space-y-1.5">
            <div className="font-bold text-slate-200 uppercase tracking-wider">
              Build Installable .APK in 1 Step
            </div>
            <p className="text-slate-400">
              1. Open <code className="text-slate-200">android/</code> in Android Studio &rarr;{' '}
              <strong>Build &rarr; Build APK(s)</strong>, or run <code className="text-slate-200">./build-apk.sh</code>.
            </p>
            <p className="text-slate-400">
              2. Or push the extracted folder to GitHub to download <code className="text-emerald-300">app-debug.apk</code>{' '}
              directly from <strong>Actions &rarr; Artifacts</strong> without installing Android Studio.
            </p>
            <p className="text-slate-400">
              3. Or on Android Chrome over LAN, tap <strong>Menu &rarr; Add to Home Screen</strong> to install immediately as a fullscreen landscape Web App.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
