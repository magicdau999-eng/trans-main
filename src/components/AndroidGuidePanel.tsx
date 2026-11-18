import React from 'react';
import { FolderArchive, HardDriveDownload, PlayCircle, Smartphone } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export const AndroidGuidePanel: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Cài đặt ứng dụng lên màn hình chính Android',
      body: 'Mở trang này bằng Google Chrome trên Android, nhấn nút "Cài app Android" ở góc trên (hoặc mở menu Chrome ⋮ > Thêm vào Màn hình chính) để sử dụng như ứng dụng độc lập toàn màn hình.',
      icon: Smartphone,
    },
    {
      num: '02',
      title: 'Nén thư mục data thành data.zip trên điện thoại',
      body: 'Dùng ứng dụng quản lý tệp (như ZArchiver hoặc Tệp của Google), vào thư mục game RPG Maker của bạn (thường nằm ở Bộ nhớ trong > JoiPlay > tên game > www/data hoặc /data), chọn toàn bộ tệp .json bên trong và nén thành data.zip.',
      icon: FolderArchive,
    },
    {
      num: '03',
      title: 'Dịch bằng Gemini và giữ nguyên file Save cũ',
      body: 'Nạp file data.zip vào mục Tải tệp, chọn Ngôn ngữ đích và nhấn Bắt đầu dịch. RPGM Lingua chỉ dịch phần văn bản hiển thị và giữ nguyên 100% mã sự kiện, biến (\\V[n]), tên nhân vật (\\N[n]) và chỉ số lệnh nên không làm hỏng file save đang chơi dở.',
      icon: PlayCircle,
    },
    {
      num: '04',
      title: 'Xuất data.zip và dán lại vào game để chơi tiếp',
      body: 'Nhấn "Xuất file data.zip", giải nén file vừa tải bằng ZArchiver và chép đè vào thư mục data/ gốc của game (KHÔNG xóa thư mục save/). Mở lại JoiPlay hoặc APK game để tiếp tục hành trình với ngôn ngữ mới.',
      icon: HardDriveDownload,
    },
  ];

  return (
    <section aria-labelledby="android-guide-title" className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              id="android-guide-title"
              className="font-display text-2xl font-bold tracking-tight text-slate-900"
            >
              Hướng dẫn sử dụng trên Android
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Quy trình 4 bước giúp bạn Việt hóa hoặc dịch game RPG Maker MV/MZ chơi trên JoiPlay hoặc APK Android mà vẫn giữ nguyên tiến trình save game.
            </p>
          </div>
          <PWAInstallButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article
              key={step.num}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-teal-700">
                  Bước {step.num}
                </span>
                <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <h2 className="mt-2 font-display text-base font-semibold text-slate-900">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Lưu ý kỹ thuật để tránh lỗi game khi dán lại
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          <li>
            • Cấu trúc thư mục bên trong file <code className="font-mono text-xs text-slate-800">data.zip</code> xuất ra luôn khớp 100% với file gốc bạn tải lên (kể cả khi nằm trong thư mục con <code className="font-mono text-xs text-slate-800">data/</code> hay ở thư mục gốc).
          </li>
          <li>
            • Mọi tệp script, plugin command (<code className="font-mono text-xs text-slate-800">code 355, 356, 357</code>), ghi chú plugin (<code className="font-mono text-xs text-slate-800">note</code>), công tắc và biến số được bỏ qua tự động để không làm kẹt sự kiện trong game.
          </li>
          <li>
            • Nếu game dùng font chữ không hỗ trợ dấu tiếng Việt (bị ô vuông), hãy chép một file font hỗ trợ tiếng Việt (như Noto Sans hoặc Roboto) vào thư mục <code className="font-mono text-xs text-slate-800">fonts/</code> của game nếu cần.
          </li>
        </ul>
      </div>
    </section>
  );
};
