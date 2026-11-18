import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>Cài app Android</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          <span>Cài đặt iOS</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 id="ios-install-title" className="font-display text-lg font-semibold text-slate-900">
                Cài đặt trên màn hình chính
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                1. Nhấn nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ Safari.
                <br />
                2. Cuộn xuống và chọn <strong>Thêm vào Màn hình chính</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-4 min-h-[44px] w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-medium text-white shadow-lg md:bottom-4 md:left-4 md:right-auto"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Đang ngoại tuyến — Vẫn có thể chỉnh sửa và xuất file data.zip đã phân tích</span>
    </div>
  );
};
