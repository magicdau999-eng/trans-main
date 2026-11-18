import React, { useRef, useState } from 'react';
import { FileArchive, FolderOpen, Play, Square, Upload } from 'lucide-react';
import type {
  ParsedZipBundle,
  TranslationCategory,
  TranslationSettings,
  TranslationTone,
} from '../types/rpgm';

const PRESET_LANGUAGES = [
  { value: 'Vietnamese', label: 'Tiếng Việt' },
  { value: 'English', label: 'English' },
  { value: 'Japanese', label: '日本語 (Tiếng Nhật)' },
  { value: 'Chinese (Simplified)', label: '简体中文 (Tiếng Trung)' },
  { value: 'Korean', label: '한국어 (Tiếng Hàn)' },
  { value: 'Thai', label: 'ภาษาไทย (Tiếng Thái)' },
  { value: 'Indonesian', label: 'Bahasa Indonesia' },
  { value: 'Spanish', label: 'Español' },
  { value: 'French', label: 'Français' },
  { value: 'custom', label: 'Ngôn ngữ khác...' },
];

const CATEGORY_META: { id: TranslationCategory; label: string; hint: string }[] = [
  { id: 'dialogue', label: 'Hội thoại & Sự kiện', hint: 'Lời thoại nhân vật, chữ cuộn' },
  { id: 'choice', label: 'Lựa chọn rẽ nhánh', hint: 'Bảng chọn câu trả lời' },
  { id: 'database', label: 'Vật phẩm, Kỹ năng & Nhân vật', hint: 'Actors, Items, Skills, Enemies' },
  { id: 'system', label: 'Hệ thống & Menu', hint: 'Thuật ngữ giao diện, thông báo chiến đấu' },
  { id: 'map', label: 'Tên bản đồ', hint: 'displayName của các Map' },
];

interface UploadConfigPanelProps {
  bundle: ParsedZipBundle | null;
  isParsing: boolean;
  parseError: string | null;
  settings: TranslationSettings;
  onSettingsChange: (next: TranslationSettings) => void;
  onUploadFile: (file: File) => void;
  onLoadSample: () => void;
  isTranslating: boolean;
  onStartTranslation: () => void;
  onStopTranslation: () => void;
  pendingEnabledCount: number;
  categoryCounts: Record<TranslationCategory, number>;
}

