import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AndroidGuidePanel } from './components/AndroidGuidePanel';
import { HeaderBar, type AppTab } from './components/HeaderBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/PWAInstallButton';
import { TranslationWorkbench } from './components/TranslationWorkbench';
import { UploadConfigPanel } from './components/UploadConfigPanel';
import type {
  ParsedZipBundle,
  TranslationCategory,
  TranslationEntry,
  TranslationSettings,
} from './types/rpgm';
import {
  createSampleRpgmZip,
  exportRpgmZip,
  parseRpgmZip,
} from './utils/rpgmParser';

const DEFAULT_SETTINGS: TranslationSettings = {
  targetLanguage: 'Vietnamese',
  tone: 'natural',
  glossary: '',
  enabledCategories: {
    dialogue: true,
    choice: true,
    database: true,
    system: true,
    map: true,
  },
};

const BATCH_SIZE = 25;

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('setup');
  const [bundle, setBundle] = useState<ParsedZipBundle | null>(null);
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [settings, setSettings] = useState<TranslationSettings>(DEFAULT_SETTINGS);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, currentFile: '' });

  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const loadZipBuffer = useCallback(async (buffer: ArrayBuffer | Uint8Array, fileName: string) => {
    setIsParsing(true);
    setParseError(null);
    setTranslationError(null);
    setExportNotice(null);
    try {
      const parsed = await parseRpgmZip(buffer, fileName);
      if (parsed.entries.length === 0) {
        setParseError(
          'Không tìm thấy tệp JSON văn bản hợp lệ của RPG Maker MV/MZ bên trong file zip này.'
        );
        setBundle(null);
        setEntries([]);
      } else {
        setBundle(parsed);
        setEntries(parsed.entries);
      }
    } catch (err) {
      setParseError(
        err instanceof Error
          ? `Không thể đọc file zip: ${err.message}`
          : 'Không thể giải nén file zip. Vui lòng kiểm tra lại định dạng.'
      );
      setBundle(null);
      setEntries([]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      await loadZipBuffer(buffer, file.name);
    },
    [loadZipBuffer]
  );

  const handleLoadSample = useCallback(async () => {
    const sampleBytes = await createSampleRpgmZip();
    await loadZipBuffer(sampleBytes, 'data.zip');
  }, [loadZipBuffer]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      void handleLoadSample();
    }
  }, [handleLoadSample]);

  const categoryCounts = useMemo(() => {
    const counts: Record<TranslationCategory, number> = {
      dialogue: 0,
      choice: 0,
      database: 0,
      system: 0,
      map: 0,
    };
    for (const e of entries) {
      counts[e.category]++;
    }
    return counts;
  }, [entries]);

  const pendingEnabledEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        settings.enabledCategories[e.category] &&
        e.status !== 'translated' &&
        e.status !== 'edited'
    );
  }, [entries, settings.enabledCategories]);

  const translatedCount = useMemo(
    () => entries.filter((e) => e.status === 'translated' || e.status === 'edited').length,
    [entries]
  );

  const handleStartTranslation = useCallback(async () => {
    if (!bundle || pendingEnabledEntries.length === 0 || isTranslating) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsTranslating(true);
    setTranslationError(null);
    setExportNotice(null);

    const queue = [...pendingEnabledEntries];
    const total = queue.length;
    let completed = 0;

    setProgress({ completed: 0, total, currentFile: queue[0]?.baseName || '' });

    // Switch mobile users automatically to the translation view so they see live progress
    if (window.innerWidth < 1024) {
      setActiveTab('translate');
    }

    try {
      for (let i = 0; i < queue.length; i += BATCH_SIZE) {
        if (controller.signal.aborted) break;

        const batch = queue.slice(i, i + BATCH_SIZE);
        setProgress({
          completed,
          total,
          currentFile: batch[0]?.baseName || '',
        });

        // Per-batch timeout: 110s (server already retries for 90s max)
        const batchTimeout = AbortSignal.timeout(110_000);
        const combinedSignal = AbortSignal.any
          ? AbortSignal.any([controller.signal, batchTimeout])
          : controller.signal;

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: combinedSignal,
          body: JSON.stringify({
            targetLanguage: settings.targetLanguage,
            tone: settings.tone,
            glossary: settings.glossary,
            apiKey: settings.apiKey || undefined,
            items: batch.map((b) => ({
              id: b.id,
              text: b.originalText,
              context: b.contextLabel,
              lineCount: b.lineCount,
            })),
          }),
        });

        const data = (await res.json()) as {
          translations?: { id: string; translated: string }[];
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
        }

        const resultMap = new Map<string, string>();
        for (const item of data.translations ?? []) {
          if (item && typeof item.id === 'string' && typeof item.translated === 'string') {
            resultMap.set(item.id, item.translated);
          }
        }

        setEntries((prev) =>
          prev.map((entry) => {
            const translated = resultMap.get(entry.id);
            if (translated !== undefined) {
              return {
                ...entry,
                translatedText: translated,
                status: 'translated',
                errorMessage: undefined,
              };
            }
            return entry;
          })
        );

        completed += batch.length;
        setProgress({
          completed,
          total,
          currentFile: batch[batch.length - 1]?.baseName || '',
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setTranslationError(
          err instanceof Error ? err.message : 'Đã xảy ra lỗi khi dịch bằng Gemini.'
        );
      }
    } finally {
      setIsTranslating(false);
      abortRef.current = null;
    }
  }, [bundle, isTranslating, pendingEnabledEntries, settings]);

  const handleStopTranslation = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleUpdateEntry = useCallback((id: string, nextText: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              translatedText: nextText,
              status: nextText.trim().length > 0 ? 'edited' : 'pending',
            }
          : e
      )
    );
  }, []);

  const handleResetEntry = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, translatedText: '', status: 'pending' } : e
      )
    );
  }, []);

  const handleExportZip = useCallback(async () => {
    if (!bundle || isExporting) return;
    setIsExporting(true);
    setExportNotice(null);
    try {
      const zipBytes = await exportRpgmZip(bundle, entries, settings.enabledCategories);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = bundle.fileName || 'data.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportNotice(
        `Đã xuất thành công ${bundle.fileName || 'data.zip'} (${translatedCount}/${entries.length} mục đã dịch). Hãy giải nén và dán đè vào thư mục data/ của game.`
      );
    } catch (err) {
      setTranslationError(
        err instanceof Error ? `Lỗi xuất file zip: ${err.message}` : 'Không thể đóng gói data.zip.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [bundle, entries, isExporting, settings.enabledCategories, translatedCount]);

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      <HeaderBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLoadSample={() => {
          setActiveTab('setup');
          void handleLoadSample();
        }}
        canExport={!!bundle && !isExporting}
        onExportZip={() => void handleExportZip()}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {exportNotice && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900"
          >
            {exportNotice}
          </div>
        )}

        {activeTab === 'guide' ? (
          <AndroidGuidePanel />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
            <div className={activeTab === 'setup' ? 'block' : 'hidden lg:block'}>
              <UploadConfigPanel
                bundle={bundle}
                isParsing={isParsing}
                parseError={parseError}
                settings={settings}
                onSettingsChange={setSettings}
                onUploadFile={(f) => void handleUploadFile(f)}
                onLoadSample={() => void handleLoadSample()}
                isTranslating={isTranslating}
                onStartTranslation={() => void handleStartTranslation()}
                onStopTranslation={handleStopTranslation}
                pendingEnabledCount={pendingEnabledEntries.length}
                categoryCounts={categoryCounts}
              />
            </div>

            <div className={activeTab === 'translate' ? 'block' : 'hidden lg:block'}>
              <TranslationWorkbench
                bundle={bundle}
                entries={entries}
                isTranslating={isTranslating}
                progress={progress}
                translationError={translationError}
                onUpdateEntry={handleUpdateEntry}
                onResetEntry={handleResetEntry}
                onExportZip={() => void handleExportZip()}
                onLoadSample={() => void handleLoadSample()}
                isExporting={isExporting}
              />
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        translatedCount={translatedCount}
        totalCount={entries.length}
      />

      <OfflineIndicator />
    </div>
  );
}
