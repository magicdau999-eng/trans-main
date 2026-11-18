import React from 'react';
import { Download } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type AppTab = 'setup' | 'translate' | 'guide';

interface HeaderBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onLoadSample: () => void;
  canExport: boolean;
  onExportZip: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  onSelectTab,
  onLoadSample,
  canExport,
  onExportZip,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('setup');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          RPGM Lingua
        </a>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Điều hướng chính">
          <button
            type="button"
            onClick={() => onSelectTab('setup')}
            className={`min-h-[40px] border-b-2 px-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab !== 'guide'
                ? 'border-teal-700 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Không gian dịch
          </button>
          <button
            type="button"
            onClick={onLoadSample}
            className="min-h-[40px] border-b-2 border-transparent px-1 text-slate-600 transition-colors hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            Nạp file mẫu
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('guide')}
            className={`min-h-[40px] border-b-2 px-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'border-teal-700 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Hướng dẫn Android
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onExportZip}
            disabled={!canExport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Xuất data.zip</span>
          </button>
        </div>
      </div>
    </header>
  );
};
