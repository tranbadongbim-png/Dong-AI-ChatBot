import React, { useState } from "react";
import { X, Sliders, Check, RotateCcw, Key, ShieldCheck } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInstruction: string;
  onSaveSystemInstruction: (instruction: string) => void;
  customApiKey: string;
  onSaveCustomApiKey: (apiKey: string) => void;
}

const SYSTEM_PROMPT_PRESETS = [
  {
    title: "Chuyên gia suy luận & Lập trình",
    text: "Bạn là một kỹ sư phần mềm cao cấp và chuyên gia thuật toán. Luôn phân tích vấn đề theo từng bước logic, giải thích chi tiết các giả định, cân nhắc độ phức tạp thuật toán và đưa ra code mẫu tối ưu, sạch sẽ, có xử lý ngoại lệ.",
  },
  {
    title: "Trợ lý tổng quát chuẩn mực",
    text: "Bạn là Gemini 3.6 Flash AI Assistant, một trợ lý thông minh, trung thực, chính xác và súc tích. Trả lời bằng tiếng Việt rõ ràng, trình bày có cấu trúc bằng markdown với tiêu đề và gạch đầu dòng khoa học.",
  },
  {
    title: "Giáo sư Toán & Khoa học",
    text: "Bạn là một nhà toán học và khoa học dữ liệu. Khi nhận câu hỏi, hãy trình bày lời giải tường minh, nêu rõ công thức, diễn giải logic từng bước và kiểm tra lại kết quả trước khi kết luận.",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  systemInstruction,
  onSaveSystemInstruction,
  customApiKey,
  onSaveCustomApiKey,
}) => {
  const [instruction, setInstruction] = useState(systemInstruction);
  const [apiKey, setApiKey] = useState(customApiKey || "");
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSystemInstruction(instruction);
    onSaveCustomApiKey(apiKey.trim());
    onClose();
  };

  const handleReset = () => {
    setInstruction("");
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="settings-modal-dialog"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cài đặt &amp; Khóa API
              </h3>
              <p className="text-xs text-slate-500">
                Cấu hình API Key Cloudflare &amp; Prompt Hệ Thống
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Gemini API Key section */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Key className="h-3.5 w-3.5 text-amber-600" />
                <span>Google Gemini API Key (Khi deploy lên Cloudflare)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[11px] font-semibold text-amber-800 hover:underline"
              >
                {showKey ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
              Nhập API Key để app chat trực tiếp với Google Gemini, hoạt động tốt trên cả Cloudflare Pages. Khóa được lưu an toàn trong trình duyệt (Local Storage).
            </p>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Lưu trữ cục bộ (Local Storage)
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 font-semibold hover:underline"
              >
                Lấy API key miễn phí ↗
              </a>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Chỉ dẫn hệ thống cho mô hình (System Instruction)
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Nhập vai trò hoặc quy tắc ứng xử (ví dụ: Bạn là chuyên gia giải toán...)"
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Mẫu vai trò có sẵn
            </span>
            <div className="space-y-1.5">
              {SYSTEM_PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setInstruction(preset.text)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-left text-xs transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                >
                  <div className="font-semibold text-slate-800">
                    {preset.title}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                    {preset.text}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Mặc định Prompt</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
