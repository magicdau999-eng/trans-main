import React from 'react';
import { BookOpen, FolderArchive, Languages } from 'lucide-react';
import type { AppTab } from './HeaderBar';

interface MobileBottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  translatedCount: number;
  totalCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  translatedCount,
  totalCount,
}) => {
  const items: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'setup', label: 'Tệp & Cài đặt', icon: FolderArchive },
    {
      id: 'translate',
      label: totalCount > 0 ? `Dịch (${translatedCount}/${totalCount})` : 'Dịch thuật',
      icon: Languages,
    },
    { id: 'guide', label: 'Hướng dẫn', icon: BookOpen },
  ];

  return (
    <nav
      aria-label="Điều hướng di động"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe md:hidden"
    >
      <div className="grid h-16 grid-cols-3 items-center">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] flex-col items-center justify-center px-2 py-1.5 transition-colors ${
                isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="mt-1 max-w-full truncate text-[11px] font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
