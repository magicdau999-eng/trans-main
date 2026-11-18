import React, { useMemo, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import type { ParsedZipBundle, TranslationEntry } from '../types/rpgm';

type FilterStatus = 'all' | 'pending' | 'done' | 'edited';

interface TranslationWorkbenchProps {
  bundle: ParsedZipBundle | null;
  entries: TranslationEntry[];
  isTranslating: boolean;
  progress: { completed: number; total: number; currentFile: string };
  translationError: string | null;
  onUpdateEntry: (id: string, nextText: string) => void;
  onResetEntry: (id: string) => void;
  onExportZip: () => void;
  onLoadSample: () => void;
  isExporting: boolean;
}

const ESCAPE_CODE_REGEX = /(\\[A-Za-z]+\[\d+\]|\\[A-Za-z{}|$!><^.\\]|%\d+)/g;

function renderTextWithCodes(text: string): React.ReactNode {
  const parts = text.split(ESCAPE_CODE_REGEX);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (ESCAPE_CODE_REGEX.test(part)) {
      ESCAPE_CODE_REGEX.lastIndex = 0;
      return (
        <code
          key={idx}
          className="mx-0.5 rounded bg-slate-200/80 px-1 py-0.5 font-mono text-[11px] font-medium text-teal-900"
        >
          {part}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const TranslationWorkbench: React.FC<TranslationWorkbenchProps> = ({
  bundle,
  entries,
  isTranslating,
  progress,
  translationError,
  onUpdateEntry,
  onResetEntry,
  onExportZip,
  onLoadSample,
  isExporting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [fileFilter, setFileFilter] = useState<string>('all');

  const fileOptions = useMemo(() => {
    const names = Array.from(new Set(entries.map((e) => e.baseName)));
    return names;
  }, [entries]);

  const stats = useMemo(() => {
    let done = 0;
    let edited = 0;
    let pending = 0;
    for (const e of entries) {
      if (e.status === 'edited') {
        done++;
        edited++;
      } else if (e.status === 'translated') {
        done++;
      } else {
        pending++;
      }
    }
    return { total: entries.length, done, edited, pending };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (fileFilter !== 'all' && entry.baseName !== fileFilter) return false;
      if (statusFilter === 'pending' && entry.status !== 'pending' && entry.status !== 'error') {
        return false;
      }
      if (statusFilter === 'done' && entry.status !== 'translated' && entry.status !== 'edited') {
        return false;
      }
      if (statusFilter === 'edited' && entry.status !== 'edited') return false;
      if (!q) return true;
      return (
        entry.originalText.toLowerCase().includes(q) ||
        entry.translatedText.toLowerCase().includes(q) ||
        entry.contextLabel.toLowerCase().includes(q)
      );
    });
  }, [entries, fileFilter, statusFilter, searchQuery]);

  if (!bundle) {
    return (
      <section
        aria-label="Bàn dịch thuật"
        className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center"
      >
        <div className="max-w-md space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Chưa có dữ liệu game được nạp
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Hãy chọn file <code className="font-mono text-xs text-slate-800">data.zip</code> từ thư mục game RPG Maker trên điện thoại hoặc tải bộ dữ liệu mẫu để kiểm thử quy trình dịch và xuất file.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
            >
              Nạp ngay file mẫu RPGM
            </button>
          </div>
        </div>
      </section>
    );
  }

  const pct =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <section aria-label="Bàn dịch thuật" className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 tabular-nums">
              <span className="font-semibold text-slate-900">Tiến độ dịch</span>
              <span aria-hidden="true">·</span>
              <span>
                {stats.done}/{stats.total} mục ({pct}%)
              </span>
              {stats.edited > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Đã sửa tay {stats.edited}</span>
                </>
              )}
            </div>
            {isTranslating && (
              <p className="mt-1 text-xs font-medium text-teal-700 tabular-nums" role="status">
                Đang dịch bằng Gemini ({progress.completed}/{progress.total})
                {progress.currentFile ? ` · ${progress.currentFile}` : ''}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onExportZip}
            disabled={isExporting}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{isExporting ? 'Đang đóng gói...' : 'Xuất file data.zip'}</span>
          </button>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-teal-700 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        {translationError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {translationError}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Tìm kiếm chuỗi gốc hoặc bản dịch"
              placeholder="Tìm lời thoại, vật phẩm, ngữ cảnh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <select
            aria-label="Lọc theo tệp JSON"
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none sm:w-44"
          >
            <option value="all">Tất cả tệp ({entries.length})</option>
            {fileOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
          {(
            [
              { id: 'all', label: `Tất cả (${stats.total})` },
              { id: 'pending', label: `Chưa dịch (${stats.pending})` },
              { id: 'done', label: `Đã dịch (${stats.done})` },
              { id: 'edited', label: `Đã sửa (${stats.edited})` },
            ] as { id: FilterStatus; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[38px] flex-1 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Không tìm thấy mục nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-3" data-testid="translation-entry-list">
          {filteredEntries.slice(0, 150).map((entry) => {
            const statusText =
              entry.status === 'edited'
                ? 'Đã chỉnh sửa'
                : entry.status === 'translated'
                  ? 'Đã dịch'
                  : entry.status === 'error'
                    ? 'Lỗi'
                    : 'Chờ dịch';
            const statusColor =
              entry.status === 'edited'
                ? 'text-teal-800'
                : entry.status === 'translated'
                  ? 'text-emerald-700'
                  : entry.status === 'error'
                    ? 'text-red-700'
                    : 'text-slate-500';

            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                    <span className="font-mono font-medium text-slate-800">{entry.baseName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.contextLabel}</span>
                    {entry.lineCount > 1 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{entry.lineCount} dòng thoại</span>
                      </>
                    )}
                  </div>
                  <span className={`font-medium ${statusColor}`}>{statusText}</span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {renderTextWithCodes(entry.originalText)}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <textarea
                      aria-label={`Bản dịch cho ${entry.contextLabel}`}
                      rows={Math.min(6, Math.max(3, entry.lineCount + 1))}
                      value={entry.translatedText}
                      onChange={(e) => onUpdateEntry(entry.id, e.target.value)}
                      placeholder="Bản dịch sẽ hiển thị ở đây hoặc bạn có thể nhập trực tiếp..."
                      className="min-h-[84px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                    />
                    {entry.translatedText && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => onResetEntry(entry.id)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 px-2 text-xs font-medium text-slate-500 hover:text-slate-900"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Xóa bản dịch</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {filteredEntries.length > 150 && (
            <p className="py-2 text-center text-xs text-slate-500 tabular-nums">
              Đang hiển thị 150/{filteredEntries.length} mục khớp lọc. Dùng ô tìm kiếm hoặc lọc tệp để xem chính xác mục cần sửa.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