export const UploadConfigPanel: React.FC<UploadConfigPanelProps> = ({
  bundle,
  isParsing,
  parseError,
  settings,
  onSettingsChange,
  onUploadFile,
  onLoadSample,
  isTranslating,
  onStartTranslation,
  onStopTranslation,
  pendingEnabledCount,
  categoryCounts,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isPreset = PRESET_LANGUAGES.some(
    (l) => l.value !== 'custom' && l.value === settings.targetLanguage
  );
  const [langSelect, setLangSelect] = useState<string>(
    isPreset ? settings.targetLanguage : 'custom'
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const handleLanguageSelect = (val: string) => {
    setLangSelect(val);
    if (val !== 'custom') {
      onSettingsChange({ ...settings, targetLanguage: val });
    } else if (isPreset) {
      onSettingsChange({ ...settings, targetLanguage: '' });
    }
  };

  const toggleCategory = (cat: TranslationCategory) => {
    onSettingsChange({
      ...settings,
      enabledCategories: {
        ...settings.enabledCategories,
        [cat]: !settings.enabledCategories[cat],
      },
    });
  };

  return (
    <section aria-labelledby="upload-config-heading" className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              id="upload-config-heading"
              className="font-display text-xl font-bold tracking-tight text-slate-900"
            >
              Nạp tệp data.zip
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Chọn gói dữ liệu RPG Maker MV/MZ để tự động tách lời thoại, vật phẩm và giao diện.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          id="rpgm-zip-input"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileChange}
          className="sr-only"
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-4 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
            isDragging
              ? 'border-teal-600 bg-teal-50/70'
              : 'border-slate-300 bg-slate-50/70'
          }`}
        >
          <Upload className="mx-auto h-7 w-7 text-teal-700" aria-hidden="true" />
          <p className="mt-2.5 text-sm font-medium text-slate-900">
            {bundle ? bundle.fileName : 'Chọn hoặc kéo thả file data.zip vào đây'}
          </p>
          <p className="mt-1 text-xs text-slate-500 text-balance">
            Hỗ trợ RPG Maker MV/MZ · Giữ nguyên lệnh và file save
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || isTranslating}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              <span>{bundle ? 'Đổi file data.zip' : 'Chọn file data.zip'}</span>
            </button>

            <button
              type="button"
              onClick={onLoadSample}
              disabled={isParsing || isTranslating}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <FileArchive className="h-4 w-4" aria-hidden="true" />
              <span>Dùng file mẫu RPGM</span>
            </button>
          </div>
        </div>

        {isParsing && (
          <p className="mt-3 text-xs font-medium text-teal-700" role="status">
            Đang giải nén và phân tích cấu trúc RPG Maker...
          </p>
        )}

        {parseError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {parseError}
          </div>
        )}

        {bundle && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 tabular-nums">
              <span className="font-semibold text-slate-900">{bundle.fileName}</span>
              <span aria-hidden="true">·</span>
              <span>{bundle.totalFiles} tệp trong gói</span>
              <span aria-hidden="true">·</span>
              <span>{bundle.entries.length} chuỗi văn bản</span>
            </div>

            <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {bundle.files
                .filter((f) => f.isTranslatable)
                .map((file) => (
                  <div
                    key={file.filePath}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="truncate font-mono text-slate-800" title={file.filePath}>
                      {file.filePath}
                    </span>
                    <span className="shrink-0 font-mono text-slate-500 tabular-nums">
                      {file.entryCount} mục
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Thiết lập bản dịch Gemini
        </h2>

        <div className="space-y-1.5">
          <label htmlFor="target-lang-select" className="block text-xs font-medium text-slate-700">
            Ngôn ngữ đích
          </label>
          <select
            id="target-lang-select"
            value={langSelect}
            onChange={(e) => handleLanguageSelect(e.target.value)}
            disabled={isTranslating}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          >
            {PRESET_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          {langSelect === 'custom' && (
            <input
              type="text"
              aria-label="Nhập tên ngôn ngữ đích"
              placeholder="Ví dụ: Tiếng Việt (Hán Việt) hoặc Tiếng Đức"
              value={settings.targetLanguage}
              onChange={(e) =>
                onSettingsChange({ ...settings, targetLanguage: e.target.value })
              }
              disabled={isTranslating}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-slate-700">Phong cách dịch</span>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: 'natural', label: 'Tự nhiên' },
                { id: 'faithful', label: 'Sát nghĩa' },
                { id: 'casual', label: 'Đời thường' },
              ] as { id: TranslationTone; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSettingsChange({ ...settings, tone: item.id })}
                disabled={isTranslating}
                className={`min-h-[40px] rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  settings.tone === item.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="glossary-input" className="block text-xs font-medium text-slate-700">
            Từ điển tên riêng / Thuật ngữ cố định (tùy chọn)
          </label>
          <textarea
            id="glossary-input"
            rows={2}
            placeholder="Ví dụ: Ren = Ren&#10;Starfall Village = Làng Sao Rơi"
            value={settings.glossary}
            onChange={(e) => onSettingsChange({ ...settings, glossary: e.target.value })}
            disabled={isTranslating}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="api-key-input" className="block text-xs font-medium text-slate-700">
            Gemini API Key (tùy chọn — ghi đè biến môi trường)
          </label>
          <input
            id="api-key-input"
            type="password"
            autoComplete="off"
            placeholder="AIza..."
            value={settings.apiKey ?? ''}
            onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value || undefined })}
            disabled={isTranslating}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none font-mono"
          />
          <p className="text-[11px] text-slate-400">
            Điền để thay API key mà không cần khởi động lại server. Để trống để dùng key trong <code className="font-mono">.env</code>.
          </p>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-700">
            Phân loại dữ liệu cần dịch
          </span>
          <div className="space-y-1.5">
            {CATEGORY_META.map((cat) => {
              const checked = settings.enabledCategories[cat.id];
              const count = categoryCounts[cat.id] || 0;
              return (
                <label
                  key={cat.id}
                  className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(cat.id)}
                      disabled={isTranslating}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{cat.label}</div>
                      <div className="truncate text-xs text-slate-500">{cat.hint}</div>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-slate-500 tabular-nums">
                    {count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          {!isTranslating ? (
            <button
              type="button"
              onClick={onStartTranslation}
              disabled={!bundle || pendingEnabledCount === 0 || !settings.targetLanguage.trim()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>
                {bundle
                  ? pendingEnabledCount > 0
                    ? `Bắt đầu dịch với Gemini (${pendingEnabledCount} mục)`
                    : 'Đã dịch xong toàn bộ mục đã chọn'
                  : 'Nạp file data.zip để bắt đầu dịch'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopTranslation}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              <span>Tạm dừng dịch</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
